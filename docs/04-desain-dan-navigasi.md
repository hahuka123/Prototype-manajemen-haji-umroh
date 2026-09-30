# Spesifikasi Desain Antarmuka, Struktur Proyek, & Navigasi

Dokumen ini mendefinisikan arsitektur antarmuka pengguna (UI/UX), struktur direktori kode sumber frontend, hierarki navigasi peran pengguna, dan pedoman styling (*design system*) untuk **Prototipe Manajemen Haji & Umroh**.

---

## 1. Struktur Direktori Proyek Frontend

Struktur folder dan file berikut disusun persis sesuai spesifikasi Bab 44 pada PRD v2.0:

```text
haji-umrah/
│
├── public/                     # Aset publik statis (favicon, logo biro)
│
├── src/
│   ├── components/             # Komponen UI modular yang dapat digunakan ulang
│   │   ├── Navbar.jsx          # Header navigasi atas (info user, toggle, tombol logout)
│   │   ├── Sidebar.jsx         # Menu navigasi samping responsif berdasarkan role
│   │   ├── StatCard.jsx        # Kartu indikator metrik statistik pada dashboard
│   │   ├── Modal.jsx           # Komponen dialog pop-up konfirmasi / preview bukti
│   │   ├── PaymentStatusBadge.jsx # Badge status (pending, verified, rejected)
│   │   └── ProtectedRoute.jsx  # Penjaga rute URL berdasarkan autentikasi dan role
│   │
│   ├── pages/
│   │   ├── Login.jsx           # Halaman otentikasi masuk pengguna
│   │   │
│   │   ├── admin/              # Halaman antarmuka khusus Administrator / Petugas biro
│   │   │   ├── Dashboard.jsx   # Metrik operasional, ringkasan berkas & jadwal
│   │   │   ├── Jamaah.jsx      # Daftar jamaah, filter status, tambah jamaah baru
│   │   │   ├── DetailJamaah.jsx# Profil komprehensif 1 jamaah (data, berkas, bayar)
│   │   │   ├── Dokumen.jsx     # Pemantauan & verifikasi berkas seluruh jamaah
│   │   │   ├── Pembayaran.jsx  # Tabel seluruh transaksi keuangan
│   │   │   ├── VerifikasiPembayaran.jsx # Antrean transfer pending (Approve / Reject)
│   │   │   ├── CatatPembayaranCash.jsx  # Form pencatatan tunai (otomatis verified)
│   │   │   ├── Paket.jsx       # CRUD paket perjalanan ibadah
│   │   │   └── Jadwal.jsx      # CRUD jadwal agenda kegiatan keberangkatan
│   │   │
│   │   └── jamaah/             # Halaman antarmuka khusus Jamaah mandiri
│   │       ├── Dashboard.jsx   # Salam sapaan, paket aktif, tagihan & progres berkas
│   │       ├── Profil.jsx      # Tinjauan data identitas pribadi jamaah
│   │       ├── Dokumen.jsx     # Daftar status berkas & antarmuka upload dokumen
│   │       ├── Pembayaran.jsx  # Ringkasan saldo tagihan & tabel riwayat transaksi
│   │       ├── AjukanPembayaran.jsx # Form pengajuan transfer + unggah bukti struk
│   │       └── Jadwal.jsx      # Jadwal agenda khusus paket yang diikutinya
│   │
│   ├── services/
│   │   └── supabase.js         # Inisialisasi klien Supabase (@supabase/supabase-js)
│   │
│   ├── hooks/
│   │   └── useAuth.js          # Custom React hook untuk state sesi pengguna & role
│   │
│   ├── App.jsx                 # Router konfigurasi utama (React Router v6)
│   ├── main.jsx                # Entry point bootstrap aplikasi React
│   └── index.css               # Design system token CSS murni & global stylesheet
│
├── .cursorrules                # Pedoman ketat bagi AI coding assistant
├── .env                        # Konfigurasi Supabase URL & Anon Key (lokal)
├── .gitignore                  # Berkas yang dikecualikan dari Git
├── package.json                # Daftar dependensi & npm scripts
├── vite.config.js              # Konfigurasi bundler Vite
└── README.md                   # Dokumentasi proyek
```

---

## 2. Struktur Navigasi & Pemetaan Rute (Sitemap)

