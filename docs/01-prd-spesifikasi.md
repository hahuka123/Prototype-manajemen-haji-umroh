# PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Prototipe Sistem Manajemen Haji & Umrah**  
*Manajemen Jamaah, Dokumen, Pembayaran, dan Jadwal Perjalanan*

- **Versi**: 3.0 (Disusun berdasarkan source code dan dokumen kerja terbaru)
- **Status**: Dokumen kerja untuk perbaikan dan penyelesaian prototype
- **Teknologi**: Antigravity • React + Vite • Supabase • GitHub • Vercel
- **Platform**: Web Application (Responsive Desktop, Tablet, & Mobile)
- **Target Pengguna**: Admin/Petugas Biro Perjalanan dan Jamaah

---

## 1. Ringkasan Produk

Aplikasi Haji dan Umrah adalah aplikasi berbasis web yang dikembangkan untuk membantu biro perjalanan mengelola seluruh administrasi operasional haji dan umroh secara terpusat, transparan, dan terintegrasi.

Sistem ini memfasilitasi 4 proses bisnis inti:
1. **Manajemen Data Jamaah**: Pencatatan data personal, NIK, nomor paspor, kontak, paket yang diikuti, dan siklus status jamaah.
2. **Manajemen Dokumen Jamaah**: Pengunggahan berkas digital (KTP, Paspor, Pas Foto, Buku Nikah, Dokumen Kesehatan), verifikasi berkas, dan perhitungan otomatis persentase kelengkapan berkas.
3. **Manajemen & Verifikasi Pembayaran**: Pemisahan jelas antara jenis pembayaran (*Bayar Penuh* vs *Cicilan*), metode pembayaran (*Transfer* vs *Cash*), serta status verifikasi (*Pending*, *Verified*, *Rejected*).
4. **Manajemen Paket dan Jadwal Perjalanan**: Pengelolaan paket keberangkatan, harga paket, durasi, tanggal perjalanan, dan detail agenda kegiatan harian.

Sistem melayani dua jenis pengguna:
- **Admin/Petugas**: Memiliki kewenangan mengelola data master, memverifikasi dokumen, menyetujui/menolak bukti transfer jamaah, dan mencatat transaksi pembayaran tunai (cash).
- **Jamaah**: Mengakses dashboard personal untuk melihat profil, status kelengkapan dokumen, rincian paket, riwayat transaksi, serta mengajukan pembayaran via transfer bank beserta bukti transfer.

---

## 2. Latar Belakang

Penyelenggaraan ibadah Haji dan Umrah melibatkan administrasi dokumen dan transaksi finansial bertahap yang kompleks. Pengelolaan manual menggunakan media terpisah (seperti spreadsheet, nota kertas, dan chat WhatsApp) menimbulkan kendala kritis:
- Data jamaah sulit ditelusuri dengan cepat.
- Dokumen fisik berisiko hilang, rusak, atau tercecer.
- Status kelengkapan dokumen sulit dipantau secara *real-time*.
- Bukti transfer sering tercecer di riwayat chat pesan instan.
- Pembayaran tunai (cash) rawan selisih atau tidak tercatat konsisten.
- Perhitungan sisa tagihan manual rawan kekeliruan perhitungan (*human error*).
- Informasi agenda perjalanan terpecah dan jamaah harus berulang kali menghubungi admin.

Aplikasi ini mengintegrasikan seluruh tahapan tersebut ke dalam satu sistem berbasis web yang andal dan mudah digunakan.

---

## 3. Rumusan Masalah

Sistem ini dirancang untuk menjawab 14 pertanyaan kunci:
1. Bagaimana mengelola data jamaah secara terpusat?
2. Bagaimana memantau kelengkapan dokumen jamaah?
3. Bagaimana menyimpan dan mengelola dokumen digital jamaah secara aman?
4. Bagaimana mencatat pembayaran jamaah secara sistematis?
5. Bagaimana membedakan pembayaran penuh (*full*) dan pembayaran cicilan (*installment*)?
6. Bagaimana membedakan perlakuan pembayaran transfer bank dan cash?
7. Bagaimana melakukan verifikasi pembayaran transfer berdasarkan bukti pembayaran?
8. Bagaimana mencatat pembayaran cash yang diterima langsung oleh admin?
9. Bagaimana menghitung total pembayaran yang sudah terverifikasi secara akurat?
10. Bagaimana menghitung sisa tagihan jamaah secara *real-time*?
11. Bagaimana mengetahui status pelunasan jamaah?
12. Bagaimana mengelola data paket perjalanan haji/umroh?
13. Bagaimana mengelola jadwal dan agenda kegiatan perjalanan?
14. Bagaimana membatasi akses informasi antara admin dan jamaah sesuai perannya?

