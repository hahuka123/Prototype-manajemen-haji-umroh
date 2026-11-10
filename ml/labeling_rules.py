"""
Modul Aturan Pelabelan Supervised Learning untuk Risiko Keterlambatan Cicilan.
ML Stage 2 — Prototype Manajemen Haji & Umrah.

Aturan Label (Unit Analisis: 1 Termin Cicilan / installment_terms):
- 0 (Tepat Waktu):
    Termin lunas (total pembayaran terverifikasi >= nominal target termin)
    dan tanggal pembayaran yang menyelesaikan termin <= due_date.
- 1 (Terlambat - Lunas Pasca Jatuh Tempo):
    Termin lunas, namun tanggal pembayaran yang menyelesaikan termin > due_date.
- 1 (Terlambat - Menunggak / Overdue):
    Termin belum lunas, tanggal evaluasi > due_date, dan tidak ada pembayaran berstatus 'pending'.
- EXCLUDED (Dikecualikan / Tidak Dilabeli):
    a. Belum Jatuh Tempo & Belum Lunas (termin masih berjalan).
    b. Lewat Jatuh Tempo namun masih memiliki pembayaran berstatus 'pending' (ambigu).
    c. Pembayaran 'rejected' diabaikan (tidak menambah akumulasi).
    d. Pembayaran tanpa installment_term_id diabaikan dari alokasi termin.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Dict, List, Optional, Tuple, Any

EXCLUDED_NOT_DUE = "EXCLUDED_NOT_DUE"
EXCLUDED_AMBIGUOUS_PENDING = "EXCLUDED_AMBIGUOUS_PENDING"
EXCLUDED_INVALID_AMOUNT = "EXCLUDED_INVALID_AMOUNT"


def parse_date(val: Any) -> Optional[date]:
    """Parse string tanggal ISO (YYYY-MM-DD) atau objek datetime/date menjadi date."""
    if not val:
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    str_val = str(val).strip()
    if not str_val:
        return None
    # Potong jika ada komponen waktu atau zona
    date_part = str_val.split("T")[0].split(" ")[0]
    try:
        return datetime.strptime(date_part, "%Y-%m-%d").date()
    except ValueError:
        return None


def parse_decimal(val: Any) -> Decimal:
    """Parse nominal menjadi Decimal aman tanpa floating point rounding error."""
    if val is None:
        return Decimal("0")
    if isinstance(val, Decimal):
        return val
    try:
        cleaned = str(val).strip().replace(",", "")
        return Decimal(cleaned)
    except Exception:
        return Decimal("0")


def evaluate_term_label(
    term_id: str,
    target_amount: Any,
    due_date_raw: Any,
    payments: List[Dict[str, Any]],
    evaluation_date: Optional[date] = None,
) -> Tuple[Optional[int], str, Dict[str, Any]]:
    """
    Evaluasi label deterministik untuk satu termin cicilan.

    Parameter:
    - term_id: ID unik termin cicilan.
    - target_amount: Target nominal termin (harus > 0).
    - due_date_raw: Tanggal jatuh tempo termin.
    - payments: Daftar transaksi pembayaran yang relevan untuk termin ini.
    - evaluation_date: Tanggal acuan evaluasi (default: hari ini).

    Mengembalikan Tuple (label, status_code, audit_metadata):
    - label: 0, 1, atau None (jika dieksklusi)
    - status_code: Penjelasan status keputusan
    - audit_metadata: Rincian total verified, pending, settlement_date, dll.
    """
    due_date = parse_date(due_date_raw)
    target = parse_decimal(target_amount)
    eval_date = evaluation_date or date.today()

    metadata = {
        "term_id": term_id,
        "target_amount": float(target),
        "due_date": due_date.isoformat() if due_date else None,
        "evaluation_date": eval_date.isoformat(),
        "total_verified": 0.0,
        "total_pending": 0.0,
        "settlement_date": None,
        "is_fully_paid": False,
        "reason": "",
    }

    if not due_date or target <= Decimal("0"):
        metadata["reason"] = "Tanggal jatuh tempo tidak valid atau target amount <= 0"
        return None, EXCLUDED_INVALID_AMOUNT, metadata

    # 1. Filter transaksi pembayaran yang valid untuk termin ini:
    # - Wajib memiliki installment_term_id yang cocok
    # - Abaikan status 'rejected'
    relevant_payments = []
    for p in payments:
        p_term_id = str(p.get("installment_term_id") or "").strip()
        if p_term_id != str(term_id).strip():
            continue  # Abaikan pembayaran tanpa termin atau termin lain

        p_status = str(p.get("status") or "").lower().strip()
        if p_status == "rejected":
            continue  # Abaikan pembayaran ditolak

        p_amount = parse_decimal(p.get("amount"))
        if p_amount <= Decimal("0"):
            continue

        p_date = parse_date(p.get("payment_date")) or parse_date(p.get("created_at"))
        relevant_payments.append(
            {
                "id": p.get("id"),
                "amount": p_amount,
                "status": p_status,
                "payment_date": p_date,
            }
        )

    # 2. Akumulasi pembayaran verified dan pending
    verified_payments = [
        p for p in relevant_payments if p["status"] == "verified"
    ]
    pending_payments = [
        p for p in relevant_payments if p["status"] == "pending"
    ]

    total_verified = sum((p["amount"] for p in verified_payments), Decimal("0"))
    total_pending = sum((p["amount"] for p in pending_payments), Decimal("0"))

    metadata["total_verified"] = float(total_verified)
    metadata["total_pending"] = float(total_pending)

    is_fully_paid = total_verified >= target
    metadata["is_fully_paid"] = is_fully_paid

    # 3. Jika lunas, tentukan tanggal pelunasan kumulatif (settlement date):
    if is_fully_paid:
        # Urutkan pembayaran verified secara kronologis
        # Jika tanggal sama, urutkan berdasarkan waktu/id
        verified_sorted = sorted(
            verified_payments,
            key=lambda x: (x["payment_date"] or date.min, str(x.get("id") or "")),
        )

        running_sum = Decimal("0")
        settlement_date: Optional[date] = None

        for vp in verified_sorted:
            running_sum += vp["amount"]
            if running_sum >= target:
                settlement_date = vp["payment_date"] or due_date
                break

        metadata["settlement_date"] = (
            settlement_date.isoformat() if settlement_date else None
        )

        # Evaluasi keterlambatan pelunasan:
        if settlement_date and settlement_date <= due_date:
            metadata["reason"] = (
                f"Lunas tepat waktu pada {settlement_date} (due_date: {due_date})"
            )
            return 0, "ON_TIME", metadata
        else:
            metadata["reason"] = (
                f"Lunas terlambat pada {settlement_date} (due_date: {due_date})"
            )
            return 1, "LATE_SETTLED_AFTER_DUE", metadata

    # 4. Jika belum lunas:
    # Cek apakah sudah melewati tanggal jatuh tempo
    if eval_date > due_date:
        # Jika masih ada pembayaran pending pasca jatuh tempo: status ambigu, wajib dieksklusi
        if total_pending > Decimal("0"):
            metadata["reason"] = (
                f"Melewati jatuh tempo ({due_date}) namun masih memiliki pembayaran pending Rp {total_pending}."
            )
            return None, EXCLUDED_AMBIGUOUS_PENDING, metadata

        # Tidak ada pending dan belum lunas melewati due_date: Terlambat Menunggak (Overdue)
        metadata["reason"] = (
            f"Melewati jatuh tempo ({due_date}) belum lunas dan tidak ada pembayaran pending."
        )
        return 1, "LATE_OVERDUE_UNPAID", metadata

    # 5. Belum lunas dan belum melewati tanggal jatuh tempo:
    metadata["reason"] = (
        f"Termin masih aktif berjalan (due_date: {due_date}, eval_date: {eval_date}). Belum dapat dilabeli."
    )
    return None, EXCLUDED_NOT_DUE, metadata

