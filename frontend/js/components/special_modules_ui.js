/**
 * FairSplit Flow - Special Modules UI
 * ===================================
 * 1. Hostel & Roommates: Move-Out Final Settlement & Days-Stayed Split
 * 2. Clubs & Events: Budget vs Actual Tracker, Approvals & Sponsor Funds
 * 3. Office & Business: Reimbursement Ledger & Cost Centers
 */

class SpecialModulesUI {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = options;
        this.currentGroupId = null;
    }

    renderHostelModule(group, members) {
        this.container.innerHTML = `
            <div class="space-y-6">
                <!-- Move-Out Final Settlement Calculator -->
                <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg">
                            📦
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800 dark:text-slate-100 text-base">Roommate Move-Out Final Settlement</h4>
                            <p class="text-xs text-slate-400">Account for security deposit return, pending utility shares, and damage deductions.</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Leaving Roommate</label>
                            <select id="moveout-member-select" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
                                ${members.map(m => `<option value="${m.id}">${m.name} (${m.net_balance_formatted})</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Security Deposit Refund</label>
                            <input type="number" id="moveout-deposit" value="2000" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" />
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Pending Utilities Share</label>
                            <input type="number" id="moveout-utilities" value="400" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" />
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Damage / Cleaning Charges</label>
                            <input type="number" id="moveout-damage" value="100" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" />
                        </div>
                    </div>

                    <div class="flex items-center justify-between pt-2">
                        <button id="btn-calc-moveout" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition">
                            Calculate Final Payout
                        </button>
                        <div id="moveout-result-badge" class="hidden px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs">
                            <!-- Populated dynamically -->
                        </div>
                    </div>
                </div>

                <!-- Monthly Utility Presets -->
                <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                    <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm">Quick Monthly Flat Utilities</h4>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <button class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-left transition" onclick="window.app.openExpenseModal('Rent')">
                            <span class="text-base block">🏠</span>
                            <span class="font-semibold text-xs text-slate-800 dark:text-slate-200 block">Apartment Rent</span>
                            <span class="text-[10px] text-slate-400">Monthly recurring</span>
                        </button>
                        <button class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-left transition" onclick="window.app.openExpenseModal('Electricity')">
                            <span class="text-base block">⚡</span>
                            <span class="font-semibold text-xs text-slate-800 dark:text-slate-200 block">Electricity (Bescom)</span>
                            <span class="text-[10px] text-slate-400">Split by days stayed</span>
                        </button>
                        <button class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-left transition" onclick="window.app.openExpenseModal('WiFi')">
                            <span class="text-base block">📶</span>
                            <span class="font-semibold text-xs text-slate-800 dark:text-slate-200 block">High-Speed WiFi</span>
                            <span class="text-[10px] text-slate-400">Broadband bill</span>
                        </button>
                        <button class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-left transition" onclick="window.app.openExpenseModal('Maid')">
                            <span class="text-base block">🧹</span>
                            <span class="font-semibold text-xs text-slate-800 dark:text-slate-200 block">Maid & Cook</span>
                            <span class="text-[10px] text-slate-400">Monthly salary</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.bindHostelEvents(group);
    }

    bindHostelEvents(group) {
        const btnCalc = this.container.querySelector('#btn-calc-moveout');
        btnCalc.onclick = async () => {
            const memberId = this.container.querySelector('#moveout-member-select').value;
            const deposit = this.container.querySelector('#moveout-deposit').value;
            const utilities = this.container.querySelector('#moveout-utilities').value;
            const damage = this.container.querySelector('#moveout-damage').value;

            try {
                const res = await fetch(`/api/groups/${group.id}/special/hostel/move-out?member_id=${memberId}&security_deposit=${deposit}&pending_utilities=${utilities}&damage_charges=${damage}`);
                const data = await res.json();
                const badge = this.container.querySelector('#moveout-result-badge');
                badge.classList.remove('hidden');
                badge.className = data.direction === 'ROOMMATE_RECEIVES'
                    ? 'px-4 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs'
                    : 'px-4 py-2 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 font-bold text-xs';
                badge.textContent = `Result: ${data.summary_text}`;
            } catch (err) {
                console.error(err);
            }
        };
    }

    async renderClubModule(group) {
        try {
            const res = await fetch(`/api/groups/${group.id}/special/club/budget`);
            const data = await res.json();
            const budgets = data.budgets || {};
            const sponsors = data.sponsors || {};
            const pendingApprovals = data.pending_approvals || [];

            this.container.innerHTML = `
                <div class="space-y-6">
                    <!-- Overall Budget Burn Progress Bar -->
                    <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                        <div class="flex items-center justify-between">
                            <div>
                                <h4 class="font-bold text-slate-800 dark:text-slate-100 text-base">Club Budget vs Actual Spending</h4>
                                <p class="text-xs text-slate-400">Total Allocated: ${group.currency_symbol}${budgets.total_budget_formatted} • Actual: ${group.currency_symbol}${budgets.total_actual_formatted}</p>
                            </div>
                            <span class="text-sm font-bold ${budgets.overall_utilization_pct > 100 ? 'text-rose-500' : 'text-emerald-600'}">
                                ${budgets.overall_utilization_pct}% Utilized
                            </span>
                        </div>

                        <!-- Progress Bar -->
                        <div class="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                            <div class="h-full ${budgets.overall_utilization_pct > 100 ? 'bg-rose-500' : 'bg-emerald-500'} rounded-full transition-all duration-500" style="width: ${Math.min(100, budgets.overall_utilization_pct)}%"></div>
                        </div>

                        <!-- Category Breakdown -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            ${(budgets.categories || []).map(cat => `
                                <div class="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs">
                                    <div class="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                                        <span>${cat.category}</span>
                                        <span class="${cat.status === 'OVER_BUDGET' ? 'text-rose-500' : 'text-emerald-600'}">${cat.utilization_pct}%</span>
                                    </div>
                                    <div class="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                                        <span>Budget: ${group.currency_symbol}${cat.allocated_formatted}</span>
                                        <span>Actual: ${group.currency_symbol}${cat.actual_formatted}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Sponsor Funding Tracker -->
                    <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                        <div class="flex items-center justify-between">
                            <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm">Sponsor Commitments & Collections</h4>
                            <span class="text-xs px-2.5 py-1 rounded-full ${sponsors.status === 'SURPLUS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} font-semibold">
                                ${sponsors.status}: ${group.currency_symbol}${sponsors.net_surplus_deficit_formatted}
                            </span>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            ${(data.sponsors_list || []).map(s => `
                                <div class="p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                                    <span class="font-bold text-slate-800 dark:text-slate-200 block">${s.name}</span>
                                    <span class="text-[11px] text-slate-400 block mt-0.5">Committed: ${group.currency_symbol}${(s.committed_cents / 100).toFixed(2)}</span>
                                    <span class="text-[11px] text-emerald-600 font-semibold block">Received: ${group.currency_symbol}${(s.received_cents / 100).toFixed(2)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Expense Approval Workflow (Treasurer / Admin) -->
                    <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                        <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                            <span>Pending Treasurer Approvals</span>
                            <span class="px-2 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-800 font-bold">${pendingApprovals.length}</span>
                        </h4>

                        ${pendingApprovals.length === 0 ? `
                            <p class="text-xs text-slate-400">All festival expenses have been reviewed and approved.</p>
                        ` : `
                            <div class="space-y-2">
                                ${pendingApprovals.map(p => `
                                    <div class="flex items-center justify-between p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 text-xs">
                                        <div>
                                            <span class="font-bold text-slate-800 dark:text-slate-200 block">${p.title}</span>
                                            <span class="text-[11px] text-slate-500">${group.currency_symbol}${p.amount_formatted} • ${p.category}</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <button data-id="${p.id}" data-action="approved" class="btn-approve-exp px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold">Approve</button>
                                            <button data-id="${p.id}" data-action="rejected" class="btn-approve-exp px-3 py-1.5 rounded-lg bg-rose-500 text-white font-semibold">Reject</button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>
            `;

            // Bind approval buttons
            this.container.querySelectorAll('.btn-approve-exp').forEach(btn => {
                btn.onclick = async () => {
                    const id = btn.dataset.id;
                    const action = btn.dataset.action;
                    await fetch(`/api/groups/${group.id}/special/club/approve`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ expense_id: id, status: action, approved_by: 'Ananya (Treasurer)' })
                    });
                    this.renderClubModule(group);
                };
            });
        } catch (err) {
            console.error(err);
        }
    }

    async renderOfficeModule(group) {
        try {
            const res = await fetch(`/api/groups/${group.id}/special/office/reimbursements`);
            const data = await res.json();
            const ledger = data.ledger || [];

            this.container.innerHTML = `
                <div class="space-y-6">
                    <!-- Reimbursement Ledger Card -->
                    <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <h4 class="font-bold text-slate-800 dark:text-slate-100 text-base">Corporate Expense & Reimbursement Ledger</h4>
                                <p class="text-xs text-slate-400">Total Reimbursable: ${group.currency_symbol}${data.total_reimbursable_formatted}</p>
                            </div>
                            <button onclick="window.print()" class="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100">
                                Export PDF Report
                            </button>
                        </div>

                        <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                            <table class="w-full text-xs text-left">
                                <thead class="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th class="p-2.5">Date</th>
                                        <th class="p-2.5">Employee</th>
                                        <th class="p-2.5">Expense Title</th>
                                        <th class="p-2.5">Project Tag</th>
                                        <th class="p-2.5">Cost Center</th>
                                        <th class="p-2.5 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                                    ${ledger.map(row => `
                                        <tr>
                                            <td class="p-2.5 text-slate-400 font-mono">${row.date}</td>
                                            <td class="p-2.5 font-semibold text-slate-800 dark:text-slate-200">${row.employee_name}</td>
                                            <td class="p-2.5 text-slate-700 dark:text-slate-300">${row.title}</td>
                                            <td class="p-2.5 text-slate-500 font-mono text-[11px]">${row.project_tag}</td>
                                            <td class="p-2.5 text-slate-500 font-mono text-[11px]">${row.cost_center}</td>
                                            <td class="p-2.5 text-right font-bold text-slate-900 dark:text-slate-100">${group.currency_symbol}${row.amount_formatted}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        } catch (err) {
            console.error(err);
        }
    }
}

window.SpecialModulesUI = SpecialModulesUI;
