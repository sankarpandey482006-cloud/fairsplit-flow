/**
 * FairSplit Flow - Client-Side Mathematical Debt Engine
 * =====================================================
 * Exact integer arithmetic (cents/paise) running directly in the browser.
 * Provides instant live preview for expense inputs and offline calculations.
 */

window.ClientDebtEngine = {
    toCents(amount) {
        if (typeof amount === 'number' && Number.isInteger(amount)) {
            return amount * 100;
        }
        return Math.round((parseFloat(amount) || 0) * 100);
    },

    toCurrency(cents) {
        return (cents / 100).toFixed(2);
    },

    calculateEqualSplit(totalCents, memberIds) {
        const n = memberIds.length;
        if (n === 0) return {};
        const baseShare = Math.floor(totalCents / n);
        const remainder = totalCents % n;

        const sorted = [...memberIds].sort();
        const shares = {};
        sorted.forEach((mId, idx) => {
            shares[mId] = baseShare + (idx < remainder ? 1 : 0);
        });
        return shares;
    },

    calculateShares(totalCents, splitMethod, memberIds, splitData = {}) {
        if (!memberIds || memberIds.length === 0) return {};

        if (splitMethod === 'equal') {
            return this.calculateEqualSplit(totalCents, memberIds);
        }

        if (splitMethod === 'exact') {
            const shares = {};
            let totalGiven = 0;
            memberIds.forEach(m => {
                const val = splitData[m] || 0;
                const centsVal = typeof val === 'number' && val > 1000 ? val : this.toCents(val);
                shares[m] = centsVal;
                totalGiven += centsVal;
            });
            const diff = totalCents - totalGiven;
            if (diff !== 0 && memberIds.length > 0) {
                shares[memberIds[0]] += diff;
            }
            return shares;
        }

        if (splitMethod === 'percentage' || splitMethod === 'percent') {
            let totalPct = 0;
            memberIds.forEach(m => {
                totalPct += parseFloat(splitData[m] || 0);
            });
            if (totalPct <= 0) return this.calculateEqualSplit(totalCents, memberIds);

            const shares = {};
            let assigned = 0;
            memberIds.forEach(m => {
                const pct = parseFloat(splitData[m] || 0);
                const share = Math.round(totalCents * (pct / totalPct));
                shares[m] = share;
                assigned += share;
            });
            const diff = totalCents - assigned;
            if (diff !== 0 && memberIds.length > 0) {
                shares[memberIds[0]] += diff;
            }
            return shares;
        }

        if (['shares', 'custom_ratio', 'days_stayed', 'salary_ratio'].includes(splitMethod)) {
            let totalWeight = 0;
            memberIds.forEach(m => {
                totalWeight += parseFloat(splitData[m] || 0);
            });
            if (totalWeight <= 0) return this.calculateEqualSplit(totalCents, memberIds);

            const shares = {};
            let assigned = 0;
            memberIds.forEach(m => {
                const weight = parseFloat(splitData[m] || 0);
                const share = Math.floor(totalCents * (weight / totalWeight));
                shares[m] = share;
                assigned += share;
            });
            const remainder = totalCents - assigned;
            const sortedByWeight = [...memberIds].sort((a, b) => (parseFloat(splitData[b] || 0)) - (parseFloat(splitData[a] || 0)));
            for (let i = 0; i < remainder; i++) {
                shares[sortedByWeight[i % sortedByWeight.length]] += 1;
            }
            return shares;
        }

        return this.calculateEqualSplit(totalCents, memberIds);
    },

    buildNetBalances(members, expenses, settlements = []) {
        const memberIds = members.map(m => m.id);
        const totalPaid = {};
        const totalShare = {};
        memberIds.forEach(id => {
            totalPaid[id] = 0;
            totalShare[id] = 0;
        });

        expenses.forEach(exp => {
            if (exp.status === 'rejected') return;
            const payerId = exp.paid_by;
            const amt = exp.amount_cents;
            if (totalPaid[payerId] !== undefined) {
                totalPaid[payerId] += amt;
            }
            (exp.shares || []).forEach(s => {
                if (totalShare[s.member_id] !== undefined) {
                    totalShare[s.member_id] += s.share_cents;
                }
            });
        });

        settlements.forEach(s => {
            if (s.status === 'paid') {
                if (totalPaid[s.from_member_id] !== undefined) {
                    totalPaid[s.from_member_id] += s.amount_cents;
                }
                if (totalShare[s.to_member_id] !== undefined) {
                    totalShare[s.to_member_id] += s.amount_cents;
                }
            }
        });

        const netBalances = {};
        memberIds.forEach(id => {
            netBalances[id] = totalPaid[id] - totalShare[id];
        });

        // Verify zero sum
        let sum = Object.values(netBalances).reduce((a, b) => a + b, 0);
        if (sum !== 0 && memberIds.length > 0) {
            netBalances[memberIds[0]] -= sum;
        }

        return { netBalances, totalPaid, totalShare };
    },

    simplifyDebtsGreedy(netBalances, membersMap) {
        const creditors = []; // { id, amount }
        const debtors = [];   // { id, amount }

        Object.entries(netBalances).forEach(([mId, bal]) => {
            const name = membersMap[mId] ? membersMap[mId].name : mId;
            if (bal > 0) {
                creditors.push({ id: mId, name, amount: bal });
            } else if (bal < 0) {
                debtors.push({ id: mId, name, amount: Math.abs(bal) });
            }
        });

        // Max heap simulation by sorting descending
        creditors.sort((a, b) => b.amount - a.amount);
        debtors.sort((a, b) => b.amount - a.amount);

        const transfers = [];
        const traceSteps = [];
        let step = 1;

        while (creditors.length > 0 && debtors.length > 0) {
            const debtor = debtors[0];
            const creditor = creditors[0];

            const transferAmount = Math.min(debtor.amount, creditor.amount);

            transfers.push({
                id: `tr_${step}_${debtor.id.slice(0, 4)}_${creditor.id.slice(0, 4)}`,
                from_member_id: debtor.id,
                from_name: debtor.name,
                to_member_id: creditor.id,
                to_name: creditor.name,
                amount_cents: transferAmount,
                amount: (transferAmount / 100).toFixed(2),
                method: 'greedy'
            });

            debtor.amount -= transferAmount;
            creditor.amount -= transferAmount;

            traceSteps.push({
                step: step++,
                debtor: debtor.name,
                creditor: creditor.name,
                settled_amount: (transferAmount / 100).toFixed(2),
                debtor_remaining: (debtor.amount / 100).toFixed(2),
                creditor_remaining: (creditor.amount / 100).toFixed(2),
                explanation: `${debtor.name} pays ${creditor.name} ₹${(transferAmount / 100).toFixed(2)}.`
            });

            if (debtor.amount <= 0) debtors.shift();
            else debtors.sort((a, b) => b.amount - a.amount);

            if (creditor.amount <= 0) creditors.shift();
            else creditors.sort((a, b) => b.amount - a.amount);
        }

        return { transfers, traceSteps };
    }
};
