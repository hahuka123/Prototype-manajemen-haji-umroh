# PANDUAN PENGUJIAN DATABASE STAGING — TERMIN CICILAN & NOTIFIKASI IN-APP
**Dokumen:** `docs/06-panduan-pengujian-staging.md`  
**Tahap:** 5.5 — Persiapan Lingkungan Staging Terisolasi  
**Sifat:** Instruksi Manual & Standar Operasional Prosedur (SOP)  

---

## 1. Pilihan Lingkungan Staging Terisolasi

Pengujian integrasi fisik PostgreSQL **DILARANG KERAS** dilakukan pada proyek database produksi (`rbyovtqphfawuazfxjlv.supabase.co`). Pilih salah satu dari dua opsi lingkungan berikut:

### Opsi A: Supabase Cloud Project Terpisah (Sangat Direkomendasikan)
1. Buat project baru pada dashboard Supabase (organisasi yang sama atau akun khusus pengujian):
   - **Nama Proyek:** `haji-umroh-staging`
   - **Wilayah:** Singapore (`ap-southeast-1`)
   - **Database Password:** Tetapkan password yang kuat dan simpan di pengelola kredensial aman.
2. Catat URL API dan `anon` key project staging untuk pengujian aplikasi staging (jangan menyentuh file `.env` aplikasi utama).

### Opsi B: Supabase CLI Lokal (Menggunakan Docker)
1. Buka dan jalankan aplikasi **Docker Desktop** di komputer Anda.
2. Pastikan Docker engine aktif (`docker info` mengembalikan status sukses).
3. Inisialisasi konfigurasi Supabase lokal (jika belum ada):
   ```powershell
   npx supabase init
   ```
4. Jalankan stack database lokal:
   ```powershell
   npx supabase start
   ```
5. Akses Supabase Studio lokal di peramban web pada `http://localhost:54323`.

---

## 2. Prosedur Wajib: Verifikasi Target Koneksi Sebelum Eksekusi SQL

Sebelum menjalankan skrip migrasi atau data uji, eksekusi query keselamatan berikut di **SQL Editor** untuk memastikan Anda **TIDAK** berada di database produksi:

```sql
-- VERIFIKASI KEAMANAN TARGET KONEKSI
SELECT 
    current_database() AS database_aktif,
    current_user AS user_koneksi,
    inet_server_addr() AS ip_server,
    (SELECT COUNT(*) FROM public.jamaah) AS total_jamaah_terdaftar;
```

> [!CAUTION]
> **Hentikan Eksekusi Jika:**
> - Jumlah jamaah terdaftar mencerminkan data riil biro perjalanan haji & umrah Anda.
> - URL dashboard di browser menunjukkan ID project produksi Anda.

---

## 3. Verifikasi Skema Fondasi Staging

Pastikan skema dasar (`profiles`, `jamaah`, `payments`, `packages`, fungsi `is_admin`, dan `update_updated_at_column`) sudah terpasang di database staging. Jalankan pemeriksaan berikut:

