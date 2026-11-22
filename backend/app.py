"""
FairSplit Flow - Backend Application Server
===========================================
Production-ready REST API & static server for FairSplit Flow.
Implements all core mathematical graph algorithms, special modules,
settlement exports, and public reporting.
"""

import os
import uuid
import json
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, Response

from database import get_db, query_all, query_one, execute_write, log_activity, DB_PATH, init_db
from seed_data import seed_demo_data
from engine.debt_engine import DebtEngine
from engine.special_modules import SpecialModulesEngine

# Serve static frontend files from ../frontend
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

app = Flask(__name__, static_folder=FRONTEND_DIR)

# Auto-initialize database tables and demo seed data on startup
init_db()
seed_demo_data()

# CORS Header Middleware
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

# Handle preflight OPTIONS
@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    return Response(status=200)

# ==========================================
# 1. GROUP MANAGEMENT ENDPOINTS
# ==========================================

@app.route('/api/groups', methods=['GET'])
def get_groups():
    groups = query_all("SELECT * FROM groups ORDER BY created_at DESC")
    for g in groups:
        members_count = query_one("SELECT COUNT(*) as count FROM members WHERE group_id = ? AND is_active = 1", (g['id'],))
        expenses_sum = query_one("SELECT COALESCE(SUM(amount_cents), 0) as total FROM expenses WHERE group_id = ? AND status != 'rejected'", (g['id'],))
        g['members_count'] = members_count['count'] if members_count else 0
        g['total_spent_cents'] = expenses_sum['total'] if expenses_sum else 0
        g['total_spent_formatted'] = DebtEngine.to_currency(g['total_spent_cents'])
    return jsonify(groups)

@app.route('/api/groups', methods=['POST'])
def create_group():
    data = request.json or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Group name is required'}), 400

    group_id = f"grp_{uuid.uuid4().hex[:8]}"
    group_type = data.get('group_type', 'travel')
    currency = data.get('currency', 'INR')
    currency_symbols = {'INR': '₹', 'USD': '$', 'EUR': '€', 'GBP': '£', 'AED': 'AED '}
    currency_symbol = currency_symbols.get(currency, '₹')
    invite_code = uuid.uuid4().hex[:6].upper()
    created_by = data.get('user_id', 'user_sankalp')
    now = datetime.now().isoformat()

    execute_write(
        "INSERT INTO groups (id, name, group_type, currency, currency_symbol, invite_code, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (group_id, name, group_type, currency, currency_symbol, invite_code, created_by, now)
    )

    # Add creator as Admin
    creator_member_id = f"m_{uuid.uuid4().hex[:8]}"
    creator_name = data.get('creator_name', 'You (Admin)')
    creator_email = data.get('creator_email', 'admin@fairsplit.flow')
    creator_avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={creator_name}"
    execute_write(
        "INSERT INTO members (id, group_id, user_id, name, email, avatar, role, joined_at) VALUES (?, ?, ?, ?, ?, ?, 'admin', ?)",
        (creator_member_id, group_id, created_by, creator_name, creator_email, creator_avatar, now)
    )

    # Add any initial members provided in payload
    initial_members = data.get('initial_members', [])
    for m in initial_members:
        m_name = m.get('name', '').strip()
        if m_name:
            m_id = f"m_{uuid.uuid4().hex[:8]}"
            m_avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={m_name}"
            execute_write(
                "INSERT INTO members (id, group_id, name, email, avatar, role, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (m_id, group_id, m_name, m.get('email', ''), m_avatar, m.get('role', 'member'), now)
            )

    log_activity(group_id, creator_name, "CREATE_GROUP", f"Created group '{name}' with type {group_type}")
    new_group = query_one("SELECT * FROM groups WHERE id = ?", (group_id,))
    return jsonify(new_group), 201

