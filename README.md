# Prototipe Sistem Manajemen Haji & Umroh

Aplikasi berbasis web untuk membantu biro perjalanan mengelola administrasi jamaah secara terpusat: manajemen data jamaah, verifikasi dokumen, pencatatan dan verifikasi pembayaran (penuh/cicilan, transfer/cash), serta jadwal keberangkatan paket ibadah.

---

## 🚀 Ringkasan Teknologi

- **Frontend**: [React.js](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Bahasa**: JavaScript (ESModules)
- **Styling**: Vanilla CSS (Modern Design Tokens, Responsive, Islamic Modern Theme)
- **Backend as a Service (BaaS)**: [Supabase](https://supabase.com/)
  - Database: PostgreSQL
  - Autentikasi: Supabase Auth (Role: `admin` & `jamaah`)
  - Keamanan: Row Level Security (RLS)
  - Penyimpanan File: Supabase Storage (`documents`, `payment-proofs`)
- **Deployment**: [Vercel](https://vercel.com/)

---

## 📁 Struktur Dokumentasi Proyek

Dokumentasi lengkap hasil telaah PRD v2.0 telah disusun rapi di folder [`docs/`](file:///c:/Users/hp/Documents/Prototype%20manajemen%20haji%20&%20umroh/docs):

1. **[01-prd-spesifikasi.md](file:///c:/Users/hp/Documents/Prototype%20manajemen%20haji%20&%20umroh/docs/01-prd-spesifikasi.md)** — Spesifikasi lengkap PRD v2.0 (Latar belakang, ruang lingkup MVP, target pengguna, FR-01 s/d FR-26, dan kriteria penyelesaian).
2. **[02-database-dan-rls.md](file:///c:/Users/hp/Documents/Prototype%20manajemen%20haji%20&%20umroh/docs/02-database-dan-rls.md)** — Skrip DDL SQL PostgreSQL siap eksekusi di Supabase, definisi tabel, view agregasi tagihan, enum, Storage Buckets, dan kebijakan RLS.
3. **[03-aturan-bisnis.md](file:///c:/Users/hp/Documents/Prototype%20manajemen%20haji%20&%20umroh/docs/03-aturan-bisnis.md)** — Logika inti pembayaran (Rule 1–8, Bayar Penuh vs Cicilan, Transfer vs Cash), formula kelengkapan dokumen, dan siklus status jamaah.
4. **[04-desain-dan-navigasi.md](file:///c:/Users/hp/Documents/Prototype%20manajemen%20haji%20&%20umroh/docs/04-desain-dan-navigasi.md)** — Desain navigasi Admin & Jamaah, protected routes, struktur hierarki komponen UI, serta token styling.
5. **[05-rencana-kerja.md](file:///c:/Users/hp/Documents/Prototype%20manajemen%20haji%20&%20umroh/docs/05-rencana-kerja.md)** — Rencana implementasi bertahap (Fase 1 s/d 7) lengkap dengan checklist verifikasi.
6. **[.cursorrules](file:///c:/Users/hp/Documents/Prototype%20manajemen%20haji%20&%20umroh/.cursorrules)** — Pedoman kontekstual untuk AI Coding Assistant (Cursor / Antigravity / Gemini).

---

## 🛠️ Persyaratan Lingkungan (Environment Setup)

### 1. Prasyarat
- Node.js versi 18.x atau lebih baru
- Akun Supabase aktif

### 2. Konfigurasi Environment Variables
Buat file `.env` di root direktori (jangan di-commit ke Git):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Instalasi & Menjalankan Aplikasi
```bash
# Instalasi dependensi
npm install

# Menjalankan dev server lokal
npm run dev

# Build untuk produksi
npm run build
```

---

## 👥 Hak Akses Pengguna

| Fitur Utama | Admin/Petugas | Jamaah |
| :--- | :---: | :---: |
| Login & Dashboard Pribadi | ✅ | ✅ |
| CRUD Data Jamaah | ✅ | ❌ |
| Kelola Dokumen Jamaah | ✅ (Upload & Verifikasi) | ✅ (Upload & Cek Status) |
| Kelola Paket & Jadwal Perjalanan | ✅ | ✅ (Hanya Lihat Jadwal Paketnya) |
| Pengajuan Pembayaran Transfer | ❌ | ✅ (+ Bukti Transfer) |
| Verifikasi / Tolak Transfer | ✅ (+ Alasan Penolakan) | ❌ |
| Pencatatan Pembayaran Cash | ✅ (Langsung Terverifikasi) | ❌ |
| Melihat Riwayat Pembayaran | ✅ (Semua Jamaah) | ✅ (Hanya Milik Sendiri) |

---

## 📌 Aturan Kritis Pembayaran (PRD Rules)
- **Hanya status `verified`** yang masuk ke perhitungan total bayar dan mengurangi sisa tagihan.
- Status `pending` (menunggu verifikasi) dan `rejected` (ditolak) **TIDAK** mengurangi sisa tagihan.
- Pembayaran **Cash** hanya diinput oleh Admin dan langsung berstatus `verified`.
- Pembayaran **Transfer** diinput oleh Jamaah dan wajib melalui proses verifikasi oleh Admin.