### 2.1 Navigasi Administrator
```text
Admin Dashboard (/admin/dashboard)
├── Jamaah
│   ├── Daftar Jamaah (/admin/jamaah)
│   └── Detail Jamaah (/admin/jamaah/:id)
├── Dokumen (/admin/dokumen)
├── Pembayaran
│   ├── Semua Pembayaran (/admin/pembayaran)
│   ├── Menunggu Verifikasi (/admin/pembayaran/verifikasi)
│   ├── Terverifikasi (/admin/pembayaran?status=verified)
│   ├── Ditolak (/admin/pembayaran?status=rejected)
│   └── Catat Pembayaran Cash (/admin/pembayaran/catat-cash)
├── Paket Perjalanan (/admin/paket)
├── Jadwal Perjalanan (/admin/jadwal)
└── Profil Petugas (/admin/profil)
```

### 2.2 Navigasi Jamaah
```text
Jamaah Dashboard (/jamaah/dashboard)
├── Profil Saya (/jamaah/profil)
├── Dokumen Saya (/jamaah/dokumen)
├── Pembayaran
│   ├── Ringkasan Pembayaran (/jamaah/pembayaran)
│   ├── Riwayat Pembayaran (/jamaah/pembayaran/riwayat)
│   └── Ajukan Pembayaran Transfer (/jamaah/pembayaran/ajukan)
├── Paket Saya (/jamaah/paket)
└── Jadwal Perjalanan (/jamaah/jadwal)
```

---

## 3. Sistem Desain & Visual Styling (Design Tokens)

Mengikuti prinsip visual modern bertema **Islami Kontemporer (Emerald & Champagne Gold)** dengan tampilan elegan, bersih, dan profesional:

```css
:root {
  /* Brand Color Palette */
  --color-primary: #064e3b;        /* Emerald Deep (Hijau Islami Elegan) */
  --color-primary-light: #059669;  /* Emerald Fresh */
  --color-primary-surface: #ecfdf5;/* Emerald Tinted Background */

  --color-accent: #b45309;         /* Gold / Warm Amber */
  --color-accent-light: #f59e0b;   /* Gold Highlight */
  --color-accent-surface: #fffbeb; /* Gold Tinted Background */

  /* Neutral Surface & Typography */
  --color-bg-base: #f8fafc;        /* Slate Light Background */
  --color-bg-card: #ffffff;        /* Pure White Card */
  --color-border: #e2e8f0;         /* Slate Border */
  --color-text-main: #0f172a;      /* Slate 900 Text */
  --color-text-muted: #64748b;     /* Slate 500 Secondary Text */

  /* Semantic Feedback & Status Badges */
  --status-verified-text: #065f46;
  --status-verified-bg: #d1fae5;   /* Hijau Terverifikasi / Lengkap */

  --status-pending-text: #92400e;
  --status-pending-bg: #fef3c7;    /* Kuning Menunggu Verifikasi */

  --status-rejected-text: #991b1b;
  --status-rejected-bg: #fee2e2;   /* Merah Ditolak */

  --status-neutral-text: #334155;
  --status-neutral-bg: #f1f5f9;    /* Abu-abu Belum Ada / Draft */

  /* Typography */
  --font-sans: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;

  /* Shadows & Radius */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
}
```

---

## 4. Spesifikasi Komponen Utama

### 4.1 StatCard (`src/components/StatCard.jsx`)
Komponen kartu angka yang digunakan di dashboard:
- **Props**: `title` (string), `value` (string/number), `icon` (SVG), `trend` (opsional), `colorVariant` (`primary` | `accent` | `warning` | `success`).
- **Tampilan**: Latar belakang putih dengan aksen garis kiri halus sesuai varian warna, nilai angka tebal (*font-weight: 700*), dan label informatif di bawahnya.

### 4.2 PaymentStatusBadge (`src/components/PaymentStatusBadge.jsx`)
Badge status transaksi pembayaran:
- `pending`: Menampilkan label **"Menunggu Verifikasi"** dengan warna latar kuning lembut dan teks oranye gelap.
- `verified`: Menampilkan label **"Terverifikasi"** dengan warna latar hijau lembut dan ikon centang.
- `rejected`: Menampilkan label **"Ditolak"** dengan warna latar merah muda dan teks merah tua (dapat diklik untuk membuka modal alasan penolakan).

### 4.3 Modal Verifikasi & Penolakan Transfer (`src/components/Modal.jsx`)
- Digunakan oleh Admin untuk memverifikasi bukti struk transfer.
- Menyediakan pratinjau gambar struk transfer secara utuh.
- Menyediakan tombol hijau **[✓ Verifikasi]** dan tombol merah **[✕ Tolak]**.
- Jika admin menekan Tolak, kolom teks `rejection_reason` wajib diisi sebelum perubahan dapat disimpan.
