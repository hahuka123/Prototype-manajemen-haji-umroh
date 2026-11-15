"""
Unit Test untuk Arsitektur Batch Ingestion ML ke Supabase Staging.
File: ml/tests/test_batch_ingestion.py
"""

import json
import os
import tempfile
import unittest

from ml.batch_predict import (
    validate_active_model_artifact,
    run_batch_prediction,
)
from ml.export_predictions_to_supabase import (
    verify_staging_target,
    validate_prediction_payload_security,
    export_to_supabase,
    EXPECTED_STAGING_PROJECT_REF,
)
from ml.model import FEATURE_COLUMNS


class TestBatchIngestion(unittest.TestCase):

    def test_verify_staging_target_accepts_staging_ref(self):
        """1. Target URL yang memuat project ref Staging sah wajib diterima."""
        valid_url = f"https://{EXPECTED_STAGING_PROJECT_REF}.supabase.co"
        is_ok, msg = verify_staging_target(valid_url)
        self.assertTrue(is_ok)
        self.assertIn("Target terverifikasi", msg)

    def test_verify_staging_target_rejects_production_ref(self):
        """2. Target URL yang mengarah ke Production wajib DITOLAK secara tegas."""
        prod_url = "https://tzeayzjankoxrrurcerf.supabase.co"
        is_ok, msg = verify_staging_target(prod_url)
        self.assertFalse(is_ok)
        self.assertIn("Pencegahan Fatal", msg)
        self.assertIn("melindungi data Production", msg)

    def test_verify_staging_target_rejects_empty_url(self):
        """3. URL kosong wajib ditolak."""
        is_ok, msg = verify_staging_target("")
        self.assertFalse(is_ok)

    def test_validate_prediction_payload_security_passes_clean_data(self):
        """4. Payload prediksi tanpa data pribadi (PII) lolos validasi keamanan."""
        clean_predictions = [
            {
                "term_id": "a0000000-0000-0000-0000-000000000001",
                "jamaah_id": "b0000000-0000-0000-0000-000000000001",
                "risk_score": 0.45,
                "risk_level": "MEDIUM",
                "model_version": "v1.0.0-logistic-regression",
                "feature_snapshot": {
                    "term_number": 2,
                    "term_amount": 5000000.0,
                    "package_price": 35000000.0,
                },
                "predicted_at": "2026-11-15T12:00:00",
            }
        ]
        is_ok, violations = validate_prediction_payload_security(clean_predictions)
        self.assertTrue(is_ok)
        self.assertEqual(len(violations), 0)

    def test_validate_prediction_payload_security_catches_pii(self):
        """5. Payload yang memuat data pribadi (PII) wajib terdeteksi dan digagalkan."""
        leaked_predictions = [
            {
                "term_id": "a0000000-0000-0000-0000-000000000001",
                "jamaah_id": "b0000000-0000-0000-0000-000000000001",
                "risk_score": 0.45,
                "risk_level": "MEDIUM",
                "model_version": "v1.0.0",
                "feature_snapshot": {
                    "nik": "3201123456780001",  # PII dilarang!
                },
            }
        ]
        is_ok, violations = validate_prediction_payload_security(leaked_predictions)
        self.assertFalse(is_ok)
        self.assertTrue(any("Pelanggaran PII" in v for v in violations))

    def test_validate_active_model_artifact_status(self):
        """6. Hanya model berstatus 'active' dan telah dievaluasi yang diterima."""
        inactive_model = {
            "version": "v1.0.0",
            "status": "ready",  # Belum active
            "evaluation": {"status": "EVALUATED"},
            "scaler": {"mean": [0.0], "scale": [1.0]},
            "classifier": {"weights": [0.1], "bias": 0.0},
        }
        is_ok, msg = validate_active_model_artifact(inactive_model)
        self.assertFalse(is_ok)
        self.assertIn("tidak berstatus 'active'", msg)

        unevaluated_model = {
            "version": "v1.0.0",
            "status": "active",
            "evaluation": None,  # Belum dievaluasi
            "scaler": {"mean": [0.0], "scale": [1.0]},
            "classifier": {"weights": [0.1], "bias": 0.0},
        }
        is_ok2, msg2 = validate_active_model_artifact(unevaluated_model)
        self.assertFalse(is_ok2)
        self.assertIn("belum memiliki metrik evaluasi formal", msg2)

    def test_run_batch_prediction_with_mock_model(self):
        """7. Batch predict memproses data uji in-memory dan menghasilkan output terstruktur."""
        mock_model_payload = {
            "version": "v1.0.0-test",
            "algorithm": "LogisticRegression",
            "status": "active",
            "feature_columns": FEATURE_COLUMNS,
            "scaler": {
                "mean": [0.0] * len(FEATURE_COLUMNS),
                "scale": [1.0] * len(FEATURE_COLUMNS),
                "n_features": len(FEATURE_COLUMNS),
            },
            "classifier": {
                "weights": [0.1] * len(FEATURE_COLUMNS),
                "bias": 0.0,
                "is_fitted": True,
            },
            "evaluation": {
                "status": "EVALUATED",
                "precision": 0.8,
                "recall": 0.75,
            },
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tf_model:
            json.dump(mock_model_payload, tf_model)
            model_file = tf_model.name

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tf_out:
            out_file = tf_out.name

        try:
            # Data uji sintetis untuk unit test (tidak disimpan ke dataset operasional)
            sample_terms = [
                {
                    "term_id": "mock-term-001",
                    "jamaah_id": "mock-jamaah-001",
                    **{col: 1.0 for col in FEATURE_COLUMNS},
                }
            ]
            res = run_batch_prediction(
                terms_features_list=sample_terms,
                model_path=model_file,
                output_path=out_file,
            )

            self.assertEqual(res["status"], "SUCCESS")
            self.assertEqual(res["valid_predictions_count"], 1)
            pred = res["predictions"][0]
            self.assertEqual(pred["term_id"], "mock-term-001")
            self.assertIn("risk_score", pred)
            self.assertIn(pred["risk_level"], ["LOW", "MEDIUM", "HIGH"])
            self.assertEqual(pred["model_version"], "v1.0.0-test")
        finally:
            if os.path.exists(model_file):
                os.remove(model_file)
            if os.path.exists(out_file):
                os.remove(out_file)

    def test_export_to_supabase_dry_run_safety(self):
        """8. Mode dry-run memverifikasi file dan payload tanpa melakukan HTTP POST riil."""
        # Uji dengan env file palsu yang mengarah ke Production: wajib ditolak sebelum membaca model
        with tempfile.NamedTemporaryFile(mode="w", suffix=".env", delete=False) as tf_env:
            tf_env.write("VITE_SUPABASE_URL=https://tzeayzjankoxrrurcerf.supabase.co\n")
            tf_env.write("VITE_SUPABASE_ANON_KEY=test-key\n")
            env_file = tf_env.name

        try:
            res = export_to_supabase(env_file=env_file, dry_run=True)
            self.assertFalse(res["is_success"])
            self.assertTrue(any("Pencegahan Fatal" in err for err in res["errors"]))
        finally:
            if os.path.exists(env_file):
                os.remove(env_file)


if __name__ == "__main__":
    unittest.main()
