-- ========================================================
-- MIGRASI: Trigger Integritas Relasi Termin & Anti Over-Alokasi Pembayaran
-- File: supabase/migrations/20261101120000_create_payment_term_integrity_trigger.sql
-- ========================================================
-- Tujuan:
-- 1. Memastikan payments.jamaah_id konsisten dengan installment_terms.jamaah_id (Anti Cross-Jamaah) via IS DISTINCT FROM.
-- 2. Mengunci baris termin dengan SELECT ... FOR UPDATE untuk menjamin transaksi atomik dan mencegah race condition.
-- 3. Mencegah akumulasi pembayaran (verified + pending) melampaui nominal target termin, baik saat pengajuan pending maupun verifikasi.
-- 4. Menolak nominal pembayaran yang NULL, nol, atau negatif untuk pembayaran ber-termin.
-- 5. Memvalidasi status (menolak status NULL) dan jenis pembayaran (pembayaran 'full' wajib menggunakan installment_term_id = NULL).
-- 6. Menangani INSERT pembayaran transfer pending dan INSERT pembayaran tunai verified.
-- 7. Menangani UPDATE pending menjadi verified dengan validasi alokasi kuota komprehensif (verified + pending lain).
-- 8. Menangani UPDATE pending menjadi rejected sehingga alokasi kuota pending dilepaskan kembali.
-- 9. Menjamin kompatibilitas mutlak: melewati validasi jika installment_term_id IS NULL (pembayaran full, pembayaran langsung, dan data legacy).
-- 10. Menerapkan pengamanan ketat SECURITY DEFINER dengan search_path kosong (SET search_path = ''), kualifikasi eksplisit skema (public & pg_catalog), serta pengetatan hak akses fungsi tanpa grant berlebih.
--
-- PENTING / PETUNJUK TAHAP 2.5:
-- - Skrip ini HANYA disimpan secara lokal di repositori dan TIDAK dijalankan secara otomatis ke database remote Supabase.
-- ========================================================

CREATE OR REPLACE FUNCTION public.validate_payment_term_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_term_jamaah_id pg_catalog.UUID;
    v_target_amount pg_catalog.NUMERIC(15, 2);
    v_existing_verified pg_catalog.NUMERIC(15, 2) := 0;
    v_existing_pending pg_catalog.NUMERIC(15, 2) := 0;
    v_available_quota pg_catalog.NUMERIC(15, 2) := 0;
