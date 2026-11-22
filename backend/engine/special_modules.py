"""
FairSplit Flow - Special Modules Engine
======================================
1. Hostel & Roommates:
   - Days-stayed proportional calculation
   - Roommate Move-out / Leaving final settlement calculator
   - Standard utility bill templates (Rent, Electricity, WiFi, Maid, Water, Groceries)
2. Clubs & Events:
   - Budget vs Actual tracking & variance calculations
   - Expense approval workflow state engine
   - Sponsor contribution tracking and allocation
   - Sub-groups / committee tags
3. Office & Business:
   - Project & Cost-Center tagging
   - Reimbursement report generation (Company owes Employee)
   - Salary-ratio / equity-ratio proportional splitting
"""

from typing import List, Dict, Any, Optional
from datetime import datetime

class SpecialModulesEngine:

    # ==========================
    # 1. HOSTEL & ROOMMATES MODULE
    # ==========================

    @staticmethod
    def calculate_days_stayed_split(
        total_bill_cents: int,
        stay_records: Dict[str, int]  # {member_id: days_stayed}
    ) -> Dict[str, Any]:
        """
        Calculates fair expense allocation based on exact days stayed during billing cycle.
        """
        total_man_days = sum(stay_records.values())
        if total_man_days == 0:
            return {}

        cost_per_day_cents = total_bill_cents / total_man_days
        shares = {}
        allocated = 0
        
        sorted_members = sorted(stay_records.keys(), key=lambda m: stay_records[m], reverse=True)
        for m_id in sorted_members:
            days = stay_records[m_id]
            share = int(days * cost_per_day_cents)
            shares[m_id] = share
            allocated += share

        # Remainder adjustment to preserve exact integer zero-sum
        remainder = total_bill_cents - allocated
        for i in range(remainder):
            shares[sorted_members[i % len(sorted_members)]] += 1

        return {
            'total_man_days': total_man_days,
            'cost_per_day_cents': int(cost_per_day_cents),
            'cost_per_day_formatted': round(cost_per_day_cents / 100, 2),
            'shares_cents': shares,
            'shares_formatted': {m: round(cents / 100, 2) for m, cents in shares.items()}
        }

    @staticmethod
    def calculate_move_out_settlement(
        leaving_member_id: str,
        current_net_balances: Dict[str, int],
        security_deposit_cents: int = 0,
        pending_utilities_estimate_cents: int = 0,
        property_damage_charge_cents: int = 0
    ) -> Dict[str, Any]:
        """
        Generates a clean, transparent final settlement for a roommate moving out.
        Final Amount to Pay/Receive = Current Net Balance + (Security Deposit Refund) 
                                      - (Pending Utilities Share) - (Damage Charges)
        """
        net_balance_cents = current_net_balances.get(leaving_member_id, 0)
        
        # Net balance > 0 means the flat owes the roommate
        # Net balance < 0 means the roommate owes the flat
        adjusted_final_cents = (
            net_balance_cents 
            + security_deposit_cents 
            - pending_utilities_estimate_cents 
            - property_damage_charge_cents
        )

        return {
            'leaving_member_id': leaving_member_id,
            'current_net_balance_cents': net_balance_cents,
            'current_net_balance_formatted': round(net_balance_cents / 100, 2),
            'security_deposit_cents': security_deposit_cents,
            'security_deposit_formatted': round(security_deposit_cents / 100, 2),
            'pending_utilities_estimate_cents': pending_utilities_estimate_cents,
            'pending_utilities_formatted': round(pending_utilities_estimate_cents / 100, 2),
            'property_damage_charge_cents': property_damage_charge_cents,
            'property_damage_formatted': round(property_damage_charge_cents / 100, 2),
            'final_payable_cents': adjusted_final_cents,
            'final_payable_formatted': round(adjusted_final_cents / 100, 2),
            'direction': 'ROOMMATE_RECEIVES' if adjusted_final_cents > 0 else ('ROOMMATE_PAYS' if adjusted_final_cents < 0 else 'EVEN'),
            'summary_text': (
                f"Roommate receives ₹{round(adjusted_final_cents / 100, 2)}"
                if adjusted_final_cents > 0
                else (f"Roommate owes flat ₹{round(abs(adjusted_final_cents) / 100, 2)}" if adjusted_final_cents < 0 else "Fully settled (₹0.00)")
            )
        }

    # ==========================
    # 2. CLUBS & EVENTS MODULE
    # ==========================

    @staticmethod
    def calculate_budget_vs_actual(
        budgets: List[Dict[str, Any]],  # [{'category': 'Stage & Sound', 'allocated_cents': 5000000}]
        expenses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculates overall and category-wise budget vs actual spending, variance, and burn rate.
        """
        category_spending = {}
        total_actual_cents = 0
        
        for exp in expenses:
            if exp.get('status') == 'rejected':
                continue
            cat = exp.get('category', 'General')
            amt = exp.get('amount_cents', 0)
            category_spending[cat] = category_spending.get(cat, 0) + amt
            total_actual_cents += amt

        categories_summary = []
        total_budget_cents = 0

        for b in budgets:
            cat = b['category']
            allocated = b.get('allocated_cents', 0)
            total_budget_cents += allocated
            actual = category_spending.get(cat, 0)
            variance = allocated - actual
            pct = round((actual / allocated * 100) if allocated > 0 else 100.0, 1)

            categories_summary.append({
                'category': cat,
                'allocated_cents': allocated,
                'allocated_formatted': round(allocated / 100, 2),
                'actual_cents': actual,
                'actual_formatted': round(actual / 100, 2),
                'variance_cents': variance,
                'variance_formatted': round(variance / 100, 2),
                'utilization_pct': pct,
                'status': 'OVER_BUDGET' if actual > allocated else ('WARNING' if pct >= 85 else 'ON_TRACK')
            })

        # Add categories that had spending but no initial budget
        budgeted_cats = {b['category'] for b in budgets}
        for cat, actual in category_spending.items():
            if cat not in budgeted_cats:
                categories_summary.append({
                    'category': cat,
                    'allocated_cents': 0,
                    'allocated_formatted': 0.0,
                    'actual_cents': actual,
                    'actual_formatted': round(actual / 100, 2),
                    'variance_cents': -actual,
                    'variance_formatted': -round(actual / 100, 2),
                    'utilization_pct': 100.0,
                    'status': 'UNBUDGETED'
                })

        overall_variance = total_budget_cents - total_actual_cents
        overall_pct = round((total_actual_cents / total_budget_cents * 100) if total_budget_cents > 0 else 0.0, 1)

        return {
            'total_budget_cents': total_budget_cents,
            'total_budget_formatted': round(total_budget_cents / 100, 2),
            'total_actual_cents': total_actual_cents,
            'total_actual_formatted': round(total_actual_cents / 100, 2),
            'overall_variance_cents': overall_variance,
            'overall_variance_formatted': round(overall_variance / 100, 2),
            'overall_utilization_pct': overall_pct,
            'categories': categories_summary
        }

    @staticmethod
    def calculate_sponsor_allocations(
        sponsors: List[Dict[str, Any]],  # [{'name': 'Google', 'committed_cents': 20000000, 'received_cents': 15000000}]
        total_expenses_cents: int
    ) -> Dict[str, Any]:
        """
        Tracks sponsorship funding vs total festival/event burn.
        """
        total_committed = sum(s.get('committed_cents', 0) for s in sponsors)
        total_received = sum(s.get('received_cents', 0) for s in sponsors)
        net_event_surplus_deficit = total_received - total_expenses_cents

        return {
            'total_sponsors': len(sponsors),
            'total_committed_cents': total_committed,
            'total_committed_formatted': round(total_committed / 100, 2),
            'total_received_cents': total_received,
            'total_received_formatted': round(total_received / 100, 2),
            'pending_collection_cents': total_committed - total_received,
            'pending_collection_formatted': round((total_committed - total_received) / 100, 2),
            'net_surplus_deficit_cents': net_event_surplus_deficit,
            'net_surplus_deficit_formatted': round(net_event_surplus_deficit / 100, 2),
            'status': 'SURPLUS' if net_event_surplus_deficit >= 0 else 'DEFICIT'
        }

    # ==========================
    # 3. OFFICE & BUSINESS MODULE
    # ==========================

    @staticmethod
    def generate_reimbursement_ledger(
        expenses: List[Dict[str, Any]],
        members_map: Dict[str, Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Organizes employee business expenses for finance reimbursement audit.
        Groups by employee, project tag, and cost center.
        """
        ledger = []
        for exp in expenses:
            if exp.get('category') == 'Settlement' or exp.get('status') == 'rejected':
                continue
            payer_id = exp['paid_by']
            member = members_map.get(payer_id, {})
            ledger.append({
                'expense_id': exp.get('id'),
                'title': exp.get('title'),
                'date': exp.get('date', datetime.now().strftime('%Y-%m-%d')),
                'employee_name': member.get('name', 'Unknown'),
                'employee_role': member.get('role', 'Member'),
                'amount_cents': exp.get('amount_cents', 0),
                'amount_formatted': round(exp.get('amount_cents', 0) / 100, 2),
                'project_tag': exp.get('project_tag', 'General Overhead'),
                'cost_center': exp.get('cost_center', 'Admin'),
                'tax_deductible': exp.get('tax_deductible', False),
                'approval_status': exp.get('status', 'approved'),
                'approved_by': exp.get('approved_by', 'Auto-Approved')
            })
        return ledger