@app.route('/api/groups/join', methods=['POST'])
def join_group():
    data = request.json or {}
    invite_code = data.get('invite_code', '').strip().upper()
    name = data.get('name', '').strip() or 'New Guest'
    email = data.get('email', '').strip()

    group = query_one("SELECT * FROM groups WHERE invite_code = ?", (invite_code,))
    if not group:
        return jsonify({'error': 'Invalid invite code'}), 404

    # Check if member already exists
    existing = query_one("SELECT * FROM members WHERE group_id = ? AND (email = ? OR name = ?)", (group['id'], email, name))
    if existing:
        return jsonify({'message': 'Already a member of this group', 'group': group, 'member': existing})

    member_id = f"m_{uuid.uuid4().hex[:8]}"
    avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={name}"
    now = datetime.now().isoformat()
    execute_write(
        "INSERT INTO members (id, group_id, name, email, avatar, role, joined_at) VALUES (?, ?, ?, ?, ?, 'member', ?)",
        (member_id, group['id'], name, email, avatar, now)
    )
    log_activity(group['id'], name, "JOIN_GROUP", f"{name} joined via invite code")
    new_member = query_one("SELECT * FROM members WHERE id = ?", (member_id,))
    return jsonify({'group': group, 'member': new_member}), 200

@app.route('/api/groups/<group_id>', methods=['GET'])
def get_group_details(group_id):
    group = query_one("SELECT * FROM groups WHERE id = ?", (group_id,))
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    members = query_all("SELECT * FROM members WHERE group_id = ? AND is_active = 1 ORDER BY joined_at ASC", (group_id,))
    members_map = {m['id']: m for m in members}

    expenses = query_all("SELECT * FROM expenses WHERE group_id = ? ORDER BY expense_date DESC, created_at DESC", (group_id,))
    for exp in expenses:
        exp['amount_formatted'] = DebtEngine.to_currency(exp['amount_cents'])
        exp['payer_name'] = members_map.get(exp['paid_by'], {}).get('name', 'Unknown')
        exp['payer_avatar'] = members_map.get(exp['paid_by'], {}).get('avatar', '')
        shares = query_all("SELECT * FROM expense_shares WHERE expense_id = ?", (exp['id'],))
        for s in shares:
            s['share_formatted'] = DebtEngine.to_currency(s['share_cents'])
            s['member_name'] = members_map.get(s['member_id'], {}).get('name', 'Unknown')
        exp['shares'] = shares

    settlements = query_all("SELECT * FROM settlements WHERE group_id = ? ORDER BY settled_at DESC", (group_id,))
    for s in settlements:
        s['amount_formatted'] = DebtEngine.to_currency(s['amount_cents'])
        s['from_name'] = members_map.get(s['from_member_id'], {}).get('name', 'Unknown')
        s['to_name'] = members_map.get(s['to_member_id'], {}).get('name', 'Unknown')

    # Compute Net Balances
    net_bals, total_paid, total_share = DebtEngine.build_net_balances(members, expenses, settlements)

    members_with_balances = []
    for m in members:
        m_copy = dict(m)
        bal_cents = net_bals.get(m['id'], 0)
        m_copy['net_balance_cents'] = bal_cents
        m_copy['net_balance_formatted'] = DebtEngine.to_currency(bal_cents)
        m_copy['total_paid_cents'] = total_paid.get(m['id'], 0)
        m_copy['total_paid_formatted'] = DebtEngine.to_currency(total_paid.get(m['id'], 0))
        m_copy['total_share_cents'] = total_share.get(m['id'], 0)
        m_copy['total_share_formatted'] = DebtEngine.to_currency(total_share.get(m['id'], 0))
        members_with_balances.append(m_copy)

    # Activity Logs
    activity = query_all("SELECT * FROM activity_logs WHERE group_id = ? ORDER BY created_at DESC LIMIT 30", (group_id,))

    return jsonify({
        'group': group,
        'members': members_with_balances,
        'expenses': expenses,
        'settlements': settlements,
        'activity': activity,
        'zero_sum_verified': sum(net_bals.values()) == 0,
        'total_spent_cents': sum(e['amount_cents'] for e in expenses if e.get('status') != 'rejected'),
        'total_spent_formatted': DebtEngine.to_currency(sum(e['amount_cents'] for e in expenses if e.get('status') != 'rejected'))
    })

