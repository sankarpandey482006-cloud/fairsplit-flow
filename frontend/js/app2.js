/**
 * FairSplit Flow — Main App Logic v3
 * ====================================
 * Complete rewrite with:
 * ✓ Landing page / onboarding flow
 * ✓ Clean light theme, no dark mode
 * ✓ Icon-based expense mode toggle (Shared / Individual)
 * ✓ Fixed live preview (amount input wired correctly)
 * ✓ Fixed custom split defaults (percent, shares, days)
 * ✓ Days split method for hostel groups
 * ✓ Inline debt graph visualization (Before / After SVG)
 * ✓ Inline delete confirm (no browser confirm() dialogs)
 * ✓ Inline validation everywhere (no browser alert())
 * ✓ Save & Add Another
 * ✓ Math drawer with full trace
 * ✓ Settlement modes: Greedy + Trust-Preserving
 * ✓ Special modules: Hostel, Club, Office
 * ✓ WhatsApp + CSV + PDF export
 * ✓ Fully mobile-responsive with FAB
 */

/* ══════════════════════════════════════
   APP STATE
══════════════════════════════════════ */
const App = {
  currentGroupId: null,
  groups:         [],
  groupData:      null,
  settlementData: null,
  expenseMode:    'shared',   // 'shared' | 'individual'
  splitMethod:    'equal',    // 'equal'|'exact'|'percent'|'shares'|'days'
  selectedMembers: new Set(),
  splitValues:    {},         // memberId → numeric value
  currentTab:     'dashboard',
  settleMode:     'greedy',   // 'greedy' | 'trust_preserving'
  expenseFilter:  'all',      // 'all' | 'mine'
  currentGroupType: 'travel',
  graphView:      'after',    // 'after' | 'before'
  pendingDeleteId: null,      // expense being confirmed for delete
};

/* ══════════════════════════════════════
   LANDING PAGE HELPERS
══════════════════════════════════════ */
function showApp() {
  document.getElementById('landing-page').style.display = 'none';
  document.getElementById('main-app').classList.add('visible');
}

function showLanding() {
  document.getElementById('landing-page').style.display = 'flex';
  document.getElementById('main-app').classList.remove('visible');
}

window.showApp   = showApp;
window.showLanding = showLanding;

/* ══════════════════════════════════════
   BOOTSTRAP
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Nav tab listeners
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Group selector change
  document.getElementById('group-selector-select').addEventListener('change', e => {
    App.currentGroupId = e.target.value;
    loadGroupData(App.currentGroupId);
  });

  // Amount input live preview — wire here, after DOM ready
  const amtInput = document.getElementById('exp-amount');
  if (amtInput) {
    amtInput.addEventListener('input', updateLivePreview);
    amtInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); submitExpense(false); }
    });
  }

  // Math drawer backdrop click
  document.getElementById('math-drawer-overlay').addEventListener('click', e => {
    if (e.target.id === 'math-drawer-overlay') closeMathDrawer();
  });

  // Modal backdrop click
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('visible');
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.visible').forEach(m => m.classList.remove('visible'));
      closeMathDrawer();
    }
  });

  // Load data
  loadGroups();
});

/* ══════════════════════════════════════
   TOAST
══════════════════════════════════════ */
function showToast(msg, type = 'default', duration = 2800) {
  const t = document.getElementById('app-toast');
  t.textContent = msg;
  t.style.background = type === 'error' ? '#dc2626' : '#0f172a';
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

/* ══════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════ */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('visible');
  if (id === 'modal-invite' && App.groupData) {
    document.getElementById('invite-code-display').textContent = App.groupData.group.invite_code || '——';
  }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('visible');
}
window.openModal  = openModal;
window.closeModal = closeModal;

/* ══════════════════════════════════════
   TABS
══════════════════════════════════════ */
function switchTab(tab) {
  App.currentTab = tab;
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));

  const panel = document.getElementById('tab-' + tab);
  if (panel) panel.style.display = 'block';
  const btn = document.querySelector(`.nav-tab[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');

  if (tab === 'settlements') fetchSettlements(App.settleMode);
  if (tab === 'members')     renderMembersTab();
  if (tab === 'special')     renderSpecialTab();
  if (tab === 'report')      renderPublicReport();
}
window.switchTab = switchTab;

/* ══════════════════════════════════════
   LOAD GROUPS
══════════════════════════════════════ */
async function loadGroups() {
  try {
    const res = await fetch('/api/groups');
    if (!res.ok) throw new Error('API error');
    App.groups = await res.json();
    renderGroupSelector();
    if (App.groups.length > 0) {
      App.currentGroupId = App.groups[0].id;
      await loadGroupData(App.currentGroupId);
      showApp(); // Auto-open app if groups exist
    }
  } catch (err) {
    console.error('loadGroups:', err);
    // Stay on landing if no data
  }
}

function renderGroupSelector() {
  const sel = document.getElementById('group-selector-select');
  if (!sel) return;
  sel.innerHTML = App.groups.map(g =>
    `<option value="${g.id}" ${g.id === App.currentGroupId ? 'selected' : ''}>${getGroupTypeEmoji(g.group_type)} ${escHtml(g.name)}</option>`
  ).join('');
}

function getGroupTypeEmoji(type) {
  const map = { travel:'✈️', hostel:'🏠', club:'🎓', office:'💼', family:'👨‍👩‍👧‍👦', sports:'⚽', business:'📈', other:'🌐' };
  return map[type] || '🌐';
}

/* ══════════════════════════════════════
   LOAD GROUP DATA
══════════════════════════════════════ */
async function loadGroupData(id) {
  if (!id) return;
  try {
    const res = await fetch(`/api/groups/${id}`);
    if (!res.ok) throw new Error('Group not found');
    App.groupData = await res.json();
    App.currentGroupType = App.groupData.group.group_type;
    updateSpecialTabLabel();
    renderDashboard();
    // Update currency symbol pill in expense modal
    const symEl = document.getElementById('exp-currency-symbol');
    if (symEl) symEl.textContent = App.groupData.group.currency_symbol || '₹';
    // Update exact split pill label
    updateExactPillLabel();
    // Show/hide days pill
    const daysPill = document.getElementById('split-pill-days');
    if (daysPill) daysPill.style.display = App.currentGroupType === 'hostel' ? 'inline-block' : 'none';
  } catch (err) {
    console.error('loadGroupData:', err);
    showToast('⚠ Could not load group data', 'error');
  }
}

function updateExactPillLabel() {
  const sym = App.groupData?.group?.currency_symbol || '₹';
  const pill = document.querySelector('.split-pill[data-method="exact"]');
  if (pill) pill.textContent = `Exact ${sym}`;
}

/* ══════════════════════════════════════
   RENDER DASHBOARD
══════════════════════════════════════ */
function renderDashboard() {
  if (!App.groupData) return;
  const { group, members } = App.groupData;
  const sym = group.currency_symbol || '₹';

  document.getElementById('group-name-display').textContent = group.name;
  document.getElementById('dash-total-spent').textContent = sym + (App.groupData.total_spent_formatted || '0.00');
  document.getElementById('dash-member-count').textContent = members.length;
  document.getElementById('dash-invite-code').textContent = (group.invite_code || '——') + '  copy →';

  // Personal balance card: find "current user" heuristically
  const me = findCurrentUser(members);
  if (me) renderBalanceHero(me, sym);

  renderExpensesList();
  renderMemberBalances();
  renderActivity();
}

/** Heuristic: find the user most likely to be "me" */
function findCurrentUser(members) {
  return (
    members.find(m => m.user_id === 'user_sankalp') ||
    members.find(m => m.name.toLowerCase().includes('sankalp')) ||
    members.find(m => m.role === 'admin') ||
    members[0]
  );
}

function renderBalanceHero(me, sym) {
  const hero    = document.getElementById('balance-hero');
  const balLabel = document.getElementById('balance-label');
  const balAmt  = document.getElementById('balance-amount');
  const balSub  = document.getElementById('balance-subtitle');
  const bal     = me.net_balance_cents || 0;
  const fmt     = (Math.abs(bal) / 100).toFixed(2);

  if (bal > 0) {
    hero.className = 'balance-hero-owed';
    balLabel.textContent = 'YOU ARE OWED';
    balAmt.textContent   = `+${sym}${fmt}`;
    balSub.textContent   = `Others will pay you ${sym}${fmt} during settlement.`;
  } else if (bal < 0) {
    hero.className = 'balance-hero-owes';
    balLabel.textContent = 'YOU OWE';
    balAmt.textContent   = `-${sym}${fmt}`;
    balSub.textContent   = `You have ${sym}${fmt} in pending payments.`;
  } else {
    hero.className = 'balance-hero-settled';
    balLabel.textContent = 'ALL SETTLED ✓';
    balAmt.textContent   = `${sym}0.00`;
    balSub.textContent   = 'You have no outstanding balance. 🎉';
  }
}

/* ═══ Expense Filter ═══ */
function setExpenseFilter(f) {
  App.expenseFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => {
    const active = b.dataset.filter === f;
    b.classList.toggle('active-filter', active);
    b.style.background = active ? '#0d9488' : 'transparent';
    b.style.color      = active ? '#fff'     : '#64748b';
  });
  renderExpensesList();
}
window.setExpenseFilter = setExpenseFilter;

/* ═══ Expenses List ═══ */
function renderExpensesList() {
  if (!App.groupData) return;
  const { group, members, expenses } = App.groupData;
  const sym        = group.currency_symbol || '₹';
  const membersMap = Object.fromEntries(members.map(m => [m.id, m]));
  const me         = findCurrentUser(members);

  let list = expenses || [];
  if (App.expenseFilter === 'mine' && me) {
    list = list.filter(e =>
      e.paid_by === me.id || (e.shares || []).some(s => s.member_id === me.id)
    );
  }

  const container = document.getElementById('expense-list-container');

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">💸</div>
        <h4>No expenses yet</h4>
        <p>Tap "+ Add Expense" to log your first one.</p>
        <button onclick="openAddExpenseModal()" style="margin-top:16px;padding:10px 24px;background:#0d9488;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">+ Add First Expense</button>
      </div>`;
    return;
  }

  const catIcons = {
    'Food & Drink':'🍽️','Stay & Hotel':'🏨','Transport & Fuel':'🚗',
    'Activities':'🎯','Groceries':'🛒','Utilities':'⚡','Rent':'🏠',
    'Software & Cloud':'☁️','Entertainment':'🎉','Medical':'💊','General':'📌'
  };

  container.innerHTML = list.map(e => {
    const payer      = membersMap[e.paid_by] || {};
    const icon       = catIcons[e.category] || '📌';
    const shareCount = (e.shares || []).length;
    const isRecurring = e.recurring_frequency && e.recurring_frequency !== 'none';
    const statusDot  = e.status === 'pending' ? '🟡' : e.status === 'rejected' ? '🔴' : '';
    return `
      <div class="expense-item" id="exp-item-${e.id}">
        <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
          <div style="width:40px;height:40px;background:#f0fdfa;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${icon}</div>
          <div style="min-width:0;">
            <div style="font-size:14px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${statusDot} ${escHtml(e.title)}
              ${isRecurring ? `<span style="margin-left:6px;padding:2px 7px;background:#ede9fe;color:#7c3aed;border-radius:99px;font-size:11px;font-weight:600;">↻ ${e.recurring_frequency}</span>` : ''}
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px;">
              Paid by <b style="color:#64748b;">${escHtml(payer.name || '?')}</b> · ${shareCount} people · ${e.expense_date || ''}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <div style="text-align:right;">
            <div style="font-size:15px;font-weight:700;color:#0f172a;">${sym}${e.amount_formatted}</div>
            <div style="font-size:11px;color:#94a3b8;text-transform:capitalize;">${e.split_type}</div>
          </div>
          <div id="del-wrap-${e.id}">
            <button onclick="confirmDeleteExpense('${e.id}')" title="Delete"
              style="width:28px;height:28px;border-radius:7px;border:none;background:#f1f5f9;color:#94a3b8;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

/** Show inline delete confirmation (no native confirm()) */
window.confirmDeleteExpense = function(id) {
  // Reset any previous confirm
  if (App.pendingDeleteId && App.pendingDeleteId !== id) {
    const prev = document.getElementById(`del-wrap-${App.pendingDeleteId}`);
    if (prev) prev.innerHTML = `<button onclick="confirmDeleteExpense('${App.pendingDeleteId}')" title="Delete" style="width:28px;height:28px;border-radius:7px;border:none;background:#f1f5f9;color:#94a3b8;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>`;
  }
  App.pendingDeleteId = id;
  const wrap = document.getElementById(`del-wrap-${id}`);
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="delete-confirm-inline">
      <span style="font-size:12px;color:#dc2626;font-weight:600;">Delete?</span>
      <button onclick="executeDeleteExpense('${id}')" style="padding:4px 10px;background:#dc2626;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Yes</button>
      <button onclick="cancelDeleteExpense('${id}')" style="padding:4px 8px;background:#f1f5f9;color:#64748b;border:none;border-radius:6px;font-size:12px;cursor:pointer;">No</button>
    </div>`;
};

window.cancelDeleteExpense = function(id) {
  App.pendingDeleteId = null;
  const wrap = document.getElementById(`del-wrap-${id}`);
  if (wrap) wrap.innerHTML = `<button onclick="confirmDeleteExpense('${id}')" title="Delete" style="width:28px;height:28px;border-radius:7px;border:none;background:#f1f5f9;color:#94a3b8;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>`;
};

