-- ============================================================================
-- SUITE PENGUJIAN KONKURENSI FINAL (SUPABASE SQL EDITOR COMPATIBLE)
-- File: supabase/test_staging_concurrency_final.sql
-- Sasaran: Pembuktian Definitif Row Lock 'SELECT ... FOR UPDATE' & Anti Over-Allocation
-- ============================================================================
-- DIAGNOSIS KEGAGALAN SEBELUMNYA:
-- Pada percobaan sebelumnya dengan UUID 'c0000000-...':
-- 1. Transaksi A (Rp 700.000) sudah tersimpan di database dari percobaan awal.
-- 2. Ketika Langkah 2 (Sesi A) dijalankan ulang, kuota termin yang tersisa
--    hanya Rp 300.000. Pengajuan Rp 700.000 langsung DITOLAK oleh trigger seketika.
-- 3. Akibat penolakan tersebut, Sesi A gugur dalam 0,05 detik dan TIDAK PERNAH
--    mencapai pg_sleep(10). Tidak ada row lock yang ditahan.
-- 4. Ketika Sesi B dijalankan, tidak ada sesi yang mengunci termin, sehingga
--    durasi antre terbaca 0,00 detik dan pengujian gagal membuktikan lock wait.
--
-- SOLUSI PADA SKRIP FINAL INI:
-- 1. Menggunakan alokasi UUID BARU ('d0000000-...') yang terisolasi total dari data lama.
-- 2. Termin baru dipastikan memiliki target Rp 1.000.000 dengan riwayat pembayaran 0.
-- 3. Sesi A dijamin berhasil memasukkan Rp 700.000 dan menahan transaksi selama 10 detik.
-- 4. Sesi B yang dijalankan dalam jendela 10 detik dijamin mengalami antrean lock fisik
--    (durasi antre > 2s) sebelum ditolak dengan sisa kuota tepat Rp 300.000.
-- ============================================================================
-- ALOKASI UUID BARU (DETERMINISTIK & TERISOLASI):
-- - Paket Uji:   'd0000000-0000-0000-0000-000000000001'
-- - Jamaah Uji:  'd0000000-0000-0000-0000-000000000002' (NIK dinamis 16 digit numerik)
-- - Termin Uji:  'd0000000-0000-0000-0000-000000000003' (Target Rp 1.000.000, Saldo Awal Rp 0)
-- - Transaksi A: 'd0000000-0000-0000-0000-000000000004' (Rp 700.000, pending)
-- - Transaksi B: 'd0000000-0000-0000-0000-000000000005' (Rp 600.000, pending)
-- ============================================================================


-- ============================================================================
-- LANGKAH 1: PERSIAPAN DATA UJI BARU DENGAN COLLISION GUARD (Jalankan di Tab 1)
-- ============================================================================
-- Memastikan seluruh UUID 'd0000000-...' belum digunakan di database staging.
-- Membuat paket uji baru, jamaah baru dengan NIK numerik unik, dan termin baru Rp 1.000.000.
DO $$
DECLARE
    v_pkg_id UUID := 'd0000000-0000-0000-0000-000000000001';
    v_jamaah_id UUID := 'd0000000-0000-0000-0000-000000000002';
    v_term_id UUID := 'd0000000-0000-0000-0000-000000000003';
    v_pay_a_id UUID := 'd0000000-0000-0000-0000-000000000004';
    v_pay_b_id UUID := 'd0000000-0000-0000-0000-000000000005';
    v_dynamic_nik VARCHAR(20);
