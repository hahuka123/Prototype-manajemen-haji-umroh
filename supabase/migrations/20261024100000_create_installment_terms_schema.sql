-- ========================================================
-- MIGRASI: Model Data Termin Cicilan & Integrasi Pembayaran
-- File: supabase/migrations/20261024100000_create_installment_terms_schema.sql
-- ========================================================
-- Tujuan:
-- 1. Membuat tabel public.installment_terms untuk menyimpan jadwal termin cicilan
--    dengan tanggal jatuh tempo, nominal target, dan nomor urut termin per jamaah.
-- 2. Menambahkan relasi foreign key nullable installment_term_id pada public.payments
--    sehingga transaksi pembayaran lama (legacy) tetap valid tanpa auto-alokasi.
-- 3. Membuat view public.v_installment_terms_summary dengan security_invoker = true
--    untuk menghitung realisasi pembayaran terverifikasi, pending, sisa kewajiban,
--    dan status dinamis (paid, pending, overdue, unpaid) berbasis waktu Jakarta (WIB).
-- 4. Menerapkan Row Level Security (RLS) ketat: Admin CRUD penuh, Jamaah read-only
--    pada termin miliknya sendiri, dan tanpa hak INSERT/UPDATE/DELETE bagi jamaah.
--
-- Petunjuk Eksekusi di Supabase SQL Editor (HANYA jika disetujui untuk deploy):
-- 1. Buka Dashboard Supabase project Anda (https://supabase.com/dashboard).
-- 2. Pilih menu "SQL Editor" pada sidebar sebelah kiri.
-- 3. Tempel seluruh skrip SQL di bawah ini, lalu klik tombol "Run".
-- ========================================================

-- 1. Tabel installment_terms
CREATE TABLE IF NOT EXISTS public.installment_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jamaah_id UUID NOT NULL REFERENCES public.jamaah(id) ON DELETE CASCADE,
    term_number INT NOT NULL CHECK (term_number > 0),
    title VARCHAR(100) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    due_date DATE NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_jamaah_term_number UNIQUE (jamaah_id, term_number)
);

-- Indeks performa untuk query termin
CREATE INDEX IF NOT EXISTS idx_installment_terms_jamaah_id 
ON public.installment_terms(jamaah_id);

CREATE INDEX IF NOT EXISTS idx_installment_terms_due_date 
ON public.installment_terms(due_date);

-- Trigger otomatis kolom updated_at pada installment_terms
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_installment_terms_updated_at'
    ) THEN
        CREATE TRIGGER trg_installment_terms_updated_at 
        BEFORE UPDATE ON public.installment_terms 
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- 2. Tambahkan kolom nullable installment_term_id pada public.payments
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS installment_term_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_installment_term'
    ) THEN
        ALTER TABLE public.payments
        ADD CONSTRAINT fk_payments_installment_term
        FOREIGN KEY (installment_term_id) 
        REFERENCES public.installment_terms(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_installment_term_id 
ON public.payments(installment_term_id);

-- 3. Database View: v_installment_terms_summary
-- Menggunakan security_invoker = true agar view mengevaluasi RLS tabel dasar
-- sesuai konteks pengguna yang memanggil (jamaah vs admin)
CREATE OR REPLACE VIEW public.v_installment_terms_summary
WITH (security_invoker = true)
AS
WITH term_payment_stats AS (
    SELECT
        installment_term_id,
        COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0) AS total_verified,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS total_pending
    FROM public.payments
    WHERE installment_term_id IS NOT NULL
    GROUP BY installment_term_id
)
SELECT 
    t.id AS term_id,
    t.id,
    t.jamaah_id,
    t.term_number,
    t.title,
    t.amount AS target_amount,
    t.amount,
    t.due_date,
    t.notes,
    t.created_by,
    t.created_at,
    t.updated_at,
    COALESCE(s.total_verified, 0) AS verified_amount,
    COALESCE(s.total_pending, 0) AS pending_amount,
    GREATEST(0, t.amount - COALESCE(s.total_verified, 0)) AS remaining_amount,
    CASE 
        -- Status 1: Lunas jika pembayaran terverifikasi telah mencapai / melebihi target
        WHEN COALESCE(s.total_verified, 0) >= t.amount THEN 'paid'
        
        -- Status 2: Menunggu Verifikasi jika masih ada sisa kewajiban dan terdapat pembayaran berstatus pending
        WHEN COALESCE(s.total_verified, 0) < t.amount AND COALESCE(s.total_pending, 0) > 0 THEN 'pending'
        
        -- Status 3: Terlambat jika belum lunas, tidak ada pending, dan tanggal hari ini (WIB) melampaui due_date
        WHEN COALESCE(s.total_verified, 0) < t.amount 
             AND (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::DATE > t.due_date THEN 'overdue'
        
        -- Status 4: Belum Lunas / Berjalan (unpaid)
        ELSE 'unpaid'
    END AS status
FROM public.installment_terms t
LEFT JOIN term_payment_stats s ON t.id = s.installment_term_id;

-- 4. Konfigurasi Row Level Security (RLS)
ALTER TABLE public.installment_terms ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada untuk idempotensi migrasi
DROP POLICY IF EXISTS "Admin dapat mengelola seluruh termin cicilan" ON public.installment_terms;
DROP POLICY IF EXISTS "Jamaah dapat melihat termin cicilan sendiri" ON public.installment_terms;

-- Policy Admin: Admin biro perjalanan memiliki akses penuh (CRUD)
CREATE POLICY "Admin dapat mengelola seluruh termin cicilan"
ON public.installment_terms FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Policy Jamaah: Jamaah HANYA memiliki izin SELECT data miliknya sendiri
CREATE POLICY "Jamaah dapat melihat termin cicilan sendiri"
ON public.installment_terms FOR SELECT
USING (
    jamaah_id IN (
        SELECT id FROM public.jamaah WHERE profile_id = auth.uid()
    )
);

-- Izin SELECT pada view dan tabel dasar
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installment_terms TO authenticated;
GRANT SELECT ON public.v_installment_terms_summary TO authenticated, anon;

-- Komentar dokumentasi
COMMENT ON TABLE public.installment_terms IS 'Jadwal dan target termin cicilan pembayaran paket per jamaah.';
COMMENT ON COLUMN public.payments.installment_term_id IS 'Referensi ke termin cicilan spesifik yang dibayar (opsional/nullable untuk mendukung data lama).';
COMMENT ON VIEW public.v_installment_terms_summary IS 'Ringkasan finansial dan status termin dinamis real-time (security invoker).';
