-- ============================================================================
-- PANDUAN PENGUJIAN KONKURENSI (SKENARIO 12) - DUA KONEKSI POSTGRESQL PARALEL
-- File: supabase/test_staging_concurrency.sql
-- Sasaran: Pembuktian 'SELECT ... FOR UPDATE' mencegah Race Condition & Over-Allocation
-- ============================================================================
-- UUID Khusus Pengujian Konkurensi (Eksplisit & Deterministik):
-- - Paket Uji:   'c0000000-0000-0000-0000-000000000001'
-- - Jamaah Uji:  'c0000000-0000-0000-0000-000000000002' (NIK: Dinamis 16 digit angka numerik)
-- - Termin Uji:  'c0000000-0000-0000-0000-000000000003' (Target Rp 1.000.000)
-- - Transaksi A: 'c0000000-0000-0000-0000-000000000004' (Rp 700.000, transfer pending)
-- - Transaksi B: 'c0000000-0000-0000-0000-000000000005' (Rp 600.000, transfer pending)
-- ============================================================================
-- Prasyarat:
-- Buka dua tab terpisah di Supabase Dashboard (SQL Editor -> Tab 1 dan Tab 2)
-- atau dua sesi terminal psql.
-- ============================================================================


-- ============================================================================
-- LANGKAH 1: PERSIAPAN DATA UJI DENGAN PROTEKSI BENTURAN (Jalankan di Tab 1)
-- ============================================================================
-- PENTING: Script TIDAK melakukan DELETE data secara langsung.
-- Script memeriksa apakah seluruh UUID pengujian belum digunakan.
-- NIK dibuat secara dinamis (tepat 16 digit angka 0–9) sehingga tidak
-- akan bertabrakan dengan data jamaah yang sudah ada di database staging.
-- Jika ditemukan benturan UUID, script langsung berhenti tanpa mengubah data.
DO $$
DECLARE
    v_pkg_id UUID := 'c0000000-0000-0000-0000-000000000001';
    v_jamaah_id UUID := 'c0000000-0000-0000-0000-000000000002';
    v_term_id UUID := 'c0000000-0000-0000-0000-000000000003';
    v_pay_a_id UUID := 'c0000000-0000-0000-0000-000000000004';
    v_pay_b_id UUID := 'c0000000-0000-0000-0000-000000000005';
    v_dynamic_nik VARCHAR(20);
BEGIN
    -- 1. Validasi Keamanan (Collision Guard): Pastikan seluruh UUID pengujian belum digunakan di database
    IF EXISTS (SELECT 1 FROM public.packages WHERE id = v_pkg_id) OR
       EXISTS (SELECT 1 FROM public.jamaah WHERE id = v_jamaah_id) OR
       EXISTS (SELECT 1 FROM public.installment_terms WHERE id = v_term_id) OR
       EXISTS (SELECT 1 FROM public.payments WHERE id IN (v_pay_a_id, v_pay_b_id)) THEN
        RAISE EXCEPTION 'PENGUJIAN DIBATALKAN: Terdeteksi data dengan UUID pengujian di database. Jika ini sisa dari pengujian sebelumnya, jalankan LANGKAH 5 (Cleanup) terlebih dahulu.';
    END IF;

    -- 2. Buat NIK dinamis numerik murni (tepat 16 digit angka 0–9, memenuhi constraint VARCHAR(20))
    v_dynamic_nik := '9' || pg_catalog.lpad((pg_catalog.floor(pg_catalog.random() * 1000000000000000)::bigint)::text, 15, '0');

    -- Pastikan NIK dinamis benar-benar belum terdaftar di database staging
    WHILE EXISTS (SELECT 1 FROM public.jamaah WHERE nik = v_dynamic_nik) LOOP
        v_dynamic_nik := '9' || pg_catalog.lpad((pg_catalog.floor(pg_catalog.random() * 1000000000000000)::bigint)::text, 15, '0');
    END LOOP;

    -- 3. Buat Paket Uji
    INSERT INTO public.packages (id, name, type, price, departure_date, return_date, duration, quota)
    VALUES (v_pkg_id, 'Paket Uji Konkurensi', 'Umrah Reguler', 30000000, CURRENT_DATE + 30, CURRENT_DATE + 42, 12, 50);

    -- 4. Buat Jamaah Uji (profile_id = NULL)
    INSERT INTO public.jamaah (id, profile_id, nik, birth_date, gender, address, phone, package_id, status)
    VALUES (v_jamaah_id, NULL, v_dynamic_nik, '1995-05-05', 'Laki-laki', 'Jl. Konkurensi No. 12', '081299990001', v_pkg_id, 'Pendaftaran');

    -- 5. Buat Termin Uji (Target Rp 1.000.000)
    INSERT INTO public.installment_terms (id, jamaah_id, term_number, title, amount, due_date)
    VALUES (v_term_id, v_jamaah_id, 1, 'Termin Uji Konkurensi', 1000000, CURRENT_DATE + 14);

    RAISE NOTICE '[OK] Data dummy pengujian konkurensi aman disiapkan dengan NIK dinamis (%).', v_dynamic_nik;
