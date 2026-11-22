# ⚖️ FairSplit Flow

> **Smart, Graph-Theoretic Shared Expense & Debt Simplification Web Application**  
> Minimizes group debt into at most $n - 1$ transfers using Greedy Priority Queues and Trust-Preserving Network Flow with exact integer zero-sum arithmetic.

---

## 🌟 1. Project Vision & Overview

When friends, flatmates, clubs, or business partners share expenses, they inevitably create a tangled web of bilateral debts (IOUs). Settling each debt individually causes financial churn, excessive bank transfer fees, confusion, and awkward forgotten payments.

**FairSplit Flow** solves this with mathematical rigor:
1. Members record expenses naturally (**Shared** or **Individual** modes with flexible splitting methods).
2. The system computes each participant's **Net Balance** ($\text{Total Paid} - \text{Total Share}$).
3. Graph algorithms reduce the entire debt network into the **minimum possible number of transactions** ($\le n - 1$ transfers for $n$ people).
4. Users get an intuitive, interactive **before-and-after graph visualizer**, one-click **WhatsApp-ready summaries**, CSV/PDF exports, and an educational **"Show the Math"** drawer.

---

## 🔬 2. Mathematical Foundation & Algorithms

### Directed Weighted Graph
- **Nodes ($V$)**: Group members $P_1, P_2, \dots, P_n$.
- **Edges ($E$)**: Directed debt arrows $u \xrightarrow{w} v$ meaning member $u$ owes member $v$ amount $w$.

### Net Balance Vector
For each person $P_i$:
$$\text{NetBalance}(P_i) = \text{TotalPaid}(P_i) - \text{TotalShare}(P_i)$$
- $\text{NetBalance} > 0 \implies$ **Creditor** (is owed money)
- $\text{NetBalance} < 0 \implies$ **Debtor** (owes money)
- $\text{NetBalance} = 0 \implies$ **Settled**

### Zero-Sum Invariant
$$\sum_{i=1}^n \text{NetBalance}(P_i) \equiv 0$$
All internal computations use **exact integer arithmetic in smallest currency units (paise/cents)**. Odd remainders from division (e.g. ₹100 split 3 ways $\implies 3334, 3333, 3333$) are distributed deterministically so that no currency unit is ever lost or created.

### Algorithm Mode 1: Minimum Transfers (Greedy Priority Queues)
- **Time Complexity:** $\mathcal{O}(N \log N)$
- **Guarantee:** Produces at most $n - 1$ transfers.
- **Process:** Maintains two priority queues:
  - Max-Heap of Creditors
  - Min-Heap of Debtors (Max debt)
  Repeatedly matches the largest debtor with the largest creditor for the maximum possible settlement amount until all balances reach 0.

### Algorithm Mode 2: Trust-Preserving (Max-Flow / Cycle-Canceling DAG)
- Preserves trust relationships by strictly canceling multi-party cycles (e.g. $A \to B \to C \to A$) along original IOU debt paths so money never flows to complete strangers if an existing debt path exists.

---

## 🚀 3. Features & Modules

### Universal Capabilities
- **Group Templates:** Travel, Hostel/Flatmates, Clubs & Events, Office/Business, Family, Sports Teams, NGOs.
- **Icon-Based Expense Toggle:** Elegant 2-3 people icon vs 1 person icon (no bulky text tabs).
- **Default "Paid by":** Automatically defaults to the logged-in user.
- **6 Splitting Methods:** Equal, Exact amounts, Shares, Percentage, Custom ratios, Days-stayed proportional.
- **Real-Time Live Share Preview:** Dynamically computes and displays each person's exact share as you type.
- **Rapid Entry:** "Save & Add Another" button for quick multi-receipt logging.
- **Highlighted Personal Balance:** Prominently displays *"YOU ARE OWED"* or *"YOU OWE"* on the main dashboard.
- **Multi-Currency:** INR (₹), USD ($), EUR (€), GBP (£), AED.
- **Multi-Format Export:** 1-click WhatsApp formatted text, CSV table download, and clean Print/PDF report.
- **Public Transparent Report Page:** Shareable view-only link for event sponsors, clubs, and NGO donors.
- **Dark & Light Mode:** Seamless toggle with soft off-white background and emerald accents.

### Special Modules
1. **🏠 Hostel & Flatmates:**
   - **Proportional Days-Stayed Split:** Calculates fair utility bills based on actual days occupied (e.g., roommate traveling home for holidays).
   - **Move-Out Final Settlement Calculator:** Deducts security deposit return, pending utility estimates, and property damages to produce an exact final move-out figure.
   - **Utility Presets:** Rent, Bescom Electricity, Airtel Fiber WiFi, Maid & Cook.
2. **🎓 Clubs & Events:**
   - **Budget vs Actual Tracker:** Category-wise budget variance and visual progress burn bar.
   - **Treasurer Approval Flow:** Approve or reject submitted committee expenses.
   - **Sponsor Fund Tracker:** Track committed vs received funds and net event surplus/deficit.
3. **💼 Office & Teams:**
   - **Reimbursement Ledger:** Employee audit trail grouped by project tag and cost center.
   - **Salary & Equity Ratio Splitting:** Weighting by compensation or ownership shares.

---

## 🛠️ 4. Quickstart Guide

### One-Click Start (Windows)
Double-click `run.bat` or run:
```bash
python run.py
```
This automatically starts the Python backend and opens `http://localhost:5000` in your default browser.

### Manual Backend Start
```bash
cd backend
python app.py
```

### Running Test Suites
```bash
# Run Mathematical Engine unit tests
cd backend
python test_engine.py

# Run Full Integration & API tests
python test_integration.py
```

---

## 📂 5. Architecture & File Layout

```
fairsplit-flow/
├── backend/
│   ├── engine/
│   │   ├── debt_engine.py         # Graph theory, Greedy & Trust-Preserving solvers, WhatsApp generator
│   │   └── special_modules.py     # Hostel move-out, Club budgets & approvals, Office reimbursements
│   ├── database.py                # SQLite schema & persistence
│   ├── seed_data.py               # Pre-seeded rich demo scenarios (Goa trip, Flat 402, TechFest, Alpha AI)
│   ├── app.py                     # Flask REST API & static server
│   ├── test_engine.py             # Math unit tests (Zero-sum, remainder, cycles, <= n-1 guarantee)
│   └── test_integration.py        # End-to-end API & export tests
├── frontend/
│   ├── css/
│   │   └── style.css              # Custom styling, typography, print stylesheet
│   ├── js/
│   │   ├── engine/
│   │   │   └── client_engine.js   # In-browser mirror of mathematical engine for instant live preview
│   │   ├── components/
│   │   │   ├── graph_visualizer.js # Canvas/SVG interactive Before/After directed debt graph
│   │   │   ├── expense_modal.js   # Icon-toggle expense modal with live share preview & rapid entry
│   │   │   ├── math_drawer.js     # Educational "Show the Math" technical proof drawer
│   │   │   ├── settlement_view.js # Payment cards, Mark as paid, WhatsApp copy & exports
│   │   │   └── special_modules_ui.js # Hostel, Club, and Office special views
│   │   └── app.js                 # Primary reactive state manager
│   └── index.html                 # Complete responsive Single Page Application shell
├── run.py                         # One-click launcher with auto browser opening
├── run.bat                        # Windows batch launcher
└── README.md
```
