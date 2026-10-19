-- ========================================================
-- MIGRASI: Penambahan Kolom Kuota Jamaah pada Tabel packages
-- File: supabase/migrations/20261019_add_quota_to_packages.sql
-- ========================================================
-- Petunjuk Eksekusi:
-- 1. Buka Dashboard Supabase project Anda (https://supabase.com/dashboard)
-- 2. Pilih menu "SQL Editor" pada sidebar sebelah kiri
-- 3. Tempel seluruh skrip SQL di bawah ini, lalu klik tombol "Run"
-- ========================================================

-- 1. Tambahkan kolom quota bertipe INTEGER pada tabel public.packages (jika belum ada)
ALTER TABLE public.packages 
ADD COLUMN IF NOT EXISTS quota INT;

-- 2. Tambahkan constraint pengecekan agar nilai kuota wajib bilangan bulat positif (>= 1) jika diisi
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_packages_quota_positive'
    ) THEN
        ALTER TABLE public.packages 
        ADD CONSTRAINT chk_packages_quota_positive 
        CHECK (quota IS NULL OR quota > 0);
    END IF;
END $$;

-- 3. Berikan komentar deskriptif pada kolom quota untuk dokumentasi schema
COMMENT ON COLUMN public.packages.quota IS 'Jumlah kuota kapasitas maksimal jamaah untuk paket perjalanan (minimal 1).';

-- ========================================================
-- PENANGANAN DATA LAMA:
-- 1. Paket lama yang sudah ada di database akan memiliki nilai quota NULL.
-- 2. Sistem TIDAK mengisi nilai sembarangan / dummy pada data lama agar tidak dianggap
--    sebagai kuota yang telah terverifikasi resmi oleh manajemen biro perjalanan.
-- 3. Admin dapat membuka menu Admin -> Paket Perjalanan, memilih tombol "Ubah" pada paket lama,
--    lalu memasukkan kuota riil yang valid.
-- ========================================================
