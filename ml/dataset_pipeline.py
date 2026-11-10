"""
Pipeline Persiapan Dataset Supervised Learning untuk Prediksi Keterlambatan Cicilan.
File: ml/dataset_pipeline.py
ML Stage 2.2 — Prototype Manajemen Haji & Umrah.

Fungsi Utama:
1. Membaca data tabular CSV ekspor dari Supabase Staging:
   - installment_terms.csv
   - payments.csv
   - packages.csv
   - jamaah.csv
2. Mendeteksi dan mencegah duplikasi data termin (unique key: term_id).
3. Menyaring dan mengecualikan data uji teknis staging secara spesifik dan terkonfigurasi.
4. Menerapkan aturan pelabelan deterministik anti-leakage (label: 0 atau 1).
5. Mengekstraksi fitur prediktif non-PII dan menyertakan metadata waktu due_date (ISO YYYY-MM-DD)
   untuk kebutuhan temporal train-test split.
6. Memvalidasi dan menjamin 100% data pribadi (PII) dieksklusi.
7. Menghasilkan ringkasan kualitas data, missing values, dan distribusi kelas.
8. Menyimpan dataset akhir sebagai CSV anonim.
"""

import csv
import hashlib
import os
from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional, Tuple, Any, Callable

from ml.labeling_rules import (
    evaluate_term_label,
    parse_date,
    parse_decimal,
    EXCLUDED_NOT_DUE,
    EXCLUDED_AMBIGUOUS_PENDING,
    EXCLUDED_INVALID_AMOUNT,
)

# Daftar kata kunci kolom PII yang DILARANG KERAS masuk ke dataset akhir
FORBIDDEN_PII_KEYWORDS = [
    "nik",
    "passport",
    "nama",
    "name",
    "full_name",
    "phone",
    "telepon",
    "address",
    "alamat",
    "profile",
    "bank",
    "proof",
    "bukti",
    "notes",
    "catatan",
    "rejection",
    "created_by",
    "verified_by",
    "reference",
]

# Konfigurasi Identifikasi Data Uji Teknis Staging (Deterministik & Spesifik)
DEFAULT_TECHNICAL_TEST_UUID_PREFIXES = ("c0000000-", "d0000000-")
DEFAULT_TECHNICAL_TEST_PACKAGES = (
    "paket uji staging",
    "paket uji konkurensi",
    "paket uji konkurensi alt",
    "paket uji konkurensi final",
)
DEFAULT_TECHNICAL_TEST_ADDRESSES = (
    "jl. test staging",
    "jl. konkurensi",
)


def is_technical_test_record(
    term: Dict[str, Any],
    jamaah: Dict[str, Any],
    package: Dict[str, Any],
    custom_filter_fn: Optional[Callable[[Dict, Dict, Dict], Tuple[bool, str]]] = None,
) -> Tuple[bool, str]:
    """
    Memeriksa apakah sebuah record termin/jamaah/paket merupakan data dummy uji teknis staging.
    Menghindari penghapusan data operasional sah (tidak melakukan wildcard 'uji' sembarangan).
    Mengembalikan Tuple (is_test: bool, reason: str).
    """
    if custom_filter_fn:
        return custom_filter_fn(term, jamaah, package)

    term_id = str(term.get("id") or "").lower().strip()
    jamaah_id = str(term.get("jamaah_id") or "").lower().strip()
    pkg_id = str(package.get("id") or "").lower().strip()
    pkg_name = str(package.get("name") or "").lower().strip()
    term_title = str(term.get("title") or "").lower().strip()
    jamaah_addr = str(jamaah.get("address") or "").lower().strip()

    # 1. Periksa UUID prefix deterministik pengujian staging
    for pfx in DEFAULT_TECHNICAL_TEST_UUID_PREFIXES:
        if term_id.startswith(pfx) or jamaah_id.startswith(pfx) or pkg_id.startswith(pfx):
            return True, f"UUID memiliki prefix pengujian staging ({pfx})"

    # 2. Periksa nama paket pengujian teknis spesifik
    for test_pkg in DEFAULT_TECHNICAL_TEST_PACKAGES:
        if test_pkg == pkg_name or pkg_name.startswith(test_pkg):
            return True, f"Paket merupakan paket uji teknis ('{package.get('name')}')"

    # 3. Periksa judul termin pengujian teknis spesifik
    if term_title in ["termin uji konkurensi", "termin uji konkurensi alt", "termin uji konkurensi final", "termin 1 uji staging"]:
        return True, f"Termin merupakan termin uji teknis ('{term.get('title')}')"

    # 4. Periksa alamat dummy pengujian teknis spesifik
    for addr_pfx in DEFAULT_TECHNICAL_TEST_ADDRESSES:
        if jamaah_addr.startswith(addr_pfx):
            return True, f"Alamat jamaah merupakan alamat uji teknis ('{jamaah.get('address')}')"

    return False, ""


