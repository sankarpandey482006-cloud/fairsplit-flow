/**
 * FairSplit Flow - Expense Entry Modal Component
 * ===============================================
 * Strict UX Requirements Met:
 * 1. Elegant icon-based toggle (2-3 people vs 1 person) - NO big text tabs!
 * 2. "Paid by" defaults automatically to logged-in user
 * 3. Member selection with avatars + checkboxes + live share preview
 * 4. "Select All / Deselect All" + Search for large groups
 * 5. Real-time live share preview updating with every keystroke
 * 6. "Save & Add Another" button for rapid receipt entry
 * 7. Adaptive categories based on group type
 * 8. 6 Splitting methods (Equal, Exact, Shares, Percentage, Custom Ratio, Days Stayed)
 */

class ExpenseModal {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = Object.assign({
            currentUserId: 'm_sankalp',
            currencySymbol: '₹',
            onSave: null
        }, options);

        this.group = null;
        this.members = [];
        this.mode = 'shared'; // 'shared' or 'individual'
        this.splitMethod = 'equal';
        this.selectedMemberIds = new Set();
        this.splitValues = {}; // { memberId: value }

        this.initDOM();
    }

    initDOM() {
        this.container.innerHTML = `
            <div id="expense-modal-backdrop" class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm hidden flex items-center justify-center p-3 sm:p-4 transition-opacity duration-200">
                <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col transition-all transform duration-200">
                    
                    <!-- Modal Header -->
                    <div class="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
                                💸
                            </div>
                            <div>
                                <h3 class="font-bold text-slate-800 dark:text-slate-100 text-lg">Add New Expense</h3>
                                <p class="text-xs text-slate-400 dark:text-slate-500">Log an expense with exact integer splitting</p>
                            </div>
                        </div>

                        <!-- Elegant Icon-Based Toggle (2-3 People vs 1 Person) - NO big text tabs -->
                        <div class="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700">
                            <button id="toggle-shared-btn" type="button" title="Shared with group" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm transition-all">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span>Shared</span>
                            </button>
                            <button id="toggle-individual-btn" type="button" title="Individual 1-on-1 expense" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 transition-all">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span>Individual</span>
                            </button>
                        </div>

                        <button id="modal-close-btn" class="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                            ✕
                        </button>
                    </div>

                    <!-- Modal Body (Scrollable) -->
                    <form id="expense-form" class="flex-1 overflow-y-auto p-6 space-y-4.5">
                        
                        <!-- Title & Amount in Row -->
                        <div class="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                            <div class="sm:col-span-7">
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Expense Description *</label>
                                <input type="text" id="exp-title" placeholder="e.g. Dinner, Uber, Groceries, Villa" required
                                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
                            </div>

                            <div class="sm:col-span-5">
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Amount *</label>
                                <div class="relative">
                                    <span id="exp-currency-symbol" class="absolute left-3.5 top-2.5 font-bold text-slate-400 dark:text-slate-500 text-sm">₹</span>
                                    <input type="number" id="exp-amount" step="0.01" min="0.01" placeholder="0.00" required
                                        class="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
                                </div>
                            </div>
                        </div>

                        <!-- Paid By & Category in Row -->
                        <div class="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                            <div class="sm:col-span-6">
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Paid by (Defaults to You) *</label>
                                <select id="exp-paid-by" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
                                    <!-- Populated dynamically -->
                                </select>
                            </div>

                            <div class="sm:col-span-6">
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Category</label>
                                <select id="exp-category" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
                                    <!-- Populated adaptively based on group type -->
                                </select>
                            </div>
                        </div>

                        <!-- Split Method Pills -->
                        <div id="split-method-container">
                            <div class="flex items-center justify-between mb-1.5">
                                <label class="text-xs font-semibold text-slate-600 dark:text-slate-300">Splitting Method</label>
                                <span class="text-[11px] text-slate-400">Zero-sum protected</span>
                            </div>
                            <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700">
                                <button type="button" data-method="equal" class="split-method-btn px-2 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm transition">Equal</button>
                                <button type="button" data-method="exact" class="split-method-btn px-2 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 transition">Exact</button>
                                <button type="button" data-method="percent" class="split-method-btn px-2 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 transition">%</button>
                                <button type="button" data-method="shares" class="split-method-btn px-2 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 transition">Shares</button>
                                <button type="button" data-method="custom_ratio" class="split-method-btn px-2 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 transition">Ratio</button>
                                <button type="button" data-method="days_stayed" class="split-method-btn px-2 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 transition">Days</button>
                            </div>
                        </div>

                        <!-- Member Selection & Live Share Preview Section -->
                        <div class="border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3.5 bg-slate-50/50 dark:bg-slate-800/30">
                            <div class="flex items-center justify-between mb-2.5">
                                <span class="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                    Split Between (<span id="selected-members-count">0</span> people):
                                </span>
                                <div class="flex items-center gap-2">
                                    <button type="button" id="btn-select-all" class="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700">Select All</button>
                                    <span class="text-slate-300">|</span>
                                    <button type="button" id="btn-deselect-all" class="text-[11px] font-semibold text-slate-500 hover:text-slate-700">Deselect All</button>
                                </div>
                            </div>

                            <!-- Search Filter for Large Groups -->
                            <div class="mb-2">
                                <input type="text" id="member-search-input" placeholder="Search members..."
                                    class="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none" />
                            </div>

                            <!-- Member List with Avatars + Checkboxes + Live Share Preview -->
                            <div id="members-selection-list" class="space-y-2 max-h-48 overflow-y-auto pr-1">
                                <!-- Rendered dynamically -->
                            </div>
                        </div>

                        <!-- Live Summary Banner -->
                        <div id="live-share-banner" class="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                            <span class="flex items-center gap-1.5 font-medium">
                                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Live Share: <span id="live-share-each" class="font-bold">₹0.00 / person</span>
                            </span>
                            <span id="live-sum-status" class="font-semibold text-[11px] text-emerald-600 dark:text-emerald-400">Sum: ₹0.00</span>
                        </div>

                        <!-- Optional Expandable: Date, Notes, Recurring, Project Tag -->
                        <details class="text-xs text-slate-500 group">
                            <summary class="cursor-pointer font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 flex items-center justify-between py-1 select-none">
                                <span>Advanced Options (Date, Project Tag, Recurring)</span>
                                <span class="group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <div class="pt-3 pb-1 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 dark:border-slate-800 mt-2">
                                <div>
                                    <label class="block text-[11px] font-semibold text-slate-500 mb-1">Expense Date</label>
                                    <input type="date" id="exp-date" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs" />
                                </div>
                                <div>
                                    <label class="block text-[11px] font-semibold text-slate-500 mb-1">Recurring Cycle</label>
                                    <select id="exp-recurring" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs">
                                        <option value="none">One-time expense</option>
                                        <option value="weekly">Weekly recurring</option>
                                        <option value="monthly">Monthly recurring</option>
                                    </select>
                                </div>
                                <div class="sm:col-span-2">
                                    <label class="block text-[11px] font-semibold text-slate-500 mb-1">Project / Cost-Center Tag</label>
                                    <input type="text" id="exp-project-tag" placeholder="e.g. Q4 Offsite, Stage Rigging,Bescom Meter 3"
                                        class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs" />
                                </div>
                            </div>
                        </details>
                    </form>

                    <!-- Modal Footer with "Save & Add Another" -->
                    <div class="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between gap-2.5">
                        <button type="button" id="btn-cancel" class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition">
                            Cancel
                        </button>
                        <div class="flex items-center gap-2">
                            <button type="button" id="btn-save-another" class="px-4 py-2.5 rounded-xl border border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-semibold transition">
                                Save & Add Another
                            </button>
                            <button type="button" id="btn-save" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition">
                                Save Expense
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const backdrop = this.container.querySelector('#expense-modal-backdrop');
        const closeBtn = this.container.querySelector('#modal-close-btn');
        const cancelBtn = this.container.querySelector('#btn-cancel');
        const saveBtn = this.container.querySelector('#btn-save');
        const saveAnotherBtn = this.container.querySelector('#btn-save-another');
        const toggleShared = this.container.querySelector('#toggle-shared-btn');
        const toggleIndividual = this.container.querySelector('#toggle-individual-btn');
        const selectAllBtn = this.container.querySelector('#btn-select-all');
        const deselectAllBtn = this.container.querySelector('#btn-deselect-all');
        const amountInput = this.container.querySelector('#exp-amount');
        const searchInput = this.container.querySelector('#member-search-input');

        closeBtn.onclick = () => this.close();
        cancelBtn.onclick = () => this.close();

        // Icon toggle handling
        toggleShared.onclick = () => this.setMode('shared');
        toggleIndividual.onclick = () => this.setMode('individual');

        // Split method buttons
        this.container.querySelectorAll('.split-method-btn').forEach(btn => {
            btn.onclick = () => this.setSplitMethod(btn.dataset.method);
        });

        // Select / Deselect all
        selectAllBtn.onclick = () => {
            this.members.forEach(m => this.selectedMemberIds.add(m.id));
            this.renderMemberList();
            this.updateLivePreview();
        };

        deselectAllBtn.onclick = () => {
            this.selectedMemberIds.clear();
            this.renderMemberList();
            this.updateLivePreview();
        };

        amountInput.oninput = () => this.updateLivePreview();
        searchInput.oninput = () => this.filterMemberList(searchInput.value);

        saveBtn.onclick = () => this.submitExpense(false);
        saveAnotherBtn.onclick = () => this.submitExpense(true);
    }

    open(group, members, defaultPayerId = null) {
        this.group = group;
        this.members = members || [];
        this.selectedMemberIds = new Set(this.members.map(m => m.id));
        this.splitValues = {};
        this.mode = 'shared';
        this.splitMethod = 'equal';

        // Set Currency Symbol
        const curr = (this.group && this.group.currency_symbol) || '₹';
        this.container.querySelector('#exp-currency-symbol').textContent = curr;

        // Adaptive Categories based on group type
        this.populateAdaptiveCategories(this.group ? this.group.group_type : 'travel');

        // Populate Paid By (Default to currently logged-in user or first admin)
        const paidBySelect = this.container.querySelector('#exp-paid-by');
        paidBySelect.innerHTML = this.members.map(m => {
            const isSelf = m.id.includes('sankalp') || m.id === defaultPayerId;
            return `<option value="${m.id}" ${isSelf ? 'selected' : ''}>${m.name} ${isSelf ? '(You)' : ''}</option>`;
        }).join('');

        // Date default to today
        this.container.querySelector('#exp-date').value = new Date().toISOString().slice(0, 10);
        this.container.querySelector('#exp-title').value = '';
        this.container.querySelector('#exp-amount').value = '';

        this.setMode('shared');
        this.setSplitMethod('equal');
        this.renderMemberList();
        this.updateLivePreview();

        this.container.querySelector('#expense-modal-backdrop').classList.remove('hidden');
    }

    close() {
        this.container.querySelector('#expense-modal-backdrop').classList.add('hidden');
    }

    setMode(mode) {
        this.mode = mode;
        const sharedBtn = this.container.querySelector('#toggle-shared-btn');
        const indBtn = this.container.querySelector('#toggle-individual-btn');
        const splitMethodContainer = this.container.querySelector('#split-method-container');

        if (mode === 'shared') {
            sharedBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm transition-all';
            indBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 transition-all';
            splitMethodContainer.style.display = 'block';
        } else {
            indBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm transition-all';
            sharedBtn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 transition-all';
            splitMethodContainer.style.display = 'none';

            // In individual mode, select only 1 other person
            const paidById = this.container.querySelector('#exp-paid-by').value;
            const other = this.members.find(m => m.id !== paidById);
            this.selectedMemberIds.clear();
            if (other) this.selectedMemberIds.add(other.id);
        }

        this.renderMemberList();
        this.updateLivePreview();
    }

    setSplitMethod(method) {
        this.splitMethod = method;
        this.container.querySelectorAll('.split-method-btn').forEach(btn => {
            if (btn.dataset.method === method) {
                btn.className = 'split-method-btn px-2 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm transition';
            } else {
                btn.className = 'split-method-btn px-2 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 transition';
            }
        });
        this.renderMemberList();
        this.updateLivePreview();
    }

    populateAdaptiveCategories(groupType) {
        const categoryMap = {
            travel: ['Stay & Hotel', 'Food & Dining', 'Flights & Train', 'Fuel & Cab', 'Activities & Sightseeing', 'Groceries', 'General'],
            hostel: ['Rent', 'Electricity', 'WiFi & Internet', 'Groceries & Milk', 'Maid & Cook', 'Water Tanker', 'Repairs & Maintenance', 'General'],
            club: ['Stage & AV Equipment', 'Food & Refreshments', 'Merchandise & ID Cards', 'Cash Prizes & Trophies', 'Marketing & Printing', 'Decorations', 'Logistics', 'General'],
            office: ['Software & Cloud', 'Team Offsite & Lunch', 'Hardware & Office Supplies', 'Travel & Commute', 'Client Dinner', 'Training & Books', 'General'],
            family: ['Groceries & Provisions', 'Home Utilities', 'Dining Out', 'Medical & Pharmacy', 'Education', 'Entertainment', 'General'],
            business: ['Client Entertainment', 'Server Infrastructure', 'Legal & Professional', 'Office Space', 'Marketing', 'Consulting', 'General']
        };

        const cats = categoryMap[groupType] || categoryMap.travel;
        const select = this.container.querySelector('#exp-category');
        select.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    renderMemberList() {
        const list = this.container.querySelector('#members-selection-list');
        const curr = (this.group && this.group.currency_symbol) || '₹';
        const isCustomInput = ['exact', 'percent', 'shares', 'custom_ratio', 'days_stayed'].includes(this.splitMethod);

        list.innerHTML = this.members.map(m => {
            const isSelected = this.selectedMemberIds.has(m.id);
            const val = this.splitValues[m.id] !== undefined ? this.splitValues[m.id] : (this.splitMethod === 'days_stayed' ? 30 : 1);

            let inputField = '';
            if (isCustomInput && isSelected) {
                let placeholder = '1';
                let suffix = '';
                if (this.splitMethod === 'exact') { placeholder = '0.00'; suffix = curr; }
                else if (this.splitMethod === 'percent') { placeholder = '%'; suffix = '%'; }
                else if (this.splitMethod === 'days_stayed') { placeholder = 'days'; suffix = 'd'; }

                inputField = `
                    <div class="flex items-center gap-1 w-24">
                        <input type="number" data-member-id="${m.id}" value="${val}" min="0" step="any"
                            class="member-custom-input w-full px-2 py-1 text-xs text-right rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                        <span class="text-[11px] font-semibold text-slate-400">${suffix}</span>
                    </div>
                `;
            }

            return `
                <div class="member-item flex items-center justify-between p-2 rounded-xl transition ${isSelected ? 'bg-white dark:bg-slate-800/90 shadow-xs border border-slate-200/60 dark:border-slate-700' : 'opacity-60 hover:opacity-100'}">
                    <label class="flex items-center gap-2.5 cursor-pointer flex-1">
                        <input type="checkbox" data-id="${m.id}" ${isSelected ? 'checked' : ''} class="member-checkbox w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300" />
                        <img src="${m.avatar}" class="w-7 h-7 rounded-full bg-slate-100" />
                        <div>
                            <span class="text-xs font-semibold text-slate-800 dark:text-slate-200">${m.name}</span>
                            <span class="text-[10px] text-slate-400 block">${m.role || 'Member'}</span>
                        </div>
                    </label>

                    <div class="flex items-center gap-2">
                        ${inputField}
                        <span id="live-share-${m.id}" class="text-xs font-bold text-slate-700 dark:text-slate-200 min-w-[60px] text-right">
                            ${curr}0.00
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        // Attach checkbox change listeners
        list.querySelectorAll('.member-checkbox').forEach(cb => {
            cb.onchange = (e) => {
                const id = e.target.dataset.id;
                if (this.mode === 'individual') {
                    this.selectedMemberIds.clear();
                    if (e.target.checked) this.selectedMemberIds.add(id);
                } else {
                    if (e.target.checked) this.selectedMemberIds.add(id);
                    else this.selectedMemberIds.delete(id);
                }
                this.renderMemberList();
                this.updateLivePreview();
            };
        });

        // Attach custom inputs change listeners
        list.querySelectorAll('.member-custom-input').forEach(inp => {
            inp.oninput = (e) => {
                const mId = e.target.dataset.memberId;
                this.splitValues[mId] = parseFloat(e.target.value) || 0;
                this.updateLivePreview();
            };
        });

        this.container.querySelector('#selected-members-count').textContent = this.selectedMemberIds.size;
    }

    filterMemberList(query) {
        const q = query.toLowerCase();
        this.container.querySelectorAll('.member-item').forEach(item => {
            const name = item.querySelector('span.text-xs').textContent.toLowerCase();
            item.style.display = name.includes(q) ? 'flex' : 'none';
        });
    }

    updateLivePreview() {
        const amount = parseFloat(this.container.querySelector('#exp-amount').value) || 0;
        const totalCents = window.ClientDebtEngine.toCents(amount);
        const curr = (this.group && this.group.currency_symbol) || '₹';
        const selectedArr = Array.from(this.selectedMemberIds);

        this.container.querySelector('#selected-members-count').textContent = selectedArr.length;

        if (totalCents === 0 || selectedArr.length === 0) {
            this.container.querySelector('#live-share-each').textContent = `${curr}0.00 / person`;
            this.container.querySelector('#live-sum-status').textContent = `Sum: ${curr}0.00`;
            this.members.forEach(m => {
                const span = this.container.querySelector(`#live-share-${m.id}`);
                if (span) span.textContent = `${curr}0.00`;
            });
            return;
        }

        // Calculate exact shares
        const calculated = window.ClientDebtEngine.calculateShares(
            totalCents,
            this.mode === 'individual' ? 'equal' : this.splitMethod,
            selectedArr,
            this.splitValues
        );

        let sumCents = 0;
        this.members.forEach(m => {
            const span = this.container.querySelector(`#live-share-${m.id}`);
            if (span) {
                const shareCents = calculated[m.id] || 0;
                sumCents += shareCents;
                span.textContent = `${curr}${(shareCents / 100).toFixed(2)}`;
            }
        });

        const perPerson = selectedArr.length > 0 ? (totalCents / selectedArr.length / 100).toFixed(2) : '0.00';
        this.container.querySelector('#live-share-each').textContent =
            this.splitMethod === 'equal' ? `${curr}${perPerson} / person` : `Custom (${selectedArr.length} people)`;

        const sumFormatted = (sumCents / 100).toFixed(2);
        const isMatched = sumCents === totalCents;
        const sumStatus = this.container.querySelector('#live-sum-status');
        sumStatus.textContent = `Sum: ${curr}${sumFormatted} ${isMatched ? '✓' : '(discrepancy)'}`;
        sumStatus.className = isMatched ? 'font-semibold text-[11px] text-emerald-600 dark:text-emerald-400' : 'font-semibold text-[11px] text-rose-500';
    }

    async submitExpense(addAnother = false) {
        const title = this.container.querySelector('#exp-title').value.trim();
        const amount = parseFloat(this.container.querySelector('#exp-amount').value);
        const paid_by = this.container.querySelector('#exp-paid-by').value;
        const category = this.container.querySelector('#exp-category').value;
        const expense_date = this.container.querySelector('#exp-date').value;
        const recurring = this.container.querySelector('#exp-recurring').value;
        const project_tag = this.container.querySelector('#exp-project-tag').value.trim();

        if (!title) {
            alert('Please enter an expense description.');
            return;
        }
        if (!amount || amount <= 0) {
            alert('Please enter a valid positive amount.');
            return;
        }
        if (this.selectedMemberIds.size === 0) {
            alert('Please select at least one person to split with.');
            return;
        }

        const payload = {
            title,
            amount,
            paid_by,
            category,
            expense_date,
            recurring_frequency: recurring,
            project_tag,
            mode: this.mode,
            split_type: this.mode === 'individual' ? 'exact' : this.splitMethod,
            selected_members: Array.from(this.selectedMemberIds),
            split_data: this.splitValues
        };

        if (this.options.onSave) {
            await this.options.onSave(payload);
        }

        if (addAnother) {
            this.container.querySelector('#exp-title').value = '';
            this.container.querySelector('#exp-amount').value = '';
            this.container.querySelector('#exp-title').focus();
            this.updateLivePreview();
        } else {
            this.close();
        }
    }
}

window.ExpenseModal = ExpenseModal;