window.executeDeleteExpense = async function(id) {
  App.pendingDeleteId = null;
  try {
    const res = await fetch(`/api/groups/${App.currentGroupId}/expenses/${id}`, { method: 'DELETE' });
    if (!res.ok) { showToast('⚠ Could not delete expense', 'error'); return; }
    showToast('Expense deleted.');
    await loadGroupData(App.currentGroupId);
    if (App.currentTab === 'settlements') fetchSettlements(App.settleMode);
  } catch (e) { console.error(e); showToast('⚠ Network error', 'error'); }
};

/* ═══ Member Balance Sidebar ═══ */
function renderMemberBalances() {
  if (!App.groupData) return;
  const { group, members } = App.groupData;
  const sym       = group.currency_symbol || '₹';
  const container = document.getElementById('member-balances-list');
  const avColors  = ['#c7d2fe','#fde68a','#99f6e4','#fecaca','#e9d5ff','#fed7aa'];

  container.innerHTML = members.map(m => {
    const bal     = m.net_balance_cents || 0;
    const fmt     = (Math.abs(bal) / 100).toFixed(2);
    const color   = bal > 0 ? '#059669' : bal < 0 ? '#dc2626' : '#94a3b8';
    const bg      = bal > 0 ? '#dcfce7' : bal < 0 ? '#fee2e2' : '#f1f5f9';
    const prefix  = bal > 0 ? '+' : bal < 0 ? '-' : '';
    const initials = m.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    const avBg    = avColors[m.name.charCodeAt(0) % avColors.length];
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;min-width:0;">
          <div class="avatar" style="background:${avBg};color:#0f172a;width:32px;height:32px;font-size:12px;">${initials}</div>
          <div style="min-width:0;">
            <div style="font-size:13px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">${escHtml(m.name)}</div>
            <div style="font-size:11px;color:#94a3b8;">${m.role}</div>
          </div>
        </div>
        <div style="padding:3px 8px;border-radius:99px;background:${bg};color:${color};font-size:12px;font-weight:700;white-space:nowrap;">
          ${prefix}${sym}${fmt}
        </div>
      </div>`;
  }).join('');
}

/* ═══ Activity Feed ═══ */
function renderActivity() {
  if (!App.groupData) return;
  const list      = App.groupData.activity || [];
  const container = document.getElementById('activity-list');

  if (!list.length) {
    container.innerHTML = `<p style="font-size:13px;color:#94a3b8;">No recent activity.</p>`;
    return;
  }
  container.innerHTML = list.slice(0, 10).map(a => `
    <div style="display:flex;align-items:flex-start;gap:8px;">
      <div style="width:7px;height:7px;border-radius:50%;background:#0d9488;margin-top:5px;flex-shrink:0;"></div>
      <div>
        <span style="font-size:12px;color:#0f172a;font-weight:600;">${escHtml(a.member_name)}</span>
        <span style="font-size:12px;color:#64748b;"> ${escHtml(a.details)}</span>
        <div style="font-size:11px;color:#cbd5e1;margin-top:1px;">${a.created_at || ''}</div>
      </div>
    </div>`).join('');
}

/* ══════════════════════════════════════
   ADD EXPENSE MODAL
══════════════════════════════════════ */
function openAddExpenseModal(presetTitle = '') {
  if (!App.groupData) {
    showToast('⚠ Please select a group first', 'error');
    return;
  }
  clearExpenseForm();
  const { group, members } = App.groupData;
  const sym = group.currency_symbol || '₹';

  // Currency symbol
  const symEl = document.getElementById('exp-currency-symbol');
  if (symEl) symEl.textContent = sym;

  // Exact pill label
  updateExactPillLabel();

  // Show/hide Days pill based on group type
  const daysPill = document.getElementById('split-pill-days');
  if (daysPill) daysPill.style.display = App.currentGroupType === 'hostel' ? 'inline-block' : 'none';

  // Paid By — default to current user
  const me = findCurrentUser(members);
  const paidBySelect = document.getElementById('exp-paid-by');
  paidBySelect.innerHTML = members.map(m =>
    `<option value="${m.id}" ${m.id === (me && me.id) ? 'selected' : ''}>${escHtml(m.name)}${m.id === (me && me.id) ? ' (you)' : ''}</option>`
  ).join('');

  // Individual target — everyone except current user
  const indTarget = document.getElementById('exp-individual-target');
  const others    = members.filter(m => m.id !== (me && me.id));
  indTarget.innerHTML = (others.length ? others : members).map(m =>
    `<option value="${m.id}">${escHtml(m.name)}</option>`
  ).join('');

  // Date default → today
  const dateEl = document.getElementById('exp-date');
  if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);

  // All members selected by default
  App.selectedMembers = new Set(members.map(m => m.id));
  App.splitValues     = {};
  setExpenseMode('shared');
  setSplitMethod('equal');

  renderMembersChecklist();
  updateLivePreview();

  if (presetTitle) {
    const titleEl = document.getElementById('exp-title');
    if (titleEl) titleEl.value = presetTitle;
  }

  openModal('modal-add-expense');
  setTimeout(() => {
    const titleEl = document.getElementById('exp-title');
    if (titleEl) titleEl.focus();
  }, 180);
}
window.openAddExpenseModal = openAddExpenseModal;

function clearExpenseForm() {
  ['exp-title','exp-amount','exp-project-tag'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('error'); }
  });
  const rec = document.getElementById('exp-recurring');
  if (rec) rec.value = 'none';
  ['err-title','err-amount','err-members'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

/* ─── Expense Mode Toggle ─── */
window.setExpenseMode = function(mode) {
  App.expenseMode = mode;
  document.getElementById('toggle-shared').classList.toggle('active', mode === 'shared');
  document.getElementById('toggle-individual').classList.toggle('active', mode === 'individual');
  document.getElementById('split-between-section').style.display  = mode === 'shared'     ? 'block' : 'none';
  document.getElementById('individual-target-section').style.display = mode === 'individual' ? 'block' : 'none';
  updateLivePreview();
};

/* ─── Split Method Pills ─── */
window.setSplitMethod = function(method) {
  App.splitMethod = method;
  document.querySelectorAll('.split-pill').forEach(p =>
    p.classList.toggle('active', p.dataset.method === method)
  );
  // Pre-populate split values with sensible defaults
  if (App.groupData) {
    const members   = App.groupData.members;
    const selected  = Array.from(App.selectedMembers);
    const n         = selected.length;
    if (method === 'percent' && n > 0) {
      const base    = Math.floor(100 / n);
      const rem     = 100 % n;
      selected.forEach((id, i) => { App.splitValues[id] = base + (i === 0 ? rem : 0); });
    } else if (method === 'shares') {
      selected.forEach(id => { if (!App.splitValues[id]) App.splitValues[id] = 1; });
    } else if (method === 'days') {
      selected.forEach(id => { if (!App.splitValues[id]) App.splitValues[id] = 30; });
    }
  }
  renderMembersChecklist();
  updateLivePreview();
};

/* ─── Member Checklist ─── */
function renderMembersChecklist() {
  if (!App.groupData) return;
  const { members }  = App.groupData;
  const container    = document.getElementById('members-checklist');
  const needsInput   = ['exact','percent','shares','days'].includes(App.splitMethod);
  const avColors     = ['#c7d2fe','#fde68a','#99f6e4','#fecaca','#e9d5ff','#fed7aa'];
  const sym          = App.groupData.group.currency_symbol || '₹';

  const suffixMap  = { exact: sym, percent: '%', shares: ' share(s)', days: ' day(s)' };
  const placeholderMap = { exact: '0.00', percent: '0', shares: '1', days: '30' };

  container.innerHTML = members.map(m => {
    const initials  = m.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    const avBg      = avColors[m.name.charCodeAt(0) % avColors.length];
    const isChecked = App.selectedMembers.has(m.id);
    const val       = App.splitValues[m.id] ?? (App.splitMethod === 'shares' ? 1 : App.splitMethod === 'days' ? 30 : App.splitMethod === 'percent' ? Math.floor(100 / members.length) : 0);
    const suffix    = suffixMap[App.splitMethod] || '';
    const ph        = placeholderMap[App.splitMethod] || '0';

    return `
      <div class="member-row ${isChecked ? 'selected' : ''}" id="mrow-${m.id}">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;min-width:0;">
          <input type="checkbox" class="member-cb" data-id="${m.id}" ${isChecked ? 'checked' : ''}
            style="width:17px;height:17px;accent-color:#0d9488;cursor:pointer;flex-shrink:0;" />
          <div class="avatar" style="background:${avBg};color:#0f172a;font-size:12px;width:32px;height:32px;">${initials}</div>
          <div style="min-width:0;">
            <div style="font-size:13px;font-weight:600;color:#0f172a;">${escHtml(m.name)}</div>
            <div style="font-size:11px;color:#94a3b8;">${m.role}</div>
          </div>
        </label>
        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
          ${needsInput && isChecked ? `
            <input type="number" class="member-custom-input" data-id="${m.id}"
              value="${val}" min="0" step="${App.splitMethod === 'exact' ? '0.01' : '1'}"
              placeholder="${ph}"
              style="width:70px;padding:5px 8px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:13px;text-align:right;font-family:inherit;" />
            <span style="font-size:12px;color:#94a3b8;white-space:nowrap;">${suffix}</span>
          ` : ''}
          <span id="share-preview-${m.id}" style="font-size:13px;font-weight:600;color:${isChecked ? '#0d9488' : '#cbd5e1'};min-width:56px;text-align:right;">—</span>
        </div>
      </div>`;
  }).join('');

  // Checkbox listeners
  container.querySelectorAll('.member-cb').forEach(cb => {
    cb.addEventListener('change', e => {
      const id = e.target.dataset.id;
      if (e.target.checked) {
        App.selectedMembers.add(id);
        // Set sensible default for newly checked member
        if (App.splitMethod === 'shares' && !App.splitValues[id]) App.splitValues[id] = 1;
        if (App.splitMethod === 'days'   && !App.splitValues[id]) App.splitValues[id] = 30;
      } else {
        App.selectedMembers.delete(id);
      }
      // Re-equalize percentages when a member is toggled
      if (App.splitMethod === 'percent') {
        const sel = Array.from(App.selectedMembers);
        const n   = sel.length;
        if (n > 0) {
          const base = Math.floor(100 / n);
          const rem  = 100 % n;
          sel.forEach((mid, i) => { App.splitValues[mid] = base + (i === 0 ? rem : 0); });
        }
      }
      renderMembersChecklist();
      updateLivePreview();
    });
  });

  // Custom input listeners
  container.querySelectorAll('.member-custom-input').forEach(inp => {
    inp.addEventListener('input', e => {
      App.splitValues[e.target.dataset.id] = parseFloat(e.target.value) || 0;
      updateLivePreview();
    });
  });
}

window.selectAllMembers = function() {
  if (!App.groupData) return;
  App.selectedMembers = new Set(App.groupData.members.map(m => m.id));
  if (App.splitMethod === 'percent') {
    const n = App.groupData.members.length;
    const base = Math.floor(100 / n), rem = 100 % n;
    App.groupData.members.forEach((m, i) => { App.splitValues[m.id] = base + (i === 0 ? rem : 0); });
  }
  renderMembersChecklist();
  updateLivePreview();
};

window.deselectAllMembers = function() {
  App.selectedMembers.clear();
  renderMembersChecklist();
  updateLivePreview();
};

/* ─── Live Preview ─── */
function updateLivePreview() {
  if (!App.groupData) return;
  const { group } = App.groupData;
  const sym       = group.currency_symbol || '₹';
  const amtEl     = document.getElementById('exp-amount');
  const amount    = parseFloat(amtEl ? amtEl.value : 0) || 0;
  const totalCents = window.ClientDebtEngine ? window.ClientDebtEngine.toCents(amount) : Math.round(amount * 100);
  const selectedArr = Array.from(App.selectedMembers);
  const n           = selectedArr.length;

  document.getElementById('live-member-count').textContent = n;

  if (totalCents === 0 || n === 0) {
    document.getElementById('live-per-person').textContent = `${sym}0.00 each`;
    document.getElementById('live-sum-check').textContent  = '—';
    document.getElementById('live-sum-check').style.color  = '#94a3b8';
    if (App.groupData) {
      App.groupData.members.forEach(m => {
        const el = document.getElementById(`share-preview-${m.id}`);
        if (el) { el.textContent = '—'; el.style.color = '#cbd5e1'; }
      });
    }
    return;
  }

  // For individual mode: just show total / 1 person
  const effectiveMethod = App.expenseMode === 'individual' ? 'equal' : App.splitMethod;
  const effectiveSelected = App.expenseMode === 'individual'
    ? [document.getElementById('exp-individual-target')?.value || selectedArr[0]]
    : selectedArr;

  // Map split method names to what client_engine.js understands
  const clientMethodMap = { 'days': 'days_stayed', 'percent': 'percentage' };
  const clientMethod = clientMethodMap[effectiveMethod] || effectiveMethod;

  const shares = window.ClientDebtEngine
    ? window.ClientDebtEngine.calculateShares(totalCents, clientMethod, effectiveSelected, App.splitValues)
    : {};

  let sumCents = 0;
  if (App.groupData) {
    App.groupData.members.forEach(m => {
      const el = document.getElementById(`share-preview-${m.id}`);
      if (el) {
        const s = shares[m.id] || 0;
        sumCents += s;
        const inScope = App.expenseMode === 'individual'
          ? m.id === effectiveSelected[0]
          : App.selectedMembers.has(m.id);
        el.textContent = inScope ? `${sym}${(s/100).toFixed(2)}` : '—';
        el.style.color  = inScope ? '#0d9488' : '#cbd5e1';
      }
    });
  }

  const perPerson = n > 0 ? (totalCents / n / 100).toFixed(2) : '0.00';
  document.getElementById('live-per-person').textContent =
    effectiveMethod === 'equal' ? `${sym}${perPerson} each` : `Custom split`;

  const matched = sumCents === totalCents;
  const sumCheck = document.getElementById('live-sum-check');
  sumCheck.textContent = matched ? '✓ Exact' : `Σ ${sym}${(sumCents/100).toFixed(2)}`;
  sumCheck.style.color = matched ? '#059669' : '#dc2626';
}

/* ─── Submit Expense ─── */
window.submitExpense = async function(addAnother) {
  const titleEl = document.getElementById('exp-title');
  const amtEl   = document.getElementById('exp-amount');
  const title   = titleEl.value.trim();
  const amount  = parseFloat(amtEl.value);

  // Clear previous errors
  titleEl.classList.remove('error');
  amtEl.classList.remove('error');
  ['err-title','err-amount','err-members'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  let valid = true;
  if (!title) {
    titleEl.classList.add('error');
    document.getElementById('err-title').style.display = 'flex';
    titleEl.focus();
    valid = false;
  }
  if (!amount || amount <= 0) {
    amtEl.classList.add('error');
    document.getElementById('err-amount').style.display = 'flex';
    if (valid) amtEl.focus();
    valid = false;
  }
  const selectedArr = Array.from(App.selectedMembers);
  if (App.expenseMode === 'shared' && selectedArr.length === 0) {
    document.getElementById('err-members').style.display = 'flex';
    valid = false;
  }
  if (!valid) return;

  const paid_by          = document.getElementById('exp-paid-by').value;
  const selected_members = App.expenseMode === 'individual'
    ? [document.getElementById('exp-individual-target').value]
    : selectedArr;

  const payload = {
    title,
    amount,
    paid_by,
    category:            document.getElementById('exp-category').value,
    expense_date:        document.getElementById('exp-date').value,
    recurring_frequency: document.getElementById('exp-recurring').value,
    project_tag:         document.getElementById('exp-project-tag').value,
    mode:                App.expenseMode,
    split_type:          App.expenseMode === 'individual' ? 'exact' : App.splitMethod,
    selected_members,
    split_data:          App.splitValues,
  };

  const saveBtn    = document.getElementById('btn-save-expense');
  const anotherBtn = document.getElementById('btn-save-another');
  saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;
  if (anotherBtn) anotherBtn.disabled = true;

  try {
    const res = await fetch(`/api/groups/${App.currentGroupId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast('⚠ ' + (err.error || 'Could not save expense.'), 'error');
      return;
    }

    showToast(`✓ "${title}" saved!`);
    await loadGroupData(App.currentGroupId);

    if (addAnother) {
      clearExpenseForm();
      renderMembersChecklist();
      updateLivePreview();
      setTimeout(() => document.getElementById('exp-title').focus(), 80);
    } else {
      closeModal('modal-add-expense');
    }
  } catch (err) {
    showToast('⚠ Network error. Please try again.', 'error');
    console.error(err);
  } finally {
    saveBtn.textContent = 'Save Expense'; saveBtn.disabled = false;
    if (anotherBtn) anotherBtn.disabled = false;
  }
};

/* ══════════════════════════════════════
   ADD MEMBER
══════════════════════════════════════ */
window.submitAddMember = async function() {
  const nameEl = document.getElementById('add-member-name');
  const name   = nameEl.value.trim();
  const errEl  = document.getElementById('err-member-name');
  nameEl.classList.remove('error'); errEl.style.display = 'none';

  if (!name) {
    nameEl.classList.add('error');
    errEl.style.display = 'flex';
    nameEl.focus();
    return;
  }

  try {
    const res = await fetch(`/api/groups/${App.currentGroupId}/members`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name,
        email: document.getElementById('add-member-email').value.trim(),
        role:  document.getElementById('add-member-role').value,
      }),
    });
    if (res.ok) {
      showToast(`✓ ${name} added to group!`);
      closeModal('modal-add-member');
      nameEl.value = '';
      document.getElementById('add-member-email').value = '';
      await loadGroupData(App.currentGroupId);
      if (App.currentTab === 'members') renderMembersTab();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast('⚠ ' + (err.error || 'Could not add member.'), 'error');
    }
  } catch (e) { console.error(e); showToast('⚠ Network error', 'error'); }
};

