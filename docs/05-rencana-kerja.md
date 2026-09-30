# Rencana Kerja & Checklist Implementasi (Implementation Roadmap)

Dokumen ini memetakan langkah-langkah pengembangan **Prototipe Manajemen Haji & Umroh** dari tahap nol hingga siap produksi (*deployment*), yang terbagi ke dalam 7 fase terstruktur dan dipetakan langsung dengan Functional Requirements (FR-01 s/d FR-26).

---

## 📅 Roadmap Pelaksanaan Proyek

```text
[Fase 1: Setup & Database] ──► [Fase 2: Auth & Layout] ──► [Fase 3: Paket & Jadwal]
                                                                  │
                                                                  ▼
[Fase 7: Testing & Deploy] ◄── [Fase 6: Dashboard]    ◄── [Fase 4 & 5: Jamaah, Dok & Bayar]
```

---

## 📋 Checklist Rinci Setiap Fase

### Fase 1: Inisialisasi Proyek & Konfigurasi Supabase
- [x] Inisialisasi proyek React dengan bundler Vite (Template JavaScript).
- [x] Instalasi dependensi utama: `@supabase/supabase-js`, `react-router-dom`, `lucide-react`.
- [x] Setup file lingkungan `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) & template `.env.example`.
- [x] Pastikan file `.env` diabaikan oleh Git (`.gitignore`).
- [x] Inisialisasi modul klien Supabase di `src/services/supabase.js`.
- [x] Integrasi tipografi Google Fonts (*Plus Jakarta Sans*) pada `index.html`.
- [ ] Eksekusi seluruh skrip DDL SQL dari [docs/02-database-dan-rls.md](file:///c:/Users/hp/Documents/Prototype%20manajemen%20haji%20&%20umroh/docs/02-database-dan-rls.md) di Supabase SQL Editor.
- [ ] Buat dua bucket penyimpanan di Supabase Storage: `documents` dan `payment-proofs`.
- [ ] Aktifkan Storage RLS Policies untuk kedua bucket.
- [ ] Eksekusi script *seed data* untuk paket awal dan jadwal uji coba.

---

### Fase 2: Autentikasi, Hak Akses, & Pondasi Layout
- [x] Buat klien Supabase di `src/services/supabase.js`.
- [x] Buat custom hook `src/hooks/useAuth.jsx` untuk manajemen status login, pemetaan role, dan demo mode.
- [x] Buat komponen rute aman `src/components/ProtectedRoute.jsx` (memisahkan proteksi role `admin` vs `jamaah`).
- [x] Bangun halaman masuk pengguna di `src/pages/Login.jsx` (**FR-01**, **FR-02**) lengkap dengan fitur login cepat demo.
- [x] Implementasikan stylesheet dasar `src/index.css` dengan token desain tema Islami modern (*Emerald & Gold*).
- [x] Buat komponen antarmuka bersama: `Navbar.jsx`, `Sidebar.jsx`, `Modal.jsx`, `PaymentStatusBadge.jsx`, dan `StatCard.jsx`.
- [x] Buat komponen tata letak aplikasi `src/components/Layout.jsx`.
- [x] Konfigurasi sistem routing hierarkis lengkap di `src/App.jsx`.
- [x] Sediakan antarmuka awal halaman Admin & Jamaah yang terhubung rapi ke navigasi.

---

### Fase 3: Modul Master Data (Paket & Jadwal Perjalanan)
- [ ] Halaman Admin: `src/pages/admin/Paket.jsx` — Form input paket, edit harga, tanggal keberangkatan/kepulangan, dan durasi hari (**FR-23**).
- [ ] Halaman Admin: `src/pages/admin/Jadwal.jsx` — Form input agenda kegiatan, penentuan jam, lokasi, dan relasi ke paket (**FR-24**).
- [ ] Halaman Jamaah: `src/pages/jamaah/Jadwal.jsx` — Menampilkan jadwal kegiatan sesuai paket yang diikuti jamaah (**FR-25**).

---

### Fase 4: Modul Jamaah & Manajemen Berkas Dokumen
- [ ] Halaman Admin: `src/pages/admin/Jamaah.jsx` — Tabel data jamaah, form registrasi jamaah baru, filter status, dan fitur pencarian (**FR-04**, **FR-05**).
- [ ] Halaman Admin: `src/pages/admin/DetailJamaah.jsx` — Profil lengkap satu jamaah beserta seluruh status berkas dan riwayat keuangannya.
- [ ] Halaman Admin: `src/pages/admin/Dokumen.jsx` — Verifikasi kelengkapan 6 dokumen (KTP, KK, Paspor, Foto, Buku Nikah, Kesehatan) dengan tombol Validasi / Tolak (**FR-06**).
- [ ] Halaman Jamaah: `src/pages/jamaah/Profil.jsx` — Jamaah dapat melihat data pribadinya sendiri.
- [ ] Halaman Jamaah: `src/pages/jamaah/Dokumen.jsx` — Jamaah mengunggah berkas ke Supabase Storage dan memantau status verifikasi.
- [ ] Implementasikan formula otomatis persentase kelengkapan berkas pada database view / frontend helper (**FR-07**).

---

### Fase 5: Modul Pembayaran & Logika Finansial (Inti Sistem)
- [ ] **Alur Jamaah - Pengajuan Transfer**:
  - Halaman `src/pages/jamaah/AjukanPembayaran.jsx` (**FR-08**).
  - Pilihan radio button: Bayar Penuh vs Cicilan (**FR-09**).
  - Validasi sistem: Bayar Penuh mengunci nominal otomatis sebesar sisa tagihan, Cicilan mengizinkan `0 < nominal <= sisa tagihan` (**FR-10**).
  - Unggah bukti struk transfer ke Supabase Storage bucket `payment-proofs/` (**FR-11**).
  - Status tersimpan otomatis sebagai `pending` (Menunggu Verifikasi).
- [ ] **Alur Admin - Verifikasi Transfer**:
  - Halaman `src/pages/admin/VerifikasiPembayaran.jsx` — Menampilkan antrean transaksi transfer berstatus `pending` (**FR-12**).
  - Pop-up modal pratinjau bukti transfer dengan aksi **[✓ Verifikasi]** (**FR-13**) atau **[✕ Tolak]** (**FR-14**).
  - Validasi wajib mengisi alasan penolakan jika ditolak (**FR-15**).
- [ ] **Alur Admin - Pencatatan Cash**:
  - Halaman `src/pages/admin/CatatPembayaranCash.jsx` — Form input pembayaran cash langsung dari jamaah (**FR-16**).
  - Transaksi otomatis tersimpan dengan status `verified` (**FR-17**).
- [ ] **Integritas Agregasi Keuangan**:
  - Memastikan HANYA transaksi berstatus `verified` yang dijumlahkan ke total bayar sah (**FR-18**, **FR-19**).
  - Perhitungan sisa tagihan: `Harga Paket - Total Terbayar Sah` (**FR-20**).
  - Penentuan otomatis status pelunasan: *Belum Bayar*, *Cicilan*, atau *Lunas* (**FR-21**).
- [ ] Halaman Riwayat Transaksi:
  - Admin: `src/pages/admin/Pembayaran.jsx` (Daftar semua transaksi seluruh jamaah).
  - Jamaah: `src/pages/jamaah/Pembayaran.jsx` (Hanya transaksi miliknya sendiri) (**FR-22**).

---

### Fase 6: Dashboard Metrik & Pemantauan Operasional
- [ ] Halaman `src/pages/admin/Dashboard.jsx` (**FR-03**):
  - Ringkasan Jamaah: Total jamaah, jamaah aktif, jamaah siap berangkat.
  - Ringkasan Dokumen: Total berkas lengkap, belum lengkap, menunggu verifikasi.
  - Ringkasan Pembayaran: Jumlah jamaah belum bayar, cicilan, lunas, serta alert antrean transfer pending.
  - Informasi keberangkatan terdekat.
- [ ] Halaman `src/pages/jamaah/Dashboard.jsx`:
  - Salam sapaan nama jamaah.
  - Kartu paket aktif dan jadwal keberangkatan.
  - Kartu status keuangan: Harga Paket, Terbayar, Sisa Tagihan, Status Pelunasan.
  - Peringatan jika terdapat bukti transfer yang berstatus *Menunggu Verifikasi* atau *Ditolak*.
  - Indikator progres kelengkapan dokumen (0% - 100%).

---

### Fase 7: Pengujian, Keamanan RLS, & Deployment
- [ ] Verifikasi Row Level Security (RLS) di Supabase (**FR-26**):
  - Pastikan user jamaah tidak dapat membaca/mengedit baris pembayaran atau dokumen milik jamaah lain.
  - Pastikan user jamaah tidak dapat mengubah status verifikasi sendiri melalui API inspect.
- [ ] Pengujian fungsionalitas lintas perangkat (responsif di desktop, tablet, dan ponsel).
- [ ] Pastikan file `.env` terdaftar di `.gitignore`.
- [ ] Push source code ke repositori GitHub.
- [ ] Hubungkan repositori ke **Vercel**, konfigurasi Environment Variables di Vercel Dashboard, dan jalankan build produksi.
- [ ] Verifikasi aplikasi live di URL Vercel produksi.