---

## 4. Tujuan Produk

### 4.1 Tujuan Utama
Mendukung pengelolaan data jamaah, pemantauan dokumen, administrasi pembayaran, dan agenda perjalanan ibadah secara terpadu melalui aplikasi web modern.

### 4.2 Tujuan Khusus
- Memusatkan seluruh data jamaah dan dokumen pendukung dalam penyimpanan digital terorganisir.
- Mencegah kesalahan perhitungan sisa tagihan melalui validasi sistem terotomasi.
- Memisahkan alur transfer (wajib verifikasi) dan cash (langsung sah).
- Menyediakan dashboard transparansi finansial bagi jamaah secara mandiri.
- Mengurangi beban pencatatan administratif manual bagi staf biro travel.

---

## 5. Peran Pengguna & Matriks Hak Akses

### 5.1 Admin / Petugas
- Melakukan CRUD (Create, Read, Update, Delete) data jamaah, paket, dan jadwal.
- Memeriksa, memvalidasi, atau menolak berkas dokumen jamaah beserta catatannya.
- Memeriksa pembayaran transfer yang berstatus *Menunggu Verifikasi* (`pending`), melakukan verifikasi (`verified`), atau menolak (`rejected`) dengan menyertakan alasan penolakan.
- Mencatat pembayaran tunai (*Cash*) yang diterima langsung; transaksi langsung berstatus *Terverifikasi* (`verified`).
- Memantau ringkasan statistik operasional melalui Dashboard Admin.

### 5.2 Jamaah
- Login ke sistem dan mengakses dashboard pribadi.
- Melihat profil pribadi, status paket perjalanan, dan jadwal kegiatan ibadah.
- Memantau status kelengkapan dokumen dan mengunggah berkas jika diaktifkan.
- Melihat rincian tagihan: Harga Paket, Total Terbayar Terverifikasi, dan Sisa Tagihan.
- Mengajukan pembayaran transfer bank dengan memilih jenis pembayaran (*Bayar Penuh* atau *Cicilan*), mengisi nomor referensi, dan mengunggah bukti transfer.
- Melihat status verifikasi pembayaran dan alasan penolakan (jika ada).
- **Pembatasan Jamaah**: Jamaah tidak dapat melihat data jamaah lain, tidak dapat mencatat cash sendiri, dan tidak dapat mengubah status pembayaran.

### 5.3 Matriks Hak Akses Fitur

| Fitur / Tindakan | Admin | Jamaah |
| :--- | :---: | :---: |
| Autentikasi / Login | ✅ | ✅ |
| Akses Dashboard | ✅ (Semua data) | ✅ (Data pribadi) |
| Lihat Daftar Seluruh Jamaah | ✅ | ❌ |
| Tambah / Edit / Hapus Jamaah | ✅ | ❌ |
| Lihat Profil Pribadi | ✅ | ✅ |
| Lihat Dokumen | ✅ (Seluruh jamaah) | ✅ (Dokumen sendiri) |
| Unggah Dokumen | ✅ | ✅ |
| Verifikasi / Tolak Dokumen | ✅ | ❌ |
| Lihat Semua Transaksi Pembayaran | ✅ | ❌ |
| Lihat Transaksi Sendiri | ✅ | ✅ |
| Ajukan Pembayaran Transfer | ❌ | ✅ |
| Pilih Jenis Pembayaran (Full / Cicilan) | ❌ | ✅ |
| Unggah Bukti Transfer | ❌ | ✅ |
| Verifikasi Pembayaran Transfer | ✅ | ❌ |
| Tolak Pembayaran Transfer (+ Catatan Alasan) | ✅ | ❌ |
| Catat Pembayaran Cash (Otomatis Verified) | ✅ | ❌ |
| Kelola Paket & Jadwal Perjalanan | ✅ | ❌ |
| Lihat Jadwal Perjalanan Paket | ✅ | ✅ (Paket yang diikuti) |

---

## 6. Batasan Teknologi & Arsitektur

