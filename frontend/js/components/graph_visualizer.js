/**
 * FairSplit Flow - Interactive Debt Graph Visualizer
 * =================================================
 * Renders an interactive directed weighted graph:
 * - Nodes: People with avatars, names, role badges, and net balance indicators
 * - Edges: Directed arrows with debt amounts
 * - Toggle: "Before Simplification" (All original IOUs & cycles) vs "After Simplification" (Minimum DAG)
 * - Interactivity: Node dragging, hover connection highlighting, tooltips, responsive physics layout
 */

class DebtGraphVisualizer {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = Object.assign({
            width: 800,
            height: 480,
            currencySymbol: '₹',
            onNodeClick: null
        }, options);

        this.mode = 'after'; // 'before' or 'after'
        this.nodes = [];
        this.edges = [];
        this.draggedNode = null;
        this.hoveredNode = null;
        this.animationFrame = null;

        this.initDOM();
        this.setupEvents();
    }

    initDOM() {
        this.container.innerHTML = `
            <div class="relative w-full h-[460px] bg-slate-50/70 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden select-none">
                <!-- Controls Header -->
                <div class="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
                    <div class="flex items-center gap-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-sm border border-slate-200/80 dark:border-slate-700 pointer-events-auto">
                        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Graph Mode:</span>
                        <div class="flex items-center bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg text-xs font-medium">
                            <button id="btn-graph-before" class="px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 transition-all">
                                Before (IOUs)
                            </button>
                            <button id="btn-graph-after" class="px-2.5 py-1 rounded-md bg-emerald-600 text-white shadow-sm transition-all">
                                After (Simplified DAG)
                            </button>
                        </div>
                    </div>

                    <div id="graph-stats-badge" class="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 text-xs px-3 py-1.5 rounded-xl shadow-sm pointer-events-auto">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span id="graph-reduction-text">Transfers reduced to minimum</span>
                    </div>
                </div>

                <!-- Canvas -->
                <canvas id="debt-graph-canvas" class="w-full h-full cursor-grab active:cursor-grabbing block"></canvas>

                <!-- Legend & Instructions footer -->
                <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pointer-events-none">
                    <div class="flex items-center gap-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-800 pointer-events-auto">
                        <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Creditor (gets back)</span>
                        <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Debtor (owes)</span>
                        <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Settled</span>
                    </div>
                    <span class="hidden sm:inline bg-white/80 dark:bg-slate-800/80 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-800">
                        Drag nodes to rearrange • Hover to highlight debts
                    </span>
                </div>
            </div>
        `;

        this.canvas = this.container.querySelector('#debt-graph-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Buttons
        this.btnBefore = this.container.querySelector('#btn-graph-before');
        this.btnAfter = this.container.querySelector('#btn-graph-after');
        this.reductionText = this.container.querySelector('#graph-reduction-text');

        this.btnBefore.onclick = () => this.setMode('before');
        this.btnAfter.onclick = () => this.setMode('after');

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.width = rect.width || 800;
        this.height = rect.height || 460;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.render();
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === 'before') {
            this.btnBefore.className = 'px-2.5 py-1 rounded-md bg-amber-600 text-white shadow-sm transition-all';
            this.btnAfter.className = 'px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 transition-all';
        } else {
            this.btnAfter.className = 'px-2.5 py-1 rounded-md bg-emerald-600 text-white shadow-sm transition-all';
            this.btnBefore.className = 'px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 transition-all';
        }
        this.updateData(this.lastData);
    }

    setData(data) {
        this.lastData = data;
        this.updateData(data);
    }

    updateData(data) {
        if (!data || !data.nodes) return;
        const n = data.nodes.length;
        if (n === 0) return;

        // Position nodes in a gentle circular layout with initial spread
        const centerX = this.width / 2;
        const centerY = this.height / 2 + 10;
        const radius = Math.min(this.width, this.height) * 0.34;

        this.nodes = data.nodes.map((node, i) => {
            const existing = (this.nodes || []).find(existingNode => existingNode.id === node.id);
            const angle = (2 * Math.PI * i) / n - Math.PI / 2;
            return {
                id: node.id,
                name: node.name,
                avatar: node.avatar,
                net_balance: parseFloat(node.net_balance) || 0,
                status: node.status,
                x: existing ? existing.x : centerX + radius * Math.cos(angle),
                y: existing ? existing.y : centerY + radius * Math.sin(angle),
                radius: 28
            };
        });

        // Edges depending on mode
        if (this.mode === 'before') {
            const rawEdges = (data.before_graph && data.before_graph.edges) ? data.before_graph.edges : [];
            this.edges = rawEdges.map(e => ({
                from: e.from_id,
                to: e.to_id,
                amount: parseFloat(e.amount) || 0,
                label: `${this.options.currencySymbol}${e.amount}`
            }));
            const count = this.edges.length;
            const vol = data.before_graph.total_volume_formatted || '0.00';
            this.reductionText.innerHTML = `⚠️ <b>${count} IOUs</b> (${this.options.currencySymbol}${vol} debt churn)`;
        } else {
            const rawTransfers = (data.after_graph && data.after_graph.transfers) ? data.after_graph.transfers : [];
            this.edges = rawTransfers.map(t => ({
                from: t.from_member_id,
                to: t.to_member_id,
                amount: parseFloat(t.amount) || 0,
                label: `${this.options.currencySymbol}${t.amount}`
            }));
            const saved = (data.metrics && data.metrics.transfers_saved) ? data.metrics.transfers_saved : 0;
            const count = this.edges.length;
            this.reductionText.innerHTML = `✨ <b>${count} transfers</b> (${saved} redundant payments eliminated)`;
        }

        this.render();
    }

    setupEvents() {
        const getPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const findNode = (pos) => {
            return this.nodes.find(n => {
                const dx = n.x - pos.x;
                const dy = n.y - pos.y;
                return Math.sqrt(dx * dx + dy * dy) <= n.radius + 6;
            });
        };

        const handleStart = (pos) => {
            const node = findNode(pos);
            if (node) {
                this.draggedNode = node;
                this.render();
            }
        };

        const handleMove = (pos) => {
            if (this.draggedNode) {
                this.draggedNode.x = Math.max(35, Math.min(this.width - 35, pos.x));
                this.draggedNode.y = Math.max(50, Math.min(this.height - 40, pos.y));
                this.render();
            } else {
                const node = findNode(pos);
                if (node !== this.hoveredNode) {
                    this.hoveredNode = node;
                    this.render();
                }
            }
        };

        const handleEnd = () => {
            this.draggedNode = null;
            this.render();
        };

        this.canvas.addEventListener('mousedown', (e) => handleStart(getPos(e)));
        window.addEventListener('mousemove', (e) => handleMove(getPos(e)));
        window.addEventListener('mouseup', handleEnd);

        this.canvas.addEventListener('touchstart', (e) => {
            if (e.cancelable) e.preventDefault();
            handleStart(getPos(e));
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (this.draggedNode && e.cancelable) e.preventDefault();
            handleMove(getPos(e));
        }, { passive: false });

        window.addEventListener('touchend', handleEnd);
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // 1. Draw Edges (Arrows)
        this.edges.forEach(edge => {
            const u = this.nodes.find(n => n.id === edge.from);
            const v = this.nodes.find(n => n.id === edge.to);
            if (!u || !v) return;

            const isHighlighted = this.hoveredNode
                ? (this.hoveredNode.id === u.id || this.hoveredNode.id === v.id)
                : true;

            const isOutgoing = this.hoveredNode && this.hoveredNode.id === u.id;
            const isIncoming = this.hoveredNode && this.hoveredNode.id === v.id;

            this.drawArrow(ctx, u, v, edge.label, isHighlighted, isOutgoing, isIncoming);
        });

        // 2. Draw Nodes
        this.nodes.forEach(node => {
            const isHovered = this.hoveredNode && this.hoveredNode.id === node.id;
            this.drawNode(ctx, node, isHovered);
        });
    }

    drawArrow(ctx, fromNode, toNode, label, isHighlighted, isOutgoing, isIncoming) {
        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;

        const ux = dx / dist;
        const uy = dy / dist;

        // Clip start and end at node radii
        const startX = fromNode.x + ux * (fromNode.radius + 2);
        const startY = fromNode.y + uy * (fromNode.radius + 2);
        const endX = toNode.x - ux * (toNode.radius + 8);
        const endY = toNode.y - uy * (toNode.radius + 8);

        // Curved line if bidirectional or to avoid overlapping center
        const midX = (startX + endX) / 2 - uy * 14;
        const midY = (startY + endY) / 2 + ux * 14;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(midX, midY, endX, endY);

        let strokeColor = 'rgba(148, 163, 184, 0.45)'; // Slate 400
        let lineWidth = 1.5;

        if (this.hoveredNode) {
            if (isOutgoing) {
                strokeColor = '#e11d48'; // Rose (money paying out)
                lineWidth = 2.5;
            } else if (isIncoming) {
                strokeColor = '#059669'; // Emerald (money coming in)
                lineWidth = 2.5;
            } else {
                strokeColor = 'rgba(203, 213, 225, 0.15)';
            }
        } else if (this.mode === 'after') {
            strokeColor = '#0d9488'; // Teal for simplified DAG
            lineWidth = 2.0;
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        // Arrowhead
        const angle = Math.atan2(endY - midY, endX - midX);
        const headLen = 9;
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
            endX - headLen * Math.cos(angle - Math.PI / 6),
            endY - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            endX - headLen * Math.cos(angle + Math.PI / 6),
            endY - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        // Label Badge on curve midpoint
        if (isHighlighted) {
            const labelX = midX;
            const labelY = midY;

            ctx.font = '600 11px system-ui, -apple-system, sans-serif';
            const metrics = ctx.measureText(label);
            const badgeW = metrics.width + 12;
            const badgeH = 18;

            // Badge Background
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.roundRect(labelX - badgeW / 2, labelY - badgeH / 2, badgeW, badgeH, 6);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Text
            ctx.fillStyle = isOutgoing ? '#be123c' : (isIncoming ? '#047857' : '#0f172a');
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, labelX, labelY);
        }

        ctx.restore();
    }

    drawNode(ctx, node, isHovered) {
        ctx.save();

        // Node Glow
        if (isHovered) {
            ctx.shadowColor = node.net_balance > 0 ? 'rgba(16, 185, 129, 0.4)' : (node.net_balance < 0 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(148, 163, 184, 0.4)');
            ctx.shadowBlur = 12;
        }

        // Outer Ring
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        let ringColor = '#cbd5e1'; // neutral
        if (node.net_balance > 0) ringColor = '#10b981'; // emerald
        else if (node.net_balance < 0) ringColor = '#f43f5e'; // rose

        ctx.lineWidth = isHovered ? 3.5 : 2.5;
        ctx.strokeStyle = ringColor;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Initials Avatar
        const initials = node.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
        ctx.fillStyle = '#0f172a';
        ctx.font = '600 12px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, node.x, node.y);

        // Name Label below
        ctx.font = '500 11px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText(node.name.length > 13 ? node.name.slice(0, 11) + '..' : node.name, node.x, node.y + node.radius + 14);

        // Net Balance Pill
        const bal = node.net_balance;
        const balText = bal === 0
            ? 'Settled'
            : (bal > 0 ? `+${this.options.currencySymbol}${bal.toFixed(0)}` : `-${this.options.currencySymbol}${Math.abs(bal).toFixed(0)}`);

        ctx.font = '600 10px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = bal > 0 ? '#059669' : (bal < 0 ? '#e11d48' : '#64748b');
        ctx.fillText(balText, node.x, node.y + node.radius + 26);

        ctx.restore();
    }
}

window.DebtGraphVisualizer = DebtGraphVisualizer;