BEGIN
    -- 1. Collision Guard: Pastikan tidak ada satupun UUID pengujian final yang sudah ada
    IF EXISTS (SELECT 1 FROM public.packages WHERE id = v_pkg_id) OR
       EXISTS (SELECT 1 FROM public.jamaah WHERE id = v_jamaah_id) OR
       EXISTS (SELECT 1 FROM public.installment_terms WHERE id = v_term_id) OR
       EXISTS (SELECT 1 FROM public.payments WHERE id IN (v_pay_a_id, v_pay_b_id)) THEN
        RAISE EXCEPTION 'PENGUJIAN DIBATALKAN (COLLISION GUARD): Terdeteksi data dengan UUID pengujian final di database. Jangan hapus data secara acak. Periksa apakah data tersebut sisa pengujian sebelumnya.';
    END IF;

    -- 2. Generate NIK dinamis murni angka 16 digit (anti-benturan data staging)
    v_dynamic_nik := '9' || pg_catalog.lpad((pg_catalog.floor(pg_catalog.random() * 1000000000000000)::bigint)::text, 15, '0');
    WHILE EXISTS (SELECT 1 FROM public.jamaah WHERE nik = v_dynamic_nik) LOOP
        v_dynamic_nik := '9' || pg_catalog.lpad((pg_catalog.floor(pg_catalog.random() * 1000000000000000)::bigint)::text, 15, '0');
    END LOOP;

    -- 3. Insert Paket Uji Final
    INSERT INTO public.packages (id, name, type, price, departure_date, return_date, duration, quota)
    VALUES (v_pkg_id, 'Paket Uji Konkurensi Final', 'Umrah Reguler', 30000000, CURRENT_DATE + 30, CURRENT_DATE + 42, 12, 50);

    -- 4. Insert Jamaah Uji Final (profile_id = NULL)
    INSERT INTO public.jamaah (id, profile_id, nik, birth_date, gender, address, phone, package_id, status)
    VALUES (v_jamaah_id, NULL, v_dynamic_nik, '1995-05-05', 'Laki-laki', 'Jl. Konkurensi Final No. 1', '081299990002', v_pkg_id, 'Pendaftaran');

    -- 5. Insert Termin Uji Final (Target Rp 1.000.000, Tanpa Pembayaran Awal)
    INSERT INTO public.installment_terms (id, jamaah_id, term_number, title, amount, due_date)
    VALUES (v_term_id, v_jamaah_id, 1, 'Termin Uji Konkurensi Final', 1000000, CURRENT_DATE + 14);

    RAISE NOTICE '[OK] Langkah 1 Berhasil: Data dummy pengujian final siap dengan NIK dinamis (%).', v_dynamic_nik;
END $$;


-- ============================================================================
-- LANGKAH 2: SESI A — PEMBAYARAN RP 700.000 DENGAN SLEEP 10 DETIK (Jalankan di Tab 1)
-- ============================================================================
-- PETUNJUK OPERASIONAL:
-- 1. Buka Tab 2 di layar sebelah dan tempel query LANGKAH 3.
-- 2. Klik "Run" pada Langkah 2 ini di Tab 1.
-- 3. SEGERA pindah ke Tab 2 (dalam jendela 10 detik) dan klik "Run" di Tab 2.
--
-- MEKANISME DATABASE:
-- - Sesi A melakukan INSERT pembayaran Rp 700.000 pada termin bersih (Target 1.000.000, saldo awal 0).
-- - Validasi kuota lolos: 700.000 <= 1.000.000.
-- - Trigger mengeksekusi 'SELECT ... FOR UPDATE' yang mengunci baris termin secara eksklusif.
-- - Sesi A menahan transaksi selama 10 detik via pg_sleep(10).
-- - Setelah 10 detik, transaksi A di-COMMIT secara atomik.
DO $$
BEGIN
    INSERT INTO public.payments (
        id,
        jamaah_id,
        amount,
        payment_type,
        payment_method,
        status,
        installment_term_id
    ) VALUES (
        'd0000000-0000-0000-0000-000000000004',
        'd0000000-0000-0000-0000-000000000002',
        700000,
        'installment',
        'transfer',
        'pending',
        'd0000000-0000-0000-0000-000000000003'
    );

    -- Tahan transaksi selama 10 detik agar Sesi B dapat dijalankan secara bersamaan
    PERFORM pg_catalog.pg_sleep(10);
END $$;


-- ============================================================================
-- LANGKAH 3: SESI B — VERIFIKASI LOCK WAIT & OVER-ALLOCATION (Jalankan di Tab 2)
-- ============================================================================
-- JALANKAN INI SEGERA SETELAH LANGKAH 2 DIKLIK DI TAB 1 (SAAT TAB 1 SEDANG BERSTATUS RUNNING).
--
-- Kueri ini akan:
-- 1. Mencatat waktu mulai eksak dengan clock_timestamp().
-- 2. Mengajukan pembayaran Rp 600.000 pada termin yang sedang dikunci Sesi A.
-- 3. Tertahan di antrean PostgreSQL hingga Sesi A selesai commit (Lock Contention).
-- 4. Membaca komitmen terbaru Sesi A (Rp 700.000) dan ditolak karena 700k + 600k > 1M.
-- 5. Memverifikasi bahwa sisa kuota dilaporkan tepat Rp 300.000.
-- 6. Menampilkan grid hasil evaluasi visual di Supabase SQL Editor.
DROP TABLE IF EXISTS _concurrency_final_result;

