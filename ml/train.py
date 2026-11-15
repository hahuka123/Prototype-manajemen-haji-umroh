"""
Modul Pelatihan Model Machine Learning & Pipeline Evaluasi.
File: ml/train.py
ML Stage 3 & 4 — Prototype Manajemen Haji & Umrah.

Fungsi Utama:
1. Membaca dataset CSV hasil pipeline ekstraksi ML.
2. Memvalidasi kriteria kelayakan training (anti-data palsu & anti-single class).
3. Melakukan pembagian data temporal (Temporal Train-Test Split) berdasarkan kolom due_date.
4. Menjalankan standardisasi fitur (StandardScaler) berbasis data training.
5. Melatih model Logistic Regression dengan pembobotan kelas seimbang (class_weight='balanced').
6. Menghitung metrik evaluasi formal (Precision, Recall, F1, PR-AUC, Confusion Matrix).
7. Menyimpan artefak model dan metadata ke file JSON terstruktur.
"""

import csv
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any

# Pastikan workspace terdaftar di sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ml.model import (
    FEATURE_COLUMNS,
    StandardScaler,
    LogisticRegression,
    compute_evaluation_metrics,
)

MIN_TRAINING_SAMPLES = 10
MODEL_VERSION = "v1.0.0-logistic-regression"


def load_dataset_from_csv(csv_path: str) -> List[Dict[str, Any]]:
    """Membaca file dataset CSV anonim hasil ekstraksi pipeline."""
    if not os.path.exists(csv_path):
        return []

    rows: List[Dict[str, Any]] = []
    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)
    return rows


def validate_training_readiness(rows: List[Dict[str, Any]]) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Validasi kelayakan dataset sebelum proses training dijalankan.
    Mencegah fabrikasi data atau pelatihan pada data yang belum memenuhi kriteria supervised learning.
    """
    total_samples = len(rows)
    stats = {
        "sample_count": total_samples,
        "class_0_count": 0,
        "class_1_count": 0,
        "unique_classes": [],
        "is_ready": False,
        "reason": "",
    }

    if total_samples == 0:
        stats["reason"] = "Dataset kosong (0 sampel). File data belum tersedia atau belum diekspor."
        return False, stats["reason"], stats

    if total_samples < MIN_TRAINING_SAMPLES:
        stats["reason"] = (
            f"Jumlah sampel ({total_samples}) belum memenuhi batas minimum "
            f"pelatihan statistik yang valid (diperlukan minimal {MIN_TRAINING_SAMPLES} sampel)."
        )
        return False, stats["reason"], stats

    c0 = sum(1 for r in rows if str(r.get("late", "")).strip() == "0")
    c1 = sum(1 for r in rows if str(r.get("late", "")).strip() == "1")
    stats["class_0_count"] = c0
    stats["class_1_count"] = c1

    classes = []
    if c0 > 0:
        classes.append(0)
    if c1 > 0:
        classes.append(1)
    stats["unique_classes"] = classes

    if len(classes) < 2:
        stats["reason"] = (
            f"Dataset hanya memuat satu kelas label ({classes}). "
            f"Model klasifikasi biner membutuhkan kedua kelas (0 = tepat waktu dan 1 = terlambat)."
        )
        return False, stats["reason"], stats

    stats["is_ready"] = True
    stats["reason"] = f"Dataset layak: {total_samples} sampel ({c0} tepat waktu, {c1} terlambat)."
    return True, stats["reason"], stats


def split_temporal_data(
    rows: List[Dict[str, Any]],
    test_ratio: float = 0.2,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Membagi dataset secara temporal (berdasarkan due_date) untuk mencegah data leakage masa depan.
    Data masa lalu digunakan untuk training, data yang lebih baru untuk testing.
    """
    sorted_rows = sorted(rows, key=lambda r: str(r.get("due_date", "")))
    n_total = len(sorted_rows)
    n_train = int(n_total * (1.0 - test_ratio))
    # Pastikan setidaknya ada data test jika memungkinkan
    if n_train >= n_total and n_total > 1:
        n_train = n_total - 1

    train_data = sorted_rows[:n_train]
    test_data = sorted_rows[n_train:]
    return train_data, test_data