/* ══════════════════════════════════════
   INVITE CODE
══════════════════════════════════════ */
window.copyInviteCode = function() {
  const code = App.groupData?.group?.invite_code;
  if (!code) return;
  navigator.clipboard.writeText(code)
    .then(() => showToast(`📋 Invite code "${code}" copied!`))
    .catch(() => showToast(`Code: ${code} — please copy manually`));
};

window.copyInviteLink = function() {
  const code = App.groupData?.group?.invite_code;
  if (!code) return;
  const link = `${location.origin}/?join=${code}`;
  navigator.clipboard.writeText(link)
    .then(() => showToast('🔗 Invite link copied!'))
    .catch(() => showToast(`Link: ${link}`));
};

window.joinViaCode = async function() {
  const code  = document.getElementById('join-code-input').value.trim().toUpperCase();
  const errEl = document.getElementById('err-join-code');
  errEl.style.display = 'none';

  if (!code) { errEl.style.display = 'flex'; errEl.textContent = '⚠ Enter an invite code.'; return; }

  try {
    const res  = await fetch('/api/groups/join', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ invite_code: code, name: 'New Member' }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      errEl.style.display = 'flex';
      errEl.textContent   = '⚠ ' + (data.error || 'Invalid code.');
      return;
    }
    showToast('✓ Joined group!');
    closeModal('modal-invite');
    await loadGroups();
    if (data.group) {
      App.currentGroupId = data.group.id;
      await loadGroupData(data.group.id);
      renderGroupSelector();
    }
  } catch (e) { console.error(e); errEl.style.display = 'flex'; errEl.textContent = '⚠ Network error.'; }
};

