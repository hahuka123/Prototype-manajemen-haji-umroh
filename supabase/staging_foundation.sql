-- ========================================================
-- SKRIP FONDASI LENGKAP DATABASE STAGING (SUPER CLEAN & RLS-SAFE)
-- File: supabase/staging_foundation.sql
-- Proyek: Prototype Manajemen Haji & Umrah
-- Target: Project Supabase Staging Baru (Kosong)
-- ========================================================
-- Petunjuk Eksekusi:
-- 1. Buka Supabase Dashboard proyek STAGING Anda.
-- 2. Pastikan Anda berada di proyek STAGING (bukan proyek produksi!).
-- 3. Buka menu "SQL Editor" -> klik "New Query".
-- 4. Tempel seluruh skrip ini, lalu klik tombol "Run".
-- ========================================================

-- ========================================================
-- 1. EXTENSIONS & CUSTOM ENUM TYPES
-- ========================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Role Pengguna
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'jamaah');
    END IF;
END $$;

-- Status Siklus Jamaah (Lengkap dengan 8 status resmi aplikasi)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'jamaah_status') THEN
        CREATE TYPE jamaah_status AS ENUM (
            'Pendaftaran',
            'Dokumen Diproses',
            'Perlu Perbaikan',
            'Dokumen Terverifikasi',
            'Belum Lunas',
            'Siap Berangkat',
            'Sudah Berangkat',
            'Selesai'
        );
    END IF;
END $$;

-- Tipe Dokumen Pendukung
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
        CREATE TYPE document_type AS ENUM (
            'ktp',
            'kk',
            'passport',
            'foto',
            'buku-nikah',
            'kesehatan'
        );
    END IF;
END $$;

-- Status Verifikasi Dokumen
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
        CREATE TYPE document_status AS ENUM (
            'Belum Ada',
            'Menunggu Verifikasi',
            'Lengkap',
            'Ditolak'
        );
    END IF;
END $$;

-- Jenis Pembayaran Tagihan
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type') THEN
        CREATE TYPE payment_type AS ENUM ('full', 'installment');
    END IF;
END $$;

-- Metode Pembayaran
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM ('transfer', 'cash');
    END IF;
END $$;

-- Status Verifikasi Pembayaran
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending', 'verified', 'rejected');
    END IF;
END $$;


-- ========================================================
-- 2. TABEL FONDASI DASAR
-- ========================================================

-- 2.1 TABEL PROFILES (Ekstensi auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    role user_role NOT NULL DEFAULT 'jamaah',
    phone VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 TABEL PACKAGES (Paket Perjalanan Haji & Umroh)
CREATE TABLE IF NOT EXISTS public.packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'Umrah Reguler',
    price NUMERIC(15, 2) NOT NULL CHECK (price >= 0),
    departure_date DATE NOT NULL,
    return_date DATE NOT NULL,
    duration INT NOT NULL CHECK (duration > 0),
    quota INT CHECK (quota IS NULL OR quota > 0),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3 TABEL JAMAAH (Data Administratif Jamaah)
CREATE TABLE IF NOT EXISTS public.jamaah (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
    nik VARCHAR(20) NOT NULL UNIQUE,
    passport_number VARCHAR(25),
    birth_date DATE NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('Laki-laki', 'Perempuan')),
    address TEXT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
    status jamaah_status NOT NULL DEFAULT 'Pendaftaran',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.4 TABEL DOCUMENTS (Berkas Lampiran Jamaah)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jamaah_id UUID NOT NULL REFERENCES public.jamaah(id) ON DELETE CASCADE,
    document_type document_type NOT NULL,
    file_path TEXT,
    status document_status NOT NULL DEFAULT 'Belum Ada',
    notes TEXT,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_jamaah_doc_type UNIQUE (jamaah_id, document_type)
);