BEGIN
    -- 1. Kompatibilitas Penuh: Lewati validasi termin jika pembayaran tidak mengalokasikan termin
    -- (Mendukung pembayaran penuh 'full' yang sah, pembayaran langsung tanpa termin, dan data legacy)
    IF NEW.installment_term_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- 2. Validasi Jenis Pembayaran: Pembayaran penuh (full) tidak boleh mengikat termin cicilan spesifik
    IF NEW.payment_type = 'full' THEN
        RAISE EXCEPTION 'Pembayaran penuh (full) tidak boleh dialokasikan ke termin cicilan tertentu.';
    END IF;

    -- 3. Validasi Nominal Pembayaran: Wajib bernilai positif dan tidak boleh NULL
    IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
        RAISE EXCEPTION 'Nominal pembayaran tidak valid: Nilai harus lebih besar dari Rp 0.';
    END IF;

    -- 4. Validasi Status Pembayaran: Menolak NULL dan memastikan nilai status sesuai ENUM resmi
    IF NEW.status IS NULL OR NEW.status NOT IN ('pending', 'verified', 'rejected') THEN
        RAISE EXCEPTION 'Status pembayaran tidak valid: status tidak boleh NULL dan harus berupa pending, verified, atau rejected.';
    END IF;

    -- 5. Kunci baris termin dengan SELECT ... FOR UPDATE untuk menjamin transaksi atomik dan mencegah race condition
    SELECT t.jamaah_id, t.amount 
    INTO v_term_jamaah_id, v_target_amount
    FROM public.installment_terms t
    WHERE t.id = NEW.installment_term_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Termin cicilan tidak ditemukan (ID: %).', NEW.installment_term_id;
    END IF;

    -- Validasi integritas target nominal termin
    IF v_target_amount IS NULL OR v_target_amount <= 0 THEN
        RAISE EXCEPTION 'Target nominal termin tidak valid: Target harus lebih besar dari Rp 0.';
    END IF;

    -- 6. Validasi Kepemilikan Jamaah: Menolak NULL dan mencegah manipulasi cross-jamaah menggunakan IS DISTINCT FROM
    IF NEW.jamaah_id IS NULL OR NEW.jamaah_id IS DISTINCT FROM v_term_jamaah_id THEN
        RAISE EXCEPTION 'Akses ditolak: Termin cicilan tidak sesuai dengan identitas jamaah.';
    END IF;

    -- 7. Jika status pembayaran adalah 'rejected', transaksi yang ditolak melepaskan kuota termin
    IF NEW.status = 'rejected' THEN
        RETURN NEW;
    END IF;

    -- 8. Hitung total verified dan pending yang telah ada untuk termin ini,
    -- dengan mengecualikan baris transaksi yang sedang diperbarui (pada operasi UPDATE)
    -- agar nominal transaksi tidak dihitung dua kali
    SELECT 
        COALESCE(pg_catalog.SUM(p.amount) FILTER (WHERE p.status = 'verified'), 0),
        COALESCE(pg_catalog.SUM(p.amount) FILTER (WHERE p.status = 'pending'), 0)
    INTO v_existing_verified, v_existing_pending
    FROM public.payments p
    WHERE p.installment_term_id = NEW.installment_term_id
      AND (TG_OP = 'INSERT' OR p.id != NEW.id);

    -- 9. Evaluasi batas kuota termin berdasarkan status transaksi (memperhitungkan total alokasi verified + pending):
    IF NEW.status = 'verified' THEN
        -- Pembayaran terverifikasi (tunai kasir atau approval admin) tidak boleh membuat total alokasi
        -- (existing verified + pending lain + NEW.amount) melampaui target termin
        IF (v_existing_verified + v_existing_pending + NEW.amount) > v_target_amount THEN
            v_available_quota := GREATEST(0, v_target_amount - (v_existing_verified + v_existing_pending));
            RAISE EXCEPTION 'Pembayaran terverifikasi melebihi target termin. Sisa kuota yang tersedia: Rp %.',
                pg_catalog.to_char(v_available_quota, 'FM999,999,999,999');
        END IF;

    ELSIF NEW.status = 'pending' THEN
        -- Pengajuan transfer pending tidak boleh membuat total komitmen (verified + pending) > target
        -- Mencegah over-allocation saat dua pengajuan dilakukan bersamaan
        IF (v_existing_verified + v_existing_pending + NEW.amount) > v_target_amount THEN
            v_available_quota := GREATEST(0, v_target_amount - (v_existing_verified + v_existing_pending));
            RAISE EXCEPTION 'Pengajuan pembayaran melebihi target termin. Sisa kuota yang tersedia: Rp %.',
                pg_catalog.to_char(v_available_quota, 'FM999,999,999,999');
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Pasang Trigger pada Tabel payments
DROP TRIGGER IF EXISTS trg_validate_payment_term_integrity ON public.payments;
CREATE TRIGGER trg_validate_payment_term_integrity
    BEFORE INSERT OR UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_payment_term_integrity();

-- Pengetatan Hak Akses Eksekusi Fungsi (Least Privilege Mutlak)
-- Fungsi trigger hanya dipanggil secara internal oleh PostgreSQL saat event INSERT/UPDATE pada tabel payments.
-- Cabut seluruh izin eksekusi langsung dari PUBLIC, anon, dan authenticated untuk mencegah paparan hak berlebih.
REVOKE ALL ON FUNCTION public.validate_payment_term_integrity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_payment_term_integrity() FROM anon;
REVOKE ALL ON FUNCTION public.validate_payment_term_integrity() FROM authenticated;

-- Komentar dokumentasi
COMMENT ON FUNCTION public.validate_payment_term_integrity() IS 'Menjaga integritas relasi pembayaran terhadap termin cicilan, memvalidasi nominal positif, mencegah cross-jamaah (IS DISTINCT FROM), dan mencegah over-allocation secara atomik dengan search_path kosong.';