def anonymize_id(raw_id: Any) -> str:
    """Mengubah UUID/ID menjadi hash anonim deterministik 12-karakter."""
    if not raw_id:
        return "anon_unknown"
    str_id = str(raw_id).strip().lower()
    return hashlib.sha256(str_id.encode("utf-8")).hexdigest()[:12]


def load_csv_as_dicts(file_path: str) -> List[Dict[str, str]]:
    """Membaca file CSV menjadi list of dictionaries."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File CSV tidak ditemukan: {file_path}")
    with open(file_path, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        return [row for row in reader]


def process_dataset_from_records(
    terms: List[Dict[str, Any]],
    payments: List[Dict[str, Any]],
    packages: List[Dict[str, Any]],
    jamaah_list: List[Dict[str, Any]],
    evaluation_date: Optional[date] = None,
    raise_on_duplicate: bool = True,
    custom_test_filter_fn: Optional[Callable[[Dict, Dict, Dict], Tuple[bool, str]]] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Memproses daftar records in-memory menjadi dataset fitur ML siap pakai + ringkasan metrik.
    """
    eval_date = evaluation_date or date.today()

    # 1. Deteksi Duplikasi ID Termin
    seen_term_ids = set()
    duplicate_term_ids = []
    unique_terms = []

    for term in terms:
        tid = str(term.get("id") or "").strip()
        if not tid:
            continue
        if tid in seen_term_ids:
            duplicate_term_ids.append(tid)
        else:
            seen_term_ids.add(tid)
            unique_terms.append(term)

    # 2. Indeks paket dan jamaah berdasarkan ID untuk lookup cepat O(1)
    packages_map = {str(p.get("id") or "").strip(): p for p in packages}
    jamaah_map = {str(j.get("id") or "").strip(): j for j in jamaah_list}

    # 3. Kelompokkan payments berdasarkan installment_term_id
    payments_by_term: Dict[str, List[Dict[str, Any]]] = {}
    for pay in payments:
        term_id = str(pay.get("installment_term_id") or "").strip()
        if term_id:
            payments_by_term.setdefault(term_id, []).append(pay)

    # 4. Urutkan termin unik berdasarkan jamaah dan term_number untuk kalkulasi riwayat termin sebelumnya
    sorted_terms = sorted(
        unique_terms,
        key=lambda x: (
            str(x.get("jamaah_id") or ""),
            int(x.get("term_number") or 1),
            parse_date(x.get("due_date")) or date.min,
        ),
    )

    # Dictionary untuk mencatat riwayat keterlambatan termin sebelumnya per jamaah
    jamaah_history: Dict[str, List[int]] = {}

    dataset_rows: List[Dict[str, Any]] = []

    # Metrik Ringkasan
    summary = {
        "total_terms_raw": len(terms),
        "total_terms_evaluated": len(unique_terms),
        "duplicate_terms_count": len(duplicate_term_ids),
        "duplicate_term_ids": duplicate_term_ids,
        "labeled_count": 0,
        "label_0_count": 0,
        "label_1_count": 0,
        "late_ratio_pct": 0.0,
        "excluded_count": 0,
        "excluded_not_due": 0,
        "excluded_ambiguous_pending": 0,
        "excluded_invalid": 0,
        "excluded_technical_test_data": 0,
        "technical_test_details": [],
        "missing_values_count": {},
        "pii_audit_passed": True,
        "pii_violations": [],
    }

    # Jika duplikat terdeteksi dan konfigurasi mewajibkan penghentian:
    if duplicate_term_ids and raise_on_duplicate:
        raise ValueError(
            f"Validasi Gagal: Terdeteksi {len(duplicate_term_ids)} ID termin duplikat pada data input. "
            f"Contoh ID duplikat: {duplicate_term_ids[:5]}. Proses dihentikan untuk menjamin keunikan sampel."
        )

    for term in sorted_terms:
        term_id = str(term.get("id") or "").strip()
        jamaah_id = str(term.get("jamaah_id") or "").strip()
        term_num = int(term.get("term_number") or 1)
        target_amount = parse_decimal(term.get("amount"))
        due_date = parse_date(term.get("due_date"))

        # Ambil data jamaah dan paket terkait
        jamaah = jamaah_map.get(jamaah_id, {})
        package_id = str(jamaah.get("package_id") or "").strip()
        package = packages_map.get(package_id, {})

        # TUGAS 2: Filter Data Uji Teknis Staging
        is_test, test_reason = is_technical_test_record(
            term, jamaah, package, custom_test_filter_fn
        )
        if is_test:
            summary["excluded_count"] += 1
            summary["excluded_technical_test_data"] += 1
            summary["technical_test_details"].append(
                {"term_id": term_id, "reason": test_reason}
            )
            continue

        term_payments = payments_by_term.get(term_id, [])

        # Evaluasi Label menggunakan modul labeling_rules
        label, status_code, _ = evaluate_term_label(
            term_id=term_id,
            target_amount=target_amount,
            due_date_raw=due_date,
            payments=term_payments,
            evaluation_date=eval_date,
        )

        # Fitur Riwayat Termin Sebelumnya (Prior terms history - Anti Leakage)
        prior_labels = jamaah_history.get(jamaah_id, [])
        prev_terms_count = len(prior_labels)
        prev_late_count = sum(prior_labels)
        prev_late_ratio = (
            round(prev_late_count / prev_terms_count, 4)
            if prev_terms_count > 0
            else 0.0
        )

        # Catat status termin ini ke riwayat jamaah untuk termin-termin berikutnya (jika berlabel)
        if label is not None:
            jamaah_history.setdefault(jamaah_id, []).append(label)

        # Filter eksklusi termin operasional
        if label is None:
            summary["excluded_count"] += 1
            if status_code == EXCLUDED_NOT_DUE:
                summary["excluded_not_due"] += 1
            elif status_code == EXCLUDED_AMBIGUOUS_PENDING:
                summary["excluded_ambiguous_pending"] += 1
            else:
                summary["excluded_invalid"] += 1
            continue

        # Ekstraksi Fitur Non-PII
        pkg_price = float(parse_decimal(package.get("price")))
        t_amount = float(target_amount)
        term_ratio = round(t_amount / pkg_price, 4) if pkg_price > 0 else 0.0
        pkg_duration = int(package.get("duration") or 0)

        dep_date = parse_date(package.get("departure_date"))
        days_to_dep = (dep_date - due_date).days if (dep_date and due_date) else 0

        birth_date = parse_date(jamaah.get("birth_date"))
        if birth_date and due_date:
            age = (
                due_date.year
                - birth_date.year
                - ((due_date.month, due_date.day) < (birth_date.month, birth_date.day))
            )
        else:
            age = 0

        gender_str = str(jamaah.get("gender") or "").strip().lower()
        gender_encoded = 1 if gender_str in ["laki-laki", "male", "l"] else 0

        # Baris sampel data ML akhir (100% BEBAS PII)
        # TUGAS 1: Menambahkan kolom metadata waktu 'due_date' (ISO YYYY-MM-DD)
        row_sample = {
            "term_id_hash": anonymize_id(term_id),
            "due_date": due_date.isoformat() if due_date else "",  # Metadata waktu untuk temporal split
            "term_number": term_num,
            "term_amount": t_amount,
            "package_price": pkg_price,
            "term_amount_ratio": term_ratio,
            "package_duration": pkg_duration,
            "days_due_to_departure": days_to_dep,
            "jamaah_age": age,
            "gender_encoded": gender_encoded,
            "prev_terms_count": prev_terms_count,
            "prev_late_count": prev_late_count,
            "prev_late_ratio": prev_late_ratio,
            "late": int(label),  # Target Supervised Learning (0 atau 1)
        }

        # Audit PII pada baris sampel
        for col_name in row_sample.keys():
            for kw in FORBIDDEN_PII_KEYWORDS:
                if kw in col_name.lower():
                    summary["pii_audit_passed"] = False
                    summary["pii_violations"].append(col_name)

        dataset_rows.append(row_sample)

        # Update Metrik Ringkasan
        summary["labeled_count"] += 1
        if label == 0:
            summary["label_0_count"] += 1
        else:
            summary["label_1_count"] += 1

    if summary["labeled_count"] > 0:
        summary["late_ratio_pct"] = round(
            (summary["label_1_count"] / summary["labeled_count"]) * 100, 2
        )

    # Hitung nilai kosong / default pada dataset akhir
    for row in dataset_rows:
        for k, v in row.items():
            if v is None or v == "" or (isinstance(v, (int, float)) and v == 0 and k in ["package_price", "jamaah_age"]):
                summary["missing_values_count"][k] = (
                    summary["missing_values_count"].get(k, 0) + 1
                )

    return dataset_rows, summary


