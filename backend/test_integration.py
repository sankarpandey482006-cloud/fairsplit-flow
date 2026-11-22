"""
FairSplit Flow - End-to-End API and Static Serving Verification
==============================================================
"""

import unittest
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app import app
from database import init_db
from seed_data import seed_demo_data

class TestFairSplitIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        seed_demo_data()
        cls.client = app.test_client()

    def test_frontend_serving(self):
        """Tests that index.html and static assets are properly served."""
        res = self.client.get('/')
        self.assertEqual(res.status_code, 200)
        self.assertIn(b'FairSplit Flow', res.data)

        res_css = self.client.get('/css/style.css')
        self.assertEqual(res_css.status_code, 200)

        res_js = self.client.get('/js/app.js')
        self.assertEqual(res_js.status_code, 200)

    def test_groups_api(self):
        """Tests groups listing and details."""
        res = self.client.get('/api/groups')
        self.assertEqual(res.status_code, 200)
        groups = res.json
        self.assertGreaterEqual(len(groups), 4)

        g1 = groups[0]
        res_detail = self.client.get(f"/api/groups/{g1['id']}")
        self.assertEqual(res_detail.status_code, 200)
        data = res_detail.json
        self.assertTrue(data['zero_sum_verified'])
        self.assertIn('members', data)
        self.assertIn('expenses', data)

    def test_debt_simplification_modes(self):
        """Tests both Greedy and Trust-Preserving settlement endpoints."""
        res_greedy = self.client.get('/api/groups/grp_goa_trip/settlements?mode=greedy')
        self.assertEqual(res_greedy.status_code, 200)
        greedy_data = res_greedy.json
        self.assertTrue(greedy_data['zero_sum_verified'])
        self.assertTrue(greedy_data['metrics']['guarantee_achieved'])
        self.assertLessEqual(greedy_data['after_graph']['transfers_count'], 3)

        res_trust = self.client.get('/api/groups/grp_goa_trip/settlements?mode=trust_preserving')
        self.assertEqual(res_trust.status_code, 200)
        trust_data = res_trust.json
        self.assertIn('transfers', trust_data['after_graph'])

    def test_add_expense_and_verify_zero_sum(self):
        """Tests adding an expense and checking that zero-sum invariant holds."""
        payload = {
            'title': 'Integration Test Coffee',
            'amount': 300.0,
            'paid_by': 'm_sankalp',
            'category': 'Food & Drink',
            'split_type': 'equal',
            'mode': 'shared',
            'selected_members': ['m_sankalp', 'm_rohit', 'm_priya']
        }
        res_add = self.client.post('/api/groups/grp_goa_trip/expenses',
                                   data=json.dumps(payload),
                                   content_type='application/json')
        self.assertEqual(res_add.status_code, 201)

        # Check group detail zero-sum
        res_detail = self.client.get('/api/groups/grp_goa_trip')
        self.assertTrue(res_detail.json['zero_sum_verified'])

    def test_special_modules(self):
        """Tests move-out calculation, club budget, and office reimbursements."""
        # Hostel Move-out
        res_hostel = self.client.get('/api/groups/grp_flat_402/special/hostel/move-out?member_id=m_flat_vikram&security_deposit=2000&pending_utilities=400&damage_charges=100')
        self.assertEqual(res_hostel.status_code, 200)
        self.assertIn('final_payable_formatted', res_hostel.json)

        # Club Budget
        res_club = self.client.get('/api/groups/grp_techfest/special/club/budget')
        self.assertEqual(res_club.status_code, 200)
        self.assertIn('budgets', res_club.json)
        self.assertIn('sponsors', res_club.json)

        # Office Reimbursements
        res_office = self.client.get('/api/groups/grp_alpha_ai/special/office/reimbursements')
        self.assertEqual(res_office.status_code, 200)
        self.assertIn('ledger', res_office.json)

    def test_exports_and_public_report(self):
        """Tests WhatsApp text, CSV, and public report."""
        res_wa = self.client.get('/api/groups/grp_goa_trip/export/whatsapp')
        self.assertEqual(res_wa.status_code, 200)
        self.assertIn('FairSplit Flow', res_wa.json['text'])

        res_csv = self.client.get('/api/groups/grp_goa_trip/export/csv')
        self.assertEqual(res_csv.status_code, 200)
        self.assertIn(b'Expense ID,Date,Title', res_csv.data)

        res_pub = self.client.get('/api/public/report/GOA2026')
        self.assertEqual(res_pub.status_code, 200)
        self.assertIn('Goa Beach Roadtrip', res_pub.json['group_name'])

if __name__ == '__main__':
    unittest.main()
