-- ========================================================
-- MIGRASI: Fungsi Agregasi Kuota & Pendaftar Paket (RLS-Safe)
-- File: supabase/migrations/20261019_add_package_quota_stats_function.sql
-- ========================================================
-- Tujuan:
-- Mengizinkan akun Jamaah (non-admin) untuk melihat jumlah total jamaah
-- yang sudah terdaftar pada setiap paket perjalanan tanpa melanggar RLS
-- dan tanpa membocorkan data pribadi (NIK, paspor, nomor telepon, dsb).
--
-- Petunjuk Eksekusi di Supabase:
-- 1. Buka Dashboard Supabase project Anda (https://supabase.com/dashboard)
-- 2. Pilih menu "SQL Editor" pada sidebar sebelah kiri
-- 3. Tempel seluruh skrip SQL di bawah ini, lalu klik tombol "Run"
-- ========================================================

-- 1. Fungsi untuk mengambil jumlah pendaftar seluruh paket secara agregat
CREATE OR REPLACE FUNCTION public.get_packages_registered_counts()
RETURNS TABLE (
    package_id UUID,
    registered_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        package_id, 
        COUNT(DISTINCT COALESCE(profile_id, id)) AS registered_count
    FROM public.jamaah
    WHERE package_id IS NOT NULL
    GROUP BY package_id;
$$;

-- Berikan izin akses eksekusi ke role authenticated dan anon
GRANT EXECUTE ON FUNCTION public.get_packages_registered_counts() TO authenticated, anon;

-- 2. Fungsi untuk mengambil jumlah pendaftar untuk satu paket spesifik
CREATE OR REPLACE FUNCTION public.get_package_registered_count(target_package_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total INT;
BEGIN
    SELECT COUNT(DISTINCT COALESCE(profile_id, id)) INTO total
    FROM public.jamaah
    WHERE package_id = target_package_id;
    
    RETURN COALESCE(total, 0);
END;
$$;

-- Berikan izin akses eksekusi ke role authenticated dan anon
GRANT EXECUTE ON FUNCTION public.get_package_registered_count(UUID) TO authenticated, anon;

-- Komentar dokumentasi
COMMENT ON FUNCTION public.get_packages_registered_counts IS 'Mengembalikan rekap kuota terisi per paket perjalanan secara aman tanpa mengekspos baris data pribadi jamaah.';
COMMENT ON FUNCTION public.get_package_registered_count IS 'Mengembalikan jumlah jamaah terdaftar pada satu paket perjalanan spesifik secara aman.';
