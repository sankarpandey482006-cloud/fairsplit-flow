"""
FairSplit Flow - Database Schema & Data Access Layer
===================================================
SQLite-backed persistence for groups, members, expenses, shares,
settlements, budgets, sponsors, and activity logs.
"""

import sqlite3
import json
import uuid
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fairsplit.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    # Users
    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar TEXT,
        created_at TEXT NOT NULL
    )
    """)

    # Groups
    c.execute("""
    CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        group_type TEXT NOT NULL DEFAULT 'travel',
        currency TEXT NOT NULL DEFAULT 'INR',
        currency_symbol TEXT NOT NULL DEFAULT '₹',
        invite_code TEXT UNIQUE NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)

    # Members
    c.execute("""
    CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        user_id TEXT,
        name TEXT NOT NULL,
        email TEXT,
        avatar TEXT,
        role TEXT NOT NULL DEFAULT 'member', -- admin, treasurer, member, viewer
        is_active INTEGER NOT NULL DEFAULT 1,
        joined_at TEXT NOT NULL,
        FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
    )
    """)

    # Expenses
    c.execute("""
    CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'General',
        amount_cents INTEGER NOT NULL,
        paid_by TEXT NOT NULL,
        split_type TEXT NOT NULL DEFAULT 'equal', -- equal, exact, shares, percent, custom_ratio, days_stayed
        mode TEXT NOT NULL DEFAULT 'shared', -- shared, individual
        expense_date TEXT NOT NULL,
        notes TEXT,
        recurring_frequency TEXT DEFAULT 'none', -- none, weekly, monthly
        project_tag TEXT,
        cost_center TEXT,
        status TEXT NOT NULL DEFAULT 'approved', -- approved, pending, rejected
        approved_by TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY(paid_by) REFERENCES members(id)
    )
    """)

    # Expense Shares
    c.execute("""
    CREATE TABLE IF NOT EXISTS expense_shares (
        id TEXT PRIMARY KEY,
        expense_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        share_cents INTEGER NOT NULL,
        weight_or_val REAL DEFAULT 1.0,
        FOREIGN KEY(expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
        FOREIGN KEY(member_id) REFERENCES members(id)
    )
    """)

    # Settlements (Recorded payments)
    c.execute("""
    CREATE TABLE IF NOT EXISTS settlements (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        from_member_id TEXT NOT NULL,
        to_member_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        payment_method TEXT DEFAULT 'UPI', -- UPI, Cash, Bank Transfer, Card
        note TEXT,
        status TEXT NOT NULL DEFAULT 'paid', -- paid, pending
        settled_at TEXT NOT NULL,
        FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
    )
    """)

    # Budgets (Clubs & Events)
    c.execute("""
    CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        category TEXT NOT NULL,
        allocated_cents INTEGER NOT NULL,
        FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
    )
    """)

    # Sponsors (Clubs & Events)
    c.execute("""
    CREATE TABLE IF NOT EXISTS sponsors (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        name TEXT NOT NULL,
        committed_cents INTEGER NOT NULL,
        received_cents INTEGER NOT NULL DEFAULT 0,
        contact_info TEXT,
        FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
    )
    """)

    # Activity Logs
    c.execute("""
    CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
    )
    """)

    conn.commit()
    conn.close()

# Initialize DB on load
init_db()

# ================================
# Database Helper Functions
# ================================

def query_all(sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    conn = get_db()
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def query_one(sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    conn = get_db()
    row = conn.execute(sql, params).fetchone()
    conn.close()
    return dict(row) if row else None

def execute_write(sql: str, params: tuple = ()):
    conn = get_db()
    conn.execute(sql, params)
    conn.commit()
    conn.close()

def log_activity(group_id: str, member_name: str, action: str, details: str):
    log_id = str(uuid.uuid4())
    execute_write(
        "INSERT INTO activity_logs (id, group_id, member_name, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (log_id, group_id, member_name, action, details, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    )