CREATE TEMP TABLE _concurrency_final_result (
    test_timestamp TIMESTAMPTZ,
    wait_duration_seconds NUMERIC,
    lock_wait_confirmed BOOLEAN,
    rejection_confirmed BOOLEAN,
    post_commit_state_verified BOOLEAN,
    test_verdict TEXT,
    error_detail TEXT
);

DO $$
DECLARE
    v_start TIMESTAMPTZ := clock_timestamp();
    v_elapsed NUMERIC;
    v_err TEXT := NULL;
    v_lock_ok BOOLEAN := false;
    v_reject_ok BOOLEAN := false;
    v_state_ok BOOLEAN := false;
    v_verdict TEXT;
BEGIN
    BEGIN
        -- Percobaan pembayaran Rp 600.000 untuk termin yang sama
        INSERT INTO public.payments (
            id,
            jamaah_id,
            amount,
            payment_type,
            payment_method,
            status,
            installment_term_id
        ) VALUES (
            'd0000000-0000-0000-0000-000000000005',
            'd0000000-0000-0000-0000-000000000002',
            600000,
            'installment',
            'transfer',
            'pending',
            'd0000000-0000-0000-0000-000000000003'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err := SQLERRM;
    END;

    -- Hitung durasi antre aktual dalam detik
    v_elapsed := round(extract(epoch from (clock_timestamp() - v_start))::numeric, 2);

    -- 1. Evaluasi Lock Wait: Durasi antre minimal 2 detik membuktikan antrean kunci fisik
    IF v_elapsed >= 2.0 THEN
        v_lock_ok := true;
    END IF;

    -- 2. Evaluasi Penolakan Over-Allocation:
    IF v_err LIKE '%melebihi target termin%' THEN
        v_reject_ok := true;
    END IF;

    -- 3. Evaluasi State Pasca-Commit: Sisa kuota wajib terbaca tepat Rp 300.000
    -- Ini membuktikan Sesi B tidak membaca snapshot lama saat mulai, melainkan
    -- membaca baris terbaru setelah Sesi A commit (1.000.000 - 700.000 = 300.000).
    IF v_err LIKE '%300,000%' OR v_err LIKE '%300000%' THEN
        v_state_ok := true;
    END IF;

    -- 4. Keputusan Hasil Pengujian
    IF v_lock_ok AND v_reject_ok AND v_state_ok THEN
        v_verdict := 'PASS (Konkurensi, Lock Wait & State Pasca-Commit Terbukti Valid)';
    ELSIF NOT v_lock_ok AND v_reject_ok AND v_state_ok THEN
        v_verdict := 'INVALID TIMING (Ditolak dengan kuota 300k, tapi durasi < 2s: Tab 2 diklik setelah Sesi A selesai)';
    ELSIF v_err IS NULL THEN
        v_verdict := 'FAIL (Race Condition Lolos: Pembayaran Sesi B berhasil masuk padahal melebihi batas kuota!)';
    ELSE
        v_verdict := 'FAIL (Error tidak sesuai ekspektasi: ' || COALESCE(v_err, 'N/A') || ')';
    END IF;

    INSERT INTO _concurrency_final_result VALUES (
        clock_timestamp(),
        v_elapsed,
        v_lock_ok,
        v_reject_ok,
        v_state_ok,
        v_verdict,
        COALESCE(v_err, 'Tidak ada error')
    );
END $$;

-- Tampilkan Tabel Hasil Evaluasi Langsung di Grid Supabase SQL Editor
SELECT
    wait_duration_seconds AS "Durasi Antre (Detik)",
    lock_wait_confirmed AS "Lock Wait Terbukti?",
    post_commit_state_verified AS "State Pasca-Commit Terbaca?",
    rejection_confirmed AS "Over-Allocation Ditolak?",
    test_verdict AS "Kesimpulan Pengujian",
    error_detail AS "Rincian Pesan Database"
FROM _concurrency_final_result;


-- ============================================================================
-- LANGKAH 4: PEMBERSIHAN DATA PENGUJIAN FINAL / CLEANUP (Jalankan di Tab 1)
-- ============================================================================
-- PENGAMANAN CLEANUP:
-- 1. Hanya menghapus record dengan UUID 'd0000000-...' milik pengujian final.
-- 2. Memvalidasi atribut nama paket, termin, dan alamat jamaah sebelum penghapusan.
-- 3. Menolak eksekusi jika salah satu sesi masih berstatus aktif.
DO $$
DECLARE
    v_pkg_id UUID := 'd0000000-0000-0000-0000-000000000001';
    v_jamaah_id UUID := 'd0000000-0000-0000-0000-000000000002';
    v_term_id UUID := 'd0000000-0000-0000-0000-000000000003';
    v_is_test_data BOOLEAN := false;
BEGIN
    -- 1. Verifikasi apakah data pengujian masih berjalan di pg_stat_activity
    IF EXISTS (
        SELECT 1 FROM pg_stat_activity
        WHERE query LIKE '%d0000000-%'
          AND pid <> pg_backend_pid()
          AND state = 'active'
    ) THEN
        RAISE EXCEPTION 'PEMBERSIHAN DIBATALKAN: Masih terdeteksi sesi pengujian yang aktif di database. Tunggu hingga Sesi A dan Sesi B selesai.';
    END IF;

    -- 2. Verifikasi identitas data sebelum dihapus
    SELECT (
        p.name = 'Paket Uji Konkurensi Final' AND
        j.address = 'Jl. Konkurensi Final No. 1' AND
        t.title = 'Termin Uji Konkurensi Final'
    ) INTO v_is_test_data
    FROM public.packages p
    JOIN public.jamaah j ON j.package_id = p.id
    JOIN public.installment_terms t ON t.jamaah_id = j.id
    WHERE p.id = v_pkg_id AND j.id = v_jamaah_id AND t.id = v_term_id;

    IF v_is_test_data IS NOT TRUE THEN
        IF NOT EXISTS (SELECT 1 FROM public.packages WHERE id = v_pkg_id) AND
           NOT EXISTS (SELECT 1 FROM public.jamaah WHERE id = v_jamaah_id) THEN
            RAISE NOTICE '[OK] Database sudah bersih dari data pengujian final.';
            RETURN;
        ELSE
            RAISE EXCEPTION 'PEMBERSIHAN DIBATALKAN: Data dengan UUID pengujian ditemukan tetapi atributnya tidak sesuai dengan penanda dummy uji final.';
        END IF;
    END IF;

    -- 3. Hapus hanya pembayaran dummy pengujian final
    DELETE FROM public.payments WHERE id IN (
        'd0000000-0000-0000-0000-000000000004',
        'd0000000-0000-0000-0000-000000000005'
    );

    -- 4. Hapus termin pengujian final
    DELETE FROM public.installment_terms WHERE id = v_term_id;

    -- 5. Hapus jamaah pengujian final
    DELETE FROM public.jamaah WHERE id = v_jamaah_id;

    -- 6. Hapus paket pengujian final
    DELETE FROM public.packages WHERE id = v_pkg_id;

    RAISE NOTICE '[OK] Pembersihan berhasil: Seluruh data uji final (d0000000-...) telah dihapus secara aman.';
END $$;

-- Verifikasi Akhir Pembersihan Data Final (Harus Menghasilkan Angka 0 Semua)
SELECT
    (SELECT count(*) FROM public.payments WHERE id IN ('d0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000005')) AS sisa_payments,
    (SELECT count(*) FROM public.installment_terms WHERE id = 'd0000000-0000-0000-0000-000000000003') AS sisa_terms,
    (SELECT count(*) FROM public.jamaah WHERE id = 'd0000000-0000-0000-0000-000000000002') AS sisa_jamaah,
    (SELECT count(*) FROM public.packages WHERE id = 'd0000000-0000-0000-0000-000000000001') AS sisa_packages;


-- ============================================================================
-- LAMPIRAN OPSIONAL: PEMBERSIHAN DATA SISA PERCOBAAN LAMA ('c0000000-...')
-- ============================================================================
-- Jalankan blok di bawah ini HANYA JIKA Anda ingin membersihkan data sisa dari
-- percobaan sebelumnya yang tertinggal di database staging Anda.
--
-- DO $$
-- BEGIN
--     DELETE FROM public.payments WHERE id IN ('c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000005');
--     DELETE FROM public.installment_terms WHERE id = 'c0000000-0000-0000-0000-000000000003';
--     DELETE FROM public.jamaah WHERE id = 'c0000000-0000-0000-0000-000000000002';
--     DELETE FROM public.packages WHERE id = 'c0000000-0000-0000-0000-000000000001';
--     RAISE NOTICE '[OK] Data sisa c0000000-... berhasil dibersihkan.';
-- END $$;