/* ══════════════════════════════════════
   CREATE GROUP
══════════════════════════════════════ */
window.setGroupType = function(type) {
  document.getElementById('new-grp-type').value = type;
  document.querySelectorAll('.group-type-btn').forEach(b => {
    const isActive = b.dataset.type === type;
    b.style.border     = isActive ? '2px solid #0d9488'    : '1.5px solid #e2e8f0';
    b.style.background = isActive ? '#f0fdfa'              : '#fff';
    const label = b.querySelector('div:last-child');
    if (label) { label.style.color = isActive ? '#0d9488' : '#64748b'; label.style.fontWeight = isActive ? '700' : '500'; }
  });
};

window.submitCreateGroup = async function() {
  const nameEl = document.getElementById('new-grp-name');
  const errEl  = document.getElementById('err-grp-name');
  const name   = nameEl.value.trim();
  errEl.style.display = 'none';

  if (!name) { nameEl.classList.add('error'); errEl.style.display = 'flex'; nameEl.focus(); return; }
  nameEl.classList.remove('error');

  try {
    const res = await fetch('/api/groups', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name,
        group_type:   document.getElementById('new-grp-type').value,
        currency:     document.getElementById('new-grp-currency').value,
        creator_name: document.getElementById('new-grp-creator').value.trim() || 'Admin',
      }),
    });
    if (!res.ok) { showToast('⚠ Could not create group', 'error'); return; }
    const newGroup = await res.json();
    showToast(`✓ Group "${name}" created!`);
    closeModal('modal-create-group');
    nameEl.value = '';
    await loadGroups();
    App.currentGroupId = newGroup.id;
    await loadGroupData(newGroup.id);
    renderGroupSelector();
    showApp();
  } catch (e) { console.error(e); showToast('⚠ Network error', 'error'); }
};

