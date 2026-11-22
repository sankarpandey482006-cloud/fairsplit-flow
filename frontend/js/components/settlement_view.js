/**
 * FairSplit Flow - Settlement View Component
 * ==========================================
 * Manages:
 * 1. Debt Simplification Mode Switcher (Greedy O(N log N) vs Trust-Preserving)
 * 2. Visual payment cards ("A pays B ₹X")
 * 3. One-click "Mark as Paid"
 * 4. WhatsApp Summary Generator with 1-click Copy
 * 5. CSV & Print / PDF Export
 * 6. "Show the Math" Drawer Launcher
 */

class SettlementView {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = Object.assign({
            onModeChange: null,
            onMarkPaid: null,
            onOpenMathDrawer: null
        }, options);

        this.currentMode = 'greedy';
        this.data = null;
        this.initDOM();
    }

    initDOM() {
        this.container.innerHTML = `
            <div class="space-y-6">
                <!-- Mode Switcher & Export Bar -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                    
                    <!-- Mode Pills -->
                    <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700">
                        <button id="mode-greedy-btn" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm transition-all flex items-center gap-1.5">
                            <span>⚡ Minimum Transfers (Greedy)</span>
                        </button>
                        <button id="mode-trust-btn" class="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 transition-all flex items-center gap-1.5">
                            <span>🤝 Trust-Preserving (Max-Flow)</span>
                        </button>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex items-center gap-2">
                        <button id="btn-show-math" class="px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1.5 transition">
                            <span>📐 Show the Math</span>
                        </button>

                        <button id="btn-copy-whatsapp" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition">
                            <span>📲 Copy WhatsApp Text</span>
                        </button>

                        <button id="btn-export-csv" title="Export CSV" class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition">
                            📊 CSV
                        </button>
                        <button id="btn-print-pdf" title="Print / PDF" class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition">
                            🖨️ PDF
                        </button>
                    </div>
                </div>

                <!-- Toast Notification Container -->
                <div id="settlement-toast" class="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-medium shadow-lg transform translate-y-12 opacity-0 transition-all pointer-events-none flex items-center gap-2">
                    <span>Copied!</span>
                </div>

                <!-- Settlement Cards List -->
                <div class="space-y-3">
                    <div class="flex items-center justify-between">
                        <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                            <span>Required Payments</span>
                            <span id="settlement-count-badge" class="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">0</span>
                        </h4>
                        <span id="settlement-guarantee-note" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            Guaranteed minimum transfers
                        </span>
                    </div>

                    <div id="settlement-cards-container" class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <!-- Rendered dynamically -->
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const greedyBtn = this.container.querySelector('#mode-greedy-btn');
        const trustBtn = this.container.querySelector('#mode-trust-btn');
        const showMathBtn = this.container.querySelector('#btn-show-math');
        const copyWhatsappBtn = this.container.querySelector('#btn-copy-whatsapp');
        const exportCsvBtn = this.container.querySelector('#btn-export-csv');
        const printPdfBtn = this.container.querySelector('#btn-print-pdf');

        greedyBtn.onclick = () => {
            this.setMode('greedy');
            if (this.options.onModeChange) this.options.onModeChange('greedy');
        };

        trustBtn.onclick = () => {
            this.setMode('trust_preserving');
            if (this.options.onModeChange) this.options.onModeChange('trust_preserving');
        };

        showMathBtn.onclick = () => {
            if (this.options.onOpenMathDrawer) this.options.onOpenMathDrawer();
        };

        copyWhatsappBtn.onclick = () => this.copyWhatsAppSummary();

        exportCsvBtn.onclick = () => {
            if (this.data && this.data.group) {
                window.open(`/api/groups/${this.data.group.id}/export/csv`, '_blank');
            }
        };

        printPdfBtn.onclick = () => {
            window.print();
        };
    }

    setMode(mode) {
        this.currentMode = mode;
        const greedyBtn = this.container.querySelector('#mode-greedy-btn');
        const trustBtn = this.container.querySelector('#mode-trust-btn');

        if (mode === 'greedy') {
            greedyBtn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm transition-all flex items-center gap-1.5';
            trustBtn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 transition-all flex items-center gap-1.5';
        } else {
            trustBtn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm transition-all flex items-center gap-1.5';
            greedyBtn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 transition-all flex items-center gap-1.5';
        }
    }

    render(data) {
        this.data = data;
        if (!data) return;

        const curr = (data.group && data.group.currency_symbol) || '₹';
        const transfers = (data.after_graph && data.after_graph.transfers) ? data.after_graph.transfers : [];
        const countBadge = this.container.querySelector('#settlement-count-badge');
        const cardsContainer = this.container.querySelector('#settlement-cards-container');

        countBadge.textContent = transfers.length;

        if (transfers.length === 0) {
            cardsContainer.innerHTML = `
                <div class="col-span-2 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center space-y-3">
                    <div class="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl font-bold">
                        🎉
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-800 dark:text-slate-100 text-base">All Balanced & Settled</h4>
                        <p class="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                            No one in this group owes anything. Everyone's net balance is in exact equilibrium.
                        </p>
                    </div>
                </div>
            `;
            return;
        }

        cardsContainer.innerHTML = transfers.map((t, idx) => `
            <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-xs flex flex-col justify-between space-y-3">
                <div class="flex items-center justify-between">
                    <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Transfer #${idx + 1}</span>
                    <span class="font-mono font-bold text-base text-slate-900 dark:text-slate-100">
                        ${curr}${t.amount}
                    </span>
                </div>

                <!-- Debtor ➔ Creditor Row -->
                <div class="flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div class="flex items-center gap-2">
                        <span class="w-7 h-7 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center">
                            ${t.from_name.slice(0, 1)}
                        </span>
                        <div>
                            <span class="font-semibold text-xs text-slate-800 dark:text-slate-200 block">${t.from_name}</span>
                            <span class="text-[10px] text-rose-500 font-medium">Debtor (Payer)</span>
                        </div>
                    </div>

                    <div class="flex flex-col items-center">
                        <span class="text-xs text-slate-400">➔ pays ➔</span>
                    </div>

                    <div class="flex items-center gap-2 text-right">
                        <div>
                            <span class="font-semibold text-xs text-slate-800 dark:text-slate-200 block">${t.to_name}</span>
                            <span class="text-[10px] text-emerald-600 font-medium">Creditor (Receiver)</span>
                        </div>
                        <span class="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                            ${t.to_name.slice(0, 1)}
                        </span>
                    </div>
                </div>

                <!-- Action Button: Mark as Paid -->
                <div class="flex items-center justify-between pt-1">
                    <span class="text-[11px] text-slate-400">
                        Method: ${t.method === 'greedy' ? 'Optimized' : 'Trust-Path'}
                    </span>
                    <button data-from="${t.from_member_id}" data-to="${t.to_member_id}" data-amt="${t.amount}"
                        class="btn-mark-paid px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-700 dark:hover:text-emerald-300 text-slate-700 dark:text-slate-300 text-xs font-semibold transition flex items-center gap-1">
                        <span>✓ Mark as Paid</span>
                    </button>
                </div>
            </div>
        `).join('');

        // Attach Mark as Paid handlers
        cardsContainer.querySelectorAll('.btn-mark-paid').forEach(btn => {
            btn.onclick = () => {
                const fromId = btn.dataset.from;
                const toId = btn.dataset.to;
                const amt = btn.dataset.amt;
                if (this.options.onMarkPaid) {
                    this.options.onMarkPaid(fromId, toId, amt);
                }
            };
        });
    }

    async copyWhatsAppSummary() {
        if (!this.data || !this.data.group) return;
        try {
            const res = await fetch(`/api/groups/${this.data.group.id}/export/whatsapp`);
            const json = await res.json();
            if (json.text) {
                await navigator.clipboard.writeText(json.text);
                this.showToast("WhatsApp summary copied to clipboard! 📋");
            }
        } catch (err) {
            console.error("WhatsApp export error:", err);
            // Fallback client copy
            const curr = this.data.group.currency_symbol || '₹';
            const transfers = this.data.after_graph.transfers || [];
            const text = `*FairSplit Flow Settlement — ${this.data.group.name}*\n` +
                transfers.map((t, i) => `${i + 1}. *${t.from_name}* ➔ *${t.to_name}*: ${curr}${t.amount}`).join('\n');
            navigator.clipboard.writeText(text);
            this.showToast("Summary copied to clipboard! 📋");
        }
    }

    showToast(message) {
        const toast = this.container.querySelector('#settlement-toast');
        toast.textContent = message;
        toast.classList.remove('translate-y-12', 'opacity-0');
        setTimeout(() => {
            toast.classList.add('translate-y-12', 'opacity-0');
        }, 3000);
    }
}

window.SettlementView = SettlementView;
