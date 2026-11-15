"""
Modul Model Machine Learning Baseline: Logistic Regression untuk Prediksi Risiko Keterlambatan Cicilan.
File: ml/model.py
ML Stage 3 — Prototype Manajemen Haji & Umrah.

Fitur & Karakteristik:
1. Implementasi deterministik mandiri (Pure Python / Standar Library) tanpa ketergantungan binary C.
2. Standardisasi fitur (StandardScaler): fit pada data training saja untuk mencegah data leakage.
3. Penanganan ketidakseimbangan kelas (class_weight='balanced') untuk mengutamakan recall keterlambatan.
4. Fungsi aktivasi Sigmoid, optimisasi Gradient Descent dengan penalti L2 (Ridge).
5. Metrik evaluasi lengkap: Precision, Recall, F1-Score, PR-AUC, dan Confusion Matrix (TP, FP, TN, FN).
6. Serialisasi model ke format JSON terstruktur lengkap dengan metadata versi, parameter skalar, dan bobot.
7. Validasi ketat terhadap input sebelum inferensi / prediksi.
"""

import json
import math
import os
import random
from typing import Dict, List, Optional, Tuple, Any


FEATURE_COLUMNS = [
    "term_number",
    "term_amount",
    "package_price",
    "term_amount_ratio",
    "package_duration",
    "days_due_to_departure",
    "jamaah_age",
    "gender_encoded",
    "prev_terms_count",
    "prev_late_count",
    "prev_late_ratio",
]


class StandardScaler:
    """Standardisasi fitur dengan menghapus rata-rata dan menskalakan ke varians unit."""

    def __init__(self):
        self.mean_: List[float] = []
        self.scale_: List[float] = []
        self.n_features_: int = 0

    def fit(self, X: List[List[float]]) -> "StandardScaler":
        if not X or not X[0]:
            raise ValueError("Data X kosong atau tidak memiliki fitur.")
        n_samples = len(X)
        self.n_features_ = len(X[0])
        self.mean_ = [0.0] * self.n_features_
        self.scale_ = [1.0] * self.n_features_

        # 1. Hitung Mean
        for j in range(self.n_features_):
            col_sum = sum(X[i][j] for i in range(n_samples))
            self.mean_[j] = col_sum / n_samples

        # 2. Hitung Standar Deviasi
        for j in range(self.n_features_):
            variance = sum((X[i][j] - self.mean_[j]) ** 2 for i in range(n_samples)) / n_samples
            std = math.sqrt(variance)
            # Hindari pembagian dengan nol jika varians konstan
            self.scale_[j] = std if std > 1e-9 else 1.0

        return self

    def transform(self, X: List[List[float]]) -> List[List[float]]:
        if not self.mean_ or not self.scale_:
            raise ValueError("StandardScaler belum di-fit.")
        return [
            [(x[j] - self.mean_[j]) / self.scale_[j] for j in range(self.n_features_)]
            for x in X
        ]

    def fit_transform(self, X: List[List[float]]) -> List[List[float]]:
        return self.fit(X).transform(X)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mean": self.mean_,
            "scale": self.scale_,
            "n_features": self.n_features_,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "StandardScaler":
        scaler = cls()
        scaler.mean_ = [float(v) for v in data.get("mean", [])]
        scaler.scale_ = [float(v) for v in data.get("scale", [])]
        scaler.n_features_ = int(data.get("n_features", len(scaler.mean_)))
        return scaler


def sigmoid(z: float) -> float:
    """Fungsi Sigmoid numerik stabil dengan batasan clipping."""
    z_clipped = max(-500.0, min(500.0, z))
    return 1.0 / (1.0 + math.exp(-z_clipped))