# ==========================================
# 2. MEMBERS ENDPOINTS
# ==========================================

@app.route('/api/groups/<group_id>/members', methods=['POST'])
def add_member(group_id):
    data = request.json or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Member name is required'}), 400

    member_id = f"m_{uuid.uuid4().hex[:8]}"
    avatar = data.get('avatar') or f"https://api.dicebear.com/7.x/avataaars/svg?seed={name}"
    role = data.get('role', 'member')
    email = data.get('email', '').strip()
    now = datetime.now().isoformat()

    execute_write(
        "INSERT INTO members (id, group_id, name, email, avatar, role, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (member_id, group_id, name, email, avatar, role, now)
    )
    log_activity(group_id, name, "ADD_MEMBER", f"Added member '{name}' with role {role}")
    member = query_one("SELECT * FROM members WHERE id = ?", (member_id,))
    return jsonify(member), 201

@app.route('/api/groups/<group_id>/members/<member_id>', methods=['DELETE'])
def remove_member(group_id, member_id):
    # Check if member has non-zero balance
    members = query_all("SELECT * FROM members WHERE group_id = ?", (group_id,))
    expenses = query_all("SELECT * FROM expenses WHERE group_id = ?", (group_id,))
    for exp in expenses:
        exp['shares'] = query_all("SELECT * FROM expense_shares WHERE expense_id = ?", (exp['id'],))
    settlements = query_all("SELECT * FROM settlements WHERE group_id = ?", (group_id,))
    net_bals, _, _ = DebtEngine.build_net_balances(members, expenses, settlements)

    bal = net_bals.get(member_id, 0)
    if bal != 0:
        return jsonify({
            'error': f'Cannot remove member with unsettled balance ({DebtEngine.to_currency(bal)}). Please settle first.'
        }), 400

    member = query_one("SELECT name FROM members WHERE id = ?", (member_id,))
    name = member['name'] if member else 'Member'
    execute_write("UPDATE members SET is_active = 0 WHERE id = ?", (member_id,))
    log_activity(group_id, name, "REMOVE_MEMBER", f"Removed member '{name}' from active list")
    return jsonify({'success': True, 'message': f'Member {name} removed.'})

# ==========================================
# 3. EXPENSES ENDPOINTS
# ==========================================

@app.route('/api/groups/<group_id>/expenses', methods=['POST'])
def add_expense(group_id):
    data = request.json or {}
    title = data.get('title', '').strip()
    amount_raw = data.get('amount')
    paid_by = data.get('paid_by')

    if not title:
        return jsonify({'error': 'Expense title is required'}), 400
    if not amount_raw or float(amount_raw) <= 0:
        return jsonify({'error': 'Valid positive amount is required'}), 400
    if not paid_by:
        return jsonify({'error': 'Paid by member is required'}), 400

    amount_cents = DebtEngine.to_cents(amount_raw)
    split_type = data.get('split_type', 'equal')
    mode = data.get('mode', 'shared')  # 'shared' or 'individual'
    category = data.get('category', 'General')
    expense_date = data.get('expense_date') or datetime.now().strftime("%Y-%m-%d")
    notes = data.get('notes', '')
    recurring = data.get('recurring_frequency', 'none')
    project_tag = data.get('project_tag', '')
    cost_center = data.get('cost_center', '')
    status = data.get('status', 'approved')

    # Selected members for this expense
    selected_member_ids = data.get('selected_members', [])
    if not selected_member_ids:
        # Default to all active members in group
        active_members = query_all("SELECT id FROM members WHERE group_id = ? AND is_active = 1", (group_id,))
        selected_member_ids = [m['id'] for m in active_members]

    # Calculate exact shares using the engine
    split_data = data.get('split_data', {})
    # Normalize split_type aliases for the engine
    _split_type_map = {'days': 'days_stayed', 'percent': 'percentage', 'shares': 'shares'}
    engine_split_type = _split_type_map.get(split_type, split_type)
    calculated_shares = DebtEngine.calculate_shares(amount_cents, engine_split_type, selected_member_ids, split_data)

    expense_id = f"exp_{uuid.uuid4().hex[:8]}"
    now = datetime.now().isoformat()

    execute_write("""
        INSERT INTO expenses (id, group_id, title, category, amount_cents, paid_by, split_type, mode, expense_date, notes, recurring_frequency, project_tag, cost_center, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (expense_id, group_id, title, category, amount_cents, paid_by, split_type, mode, expense_date, notes, recurring, project_tag, cost_center, status, now))

    for m_id, share_cents in calculated_shares.items():
        weight = float(split_data.get(m_id, 1.0))
        execute_write("""
            INSERT INTO expense_shares (id, expense_id, member_id, share_cents, weight_or_val)
            VALUES (?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), expense_id, m_id, share_cents, weight))

    payer = query_one("SELECT name FROM members WHERE id = ?", (paid_by,))
    payer_name = payer['name'] if payer else 'Someone'
    log_activity(group_id, payer_name, "ADD_EXPENSE", f"Added '{title}' for {DebtEngine.to_currency(amount_cents)}")

    new_expense = query_one("SELECT * FROM expenses WHERE id = ?", (expense_id,))
    new_expense['shares'] = query_all("SELECT * FROM expense_shares WHERE expense_id = ?", (expense_id,))
    return jsonify(new_expense), 201