def extract_matrix(
    rows: List[Dict[str, Any]],
    feature_columns: List[str] = FEATURE_COLUMNS,
) -> Tuple[List[List[float]], List[int]]:
    """Mengekstraksi matriks fitur X numerik dan vektor label y."""
    X: List[List[float]] = []
    y: List[int] = []

    for r in rows:
        row_feat = []
        for col in feature_columns:
            val = r.get(col, 0.0)
            try:
                row_feat.append(float(val))
            except (ValueError, TypeError):
                row_feat.append(0.0)
        X.append(row_feat)

        lbl_val = r.get("late", 0)
        try:
            y.append(int(lbl_val))
        except (ValueError, TypeError):
            y.append(0)

    return X, y


def train_model(
    dataset_path: str = "ml/data/dataset_installment_risk_anonymous.csv",
    output_model_path: str = "ml/models/active_model.json",
    test_ratio: float = 0.2,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Fungsi orkestrator pelatihan model ML.
    Jika dataset belum siap, mengembalikan status NOT_READY tanpa menghasilkan metrik palsu.
    """
    result: Dict[str, Any] = {
        "status": "NOT_READY",
        "version": MODEL_VERSION,
        "trained_at": None,
        "dataset_path": dataset_path,
        "readiness_check": {},
        "evaluation": None,
        "model_path": None,
        "error": None,
    }

    # 1. Baca dataset
    rows = load_dataset_from_csv(dataset_path)

    # 2. Validasi kesiapan dataset
    is_ready, reason, stats = validate_training_readiness(rows)
    result["readiness_check"] = stats

    if not is_ready:
        result["status"] = "NOT_READY"
        result["error"] = reason
        return result

    # 3. Temporal Train-Test Split
    train_rows, test_rows = split_temporal_data(rows, test_ratio=test_ratio)

    X_train_raw, y_train = extract_matrix(train_rows)
    X_test_raw, y_test = extract_matrix(test_rows)

    # Pastikan data train dan test memiliki kedua kelas jika memungkinkan
    if len(set(y_train)) < 2:
        result["status"] = "NOT_READY"
        result["error"] = "Data training hasil pembagian temporal hanya memuat 1 kelas. Dataset membutuhkan sampel terlambat yang lebih proporsional."
        return result

    # 4. Standardisasi Fitur
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_raw)
    X_test_scaled = scaler.transform(X_test_raw)

    # 5. Training Logistic Regression
    clf = LogisticRegression(
        learning_rate=0.05,
        max_iter=1000,
        l2_penalty=0.01,
        class_weight="balanced",
        random_state=random_state,
    )
    clf.fit(X_train_scaled, y_train, feature_names=FEATURE_COLUMNS)

    # 6. Evaluasi pada Test Set
    y_pred = clf.predict(X_test_scaled, threshold=0.5)
    y_prob = clf.predict_proba(X_test_scaled)
    eval_metrics = compute_evaluation_metrics(y_true=y_test, y_pred=y_pred, y_proba=y_prob)

    # 7. Simpan Model Artifact ke JSON
    os.makedirs(os.path.dirname(output_model_path), exist_ok=True)
    model_payload = {
        "version": MODEL_VERSION,
        "algorithm": "LogisticRegression",
        "status": "active",
        "trained_at": datetime.now().isoformat(),
        "feature_columns": FEATURE_COLUMNS,
        "scaler": scaler.to_dict(),
        "classifier": clf.to_dict(),
        "evaluation": eval_metrics,
        "dataset_stats": stats,
    }

    with open(output_model_path, mode="w", encoding="utf-8") as f:
        json.dump(model_payload, f, indent=2)

    result["status"] = "TRAINED_AND_READY"
    result["trained_at"] = model_payload["trained_at"]
    result["evaluation"] = eval_metrics
    result["model_path"] = output_model_path
    return result


if __name__ == "__main__":
    res = train_model()
    print("STATUS TRAINING:", res["status"])
    if res["status"] != "TRAINED_AND_READY":
        print("ALASAN PENGHENTIAN:", res.get("error"))
    else:
        print("METRIK EVALUASI:", res.get("evaluation"))