class LogisticRegression:
    """Model klasifikasi Logistic Regression baseline dengan regularisasi L2 dan bobot kelas."""

    def __init__(
        self,
        learning_rate: float = 0.05,
        max_iter: int = 1000,
        l2_penalty: float = 0.01,
        class_weight: str = "balanced",
        random_state: int = 42,
    ):
        self.learning_rate = learning_rate
        self.max_iter = max_iter
        self.l2_penalty = l2_penalty
        self.class_weight = class_weight
        self.random_state = random_state

        self.weights_: List[float] = []
        self.bias_: float = 0.0
        self.feature_names_: List[str] = []
        self.is_fitted_: bool = False

    def _compute_sample_weights(self, y: List[int]) -> List[float]:
        """Hitung bobot per sampel untuk menangani ketidakseimbangan kelas (class imbalance)."""
        if self.class_weight != "balanced":
            return [1.0] * len(y)

        n_samples = len(y)
        n_class_0 = sum(1 for label in y if label == 0)
        n_class_1 = sum(1 for label in y if label == 1)

        # Bobot berbanding terbalik dengan frekuensi kelas
        w0 = (n_samples / (2.0 * n_class_0)) if n_class_0 > 0 else 1.0
        w1 = (n_samples / (2.0 * n_class_1)) if n_class_1 > 0 else 1.0

        return [w1 if label == 1 else w0 for label in y]

    def fit(
        self,
        X: List[List[float]],
        y: List[int],
        feature_names: Optional[List[str]] = None,
    ) -> "LogisticRegression":
        if not X or len(X) == 0:
            raise ValueError("Data training X tidak boleh kosong.")
        if len(X) != len(y):
            raise ValueError(f"Dimensi X ({len(X)}) dan y ({len(y)}) tidak cocok.")

        unique_labels = set(y)
        if len(unique_labels) < 2:
            raise ValueError(
                f"Data hanya memuat satu kelas {unique_labels}. Klasifikasi biner membutuhkan kelas 0 dan 1."
            )

        n_samples = len(X)
        n_features = len(X[0])
        self.feature_names_ = feature_names or [f"feature_{i}" for i in range(n_features)]

        # Inisialisasi bobot deterministik
        rng = random.Random(self.random_state)
        self.weights_ = [rng.uniform(-0.01, 0.01) for _ in range(n_features)]
        self.bias_ = 0.0

        sample_weights = self._compute_sample_weights(y)

        # Gradient Descent dengan penalti L2
        for _ in range(self.max_iter):
            dw = [0.0] * n_features
            db = 0.0

            for i in range(n_samples):
                xi = X[i]
                yi = y[i]
                sw = sample_weights[i]

                # z = w . x + b
                z = sum(self.weights_[j] * xi[j] for j in range(n_features)) + self.bias_
                p = sigmoid(z)
                err = (p - yi) * sw

                for j in range(n_features):
                    dw[j] += err * xi[j]
                db += err

            # Update bobot dengan penalti L2 (kecuali bias)
            for j in range(n_features):
                grad = (dw[j] / n_samples) + (self.l2_penalty * self.weights_[j])
                self.weights_[j] -= self.learning_rate * grad
            self.bias_ -= self.learning_rate * (db / n_samples)

        self.is_fitted_ = True
        return self

    def predict_proba(self, X: List[List[float]]) -> List[float]:
        """Mengembalikan probabilitas kelas 1 (terlambat) untuk setiap baris fitur."""
        if not self.is_fitted_:
            raise ValueError("Model belum di-training.")
        probas = []
        n_features = len(self.weights_)
        for row in X:
            if len(row) != n_features:
                raise ValueError(
                    f"Jumlah fitur ({len(row)}) tidak cocok dengan model ({n_features})."
                )
            z = sum(self.weights_[j] * row[j] for j in range(n_features)) + self.bias_
            probas.append(sigmoid(z))
        return probas

    def predict(self, X: List[List[float]], threshold: float = 0.5) -> List[int]:
        """Mengembalikan prediksi biner (0 atau 1) dengan ambang batas (default: 0.5)."""
        probas = self.predict_proba(X)
        return [1 if p >= threshold else 0 for p in probas]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "algorithm": "LogisticRegression",
            "feature_names": self.feature_names_,
            "weights": self.weights_,
            "bias": self.bias_,
            "hyperparameters": {
                "learning_rate": self.learning_rate,
                "max_iter": self.max_iter,
                "l2_penalty": self.l2_penalty,
                "class_weight": self.class_weight,
                "random_state": self.random_state,
            },
            "is_fitted": self.is_fitted_,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LogisticRegression":
        params = data.get("hyperparameters", {})
        model = cls(
            learning_rate=params.get("learning_rate", 0.05),
            max_iter=params.get("max_iter", 1000),
            l2_penalty=params.get("l2_penalty", 0.01),
            class_weight=params.get("class_weight", "balanced"),
            random_state=params.get("random_state", 42),
        )
        model.feature_names_ = data.get("feature_names", [])
        model.weights_ = [float(w) for w in data.get("weights", [])]
        model.bias_ = float(data.get("bias", 0.0))
        model.is_fitted_ = bool(data.get("is_fitted", True))
        return model


def compute_evaluation_metrics(
    y_true: List[int],
    y_pred: List[int],
    y_proba: List[float],
) -> Dict[str, Any]:
    """
    Menghitung metrik evaluasi klasifikasi lengkap:
    Precision, Recall, F1-Score, PR-AUC, dan Confusion Matrix.
    """
    if len(y_true) == 0:
        return {
            "sample_count": 0,
            "status": "NOT_READY",
            "precision": None,
            "recall": None,
            "f1_score": None,
            "pr_auc": None,
            "confusion_matrix": {"tp": 0, "fp": 0, "tn": 0, "fn": 0},
        }

    tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 1)
    fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 1)
    tn = sum(1 for yt, yt_p in zip(y_true, y_pred) if yt == 0 and yt_p == 0)
    fn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 0)

    precision = round(tp / (tp + fp), 4) if (tp + fp) > 0 else 0.0
    recall = round(tp / (tp + fn), 4) if (tp + fn) > 0 else 0.0
    f1 = (
        round(2.0 * (precision * recall) / (precision + recall), 4)
        if (precision + recall) > 0
        else 0.0
    )

    # Hitung Precision-Recall AUC (PR-AUC) secara aproksimasi trapesium bertahap
    # Urutkan probabilitas dari tertinggi ke terendah
    sorted_pairs = sorted(zip(y_proba, y_true), key=lambda x: x[0], reverse=True)
    total_positives = sum(y_true)

    pr_auc = 0.0
    if total_positives > 0:
        cum_tp = 0
        cum_fp = 0
        last_rec = 0.0
        last_prec = 1.0

        for prob, yt in sorted_pairs:
            if yt == 1:
                cum_tp += 1
            else:
                cum_fp += 1
            cur_rec = cum_tp / total_positives
            cur_prec = cum_tp / (cum_tp + cum_fp)
            # Area trapesium
            pr_auc += (cur_rec - last_rec) * (cur_prec + last_prec) / 2.0
            last_rec = cur_rec
            last_prec = cur_prec
        pr_auc = round(min(1.0, max(0.0, pr_auc)), 4)
    else:
        pr_auc = 0.0

    return {
        "sample_count": len(y_true),
        "status": "EVALUATED",
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "pr_auc": pr_auc,
        "confusion_matrix": {
            "tp": tp,
            "fp": fp,
            "tn": tn,
            "fn": fn,
        },
    }
