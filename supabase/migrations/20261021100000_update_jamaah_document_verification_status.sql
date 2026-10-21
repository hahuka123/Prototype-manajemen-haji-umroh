-- ========================================================
-- MIGRASI: Penyesuaian Status Verifikasi Dokumen & Enum Jamaah
-- File: supabase/migrations/20261021100000_update_jamaah_document_verification_status.sql
-- ========================================================
-- Tujuan:
-- 1. Menambahkan nilai enum 'Dokumen Terverifikasi' dan 'Perlu Perbaikan'
--    pada tipe jamaah_status di PostgreSQL.
-- 2. Memperbarui view v_jamaah_billing_summary agar menghitung rincian
--    status berkas (lengkap, menunggu verifikasi, ditolak) dan menyediakan
--    kolom kalkulasi status verifikasi dokumen secara real-time.
--
-- Petunjuk Eksekusi di Supabase:
-- 1. Buka Dashboard Supabase project Anda (https://supabase.com/dashboard).
-- 2. Pilih menu "SQL Editor" pada sidebar sebelah kiri.
-- 3. Tempel seluruh skrip SQL di bawah ini, lalu klik tombol "Run".
-- ========================================================

-- 1. Tambahkan nilai enum baru ke tipe jamaah_status jika belum ada
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'jamaah_status' AND e.enumlabel = 'Dokumen Terverifikasi'
    ) THEN
        ALTER TYPE public.jamaah_status ADD VALUE 'Dokumen Terverifikasi';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'jamaah_status' AND e.enumlabel = 'Perlu Perbaikan'
    ) THEN
        ALTER TYPE public.jamaah_status ADD VALUE 'Perlu Perbaikan';
    END IF;
END $$;

-- 2. Perbarui View v_jamaah_billing_summary
CREATE OR REPLACE VIEW public.v_jamaah_billing_summary AS
WITH payment_summary AS (
    SELECT
        jamaah_id,
        COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0) AS total_terbayar,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS pending_verifikasi
    FROM public.payments
    GROUP BY jamaah_id
),
document_summary AS (
    SELECT
        jamaah_id,
        COUNT(*) FILTER (WHERE status = 'Lengkap') AS dokumen_lengkap,
        COUNT(*) FILTER (WHERE status = 'Menunggu Verifikasi') AS dokumen_menunggu,
        COUNT(*) FILTER (WHERE status = 'Ditolak') AS dokumen_ditolak
    FROM public.documents
    GROUP BY jamaah_id
)
SELECT 
    j.id AS jamaah_id,
    j.profile_id,
    p.full_name,
    j.nik,
    j.phone,
    pkg.id AS package_id,
    pkg.name AS package_name,
    COALESCE(pkg.price, 0) AS package_price,
    COALESCE(ps.total_terbayar, 0) AS total_terbayar,
    COALESCE(ps.pending_verifikasi, 0) AS pending_verifikasi,
    GREATEST(0, COALESCE(pkg.price, 0) - COALESCE(ps.total_terbayar, 0)) AS sisa_tagihan,
    CASE 
        WHEN COALESCE(ps.total_terbayar, 0) = 0 THEN 'Belum Bayar'
        WHEN COALESCE(ps.total_terbayar, 0) >= COALESCE(pkg.price, 0) THEN 'Lunas'
        ELSE 'Cicilan'
    END AS status_pelunasan,
    LEAST(
        100,
        ROUND(COALESCE(ds.dokumen_lengkap, 0)::numeric / 6.0 * 100)
    ) AS persentase_dokumen,
    COALESCE(ds.dokumen_lengkap, 0) AS dokumen_lengkap,
    COALESCE(ds.dokumen_menunggu, 0) AS dokumen_menunggu,
    COALESCE(ds.dokumen_ditolak, 0) AS dokumen_ditolak,
    j.status AS status_jamaah,
    CASE 
        WHEN COALESCE(ds.dokumen_ditolak, 0) > 0 THEN 'Perlu Perbaikan'
        WHEN COALESCE(ds.dokumen_lengkap, 0) >= 6 THEN 'Dokumen Terverifikasi'
        WHEN COALESCE(ds.dokumen_menunggu, 0) > 0 OR COALESCE(ds.dokumen_lengkap, 0) > 0 THEN 'Dokumen Diproses'
        ELSE 'Pendaftaran'
    END AS status_dokumen
FROM public.jamaah j
LEFT JOIN public.profiles p ON j.profile_id = p.id
LEFT JOIN public.packages pkg ON j.package_id = pkg.id
LEFT JOIN payment_summary ps ON j.id = ps.jamaah_id
LEFT JOIN document_summary ds ON j.id = ds.jamaah_id;

-- Berikan izin SELECT ke role authenticated dan anon
GRANT SELECT ON public.v_jamaah_billing_summary TO authenticated, anon;

-- Komentar dokumentasi view
COMMENT ON VIEW public.v_jamaah_billing_summary IS 'Rekapitulasi tagihan finansial, progres, serta status verifikasi dokumen jamaah real-time.';
