"""
FairSplit Flow - Demo Data Seeder
=================================
Seeds rich, realistic demo groups spanning all major use cases:
1. Travel / Roadtrip (Goa Friends)
2. Hostel / Roommates (Flat 402)
3. College Club / Event (TechFest 2026)
4. Office / Business (Alpha AI)
"""

import uuid
from datetime import datetime, timedelta
from database import get_db, execute_write, query_one
from engine.debt_engine import DebtEngine

def seed_demo_data():
    conn = get_db()
    c = conn.cursor()

    # Check if already seeded
    existing = c.execute("SELECT id FROM groups LIMIT 1").fetchone()
    if existing:
        conn.close()
        return

    print("Seeding rich realistic demo groups...")

    # Default User
    user_id = "user_sankalp"
    c.execute(
        "INSERT OR IGNORE INTO users (id, name, email, password_hash, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, "Sankalp Sharma", "sankalp@fairsplit.flow", "demo_hash", "https://api.dicebear.com/7.x/avataaars/svg?seed=Sankalp", datetime.utcnow().isoformat())
    )

    # ==============================================================
    # 1. GROUP 1: TRAVEL (Goa Beach Roadtrip 🏖️)
    # ==============================================================
    g1_id = "grp_goa_trip"
    c.execute("""
        INSERT INTO groups (id, name, group_type, currency, currency_symbol, invite_code, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (g1_id, "Goa Beach Roadtrip 🏖️", "travel", "INR", "₹", "GOA2026", user_id, datetime.utcnow().isoformat()))

    members_g1 = [
        ("m_sankalp", g1_id, user_id, "Sankalp (You)", "sankalp@fairsplit.flow", "https://api.dicebear.com/7.x/avataaars/svg?seed=Sankalp", "admin"),
        ("m_rohit", g1_id, None, "Rohit Verma", "rohit@gmail.com", "https://api.dicebear.com/7.x/avataaars/svg?seed=Rohit", "treasurer"),
        ("m_priya", g1_id, None, "Priya Nair", "priya@gmail.com", "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya", "member"),
        ("m_arjun", g1_id, None, "Arjun Mehta", "arjun@gmail.com", "https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun", "member")
    ]
    for mid, gid, uid, name, email, avatar, role in members_g1:
        c.execute("""
            INSERT INTO members (id, group_id, user_id, name, email, avatar, role, is_active, joined_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        """, (mid, gid, uid, name, email, avatar, role, datetime.utcnow().isoformat()))

    # Expenses for Goa Trip
    # Expense 1: Villa Rental (Paid by Sankalp, ₹16,000 equal among 4) -> 4000 each
    e1_id = "exp_villa"
    c.execute("""
        INSERT INTO expenses (id, group_id, title, category, amount_cents, paid_by, split_type, mode, expense_date, notes, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
    """, (e1_id, g1_id, "Beachside Villa (3 Nights)", "Stay", 1600000, "m_sankalp", "equal", "shared", (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"), "Paid via Credit Card with discount", datetime.utcnow().isoformat()))
    for m in ["m_sankalp", "m_rohit", "m_priya", "m_arjun"]:
        c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)",
                  (str(uuid.uuid4()), e1_id, m, 400000))

    # Expense 2: Car Rental & Fuel (Paid by Rohit, ₹8,000 equal among 4) -> 2000 each
    e2_id = "exp_car"
    c.execute("""
        INSERT INTO expenses (id, group_id, title, category, amount_cents, paid_by, split_type, mode, expense_date, notes, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
    """, (e2_id, g1_id, "SUV Rental + Highway Fuel", "Transport", 800000, "m_rohit", "equal", "shared", (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"), "Full tank petrol included", datetime.utcnow().isoformat()))
    for m in ["m_sankalp", "m_rohit", "m_priya", "m_arjun"]:
        c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)",
                  (str(uuid.uuid4()), e2_id, m, 200000))

    # Expense 3: Seafood Dinner at Fisherman's Wharf (Paid by Priya, ₹5,400 - Priya, Sankalp, Rohit ate, Arjun didn't attend)
    e3_id = "exp_dinner"
    c.execute("""
        INSERT INTO expenses (id, group_id, title, category, amount_cents, paid_by, split_type, mode, expense_date, notes, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
    """, (e3_id, g1_id, "Seafood Dinner @ Fisherman's Wharf", "Food & Drink", 540000, "m_priya", "equal", "shared", (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"), "Arjun had room service separately", datetime.utcnow().isoformat()))
    for m in ["m_sankalp", "m_rohit", "m_priya"]:
        c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)",
                  (str(uuid.uuid4()), e3_id, m, 180000))

    # Expense 4: Scuba Diving & Jet Ski (Paid by Arjun, ₹12,000 exact split)
    e4_id = "exp_water_sports"
    c.execute("""
        INSERT INTO expenses (id, group_id, title, category, amount_cents, paid_by, split_type, mode, expense_date, notes, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
    """, (e4_id, g1_id, "Water Sports & Scuba Package", "Activities", 1200000, "m_arjun", "exact", "shared", datetime.now().strftime("%Y-%m-%d"), "Arjun and Sankalp took scuba (₹4000 each), Rohit & Priya took Jet Ski (₹2000 each)", datetime.utcnow().isoformat()))
    c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)", (str(uuid.uuid4()), e4_id, "m_arjun", 400000))
    c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)", (str(uuid.uuid4()), e4_id, "m_sankalp", 400000))
    c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)", (str(uuid.uuid4()), e4_id, "m_rohit", 200000))
    c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)", (str(uuid.uuid4()), e4_id, "m_priya", 200000))

    # Expense 5: Sunscreen & Snacks (Individual Expense paid by Sankalp for Rohit, ₹500)
    e5_id = "exp_snacks"
    c.execute("""
        INSERT INTO expenses (id, group_id, title, category, amount_cents, paid_by, split_type, mode, expense_date, notes, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
    """, (e5_id, g1_id, "Personal Pharmacy & Energy Drinks", "Groceries", 50000, "m_sankalp", "exact", "individual", datetime.now().strftime("%Y-%m-%d"), "Bought specifically for Rohit", datetime.utcnow().isoformat()))
    c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)", (str(uuid.uuid4()), e5_id, "m_rohit", 50000))

    # ==============================================================
    # 2. GROUP 2: HOSTEL / FLATMATES (Flat 402 - Greenwood 🏠)
    # ==============================================================
    g2_id = "grp_flat_402"
    c.execute("""
        INSERT INTO groups (id, name, group_type, currency, currency_symbol, invite_code, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (g2_id, "Flat 402 - Greenwood Apts 🏠", "hostel", "INR", "₹", "FLAT402", user_id, datetime.utcnow().isoformat()))

    members_g2 = [
        ("m_flat_sankalp", g2_id, user_id, "Sankalp Sharma", "sankalp@fairsplit.flow", "https://api.dicebear.com/7.x/avataaars/svg?seed=Sankalp", "admin"),
        ("m_flat_vikram", g2_id, None, "Vikram Singhania", "vikram@gmail.com", "https://api.dicebear.com/7.x/avataaars/svg?seed=Vikram", "member"),
        ("m_flat_karan", g2_id, None, "Karan Malhotra", "karan@gmail.com", "https://api.dicebear.com/7.x/avataaars/svg?seed=Karan", "member")
    ]
    for mid, gid, uid, name, email, avatar, role in members_g2:
        c.execute("""
            INSERT INTO members (id, group_id, user_id, name, email, avatar, role, is_active, joined_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        """, (mid, gid, uid, name, email, avatar, role, datetime.utcnow().isoformat()))

    # Flat Expenses
    # Rent: ₹36,000 paid by Sankalp, ₹12,000 each
    e_rent = "exp_rent_nov"
    c.execute("""
        INSERT INTO expenses (id, group_id, title, category, amount_cents, paid_by, split_type, mode, expense_date, notes, recurring_frequency, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'monthly', 'approved', ?)
    """, (e_rent, g2_id, "Monthly Apartment Rent (November)", "Rent", 3600000, "m_flat_sankalp", "equal", "shared", "2026-11-01", "Bank transfer to landlord", datetime.utcnow().isoformat()))
    for m in ["m_flat_sankalp", "m_flat_vikram", "m_flat_karan"]:
        c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)", (str(uuid.uuid4()), e_rent, m, 1200000))

    # Electricity Bill: ₹4,500 paid by Vikram with Days-Stayed split:
    # Sankalp: 30 days, Vikram: 30 days, Karan: 15 days (went home)
    # Total days = 75 days. Cost/day = 6000 paise. Sankalp: 1800, Vikram: 1800, Karan: 900
    e_elec = "exp_electricity"
    c.execute("""
        INSERT INTO expenses (id, group_id, title, category, amount_cents, paid_by, split_type, mode, expense_date, notes, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
    """, (e_elec, g2_id, "Electricity (Bescom) - Proportional Stay", "Utilities", 450000, "m_flat_vikram", "days_stayed", "shared", "2026-11-10", "Karan went home for Diwali for 15 days", datetime.utcnow().isoformat()))
    c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents, weight_or_val) VALUES (?, ?, ?, ?, ?)", (str(uuid.uuid4()), e_elec, "m_flat_sankalp", 180000, 30))
    c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents, weight_or_val) VALUES (?, ?, ?, ?, ?)", (str(uuid.uuid4()), e_elec, "m_flat_vikram", 180000, 30))
    c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents, weight_or_val) VALUES (?, ?, ?, ?, ?)", (str(uuid.uuid4()), e_elec, "m_flat_karan", 90000, 15))

    # High-Speed Fiber WiFi: ₹1,499 paid by Karan, equal split
    e_wifi = "exp_wifi"
    c.execute("""
        INSERT INTO expenses (id, group_id, title, category, amount_cents, paid_by, split_type, mode, expense_date, notes, recurring_frequency, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'monthly', 'approved', ?)
    """, (e_wifi, g2_id, "Airtel Xstream Fiber 300 Mbps", "Internet", 149900, "m_flat_karan", "equal", "shared", "2026-11-05", "Monthly plan with OTT apps", datetime.utcnow().isoformat()))
    # 149900 // 3 = 49966, remainder 2 -> 49967, 49967, 49966
    c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)", (str(uuid.uuid4()), e_wifi, "m_flat_sankalp", 49967))
    c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)", (str(uuid.uuid4()), e_wifi, "m_flat_vikram", 49967))
    c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)", (str(uuid.uuid4()), e_wifi, "m_flat_karan", 49966))

    # ==============================================================
    # 3. GROUP 3: CLUBS & EVENTS (TechFest 2026 Organizing Committee 🚀)
    # ==============================================================
    g3_id = "grp_techfest"
    c.execute("""
        INSERT INTO groups (id, name, group_type, currency, currency_symbol, invite_code, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (g3_id, "TechFest 2026 Committee 🚀", "club", "INR", "₹", "TECHFEST", user_id, datetime.utcnow().isoformat()))

    members_g3 = [
        ("m_tf_sankalp", g3_id, user_id, "Sankalp Sharma", "sankalp@fairsplit.flow", "https://api.dicebear.com/7.x/avataaars/svg?seed=Sankalp", "admin"),
        ("m_tf_ananya", g3_id, None, "Ananya (Treasurer)", "ananya@techfest.org", "https://api.dicebear.com/7.x/avataaars/svg?seed=Ananya", "treasurer"),
        ("m_tf_dev", g3_id, None, "Devansh (Logistics)", "dev@techfest.org", "https://api.dicebear.com/7.x/avataaars/svg?seed=Devansh", "member"),
        ("m_tf_sneha", g3_id, None, "Sneha (PR & Media)", "sneha@techfest.org", "https://api.dicebear.com/7.x/avataaars/svg?seed=Sneha", "member")
    ]
    for mid, gid, uid, name, email, avatar, role in members_g3:
        c.execute("""
            INSERT INTO members (id, group_id, user_id, name, email, avatar, role, is_active, joined_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        """, (mid, gid, uid, name, email, avatar, role, datetime.utcnow().isoformat()))

    # Budgets for TechFest
    budgets_g3 = [
        ("b1", g3_id, "Stage & AV Equipment", 5000000), # ₹50,000
        ("b2", g3_id, "Food & Refreshments", 3500000),   # ₹35,000
        ("b3", g3_id, "Merchandise & ID Cards", 2500000),# ₹25,000
        ("b4", g3_id, "Cash Prizes & Trophies", 4000000) # ₹40,000
    ]
    for bid, gid, cat, alloc in budgets_g3:
        c.execute("INSERT INTO budgets (id, group_id, category, allocated_cents) VALUES (?, ?, ?, ?)", (bid, gid, cat, alloc))

    # Sponsors for TechFest
    sponsors_g3 = [
        ("sp1", g3_id, "Google Developer Student Clubs", 5000000, 5000000, "community@google.com"),
        ("sp2", g3_id, "Red Bull India", 2500000, 1500000, "partner@redbull.com"),
        ("sp3", g3_id, "GeeksforGeeks", 3000000, 3000000, "sponsor@gfg.org")
    ]
    for spid, gid, name, comm, recv, contact in sponsors_g3:
        c.execute("INSERT INTO sponsors (id, group_id, name, committed_cents, received_cents, contact_info) VALUES (?, ?, ?, ?, ?, ?)",
                  (spid, gid, name, comm, recv, contact))

    # TechFest Expenses
    e_av = "exp_sound_stage"
    c.execute("""
        INSERT INTO expenses (id, group_id, title, category, amount_cents, paid_by, split_type, mode, expense_date, notes, status, approved_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'Ananya (Treasurer)', ?)
    """, (e_av, g3_id, "JBL Sound System & LED Stage Wall", "Stage & AV Equipment", 4200000, "m_tf_dev", "equal", "shared", "2026-11-15", "Auditorium main stage sound gear", datetime.utcnow().isoformat()))
    for m in ["m_tf_sankalp", "m_tf_ananya", "m_tf_dev", "m_tf_sneha"]:
        c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)", (str(uuid.uuid4()), e_av, m, 1050000))

    e_merch = "exp_tshirts"
    c.execute("""
        INSERT INTO expenses (id, group_id, title, category, amount_cents, paid_by, split_type, mode, expense_date, notes, status, approved_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'Ananya (Treasurer)', ?)
    """, (e_merch, g3_id, "300x Custom TechFest Hoodies & Lanyards", "Merchandise & ID Cards", 2400000, "m_tf_sneha", "equal", "shared", "2026-11-18", "Vendor invoice paid via advance cheque", datetime.utcnow().isoformat()))
    for m in ["m_tf_sankalp", "m_tf_ananya", "m_tf_dev", "m_tf_sneha"]:
        c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)", (str(uuid.uuid4()), e_merch, m, 600000))

    # Pending approval expense
    e_pending = "exp_dj_night"
    c.execute("""
        INSERT INTO expenses (id, group_id, title, category, amount_cents, paid_by, split_type, mode, expense_date, notes, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    """, (e_pending, g3_id, "Pro DJ Artist Advance Booking", "Stage & AV Equipment", 1500000, "m_tf_dev", "equal", "shared", "2026-11-20", "Awaiting confirmation from faculty dean", datetime.utcnow().isoformat()))
    for m in ["m_tf_sankalp", "m_tf_ananya", "m_tf_dev", "m_tf_sneha"]:
        c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)", (str(uuid.uuid4()), e_pending, m, 375000))

    # ==============================================================
    # 4. GROUP 4: OFFICE / BUSINESS (Alpha AI - Engineering Team 💼)
    # ==============================================================
    g4_id = "grp_alpha_ai"
    c.execute("""
        INSERT INTO groups (id, name, group_type, currency, currency_symbol, invite_code, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (g4_id, "Alpha AI - Engineering Team 💼", "office", "INR", "₹", "ALPHATEAM", user_id, datetime.utcnow().isoformat()))

    members_g4 = [
        ("m_off_sankalp", g4_id, user_id, "Sankalp Sharma (Tech Lead)", "sankalp@fairsplit.flow", "https://api.dicebear.com/7.x/avataaars/svg?seed=Sankalp", "admin"),
        ("m_off_neha", g4_id, None, "Neha Kapoor (PM)", "neha@alpha.ai", "https://api.dicebear.com/7.x/avataaars/svg?seed=Neha", "treasurer"),
        ("m_off_kunal", g4_id, None, "Kunal Ray (Backend)", "kunal@alpha.ai", "https://api.dicebear.com/7.x/avataaars/svg?seed=Kunal", "member"),
        ("m_off_tanvi", g4_id, None, "Tanvi Shah (Design)", "tanvi@alpha.ai", "https://api.dicebear.com/7.x/avataaars/svg?seed=Tanvi", "member")
    ]
    for mid, gid, uid, name, email, avatar, role in members_g4:
        c.execute("""
            INSERT INTO members (id, group_id, user_id, name, email, avatar, role, is_active, joined_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        """, (mid, gid, uid, name, email, avatar, role, datetime.utcnow().isoformat()))

    # Office Expenses with Project Tags & Cost Centers
    e_cloud = "exp_aws_cloud"
    c.execute("""
        INSERT INTO expenses (id, group_id, title, category, amount_cents, paid_by, split_type, mode, expense_date, notes, project_tag, cost_center, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Project LLM-Core', 'R&D', 'approved', ?)
    """, (e_cloud, g4_id, "AWS GPU Cluster Training (A100 instances)", "Software & Cloud", 1850000, "m_off_sankalp", "equal", "shared", "2026-11-12", "Pre-training benchmark run", datetime.utcnow().isoformat()))
    for m in ["m_off_sankalp", "m_off_neha", "m_off_kunal", "m_off_tanvi"]:
        c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)", (str(uuid.uuid4()), e_cloud, m, 462500))

    e_offsite = "exp_team_dinner"
    c.execute("""
        INSERT INTO expenses (id, group_id, title, category, amount_cents, paid_by, split_type, mode, expense_date, notes, project_tag, cost_center, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Q4 Milestone', 'People & Culture', 'approved', ?)
    """, (e_offsite, g4_id, "Sprint Completion Celebration Dinner", "Team Offsite", 720000, "m_off_neha", "equal", "shared", "2026-11-19", "Reimbursement receipt attached", datetime.utcnow().isoformat()))
    for m in ["m_off_sankalp", "m_off_neha", "m_off_kunal", "m_off_tanvi"]:
        c.execute("INSERT INTO expense_shares (id, expense_id, member_id, share_cents) VALUES (?, ?, ?, ?)", (str(uuid.uuid4()), e_offsite, m, 180000))

    # Activity Logs
    logs = [
        (g1_id, "Sankalp Sharma", "CREATE_GROUP", "Created group 'Goa Beach Roadtrip 🏖️'"),
        (g1_id, "Sankalp Sharma", "ADD_EXPENSE", "Added 'Beachside Villa (3 Nights)' for ₹16,000.00"),
        (g1_id, "Rohit Verma", "ADD_EXPENSE", "Added 'SUV Rental + Highway Fuel' for ₹8,000.00"),
        (g1_id, "Priya Nair", "ADD_EXPENSE", "Added 'Seafood Dinner @ Fisherman Wharf' for ₹5,400.00"),
        (g2_id, "Sankalp Sharma", "CREATE_GROUP", "Created group 'Flat 402 - Greenwood Apts 🏠'"),
        (g2_id, "Vikram Singhania", "ADD_EXPENSE", "Added 'Electricity (Bescom)' split by days stayed"),
        (g3_id, "Ananya (Treasurer)", "BUDGET_CREATED", "Set total event budget to ₹1,50,000.00"),
        (g4_id, "Sankalp Sharma", "REIMBURSEMENT_SUBMITTED", "Submitted AWS GPU expense for reimbursement")
    ]
    for gid, member, act, det in logs:
        c.execute("INSERT INTO activity_logs (id, group_id, member_name, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                  (str(uuid.uuid4()), gid, member, act, det, datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")))

    conn.commit()
    conn.close()
    print("Demo data seeded successfully!")

if __name__ == '__main__':
    seed_demo_data()
