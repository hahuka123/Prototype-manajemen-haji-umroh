"""
Modul Inferensi & Prediksi Risiko Keterlambatan Cicilan.
File: ml/predictor.py
ML Stage 3 & 4 — Prototype Manajemen Haji & Umrah.

Fungsi:
1. Memuat model dan scaler dari artefak JSON.
2. Memvalidasi input fitur non-PII secara ketat sebelum melakukan inferensi.
3. Menghasilkan skor probabilitas risiko keterlambatan (0.0 - 1.0) dan kategori risiko (LOW, MEDIUM, HIGH).
4. Menolak prediksi jika input tidak valid atau model belum di-training.
"""

import json
import os
from typing import Dict, List, Optional, Tuple, Any

from ml.model import (
    FEATURE_COLUMNS,
    StandardScaler,
    LogisticRegression,
)


def categorize_risk(prob: float) -> str:
    """Mengelompokkan probabilitas ke dalam tingkat risiko standar."""
    if prob < 0.35:
        return "LOW"
    elif prob < 0.65:
        return "MEDIUM"
    else:
        return "HIGH"


class InstallmentRiskPredictor:
    """Mesin inferensi untuk memprediksi risiko keterlambatan pembayaran termin."""

    def __init__(self, model_data: Optional[Dict[str, Any]] = None):
        self.version: str = "unknown"
        self.feature_columns: List[str] = FEATURE_COLUMNS
        self.scaler: Optional[StandardScaler] = None
        self.classifier: Optional[LogisticRegression] = None
        self.is_ready: bool = False

        if model_data:
            self.load_from_dict(model_data)

    def load_from_dict(self, data: Dict[str, Any]) -> "InstallmentRiskPredictor":
        self.version = data.get("version", "v1.0.0")
        self.feature_columns = data.get("feature_columns", FEATURE_COLUMNS)

        scaler_dict = data.get("scaler")
        if not scaler_dict:
            raise ValueError("Data model tidak memuat parameter scaler.")
        self.scaler = StandardScaler.from_dict(scaler_dict)

        clf_dict = data.get("classifier")
        if not clf_dict:
            raise ValueError("Data model tidak memuat parameter classifier.")
        self.classifier = LogisticRegression.from_dict(clf_dict)

        self.is_ready = True
        return self

    def load_from_file(self, filepath: str) -> "InstallmentRiskPredictor":
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File model tidak ditemukan di: {filepath}")
        with open(filepath, mode="r", encoding="utf-8") as f:
            data = json.load(f)
        return self.load_from_dict(data)

    def validate_input(self, features: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validasi ketersediaan dan tipe data seluruh fitur yang diwajibkan."""
        errors: List[str] = []
        for col in self.feature_columns:
            if col not in features:
                errors.append(f"Fitur wajib '{col}' tidak ditemukan pada input.")
                continue
            val = features[col]
            try:
                float(val)
            except (ValueError, TypeError):
                errors.append(f"Nilai fitur '{col}' ({val}) tidak dapat dikonversi ke numerik.")
        return len(errors) == 0, errors

    def predict_single(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Melakukan prediksi untuk satu termin cicilan.
        Mengembalikan skor probabilitas, tingkat risiko, dan versi model.
        """
        if not self.is_ready or not self.scaler or not self.classifier:
            raise RuntimeError("Predictor belum siap. Model belum dimuat.")

        is_valid, errors = self.validate_input(features)
        if not is_valid:
            raise ValueError(f"Input fitur tidak valid: {'; '.join(errors)}")

        raw_vector = [[float(features[col]) for col in self.feature_columns]]
        scaled_vector = self.scaler.transform(raw_vector)
        prob = self.classifier.predict_proba(scaled_vector)[0]
        prob_rounded = round(prob, 4)

        return {
            "risk_score": prob_rounded,
            "risk_level": categorize_risk(prob_rounded),
            "model_version": self.version,
            "is_valid": True,
        }
