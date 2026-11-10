-- ============================================================================
-- SUITE PENGUJIAN KONKURENSI ALTERNATIF (SUPABASE SQL EDITOR COMPATIBLE)
-- File: supabase/test_staging_concurrency_alternative.sql
-- Sasaran: Validasi Race Condition & 'SELECT ... FOR UPDATE' tanpa Aplikasi Eksternal
-- ============================================================================
-- Karakteristik & Mengapa Skrip Alternatif Ini Diperlukan:
-- 1. Supabase SQL Editor berbasis web bersifat stateless HTTP query runner.
-- 2. Transaksi multi-klik manual (BEGIN di klik 1, COMMIT di klik 2) TIDAK DAPAT
--    dipertahankan karena koneksi backend ditutup/direset antar-klik (pg_backend_pid berbeda).
-- 3. Skrip alternatif ini membungkus Sesi A dalam satu blok atomik DO $$ ... $$
--    yang menahan transaksi selama 10 detik (pg_sleep) sambil memegang row-lock pada baris termin.
-- 4. Sesi B dijalankan dari tab kedua saat Sesi A sedang tidur:
--    - Membuktikan lock contention melalui penundaan eksekusi aktual (clock_timestamp).
--    - Membuktikan pembacaan snapshot terkini pasca-commit (sisa kuota termin terbaca Rp 300.000).
--    - Membuktikan penolakan over-allocation secara deterministik (700k + 600k > 1M).
-- ============================================================================
-- Alokasi UUID Khusus Pengujian (Deterministik & Terisolasi):
-- - Paket Uji:   'c0000000-0000-0000-0000-000000000001'
-- - Jamaah Uji:  'c0000000-0000-0000-0000-000000000002' (NIK: Dinamis 16 digit angka numerik)
-- - Termin Uji:  'c0000000-0000-0000-0000-000000000003' (Target Rp 1.000.000)
-- - Transaksi A: 'c0000000-0000-0000-0000-000000000004' (Rp 700.000, pending)
-- - Transaksi B: 'c0000000-0000-0000-0000-000000000005' (Rp 600.000, pending)
-- ============================================================================


-- ============================================================================
-- LANGKAH 1: PERSIAPAN DATA UJI DENGAN COLLISION GUARD (Jalankan di Tab 1)
-- ============================================================================
-- PERINGATAN KEAMANAN:
-- Skrip TIDAK menghapus data secara otomatis jika UUID terdeteksi.
-- Collision guard akan membatalkan proses demi melindungi integritas data yang ada.
DO $$
DECLARE
    v_pkg_id UUID := 'c0000000-0000-0000-0000-000000000001';
    v_jamaah_id UUID := 'c0000000-0000-0000-0000-000000000002';
    v_term_id UUID := 'c0000000-0000-0000-0000-000000000003';
    v_pay_a_id UUID := 'c0000000-0000-0000-0000-000000000004';
    v_pay_b_id UUID := 'c0000000-0000-0000-0000-000000000005';
    v_dynamic_nik VARCHAR(20);
