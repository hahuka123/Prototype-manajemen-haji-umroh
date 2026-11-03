-- ============================================================================
-- PANDUAN PENGUJIAN KONKURENSI (SKENARIO 12) - DUA KONEKSI POSTGRESQL PARALEL
-- File: supabase/test_staging_concurrency.sql
-- Sasaran: Pembuktian 'SELECT ... FOR UPDATE' mencegah Race Condition & Over-Allocation
-- ============================================================================
-- UUID Khusus Pengujian Konkurensi (Eksplisit & Deterministik):
-- - Paket Uji:   'c0000000-0000-0000-0000-000000000001'
-- - Jamaah Uji:  'c0000000-0000-0000-0000-000000000002'
-- - Termin Uji:  'c0000000-0000-0000-0000-000000000003' (Target Rp 1.000.000)
-- - Transaksi A: 'c0000000-0000-0000-0000-000000000004' (Rp 700.000, transfer pending)
-- - Transaksi B: 'c0000000-0000-0000-0000-000000000005' (Rp 600.000, transfer pending)
-- ============================================================================
-- Prasyarat:
-- Buka dua tab terpisah di Supabase Dashboard (SQL Editor -> Tab 1 dan Tab 2)
-- atau dua sesi terminal psql.
-- ============================================================================


-- ============================================================================
-- LANGKAH 1: PERSIAPAN DATA UJI (Jalankan sekali di Tab 1 / Sesi A)
-- ============================================================================
-- Bersihkan data lama jika ada, lalu siapkan paket, jamaah, dan termin uji:
DELETE FROM public.payments WHERE id IN ('c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000005');
DELETE FROM public.installment_terms WHERE id = 'c0000000-0000-0000-0000-000000000003';
DELETE FROM public.jamaah WHERE id = 'c0000000-0000-0000-0000-000000000002';
DELETE FROM public.packages WHERE id = 'c0000000-0000-0000-0000-000000000001';

INSERT INTO public.packages (id, name, type, price, departure_date, return_date, duration, quota)
VALUES ('c0000000-0000-0000-0000-000000000001', 'Paket Uji Konkurensi', 'Umrah Reguler', 30000000, CURRENT_DATE + 30, CURRENT_DATE + 42, 12, 50);

INSERT INTO public.jamaah (id, profile_id, nik, birth_date, gender, address, phone, package_id, status)
VALUES ('c0000000-0000-0000-0000-000000000002', NULL, '3171999999990001', '1995-05-05', 'Laki-laki', 'Jl. Konkurensi No. 12', '081299990001', 'c0000000-0000-0000-0000-000000000001', 'Pendaftaran');

INSERT INTO public.installment_terms (id, jamaah_id, term_number, title, amount, due_date)
VALUES ('c0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 1, 'Termin Uji Konkurensi', 1000000, CURRENT_DATE + 14);


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
-- Hapus data dummy pengujian berdasarkan ID eksplisit agar staging kembali bersih:
DELETE FROM public.payments WHERE id IN ('c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000005');
DELETE FROM public.installment_terms WHERE id = 'c0000000-0000-0000-0000-000000000003';
DELETE FROM public.jamaah WHERE id = 'c0000000-0000-0000-0000-000000000002';
DELETE FROM public.packages WHERE id = 'c0000000-0000-0000-0000-000000000001';

-- KESIMPULAN KONKURENSI:
-- Integritas data terbukti aman: Sesi A berhasil, Sesi B ditolak karena kuota tidak mencukupi,
-- dan tidak terjadi over-allocation secara simultan.
