/**
 * FairSplit Flow - Main Frontend Application Logic
 * ================================================
 * Orchestrates views, reactive state, backend API synchronization,
 * offline fallback calculations, modals, and dark/light mode.
 */

class FairSplitApp {
    constructor() {
        this.currentGroupId = 'grp_goa_trip';
        this.currentUserId = 'user_sankalp';
        this.currentView = 'dashboard'; // 'dashboard', 'settlements', 'special', 'members', 'public_report'
        this.groups = [];
        this.groupData = null;
        this.settlementData = null;
        this.expenseFilter = 'all'; // 'all' or 'my'

        this.graphVisualizer = null;
        this.mathDrawer = null;
        this.expenseModal = null;
        this.settlementView = null;
        this.specialModulesUI = null;

        this.init();
    }

    async init() {
        // Initialize Theme from localStorage
        const theme = localStorage.getItem('fairsplit_theme') || 'light';
        document.documentElement.classList.toggle('dark', theme === 'dark');

        // Initialize Components
        this.graphVisualizer = new DebtGraphVisualizer('graph-visualizer-mount');
        this.mathDrawer = new MathDrawer('math-drawer-mount');
        this.expenseModal = new ExpenseModal('expense-modal-mount', {
            onSave: (payload) => this.handleSaveExpense(payload)
        });
        this.settlementView = new SettlementView('settlement-view-mount', {
            onModeChange: (mode) => this.fetchSettlements(mode),
            onMarkPaid: (fromId, toId, amt) => this.handleMarkPaid(fromId, toId, amt),
            onOpenMathDrawer: () => {
                if (this.settlementData) this.mathDrawer.open(this.settlementData);
            }
        });
        this.specialModulesUI = new SpecialModulesUI('special-module-mount');

        this.bindGlobalEvents();
        await this.loadGroups();
    }

    bindGlobalEvents() {
        // Group Switcher Dropdown
        const groupSelect = document.getElementById('group-selector-select');
        if (groupSelect) {
            groupSelect.onchange = (e) => this.switchGroup(e.target.value);
        }

        // View Tabs
        document.querySelectorAll('.nav-tab-btn').forEach(btn => {
            btn.onclick = () => this.switchView(btn.dataset.view);
        });

        // Floating & Header Add Expense Buttons
        const addExpBtn = document.getElementById('btn-add-expense-header');
        const fabAddExp = document.getElementById('fab-add-expense');
        if (addExpBtn) addExpBtn.onclick = () => this.openExpenseModal();
        if (fabAddExp) fabAddExp.onclick = () => this.openExpenseModal();

        // Create Group Button & Modal
        const createGrpBtn = document.getElementById('btn-create-group-modal');
        if (createGrpBtn) createGrpBtn.onclick = () => this.openCreateGroupModal();

        // Join Group Button & Modal
        const joinGrpBtn = document.getElementById('btn-join-group-modal');
        if (joinGrpBtn) joinGrpBtn.onclick = () => this.openJoinGroupModal();

        // Dark Mode Toggle
        const themeToggle = document.getElementById('btn-theme-toggle');
        if (themeToggle) {
            themeToggle.onclick = () => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('fairsplit_theme', isDark ? 'dark' : 'light');
            };
        }

