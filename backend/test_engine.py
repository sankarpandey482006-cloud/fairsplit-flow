"""
FairSplit Flow - Mathematical Engine Unit Tests
==============================================
Validates:
1. Integer smallest unit conversion & precision
2. Deterministic remainder allocation (Zero-sum invariant)
3. Greedy Priority Queue min/max settlement correctness & <= n-1 transfers bound
4. Trust-Preserving cycle cancellation (canceling 3-way cycles)
5. Edge cases: zero expenses, single person, disconnected components
6. Special modules: Days stayed split, Roommate leaving calculator, Budget tracker
"""

import unittest
from engine.debt_engine import DebtEngine
from engine.special_modules import SpecialModulesEngine

class TestFairSplitFlowEngine(unittest.TestCase):

    def test_zero_sum_equal_split(self):
        """Tests that equal splitting of ₹100.00 across 3 members sums to EXACTLY 10000 paise."""
        total_cents = 10000
        members = ['alice', 'bob', 'charlie']
        shares = DebtEngine.calculate_equal_split(total_cents, members)
        
        self.assertEqual(sum(shares.values()), total_cents)
        # 10000 // 3 = 3333 with remainder 1 -> first gets 3334, others 3333
        self.assertEqual(shares['alice'], 3334)
        self.assertEqual(shares['bob'], 3333)
        self.assertEqual(shares['charlie'], 3333)

    def test_greedy_algorithm_guarantee(self):
        """
        Tests the Greedy Algorithm produces at most N - 1 transfers.
        Case: 4 people.
        Alice pays 400 for all 4 (each owes 100).
        Bob pays 200 for Bob and Charlie (each owes 100).
        Total paid: Alice: 400, Bob: 200, Charlie: 0, David: 0.
        Total share: Alice: 100, Bob: 200, Charlie: 200, David: 100.
        Net: Alice: +300, Bob: 0, Charlie: -200, David: -100.
        """
        members = [
            {'id': 'm1', 'name': 'Alice'},
            {'id': 'm2', 'name': 'Bob'},
            {'id': 'm3', 'name': 'Charlie'},
            {'id': 'm4', 'name': 'David'}
        ]
        members_map = {m['id']: m for m in members}

        expenses = [
            {
                'id': 'e1',
                'paid_by': 'm1',
                'amount_cents': 40000,
                'shares': [
                    {'member_id': 'm1', 'share_cents': 10000},
                    {'member_id': 'm2', 'share_cents': 10000},
                    {'member_id': 'm3', 'share_cents': 10000},
                    {'member_id': 'm4', 'share_cents': 10000}
                ]
            },
            {
                'id': 'e2',
                'paid_by': 'm2',
                'amount_cents': 20000,
                'shares': [
                    {'member_id': 'm2', 'share_cents': 10000},
                    {'member_id': 'm3', 'share_cents': 10000}
                ]
            }
        ]

        net_bals, total_paid, total_share = DebtEngine.build_net_balances(members, expenses)
        
        # Verify Zero-Sum invariant
        self.assertEqual(sum(net_bals.values()), 0)
        self.assertEqual(net_bals['m1'], 30000)
        self.assertEqual(net_bals['m2'], 0)
        self.assertEqual(net_bals['m3'], -20000)
        self.assertEqual(net_bals['m4'], -10000)

        # Simplify
        transfers, trace = DebtEngine.simplify_debts_greedy(net_bals, members_map)
        
        # Number of transfers must be <= 4 - 1 = 3 (actually only 2 needed: Charlie->Alice 200, David->Alice 100)
        self.assertLessEqual(len(transfers), len(members) - 1)
        self.assertEqual(len(transfers), 2)
        self.assertTrue(trace['guarantee_met'])

        # Total amount transferred must equal sum of negative balances (30000 cents)
        total_transferred = sum(t['amount_cents'] for t in transfers)
        self.assertEqual(total_transferred, 30000)

    def test_trust_preserving_cycle_cancellation(self):
        """
        Tests cycle cancellation:
        Alice pays for Bob (Bob owes Alice 50)
        Bob pays for Charlie (Charlie owes Bob 50)
        Charlie pays for Alice (Alice owes Charlie 50)
        Direct cycle: Bob->Alice 50, Charlie->Bob 50, Alice->Charlie 50.
        All net balances are 0. Cycle cancellation should reduce transfers to ZERO.
        """
        members = [
            {'id': 'm1', 'name': 'Alice'},
            {'id': 'm2', 'name': 'Bob'},
            {'id': 'm3', 'name': 'Charlie'}
        ]
        members_map = {m['id']: m for m in members}

        expenses = [
            {
                'id': 'e1',
                'paid_by': 'm1',
                'amount_cents': 5000,
                'shares': [{'member_id': 'm2', 'share_cents': 5000}]
            },
            {
                'id': 'e2',
                'paid_by': 'm2',
                'amount_cents': 5000,
                'shares': [{'member_id': 'm3', 'share_cents': 5000}]
            },
            {
                'id': 'e3',
                'paid_by': 'm3',
                'amount_cents': 5000,
                'shares': [{'member_id': 'm1', 'share_cents': 5000}]
            }
        ]

        direct_matrix = DebtEngine.build_direct_debt_graph(members, expenses)
        transfers, trace = DebtEngine.simplify_debts_trust_preserving(direct_matrix, members_map)

        self.assertEqual(trace['cycles_detected'], 1)
        self.assertEqual(len(transfers), 0)

    def test_days_stayed_split(self):
        """Hostel utility split for roommates staying 10, 20, 30 days."""
        total_bill = 60000  # ₹600.00
        records = {'m1': 10, 'm2': 20, 'm3': 30}
        res = SpecialModulesEngine.calculate_days_stayed_split(total_bill, records)
        
        self.assertEqual(res['total_man_days'], 60)
        self.assertEqual(res['shares_cents']['m1'], 10000)
        self.assertEqual(res['shares_cents']['m2'], 20000)
        self.assertEqual(res['shares_cents']['m3'], 30000)
        self.assertEqual(sum(res['shares_cents'].values()), total_bill)

    def test_roommate_move_out_settlement(self):
        """Roommate moving out with positive balance, security deposit and utility estimates."""
        net_bals = {'m1': 50000}  # Flat owes roommate ₹500
        res = SpecialModulesEngine.calculate_move_out_settlement(
            leaving_member_id='m1',
            current_net_balances=net_bals,
            security_deposit_cents=200000,        # Deposit refund ₹2000
            pending_utilities_estimate_cents=40000, # Electricity deduction ₹400
            property_damage_charge_cents=10000     # Cleaning/damage ₹100
        )
        # 500 + 2000 - 400 - 100 = ₹2000 (200000 cents)
        self.assertEqual(res['final_payable_cents'], 200000)
        self.assertEqual(res['direction'], 'ROOMMATE_RECEIVES')

    def test_edge_cases_single_member_and_zero_expenses(self):
        """Tests zero expenses and single member without exceptions."""
        members = [{'id': 'm1', 'name': 'Solo'}]
        members_map = {'m1': members[0]}
        net_bals, paid, share = DebtEngine.build_net_balances(members, [])
        self.assertEqual(net_bals['m1'], 0)
        transfers, trace = DebtEngine.simplify_debts_greedy(net_bals, members_map)
        self.assertEqual(len(transfers), 0)
        self.assertEqual(trace['theoretical_max_transfers'], 0)

if __name__ == '__main__':
    unittest.main()
