# Database Schema, RLS, & Storage Specification

Dokumen ini memuat arsitektur database relasional PostgreSQL untuk **Prototipe Aplikasi Haji & Umroh**, lengkap dengan script DDL, trigger otomatis, database view kalkulasi, Row Level Security (RLS), dan konfigurasi Supabase Storage.

---

## 1. Diagram Relasi Entitas (ERD)

```text
       auth.users (Supabase Auth)
           │
           │ 1 : 1
           ▼
        profiles
           │
           │ 1 : 1
           ▼
         jamaah ──────────────┐ (N : 1)
           │                  ▼
           │               packages
           ├────────────┐     │
           │ 1 : N      │ 1:N │ 1 : N
           ▼            ▼     ▼
       documents     payments schedules
```

### Ringkasan Relasi:
- **1 Akun Auth (`auth.users`)** memiliki **1 Profil Pengguna (`profiles`)** dengan role `admin` atau `jamaah`.
- **1 Profil Jamaah (`profiles`)** terhubung ke **1 Data Jamaah (`jamaah`)**.
- **1 Jamaah** terdaftar pada **1 Paket Perjalanan (`packages`)**.
- **1 Jamaah** memiliki banyak **Dokumen (`documents`)**.
- **1 Jamaah** memiliki banyak transaksi **Pembayaran (`payments`)**.
- **1 Paket** memiliki banyak agenda **Jadwal Kegiatan (`schedules`)**.

---

## 2. Script Lengkap DDL PostgreSQL (Siap Dijalankan di Supabase SQL Editor)

Salin seluruh script SQL di bawah ini dan jalankan langsung di menu **SQL Editor** pada dashboard Supabase Anda.

```sql
-- ========================================================
-- 1. EXTENSIONS & CUSTOM ENUM TYPES
-- ========================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Role Pengguna
CREATE TYPE user_role AS ENUM ('admin', 'jamaah');

-- Status Siklus Jamaah
CREATE TYPE jamaah_status AS ENUM (
    'Pendaftaran',
    'Dokumen Diproses',
    'Belum Lunas',
    'Siap Berangkat',
    'Sudah Berangkat',
    'Selesai'
);

-- Tipe Dokumen Pendukung
CREATE TYPE document_type AS ENUM (
    'ktp',
    'kk',
    'passport',
    'foto',
    'buku-nikah',
    'kesehatan'
);

-- Status Verifikasi Dokumen
CREATE TYPE document_status AS ENUM (
    'Belum Ada',
    'Menunggu Verifikasi',
    'Lengkap',
    'Ditolak'
);

-- Jenis Pembayaran Tagihan
CREATE TYPE payment_type AS ENUM ('full', 'installment');

-- Metode Pembayaran
CREATE TYPE payment_method AS ENUM ('transfer', 'cash');

-- Status Verifikasi Pembayaran
CREATE TYPE payment_status AS ENUM ('pending', 'verified', 'rejected');


-- ========================================================
-- 2. TABEL PROFILES (Ekstensi auth.users)
-- ========================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    role user_role NOT NULL DEFAULT 'jamaah',
    phone VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ========================================================
-- 3. TABEL PACKAGES (Paket Perjalanan Haji & Umroh)
-- ========================================================
CREATE TABLE public.packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'Umrah Reguler', -- contoh: Haji Plus, Umrah VIP
    price NUMERIC(15, 2) NOT NULL CHECK (price >= 0),
    departure_date DATE NOT NULL,
    return_date DATE NOT NULL,
    duration INT NOT NULL CHECK (duration > 0), -- dalam jumlah hari
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ========================================================
-- 4. TABEL JAMAAH (Data Administratif Jamaah)
-- ========================================================
CREATE TABLE public.jamaah (
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


-- ========================================================
-- 5. TABEL DOCUMENTS (Berkas Lampiran Jamaah)
-- ========================================================
CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jamaah_id UUID NOT NULL REFERENCES public.jamaah(id) ON DELETE CASCADE,
    document_type document_type NOT NULL,
    file_path TEXT, -- URL / path pada Supabase Storage
    status document_status NOT NULL DEFAULT 'Belum Ada',
    notes TEXT, -- Catatan verifikator jika ada kekurangan/alasan tolak
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_jamaah_doc_type UNIQUE (jamaah_id, document_type)
);


-- ========================================================
-- 6. TABEL PAYMENTS (Transaksi Pembayaran)
-- ========================================================
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jamaah_id UUID NOT NULL REFERENCES public.jamaah(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    payment_type payment_type NOT NULL,
    payment_method payment_method NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    bank_name VARCHAR(50), -- Diisi jika metode = 'transfer' (e.g. 'BSI', 'Mandiri')
    reference_number VARCHAR(100), -- Nomor referensi transaksi transfer
    proof_file_path TEXT, -- Path berkas struk pada Supabase Storage
    status payment_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT, -- Wajib diisi jika status diubah menjadi 'rejected'
    admin_notes TEXT,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ========================================================
-- 7. TABEL SCHEDULES (Jadwal & Agenda Perjalanan)
-- ========================================================
CREATE TABLE public.schedules (
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
-- 8. TRIGGER UPDATE 'updated_at' OTOMATIS
-- ========================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_packages_updated_at BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_jamaah_updated_at BEFORE UPDATE ON public.jamaah FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ========================================================
-- 9. TRIGGER OTOMATISASI SIGNUP USER KE PROFILES
-- ========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role, phone)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'User Baru'),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'jamaah'),
        NEW.raw_user_meta_data->>'phone'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ========================================================
-- 10. DATABASE VIEW: KALKULASI FINANSIAL & TAGIHAN REAL-TIME
-- ========================================================
CREATE OR REPLACE VIEW public.v_jamaah_billing_summary AS
SELECT 
    j.id AS jamaah_id,
    j.profile_id,
    p.full_name,
    j.nik,
    j.phone,
    pkg.id AS package_id,
    pkg.name AS package_name,
    COALESCE(pkg.price, 0) AS package_price,
    COALESCE(SUM(pay.amount) FILTER (WHERE pay.status = 'verified'), 0) AS total_terbayar,
    COALESCE(SUM(pay.amount) FILTER (WHERE pay.status = 'pending'), 0) AS pending_verifikasi,
    GREATEST(0, COALESCE(pkg.price, 0) - COALESCE(SUM(pay.amount) FILTER (WHERE pay.status = 'verified'), 0)) AS sisa_tagihan,
    CASE 
        WHEN COALESCE(SUM(pay.amount) FILTER (WHERE pay.status = 'verified'), 0) = 0 THEN 'Belum Bayar'
        WHEN COALESCE(SUM(pay.amount) FILTER (WHERE pay.status = 'verified'), 0) >= COALESCE(pkg.price, 0) THEN 'Lunas'
        ELSE 'Cicilan'
    END AS status_pelunasan,
    -- Persentase Dokumen (Basis 6 dokumen standar)
    ROUND(
        (COALESCE(COUNT(doc.id) FILTER (WHERE doc.status = 'Lengkap'), 0)::numeric / 6.0) * 100
    ) AS persentase_dokumen
FROM public.jamaah j
LEFT JOIN public.profiles p ON j.profile_id = p.id
LEFT JOIN public.packages pkg ON j.package_id = pkg.id
LEFT JOIN public.payments pay ON j.id = pay.jamaah_id
LEFT JOIN public.documents doc ON j.id = doc.jamaah_id
GROUP BY j.id, j.profile_id, p.full_name, j.nik, j.phone, pkg.id, pkg.name, pkg.price;
```