END $$;


-- ============================================================================
-- LANGKAH 2: EKSEKUSI TRANSAKSI SESI A (Jalankan di Tab 1)
-- ============================================================================
-- Buka transaksi eksplisit dan ajukan transfer pending Rp 700.000:
BEGIN;

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

-- JANGAN COMMIT DAHULU!
-- Status saat ini:
-- 1. Sesi A mengunci baris termin 'c0000000-0000-0000-0000-000000000003' via SELECT ... FOR UPDATE.
-- 2. Transaksi A belum di-commit, row-lock masih aktif.


-- ============================================================================
-- LANGKAH 3: EKSEKUSI TRANSAKSI SESI B SECARA BERSAMAAN (Jalankan di Tab 2)
-- ============================================================================
-- Di Tab 2, buka transaksi dan ajukan transfer pending Rp 600.000 untuk termin yang sama:
BEGIN;

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

-- PERILAKU YANG TERJADI DI TAB 2 (SESI B):
-- Kueri akan "WAITING / RUNNING..." (tertahan mengantre kunci).
-- Hal ini membuktikan SELECT ... FOR UPDATE sedang menahan Sesi B agar tidak terjadi race condition.


-- ============================================================================
-- LANGKAH 4: SELESAIKAN TRANSAKSI SESI A (Jalankan di Tab 1)
-- ============================================================================
-- Kembali ke Tab 1 (Sesi A), lalu commit:
COMMIT;


-- ============================================================================
-- HASIL YANG TERJADI PADA TAB 2 (SESI B):
-- ============================================================================
-- Begitu Sesi A melakukan COMMIT:
-- 1. Kunci baris termin dilepaskan.
-- 2. Sesi B otomatis terbangun (unblock) dan membaca komitmen baru (Rp 700.000).
-- 3. Sesi B mengevaluasi: total komitmen menjadi Rp 700.000 + Rp 600.000 = Rp 1.300.000 (> Rp 1.000.000 target).
-- 4. Trigger di Sesi B MELEMPAR EXCEPTION:
--    "ERROR: Pengajuan pembayaran melebihi target termin. Sisa kuota yang tersedia: Rp 300,000."
-- 5. Di Tab 2, jalankan ROLLBACK untuk menutup sesi:
ROLLBACK;


-- ============================================================================
-- LANGKAH 5: PEMBERSIHAN DATA PENGUJIAN / CLEANUP (Jalankan di Tab 1)
-- ============================================================================
-- Hapus HANYA 4 record pengujian yang dibuat pada pengujian ini.
-- Script TIDAK menyentuh data jamaah, paket, atau pembayaran lain.
DELETE FROM public.payments WHERE id IN ('c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000005');
DELETE FROM public.installment_terms WHERE id = 'c0000000-0000-0000-0000-000000000003';
DELETE FROM public.jamaah WHERE id = 'c0000000-0000-0000-0000-000000000002';
DELETE FROM public.packages WHERE id = 'c0000000-0000-0000-0000-000000000001';

-- KESIMPULAN KONKURENSI:
-- Integritas data terbukti aman: Sesi A berhasil, Sesi B ditolak karena kuota tidak mencukupi,
-- dan tidak terjadi over-allocation secara simultan.
