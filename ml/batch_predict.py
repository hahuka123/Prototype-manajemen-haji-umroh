"""
Modul Batch Prediction Machine Learning untuk Risiko Keterlambatan Cicilan.
File: ml/batch_predict.py
ML Stage — Prototype Manajemen Haji & Umrah.

Fungsi:
1. Membaca model aktif terverifikasi dari artefak JSON (default: ml/models/active_model.json).
2. Memeriksa status kesiapan model (wajib 'active' dan telah melalui evaluasi formal).
3. Melakukan inferensi batch pada daftar termin yang membutuhkan prediksi risiko.
4. Menghasilkan skor risiko (0.0 - 1.0), kategori risiko (LOW, MEDIUM, HIGH), dan snapshot fitur non-PII.
5. Mencegah kebocoran data pribadi (PII) ke dalam hasil prediksi.
6. Menyimpan hasil batch prediksi ke file JSON lokal (ml/data/predictions_batch.json).
"""

import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any

# Pastikan root workspace terdaftar di sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ml.model import FEATURE_COLUMNS
from ml.predictor import InstallmentRiskPredictor, categorize_risk


def validate_active_model_artifact(model_data: Dict[str, Any]) -> Tuple[bool, str]:
    """Memastikan artefak model valid, berstatus aktif, dan memiliki metrik evaluasi formal."""
    if not model_data:
        return False, "Data model kosong."

    status = model_data.get("status")
    if status != "active":
        return False, f"Model tidak berstatus 'active' (status saat ini: '{status}'). Pelatihan valid diperlukan terlebih dahulu."

    eval_metrics = model_data.get("evaluation")
    if not eval_metrics or eval_metrics.get("status") != "EVALUATED":
        return False, "Model belum memiliki metrik evaluasi formal yang valid."

    if not model_data.get("scaler") or not model_data.get("classifier"):
        return False, "Artefak model tidak memuat parameter scaler atau classifier yang lengkap."

    return True, "Model aktif dan terverifikasi."


def run_batch_prediction(
    terms_features_list: List[Dict[str, Any]],
    model_path: str = "ml/models/active_model.json",
    output_path: Optional[str] = "ml/data/predictions_batch.json",
) -> Dict[str, Any]:
    """
    Menjalankan prediksi batch pada daftar termin cicilan.

    Parameter:
    - terms_features_list: List dict yang masing-masing memuat 'term_id', 'jamaah_id', dan 11 fitur prediktif.
    - model_path: Path ke file model aktif.
    - output_path: Path tujuan penyimpanan hasil batch prediksi (opsional).

    Mengembalikan ringkasan proses batch dan daftar prediksi.
    """
    summary = {
        "status": "NOT_READY",
        "processed_count": 0,
        "valid_predictions_count": 0,
        "skipped_count": 0,
        "model_version": None,
        "predictions": [],
        "errors": [],
    }

    if not os.path.exists(model_path):
        summary["errors"].append(
            f"File model tidak ditemukan di: {model_path}. Pelatihan model diperlukan terlebih dahulu."
        )
        return summary

    try:
        with open(model_path, mode="r", encoding="utf-8") as f:
            model_data = json.load(f)
    except Exception as e:
        summary["errors"].append(f"Gagal membaca file model: {str(e)}")
        return summary

    is_valid_model, model_reason = validate_active_model_artifact(model_data)
    if not is_valid_model:
        summary["errors"].append(model_reason)
        return summary

    predictor = InstallmentRiskPredictor(model_data)
    summary["model_version"] = predictor.version

    predictions: List[Dict[str, Any]] = []

    for item in terms_features_list:
        summary["processed_count"] += 1
        term_id = item.get("term_id")
        jamaah_id = item.get("jamaah_id")

        if not term_id or not jamaah_id:
            summary["skipped_count"] += 1
            summary["errors"].append(f"Baris ke-{summary['processed_count']} tidak memiliki term_id atau jamaah_id.")
            continue

        is_feat_valid, feat_errors = predictor.validate_input(item)
        if not is_feat_valid:
            summary["skipped_count"] += 1
            summary["errors"].append(f"Term {term_id} dilewati: {'; '.join(feat_errors)}")
            continue

        pred = predictor.predict_single(item)

        # Snapshot fitur non-PII yang digunakan saat inferensi
        feature_snapshot = {col: float(item[col]) for col in predictor.feature_columns}

        record = {
            "term_id": str(term_id),
            "jamaah_id": str(jamaah_id),
            "risk_score": pred["risk_score"],
            "risk_level": pred["risk_level"],
            "model_version": predictor.version,
            "feature_snapshot": feature_snapshot,
            "predicted_at": datetime.now().isoformat(),
        }
        predictions.append(record)
        summary["valid_predictions_count"] += 1

    summary["predictions"] = predictions
    summary["status"] = "SUCCESS" if summary["valid_predictions_count"] > 0 else "EMPTY"

    if output_path and summary["valid_predictions_count"] > 0:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, mode="w", encoding="utf-8") as out_f:
            json.dump(summary, out_f, indent=2)

    return summary


if __name__ == "__main__":
    print("=== BATCH PREDICTION RUNNER ===")
    res = run_batch_prediction([])
    print("Status:", res["status"])
    if res["errors"]:
        print("Pesan/Error:", res["errors"])