-- 2.5 TABEL PAYMENTS (Transaksi Pembayaran Tagihan)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jamaah_id UUID NOT NULL REFERENCES public.jamaah(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    payment_type payment_type NOT NULL,
    payment_method payment_method NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    bank_name VARCHAR(50),
    reference_number VARCHAR(100),
    proof_file_path TEXT,
    status payment_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    admin_notes TEXT,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.6 TABEL SCHEDULES (Jadwal & Agenda Perjalanan)
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time TIME NOT NULL,
    activity VARCHAR(150) NOT NULL,
    location VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ========================================================
-- 3. TRIGGER UPDATE TIMESTAMP OTOMATIS
-- ========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
    CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_packages_updated_at ON public.packages;
    CREATE TRIGGER trg_packages_updated_at BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_jamaah_updated_at ON public.jamaah;
    CREATE TRIGGER trg_jamaah_updated_at BEFORE UPDATE ON public.jamaah FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_documents_updated_at ON public.documents;
    CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
    CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_schedules_updated_at ON public.schedules;
    CREATE TRIGGER trg_schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
END $$;


-- ========================================================
-- 4. TRIGGER SINKRONISASI USER SIGNUP (auth.users -> profiles)
-- ========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Keamanan Ketat: Seluruh akun baru yang mendaftar via alur publik SELALU ber-role 'jamaah'.
    -- Metadata role dari client DIABAIKAN untuk mencegah ekskalasi hak akses tidak sah menjadi admin.
    -- Pemberian role 'admin' hanya boleh dilakukan langsung oleh administrator sistem
    -- melalui Supabase Dashboard / SQL Editor terverifikasi.
    INSERT INTO public.profiles (id, full_name, role, phone)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'User Baru'),
        'jamaah'::public.user_role,
        NEW.raw_user_meta_data->>'phone'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ========================================================
-- 5. HELPER FUNCTION: is_admin() (SECURITY DEFINER & SEARCH_PATH AMAN)
-- ========================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;


