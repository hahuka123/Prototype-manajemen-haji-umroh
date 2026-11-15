"""
Unit Test untuk Model Machine Learning, Evaluasi, dan Prediksi Keterlambatan Cicilan.
File: ml/tests/test_model.py
"""

import json
import os
import tempfile
import unittest

from ml.model import (
    StandardScaler,
    LogisticRegression,
    compute_evaluation_metrics,
    FEATURE_COLUMNS,
)
from ml.train import (
    validate_training_readiness,
    split_temporal_data,
    extract_matrix,
    train_model,
)
from ml.predictor import (
    categorize_risk,
    InstallmentRiskPredictor,
)


class TestMachineLearningModel(unittest.TestCase):

    def test_empty_dataset_validation(self):
        """1. Dataset kosong wajib mengembalikan is_ready = False dengan alasan yang jelas."""
        is_ready, reason, stats = validate_training_readiness([])
        self.assertFalse(is_ready)
        self.assertIn("Dataset kosong", reason)
        self.assertEqual(stats["sample_count"], 0)

    def test_insufficient_samples_validation(self):
        """2. Dataset dengan sampel < 10 wajib ditolak agar tidak overfit atau bias."""
        small_dataset = [{"late": "0"} for _ in range(5)] + [{"late": "1"} for _ in range(3)]
        is_ready, reason, stats = validate_training_readiness(small_dataset)
        self.assertFalse(is_ready)
        self.assertIn("belum memenuhi batas minimum", reason)
        self.assertEqual(stats["sample_count"], 8)

    def test_single_class_validation(self):
        """3. Dataset yang hanya memuat satu kelas (misal seluruhnya tepat waktu) wajib ditolak."""
        single_class_data = [{"late": "0"} for _ in range(20)]
        is_ready, reason, stats = validate_training_readiness(single_class_data)
        self.assertFalse(is_ready)
        self.assertIn("hanya memuat satu kelas", reason)

    def test_valid_dataset_validation(self):
        """4. Dataset dengan jumlah sampel cukup dan memuat kedua kelas lolos validasi."""
        valid_data = [{"late": "0"} for _ in range(12)] + [{"late": "1"} for _ in range(6)]
        is_ready, reason, stats = validate_training_readiness(valid_data)
        self.assertTrue(is_ready)
        self.assertEqual(stats["sample_count"], 18)
        self.assertEqual(stats["class_0_count"], 12)
        self.assertEqual(stats["class_1_count"], 6)

    def test_standard_scaler(self):
        """5. StandardScaler menghitung mean ~0 dan varians mendekati 1."""
        raw_data = [
            [10.0, 100.0],
            [20.0, 200.0],
            [30.0, 300.0],
            [40.0, 400.0],
        ]
        scaler = StandardScaler()
        scaled = scaler.fit_transform(raw_data)
        self.assertEqual(len(scaled), 4)
        self.assertEqual(len(scaled[0]), 2)
        # Mean kolom 0 setelah transformasi harus mendekati 0
        mean_col0 = sum(r[0] for r in scaled) / len(scaled)
        self.assertAlmostEqual(mean_col0, 0.0, places=5)

    def test_logistic_regression_fit_and_predict(self):
        """6. Logistic Regression berhasil konvergen dan menghasilkan probabilitas [0.0, 1.0]."""
        # Data uji sintetis linier sederhana
        X = [
            [-2.0, -1.5],
            [-1.8, -1.2],
            [-1.5, -2.0],
            [1.5, 2.0],
            [1.8, 1.5],
            [2.0, 1.8],
        ]
        y = [0, 0, 0, 1, 1, 1]

        clf = LogisticRegression(learning_rate=0.1, max_iter=500, random_state=42)
        clf.fit(X, y)
        self.assertTrue(clf.is_fitted_)

        probas = clf.predict_proba(X)
        self.assertEqual(len(probas), 6)
        for p in probas:
            self.assertGreaterEqual(p, 0.0)
            self.assertLessEqual(p, 1.0)

        # Sampel negatif harus memiliki probabilitas lebih rendah dari sampel positif
        self.assertLess(probas[0], probas[-1])

    def test_class_weight_balanced(self):
        """7. Bobot kelas seimbang memberikan penalti lebih tinggi pada kelas minoritas."""
        y_imbalanced = [0, 0, 0, 0, 1]  # 4 nol, 1 satu
        clf = LogisticRegression(class_weight="balanced")
        weights = clf._compute_sample_weights(y_imbalanced)
        # Bobot untuk kelas 1 (minoritas) harus lebih besar dari kelas 0 (mayoritas)
        self.assertGreater(weights[4], weights[0])

    def test_compute_evaluation_metrics(self):
        """8. Perhitungan Precision, Recall, F1-Score, dan Confusion Matrix akurat."""
        y_true = [1, 1, 0, 0, 1, 0]
        y_pred = [1, 0, 0, 0, 1, 1]  # TP=2, FN=1, TN=2, FP=1
        y_prob = [0.9, 0.4, 0.2, 0.1, 0.8, 0.7]

        metrics = compute_evaluation_metrics(y_true, y_pred, y_prob)
        self.assertEqual(metrics["status"], "EVALUATED")
        self.assertEqual(metrics["confusion_matrix"]["tp"], 2)
        self.assertEqual(metrics["confusion_matrix"]["fn"], 1)
        self.assertEqual(metrics["confusion_matrix"]["tn"], 2)
        self.assertEqual(metrics["confusion_matrix"]["fp"], 1)

        # Precision = TP / (TP+FP) = 2/3 = 0.6667
        self.assertAlmostEqual(metrics["precision"], 0.6667, places=3)
        # Recall = TP / (TP+FN) = 2/3 = 0.6667
        self.assertAlmostEqual(metrics["recall"], 0.6667, places=3)
        # F1 = 2 * (P*R)/(P+R) = 0.6667
        self.assertAlmostEqual(metrics["f1_score"], 0.6667, places=3)
        self.assertGreater(metrics["pr_auc"], 0.0)

    def test_predictor_input_validation_and_categorization(self):
        """9. Predictor menolak fitur tidak lengkap dan mengkategorikan risiko secara deterministik."""
        self.assertEqual(categorize_risk(0.20), "LOW")
        self.assertEqual(categorize_risk(0.50), "MEDIUM")
        self.assertEqual(categorize_risk(0.85), "HIGH")

        predictor = InstallmentRiskPredictor()
        predictor.feature_columns = ["f1", "f2"]
        # Validasi input gagal jika fitur kurang
        is_val, errs = predictor.validate_input({"f1": 10.0})
        self.assertFalse(is_val)
        self.assertIn("f2", errs[0])

    def test_model_serialization_and_deserialization(self):
        """10. Model dan scaler dapat disimpan dan dibaca kembali dari file JSON tanpa deviasi bobot."""
        X = [[1.0, 10.0], [2.0, 20.0], [3.0, 30.0], [4.0, 40.0]]
        y = [0, 0, 1, 1]

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        clf = LogisticRegression(random_state=42, max_iter=200)
        clf.fit(X_scaled, y, feature_names=["f1", "f2"])

        orig_probas = clf.predict_proba(X_scaled)

        payload = {
            "version": "v1.0.0-test",
            "feature_columns": ["f1", "f2"],
            "scaler": scaler.to_dict(),
            "classifier": clf.to_dict(),
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tf:
            json.dump(payload, tf)
            temp_path = tf.name

        try:
            loaded_pred = InstallmentRiskPredictor()
            loaded_pred.load_from_file(temp_path)
            self.assertTrue(loaded_pred.is_ready)

            res = loaded_pred.predict_single({"f1": 1.0, "f2": 10.0})
            self.assertTrue(res["is_valid"])
            self.assertAlmostEqual(res["risk_score"], round(orig_probas[0], 4), places=4)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)


if __name__ == "__main__":
    unittest.main()
