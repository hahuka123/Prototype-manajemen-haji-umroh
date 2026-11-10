"""
Unit Test Suite untuk Pipeline Persiapan Dataset dan Audit Anti-PII.
File: ml/tests/test_dataset_pipeline.py
ML Stage 2.2 — Prototype Manajemen Haji & Umrah.
"""

import os
import tempfile
import unittest
from datetime import date
from ml.dataset_pipeline import (
    process_dataset_from_records,
    export_dataset_to_csv,
    is_technical_test_record,
    FORBIDDEN_PII_KEYWORDS,
)


class TestDatasetPipeline(unittest.TestCase):
    def setUp(self):
        self.eval_date = date(2026, 11, 10)

        # Mock Packages
        self.packages = [
            {
                "id": "pkg-1",
                "name": "Paket Umrah A",
                "type": "Umrah Reguler",
                "price": "30000000",
                "departure_date": "2026-12-15",
                "duration": "12",
            }
        ]

        # Mock Jamaah (Dengan kolom PII realistis yang wajib dibuang)
        self.jamaah_list = [
            {
                "id": "jam-1",
                "full_name": "Fulan bin Fulan",
                "nik": "3201010000000001",
                "passport_number": "A12345678",
                "birth_date": "1990-05-15",
                "gender": "Laki-laki",
                "address": "Jl. Mawar No. 10 Jakarta",
                "phone": "081234567890",
                "package_id": "pkg-1",
            }
        ]

        # Mock Terms untuk Jamaah 1 (3 termin berurutan)
        self.terms = [
            # Termin 1: Target 10M, Due: 2026-10-01 (Sudah lewat)
            {
                "id": "term-1",
                "jamaah_id": "jam-1",
                "term_number": "1",
                "amount": "10000000",
                "due_date": "2026-10-01",
            },
            # Termin 2: Target 10M, Due: 2026-11-01 (Sudah lewat)
            {
                "id": "term-2",
                "jamaah_id": "jam-1",
                "term_number": "2",
                "amount": "10000000",
                "due_date": "2026-11-01",
            },
            # Termin 3: Target 10M, Due: 2026-12-01 (Masa depan)
            {
                "id": "term-3",
                "jamaah_id": "jam-1",
                "term_number": "3",
                "amount": "10000000",
                "due_date": "2026-12-01",
            },
        ]

        # Mock Payments
        self.payments = [
            # Pembayaran Termin 1: Lunas tepat waktu pada 2026-09-25 -> late = 0
            {
                "id": "pay-1",
                "installment_term_id": "term-1",
                "amount": "10000000",
                "status": "verified",
                "payment_date": "2026-09-25",
            },
            # Pembayaran Termin 2: Terlambat, lunas pada 2026-11-05 (due: 2026-11-01) -> late = 1
            {
                "id": "pay-2",
                "installment_term_id": "term-2",
                "amount": "10000000",
                "status": "verified",
                "payment_date": "2026-11-05",
            },
            # Pembayaran Termin 3: Belum ada pembayaran, due date masih masa depan -> Eksklusi
        ]

    def test_pipeline_labeling_and_exclusion(self):
        """Memvalidasi eksekusi pipeline menghasilkan label tepat, eksklusi benar, dan ringkasan akurat."""
        rows, summary = process_dataset_from_records(
            terms=self.terms,
            payments=self.payments,
            packages=self.packages,
            jamaah_list=self.jamaah_list,
            evaluation_date=self.eval_date,
        )

        self.assertEqual(summary["total_terms_evaluated"], 3)
        self.assertEqual(summary["labeled_count"], 2)
        self.assertEqual(summary["excluded_count"], 1)
        self.assertEqual(summary["excluded_not_due"], 1)

        # Dua termin yang berhasil dilabeli:
        self.assertEqual(len(rows), 2)
        row_term1 = rows[0]
        row_term2 = rows[1]

        # Termin 1: Tepat waktu (0)
        self.assertEqual(row_term1["term_number"], 1)
        self.assertEqual(row_term1["late"], 0)
        # Termin 1 adalah termin pertama, jadi riwayat sebelumnya = 0
        self.assertEqual(row_term1["prev_terms_count"], 0)
        self.assertEqual(row_term1["prev_late_count"], 0)

        # Termin 2: Terlambat (1)
        self.assertEqual(row_term2["term_number"], 2)
        self.assertEqual(row_term2["late"], 1)
        # Termin 2 melihat riwayat Termin 1 (1 prior term, 0 late)
        self.assertEqual(row_term2["prev_terms_count"], 1)
        self.assertEqual(row_term2["prev_late_count"], 0)

    def test_due_date_column_present_and_formatted(self):
        """Tugas 1: Memverifikasi kolom due_date tersedia pada output dalam format ISO YYYY-MM-DD."""
        rows, _ = process_dataset_from_records(
            terms=self.terms,
            payments=self.payments,
            packages=self.packages,
            jamaah_list=self.jamaah_list,
            evaluation_date=self.eval_date,
        )

        self.assertTrue(len(rows) > 0)
        for row in rows:
            self.assertIn("due_date", row)
            # Pastikan format ISO YYYY-MM-DD (panjang 10 karakter dengan tanda strip)
            due_str = row["due_date"]
            self.assertEqual(len(due_str), 10)
            parts = due_str.split("-")
            self.assertEqual(len(parts), 3)
            self.assertEqual(len(parts[0]), 4)  # Year
            self.assertEqual(len(parts[1]), 2)  # Month
            self.assertEqual(len(parts[2]), 2)  # Day

        self.assertEqual(rows[0]["due_date"], "2026-10-01")
        self.assertEqual(rows[1]["due_date"], "2026-11-01")

    def test_technical_test_data_filtered(self):
        """Tugas 2: Memverifikasi data dummy uji teknis staging (c0000000-..., d0000000-...) terfilter."""
        dummy_packages = [
            {
                "id": "d0000000-0000-0000-0000-000000000001",
                "name": "Paket Uji Konkurensi Final",
                "price": "30000000",
                "departure_date": "2026-12-15",
                "duration": "12",
            }
        ]
        dummy_jamaah = [
            {
                "id": "d0000000-0000-0000-0000-000000000002",
                "full_name": "Jamaah Uji",
                "nik": "9999000000000001",
                "address": "Jl. Konkurensi Final No. 1",
                "birth_date": "1995-05-05",
                "gender": "Laki-laki",
                "package_id": "d0000000-0000-0000-0000-000000000001",
            }
        ]
        dummy_terms = [
            {
                "id": "d0000000-0000-0000-0000-000000000003",
                "jamaah_id": "d0000000-0000-0000-0000-000000000002",
                "term_number": "1",
                "title": "Termin Uji Konkurensi Final",
                "amount": "1000000",
                "due_date": "2026-10-15",
            }
        ]

        rows, summary = process_dataset_from_records(
            terms=dummy_terms,
            payments=[],
            packages=dummy_packages,
            jamaah_list=dummy_jamaah,
            evaluation_date=self.eval_date,
        )

        # Harus 0 baris yang masuk dataset operasional
        self.assertEqual(len(rows), 0)
        self.assertEqual(summary["excluded_technical_test_data"], 1)
        self.assertTrue(len(summary["technical_test_details"]) > 0)
        self.assertIn("d0000000-", summary["technical_test_details"][0]["reason"])

    def test_operational_valid_data_not_filtered(self):
        """Tugas 2: Memverifikasi data operasional sah tidak ikut terfilter oleh filter uji teknis."""
        operational_package = {
            "id": "e4b52e31-8f52-4f35-901e-0123456789ab",
            "name": "Paket Umrah Plus Turki Reguler",
            "price": "35000000",
            "departure_date": "2026-12-20",
            "duration": "14",
        }
        operational_jamaah = {
            "id": "f8a91b22-7c33-4d44-8e55-9876543210fe",
            "full_name": "Ahmad Abdullah",
            "nik": "3201020304050002",
            "address": "Jl. Melati No. 45 Bandung",
            "birth_date": "1988-08-20",
            "gender": "Laki-laki",
            "package_id": "e4b52e31-8f52-4f35-901e-0123456789ab",
        }
        operational_term = {
            "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            "jamaah_id": "f8a91b22-7c33-4d44-8e55-9876543210fe",
            "term_number": "1",
            "title": "Termin 1 Pendaftaran",
            "amount": "10000000",
            "due_date": "2026-10-01",
        }
        operational_payment = {
            "id": "pay-op-1",
            "installment_term_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            "amount": "10000000",
            "status": "verified",
            "payment_date": "2026-09-28",
        }

        # Periksa fungsi helper langsung
        is_test, _ = is_technical_test_record(
            operational_term, operational_jamaah, operational_package
        )
        self.assertFalse(is_test)

        # Periksa melalui pipeline
        rows, summary = process_dataset_from_records(
            terms=[operational_term],
            payments=[operational_payment],
            packages=[operational_package],
            jamaah_list=[operational_jamaah],
            evaluation_date=self.eval_date,
        )

        self.assertEqual(len(rows), 1)
        self.assertEqual(summary["excluded_technical_test_data"], 0)
        self.assertEqual(rows[0]["late"], 0)

    def test_duplicate_term_id_detected(self):
        """Tugas 3: Memverifikasi duplikasi ID termin terdeteksi dan memicu error / laporan validasi jelas."""
        duplicate_terms = [
            {
                "id": "term-dup-1",
                "jamaah_id": "jam-1",
                "term_number": "1",
                "amount": "10000000",
                "due_date": "2026-10-01",
            },
            {
                "id": "term-dup-1",  # ID sama persis
                "jamaah_id": "jam-1",
                "term_number": "1",
                "amount": "10000000",
                "due_date": "2026-10-01",
            },
        ]

        # Mode default: raise_on_duplicate = True -> wajib melempar ValueError
        with self.assertRaises(ValueError) as ctx:
            process_dataset_from_records(
                terms=duplicate_terms,
                payments=[],
                packages=self.packages,
                jamaah_list=self.jamaah_list,
                evaluation_date=self.eval_date,
                raise_on_duplicate=True,
            )
        self.assertIn("term-dup-1", str(ctx.exception))
        self.assertIn("duplikat", str(ctx.exception).lower())

        # Mode non-strict: raise_on_duplicate = False -> mencatat duplikat tanpa menghasilkan 2 baris
        rows, summary = process_dataset_from_records(
            terms=duplicate_terms,
            payments=[],
            packages=self.packages,
            jamaah_list=self.jamaah_list,
            evaluation_date=self.eval_date,
            raise_on_duplicate=False,
        )
        self.assertEqual(summary["duplicate_terms_count"], 1)
        self.assertIn("term-dup-1", summary["duplicate_term_ids"])
        # Hanya menghasilkan maksimal 1 baris unik
        self.assertLessEqual(len(rows), 1)

    def test_empty_csv_and_missing_mandatory_columns(self):
        """Tugas 4: Memverifikasi CSV kosong dan kolom hilang ditangani secara aman tanpa unhandled exception."""
        # 1. Dataset kosong total
        rows_empty, summary_empty = process_dataset_from_records(
            terms=[],
            payments=[],
            packages=[],
            jamaah_list=[],
            evaluation_date=self.eval_date,
        )
        self.assertEqual(len(rows_empty), 0)
        self.assertEqual(summary_empty["total_terms_raw"], 0)
        self.assertEqual(summary_empty["labeled_count"], 0)

        # 2. Kolom mandatory hilang pada termin / paket / jamaah
        incomplete_terms = [
            {
                "id": "term-incomplete",
                # jamaah_id, amount, due_date tidak ada
            }
        ]
        rows_inc, summary_inc = process_dataset_from_records(
            terms=incomplete_terms,
            payments=[],
            packages=[],
            jamaah_list=[],
            evaluation_date=self.eval_date,
        )
        # Termin dengan amount/due_date hilang otomatis masuk kategori excluded invalid
        self.assertEqual(len(rows_inc), 0)
        self.assertEqual(summary_inc["excluded_invalid"], 1)

    def test_strict_pii_exclusion(self):
        """Audit Anti-PII: Menjamin tidak ada satupun kolom atau nilai PII di dataset akhir."""
        rows, summary = process_dataset_from_records(
            terms=self.terms,
            payments=self.payments,
            packages=self.packages,
            jamaah_list=self.jamaah_list,
            evaluation_date=self.eval_date,
        )

        self.assertTrue(summary["pii_audit_passed"])
        self.assertEqual(len(summary["pii_violations"]), 0)

        for row in rows:
            for key in row.keys():
                for kw in FORBIDDEN_PII_KEYWORDS:
                    self.assertNotIn(
                        kw,
                        key.lower(),
                        f"Pelanggaran PII: Ditemukan keyword terlarang '{kw}' pada nama kolom '{key}'",
                    )

            # Periksa bahwa identifier asli bukan NIK atau nama
            self.assertFalse(str(row["term_id_hash"]).startswith("3201"))
            self.assertFalse("Fulan" in str(row.values()))

    def test_feature_engineering_correctness(self):
        """Memeriksa kalkulasi fitur rasio termin, usia jamaah, dan selisih hari keberangkatan."""
        rows, _ = process_dataset_from_records(
            terms=self.terms,
            payments=self.payments,
            packages=self.packages,
            jamaah_list=self.jamaah_list,
            evaluation_date=self.eval_date,
        )

        row = rows[0]
        # term_amount (10M) / package_price (30M) = ~0.3333
        self.assertAlmostEqual(row["term_amount_ratio"], 0.3333, places=3)
        self.assertEqual(row["package_duration"], 12)
        self.assertEqual(row["gender_encoded"], 1)  # Laki-laki = 1

        # Usia jamaah lahir 1990-05-15 saat due_date 2026-10-01 adalah 36 tahun
        self.assertEqual(row["jamaah_age"], 36)

        # Selisih hari departure_date 2026-12-15 - due_date 2026-10-01 = 75 hari
        self.assertEqual(row["days_due_to_departure"], 75)

    def test_csv_export_and_integrity(self):
        """Memvalidasi proses ekspor ke CSV anonim memuat due_date dan bebas PII."""
        rows, _ = process_dataset_from_records(
            terms=self.terms,
            payments=self.payments,
            packages=self.packages,
            jamaah_list=self.jamaah_list,
            evaluation_date=self.eval_date,
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            out_file = os.path.join(tmpdir, "test_dataset_output.csv")
            export_dataset_to_csv(rows, out_file)

            self.assertTrue(os.path.exists(out_file))
            with open(out_file, "r", encoding="utf-8") as f:
                content = f.read()
                # Pastikan header memuat target, fitur anonim, dan due_date
                self.assertIn("term_id_hash", content)
                self.assertIn("due_date", content)
                self.assertIn("late", content)
                self.assertIn("term_amount_ratio", content)
                # Pastikan tidak ada nama atau NIK di teks CSV
                self.assertNotIn("Fulan", content)
                self.assertNotIn("3201010000000001", content)
                self.assertNotIn("081234567890", content)


if __name__ == "__main__":
    unittest.main()
