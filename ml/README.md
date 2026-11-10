# ML Pipeline — Persiapan Dataset Prediksi Keterlambatan Cicilan

Direktori ini memuat modul Python untuk memproses data ekspor dari database Supabase Staging menjadi dataset siap latih untuk model Machine Learning (Baseline: Logistic Regression).

## 1. Aturan Pelabelan Supervised Learning (Target: `late`)

Unit analisis adalah **1 baris per 1 termin cicilan (`installment_terms`)**.

| Nilai Target | Definisi & Kriteria |
|---|---|
| **`0` (Tepat Waktu)** | Akumulasi pembayaran `verified` $\ge$ target nominal termin, dan tanggal pembayaran yang menyelesaikan termin $\le$ `due_date`. |
| **`1` (Terlambat Lunas)** | Akumulasi pembayaran `verified` $\ge$ target nominal termin, namun tanggal pembayaran penyelesaian termin $>$ `due_date`. |
| **`1` (Terlambat Menunggak)** | Hari ini $>$ `due_date`, termin belum lunas, dan tidak ada pembayaran berstatus `pending`. |
| **`EXCLUDED`** *(Dikecualikan)* | a. Data uji teknis staging (UUID `c0000000-...`, `d0000000-...`, atau paket uji staging).<br>b. Belum jatuh tempo dan belum lunas (termin masih berjalan).<br>c. Melewati jatuh tempo namun masih ada pembayaran `pending` (status ambigu).<br>d. Pembayaran `rejected` diabaikan.<br>e. Pembayaran tanpa `installment_term_id` (pembayaran full / legacy) dieksklusi. |

## 2. Struktur Kolom Dataset Akhir (100% Bebas PII & Anti-Leakage)

Dataset akhir hanya memuat metadata waktu non-PII dan fitur terstruktur non-identitas pribadi:

1. `term_id_hash`: Hash deterministik 12-karakter dari ID termin (anonim).
2. `due_date`: Tanggal jatuh tempo termin (format ISO `YYYY-MM-DD`), disimpan sebagai **metadata non-PII** untuk memfasilitasi pembagian data latih/uji berbasis waktu (*Temporal Train-Test Split*).
3. `term_number`: Nomor urut termin cicilan (1, 2, 3..).
4. `term_amount`: Target nominal kewajiban termin.
5. `package_price`: Total harga paket haji/umrah.
6. `term_amount_ratio`: Rasio target termin terhadap total harga paket.
7. `package_duration`: Durasi perjalanan (hari).
8. `days_due_to_departure`: Selisih hari antara jatuh tempo termin dan tanggal keberangkatan.
9. `jamaah_age`: Usia jamaah saat jatuh tempo termin.
10. `gender_encoded`: Jenis kelamin (1 = Laki-laki, 0 = Perempuan).
11. `prev_terms_count`: Jumlah termin jamaah ini yang sudah selesai sebelum termin ini.
12. `prev_late_count`: Jumlah termin jamaah ini sebelumnya yang terlambat (`late = 1`).
13. `prev_late_ratio`: Rasio keterlambatan termin-termin masa lalu jamaah.
14. `late` *(TARGET)*: `0` (Tepat waktu) atau `1` (Terlambat).

Seluruh data pribadi (PII) seperti `nik`, `nama`, `nomor paspor`, `telepon`, `alamat`, `bukti transfer`, dan `catatan` otomatis dibuang oleh pipeline.

## 3. Fitur Keamanan & Validasi Dataset

- **Proteksi Duplikasi Termin**: Memeriksa `term_id` unik pada data input. Jika ditemukan duplikasi, sistem mencatat dan menghentikan proses via validasi eksplisit guna mencegah distorsi sampel.
- **Penyaringan Data Uji Teknis Staging**: Secara cerdas menyaring data dummy uji konkurensi/trigger staging (UUID berawalan `c0000000-`, `d0000000-`, alamat dummy uji) tanpa mengganggu paket atau jamaah operasional yang sah.
- **Isolasi Anti Data Leakage**: Informasi pembayaran termin target yang terjadi setelah tanggal prediksi tidak pernah digunakan sebagai fitur input.

## 4. Cara Penggunaan

### Langkah A: Ekspor Data CSV dari Supabase Staging
Ekspor 4 tabel berikut dari Supabase Dashboard (Table Editor -> Export to CSV atau via SQL Editor):
1. `public.installment_terms` simpan sebagai `ml/data/raw/installment_terms.csv`
2. `public.payments` simpan sebagai `ml/data/raw/payments.csv`
3. `public.packages` simpan sebagai `ml/data/raw/packages.csv`
4. `public.jamaah` simpan sebagai `ml/data/raw/jamaah.csv`

### Langkah B: Jalankan Pipeline
```bash
python ml/run_pipeline.py
```

Skrip akan menghasilkan file CSV anonim di:
`ml/data/dataset_installment_risk_anonymous.csv`

## 5. Menjalankan Unit Test
Untuk menjalankan pengujian logika pelabelan, fitur, filter uji teknis, dan audit anti-PII:
```bash
python -m unittest discover -s ml/tests -p "test_*.py"
```