@app.route('/api/groups/<group_id>/expenses/<expense_id>', methods=['DELETE'])
def delete_expense(group_id, expense_id):
    exp = query_one("SELECT title FROM expenses WHERE id = ? AND group_id = ?", (expense_id, group_id))
    title = exp['title'] if exp else 'Expense'
    execute_write("DELETE FROM expense_shares WHERE expense_id = ?", (expense_id,))
    execute_write("DELETE FROM expenses WHERE id = ?", (expense_id,))
    log_activity(group_id, "Admin", "DELETE_EXPENSE", f"Deleted expense '{title}'")
    return jsonify({'success': True, 'message': f'Expense {title} deleted.'})

# ==========================================
# 4. DEBT SIMPLIFICATION & SETTLEMENTS
# ==========================================

@app.route('/api/groups/<group_id>/settlements', methods=['GET'])
def get_settlements(group_id):
    mode = request.args.get('mode', 'greedy')  # 'greedy' or 'trust_preserving'
    group = query_one("SELECT * FROM groups WHERE id = ?", (group_id,))
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    members = query_all("SELECT * FROM members WHERE group_id = ? AND is_active = 1", (group_id,))
    members_map = {m['id']: m for m in members}

    expenses = query_all("SELECT * FROM expenses WHERE group_id = ? AND status != 'rejected'", (group_id,))
    for exp in expenses:
        exp['shares'] = query_all("SELECT * FROM expense_shares WHERE expense_id = ?", (exp['id'],))

    settlements = query_all("SELECT * FROM settlements WHERE group_id = ?", (group_id,))

    # Compute Net Balances
    net_bals, total_paid, total_share = DebtEngine.build_net_balances(members, expenses, settlements)

    # Raw direct debt graph before simplification
    direct_matrix = DebtEngine.build_direct_debt_graph(members, expenses)

    # Format direct matrix for graph visualization (Before state)
    before_edges = []
    before_transfers_count = 0
    before_total_volume = 0
    for u, targets in direct_matrix.items():
        for v, amt in targets.items():
            if amt > 0:
                before_transfers_count += 1
                before_total_volume += amt
                before_edges.append({
                    'from_id': u,
                    'from_name': members_map.get(u, {}).get('name', u),
                    'to_id': v,
                    'to_name': members_map.get(v, {}).get('name', v),
                    'amount_cents': amt,
                    'amount': DebtEngine.to_currency(amt)
                })

    # Execute selected debt simplification algorithm
    if mode == 'trust_preserving':
        transfers, math_trace = DebtEngine.simplify_debts_trust_preserving(direct_matrix, members_map)
    else:
        transfers, math_trace = DebtEngine.simplify_debts_greedy(net_bals, members_map)

    after_total_volume = sum(t['amount_cents'] for t in transfers)
    transfers_saved = max(0, before_transfers_count - len(transfers))
    money_saved_friction = max(0, before_total_volume - after_total_volume)

    # Prepare node data for graph visualizer
    nodes = []
    for m in members:
        bal = net_bals.get(m['id'], 0)
        nodes.append({
            'id': m['id'],
            'name': m['name'],
            'avatar': m['avatar'],
            'role': m['role'],
            'net_balance_cents': bal,
            'net_balance': DebtEngine.to_currency(bal),
            'status': 'creditor' if bal > 0 else ('debtor' if bal < 0 else 'settled')
        })

    return jsonify({
        'group': group,
        'mode': mode,
        'nodes': nodes,
        'before_graph': {
            'edges': before_edges,
            'transfers_count': before_transfers_count,
            'total_volume_cents': before_total_volume,
            'total_volume_formatted': DebtEngine.to_currency(before_total_volume)
        },
        'after_graph': {
            'transfers': transfers,
            'transfers_count': len(transfers),
            'total_volume_cents': after_total_volume,
            'total_volume_formatted': DebtEngine.to_currency(after_total_volume)
        },
        'metrics': {
            'transfers_saved': transfers_saved,
            'friction_reduction_pct': round((transfers_saved / before_transfers_count * 100) if before_transfers_count > 0 else 0, 1),
            'max_theoretical_transfers': max(0, len(members) - 1),
            'guarantee_achieved': len(transfers) <= max(0, len(members) - 1)
        },
        'math_trace': math_trace,
        'zero_sum_verified': sum(net_bals.values()) == 0,
        'net_balances_table': [
            {
                'id': m['id'],
                'name': m['name'],
                'paid': DebtEngine.to_currency(total_paid.get(m['id'], 0)),
                'share': DebtEngine.to_currency(total_share.get(m['id'], 0)),
                'net': DebtEngine.to_currency(net_bals.get(m['id'], 0)),
                'status': 'creditor' if net_bals.get(m['id'], 0) > 0 else ('debtor' if net_bals.get(m['id'], 0) < 0 else 'settled')
            }
            for m in members
        ]
    })

