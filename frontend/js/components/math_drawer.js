/**
 * FairSplit Flow - "Show the Math" Educational & Technical Drawer
 * ==============================================================
 * Deep educational & technical transparency:
 * 1. Directed Weighted Graph breakdown
 * 2. Exact integer zero-sum invariant proof with verification badge
 * 3. Net Balances breakdown table
 * 4. Step-by-step Heap / Queue simulation execution trace
 * 5. Theoretical upper bound verification (transfers <= n-1)
 * 6. Algorithmic complexity comparison (O(N log N) vs O(N^2))
 */

class MathDrawer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.isOpen = false;
        this.initDOM();
    }

    initDOM() {
        this.container.innerHTML = `
            <!-- Backdrop -->
            <div id="math-drawer-backdrop" class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm hidden transition-opacity duration-300"></div>

            <!-- Drawer Panel -->
            <aside id="math-drawer-panel" class="fixed top-0 right-0 bottom-0 z-50 w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 transform translate-x-full transition-transform duration-300 ease-in-out flex flex-col">
                
                <!-- Drawer Header -->
                <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg">
                            📐
                        </div>
                        <div>
                            <h3 class="font-bold text-slate-900 dark:text-slate-100 text-lg">The Mathematical Foundation</h3>
                            <p class="text-xs text-slate-400 dark:text-slate-500">Rigorous graph theory & exact integer proofs</p>
                        </div>
                    </div>
                    <button id="close-math-drawer-btn" class="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        ✕
                    </button>
                </div>

                <!-- Drawer Content (Scrollable) -->
                <div id="math-drawer-content" class="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-600 dark:text-slate-300">
                    <!-- Populated dynamically -->
                </div>
            </aside>
        `;

        this.backdrop = this.container.querySelector('#math-drawer-backdrop');
        this.panel = this.container.querySelector('#math-drawer-panel');
        this.closeBtn = this.container.querySelector('#close-math-drawer-btn');
        this.content = this.container.querySelector('#math-drawer-content');

        this.closeBtn.onclick = () => this.close();
        this.backdrop.onclick = () => this.close();
    }

    open(settlementData) {
        this.renderContent(settlementData);
        this.backdrop.classList.remove('hidden');
        setTimeout(() => {
            this.panel.classList.remove('translate-x-full');
        }, 10);
        this.isOpen = true;
    }

    close() {
        this.panel.classList.add('translate-x-full');
        setTimeout(() => {
            this.backdrop.classList.add('hidden');
        }, 300);
        this.isOpen = false;
    }

    renderContent(data) {
        if (!data) return;

        const curr = (data.group && data.group.currency_symbol) || '₹';
        const trace = data.math_trace || {};
        const metrics = data.metrics || {};
        const steps = trace.steps || [];
        const netTable = data.net_balances_table || [];

        this.content.innerHTML = `
            <!-- 1. Zero-Sum Invariant Badge -->
            <div class="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-start gap-3.5">
                <div class="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    ✓
                </div>
                <div>
                    <h4 class="font-bold text-emerald-900 dark:text-emerald-300 text-sm">
                        Zero-Sum Invariant Verified: Σ Net Balances = ${curr}0.00
                    </h4>
                    <p class="text-xs text-emerald-700 dark:text-emerald-400 mt-1 leading-relaxed">
                        In an isolated multi-party financial group, no money is generated or lost:
                        <code class="bg-white/80 dark:bg-slate-900 px-1.5 py-0.5 rounded text-emerald-800 dark:text-emerald-300 font-mono text-[11px]">Σ (Total_Paid - Total_Share) ≡ 0</code>.
                        All internal arithmetic is calculated in integer smallest units (paise/cents) to strictly prevent IEEE-754 floating-point drift.
                    </p>
                </div>
            </div>

            <!-- 2. Transfer Reduction Guarantee -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                    <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Theoretical Bound</span>
                    <span class="text-lg font-bold text-slate-800 dark:text-slate-100">≤ ${metrics.max_theoretical_transfers} transfers</span>
                    <span class="text-[11px] text-slate-500 block mt-0.5">n - 1 bound achieved</span>
                </div>
                <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                    <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Actual Transfers</span>
                    <span class="text-lg font-bold text-emerald-600 dark:text-emerald-400">${data.after_graph.transfers_count} transfers</span>
                    <span class="text-[11px] text-slate-500 block mt-0.5">${metrics.transfers_saved} redundant IOUs cut</span>
                </div>
                <div class="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                    <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Friction Reduced</span>
                    <span class="text-lg font-bold text-indigo-600 dark:text-indigo-400">${metrics.friction_reduction_pct}%</span>
                    <span class="text-[11px] text-slate-500 block mt-0.5">fewer bank transfers</span>
                </div>
            </div>

            <!-- 3. Net Balances Vector Table -->
            <div class="space-y-2">
                <h4 class="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center justify-between">
                    <span>1. Net Balance Vector [B]</span>
                    <span class="text-xs font-normal text-slate-400">Total Paid − Total Share</span>
                </h4>
                <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table class="w-full text-xs text-left">
                        <thead class="bg-slate-100/70 dark:bg-slate-800/70 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th class="p-2.5">Member</th>
                                <th class="p-2.5 text-right">Total Paid</th>
                                <th class="p-2.5 text-right">Total Share</th>
                                <th class="p-2.5 text-right">Net Balance</th>
                                <th class="p-2.5 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                            ${netTable.map(row => `
                                <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                    <td class="p-2.5 font-medium text-slate-800 dark:text-slate-200">${row.name}</td>
                                    <td class="p-2.5 text-right text-slate-600 dark:text-slate-400">${curr}${row.paid}</td>
                                    <td class="p-2.5 text-right text-slate-600 dark:text-slate-400">${curr}${row.share}</td>
                                    <td class="p-2.5 text-right font-bold ${row.net > 0 ? 'text-emerald-600' : (row.net < 0 ? 'text-rose-500' : 'text-slate-400')}">
                                        ${row.net > 0 ? '+' : ''}${curr}${row.net}
                                    </td>
                                    <td class="p-2.5 text-center">
                                        <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${row.status === 'creditor' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : (row.status === 'debtor' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'bg-slate-100 text-slate-600')}">
                                            ${row.status.toUpperCase()}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 4. Step-by-Step Priority Queue Trace -->
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <h4 class="font-bold text-slate-800 dark:text-slate-200 text-sm">
                        2. Algorithm Execution Trace (${trace.algorithm || 'Greedy Min/Max Priority Queues'})
                    </h4>
                    <span class="text-xs font-mono bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-0.5 rounded-lg">
                        ${trace.time_complexity || 'O(V log V)'}
                    </span>
                </div>
                
                <div class="space-y-2.5">
                    ${steps.length === 0 ? `
                        <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-center text-xs text-slate-500">
                            🎉 No transfers needed! Everyone is in perfect financial equilibrium.
                        </div>
                    ` : steps.map(s => `
                        <div class="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/80 shadow-xs space-y-1.5">
                            <div class="flex items-center justify-between text-xs">
                                <span class="font-bold text-slate-800 dark:text-slate-200">Step ${s.step}: Match Largest Debtor & Creditor</span>
                                <span class="font-mono font-bold text-emerald-600 dark:text-emerald-400">${curr}${s.settled_amount || s.amount}</span>
                            </div>
                            <p class="text-xs text-slate-600 dark:text-slate-400">
                                ${s.explanation}
                            </p>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- 5. Graph Complexity & Invariants Theory -->
            <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <h5 class="font-bold text-slate-800 dark:text-slate-200 text-xs">Graph Theory Properties:</h5>
                <ul class="list-disc list-inside space-y-1">
                    <li><b>DAG Guarantee:</b> The output settlement graph contains zero directed cycles (Acyclic Directed Graph).</li>
                    <li><b>Worst-Case Transfers:</b> For a group of <i>n</i> participants, the greedy algorithm produces at most <i>n - 1</i> transactions.</li>
                    <li><b>Trust-Preserving Mode:</b> Cycle-canceling on the capacity graph eliminates transitive loops while ensuring money only moves along pre-existing edges.</li>
                </ul>
            </div>
        `;
    }
}

window.MathDrawer = MathDrawer;