| Komponen | Pilihan Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Code Editor** | Cursor / Antigravity | AI-assisted development |
| **Frontend** | React.js + Vite | Single Page Application (SPA), JavaScript modern |
| **Styling** | Vanilla CSS | Custom design tokens, responsif, tanpa library CSS eksternal berat |
| **BaaS Platform** | Supabase | Penyedia layanan backend terpadu tanpa server terpisah |
| **Database** | PostgreSQL | Penyimpanan relasional terstruktur |
| **Autentikasi** | Supabase Auth | Otentikasi sesi & manajemen role berbasis token JWT |
| **Penyimpanan File** | Supabase Storage | Bucket untuk berkas dokumen dan bukti transfer |
| **Keamanan Data** | Row Level Security (RLS) | Pembatasan hak akses langsung di level tabel database |
| **Hosting & Deploy** | Vercel | Deployment otomatis dari GitHub repository |

**Arsitektur Sistem**:
```text
┌─────────────────┐       HTTPS       ┌─────────────────────────────────────┐
│                 │ ◄───────────────► │               Vercel                │
│  Browser User   │                   │        (Hosting Frontend React)     │
│ (Admin/Jamaah)  │                   └──────────────────┬──────────────────┘
│                 │                                      │
│                 │       REST / WebSockets (Direct SDK) │
│                 │ ◄────────────────────────────────────┘
└────────┬────────┘
         │
         ▼ Direct Client Connection via Supabase JS SDK
┌───────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE BaaS                                │
│                                                                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐  │
│  │  Supabase Auth   │  │ PostgreSQL DB    │  │ Supabase Storage        │  │
│  │  (JWT Sessions)  │  │ (RLS, Views, Trg)│  │ (Buckets: docs, proofs) │  │
│  └──────────────────┘  └──────────────────┘  └─────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```
*Catatan MVP: Tidak menggunakan backend server terpisah (Express/NestJS).*

---

## 7. Batasan Ruang Lingkup (Scope)

### 7.1 Scope MVP (Fase 1)
1. Autentikasi Pengguna & Pembagian Role (Admin vs Jamaah).
2. Dashboard Admin dengan ringkasan metrik statistik.
3. Dashboard Jamaah dengan informasi tagihan dan progres dokumen.
4. Manajemen Data Jamaah (CRUD lengkap + filter status).
5. Manajemen Dokumen (upload, review status, persentase kelengkapan).
6. Manajemen Paket Ibadah & Manajemen Jadwal Kegiatan.
7. Modul Pembayaran Lengkap:
   - Pengajuan Transfer oleh Jamaah (+ upload bukti).
   - Verifikasi / Penolakan Transfer oleh Admin.
   - Pencatatan Pembayaran Cash oleh Admin.
   - Kalkulasi otomatis total bayar sah dan sisa tagihan.
8. Penyimpanan file berkas di Supabase Storage.
9. Penerapan Row Level Security (RLS) di seluruh tabel.
10. Deployment aplikasi ke platform Vercel.

### 7.2 Fitur yang DITUNDA / Di Luar Scope MVP
- Payment gateway otomatis (Midtrans, Xendit, dll.).
- Integrasi mutasi bank otomatis.
- Verifikasi bukti transfer dengan OCR / AI otomatis.
- Pemesanan tiket penerbangan dan kamar hotel langsung.
- GPS live tracking jamaah di Arab Saudi.
- Notifikasi WhatsApp Gateway / SMS otomatis.
- AI Chatbot layanan pelanggan.
- Integrasi sistem Kementerian Agama (Siskopatuh).
- Presensi jamaah dengan barcode/RFID.

### 7.3 Rencana Pengembangan Lanjutan (Future Roadmap)
- **Versi 2.0**: Cetak kwitansi pembayaran format PDF, ekspor data jamaah ke Excel/CSV, notifikasi email pengingat tagihan dan dokumen.
- **Versi 3.0**: Payment gateway terintegrasi, manajemen muthawwif/pembimbing, manajemen hotel, dan aplikasi mobile (PWA/React Native).

---

## 8. Persyaratan Fungsional (Functional Requirements)

