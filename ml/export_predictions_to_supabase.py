"""
Modul Sinkronisasi & Ingestion Hasil Prediksi ML ke Supabase Staging.
File: ml/export_predictions_to_supabase.py
ML Stage — Prototype Manajemen Haji & Umrah.

Aturan Keselamatan & Integritas:
1. Wajib membaca konfigurasi dari .env.staging secara eksplisit.
2. Memverifikasi Project Ref Staging ('lixqzyayytmlgscpyzjn'). Menolak jika mengarah ke Production.
3. Hanya mengekspor model yang berstatus 'active' dan telah dievaluasi secara formal.
4. Mencegah kebocoran PII (hanya UUID, skor risiko, dan snapshot fitur numerik non-PII).
5. Secara default berjalan dalam mode DRY-RUN (simulasi aman tanpa menulis ke database).
   Pengguna wajib menyertakan flag --execute untuk menjalankan penulisan riil.
6. HANYA menulis ke tabel ML (ml_models, ml_model_evaluations, ml_predictions).
   DILARANG KERAS memodifikasi tabel payments, installment_terms, atau mengubah status transaksi jamaah.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Dict, List, Optional, Tuple, Any

# Target Project Reference Supabase Staging Resmi
EXPECTED_STAGING_PROJECT_REF = "lixqzyayytmlgscpyzjn"

# Daftar kunci PII yang DILARANG masuk ke payload Supabase ML
FORBIDDEN_PII_KEYS = {
    "nik",
    "nama",
    "name",
    "full_name",
    "phone",
    "telepon",
    "passport",
    "address",
    "alamat",
    "email",
    "proof_file_path",
    "bank_name",
    "reference_number",
}


def load_staging_environment(env_file_path: str = ".env.staging") -> Dict[str, str]:
    """
    Membaca variabel lingkungan dari file .env.staging secara manual
    untuk memastikan isolasi 100% dari .env Production.
    """
    if not os.path.exists(env_file_path):
        raise FileNotFoundError(
            f"File konfigurasi Staging '{env_file_path}' tidak ditemukan di direktori root."
        )

    env_vars: Dict[str, str] = {}
    with open(env_file_path, mode="r", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if "=" in stripped:
                key, val = stripped.split("=", 1)
                env_vars[key.strip()] = val.strip().strip("'\"")

    return env_vars


def verify_staging_target(supabase_url: str) -> Tuple[bool, str]:
    """
    Memverifikasi bahwa target URL benar-benar mengarah ke project Staging resmi (lixqzyayytmlgscpyzjn).
    Mencegah salah koneksi ke database Production.
    """
    if not supabase_url:
        return False, "VITE_SUPABASE_URL kosong atau tidak terdefinisi."

    clean_url = supabase_url.lower()
    if EXPECTED_STAGING_PROJECT_REF not in clean_url:
        return False, (
            f"Pencegahan Fatal: URL target ('{supabase_url}') tidak memuat project ref Staging yang sah "
            f"('{EXPECTED_STAGING_PROJECT_REF}'). Proses dibatalkan untuk melindungi data Production!"
        )

    return True, f"Target terverifikasi: Supabase Staging ({EXPECTED_STAGING_PROJECT_REF})."


def validate_prediction_payload_security(predictions: List[Dict[str, Any]]) -> Tuple[bool, List[str]]:
    """
    Memeriksa bahwa seluruh record prediksi tidak mengandung data pribadi (PII)
    dan hanya memuat field yang diizinkan oleh skema ml_predictions.
    """
    violations: List[str] = []
    allowed_root_keys = {
        "term_id",
        "jamaah_id",
        "risk_score",
        "risk_level",
        "model_version",
        "feature_snapshot",
        "predicted_at",
    }

    for idx, pred in enumerate(predictions):
        for k in pred.keys():
            if k not in allowed_root_keys:
                violations.append(f"Baris ke-{idx}: Kolom '{k}' tidak diizinkan di ml_predictions.")
            if k.lower() in FORBIDDEN_PII_KEYS:
                violations.append(f"Baris ke-{idx}: Pelanggaran PII pada kolom '{k}'.")

        snapshot = pred.get("feature_snapshot", {})
        if isinstance(snapshot, dict):
            for sk in snapshot.keys():
                if sk.lower() in FORBIDDEN_PII_KEYS:
                    violations.append(f"Baris ke-{idx}: Pelanggaran PII di dalam feature_snapshot '{sk}'.")

    return len(violations) == 0, violations


def make_supabase_request(
    endpoint_url: str,
    anon_key: str,
    method: str = "POST",
    data: Optional[Any] = None,
    headers_extra: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Mengirim request HTTPS REST murni ke Supabase PostgREST API."""
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if headers_extra:
        headers.update(headers_extra)

    body_bytes = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(endpoint_url, data=body_bytes, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp_body = resp.read().decode("utf-8")
            return {
                "status_code": resp.status,
                "data": json.loads(resp_body) if resp_body else None,
                "error": None,
            }
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        return {
            "status_code": e.code,
            "data": None,
            "error": f"HTTPError {e.code}: {err_msg}",
        }
    except Exception as e:
        return {
            "status_code": 0,
            "data": None,
            "error": f"Exception: {str(e)}",
        }


def export_to_supabase(
    model_artifact_path: str = "ml/models/active_model.json",
    predictions_path: str = "ml/data/predictions_batch.json",
    env_file: str = ".env.staging",
    dry_run: bool = True,
) -> Dict[str, Any]:
    """
    Fungsi utama batch ingestion:
    Menyinkronkan metadata model dan hasil prediksi ke tabel ML Supabase Staging.
    """
    report = {
        "is_success": False,
        "dry_run": dry_run,
        "target_url": None,
        "model_version": None,
        "predictions_count": 0,
        "messages": [],
        "errors": [],
    }

    # 1. Baca dan verifikasi environment Staging
    try:
        env = load_staging_environment(env_file)
    except Exception as e:
        report["errors"].append(str(e))
        return report

    supabase_url = env.get("VITE_SUPABASE_URL", "")
    supabase_key = env.get("VITE_SUPABASE_ANON_KEY", "")
    report["target_url"] = supabase_url

    is_staging_valid, staging_msg = verify_staging_target(supabase_url)
    report["messages"].append(staging_msg)
    if not is_staging_valid:
        report["errors"].append(staging_msg)
        return report

    # 2. Baca dan validasi artefak model
    if not os.path.exists(model_artifact_path):
        report["errors"].append(f"File artefak model '{model_artifact_path}' belum tersedia.")
        return report

    with open(model_artifact_path, mode="r", encoding="utf-8") as f:
        model_payload = json.load(f)

    if model_payload.get("status") != "active":
        report["errors"].append(
            f"Model berstatus '{model_payload.get('status')}'. Hanya model berstatus 'active' yang dapat diekspor."
        )
        return report

    eval_data = model_payload.get("evaluation")
    if not eval_data or eval_data.get("status") != "EVALUATED":
        report["errors"].append("Model belum memiliki hasil evaluasi formal.")
        return report

    report["model_version"] = model_payload.get("version")

    # 3. Baca dan validasi hasil prediksi batch
    if not os.path.exists(predictions_path):
        report["errors"].append(f"File hasil prediksi batch '{predictions_path}' belum tersedia.")
        return report

    with open(predictions_path, mode="r", encoding="utf-8") as f:
        batch_data = json.load(f)

    predictions = batch_data.get("predictions", [])
    report["predictions_count"] = len(predictions)

    if len(predictions) == 0:
        report["messages"].append("Daftar prediksi kosong (0 record). Tidak ada record yang perlu diekspor.")
        report["is_success"] = True
        return report

    # 4. Validasi keamanan PII pada data prediksi
    is_sec_valid, sec_violations = validate_prediction_payload_security(predictions)
    if not is_sec_valid:
        report["errors"].extend(sec_violations)
        return report

    # 5. Simulasi DRY-RUN
    if dry_run:
        report["messages"].append(
            f"[DRY-RUN BERHASIL] Validasi lulus. Siap mengekspor model '{report['model_version']}' "
            f"dan {len(predictions)} prediksi ke Supabase Staging. "
            f"Gunakan flag --execute untuk melakukan penulisan riil."
        )
        report["is_success"] = True
        return report

    # 6. Eksekusi Penulisan Riil (Hanya jika dry_run = False)
    # Penulisan ke ml_models
    model_record = {
        "version": model_payload["version"],
        "algorithm": model_payload.get("algorithm", "LogisticRegression"),
        "status": "active",
        "feature_names": model_payload.get("feature_columns", []),
        "weights": {
            "scaler": model_payload.get("scaler"),
            "classifier": model_payload.get("classifier"),
        },
        "hyperparameters": model_payload.get("classifier", {}).get("hyperparameters", {}),
        "metrics": eval_data,
        "notes": f"Model batch ingestion trained_at {model_payload.get('trained_at')}",
    }

    url_models = f"{supabase_url}/rest/v1/ml_models"
    resp_model = make_supabase_request(
        url_models,
        supabase_key,
        method="POST",
        data=[model_record],
        headers_extra={"Prefer": "resolution=merge-duplicates,return=representation"},
    )

    if resp_model["error"]:
        report["errors"].append(f"Gagal menyimpan ke ml_models: {resp_model['error']}")
        return report

    # Penulisan ke ml_predictions
    url_preds = f"{supabase_url}/rest/v1/ml_predictions"
    resp_preds = make_supabase_request(
        url_preds,
        supabase_key,
        method="POST",
        data=predictions,
        headers_extra={"Prefer": "resolution=merge-duplicates,return=representation"},
    )

    if resp_preds["error"]:
        report["errors"].append(f"Gagal menyimpan ke ml_predictions: {resp_preds['error']}")
        return report

    report["messages"].append(
        f"[EKSEKUSI SUKSES] Berhasil mengekspor model '{report['model_version']}' dan {len(predictions)} baris prediksi ke Staging."
    )
    report["is_success"] = True
    return report


def main():
    parser = argparse.ArgumentParser(
        description="Batch Ingestion Model & Prediksi ML ke Supabase Staging."
    )
    parser.add_argument(
        "--env-file",
        default=".env.staging",
        help="Path file konfigurasi Staging (default: .env.staging)",
    )
    parser.add_argument(
        "--model",
        default="ml/models/active_model.json",
        help="Path file artefak model aktif (default: ml/models/active_model.json)",
    )
    parser.add_argument(
        "--predictions",
        default="ml/data/predictions_batch.json",
        help="Path file hasil prediksi batch (default: ml/data/predictions_batch.json)",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        default=False,
        help="Jalankan penulisan riil ke database Staging (default: dry-run simulasi)",
    )

    args = parser.parse_args()

    print("================================================================")
    print("  BATCH INGESTION MACHINE LEARNING KE SUPABASE STAGING")
    print("================================================================")
    print(f"Mode          : {'EKSEKUSI RIIL' if args.execute else 'DRY-RUN (SIMULASI AMAN)'}")
    print(f"Env File      : {args.env_file}")
    print(f"Model Path    : {args.model}")
    print(f"Prediksi Path : {args.predictions}")
    print("----------------------------------------------------------------")

    res = export_to_supabase(
        model_artifact_path=args.model,
        predictions_path=args.predictions,
        env_file=args.env_file,
        dry_run=not args.execute,
    )

    print("\nHASIL PROSES:")
    print(f"- Status Sukses      : {res['is_success']}")
    print(f"- Target URL         : {res['target_url']}")
    print(f"- Model Version      : {res['model_version']}")
    print(f"- Prediksi Diproses  : {res['predictions_count']}")
    for msg in res["messages"]:
        print(f"  * {msg}")

    if res["errors"]:
        print("\nERROR/PERINGATAN:")
        for err in res["errors"]:
            print(f"  ! {err}")
        sys.exit(1)


if __name__ == "__main__":
    main()