BEGIN
    -- 1. Collision Guard Ketat: Pastikan tidak ada satupun UUID uji yang sedang digunakan
    IF EXISTS (SELECT 1 FROM public.packages WHERE id = v_pkg_id) OR
       EXISTS (SELECT 1 FROM public.jamaah WHERE id = v_jamaah_id) OR
       EXISTS (SELECT 1 FROM public.installment_terms WHERE id = v_term_id) OR
       EXISTS (SELECT 1 FROM public.payments WHERE id IN (v_pay_a_id, v_pay_b_id)) THEN
        RAISE EXCEPTION 'PENGUJIAN DIBATALKAN (COLLISION GUARD): Terdeteksi satu atau lebih UUID pengujian sudah ada di database. JANGAN menghapus data ini tanpa verifikasi identitas data. Periksa apakah data tersebut adalah data staging yang sah atau sisa pengujian sebelumnya.';
    END IF;

    -- 2. Generate NIK dinamis numerik murni 16 digit (anti-benturan dengan data jamaah yang ada)
    v_dynamic_nik := '9' || pg_catalog.lpad((pg_catalog.floor(pg_catalog.random() * 1000000000000000)::bigint)::text, 15, '0');
    WHILE EXISTS (SELECT 1 FROM public.jamaah WHERE nik = v_dynamic_nik) LOOP
        v_dynamic_nik := '9' || pg_catalog.lpad((pg_catalog.floor(pg_catalog.random() * 1000000000000000)::bigint)::text, 15, '0');
    END LOOP;

    -- 3. Insert Paket Uji (Identitas khusus: 'Paket Uji Konkurensi Alt')
    INSERT INTO public.packages (id, name, type, price, departure_date, return_date, duration, quota)
    VALUES (v_pkg_id, 'Paket Uji Konkurensi Alt', 'Umrah Reguler', 30000000, CURRENT_DATE + 30, CURRENT_DATE + 42, 12, 50);

    -- 4. Insert Jamaah Uji (profile_id = NULL)
    INSERT INTO public.jamaah (id, profile_id, nik, birth_date, gender, address, phone, package_id, status)
    VALUES (v_jamaah_id, NULL, v_dynamic_nik, '1995-05-05', 'Laki-laki', 'Jl. Konkurensi No. 12', '081299990001', v_pkg_id, 'Pendaftaran');

    -- 5. Insert Termin Uji (Target Rp 1.000.000)
    INSERT INTO public.installment_terms (id, jamaah_id, term_number, title, amount, due_date)
    VALUES (v_term_id, v_jamaah_id, 1, 'Termin Uji Konkurensi Alt', 1000000, CURRENT_DATE + 14);

    RAISE NOTICE '[OK] Langkah 1 Berhasil: Data dummy pengujian siap dengan NIK dinamis (%).', v_dynamic_nik;
END $$;


-- ============================================================================
-- LANGKAH 2: SESI A — PEMBAYARAN RP 700.000 DENGAN SLEEP 10 DETIK (Jalankan di Tab 1)
-- ============================================================================
-- PETUNJUK OPERASIONAL:
-- 1. Buka Tab 2 di layar sebelah dan siapkan query LANGKAH 3.
-- 2. Klik "Run" pada Langkah 2 ini di Tab 1.
-- 3. SEGERA pindah ke Tab 2 (dalam jendela 10 detik) dan klik "Run" di Tab 2.
--
-- MEKANISME DATABASE:
-- - Sesi A mengeksekusi INSERT pembayaran Rp 700.000.
-- - Trigger mengeksekusi 'SELECT ... FOR UPDATE' yang mengunci baris termin secara eksklusif.
-- - Sesi A menahan transaksi selama 10 detik melalui pg_sleep(10).
-- - Setelah 10 detik, blok selesai dan PostgreSQL meng-COMMIT transaksi A secara atomik.
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
        'c0000000-0000-0000-0000-000000000004',
        'c0000000-0000-0000-0000-000000000002',
        700000,
        'installment',
        'transfer',
        'pending',
        'c0000000-0000-0000-0000-000000000003'
    );

    -- Tahan transaksi selama 10 detik agar Sesi B dapat dijalankan secara bersamaan
    PERFORM pg_catalog.pg_sleep(10);
END $$;


-- ============================================================================
-- LANGKAH 2B (OPSIONAL): MONITORING LOCK AKTIF POSTGRESQL (Tab Terpisah)
-- ============================================================================
-- Jika ingin melihat bukti internal pg_locks saat Sesi A tidur dan Sesi B mengantre:
-- Jalankan query ini di Tab ke-3 tepat saat Sesi A dan Sesi B sedang berstatus RUNNING:
--
-- SELECT
--     l.pid,
--     a.state,
--     l.locktype,
--     l.mode,
--     l.granted,
--     CASE
--         WHEN l.granted THEN 'HOLDING LOCK (Sesi A)'
--         ELSE 'WAITING FOR LOCK (Sesi B terantre)'
--     END AS status_kunci
-- FROM pg_locks l
-- JOIN pg_stat_activity a ON l.pid = a.pid
-- WHERE l.relation = 'public.installment_terms'::regclass
--   AND a.pid <> pg_backend_pid();