def export_dataset_to_csv(rows: List[Dict[str, Any]], output_filepath: str) -> None:
    """Menyimpan list dataset rows ke file CSV."""
    if not rows:
        raise ValueError("Dataset kosong, tidak ada baris yang dapat diekspor.")
    os.makedirs(os.path.dirname(os.path.abspath(output_filepath)), exist_ok=True)
    fieldnames = list(rows[0].keys())
    with open(output_filepath, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def run_pipeline_from_csv_dir(
    input_dir: str,
    output_filepath: str,
    evaluation_date: Optional[date] = None,
    raise_on_duplicate: bool = True,
    custom_test_filter_fn: Optional[Callable[[Dict, Dict, Dict], Tuple[bool, str]]] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Menjalankan seluruh pipeline dari direktori file CSV ekspor Supabase:
    - {input_dir}/installment_terms.csv
    - {input_dir}/payments.csv
    - {input_dir}/packages.csv
    - {input_dir}/jamaah.csv
    """
    terms_file = os.path.join(input_dir, "installment_terms.csv")
    payments_file = os.path.join(input_dir, "payments.csv")
    packages_file = os.path.join(input_dir, "packages.csv")
    jamaah_file = os.path.join(input_dir, "jamaah.csv")

    terms = load_csv_as_dicts(terms_file) if os.path.exists(terms_file) else []
    payments = load_csv_as_dicts(payments_file) if os.path.exists(payments_file) else []
    packages = load_csv_as_dicts(packages_file) if os.path.exists(packages_file) else []
    jamaah_list = load_csv_as_dicts(jamaah_file) if os.path.exists(jamaah_file) else []

    dataset_rows, summary = process_dataset_from_records(
        terms=terms,
        payments=payments,
        packages=packages,
        jamaah_list=jamaah_list,
        evaluation_date=evaluation_date,
        raise_on_duplicate=raise_on_duplicate,
        custom_test_filter_fn=custom_test_filter_fn,
    )

    if dataset_rows:
        export_dataset_to_csv(dataset_rows, output_filepath)

    return dataset_rows, summary
