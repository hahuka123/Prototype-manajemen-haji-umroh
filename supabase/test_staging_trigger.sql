-- ============================================================================
-- SUITE PENGUJIAN STAGING: TRIGGER INTEGRITAS TERMIN CICILAN (ML STAGE 2.8.1)
-- File: supabase/test_staging_trigger.sql
-- Sasaran: public.validate_payment_term_integrity()
-- ============================================================================
-- Petunjuk Eksekusi:
-- 1. Buka Supabase Dashboard proyek STAGING Anda (SQL Editor -> New Query).
-- 2. Pastikan migrasi fondasi, installment_terms, dan trigger sudah terpasang:
--    a. supabase/staging_foundation.sql
--    b. supabase/migrations/20261024100000_create_installment_terms_schema.sql
--    c. supabase/migrations/20261101120000_create_payment_term_integrity_trigger.sql
-- 3. Salin seluruh isi skrip ini dan klik "Run".
-- 4. Skrip ini dijalankan dalam blok transaksi dengan ROLLBACK di akhir,
--    sehingga TIDAK meninggalkan residu data dummy di database staging Anda.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    -- ID Pengujian Dummy (Hanya entitas paket, jamaah, dan termin)
    -- Catatan: profile_id pada tabel jamaah bersifat nullable, sehingga tidak
    -- memerlukan entitas profiles/auth.users untuk memvalidasi trigger pembayaran.
    v_dummy_pkg_id UUID := gen_random_uuid();
    v_dummy_jamaah_a UUID := gen_random_uuid();
    v_dummy_jamaah_b UUID := gen_random_uuid();
    v_dummy_term_a UUID := gen_random_uuid();
    v_dummy_term_b UUID := gen_random_uuid();

    -- Variabel Transaksi Pengujian
    v_pay_id_1 UUID;
    v_pay_id_2 UUID;
    v_err_caught BOOLEAN := false;
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'MEMULAI PENGUJIAN TRIGGER INTEGRITAS TERMIN CICILAN (STAGE 2.8.1)';
    RAISE NOTICE '============================================================';

    -- 0. PERSIAPAN DATA DUMMY ISOLASI
    -- Insert Paket Dummy
    INSERT INTO public.packages (id, name, type, price, departure_date, return_date, duration, quota)
    VALUES (v_dummy_pkg_id, 'Paket Uji Staging ML', 'Umrah Reguler', 30000000, CURRENT_DATE + 30, CURRENT_DATE + 42, 12, 45);

    -- Insert Jamaah A (profile_id dibiarkan NULL karena nullable dan independen dari auth.users)
    INSERT INTO public.jamaah (id, profile_id, nik, birth_date, gender, address, phone, package_id, status)
    VALUES (v_dummy_jamaah_a, NULL, '3171000000000001', '1990-01-01', 'Laki-laki', 'Jl. Test Staging No. 1', '081200000001', v_dummy_pkg_id, 'Pendaftaran');

    -- Insert Jamaah B (profile_id dibiarkan NULL)
    INSERT INTO public.jamaah (id, profile_id, nik, birth_date, gender, address, phone, package_id, status)
    VALUES (v_dummy_jamaah_b, NULL, '3171000000000002', '1992-02-02', 'Perempuan', 'Jl. Test Staging No. 2', '081200000002', v_dummy_pkg_id, 'Pendaftaran');

    -- Insert Termin A (Target Rp 1.000.000)
    INSERT INTO public.installment_terms (id, jamaah_id, term_number, title, amount, due_date)
    VALUES (v_dummy_term_a, v_dummy_jamaah_a, 1, 'Termin 1 Uji Staging', 1000000, CURRENT_DATE + 14);

    -- Insert Termin B (Target Rp 2.000.000)
    INSERT INTO public.installment_terms (id, jamaah_id, term_number, title, amount, due_date)
    VALUES (v_dummy_term_b, v_dummy_jamaah_b, 1, 'Termin 1 Jamaah B', 2000000, CURRENT_DATE + 14);

    RAISE NOTICE '[OK] Data dummy isolasi berhasil disiapkan (tanpa foreign key auth.users).';

    -- ------------------------------------------------------------------------
    -- SKENARIO 1: INSERT transfer pending valid (Termin Rp 1.000.000, bayar Rp 400.000)
    -- ------------------------------------------------------------------------
    v_pay_id_1 := gen_random_uuid();
    INSERT INTO public.payments (id, jamaah_id, amount, payment_type, payment_method, status, installment_term_id)
    VALUES (v_pay_id_1, v_dummy_jamaah_a, 400000, 'installment', 'transfer', 'pending', v_dummy_term_a);
    RAISE NOTICE '[SKENARIO 1 - PASS] INSERT transfer pending valid Rp 400.000 berhasil.';

    -- ------------------------------------------------------------------------
    -- SKENARIO 2: INSERT tunai verified valid (Sisa Rp 600.000, bayar tunai Rp 600.000 verified)
    -- Catatan: Total alokasi pas Rp 1.000.000 (pending 400k + cash 600k)
    -- ------------------------------------------------------------------------
    v_pay_id_2 := gen_random_uuid();
    INSERT INTO public.payments (id, jamaah_id, amount, payment_type, payment_method, status, installment_term_id)
    VALUES (v_pay_id_2, v_dummy_jamaah_a, 600000, 'installment', 'cash', 'verified', v_dummy_term_a);
    RAISE NOTICE '[SKENARIO 2 - PASS] INSERT tunai verified valid Rp 600.000 berhasil.';

    -- ------------------------------------------------------------------------
    -- SKENARIO 3: Cross-jamaah harus DITOLAK
    -- Jamaah A mencoba membayar termin milik Jamaah B
    -- ------------------------------------------------------------------------
    v_err_caught := false;
    BEGIN
        INSERT INTO public.payments (jamaah_id, amount, payment_type, payment_method, status, installment_term_id)
        VALUES (v_dummy_jamaah_a, 500000, 'installment', 'transfer', 'pending', v_dummy_term_b);
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Akses ditolak: Termin cicilan tidak sesuai dengan identitas jamaah%' THEN
            v_err_caught := true;
            RAISE NOTICE '[SKENARIO 3 - PASS] Cross-jamaah berhasil dicegah secara spesifik: %', SQLERRM;
        ELSE
            RAISE EXCEPTION 'SKENARIO 3 GAGAL: Error yang tertangkap bukan validasi cross-jamaah: %', SQLERRM;
        END IF;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'SKENARIO 3 GAGAL: Cross-jamaah tidak ditolak oleh database!';
    END IF;

    -- ------------------------------------------------------------------------
    -- SKENARIO 4a: Nominal nol harus DITOLAK
    -- ------------------------------------------------------------------------
    v_err_caught := false;
    BEGIN
        INSERT INTO public.payments (jamaah_id, amount, payment_type, payment_method, status, installment_term_id)
        VALUES (v_dummy_jamaah_a, 0, 'installment', 'transfer', 'pending', v_dummy_term_a);
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Nominal pembayaran tidak valid%' OR SQLERRM LIKE '%amount%' THEN
            v_err_caught := true;
            RAISE NOTICE '[SKENARIO 4a - PASS] Nominal nol berhasil ditolak: %', SQLERRM;
        ELSE
            RAISE EXCEPTION 'SKENARIO 4a GAGAL: Error yang tertangkap bukan validasi nominal: %', SQLERRM;
        END IF;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'SKENARIO 4a GAGAL: Nominal nol diizinkan!'; END IF;

    -- ------------------------------------------------------------------------
    -- SKENARIO 4b: Nominal negatif harus DITOLAK
    -- ------------------------------------------------------------------------
    v_err_caught := false;
    BEGIN
        INSERT INTO public.payments (jamaah_id, amount, payment_type, payment_method, status, installment_term_id)
        VALUES (v_dummy_jamaah_a, -50000, 'installment', 'transfer', 'pending', v_dummy_term_a);
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Nominal pembayaran tidak valid%' OR SQLERRM LIKE '%amount%' THEN
            v_err_caught := true;
            RAISE NOTICE '[SKENARIO 4b - PASS] Nominal negatif berhasil ditolak: %', SQLERRM;
        ELSE
            RAISE EXCEPTION 'SKENARIO 4b GAGAL: Error yang tertangkap bukan validasi nominal: %', SQLERRM;
        END IF;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'SKENARIO 4b GAGAL: Nominal negatif diizinkan!'; END IF;

    -- ------------------------------------------------------------------------
    -- SKENARIO 4c: Nominal NULL harus DITOLAK
    -- ------------------------------------------------------------------------
    v_err_caught := false;
    BEGIN
        INSERT INTO public.payments (jamaah_id, amount, payment_type, payment_method, status, installment_term_id)
        VALUES (v_dummy_jamaah_a, NULL, 'installment', 'transfer', 'pending', v_dummy_term_a);
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Nominal pembayaran tidak valid%' OR SQLERRM LIKE '%null%' OR SQLERRM LIKE '%amount%' THEN
            v_err_caught := true;
            RAISE NOTICE '[SKENARIO 4c - PASS] Nominal NULL berhasil ditolak: %', SQLERRM;
        ELSE
            RAISE EXCEPTION 'SKENARIO 4c GAGAL: Error yang tertangkap bukan validasi nominal: %', SQLERRM;
        END IF;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'SKENARIO 4c GAGAL: Nominal NULL diizinkan!'; END IF;

    -- ------------------------------------------------------------------------
    -- SKENARIO 5: Status NULL harus DITOLAK
    -- ------------------------------------------------------------------------
    v_err_caught := false;
    BEGIN
        INSERT INTO public.payments (jamaah_id, amount, payment_type, payment_method, status, installment_term_id)
        VALUES (v_dummy_jamaah_a, 100000, 'installment', 'transfer', NULL, v_dummy_term_a);
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Status pembayaran tidak valid%' OR SQLERRM LIKE '%status%' OR SQLERRM LIKE '%null%' THEN
            v_err_caught := true;
            RAISE NOTICE '[SKENARIO 5 - PASS] Status NULL berhasil ditolak: %', SQLERRM;
        ELSE
            RAISE EXCEPTION 'SKENARIO 5 GAGAL: Error yang tertangkap bukan validasi status: %', SQLERRM;
        END IF;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'SKENARIO 5 GAGAL: Status NULL diizinkan!'; END IF;

    -- ------------------------------------------------------------------------
    -- SKENARIO 6: Over-allocation harus DITOLAK
    -- Termin A (target 1M) saat ini sudah penuh: pending 400k + verified 600k = 1M.
    -- Pengajuan baru Rp 50.000 harus ditolak.
    -- ------------------------------------------------------------------------
    v_err_caught := false;
    BEGIN
        INSERT INTO public.payments (jamaah_id, amount, payment_type, payment_method, status, installment_term_id)
        VALUES (v_dummy_jamaah_a, 50000, 'installment', 'transfer', 'pending', v_dummy_term_a);
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%melebihi target termin%' THEN
            v_err_caught := true;
            RAISE NOTICE '[SKENARIO 6 - PASS] Over-allocation berhasil ditolak secara spesifik: %', SQLERRM;
        ELSE
            RAISE EXCEPTION 'SKENARIO 6 GAGAL: Error yang tertangkap bukan over-allocation: %', SQLERRM;
        END IF;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'SKENARIO 6 GAGAL: Over-allocation diloloskan!'; END IF;

    -- ------------------------------------------------------------------------
    -- SKENARIO 7: Transisi pending -> verified tanpa double-counting
    -- Transaksi 1 (Rp 400.000) diverifikasi admin.
    -- Total akhir verified menjadi: verified 600k + 400k = 1M (harus SUKSES).
    -- ------------------------------------------------------------------------
    UPDATE public.payments
    SET status = 'verified'
    WHERE id = v_pay_id_1;
    RAISE NOTICE '[SKENARIO 7 - PASS] Transisi pending -> verified tanpa double counting berhasil.';

    -- ------------------------------------------------------------------------
    -- SKENARIO 8: Pending lain tetap dihitung saat verifikasi transaksi baru
    -- Buat skenario baru pada Jamaah B (Target Termin B: Rp 2.000.000):
    -- a. Transaksi B1 pending Rp 1.200.000 (kuota sisa Rp 800.000)
    -- b. Transaksi B2 pending Rp 900.000 diverifikasi -> Ditolak karena 1.2M + 900k = 2.1M > 2M
    -- ------------------------------------------------------------------------
    DECLARE
        v_pay_b1 UUID := gen_random_uuid();
        v_pay_b2 UUID := gen_random_uuid();
    BEGIN
        -- Transaksi B1 pending Rp 1.200.000
        INSERT INTO public.payments (id, jamaah_id, amount, payment_type, payment_method, status, installment_term_id)
        VALUES (v_pay_b1, v_dummy_jamaah_b, 1200000, 'installment', 'transfer', 'pending', v_dummy_term_b);

        -- Transaksi B2 diajukan langsung sebagai verified Rp 900.000
        v_err_caught := false;
        BEGIN
            INSERT INTO public.payments (id, jamaah_id, amount, payment_type, payment_method, status, installment_term_id)
            VALUES (v_pay_b2, v_dummy_jamaah_b, 900000, 'installment', 'cash', 'verified', v_dummy_term_b);
        EXCEPTION WHEN OTHERS THEN
            IF SQLERRM LIKE '%melebihi target termin%' THEN
                v_err_caught := true;
                RAISE NOTICE '[SKENARIO 8 - PASS] Verifikasi ditolak karena ada pending lain yang mengikat kuota: %', SQLERRM;
            ELSE
                RAISE EXCEPTION 'SKENARIO 8 GAGAL: Error yang tertangkap bukan over-allocation: %', SQLERRM;
            END IF;
        END;
        IF NOT v_err_caught THEN RAISE EXCEPTION 'SKENARIO 8 GAGAL: Verifikasi meloloskan over-alokasi pending!'; END IF;

        -- --------------------------------------------------------------------
        -- SKENARIO 9: Pending menjadi rejected melepaskan alokasi
        -- Transaksi B1 di-reject, maka kuota Rp 1.200.000 bebas kembali.
        -- Setelah itu, Transaksi B2 Rp 900.000 diverifikasi -> harus SUKSES.
        -- --------------------------------------------------------------------
        UPDATE public.payments SET status = 'rejected' WHERE id = v_pay_b1;

        INSERT INTO public.payments (id, jamaah_id, amount, payment_type, payment_method, status, installment_term_id)
        VALUES (v_pay_b2, v_dummy_jamaah_b, 900000, 'installment', 'cash', 'verified', v_dummy_term_b);
        RAISE NOTICE '[SKENARIO 9 - PASS] Transaksi rejected sukses melepaskan alokasi kuota.';
    END;

    -- ------------------------------------------------------------------------
    -- SKENARIO 10: Pembayaran full tanpa termin tetap berjalan normal
    -- ------------------------------------------------------------------------
    INSERT INTO public.payments (jamaah_id, amount, payment_type, payment_method, status, installment_term_id)
    VALUES (v_dummy_jamaah_a, 30000000, 'full', 'transfer', 'pending', NULL);
    RAISE NOTICE '[SKENARIO 10 - PASS] Pembayaran full tanpa termin berhasil diproses.';

    -- ------------------------------------------------------------------------
    -- SKENARIO 11: Transaksi legacy tanpa termin tetap berjalan normal
    -- ------------------------------------------------------------------------
    INSERT INTO public.payments (jamaah_id, amount, payment_type, payment_method, status, installment_term_id)
    VALUES (v_dummy_jamaah_a, 2500000, 'installment', 'cash', 'verified', NULL);
    RAISE NOTICE '[SKENARIO 11 - PASS] Transaksi legacy (installment_term_id NULL) berhasil diproses.';

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'SEMUA 11 SKENARIO LOKAL/STAGING BERHASIL DIUJI DENGAN SEMPURNA!';
    RAISE NOTICE '============================================================';
END $$;

-- Batalkan transaksi pengujian agar database staging kembali bersih tanpa sisa dummy data
ROLLBACK;