| ID | Requirement | Prioritas |
| :--- | :--- | :---: |
| **FR-01** | Pengguna dapat melakukan login menggunakan email & password | High |
| **FR-02** | Sistem dapat mengenali dan memisahkan hak akses Admin dan Jamaah | High |
| **FR-03** | Admin dapat memantau ringkasan metrik pada Dashboard Admin | High |
| **FR-04** | Admin dapat melakukan CRUD pada data jamaah | High |
| **FR-05** | Admin dapat melakukan pencarian dan filter data jamaah | High |
| **FR-06** | Admin dapat mengelola, melihat, dan memperbarui status dokumen jamaah | High |
| **FR-07** | Sistem dapat mengkalkulasi persentase kelengkapan berkas jamaah secara otomatis | High |
| **FR-08** | Jamaah dapat mengajukan pembayaran via transfer bank | High |
| **FR-09** | Jamaah dapat memilih opsi Bayar Penuh atau Pembayaran Cicilan | High |
| **FR-10** | Sistem memvalidasi nominal pembayaran agar tidak melebihi sisa tagihan | High |
| **FR-11** | Jamaah dapat mengunggah bukti struk transfer (gambar) | High |
| **FR-12** | Admin dapat meninjau antrean pembayaran berstatus pending (*Menunggu Verifikasi*) | High |
| **FR-13** | Admin dapat memverifikasi pembayaran transfer yang sah | High |
| **FR-14** | Admin dapat menolak bukti transfer yang tidak valid/salah | High |
| **FR-15** | Admin wajib menyertakan alasan ketika menolak pembayaran transfer | High |
| **FR-16** | Admin dapat mencatat transaksi tunai (*Cash*) yang diterima langsung dari jamaah | High |
| **FR-17** | Pembayaran cash yang dicatat admin langsung berstatus sah (*Verified*) tanpa verifikasi | High |
| **FR-18** | Sistem HANYA memperhitungkan transaksi dengan status `verified` dalam kalkulasi saldo | High |
| **FR-19** | Sistem mengakumulasi total pembayaran yang sah dari masing-masing jamaah | High |
| **FR-20** | Sistem menghitung sisa tagihan paket jamaah secara dinamis | High |
| **FR-21** | Sistem menentukan status pelunasan (*Belum Bayar*, *Cicilan*, *Lunas*) secara otomatis | High |
| **FR-22** | Jamaah dapat meninjau seluruh riwayat transaksi pembayarannya sendiri | High |
| **FR-23** | Admin dapat melakukan CRUD pada data paket ibadah haji/umroh | High |
| **FR-24** | Admin dapat melakukan CRUD pada jadwal agenda kegiatan perjalanan | High |
| **FR-25** | Jamaah dapat melihat rincian paket dan jadwal kegiatan dari paket yang diikutinya | High |
| **FR-26** | Database mengimplementasikan kebijakan Row Level Security (RLS) di semua entitas | High |

---

## 9. Persyaratan Non-Fungsional (Non-Functional Requirements)

1. **Usability**:
   - Tampilan bersih, intuitif, dan menggunakan Bahasa Indonesia baku.
   - Responsif di perangkat desktop, tablet, maupun layar smartphone.
   - Status pembayaran dan dokumen ditampilkan dengan badge warna yang kontras dan jelas.
2. **Performance**:
   - Waktu respons pemuatan halaman awal di bawah 2 detik pada koneksi internet standar.
   - Pembatasan ukuran file berkas upload maksimal 5 MB per berkas dengan validasi tipe mime (PDF, JPG, PNG).
3. **Security**:
   - Autentikasi sesi berbasis JWT melalui Supabase Auth.
   - Row Level Security (RLS) aktif pada semua tabel data publik.
   - Berkas storage tersimpan dalam bucket terisolasi dan hanya bisa diakses pihak berwenang.
   - Jamaah tidak memiliki hak memodifikasi status pembayaran secara langsung.
   - Kredensial rahasia disimpan dalam `.env` dan tidak pernah di-commit ke Git.
4. **Availability**:
   - Aplikasi dapat diakses secara daring 24/7 melalui infrastruktur Vercel CDN dan Supabase Cloud.

---

## 10. Kriteria Keberhasilan & Definition of Done (DoD)

Proyek prototipe ini dinyatakan sukses dan selesai apabila:
1. Alur autentikasi dan otorisasi role berjalan lancar tanpa kebocoran hak akses.
2. Seluruh 26 Functional Requirements (FR-01 s/d FR-26) telah terimplementasi dan lolos uji coba.
3. Alur pembayaran transfer (upload bukti $\rightarrow$ review admin $\rightarrow$ approve/reject) bekerja mulus.
4. Alur pembayaran cash oleh admin langsung tercatat sebagai sah dan langsung mengurangi tagihan.
5. Status sisa tagihan dan status pelunasan terhitung tepat sesuai rumus.
6. Berkas dokumen dan struk transfer tersimpan dengan benar di Supabase Storage.
7. Aplikasi berhasil di-deploy di Vercel dan dapat dioperasikan secara online tanpa error fatal (*zero critical console errors*).