@app.route('/api/groups/<group_id>/settlements/pay', methods=['POST'])
def record_settlement_payment(group_id):
    data = request.json or {}
    from_member_id = data.get('from_member_id')
    to_member_id = data.get('to_member_id')
    amount_raw = data.get('amount')
    payment_method = data.get('payment_method', 'UPI')
    note = data.get('note', '')

    if not from_member_id or not to_member_id or not amount_raw:
        return jsonify({'error': 'from_member_id, to_member_id, and amount are required'}), 400

    amount_cents = DebtEngine.to_cents(amount_raw)
    settlement_id = f"stl_{uuid.uuid4().hex[:8]}"
    now = datetime.now().isoformat()

    execute_write("""
        INSERT INTO settlements (id, group_id, from_member_id, to_member_id, amount_cents, payment_method, note, status, settled_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', ?)
    """, (settlement_id, group_id, from_member_id, to_member_id, amount_cents, payment_method, note, now))

    from_m = query_one("SELECT name FROM members WHERE id = ?", (from_member_id,))
    to_m = query_one("SELECT name FROM members WHERE id = ?", (to_member_id,))
    from_name = from_m['name'] if from_m else 'Someone'
    to_name = to_m['name'] if to_m else 'Someone'

    log_activity(group_id, from_name, "RECORD_PAYMENT", f"Paid {DebtEngine.to_currency(amount_cents)} to {to_name} via {payment_method}")

    return jsonify({
        'id': settlement_id,
        'message': f"Settlement recorded: {from_name} paid {to_name} {DebtEngine.to_currency(amount_cents)}."
    }), 201

# ==========================================
# 5. EXPORT & SHARING ENDPOINTS
# ==========================================