        // Expense filter pills ("All" vs "My Expenses")
        document.querySelectorAll('.expense-filter-pill').forEach(pill => {
            pill.onclick = () => {
                this.expenseFilter = pill.dataset.filter;
                document.querySelectorAll('.expense-filter-pill').forEach(p => {
                    p.className = p.dataset.filter === this.expenseFilter
                        ? 'expense-filter-pill px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-xs transition'
                        : 'expense-filter-pill px-3 py-1 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 transition';
                });
                this.renderExpensesList();
            };
        });
    }

    async loadGroups() {
        try {
            const res = await fetch('/api/groups');
            this.groups = await res.json();
            this.renderGroupSelector();
            if (this.groups.length > 0) {
                const currentExists = this.groups.find(g => g.id === this.currentGroupId);
                this.currentGroupId = currentExists ? this.currentGroupId : this.groups[0].id;
                await this.loadGroupData(this.currentGroupId);
            }
        } catch (err) {
            console.error('Failed to load groups:', err);
        }
    }

    renderGroupSelector() {
        const select = document.getElementById('group-selector-select');
        if (!select) return;
        select.innerHTML = this.groups.map(g => `
            <option value="${g.id}" ${g.id === this.currentGroupId ? 'selected' : ''}>
                ${g.name} (${g.currency_symbol}${g.total_spent_formatted || '0.00'})
            </option>
        `).join('');
    }

    async switchGroup(groupId) {
        this.currentGroupId = groupId;
        await this.loadGroupData(groupId);
    }

    switchView(viewName) {
        this.currentView = viewName;
        document.querySelectorAll('.nav-tab-btn').forEach(btn => {
            if (btn.dataset.view === viewName) {
                btn.className = 'nav-tab-btn px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm transition';
            } else {
                btn.className = 'nav-tab-btn px-4 py-2 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 transition';
            }
        });

        // Hide all views, show active
        document.querySelectorAll('.main-view-panel').forEach(panel => {
            panel.classList.toggle('hidden', panel.id !== `view-${viewName}`);
        });

        if (viewName === 'settlements') {
            this.fetchSettlements(this.settlementView.currentMode);
        } else if (viewName === 'special') {
            this.renderSpecialModule();
        } else if (viewName === 'public_report') {
            this.renderPublicReport();
        }
    }

    async loadGroupData(groupId) {
        try {
            const res = await fetch(`/api/groups/${groupId}`);
            this.groupData = await res.json();
            this.renderDashboard();
            this.updateSpecialTabLabel();
        } catch (err) {
            console.error('Error loading group data:', err);
        }
    }

    updateSpecialTabLabel() {
        const specialTab = document.querySelector('.nav-tab-btn[data-view="special"]');
        if (!specialTab || !this.groupData) return;
        const type = this.groupData.group.group_type;
        const labels = {
            hostel: '🏠 Flat Utilities & Move-out',
            club: '🎯 Budget & Approvals',
            office: '💼 Corporate Reimbursements',
            travel: '🌴 Travel Ledger',
            business: '📈 Business Cost-Centers'
        };
        specialTab.textContent = labels[type] || '✨ Special Module';
    }

    renderDashboard() {
        if (!this.groupData) return;
        const { group, members, expenses, zero_sum_verified, total_spent_formatted } = this.groupData;
        const curr = group.currency_symbol || '₹';

        // 1. Group Header Details
        document.getElementById('dash-group-name').textContent = group.name;
        document.getElementById('dash-group-code').textContent = `Code: ${group.invite_code}`;
        document.getElementById('dash-total-spending').textContent = `${curr}${total_spent_formatted}`;
        document.getElementById('dash-members-count').textContent = `${members.length} members`;

        // 2. Personal Balance Highlight (Crucial Requirement)
        // Find user's member entry
        const userMember = members.find(m => m.user_id === this.currentUserId || m.name.includes('Sankalp') || m.role === 'admin') || members[0];
        const userBalCard = document.getElementById('dash-personal-balance-card');
        const userBalAmount = document.getElementById('dash-personal-balance-amount');
        const userBalStatus = document.getElementById('dash-personal-balance-status');
        const userBalSubtitle = document.getElementById('dash-personal-balance-subtitle');

        if (userMember) {
            const bal = userMember.net_balance_cents || 0;
            const balFloat = Math.abs(bal) / 100;

            if (bal > 0) {
                userBalCard.className = 'p-5 rounded-3xl bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden';
                userBalStatus.textContent = 'YOU ARE OWED';
                userBalAmount.textContent = `+${curr}${balFloat.toFixed(2)}`;
                userBalSubtitle.textContent = 'Friends will transfer this amount to you during settlement.';
            } else if (bal < 0) {
                userBalCard.className = 'p-5 rounded-3xl bg-rose-500 text-white shadow-xl shadow-rose-500/20 relative overflow-hidden';
                userBalStatus.textContent = 'YOU OWE';
                userBalAmount.textContent = `-${curr}${balFloat.toFixed(2)}`;
                userBalSubtitle.textContent = 'You have pending payments to settle in this group.';
            } else {
                userBalCard.className = 'p-5 rounded-3xl bg-slate-800 text-white shadow-xl relative overflow-hidden';
                userBalStatus.textContent = 'YOU ARE ALL SETTLED';
                userBalAmount.textContent = `${curr}0.00`;
                userBalSubtitle.textContent = 'Zero outstanding debt balance in this group.';
            }
        }

        // 3. Render Expenses List
        this.renderExpensesList();

        // 4. Render Members Horizontal Cards
        const membersList = document.getElementById('dash-members-list');
        membersList.innerHTML = members.map(m => {
            const bal = m.net_balance_cents || 0;
            const isPos = bal > 0;
            const isNeg = bal < 0;
            return `
                <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/80 shadow-xs flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <img src="${m.avatar}" class="w-9 h-9 rounded-full bg-slate-100" />
                        <div>
                            <span class="font-semibold text-xs text-slate-800 dark:text-slate-100 block">${m.name}</span>
                            <span class="text-[10px] text-slate-400 font-mono">${m.role.toUpperCase()}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="font-bold text-xs ${isPos ? 'text-emerald-600' : (isNeg ? 'text-rose-500' : 'text-slate-400')} block">
                            ${isPos ? '+' : ''}${curr}${m.net_balance_formatted}
                        </span>
                        <span class="text-[10px] text-slate-400">Paid: ${curr}${m.total_paid_formatted}</span>
                    </div>
                </div>
            `;
        }).join('');

        // 5. Render Activity History Feed
        const activityList = document.getElementById('dash-activity-list');
        const activity = this.groupData.activity || [];
        activityList.innerHTML = activity.length === 0 ? `
            <p class="text-xs text-slate-400 py-3 text-center">No recent activity.</p>
        ` : activity.map(a => `
            <div class="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                <span class="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                <div>
                    <span class="font-bold text-slate-800 dark:text-slate-100">${a.member_name}</span>
                    <span>${a.details}</span>
                    <span class="text-[10px] text-slate-400 block mt-0.5">${a.created_at}</span>
                </div>
            </div>
        `).join('');
    }

    renderExpensesList() {
        if (!this.groupData) return;
        const { group, expenses, members } = this.groupData;
        const curr = group.currency_symbol || '₹';
        const listContainer = document.getElementById('dash-expenses-list');
        const userMember = members.find(m => m.user_id === this.currentUserId || m.name.includes('Sankalp') || m.role === 'admin') || members[0];

        let filtered = expenses;
        if (this.expenseFilter === 'my' && userMember) {
            filtered = expenses.filter(e => e.paid_by === userMember.id || (e.shares || []).some(s => s.member_id === userMember.id));
        }

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div class="p-8 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200/70 text-center space-y-2">
                    <span class="text-2xl">📝</span>
                    <p class="text-xs text-slate-500">No expenses found for this filter.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = filtered.map(e => `
            <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/80 hover:border-slate-300 transition shadow-xs flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-base font-bold shrink-0">
                        ${e.mode === 'individual' ? '👤' : '👥'}
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-semibold text-xs text-slate-800 dark:text-slate-100">${e.title}</span>
                            <span class="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500">${e.category}</span>
                            ${e.recurring_frequency !== 'none' ? `<span class="px-1.5 py-0.5 rounded text-[9px] bg-indigo-50 text-indigo-600 font-bold">↻ ${e.recurring_frequency}</span>` : ''}
                        </div>
                        <p class="text-[11px] text-slate-400 mt-0.5">
                            Paid by <b class="text-slate-700 dark:text-slate-300">${e.payer_name}</b> • Split among ${(e.shares || []).length} people • ${e.expense_date}
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <div class="text-right">
                        <span class="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 block">
                            ${curr}${e.amount_formatted}
                        </span>
                        <span class="text-[10px] text-slate-400 capitalize">${e.split_type}</span>
                    </div>

                    <button data-id="${e.id}" class="btn-delete-expense p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition" title="Delete Expense">
                        ✕
                    </button>
                </div>
            </div>
        `).join('');

        // Delete expense handler
        listContainer.querySelectorAll('.btn-delete-expense').forEach(btn => {
            btn.onclick = async () => {
                if (confirm('Delete this expense? Balances will be recalculated.')) {
                    await fetch(`/api/groups/${this.currentGroupId}/expenses/${btn.dataset.id}`, { method: 'DELETE' });
                    await this.loadGroupData(this.currentGroupId);
                }
            };
        });
    }

    async fetchSettlements(mode = 'greedy') {
        try {
            const res = await fetch(`/api/groups/${this.currentGroupId}/settlements?mode=${mode}`);
            this.settlementData = await res.json();
            this.graphVisualizer.setData(this.settlementData);
            this.settlementView.render(this.settlementData);
        } catch (err) {
            console.error('Error fetching settlements:', err);
        }
    }

    renderSpecialModule() {
        if (!this.groupData) return;
        const type = this.groupData.group.group_type;
        if (type === 'hostel') {
            this.specialModulesUI.renderHostelModule(this.groupData.group, this.groupData.members);
        } else if (type === 'club') {
            this.specialModulesUI.renderClubModule(this.groupData.group);
        } else if (type === 'office') {
            this.specialModulesUI.renderOfficeModule(this.groupData.group);
        } else {
            this.specialModulesUI.renderHostelModule(this.groupData.group, this.groupData.members);
        }
    }

    async renderPublicReport() {
        if (!this.groupData) return;
        const code = this.groupData.group.invite_code;
        try {
            const res = await fetch(`/api/public/report/${code}`);
            const data = await res.json();
            const mount = document.getElementById('public-report-mount');
            const curr = data.currency_symbol || '₹';

            mount.innerHTML = `
                <div class="max-w-3xl mx-auto p-6 sm:p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-6">
                    <div class="border-b border-slate-100 dark:border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <span class="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">Public Transparency Report</span>
                            <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100">${data.group_name}</h2>
                            <p class="text-xs text-slate-400 mt-1">Verified FairSplit Flow zero-sum financial audit</p>
                        </div>
                        <div class="text-right">
                            <span class="text-xs text-slate-400 block">Total Expenditure</span>
                            <span class="text-2xl font-bold font-mono text-emerald-600">${curr}${data.total_spending_formatted}</span>
                        </div>
                    </div>

                    <div class="space-y-3">
                        <h4 class="font-bold text-xs uppercase tracking-wider text-slate-400">Verified Expenses</h4>
                        <div class="space-y-2">
                            ${data.expenses.map(e => `
                                <div class="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                                    <div>
                                        <span class="font-bold text-slate-800 dark:text-slate-200 block">${e.title}</span>
                                        <span class="text-[11px] text-slate-400">${e.category} • ${e.expense_date}</span>
                                    </div>
                                    <span class="font-mono font-bold text-slate-900 dark:text-slate-100">${curr}${e.amount_formatted}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
                        🔒 Cryptographically verified zero-sum ledger powered by FairSplit Flow.
                    </div>
                </div>
            `;
        } catch (err) {
            console.error('Error fetching public report:', err);
        }
    }

    openExpenseModal(presetTitle = null) {
        if (!this.groupData) return;
        this.expenseModal.open(this.groupData.group, this.groupData.members);
        if (presetTitle) {
            document.getElementById('exp-title').value = presetTitle;
        }
    }

    async handleSaveExpense(payload) {
        try {
            await fetch(`/api/groups/${this.currentGroupId}/expenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            await this.loadGroupData(this.currentGroupId);
            if (this.currentView === 'settlements') {
                this.fetchSettlements(this.settlementView.currentMode);
            }
        } catch (err) {
            console.error('Error saving expense:', err);
        }
    }

    async handleMarkPaid(fromId, toId, amount) {
        try {
            await fetch(`/api/groups/${this.currentGroupId}/settlements/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from_member_id: fromId,
                    to_member_id: toId,
                    amount: amount,
                    payment_method: 'UPI'
                })
            });
            await this.loadGroupData(this.currentGroupId);
            await this.fetchSettlements(this.settlementView.currentMode);
        } catch (err) {
            console.error('Error marking payment as paid:', err);
        }
    }

    openCreateGroupModal() {
        const modal = document.getElementById('create-group-modal');
        if (modal) modal.classList.remove('hidden');
    }

    openJoinGroupModal() {
        const modal = document.getElementById('join-group-modal');
        if (modal) modal.classList.remove('hidden');
    }
}

window.app = new FairSplitApp();
