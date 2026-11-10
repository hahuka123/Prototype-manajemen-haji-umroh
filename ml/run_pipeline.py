"""
CLI Runner Pipeline Persiapan Dataset ML.
File: ml/run_pipeline.py
Penggunaan:
    python ml/run_pipeline.py [--input-dir ml/data/raw] [--output ml/data/dataset_installment_risk_anonymous.csv]
"""

import argparse
import os
import sys
from datetime import date

# Pastikan root workspace terdaftar di sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ml.dataset_pipeline import run_pipeline_from_csv_dir


def main():
    parser = argparse.ArgumentParser(
        description="Jalankan Pipeline Persiapan Dataset Prediksi Keterlambatan Cicilan (Stage 2)"
    )
    parser.add_argument(
        "--input-dir",
        default="ml/data/raw",
        help="Direktori yang berisi file CSV ekspor Supabase (default: ml/data/raw)",
    )
    parser.add_argument(
        "--output",
        default="ml/data/dataset_installment_risk_anonymous.csv",
        help="Path file CSV hasil ekstraksi dataset anonim (default: ml/data/dataset_installment_risk_anonymous.csv)",
    )
    parser.add_argument(
        "--eval-date",
        default=None,
        help="Tanggal evaluasi (format YYYY-MM-DD, default: hari ini)",
    )

    args = parser.parse_args()

    eval_date = None
    if args.eval_date:
        try:
            eval_date = date.fromisoformat(args.eval_date)
        except ValueError:
            print(f"Error: Format tanggal evaluasi salah: {args.eval_date}. Gunakan YYYY-MM-DD.")
            sys.exit(1)

    print("=================================================================")
    print("  PIPELINE PERSIAPAN DATASET RISIKO KETERLAMBATAN CICILAN (ML STAGE 2)")
    print("=================================================================")
    print(f"Input Directory : {args.input_dir}")
    print(f"Output File     : {args.output}")
    print(f"Evaluation Date : {eval_date or date.today().isoformat()}")
    print("-----------------------------------------------------------------")

    # Periksa ketersediaan file input
    required_files = [
        "installment_terms.csv",
        "payments.csv",
        "packages.csv",
        "jamaah.csv",
    ]
    missing = [
        f for f in required_files if not os.path.exists(os.path.join(args.input_dir, f))
    ]

    if missing:
        print("Pemberitahuan: File ekspor CSV berikut belum ditemukan di input directory:")
        for m in missing:
            print(f"  - {os.path.join(args.input_dir, m)}")
        print("\nPetunjuk:")
        print("1. Ekspor data tabel dari Supabase Staging melalui Table Editor / SQL Editor:")
        print("   - public.installment_terms -> installment_terms.csv")
        print("   - public.payments          -> payments.csv")
        print("   - public.packages          -> packages.csv")
        print("   - public.jamaah            -> jamaah.csv")
        print(f"2. Simpan file-file tersebut ke folder: {os.path.abspath(args.input_dir)}")
        print("3. Jalankan kembali skrip ini: python ml/run_pipeline.py")
        sys.exit(0)

    # Jalankan pipeline
    try:
        rows, summary = run_pipeline_from_csv_dir(
            input_dir=args.input_dir,
            output_filepath=args.output,
            evaluation_date=eval_date,
        )

        print("\nHASIL AUDIT & RINGKASAN DATASET:")
        print(f"- Total Termin Input (Raw)     : {summary['total_terms_raw']}")
        print(f"- Total Termin Unik Diproses   : {summary['total_terms_evaluated']}")
        print(f"- Duplikasi Termin Ditemukan   : {summary['duplicate_terms_count']}")
        print(f"- Total Termin Berlabel (Valid): {summary['labeled_count']}")
        print(f"    * Label 0 (Tepat Waktu)    : {summary['label_0_count']}")
        print(f"    * Label 1 (Terlambat)      : {summary['label_1_count']}")
        print(f"    * Rasio Kelas Terlambat    : {summary['late_ratio_pct']}%")
        print(f"- Total Termin Dieksklusi      : {summary['excluded_count']}")
        print(f"    * Data Uji Teknis Staging  : {summary['excluded_technical_test_data']}")
        print(f"    * Belum Jatuh Tempo        : {summary['excluded_not_due']}")
        print(f"    * Ambigu (Pending > Due)   : {summary['excluded_ambiguous_pending']}")
        print(f"    * Nominal / Data Tidak Sah : {summary['excluded_invalid']}")
        print(f"- Metadata Waktu (due_date)    : Tersedia format ISO YYYY-MM-DD")
        print(f"- Audit Anti-PII               : {'100% LOLOS (Bebas PII)' if summary['pii_audit_passed'] else 'GAGAL: Ditemukan PII!'}")

        if not summary["pii_audit_passed"]:
            print(f"  Peringatan Pelanggaran PII   : {summary['pii_violations']}")

        if rows:
            print(f"\n[SUKSES] Dataset anonim berhasil disimpan di: {os.path.abspath(args.output)}")
        else:
            print("\n[INFO] Belum ada baris yang memenuhi kriteria pelabelan.")

    except Exception as e:
        print(f"\nError saat memproses pipeline: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