---

## 3. Konfigurasi Row Level Security (RLS)

Kebijakan ini menjamin bahwa **Admin** dapat mengelola seluruh data, sedangkan **Jamaah** hanya bisa mengakses datanya sendiri secara ketat langsung pada level database.

```sql
-- Aktifkan RLS di seluruh tabel
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jamaah ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- Helper Function: Mengecek apakah user saat ini adalah admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------
-- POLICIES: PROFILES
-- --------------------------------------------------------
CREATE POLICY "Admin dapat mengelola semua profil"
ON public.profiles FOR ALL
USING (public.is_admin());

CREATE POLICY "Pengguna dapat membaca profil sendiri"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Pengguna dapat mengupdate profil sendiri"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- --------------------------------------------------------
-- POLICIES: PACKAGES
-- --------------------------------------------------------
CREATE POLICY "Semua user terotentikasi dapat melihat paket"
ON public.packages FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Hanya Admin yang dapat CRUD paket"
ON public.packages FOR ALL
USING (public.is_admin());

-- --------------------------------------------------------
-- POLICIES: SCHEDULES
-- --------------------------------------------------------
CREATE POLICY "Semua user terotentikasi dapat melihat jadwal"
ON public.schedules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Hanya Admin yang dapat CRUD jadwal"
ON public.schedules FOR ALL
USING (public.is_admin());

-- --------------------------------------------------------
-- POLICIES: JAMAAH
-- --------------------------------------------------------
CREATE POLICY "Admin dapat mengelola seluruh data jamaah"
ON public.jamaah FOR ALL
USING (public.is_admin());

CREATE POLICY "Jamaah dapat melihat data jamaahnya sendiri"
ON public.jamaah FOR SELECT
USING (profile_id = auth.uid());

-- --------------------------------------------------------
-- POLICIES: DOCUMENTS
-- --------------------------------------------------------
CREATE POLICY "Admin dapat mengelola seluruh berkas dokumen"
ON public.documents FOR ALL
USING (public.is_admin());

CREATE POLICY "Jamaah dapat melihat dokumen miliknya sendiri"
ON public.documents FOR SELECT
USING (
    jamaah_id IN (SELECT id FROM public.jamaah WHERE profile_id = auth.uid())
);

CREATE POLICY "Jamaah dapat mengunggah berkas dokumen sendiri"
ON public.documents FOR INSERT
WITH CHECK (
    jamaah_id IN (SELECT id FROM public.jamaah WHERE profile_id = auth.uid())
);

CREATE POLICY "Jamaah dapat memperbarui berkas dokumen sendiri"
ON public.documents FOR UPDATE
USING (
    jamaah_id IN (SELECT id FROM public.jamaah WHERE profile_id = auth.uid())
);

-- --------------------------------------------------------
-- POLICIES: PAYMENTS
-- --------------------------------------------------------
CREATE POLICY "Admin dapat melihat dan mengelola seluruh pembayaran"
ON public.payments FOR ALL
USING (public.is_admin());

CREATE POLICY "Jamaah dapat melihat riwayat pembayaran sendiri"
ON public.payments FOR SELECT
USING (
    jamaah_id IN (SELECT id FROM public.jamaah WHERE profile_id = auth.uid())
);

CREATE POLICY "Jamaah dapat mengajukan pembayaran transfer"
ON public.payments FOR INSERT
WITH CHECK (
    -- Hanya untuk data jamaah miliknya sendiri
    jamaah_id IN (SELECT id FROM public.jamaah WHERE profile_id = auth.uid())
    -- Jamaah hanya boleh mengajukan metode transfer dengan status pending
    AND payment_method = 'transfer'
    AND status = 'pending'
);
```