-- ========================================================
-- 6. RPC HELPER: STATISTIK KUOTA PAKET
-- ========================================================
CREATE OR REPLACE FUNCTION public.get_packages_registered_counts()
RETURNS TABLE (
    package_id UUID,
    registered_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT 
        package_id, 
        COUNT(DISTINCT COALESCE(profile_id, id)) AS registered_count
    FROM public.jamaah
    WHERE package_id IS NOT NULL
    GROUP BY package_id;
$$;

REVOKE ALL ON FUNCTION public.get_packages_registered_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_packages_registered_counts() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_package_registered_count(target_package_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

REVOKE ALL ON FUNCTION public.get_package_registered_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_package_registered_count(UUID) TO authenticated;


-- ========================================================
-- 7. DATABASE VIEW: v_jamaah_billing_summary (SECURITY INVOKER)
-- ========================================================
-- Menggunakan security_invoker = true agar kueri jamaah dibatasi oleh RLS tabel dasar,
-- dan hak SELECT hanya diberikan kepada authenticated (TIDAK diberikan ke anon).
CREATE OR REPLACE VIEW public.v_jamaah_billing_summary
WITH (security_invoker = true)
AS
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

-- Keamanan Hak Akses View: Hanya untuk pengguna terotentikasi (Cabut dari publik/anon)
REVOKE ALL ON public.v_jamaah_billing_summary FROM PUBLIC;
REVOKE ALL ON public.v_jamaah_billing_summary FROM anon;
GRANT SELECT ON public.v_jamaah_billing_summary TO authenticated;


-- ========================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jamaah ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- 8.1 PROFILES POLICIES
DROP POLICY IF EXISTS "Admin dapat mengelola semua profil" ON public.profiles;
CREATE POLICY "Admin dapat mengelola semua profil"
ON public.profiles FOR ALL
USING (public.is_admin());

DROP POLICY IF EXISTS "Pengguna dapat membaca profil sendiri" ON public.profiles;
CREATE POLICY "Pengguna dapat membaca profil sendiri"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Pengguna dapat mengupdate profil sendiri" ON public.profiles;
CREATE POLICY "Pengguna dapat mengupdate profil sendiri"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- 8.2 PACKAGES POLICIES
DROP POLICY IF EXISTS "Semua user terotentikasi dapat melihat paket" ON public.packages;
CREATE POLICY "Semua user terotentikasi dapat melihat paket"
ON public.packages FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Hanya Admin yang dapat CRUD paket" ON public.packages;
CREATE POLICY "Hanya Admin yang dapat CRUD paket"
ON public.packages FOR ALL
USING (public.is_admin());

-- 8.3 SCHEDULES POLICIES
DROP POLICY IF EXISTS "Semua user terotentikasi dapat melihat jadwal" ON public.schedules;
CREATE POLICY "Semua user terotentikasi dapat melihat jadwal"
ON public.schedules FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Hanya Admin yang dapat CRUD jadwal" ON public.schedules;
CREATE POLICY "Hanya Admin yang dapat CRUD jadwal"
ON public.schedules FOR ALL
USING (public.is_admin());

-- 8.4 JAMAAH POLICIES
DROP POLICY IF EXISTS "Admin dapat mengelola seluruh data jamaah" ON public.jamaah;
CREATE POLICY "Admin dapat mengelola seluruh data jamaah"
ON public.jamaah FOR ALL
USING (public.is_admin());

DROP POLICY IF EXISTS "Jamaah dapat melihat data jamaahnya sendiri" ON public.jamaah;
CREATE POLICY "Jamaah dapat melihat data jamaahnya sendiri"
ON public.jamaah FOR SELECT
USING (profile_id = auth.uid());

-- 8.5 DOCUMENTS POLICIES
DROP POLICY IF EXISTS "Admin dapat mengelola seluruh berkas dokumen" ON public.documents;
CREATE POLICY "Admin dapat mengelola seluruh berkas dokumen"
ON public.documents FOR ALL
USING (public.is_admin());

DROP POLICY IF EXISTS "Jamaah dapat melihat dokumen miliknya sendiri" ON public.documents;
CREATE POLICY "Jamaah dapat melihat dokumen miliknya sendiri"
ON public.documents FOR SELECT
USING (
    jamaah_id IN (SELECT id FROM public.jamaah WHERE profile_id = auth.uid())
);

DROP POLICY IF EXISTS "Jamaah dapat mengunggah berkas dokumen sendiri" ON public.documents;
CREATE POLICY "Jamaah dapat mengunggah berkas dokumen sendiri"
ON public.documents FOR INSERT
WITH CHECK (
    jamaah_id IN (SELECT id FROM public.jamaah WHERE profile_id = auth.uid())
);

DROP POLICY IF EXISTS "Jamaah dapat memperbarui berkas dokumen sendiri" ON public.documents;
CREATE POLICY "Jamaah dapat memperbarui berkas dokumen sendiri"
ON public.documents FOR UPDATE
USING (
    jamaah_id IN (SELECT id FROM public.jamaah WHERE profile_id = auth.uid())
);

-- 8.6 PAYMENTS POLICIES
DROP POLICY IF EXISTS "Admin dapat melihat dan mengelola seluruh pembayaran" ON public.payments;
CREATE POLICY "Admin dapat melihat dan mengelola seluruh pembayaran"
ON public.payments FOR ALL
USING (public.is_admin());

DROP POLICY IF EXISTS "Jamaah dapat melihat riwayat pembayaran sendiri" ON public.payments;
CREATE POLICY "Jamaah dapat melihat riwayat pembayaran sendiri"
ON public.payments FOR SELECT
USING (
    jamaah_id IN (SELECT id FROM public.jamaah WHERE profile_id = auth.uid())
);

DROP POLICY IF EXISTS "Jamaah dapat mengajukan pembayaran transfer" ON public.payments;
CREATE POLICY "Jamaah dapat mengajukan pembayaran transfer"
ON public.payments FOR INSERT
WITH CHECK (
    jamaah_id IN (SELECT id FROM public.jamaah WHERE profile_id = auth.uid())
    AND payment_method = 'transfer'
    AND status = 'pending'
);

-- Hak Akses Tabel Dasar ke Role Authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jamaah TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;


-- ========================================================
-- 9. KONFIGURASI SUPABASE STORAGE (BUCKET PRIVAT & RLS)
-- ========================================================
-- Pembuatan bucket privat secara langsung melalui SQL (public = false)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('documents', 'documents', false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf']),
    ('payment-proofs', 'payment-proofs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET 
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage Policies untuk Bucket 'documents'
DROP POLICY IF EXISTS "Admin full akses storage documents" ON storage.objects;
CREATE POLICY "Admin full akses storage documents"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'documents' AND public.is_admin())
WITH CHECK (bucket_id = 'documents' AND public.is_admin());

DROP POLICY IF EXISTS "Jamaah dapat upload dokumen ke foldernya" ON storage.objects;
CREATE POLICY "Jamaah dapat upload dokumen ke foldernya"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'documents'
    AND (
        (split_part(name, '/', 1)) IN (
            SELECT id::text FROM public.jamaah WHERE profile_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Jamaah dapat membaca dokumen miliknya" ON storage.objects;
CREATE POLICY "Jamaah dapat membaca dokumen miliknya"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'documents'
    AND (
        (split_part(name, '/', 1)) IN (
            SELECT id::text FROM public.jamaah WHERE profile_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Jamaah dapat memperbarui dokumen miliknya" ON storage.objects;
CREATE POLICY "Jamaah dapat memperbarui dokumen miliknya"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'documents'
    AND (
        (split_part(name, '/', 1)) IN (
            SELECT id::text FROM public.jamaah WHERE profile_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Jamaah dapat menghapus dokumen miliknya" ON storage.objects;
CREATE POLICY "Jamaah dapat menghapus dokumen miliknya"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'documents'
    AND (
        (split_part(name, '/', 1)) IN (
            SELECT id::text FROM public.jamaah WHERE profile_id = auth.uid()
        )
    )
);

-- Storage Policies untuk Bucket 'payment-proofs'
DROP POLICY IF EXISTS "Admin full akses storage payment-proofs" ON storage.objects;
CREATE POLICY "Admin full akses storage payment-proofs"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'payment-proofs' AND public.is_admin())
WITH CHECK (bucket_id = 'payment-proofs' AND public.is_admin());

DROP POLICY IF EXISTS "Jamaah dapat upload bukti bayar ke foldernya" ON storage.objects;
CREATE POLICY "Jamaah dapat upload bukti bayar ke foldernya"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (
        (split_part(name, '/', 1)) IN (
            SELECT id::text FROM public.jamaah WHERE profile_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Jamaah dapat melihat bukti bayar miliknya" ON storage.objects;
CREATE POLICY "Jamaah dapat melihat bukti bayar miliknya"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'payment-proofs'
    AND (
        (split_part(name, '/', 1)) IN (
            SELECT id::text FROM public.jamaah WHERE profile_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Jamaah dapat memperbarui bukti bayar miliknya" ON storage.objects;
CREATE POLICY "Jamaah dapat memperbarui bukti bayar miliknya"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'payment-proofs'
    AND (
        (split_part(name, '/', 1)) IN (
            SELECT id::text FROM public.jamaah WHERE profile_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Jamaah dapat menghapus bukti bayar miliknya" ON storage.objects;
CREATE POLICY "Jamaah dapat menghapus bukti bayar miliknya"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'payment-proofs'
    AND (
        (split_part(name, '/', 1)) IN (
            SELECT id::text FROM public.jamaah WHERE profile_id = auth.uid()
        )
    )
);


-- ========================================================
-- 10. VERIFIKASI KEBERHASILAN INSTALASI FONDASI
-- ========================================================
DO $$
DECLARE
    v_tbl_count INT;
BEGIN
    SELECT COUNT(*) INTO v_tbl_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('profiles', 'packages', 'jamaah', 'documents', 'payments', 'schedules');
    
    IF v_tbl_count = 6 THEN
        RAISE NOTICE 'SUKSES: Ke-6 tabel fondasi berhasil diinstalasi dengan sempurna di database staging.';
    ELSE
        RAISE WARNING 'PERINGATAN: Hanya % dari 6 tabel fondasi yang terdeteksi di skema public.', v_tbl_count;
    END IF;
END $$;