/* ══════════════════════════════════════
   MEMBERS TAB
══════════════════════════════════════ */
function renderMembersTab() {
  if (!App.groupData) return;
  const { group, members } = App.groupData;
  const sym       = group.currency_symbol || '₹';
  const avColors  = ['#c7d2fe','#fde68a','#99f6e4','#fecaca','#e9d5ff','#fed7aa'];
  const container = document.getElementById('members-full-list');

  if (!members.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">👥</div><h4>No members yet</h4><p>Add members to start tracking expenses.</p></div>`;
    return;
  }

  const roleBadge = { admin:'🔑 Admin', treasurer:'💰 Treasurer', member:'Member', viewer:'👁 Viewer' };

  container.innerHTML = members.map(m => {
    const bal     = m.net_balance_cents || 0;
    const fmt     = (Math.abs(bal) / 100).toFixed(2);
    const color   = bal > 0 ? '#059669' : bal < 0 ? '#dc2626' : '#94a3b8';
    const bg      = bal > 0 ? '#dcfce7' : bal < 0 ? '#fee2e2' : '#f1f5f9';
    const prefix  = bal > 0 ? '+' : bal < 0 ? '-' : '';
    const initials = m.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    const avBg    = avColors[m.name.charCodeAt(0) % avColors.length];
    return `
      <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:14px;">
          <div class="avatar" style="background:${avBg};color:#0f172a;font-size:14px;width:44px;height:44px;">${initials}</div>
          <div>
            <div style="font-size:15px;font-weight:700;color:#0f172a;">${escHtml(m.name)}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap;">
              <span style="font-size:12px;padding:2px 8px;background:#f1f5f9;border-radius:99px;color:#64748b;font-weight:500;">${roleBadge[m.role] || m.role}</span>
              ${m.email ? `<span style="font-size:12px;color:#94a3b8;">${escHtml(m.email)}</span>` : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <div style="text-align:right;">
            <div style="font-size:11px;color:#94a3b8;font-weight:500;">Paid</div>
            <div style="font-size:14px;font-weight:600;color:#0f172a;">${sym}${m.total_paid_formatted || '0.00'}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;color:#94a3b8;font-weight:500;">Share</div>
            <div style="font-size:14px;font-weight:600;color:#0f172a;">${sym}${m.total_share_formatted || '0.00'}</div>
          </div>
          <div style="text-align:right;min-width:80px;">
            <div style="font-size:11px;color:#94a3b8;font-weight:500;">Net Balance</div>
            <div style="padding:4px 10px;border-radius:99px;background:${bg};color:${color};font-size:13px;font-weight:700;margin-top:2px;">${prefix}${sym}${fmt}</div>
          </div>
          <div id="del-member-wrap-${m.id}">
            <button onclick="confirmRemoveMember('${m.id}','${escHtml(m.name)}')" class="btn-danger">Remove</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

window.confirmRemoveMember = function(id, name) {
  const wrap = document.getElementById(`del-member-wrap-${id}`);
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="delete-confirm-inline">
      <span style="font-size:12px;color:#dc2626;font-weight:600;">Remove ${escHtml(name)}?</span>
      <button onclick="executeRemoveMember('${id}')" style="padding:4px 10px;background:#dc2626;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Yes</button>
      <button onclick="renderMembersTab()" style="padding:4px 8px;background:#f1f5f9;color:#64748b;border:none;border-radius:6px;font-size:12px;cursor:pointer;">No</button>
    </div>`;
};

window.executeRemoveMember = async function(id) {
  try {
    const res  = await fetch(`/api/groups/${App.currentGroupId}/members/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) {
      showToast('⚠ ' + data.error, 'error');
      renderMembersTab(); // reset confirm UI
      return;
    }
    showToast('Member removed.');
    await loadGroupData(App.currentGroupId);
    renderMembersTab();
  } catch (e) { console.error(e); showToast('⚠ Network error', 'error'); }
};

/* ══════════════════════════════════════
   SETTLEMENTS
══════════════════════════════════════ */
window.setSettleMode = function(mode) {
  App.settleMode = mode;
  document.querySelectorAll('.settle-mode-btn').forEach(b => {
    const isActive = b.dataset.mode === mode;
    b.style.background  = isActive ? '#0d9488' : '#fff';
    b.style.color       = isActive ? '#fff'    : '#64748b';
    b.style.borderColor = isActive ? '#0d9488' : '#e2e8f0';
    b.style.fontWeight  = isActive ? '600'     : '500';
  });
  fetchSettlements(mode);
};

async function fetchSettlements(mode = 'greedy') {
  try {
    const res = await fetch(`/api/groups/${App.currentGroupId}/settlements?mode=${mode}`);
    if (!res.ok) throw new Error('Settlement API error');
    App.settlementData = await res.json();
    renderSettlements();
  } catch (e) { console.error(e); showToast('⚠ Could not load settlements', 'error'); }
}

function renderSettlements() {
  if (!App.settlementData) return;
  const { group, after_graph, before_graph, metrics, zero_sum_verified } = App.settlementData;
  const sym       = (group?.currency_symbol) || '₹';
  const transfers = (after_graph?.transfers) || [];

  // Stats
  document.getElementById('stat-transfers').textContent = after_graph?.transfers_count ?? '—';
  document.getElementById('stat-saved').textContent     = metrics?.transfers_saved ?? '—';
  const zsEl = document.getElementById('stat-zerosum');
  zsEl.textContent  = zero_sum_verified ? '✓' : '✗';
  zsEl.style.color  = zero_sum_verified ? '#0d9488' : '#dc2626';

  // Algorithm badge
  const badgeEl = document.getElementById('settle-algo-badge');
  if (badgeEl) {
    const isGreedy = App.settleMode === 'greedy';
    badgeEl.innerHTML = `<span class="algo-badge ${isGreedy ? 'greedy' : 'trust'}">
      ${isGreedy ? '⚡ O(N log N) Greedy Heap' : '🔗 Cycle-Canceling Flow'}
    </span>`;
  }

  // Draw graph
  drawDebtGraph(App.graphView);

  // Settlement cards
  const container = document.getElementById('settlement-cards');
  if (transfers.length === 0) {
    container.innerHTML = `
      <div class="card" style="padding:40px;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">🎉</div>
        <h3 style="font-size:17px;font-weight:700;color:#0f172a;">All Balanced!</h3>
        <p style="font-size:14px;color:#64748b;margin-top:6px;">Everyone in this group is settled. No transfers needed.</p>
      </div>`;
    return;
  }

  container.innerHTML = transfers.map((t, i) => `
    <div class="settlement-card" id="settle-card-${i}">
      <div style="display:flex;align-items:center;gap:5px;">
        <span style="font-size:12px;background:#f1f5f9;padding:3px 8px;border-radius:99px;color:#64748b;font-weight:600;">#${i+1}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex:1;justify-content:center;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:38px;height:38px;background:#fee2e2;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#dc2626;">${(t.from_name||'?')[0].toUpperCase()}</div>
          <div>
            <div style="font-size:14px;font-weight:600;color:#0f172a;">${escHtml(t.from_name)}</div>
            <div style="font-size:11px;color:#dc2626;font-weight:500;">pays</div>
          </div>
        </div>
        <div style="font-size:22px;color:#94a3b8;">→</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div>
            <div style="font-size:14px;font-weight:600;color:#0f172a;text-align:right;">${escHtml(t.to_name)}</div>
            <div style="font-size:11px;color:#059669;font-weight:500;text-align:right;">receives</div>
          </div>
          <div style="width:38px;height:38px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#059669;">${(t.to_name||'?')[0].toUpperCase()}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
        <div style="font-size:18px;font-weight:800;color:#0f172a;">${sym}${t.amount}</div>
        <button onclick="markPaid('${t.from_member_id}','${t.to_member_id}','${t.amount}')"
          style="padding:7px 14px;background:#f0fdfa;border:1.5px solid #99f6e4;color:#0d9488;border-radius:9px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">
          ✓ Mark Paid
        </button>
      </div>
    </div>`).join('');
}

/* ═══ Debt Graph Visualizer (SVG) ═══ */
window.switchGraphView = function(view) {
  App.graphView = view;
  document.querySelectorAll('.debt-graph-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.graph === view);
  });
  drawDebtGraph(view);
};

function drawDebtGraph(view) {
  const mount = document.getElementById('graph-svg-mount');
  if (!mount || !App.settlementData) return;

  const data    = view === 'after' ? App.settlementData.after_graph : App.settlementData.before_graph;
  const sym     = App.settlementData.group?.currency_symbol || '₹';
  const members = App.groupData?.members || [];

  // Normalize both before_graph (uses edges/from_id/to_id) and after_graph (uses transfers/from_member_id/to_member_id)
  const rawList = data?.transfers || data?.edges || [];
  const transfers = rawList.map(t => ({
    from_member_id: t.from_member_id || t.from_id,
    to_member_id:   t.to_member_id   || t.to_id,
    from_name:      t.from_name || '',
    to_name:        t.to_name   || '',
    amount:         t.amount,
    amount_cents:   t.amount_cents,
  })).filter(t => t.from_member_id && t.to_member_id);

  if (!transfers.length) {
    const isBefore = view === 'before';
    mount.innerHTML = `
      <div style="text-align:center;color:#94a3b8;padding:24px 0;">
        <div style="font-size:32px;margin-bottom:8px;">${isBefore ? '🤝' : '🎉'}</div>
        <div style="font-size:14px;font-weight:600;color:#374151;">${isBefore ? 'No raw debts found' : 'All settled!'}</div>
        <div style="font-size:13px;margin-top:4px;">No transfers needed.</div>
      </div>`;
    return;
  }

  // Consistent node ordering across Before and After views
  const groupMemberList = (App.settlementData.nodes && App.settlementData.nodes.length)
    ? App.settlementData.nodes
    : (members && members.length ? members : []);

  const activeIds = new Set();
  transfers.forEach(t => {
    activeIds.add(t.from_member_id);
    activeIds.add(t.to_member_id);
  });

  // Preserve group members order so node coordinates remain stable across view toggles
  let nodeArr = groupMemberList.filter(m => activeIds.has(m.id)).map(m => m.id);
  activeIds.forEach(id => {
    if (!nodeArr.includes(id)) nodeArr.push(id);
  });

  const n  = nodeArr.length;
  const W  = 560;
  const H  = Math.max(240, Math.min(320, n * 65));
  const cx = W / 2, cy = H / 2;
  const r  = Math.min(cx - 65, cy - 50);

  // Position nodes in a circle
  const positions = {};
  nodeArr.forEach((id, i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    positions[id] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  // Member name lookup
  const nameMap = {};
  members.forEach(m => { nameMap[m.id] = m.name; });
  (App.settlementData.nodes || []).forEach(m => { nameMap[m.id] = m.name; });
  transfers.forEach(t => {
    if (!nameMap[t.from_member_id]) nameMap[t.from_member_id] = t.from_name || t.from_member_id;
    if (!nameMap[t.to_member_id])   nameMap[t.to_member_id]   = t.to_name   || t.to_member_id;
  });

  const avColors    = ['#c7d2fe','#fde68a','#99f6e4','#fecaca','#e9d5ff','#fed7aa'];
  const isAfter     = view === 'after';
  const edgeColor   = isAfter ? '#0d9488' : '#d97706';
  const edgeOpacity = isAfter ? '0.95' : '0.85';

  // Draw edges (curves gracefully if reverse edge exists)
  const edges = transfers.map(t => {
    const from = positions[t.from_member_id];
    const to   = positions[t.to_member_id];
    if (!from || !to) return '';

    const dx = to.x - from.x, dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / dist, ny = dy / dist;
    const nodeR = 24;

    const x1 = from.x + nx * nodeR, y1 = from.y + ny * nodeR;
    const x2 = to.x   - nx * nodeR, y2 = to.y   - ny * nodeR;

    // Check if reverse edge exists between these two members to curve them apart
    const hasReverse = transfers.some(r => r.from_member_id === t.to_member_id && r.to_member_id === t.from_member_id);
    const curveOffset = hasReverse ? 18 : 0;

    const cpx = (x1 + x2) / 2 - ny * curveOffset;
    const cpy = (y1 + y2) / 2 + nx * curveOffset;

    // Midpoint on quadratic bezier curve at t = 0.5
    const mx = 0.25 * x1 + 0.5 * cpx + 0.25 * x2;
    const my = 0.25 * y1 + 0.5 * cpy + 0.25 * y2;

    const amt = typeof t.amount === 'number' ? t.amount.toFixed(2) : (parseFloat(t.amount || 0)).toFixed(2);
    const labelText = `${sym}${amt}`;
    const labelW = Math.max(50, labelText.length * 7.5 + 12);

    return `
      <path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cpx.toFixed(1)} ${cpy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"
        stroke="${edgeColor}" stroke-width="2.2" stroke-opacity="${edgeOpacity}" fill="none"
        marker-end="url(#arrow${isAfter ? 'T' : 'B'})" />
      <rect x="${(mx - labelW / 2).toFixed(1)}" y="${(my - 10).toFixed(1)}" width="${labelW}" height="20" rx="4"
        fill="#ffffff" stroke="${edgeColor}" stroke-width="1.2" fill-opacity="0.95"/>
      <text x="${mx.toFixed(1)}" y="${(my + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${edgeColor}">${labelText}</text>`;
  }).join('');

  // Draw nodes
  const nodes = nodeArr.map(id => {
    const p        = positions[id];
    if (!p) return '';
    const name     = nameMap[id] || id;
    const cleanName = name.replace(/\s*\(You\)/i, '');
    const initials = cleanName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || name.slice(0, 2).toUpperCase();
    const avBg     = avColors[name.charCodeAt(0) % avColors.length];
    const isMe     = name.toLowerCase().includes('(you)');
    const short    = isMe ? 'You' : cleanName.split(' ')[0].slice(0, 10);

    return `
      <g class="graph-node" data-id="${id}">
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="22" fill="${avBg}" stroke="${isMe ? '#0d9488' : edgeColor}" stroke-width="${isMe ? '2.5' : '1.5'}"/>
        <text x="${p.x.toFixed(1)}" y="${(p.y + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="#0f172a">${initials}</text>
        <text x="${p.x.toFixed(1)}" y="${(p.y + 36).toFixed(1)}" text-anchor="middle" font-size="11" fill="#475569" font-weight="${isMe ? '700' : '500'}">${short}</text>
      </g>`;
  }).join('');

  const count = transfers.length;
  const bound = Math.max(0, nodeArr.length - 1);
  const footerText = isAfter
    ? `✅ <strong>${count} optimised transfer${count !== 1 ? 's' : ''}</strong> (n–1 bound: ≤ ${bound})`
    : `⚠️ <strong>${count} raw IOU${count !== 1 ? 's' : ''}</strong> before simplification`;

  mount.innerHTML = `
    <div style="width:100%;display:flex;flex-direction:column;align-items:center;">
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="overflow:visible;max-width:${W}px;">
        <defs>
          <marker id="arrowT" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#0d9488"/>
          </marker>
          <marker id="arrowB" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#d97706"/>
          </marker>
        </defs>
        ${edges}
        ${nodes}
      </svg>
      <div style="text-align:center;margin-top:10px;font-size:12px;color:#64748b;">
        ${footerText}
      </div>
    </div>`;
}

/* ═══ Mark Paid ═══ */
window.markPaid = async function(fromId, toId, amount) {
  try {
    const res = await fetch(`/api/groups/${App.currentGroupId}/settlements/pay`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from_member_id: fromId, to_member_id: toId, amount, payment_method: 'UPI' }),
    });
    if (res.ok) {
      showToast('✓ Payment recorded!');
      await loadGroupData(App.currentGroupId);
      await fetchSettlements(App.settleMode);
    }
  } catch (e) { console.error(e); showToast('⚠ Could not record payment', 'error'); }
};

/* ═══ WhatsApp Export ═══ */
window.copyWhatsApp = async function() {
  try {
    const res  = await fetch(`/api/groups/${App.currentGroupId}/export/whatsapp`);
    const data = await res.json();
    await navigator.clipboard.writeText(data.text);
    showToast('📋 WhatsApp summary copied!');
  } catch (e) { showToast('⚠ Could not copy. Please try again.', 'error'); }
};

/* ══════════════════════════════════════
   SHOW THE MATH DRAWER
══════════════════════════════════════ */
window.openMathDrawer = function() {
  if (!App.settlementData) {
    fetchSettlements(App.settleMode).then(() => _openMathDrawer());
  } else {
    _openMathDrawer();
  }
};

function _openMathDrawer() {
  const overlay = document.getElementById('math-drawer-overlay');
  const panel   = document.getElementById('math-drawer-panel');
  overlay.style.opacity       = '1';
  overlay.style.pointerEvents = 'all';
  panel.style.transform       = 'translateX(0)';
  renderMathDrawer();
}

window.closeMathDrawer = function() {
  const overlay = document.getElementById('math-drawer-overlay');
  const panel   = document.getElementById('math-drawer-panel');
  panel.style.transform = 'translateX(100%)';
  setTimeout(() => { overlay.style.opacity = '0'; overlay.style.pointerEvents = 'none'; }, 300);
};

function renderMathDrawer() {
  const data     = App.settlementData;
  if (!data) return;
  const sym      = data.group?.currency_symbol || '₹';
  const trace    = data.math_trace   || {};
  const metrics  = data.metrics      || {};
  const steps    = trace.steps       || [];
  const netTable = data.net_balances_table || [];

  document.getElementById('math-drawer-body').innerHTML = `
    <!-- Zero-sum proof -->
    <div style="background:#f0fdfa;border:1.5px solid #99f6e4;border-radius:14px;padding:16px 18px;margin-bottom:20px;display:flex;gap:12px;align-items:flex-start;">
      <div style="width:32px;height:32px;background:#0d9488;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;flex-shrink:0;">✓</div>
      <div>
        <div style="font-weight:700;color:#0f766e;font-size:14px;">Zero-Sum Invariant: Σ Net Balances = ${sym}0.00</div>
        <div style="font-size:13px;color:#0f766e;margin-top:4px;line-height:1.6;">
          Money is never created or lost: <code style="background:#fff;padding:2px 6px;border-radius:5px;font-size:12px;">Σ (Paid − Share) ≡ 0</code>.
          All arithmetic uses <strong>exact integer units (paise/cents)</strong> — no floating-point errors.
        </div>
      </div>
    </div>

    <!-- Transfer reduction stats -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:#94a3b8;font-weight:500;text-transform:uppercase;letter-spacing:1px;">n–1 Bound</div>
        <div style="font-size:22px;font-weight:800;color:#0d9488;margin:4px 0;">${metrics.max_theoretical_transfers ?? '—'}</div>
        <div style="font-size:11px;color:#94a3b8;">max transfers</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:#94a3b8;font-weight:500;text-transform:uppercase;letter-spacing:1px;">Actual</div>
        <div style="font-size:22px;font-weight:800;color:#059669;margin:4px 0;">${data.after_graph?.transfers_count ?? '—'}</div>
        <div style="font-size:11px;color:#94a3b8;">transfers used</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:11px;color:#94a3b8;font-weight:500;text-transform:uppercase;letter-spacing:1px;">Reduction</div>
        <div style="font-size:22px;font-weight:800;color:#7c3aed;margin:4px 0;">${metrics.friction_reduction_pct ?? '—'}%</div>
        <div style="font-size:11px;color:#94a3b8;">fewer transfers</div>
      </div>
    </div>

    <!-- Net Balance Table -->
    <div style="margin-bottom:20px;">
      <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:10px;">1. Net Balance Vector</div>
      <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
              <th style="padding:10px 14px;text-align:left;font-weight:600;color:#64748b;">Member</th>
              <th style="padding:10px 14px;text-align:right;font-weight:600;color:#64748b;">Paid</th>
              <th style="padding:10px 14px;text-align:right;font-weight:600;color:#64748b;">Share</th>
              <th style="padding:10px 14px;text-align:right;font-weight:600;color:#64748b;">Net</th>
            </tr>
          </thead>
          <tbody>
            ${netTable.map(row => {
              const net = parseFloat(row.net);
              return `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 14px;font-weight:500;color:#0f172a;">${escHtml(row.name)}</td>
                <td style="padding:10px 14px;text-align:right;color:#64748b;">${sym}${row.paid}</td>
                <td style="padding:10px 14px;text-align:right;color:#64748b;">${sym}${row.share}</td>
                <td style="padding:10px 14px;text-align:right;font-weight:700;color:${net>0?'#059669':net<0?'#dc2626':'#94a3b8'};">
                  ${net>0?'+':''}${sym}${row.net}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Algorithm Steps -->
    <div style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <div style="font-weight:700;font-size:14px;color:#0f172a;">2. Algorithm Steps</div>
        <div style="display:flex;gap:8px;">
          <span style="padding:3px 10px;background:#dcfce7;color:#15803d;border-radius:99px;font-size:12px;font-weight:600;">${escHtml(trace.algorithm || 'Greedy Priority Queues')}</span>
          <span style="padding:3px 10px;background:#ede9fe;color:#7c3aed;border-radius:99px;font-size:12px;font-weight:600;">${escHtml(trace.time_complexity || 'O(N log N)')}</span>
        </div>
      </div>
      ${steps.length === 0
        ? `<div style="text-align:center;padding:24px;background:#f0fdfa;border-radius:12px;color:#0d9488;font-weight:600;">🎉 No steps needed — all balances are already zero!</div>`
        : steps.map(s => `
          <div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;margin-bottom:8px;display:flex;align-items:flex-start;gap:12px;">
            <div class="step-num">${s.step}</div>
            <div style="flex:1;">
              <div style="font-size:13px;color:#374151;line-height:1.5;">${escHtml(s.explanation)}</div>
              <div style="font-size:14px;font-weight:800;color:#0d9488;margin-top:4px;">${sym}${s.settled_amount || s.amount}</div>
            </div>
          </div>`).join('')
      }
    </div>

    <!-- Graph Theory Section -->
    <div style="background:#fafafa;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
      <div style="font-weight:600;font-size:13px;color:#0f172a;margin-bottom:8px;">Graph Theory Properties</div>
      <ul style="font-size:13px;color:#64748b;padding-left:16px;line-height:2.2;">
        <li><b>DAG Guarantee:</b> Output settlement graph has zero directed cycles.</li>
        <li><b>n − 1 Bound:</b> At most <i>n − 1</i> transactions for <i>n</i> participants.</li>
        <li><b>Zero-Sum:</b> Σ Net Balances = 0 always holds (integer arithmetic).</li>
        <li><b>Trust-Preserving Mode:</b> Cycle-canceling respects existing IOU relationships.</li>
      </ul>
    </div>`;
}

/* ══════════════════════════════════════
   SPECIAL MODULE TAB
══════════════════════════════════════ */
function updateSpecialTabLabel() {
  const labels = {
    hostel:'🏠 Flatmate Tools', club:'🎓 Club Budget', office:'💼 Reimbursements', travel:'✈️ Travel Ledger'
  };
  const btn = document.querySelector('.nav-tab[data-tab="special"]');
  if (btn) btn.textContent = labels[App.currentGroupType] || '✨ Special';
}

async function renderSpecialTab() {
  if (!App.groupData) return;
  const { group, members } = App.groupData;
  const mount = document.getElementById('special-module-mount');
  const type  = group.group_type;

  if (type === 'hostel') {
    document.getElementById('special-tab-title').textContent = '🏠 Flatmate & Utility Tools';
    document.getElementById('special-tab-desc').textContent  = 'Days-stayed splits, move-out calculators, monthly bill templates.';
    renderHostelSpecial(group, members, mount);
  } else if (type === 'club') {
    document.getElementById('special-tab-title').textContent = '🎓 Club Budget & Approvals';
    document.getElementById('special-tab-desc').textContent  = 'Track event budget, approve expenses, and manage sponsors.';
    await renderClubSpecial(group, mount);
  } else if (type === 'office') {
    document.getElementById('special-tab-title').textContent = '💼 Corporate Reimbursements';
    document.getElementById('special-tab-desc').textContent  = 'Generate audit-ready expense ledger by project and cost centre.';
    await renderOfficeSpecial(group, mount);
  } else {
    mount.innerHTML = `
      <div class="card" style="padding:40px;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">✨</div>
        <h3 style="font-size:16px;font-weight:700;color:#0f172a;">Special Modules</h3>
        <p style="font-size:14px;color:#94a3b8;margin-top:6px;line-height:1.6;">
          Advanced tools are available for <b>Flatmate</b>, <b>Club</b>, and <b>Office</b> groups.<br>
          Create a group with one of those types to unlock these features.
        </p>
        <button onclick="openModal('modal-create-group')" style="margin-top:20px;padding:10px 24px;background:#0d9488;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">+ Create Specialised Group</button>
      </div>`;
  }
}

/* ─── Hostel Special ─── */
function renderHostelSpecial(group, members, mount) {
  const sym = group.currency_symbol || '₹';
  mount.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <!-- Move-Out Calculator -->
      <div class="card" style="padding:22px;">
        <h4 style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px;">📦 Roommate Move-Out Settlement</h4>
        <p style="font-size:13px;color:#94a3b8;margin-bottom:16px;">Calculate final payout including deposit, pending bills, and damages.</p>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px;">
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Leaving Member</label>
            <select id="moveout-member" class="form-input" style="font-size:13px;padding:8px 12px;">
              ${members.map(m => `<option value="${m.id}">${escHtml(m.name)} (${sym}${m.net_balance_formatted || '0.00'})</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Security Deposit Refund (${sym})</label>
            <input type="number" id="moveout-deposit" value="2000" class="form-input" style="font-size:13px;padding:8px 12px;" />
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Pending Utilities (${sym})</label>
            <input type="number" id="moveout-utilities" value="400" class="form-input" style="font-size:13px;padding:8px 12px;" />
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Damage / Cleaning (${sym})</label>
            <input type="number" id="moveout-damage" value="0" class="form-input" style="font-size:13px;padding:8px 12px;" />
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <button onclick="calcMoveOut('${group.id}','${sym}')" style="padding:10px 20px;background:#0d9488;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">Calculate Final Payout</button>
          <div id="moveout-result" style="font-size:14px;font-weight:700;color:#0d9488;"></div>
        </div>
      </div>

      <!-- Days-Stayed Split Info -->
      <div class="card" style="padding:22px;">
        <h4 style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:8px;">📅 Days-Stayed Split</h4>
        <p style="font-size:13px;color:#64748b;line-height:1.6;margin-bottom:12px;">
          When adding a shared expense, choose the <b>"📅 Days"</b> split method to split proportionally based on how many days each person stayed. Enter each person's days in the member checklist.
        </p>
        <button onclick="openAddExpenseModal()" style="padding:9px 20px;background:#0d9488;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;">+ Add Days-Based Expense</button>
      </div>

      <!-- Quick Bill Templates -->
      <div class="card" style="padding:22px;">
        <h4 style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:12px;">⚡ Quick Monthly Bill Entry</h4>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
          ${[['🏠','Apartment Rent','Rent'],['⚡','Electricity Bill','Utilities'],['📶','WiFi / Internet','Utilities'],['🧹','Maid & Cook','General']].map(([icon,label,cat]) => `
            <button onclick="openAddExpenseModal('${label}')"
              style="padding:14px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;text-align:left;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all 0.15s;"
              onmouseover="this.style.borderColor='#0d9488'" onmouseout="this.style.borderColor='#e2e8f0'">
              <span style="font-size:22px;">${icon}</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:#0f172a;">${label}</div>
                <div style="font-size:11px;color:#94a3b8;">${cat} · Monthly</div>
              </div>
            </button>`).join('')}
        </div>
      </div>
    </div>`;
}

window.calcMoveOut = async function(groupId, sym) {
  const memberId  = document.getElementById('moveout-member').value;
  const deposit   = document.getElementById('moveout-deposit').value;
  const utilities = document.getElementById('moveout-utilities').value;
  const damage    = document.getElementById('moveout-damage').value;
  try {
    const res  = await fetch(`/api/groups/${groupId}/special/hostel/move-out?member_id=${memberId}&security_deposit=${deposit}&pending_utilities=${utilities}&damage_charges=${damage}`);
    const data = await res.json();
    const el   = document.getElementById('moveout-result');
    if (el) {
      el.textContent = data.summary_text || 'Calculation complete.';
      el.style.color = data.direction === 'ROOMMATE_RECEIVES' ? '#059669' : '#dc2626';
    }
  } catch (e) { console.error(e); showToast('⚠ Could not calculate', 'error'); }
};

/* ─── Club Special ─── */
async function renderClubSpecial(group, mount) {
  try {
    const res     = await fetch(`/api/groups/${group.id}/special/club/budget`);
    const data    = await res.json();
    const sym     = group.currency_symbol || '₹';
    const budgets = data.budgets    || {};
    const sponsors = data.sponsors_list  || [];
    const pending  = data.pending_approvals || [];

    mount.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <!-- Budget Tracker -->
        <div class="card" style="padding:22px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
            <h4 style="font-size:15px;font-weight:700;color:#0f172a;">📊 Budget vs Actual</h4>
            <span style="font-size:14px;font-weight:700;color:${(budgets.overall_utilization_pct||0)>100?'#dc2626':'#059669'};">
              ${budgets.overall_utilization_pct||0}% utilized
            </span>
          </div>
          <div class="progress-bar-track" style="margin-bottom:16px;">
            <div class="progress-bar-fill" style="width:${Math.min(100,budgets.overall_utilization_pct||0)}%;${(budgets.overall_utilization_pct||0)>100?'background:#dc2626;':''}"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            ${(budgets.categories||[]).map(cat => `
              <div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px;">
                <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:#0f172a;">${escHtml(cat.category)}<span style="color:${cat.status==='OVER_BUDGET'?'#dc2626':'#059669'}">${cat.utilization_pct}%</span></div>
                <div class="progress-bar-track" style="margin:6px 0;height:4px;">
                  <div class="progress-bar-fill" style="width:${Math.min(100,cat.utilization_pct)}%;height:4px;${cat.status==='OVER_BUDGET'?'background:#dc2626;':''}"></div>
                </div>
                <div style="font-size:11px;color:#94a3b8;">Budget: ${sym}${cat.allocated_formatted} · Actual: ${sym}${cat.actual_formatted}</div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Pending Approvals -->
        <div class="card" style="padding:22px;">
          <h4 style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:12px;">
            ⏳ Pending Approvals
            ${pending.length>0?`<span style="margin-left:8px;padding:2px 8px;background:#fef3c7;color:#92400e;border-radius:99px;font-size:12px;">${pending.length}</span>`:''}
          </h4>
          ${pending.length===0
            ? `<p style="font-size:13px;color:#94a3b8;">All expenses have been reviewed. ✓</p>`
            : pending.map(p => `
              <div style="border:1px solid #fed7aa;background:#fffbeb;border-radius:12px;padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                <div>
                  <div style="font-size:13px;font-weight:600;color:#0f172a;">${escHtml(p.title)}</div>
                  <div style="font-size:12px;color:#94a3b8;">${sym}${p.amount_formatted} · ${escHtml(p.category)}</div>
                </div>
                <div style="display:flex;gap:8px;">
                  <button onclick="approveExpense('${group.id}','${p.id}','approved')" style="padding:7px 14px;background:#0d9488;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">✓ Approve</button>
                  <button onclick="approveExpense('${group.id}','${p.id}','rejected')" style="padding:7px 14px;background:#fff;border:1.5px solid #fecaca;color:#dc2626;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">✗ Reject</button>
                </div>
              </div>`).join('')}
        </div>

        <!-- Sponsors -->
        <div class="card" style="padding:22px;">
          <h4 style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:12px;">🤝 Sponsor Funds</h4>
          ${sponsors.length===0
            ? `<p style="font-size:13px;color:#94a3b8;">No sponsors recorded.</p>`
            : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;">
              ${sponsors.map(s => `
                <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;">
                  <div style="font-size:13px;font-weight:700;color:#0f172a;">${escHtml(s.name)}</div>
                  <div style="font-size:12px;color:#94a3b8;margin-top:3px;">Committed: ${sym}${(s.committed_cents/100).toFixed(2)}</div>
                  <div style="font-size:13px;font-weight:600;color:#059669;margin-top:2px;">Received: ${sym}${(s.received_cents/100).toFixed(2)}</div>
                </div>`).join('')}
            </div>`}
        </div>
      </div>`;
  } catch (e) { console.error(e); mount.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h4>Could not load club data</h4></div>`; }
}

window.approveExpense = async function(groupId, expId, status) {
  try {
    await fetch(`/api/groups/${groupId}/special/club/approve`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ expense_id: expId, status, approved_by: 'Treasurer' }),
    });
    showToast(status === 'approved' ? '✓ Approved!' : '✗ Rejected.');
    await renderSpecialTab();
  } catch (e) { console.error(e); }
};

/* ─── Office Special ─── */
async function renderOfficeSpecial(group, mount) {
  try {
    const res  = await fetch(`/api/groups/${group.id}/special/office/reimbursements`);
    const data = await res.json();
    const sym  = group.currency_symbol || '₹';
    const ledger = data.ledger || [];

    mount.innerHTML = `
      <div class="card" style="padding:22px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
          <div>
            <h4 style="font-size:15px;font-weight:700;color:#0f172a;">💼 Reimbursement Ledger</h4>
            <p style="font-size:13px;color:#94a3b8;margin-top:2px;">Total reimbursable: <b style="color:#0d9488;">${sym}${data.total_reimbursable_formatted}</b></p>
          </div>
          <button onclick="window.print()" style="padding:9px 18px;background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;font-weight:500;color:#475569;cursor:pointer;">🖨️ Export PDF</button>
        </div>
        ${ledger.length === 0
          ? `<div class="empty-state"><div class="icon">📋</div><h4>No reimbursable expenses</h4><p>Expenses with project tags will appear here.</p></div>`
          : `<div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:560px;">
              <thead>
                <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
                  <th style="padding:10px 14px;text-align:left;font-weight:600;color:#64748b;">Date</th>
                  <th style="padding:10px 14px;text-align:left;font-weight:600;color:#64748b;">Employee</th>
                  <th style="padding:10px 14px;text-align:left;font-weight:600;color:#64748b;">Description</th>
                  <th style="padding:10px 14px;text-align:left;font-weight:600;color:#64748b;">Project</th>
                  <th style="padding:10px 14px;text-align:right;font-weight:600;color:#64748b;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${ledger.map(row => `
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px 14px;color:#94a3b8;font-size:12px;">${row.date}</td>
                    <td style="padding:10px 14px;font-weight:500;color:#0f172a;">${escHtml(row.employee_name)}</td>
                    <td style="padding:10px 14px;color:#374151;">${escHtml(row.title)}</td>
                    <td style="padding:10px 14px;"><span style="padding:2px 8px;background:#ede9fe;color:#7c3aed;border-radius:99px;font-size:11px;font-weight:600;">${escHtml(row.project_tag||'—')}</span></td>
                    <td style="padding:10px 14px;text-align:right;font-weight:700;color:#0f172a;">${sym}${row.amount_formatted}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
      </div>`;
  } catch (e) { console.error(e); mount.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h4>Could not load reimbursement data</h4></div>`; }
}

/* ══════════════════════════════════════
   PUBLIC REPORT TAB
══════════════════════════════════════ */
async function renderPublicReport() {
  if (!App.groupData) return;
  const code  = App.groupData.group.invite_code;
  const mount = document.getElementById('public-report-mount');

  try {
    const res  = await fetch(`/api/public/report/${code}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const sym  = data.currency_symbol || '₹';

    mount.innerHTML = `
      <div class="card" style="padding:28px;max-width:700px;margin:0 auto;">
        <div style="border-bottom:1px solid #f1f5f9;padding-bottom:16px;margin-bottom:20px;">
          <div style="font-size:11px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Public Transparency Report</div>
          <h2 style="font-size:22px;font-weight:800;color:#0f172a;">${escHtml(data.group_name)}</h2>
          <div style="display:flex;align-items:center;gap:16px;margin-top:8px;flex-wrap:wrap;">
            <span style="font-size:14px;color:#64748b;">${data.members_count} members</span>
            <span style="font-size:18px;font-weight:700;color:#0d9488;">Total: ${sym}${data.total_spending_formatted}</span>
          </div>
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
            <button onclick="copyInviteLink()" style="padding:7px 14px;background:#f0fdfa;color:#0d9488;border:1.5px solid #99f6e4;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">🔗 Copy Link</button>
            <button onclick="window.print()" style="padding:7px 14px;background:#f8fafc;color:#64748b;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;">🖨️ Print</button>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;">
          <h4 style="font-size:14px;font-weight:600;color:#374151;margin-bottom:4px;">Verified Expenses</h4>
          ${(data.expenses||[]).length === 0
            ? `<p style="font-size:13px;color:#94a3b8;">No expenses yet.</p>`
            : (data.expenses||[]).map(e => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border:1px solid #f1f5f9;border-radius:10px;gap:10px;">
                <div>
                  <div style="font-size:13px;font-weight:600;color:#0f172a;">${escHtml(e.title)}</div>
                  <div style="font-size:11px;color:#94a3b8;">${escHtml(e.category||'')} · ${e.expense_date||''}</div>
                </div>
                <span style="font-size:14px;font-weight:700;color:#0f172a;">${sym}${e.amount_formatted}</span>
              </div>`).join('')}
        </div>

        <div style="margin-top:20px;border-top:1px solid #f1f5f9;padding-top:14px;text-align:center;font-size:12px;color:#94a3b8;">
          🔒 Zero-sum verified ledger · Powered by FairSplit Flow
        </div>
      </div>`;
  } catch (e) {
    mount.innerHTML = `<div class="empty-state"><div class="icon">🌐</div><h4>Report unavailable</h4><p>Could not load the public report.</p></div>`;
  }
}

/* ══════════════════════════════════════
   UTILITY HELPERS
══════════════════════════════════════ */
/** Escape HTML to prevent XSS */
function escHtml(str) {
  if (typeof str !== 'string') return str ?? '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/** Format cents to currency string */
function fmtCents(cents, sym = '₹') {
  return sym + (Math.abs(cents) / 100).toFixed(2);
}