---

## 4. Konfigurasi Supabase Storage

Sistem membutuhkan 2 Storage Bucket:
1. `documents`: Menyimpan berkas pribadi jamaah (KTP, Paspor, Kartu Keluarga, Pas Foto, Buku Nikah, Surat Kesehatan).
2. `payment-proofs`: Menyimpan berkas bukti transfer pembayaran jamaah.

### Langkah Pembuatan Bucket di Supabase Dashboard:
1. Masuk ke tab **Storage** $\rightarrow$ **Create New Bucket**.
2. Buat bucket pertama dengan nama: `documents` (Set **Public: OFF** untuk privasi data).
3. Buat bucket kedua dengan nama: `payment-proofs` (Set **Public: OFF**).

### Konfigurasi Storage RLS Policies:

```sql
-- Storage Policy untuk Bucket 'documents'
CREATE POLICY "Admin full akses storage documents"
ON storage.objects FOR ALL
USING (bucket_id = 'documents' AND public.is_admin());

CREATE POLICY "Jamaah dapat upload dokumen ke foldernya"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Jamaah dapat membaca dokumen miliknya"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
);

-- Storage Policy untuk Bucket 'payment-proofs'
CREATE POLICY "Admin full akses storage payment-proofs"
ON storage.objects FOR ALL
USING (bucket_id = 'payment-proofs' AND public.is_admin());

CREATE POLICY "Jamaah dapat upload bukti bayar"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'payment-proofs'
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Jamaah dapat melihat bukti bayar sendiri"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'payment-proofs'
    AND auth.role() = 'authenticated'
);
```

---

## 5. Data Awal Pengujian (Seed Data Dummy)

Jalankan script berikut jika ingin langsung memiliki data uji paket perjalanan dan jadwal:

```sql
-- Tambah contoh paket
INSERT INTO public.packages (name, type, price, departure_date, return_date, duration, description)
VALUES 
(
    'Umrah Reguler Awal Tahun 2027', 
    'Umrah Reguler', 
    35000000.00, 
    '2027-01-10', 
    '2027-01-21', 
    12, 
    'Paket perjalanan ibadah Umrah 12 hari direct flight Jakarta - Madinah dengan hotel bintang 4.'
),
(
    'Haji Khusus / Plus VIP 2027', 
    'Haji Plus', 
    165000000.00, 
    '2027-05-20', 
    '2027-06-15', 
    27, 
    'Paket Haji Plus fasilitas maktab VIP zona 1, hotel bintang 5 dekat pelataran Masjidil Haram.'
);

-- Tambah contoh jadwal agenda
INSERT INTO public.schedules (package_id, date, time, activity, location, description)
SELECT 
    id, 
    '2027-01-10', 
    '08:00:00', 
    'Keberangkatan & Manasik Bandara', 
    'Bandara Soekarno Hatta (CGK)', 
    'Kumpul di Terminal 3 Gate 1 Internasional untuk pengarahan akhir dan pembagian paspor.'
FROM public.packages WHERE name = 'Umrah Reguler Awal Tahun 2027';

INSERT INTO public.schedules (package_id, date, time, activity, location, description)
SELECT 
    id, 
    '2027-01-11', 
    '14:00:00', 
    'Ziarah Kota Madinah', 
    'Masjid Nabawi & Raudhah', 
    'Ziarah ke makam Rasulullah SAW dan pelaksanaan ibadah sunnah di Raudhah Syarifah.'
FROM public.packages WHERE name = 'Umrah Reguler Awal Tahun 2027';
```
