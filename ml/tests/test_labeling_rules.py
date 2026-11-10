"""
Unit Test Suite untuk Aturan Pelabelan Supervised Learning Keterlambatan Cicilan.
File: ml/tests/test_labeling_rules.py
"""

import unittest
from datetime import date
from ml.labeling_rules import (
    evaluate_term_label,
    EXCLUDED_NOT_DUE,
    EXCLUDED_AMBIGUOUS_PENDING,
    EXCLUDED_INVALID_AMOUNT,
)


class TestLabelingRules(unittest.TestCase):
    def setUp(self):
        self.term_id = "term-uuid-001"
        self.target_amount = 1000000
        self.due_date = date(2026, 11, 1)

    def test_on_time_single_payment(self):
        """Kasus 1: Pembayaran tunggal lunas tepat pada / sebelum tanggal jatuh tempo -> late = 0"""
        payments = [
            {
                "id": "pay-1",
                "installment_term_id": self.term_id,
                "amount": 1000000,
                "status": "verified",
                "payment_date": date(2026, 10, 28),
            }
        ]
        label, status, meta = evaluate_term_label(
            self.term_id,
            self.target_amount,
            self.due_date,
            payments,
            evaluation_date=date(2026, 11, 5),
        )
        self.assertEqual(label, 0)
        self.assertEqual(status, "ON_TIME")
        self.assertTrue(meta["is_fully_paid"])
        self.assertEqual(meta["settlement_date"], "2026-10-28")

    def test_on_time_multi_payment_staged(self):
        """Kasus 2: Pembayaran bertahap (parsial) yang seluruhnya selesai sebelum jatuh tempo -> late = 0"""
        payments = [
            {
                "id": "pay-1",
                "installment_term_id": self.term_id,
                "amount": 400000,
                "status": "verified",
                "payment_date": date(2026, 10, 20),
            },
            {
                "id": "pay-2",
                "installment_term_id": self.term_id,
                "amount": 600000,
                "status": "verified",
                "payment_date": date(2026, 10, 31),
            },
        ]
        label, status, meta = evaluate_term_label(
            self.term_id,
            self.target_amount,
            self.due_date,
            payments,
            evaluation_date=date(2026, 11, 5),
        )
        self.assertEqual(label, 0)
        self.assertEqual(status, "ON_TIME")
        self.assertEqual(meta["settlement_date"], "2026-10-31")

    def test_late_settled_after_due_date(self):
        """Kasus 3: Pembayaran bertahap, pelunasan terjadi setelah tanggal jatuh tempo -> late = 1"""
        payments = [
            {
                "id": "pay-1",
                "installment_term_id": self.term_id,
                "amount": 700000,
                "status": "verified",
                "payment_date": date(2026, 10, 30),  # Sebelum due date
            },
            {
                "id": "pay-2",
                "installment_term_id": self.term_id,
                "amount": 300000,
                "status": "verified",
                "payment_date": date(2026, 11, 4),  # Melewati due date (2026-11-01)
            },
        ]
        label, status, meta = evaluate_term_label(
            self.term_id,
            self.target_amount,
            self.due_date,
            payments,
            evaluation_date=date(2026, 11, 5),
        )
        self.assertEqual(label, 1)
        self.assertEqual(status, "LATE_SETTLED_AFTER_DUE")
        self.assertTrue(meta["is_fully_paid"])
        self.assertEqual(meta["settlement_date"], "2026-11-04")

    def test_late_overdue_unpaid_no_pending(self):
        """Kasus 4: Melewati jatuh tempo, belum lunas, tidak ada pending -> late = 1"""
        payments = [
            {
                "id": "pay-1",
                "installment_term_id": self.term_id,
                "amount": 300000,
                "status": "verified",
                "payment_date": date(2026, 10, 20),
            }
        ]
        label, status, meta = evaluate_term_label(
            self.term_id,
            self.target_amount,
            self.due_date,
            payments,
            evaluation_date=date(2026, 11, 5),  # 4 hari setelah due date
        )
        self.assertEqual(label, 1)
        self.assertEqual(status, "LATE_OVERDUE_UNPAID")
        self.assertFalse(meta["is_fully_paid"])
        self.assertEqual(meta["total_verified"], 300000.0)

    def test_excluded_ambiguous_pending_past_due(self):
        """Kasus 5: Melewati jatuh tempo, belum lunas, tapi ada pending -> Eksklusi (None)"""
        payments = [
            {
                "id": "pay-1",
                "installment_term_id": self.term_id,
                "amount": 500000,
                "status": "verified",
                "payment_date": date(2026, 10, 25),
            },
            {
                "id": "pay-2",
                "installment_term_id": self.term_id,
                "amount": 500000,
                "status": "pending",
                "payment_date": date(2026, 10, 31),
            },
        ]
        label, status, meta = evaluate_term_label(
            self.term_id,
            self.target_amount,
            self.due_date,
            payments,
            evaluation_date=date(2026, 11, 5),
        )
        self.assertIsNone(label)
        self.assertEqual(status, EXCLUDED_AMBIGUOUS_PENDING)
        self.assertFalse(meta["is_fully_paid"])
        self.assertEqual(meta["total_pending"], 500000.0)

    def test_excluded_future_term_not_due(self):
        """Kasus 6: Termin belum jatuh tempo dan belum lunas -> Eksklusi (None)"""
        payments = [
            {
                "id": "pay-1",
                "installment_term_id": self.term_id,
                "amount": 400000,
                "status": "verified",
                "payment_date": date(2026, 10, 20),
            }
        ]
        label, status, meta = evaluate_term_label(
            self.term_id,
            self.target_amount,
            self.due_date,
            payments,
            evaluation_date=date(2026, 10, 25),  # Sebelum due date (2026-11-01)
        )
        self.assertIsNone(label)
        self.assertEqual(status, EXCLUDED_NOT_DUE)

    def test_rejected_payment_ignored(self):
        """Kasus 7: Pembayaran rejected diabaikan dan tidak menambah total verified"""
        payments = [
            {
                "id": "pay-rejected",
                "installment_term_id": self.term_id,
                "amount": 1000000,
                "status": "rejected",
                "payment_date": date(2026, 10, 25),
            }
        ]
        label, status, meta = evaluate_term_label(
            self.term_id,
            self.target_amount,
            self.due_date,
            payments,
            evaluation_date=date(2026, 11, 5),
        )
        self.assertEqual(label, 1)
        self.assertEqual(status, "LATE_OVERDUE_UNPAID")
        self.assertEqual(meta["total_verified"], 0.0)

    def test_payment_without_term_id_ignored(self):
        """Kasus 8: Pembayaran tanpa installment_term_id (NULL / legacy) diabaikan dari alokasi termin"""
        payments = [
            {
                "id": "pay-full",
                "installment_term_id": None,
                "amount": 30000000,
                "status": "verified",
                "payment_date": date(2026, 10, 20),
            },
            {
                "id": "pay-other-term",
                "installment_term_id": "other-term-999",
                "amount": 1000000,
                "status": "verified",
                "payment_date": date(2026, 10, 20),
            },
        ]
        label, status, meta = evaluate_term_label(
            self.term_id,
            self.target_amount,
            self.due_date,
            payments,
            evaluation_date=date(2026, 11, 5),
        )
        self.assertEqual(label, 1)
        self.assertEqual(status, "LATE_OVERDUE_UNPAID")
        self.assertEqual(meta["total_verified"], 0.0)

    def test_invalid_target_amount_excluded(self):
        """Kasus 9: Target amount <= 0 atau due_date null dieksklusi"""
        label, status, _ = evaluate_term_label(
            self.term_id, 0, self.due_date, []
        )
        self.assertIsNone(label)
        self.assertEqual(status, EXCLUDED_INVALID_AMOUNT)


if __name__ == "__main__":
    unittest.main()