@app.route('/api/groups/<group_id>/export/whatsapp', methods=['GET'])
def export_whatsapp(group_id):
    group = query_one("SELECT * FROM groups WHERE id = ?", (group_id,))
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    members = query_all("SELECT * FROM members WHERE group_id = ? AND is_active = 1", (group_id,))
    members_map = {m['id']: m for m in members}
    expenses = query_all("SELECT * FROM expenses WHERE group_id = ? AND status != 'rejected'", (group_id,))
    for exp in expenses:
        exp['shares'] = query_all("SELECT * FROM expense_shares WHERE expense_id = ?", (exp['id'],))
    settlements = query_all("SELECT * FROM settlements WHERE group_id = ?", (group_id,))

    net_bals, _, _ = DebtEngine.build_net_balances(members, expenses, settlements)
    transfers, _ = DebtEngine.simplify_debts_greedy(net_bals, members_map)

    whatsapp_text = DebtEngine.generate_whatsapp_summary(
        group_name=group['name'],
        currency_symbol=group.get('currency_symbol', '₹'),
        transfers=transfers,
        net_balances=net_bals,
        members_map=members_map
    )

    return jsonify({'text': whatsapp_text})

@app.route('/api/groups/<group_id>/export/csv', methods=['GET'])
def export_csv(group_id):
    group = query_one("SELECT * FROM groups WHERE id = ?", (group_id,))
    if not group:
        return Response("Group not found", status=404)

    expenses = query_all("SELECT * FROM expenses WHERE group_id = ? ORDER BY expense_date ASC", (group_id,))
    members = {m['id']: m['name'] for m in query_all("SELECT id, name FROM members WHERE group_id = ?", (group_id,))}

    csv_lines = ["Expense ID,Date,Title,Category,Amount,Paid By,Split Type,Mode,Project/Tag,Status,Notes"]
    for e in expenses:
        payer = members.get(e['paid_by'], 'Unknown')
        amt = DebtEngine.to_currency(e['amount_cents'])
        line = f'"{e["id"]}","{e["expense_date"]}","{e["title"]}","{e["category"]}","{amt}","{payer}","{e["split_type"]}","{e["mode"]}","{e.get("project_tag","")}","{e["status"]}","{e.get("notes","")}"'
        csv_lines.append(line)

    return Response("\n".join(csv_lines), mimetype='text/csv', headers={'Content-Disposition': f'attachment; filename="FairSplit_{group["name"].replace(" ", "_")}.csv"'})

# ==========================================
# 6. SPECIAL MODULES ENDPOINTS
# ==========================================

@app.route('/api/groups/<group_id>/special/hostel/move-out', methods=['GET'])
def get_move_out_settlement(group_id):
    member_id = request.args.get('member_id')
    deposit = float(request.args.get('security_deposit', 0))
    utilities = float(request.args.get('pending_utilities', 0))
    damage = float(request.args.get('damage_charges', 0))

    members = query_all("SELECT * FROM members WHERE group_id = ?", (group_id,))
    expenses = query_all("SELECT * FROM expenses WHERE group_id = ? AND status != 'rejected'", (group_id,))
    for exp in expenses:
        exp['shares'] = query_all("SELECT * FROM expense_shares WHERE expense_id = ?", (exp['id'],))
    settlements = query_all("SELECT * FROM settlements WHERE group_id = ?", (group_id,))

    net_bals, _, _ = DebtEngine.build_net_balances(members, expenses, settlements)

    res = SpecialModulesEngine.calculate_move_out_settlement(
        leaving_member_id=member_id,
        current_net_balances=net_bals,
        security_deposit_cents=DebtEngine.to_cents(deposit),
        pending_utilities_estimate_cents=DebtEngine.to_cents(utilities),
        property_damage_charge_cents=DebtEngine.to_cents(damage)
    )
    return jsonify(res)