-- ============================================================================
-- LANGKAH 3: SESI B — VERIFIKASI LOCK WAIT & OVER-ALLOCATION (Jalankan di Tab 2)
-- ============================================================================
-- JALANKAN INI SEGERA SETELAH LANGKAH 2 DIKLIK DI TAB 1 (SAAT TAB 1 SEDANG BERJALAN).
--
-- Catatan Teknis Temporary Table:
-- Menggunakan DROP TABLE IF EXISTS diikuti CREATE TEMP TABLE tanpa ON COMMIT DROP.
-- Ini menjamin tabel tetap ada saat query SELECT hasil dijalankan di akhir sesi batch,
-- dan tidak hilang secara prematur akibat commit implisit blok DO $$.
DROP TABLE IF EXISTS _concurrency_test_result;

CREATE TEMP TABLE _concurrency_test_result (
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
            'c0000000-0000-0000-0000-000000000005',
            'c0000000-0000-0000-0000-000000000002',
            600000,
            'installment',
            'transfer',
            'pending',
            'c0000000-0000-0000-0000-000000000003'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err := SQLERRM;
    END;

    -- Hitung durasi terblokir dalam hitungan detik secara aktual
    v_elapsed := round(extract(epoch from (clock_timestamp() - v_start))::numeric, 2);

    -- 1. Evaluasi Latensi / Lock Wait:
    -- Jika v_elapsed >= 2.0 detik, terindikasi Sesi B mengantre di row-lock Sesi A.
    IF v_elapsed >= 2.0 THEN
        v_lock_ok := true;
    END IF;

    -- 2. Evaluasi Penolakan Trigger:
    IF v_err LIKE '%melebihi target termin%' THEN
        v_reject_ok := true;
    END IF;

    -- 3. Evaluasi State Pasca-Commit (Bukti Validitas SELECT ... FOR UPDATE):
    -- Sesi B ditolak dengan menyebutkan sisa kuota yang akurat (Rp 300,000 = 1.000.000 - 700.000).
    -- Jika Sesi B tidak menunggu Sesi A, Sesi B akan melihat kuota Rp 1.000.000 dan lolos.
    -- Terbacanya Rp 300,000 membuktikan Sesi B membaca state tuple terbaru pasca-commit Sesi A.
    IF v_err LIKE '%300,000%' OR v_err LIKE '%300000%' THEN
        v_state_ok := true;
    END IF;

    -- 4. Kesimpulan Evaluasi
    IF v_lock_ok AND v_reject_ok AND v_state_ok THEN
        v_verdict := 'PASS (Konkurensi, Lock Wait & State Pasca-Commit Terbukti Valid)';
    ELSIF NOT v_lock_ok AND v_reject_ok AND v_state_ok THEN
        v_verdict := 'INVALID TIMING (Ditolak dengan kuota benar, tapi durasi < 2s: Tab 2 dijalankan setelah Sesi A selesai)';
    ELSIF v_err IS NULL THEN
        v_verdict := 'FAIL (Race Condition Terjadi: Pembayaran Sesi B lolos padahal kuota melampaui batas!)';
    ELSE
        v_verdict := 'FAIL (Error tidak terduga: ' || COALESCE(v_err, 'N/A') || ')';
    END IF;

    INSERT INTO _concurrency_test_result VALUES (
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
    lock_wait_confirmed AS "Lock Wait Terindikasi?",
    post_commit_state_verified AS "State Pasca-Commit Terbaca?",
    rejection_confirmed AS "Over-Allocation Ditolak?",
    test_verdict AS "Kesimpulan Pengujian",
    error_detail AS "Rincian Pesan Database"
FROM _concurrency_test_result;


-- ============================================================================
-- LANGKAH 4: PEMBERSIHAN DATA PENGUJIAN / CLEANUP (Jalankan di Tab 1)
-- ============================================================================
-- PENGAMANAN CLEANUP KETAT:
-- 1. Skrip memeriksa terlebih dahulu apakah data yang akan dihapus BENAR-BENAR
--    dibuat oleh pengujian ini (verifikasi judul paket, termin, dan alamat jamaah).
-- 2. Jika identitas tidak cocok, pembersihan DIBATALKAN untuk melindungi data lain.
-- 3. HANYA menghapus 5 UUID deterministik yang terbukti milik suite pengujian ini.
DO $$
DECLARE
    v_pkg_id UUID := 'c0000000-0000-0000-0000-000000000001';
    v_jamaah_id UUID := 'c0000000-0000-0000-0000-000000000002';
    v_term_id UUID := 'c0000000-0000-0000-0000-000000000003';
    v_is_test_data BOOLEAN := false;
BEGIN
    -- Verifikasi identitas data dummy pengujian sebelum menghapus
    SELECT (
        p.name = 'Paket Uji Konkurensi Alt' AND
        j.address = 'Jl. Konkurensi No. 12' AND
        t.title = 'Termin Uji Konkurensi Alt'
    ) INTO v_is_test_data
    FROM public.packages p
    JOIN public.jamaah j ON j.package_id = p.id
    JOIN public.installment_terms t ON t.jamaah_id = j.id
    WHERE p.id = v_pkg_id AND j.id = v_jamaah_id AND t.id = v_term_id;

    IF v_is_test_data IS NOT TRUE THEN
        -- Periksa apakah data memang sudah bersih
        IF NOT EXISTS (SELECT 1 FROM public.packages WHERE id = v_pkg_id) AND
           NOT EXISTS (SELECT 1 FROM public.jamaah WHERE id = v_jamaah_id) THEN
            RAISE NOTICE '[OK] Database sudah dalam kondisi bersih. Tidak ada data uji yang perlu dihapus.';
            RETURN;
        ELSE
            RAISE EXCEPTION 'PEMBERSIHAN DIBATALKAN: Data dengan UUID pengujian ditemukan tetapi atributnya tidak sesuai dengan penanda dummy uji. Pembersihan dihentikan demi menjaga keamanan data.';
        END IF;
    END IF;

    -- Hapus pembayaran pengujian (hanya 2 UUID pembayaran uji)
    DELETE FROM public.payments WHERE id IN (
        'c0000000-0000-0000-0000-000000000004',
        'c0000000-0000-0000-0000-000000000005'
    );

    -- Hapus termin pengujian
    DELETE FROM public.installment_terms WHERE id = v_term_id;

    -- Hapus jamaah pengujian
    DELETE FROM public.jamaah WHERE id = v_jamaah_id;

    -- Hapus paket pengujian
    DELETE FROM public.packages WHERE id = v_pkg_id;

    RAISE NOTICE '[OK] Pembersihan berhasil: Seluruh data uji konkurensi telah dihapus secara aman.';
END $$;

-- Verifikasi Akhir Pembersihan (Harus Menghasilkan Angka 0 Semua)
SELECT
    (SELECT count(*) FROM public.payments WHERE id IN ('c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000005')) AS sisa_payments,
    (SELECT count(*) FROM public.installment_terms WHERE id = 'c0000000-0000-0000-0000-000000000003') AS sisa_terms,
    (SELECT count(*) FROM public.jamaah WHERE id = 'c0000000-0000-0000-0000-000000000002') AS sisa_jamaah,
    (SELECT count(*) FROM public.packages WHERE id = 'c0000000-0000-0000-0000-000000000001') AS sisa_packages;