```sql
-- 1. Verifikasi ketersediaan tabel dasar dan kolom wajib
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND (
    (table_name = 'profiles' AND column_name IN ('id', 'role')) OR
    (table_name = 'jamaah' AND column_name IN ('id', 'profile_id', 'package_id')) OR
    (table_name = 'payments' AND column_name IN ('id', 'jamaah_id', 'amount', 'status', 'payment_method', 'rejection_reason'))
  )
ORDER BY table_name, column_name;

-- 2. Verifikasi ketersediaan fungsi helper is_admin dan update_updated_at_column
SELECT 
    routine_name, 
    routine_type, 
    security_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('is_admin', 'update_updated_at_column');
```
*Jika salah satu tabel atau fungsi belum ditemukan, terapkan terlebih dahulu skrip fondasi dari [02-database-dan-rls.md](file:///c:/Users/hp/Documents/Prototype%20manajemen%20haji%20&%20umroh/docs/02-database-dan-rls.md).*

---

## 4. Urutan Penerapan SQL di SQL Editor Staging

Terapkan berkas SQL satu per satu secara berurutan:

1. **Langkah 0 (Fondasi Database Staging Kosong):**
   - Tempel isi berkas [supabase/staging_foundation.sql](file:///c:/Users/hp/Documents/Prototype%20manajemen%20haji%20&%20umroh/supabase/staging_foundation.sql) $\rightarrow$ Klik **Run**.
   - *Verifikasi:* Membentuk 6 tabel dasar (`profiles`, `packages`, `jamaah`, `documents`, `payments`, `schedules`), helper `is_admin()`, RPC kuota paket, view `v_jamaah_billing_summary` (security_invoker), RLS policies, dan bucket privat Supabase Storage.
2. **Langkah 1 (Termin Cicilan):** 
   - Tempel isi berkas [20261024100000_create_installment_terms_schema.sql](file:///c:/Users/hp/Documents/Prototype%20manajemen%20haji%20&%20umroh/supabase/migrations/20261024100000_create_installment_terms_schema.sql) $\rightarrow$ Klik **Run**.
   - *Verifikasi:* Tabel `installment_terms` dan view `v_installment_terms_summary` terbentuk.
3. **Langkah 2 (Notifikasi In-App):** 
   - Tempel isi berkas [20261024110000_create_notifications_schema.sql](file:///c:/Users/hp/Documents/Prototype%20manajemen%20haji%20&%20umroh/supabase/migrations/20261024110000_create_notifications_schema.sql) $\rightarrow$ Klik **Run**.
   - *Verifikasi:* Tabel `notifications`, constraint unik `dedup_key`, RPC `mark_notification_as_read`, dan trigger `trg_payments_notification` terbentuk.
4. **Langkah 3 (Fungsi Pengingat Cicilan):** 
   - Tempel isi berkas [20261025100000_create_installment_reminder_function.sql](file:///c:/Users/hp/Documents/Prototype%20manajemen%20haji%20&%20umroh/supabase/migrations/20261025100000_create_installment_reminder_function.sql) $\rightarrow$ Klik **Run**.
   - *Verifikasi:* Fungsi `public.process_installment_reminders()` terbentuk.

---

## 5. Penyiapan Data Uji Sintetis (Bebas PII)

Gunakan UUID konstan terisolasi berawalan `ffffffff-0000-0000-0000-` agar seluruh data uji dapat dilacak dan dibersihkan secara presisi:

```sql
-- ========================================================
-- DATA UJI SINTETIS STAGING (ISOLASI UUID EKSPLISIT)
-- ========================================================

-- 1. Buat User Auth Uji Coba di auth.users (Jika menggunakan local / direct SQL)
-- Catatan: Jika di Supabase Cloud, buat 3 pengguna via menu Auth -> Add User:
--   - admin.staging@test.internal (Role: admin)
--   - jamaah1.staging@test.internal (Role: jamaah)
--   - jamaah2.staging@test.internal (Role: jamaah)
-- Atau gunakan UUID sintetis di bawah jika auth schema mengizinkan:

INSERT INTO public.profiles (id, full_name, phone, role)
VALUES 
    ('ffffffff-0000-0000-0000-000000000001', 'Staging Admin Tester', '081100000001', 'admin'),
    ('ffffffff-0000-0000-0000-000000000002', 'Staging Jamaah Satu', '081100000002', 'jamaah'),
    ('ffffffff-0000-0000-0000-000000000003', 'Staging Jamaah Dua',  '081100000003', 'jamaah')
ON CONFLICT (id) DO NOTHING;

-- 2. Paket Perjalanan Sintetis (Kolom sesuai skema fondasi)
INSERT INTO public.packages (id, name, type, price, departure_date, return_date, duration, quota)
VALUES (
    'ffffffff-0000-0000-0000-000000000010',
    'Paket Uji Coba Umrah Staging',
    'Umrah',
    30000000,
    (CURRENT_DATE + 60),
    (CURRENT_DATE + 69),
    10,
    45
)
ON CONFLICT (id) DO NOTHING;

-- 3. Jamaah Sintetis (Wajib menyertakan birth_date, gender, address bertipe NOT NULL)
INSERT INTO public.jamaah (id, profile_id, package_id, nik, phone, birth_date, gender, address, status)
VALUES 
    ('ffffffff-0000-0000-0000-000000000020', 'ffffffff-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000010', '9999000000000001', '081100000002', '1990-01-01', 'Laki-laki', 'Jl. Staging No. 1, Jakarta', 'Pendaftaran'),
    ('ffffffff-0000-0000-0000-000000000030', 'ffffffff-0000-0000-0000-000000000003', 'ffffffff-0000-0000-0000-000000000010', '9999000000000002', '081100000003', '1992-05-15', 'Perempuan', 'Jl. Staging No. 2, Jakarta', 'Pendaftaran')
ON CONFLICT (id) DO NOTHING;

-- 4. Jadwal Termin Cicilan Uji Coba untuk Jamaah Satu
INSERT INTO public.installment_terms (id, jamaah_id, term_number, title, amount, due_date, created_by)
VALUES 
    -- Termin A: Tepat H-7 dari hari ini
    ('ffffffff-0000-0000-0000-000000000101', 'ffffffff-0000-0000-0000-000000000020', 1, 'Uji Termin H-7', 5000000, (CURRENT_DATE + 7), 'ffffffff-0000-0000-0000-000000000001'),
    -- Termin B: Tepat H-1 dari hari ini
    ('ffffffff-0000-0000-0000-000000000102', 'ffffffff-0000-0000-0000-000000000020', 2, 'Uji Termin H-1', 5000000, (CURRENT_DATE + 1), 'ffffffff-0000-0000-0000-000000000001'),
    -- Termin C: Overdue (jatuh tempo 5 hari lalu, tanpa pending)
    ('ffffffff-0000-0000-0000-000000000103', 'ffffffff-0000-0000-0000-000000000020', 3, 'Uji Termin Overdue', 5000000, (CURRENT_DATE - 5), 'ffffffff-0000-0000-0000-000000000001'),
    -- Termin D: Sudah Lunas (ada verified payment)
    ('ffffffff-0000-0000-0000-000000000104', 'ffffffff-0000-0000-0000-000000000020', 4, 'Uji Termin Lunas', 5000000, (CURRENT_DATE - 10), 'ffffffff-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Pembayaran Lunas untuk Termin D
INSERT INTO public.payments (id, jamaah_id, installment_term_id, amount, payment_type, payment_method, status, verified_at, verified_by)
VALUES (
    'ffffffff-0000-0000-0000-000000000201',
    'ffffffff-0000-0000-0000-000000000020',
    'ffffffff-0000-0000-0000-000000000104',
    5000000,
    'cicilan',
    'transfer',
    'verified',
    NOW(),
    'ffffffff-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Termin Cicilan untuk Jamaah Dua (Kasus Overdue dengan Pembayaran Pending)
INSERT INTO public.installment_terms (id, jamaah_id, term_number, title, amount, due_date, created_by)
VALUES (
    'ffffffff-0000-0000-0000-000000000105',
    'ffffffff-0000-0000-0000-000000000030',
    1,
    'Uji Termin Overdue Berstatus Pending',
    10000000,
    (CURRENT_DATE - 3),
    'ffffffff-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Pembayaran Pending untuk Termin Jamaah Dua
INSERT INTO public.payments (id, jamaah_id, installment_term_id, amount, payment_type, payment_method, status)
VALUES (
    'ffffffff-0000-0000-0000-000000000202',
    'ffffffff-0000-0000-0000-000000000030',
    'ffffffff-0000-0000-0000-000000000105',
    10000000,
    'cicilan',
    'transfer',
    'pending'
)
ON CONFLICT (id) DO NOTHING;
```

---

## 6. Matriks Kasus Uji Verifikasi Staging

| ID | Kasus Uji | Perintah / Aksi | Kriteria Keberhasilan (Ekspektasi) |
|---|---|---|---|
| **TC-01** | **Penolakan Otorisasi Anonim** | Panggil RPC `process_installment_reminders` via REST client / Supabase Anon client. | HTTP 401 / 403 atau pesan *permission denied*. |
| **TC-02** | **Penolakan Otorisasi Jamaah** | Panggil RPC `process_installment_reminders` saat login sebagai Jamaah Satu (`ffffffff-...-02`). | HTTP 400 / 500 dengan pesan error: `Akses ditolak: Hanya administrator yang dapat memproses pengingat termin cicilan.` |
| **TC-03** | **Izin Eksekusi Admin / Superuser** | Jalankan `SELECT public.process_installment_reminders();` di SQL Editor atau via login Admin. | Mengembalikan JSON: `{"success": true, "status": "success", "errors_encountered": 0}`. |
| **TC-04** | **Verifikasi Pengingat H-7** | Periksa baris di `public.notifications` untuk Termin H-7. | Ditemukan notifikasi `type = 'due_h7'` dengan `dedup_key = 'due_h7_ffffffff-0000-0000-0000-000000000101_' || to_char(CURRENT_DATE + 7, 'YYYY-MM-DD')`. |
| **TC-05** | **Verifikasi Pengingat H-1** | Periksa baris di `public.notifications` untuk Termin H-1. | Ditemukan notifikasi `type = 'due_h1'` dengan `dedup_key = 'due_h1_ffffffff-0000-0000-0000-000000000102_' || to_char(CURRENT_DATE + 1, 'YYYY-MM-DD')`. |
| **TC-06** | **Verifikasi Pengingat Overdue** | Periksa baris di `public.notifications` untuk Termin Overdue Jamaah Satu. | Ditemukan notifikasi `type = 'overdue'` dengan `dedup_key = 'overdue_ffffffff-0000-0000-0000-000000000103_' || to_char(CURRENT_DATE, 'YYYY-MM')`. |
| **TC-07** | **Verifikasi Supresi Overdue (Pending Guard)** | Periksa notifikasi untuk Termin Jamaah Dua (`ffffffff-...-105`). | **Tidak ada** notifikasi overdue yang dibuat karena memiliki pembayaran berstatus `pending`. |
| **TC-08** | **Verifikasi Supresi Termin Lunas** | Periksa notifikasi untuk Termin Lunas (`ffffffff-...-104`). | **Tidak ada** notifikasi pengingat apapun yang dibuat. |
| **TC-09** | **Idempotensi & Deduplikasi (Anti-Spam)** | Jalankan kembali fungsi `SELECT public.process_installment_reminders();` untuk kedua kalinya. | Nilai `notifications_created` pada JSON kembalian adalah **0**, dan total baris di tabel `notifications` tidak bertambah. |
| **TC-10** | **Trigger Pembayaran: Submit Transfer** | Insert pembayaran transfer baru status `pending`. | Notifikasi `payment_submitted` terbuat otomatis untuk jamaah terkait. |
| **TC-11** | **Trigger Pembayaran: Verifikasi Transfer** | Update status pembayaran transfer dari `pending` menjadi `verified`. | Notifikasi `payment_verified` terbuat otomatis untuk jamaah terkait. |
| **TC-12** | **Trigger Pembayaran: Penolakan Transfer** | Update status pembayaran transfer dari `pending` menjadi `rejected`. | Notifikasi `payment_rejected` terbuat otomatis memuat alasan penolakan. |
| **TC-13** | **Trigger Pembayaran: Pembayaran Tunai** | Insert pembayaran tunai langsung sah (`cash`, `verified`). | Notifikasi `payment_cash` terbuat otomatis untuk jamaah terkait. |
| **TC-14** | **Isolasi RLS Kotak Masuk** | Login sebagai Jamaah Satu di aplikasi / kueri `SELECT * FROM notifications`. | Hanya melihat notifikasi miliknya sendiri (`profile_id = ffffffff-...-02`). Sama sekali tidak melihat notifikasi Jamaah Dua atau Admin. |
| **TC-15** | **Penandaan Notifikasi Dibaca (mark_notification_as_read)** | Eksekusi RPC `mark_notification_as_read` untuk satu notifikasi milik Jamaah Satu. | Kolom `is_read` berubah menjadi `true`, `read_at` terisi timestamp WIB, unread count berkurang. |

---

## 7. Prosedur Pembersihan Data Uji Sintetis (*Teardown*)

Setelah seluruh verifikasi selesai, bersihkan seluruh baris data uji **HANYA** berdasarkan UUID sintetis yang terisolasi. Dilarang menggunakan penghapusan berbasis pola NIK global:

```sql
-- ========================================================
-- PEMBERSIHAN DATA UJI SINTETIS (TEARDOWN AMAN)
-- Urutan eksekusi mematuhi integritas referensial (Reverse FK)
-- ========================================================

-- 1. Hapus Notifikasi Uji Coba
DELETE FROM public.notifications 
WHERE profile_id IN (
    'ffffffff-0000-0000-0000-000000000001',
    'ffffffff-0000-0000-0000-000000000002',
    'ffffffff-0000-0000-0000-000000000003'
)
OR jamaah_id IN (
    'ffffffff-0000-0000-0000-000000000020',
    'ffffffff-0000-0000-0000-000000000030'
);

-- 2. Hapus Pembayaran Uji Coba
DELETE FROM public.payments 
WHERE jamaah_id IN (
    'ffffffff-0000-0000-0000-000000000020',
    'ffffffff-0000-0000-0000-000000000030'
);

-- 3. Hapus Termin Cicilan Uji Coba
DELETE FROM public.installment_terms 
WHERE jamaah_id IN (
    'ffffffff-0000-0000-0000-000000000020',
    'ffffffff-0000-0000-0000-000000000030'
);

-- 4. Hapus Jamaah Uji Coba
DELETE FROM public.jamaah 
WHERE id IN (
    'ffffffff-0000-0000-0000-000000000020',
    'ffffffff-0000-0000-0000-000000000030'
);

-- 5. Hapus Paket Uji Coba
DELETE FROM public.packages 
WHERE id = 'ffffffff-0000-0000-0000-000000000010';

-- 6. Hapus Profil Uji Coba
DELETE FROM public.profiles 
WHERE id IN (
    'ffffffff-0000-0000-0000-000000000001',
    'ffffffff-0000-0000-0000-000000000002',
    'ffffffff-0000-0000-0000-000000000003'
);
```