@app.route('/api/groups/<group_id>/special/club/budget', methods=['GET'])
def get_club_budget(group_id):
    budgets = query_all("SELECT * FROM budgets WHERE group_id = ?", (group_id,))
    sponsors = query_all("SELECT * FROM sponsors WHERE group_id = ?", (group_id,))
    expenses = query_all("SELECT * FROM expenses WHERE group_id = ?", (group_id,))

    budget_stats = SpecialModulesEngine.calculate_budget_vs_actual(budgets, expenses)
    sponsor_stats = SpecialModulesEngine.calculate_sponsor_allocations(sponsors, budget_stats['total_actual_cents'])

    pending_approvals = [e for e in expenses if e.get('status') == 'pending']
    for p in pending_approvals:
        p['amount_formatted'] = DebtEngine.to_currency(p['amount_cents'])

    return jsonify({
        'budgets': budget_stats,
        'sponsors': sponsor_stats,
        'sponsors_list': sponsors,
        'pending_approvals': pending_approvals
    })

@app.route('/api/groups/<group_id>/special/club/approve', methods=['POST'])
def approve_club_expense(group_id):
    data = request.json or {}
    expense_id = data.get('expense_id')
    status = data.get('status', 'approved')  # 'approved' or 'rejected'
    approved_by = data.get('approved_by', 'Treasurer')

    execute_write("UPDATE expenses SET status = ?, approved_by = ? WHERE id = ? AND group_id = ?",
                  (status, approved_by, expense_id, group_id))
    log_activity(group_id, approved_by, f"EXPENSE_{status.upper()}", f"Expense {expense_id} marked as {status}")
    return jsonify({'success': True, 'expense_id': expense_id, 'status': status})

@app.route('/api/groups/<group_id>/special/office/reimbursements', methods=['GET'])
def get_office_reimbursements(group_id):
    members = query_all("SELECT * FROM members WHERE group_id = ?", (group_id,))
    members_map = {m['id']: m for m in members}
    expenses = query_all("SELECT * FROM expenses WHERE group_id = ? ORDER BY expense_date DESC", (group_id,))

    ledger = SpecialModulesEngine.generate_reimbursement_ledger(expenses, members_map)
    total_reimbursable_cents = sum(item['amount_cents'] for item in ledger)

    return jsonify({
        'ledger': ledger,
        'total_reimbursable_cents': total_reimbursable_cents,
        'total_reimbursable_formatted': DebtEngine.to_currency(total_reimbursable_cents)
    })

# ==========================================
# 7. PUBLIC TRANSPARENT REPORT PAGE (Clubs / NGOs)
# ==========================================

@app.route('/api/public/report/<invite_code>', methods=['GET'])
def get_public_report(invite_code):
    group = query_one("SELECT * FROM groups WHERE invite_code = ?", (invite_code,))
    if not group:
        return jsonify({'error': 'Invalid or expired report code'}), 404

    members = query_all("SELECT id, name, avatar, role FROM members WHERE group_id = ? AND is_active = 1", (group['id'],))
    expenses = query_all("SELECT id, title, category, amount_cents, expense_date, status, project_tag FROM expenses WHERE group_id = ? AND status = 'approved' ORDER BY expense_date DESC", (group['id'],))
    budgets = query_all("SELECT * FROM budgets WHERE group_id = ?", (group['id'],))
    sponsors = query_all("SELECT name, committed_cents, received_cents FROM sponsors WHERE group_id = ?", (group['id'],))

    for exp in expenses:
        exp['amount_formatted'] = DebtEngine.to_currency(exp['amount_cents'])

    total_exp_cents = sum(e['amount_cents'] for e in expenses)

    return jsonify({
        'group_name': group['name'],
        'group_type': group['group_type'],
        'currency_symbol': group['currency_symbol'],
        'created_at': group['created_at'],
        'members_count': len(members),
        'total_spending_formatted': DebtEngine.to_currency(total_exp_cents),
        'expenses': expenses,
        'budgets': SpecialModulesEngine.calculate_budget_vs_actual(budgets, expenses),
        'sponsors': sponsors
    })

# ==========================================
# 8. STATIC FRONTEND SERVING
# ==========================================

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 FairSplit Flow Server starting at http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
