import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paymentService } from '../src/services/paymentService.js';
import { calculateTermStatus } from '../src/services/installmentService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATION_PATH = path.resolve(__dirname, '../supabase/migrations/20261101120000_create_payment_term_integrity_trigger.sql');

describe('ML Stage 2.5 — Final Fix Validasi Alokasi Pembayaran', () => {

  // Simulasi mesin validasi trigger SQL secara deterministik murni
  function simulatePaymentIntegrityCheck({
    term,
    payment,
    existingPayments = [],
    operation = 'INSERT'
  }) {
    // 1. Kompatibilitas penuh: jika installment_term_id IS NULL, loloskan langsung
    if (!payment.installment_term_id) {
      return { allowed: true, error: null };
    }

    // 2. Validasi Jenis Pembayaran: full tidak boleh mengikat termin
    if (payment.payment_type === 'full') {
      return { allowed: false, error: 'Pembayaran penuh (full) tidak boleh dialokasikan ke termin cicilan tertentu.' };
    }

    // 3. Validasi Nominal Pembayaran: wajib positif dan tidak boleh NULL
    if (payment.amount === null || payment.amount === undefined || Number(payment.amount) <= 0) {
      return { allowed: false, error: 'Nominal pembayaran tidak valid: Nilai harus lebih besar dari Rp 0.' };
    }

    // 4. Validasi Status Pembayaran: menolak NULL dan memastikan ENUM resmi
    const validStatuses = ['pending', 'verified', 'rejected'];
    if (!payment.status || !validStatuses.includes(payment.status)) {
      return { allowed: false, error: 'Status pembayaran tidak valid: status tidak boleh NULL dan harus berupa pending, verified, atau rejected.' };
    }

    // 5. Kunci baris termin
    if (!term) {
      return { allowed: false, error: 'Termin cicilan tidak ditemukan.' };
    }

    const targetAmount = Number(term.target_amount ?? term.amount ?? 0);
    if (targetAmount <= 0) {
      return { allowed: false, error: 'Target nominal termin tidak valid: Target harus lebih besar dari Rp 0.' };
    }

    // 6. Validasi kepemilikan jamaah: Menolak NULL dan memeriksa IS DISTINCT FROM
    if (!payment.jamaah_id || payment.jamaah_id !== term.jamaah_id) {
      return { allowed: false, error: 'Akses ditolak: Termin cicilan tidak sesuai dengan identitas jamaah.' };
    }

    // 7. Jika status rejected, langsung loloskan
    if (payment.status === 'rejected') {
      return { allowed: true, error: null };
    }

    // 8. Hitung existing verified & pending tanpa menghitung record sendiri saat UPDATE
    const otherPayments = existingPayments.filter(p => operation === 'INSERT' || p.id !== payment.id);
    const existingVerified = otherPayments
      .filter(p => p.status === 'verified')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const existingPending = otherPayments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // 9. Evaluasi kuota: Baik status verified maupun pending memperhitungkan komitmen (verified + pending lain + NEW.amount)
    if (payment.status === 'verified') {
      if ((existingVerified + existingPending + Number(payment.amount || 0)) > targetAmount) {
        return {
          allowed: false,
          error: 'Pembayaran terverifikasi melebihi target termin.'
        };
      }
    } else if (payment.status === 'pending') {
      if ((existingVerified + existingPending + Number(payment.amount || 0)) > targetAmount) {
        return {
          allowed: false,
          error: 'Pengajuan pembayaran melebihi target termin.'
        };
      }
    }

    return { allowed: true, error: null };
  }

  const mockTerm1Juta = {
    id: 'term-uuid-1m',
    jamaah_id: 'jamaah-uuid-001',
    term_number: 1,
    title: 'Cicilan Termin 1',
    amount: 1000000,
    target_amount: 1000000
  };

  const mockTermJamaahA = {
    id: 'term-uuid-a1',
    jamaah_id: 'jamaah-uuid-001',
    term_number: 1,
    title: 'Cicilan DP Tahap 1',
    amount: 10000000,
    target_amount: 10000000
  };

  const mockTermJamaahB = {
    id: 'term-uuid-b1',
    jamaah_id: 'jamaah-uuid-999',
    term_number: 1,
    title: 'Cicilan DP Tahap 1 (Jamaah B)',
    amount: 10000000,
    target_amount: 10000000
  };

  describe('1. Skenario Matriks Uji Inti & Alokasi Pembayaran (Stage 2.5)', () => {
    it('1.1 Target 1jt: A pending 600rb, B akan diverifikasi 500rb -> Ditolak (total alokasi 1.1jt > 1jt)', () => {
      const existing = [
        { id: 'pay-a', amount: 600000, status: 'pending' }
      ];
      const res = simulatePaymentIntegrityCheck({
        term: mockTerm1Juta,
        payment: {
          id: 'pay-b',
          jamaah_id: 'jamaah-uuid-001',
          installment_term_id: 'term-uuid-1m',
          amount: 500000,
          payment_type: 'installment',
          status: 'verified'
        },
        existingPayments: existing,
        operation: 'INSERT'
      });
      assert.equal(res.allowed, false);
      assert.match(res.error, /Pembayaran terverifikasi melebihi target termin/i);
    });

    it('1.2 Target 1jt: Pending 400rb & verified 300rb, kemudian baru diverifikasi 300rb -> Berhasil (total tepat 1jt)', () => {
      const existing = [
        { id: 'pay-pending-1', amount: 400000, status: 'pending' },
        { id: 'pay-verified-1', amount: 300000, status: 'verified' }
      ];
      const res = simulatePaymentIntegrityCheck({
        term: mockTerm1Juta,
        payment: {
          id: 'pay-new-verified',
          jamaah_id: 'jamaah-uuid-001',
          installment_term_id: 'term-uuid-1m',
          amount: 300000,
          payment_type: 'installment',
          status: 'verified'
        },
        existingPayments: existing,
        operation: 'INSERT'
      });
      assert.equal(res.allowed, true);
      assert.equal(res.error, null);
    });

    it('1.3 Target 1jt: Pending 400rb & verified 300rb, kemudian baru diverifikasi 301rb -> Ditolak (total 1.001.000 > 1jt)', () => {
      const existing = [
        { id: 'pay-pending-1', amount: 400000, status: 'pending' },
        { id: 'pay-verified-1', amount: 300000, status: 'verified' }
      ];
      const res = simulatePaymentIntegrityCheck({
        term: mockTerm1Juta,
        payment: {
          id: 'pay-new-verified',
          jamaah_id: 'jamaah-uuid-001',
          installment_term_id: 'term-uuid-1m',
          amount: 301000,
          payment_type: 'installment',
          status: 'verified'
        },
        existingPayments: existing,
        operation: 'INSERT'
      });
      assert.equal(res.allowed, false);
      assert.match(res.error, /Pembayaran terverifikasi melebihi target termin/i);
    });

    it('1.4 Pending yang sedang diubah menjadi verified TIDAK dihitung dua kali', () => {
      // Pending 400rb dan verified 300rb. Pending 400rb tersebut diubah menjadi verified.
      const existing = [
        { id: 'pay-to-verify', amount: 400000, status: 'pending' },
        { id: 'pay-verified-1', amount: 300000, status: 'verified' }
      ];
      const res = simulatePaymentIntegrityCheck({
        term: mockTerm1Juta,
        payment: {
          id: 'pay-to-verify',
          jamaah_id: 'jamaah-uuid-001',
          installment_term_id: 'term-uuid-1m',
          amount: 400000,
          payment_type: 'installment',
          status: 'verified'
        },
        existingPayments: existing,
        operation: 'UPDATE'
      });
      // Karena id pay-to-verify dikecualikan dari otherPayments,
      // existingPending = 0, existingVerified = 300rb, NEW.amount = 400rb -> total 700rb <= 1jt -> Lolos!
      assert.equal(res.allowed, true);
      assert.equal(res.error, null);
    });

    it('1.5 status NULL ditolak secara eksplisit', () => {
      const res = simulatePaymentIntegrityCheck({
        term: mockTermJamaahA,
        payment: {
          jamaah_id: 'jamaah-uuid-001',
          installment_term_id: 'term-uuid-a1',
          amount: 5000000,
          payment_type: 'installment',
          status: null
        }
      });
      assert.equal(res.allowed, false);
      assert.match(res.error, /status tidak boleh NULL/i);
    });

    it('1.6 jamaah_id NULL ditolak secara eksplisit', () => {
      const res = simulatePaymentIntegrityCheck({
        term: mockTermJamaahA,
        payment: {
          jamaah_id: null,
          installment_term_id: 'term-uuid-a1',
          amount: 5000000,
          payment_type: 'installment',
          status: 'pending'
        }
      });
      assert.equal(res.allowed, false);
      assert.match(res.error, /tidak sesuai dengan identitas jamaah/i);
    });

    it('1.7 Termin milik jamaah lain (Cross-Jamaah) tetap ditolak via IS DISTINCT FROM', () => {
      const res = simulatePaymentIntegrityCheck({
        term: mockTermJamaahB, // Milik Jamaah B
        payment: {
          jamaah_id: 'jamaah-uuid-001', // Pembayar adalah Jamaah A
          installment_term_id: 'term-uuid-b1',
          amount: 5000000,
          payment_type: 'installment',
          status: 'pending'
        },
        existingPayments: []
      });
      assert.equal(res.allowed, false);
      assert.match(res.error, /tidak sesuai dengan identitas jamaah/i);
    });

    it('1.8 Nominal nol, negatif, dan NULL ditolak', () => {
      const resZero = simulatePaymentIntegrityCheck({
        term: mockTermJamaahA,
        payment: {
          jamaah_id: 'jamaah-uuid-001',
          installment_term_id: 'term-uuid-a1',
          amount: 0,
          payment_type: 'installment',
          status: 'pending'
        }
      });
      assert.equal(resZero.allowed, false);
      assert.match(resZero.error, /lebih besar dari Rp 0/i);

      const resNegative = simulatePaymentIntegrityCheck({
        term: mockTermJamaahA,
        payment: {
          jamaah_id: 'jamaah-uuid-001',
          installment_term_id: 'term-uuid-a1',
          amount: -500000,
          payment_type: 'installment',
          status: 'pending'
        }
      });
      assert.equal(resNegative.allowed, false);
      assert.match(resNegative.error, /lebih besar dari Rp 0/i);

      const resNull = simulatePaymentIntegrityCheck({
        term: mockTermJamaahA,
        payment: {
          jamaah_id: 'jamaah-uuid-001',
          installment_term_id: 'term-uuid-a1',
          amount: null,
          payment_type: 'installment',
          status: 'pending'
        }
      });
      assert.equal(resNull.allowed, false);
      assert.match(resNull.error, /lebih besar dari Rp 0/i);
    });

    it('1.9 Pending menjadi rejected melepaskan alokasi pending', () => {
      const res = simulatePaymentIntegrityCheck({
        term: mockTermJamaahA,
        payment: {
          id: 'pay-pending-1',
          jamaah_id: 'jamaah-uuid-001',
          installment_term_id: 'term-uuid-a1',
          amount: 5000000,
          payment_type: 'installment',
          status: 'rejected'
        },
        existingPayments: [{ id: 'pay-pending-1', amount: 5000000, status: 'pending' }],
        operation: 'UPDATE'
      });
      assert.equal(res.allowed, true);
      assert.equal(res.error, null);
    });

    it('1.10 Pembayaran penuh (full) tetap menggunakan installment_term_id = NULL', () => {
      const res = simulatePaymentIntegrityCheck({
        term: null,
        payment: {
          jamaah_id: 'jamaah-uuid-001',
          installment_term_id: null,
          amount: 35000000,
          payment_type: 'full',
          status: 'pending'
        },
        existingPayments: []
      });
      assert.equal(res.allowed, true);
      assert.equal(res.error, null);
    });

    it('1.11 Transaksi legacy tanpa termin tetap kompatibel (installment_term_id = NULL)', () => {
      const res = simulatePaymentIntegrityCheck({
        term: null,
        payment: {
          jamaah_id: 'legacy-jamaah-123',
          installment_term_id: null,
          amount: 15000000,
          payment_type: 'installment',
          status: 'verified'
        },
        existingPayments: []
      });
      assert.equal(res.allowed, true);
      assert.equal(res.error, null);
    });

    it('1.12 Mode demo: submitTransfer dan submitCash mempertahankan data installment_term_id', async () => {
      const demoTransfer = await paymentService.submitTransfer({
        jamaah_id: 'demo-jamaah-uuid-001',
        installment_term_id: 'demo-term-1',
        nominal: 5000000,
        jenis: 'installment',
        bank_asal: 'Bank BSI',
        no_referensi: 'DEMO-REF-001'
      });

      assert.equal(demoTransfer.jamaah_id, 'demo-jamaah-uuid-001');
      assert.equal(demoTransfer.installment_term_id, 'demo-term-1');
      assert.equal(demoTransfer.status, 'pending');
      assert.equal(demoTransfer.nominal, 5000000);
    });
  });

  describe('2. Uji Statis Integritas Skrip Migrasi SQL (Tahap 2.5 Hardening)', () => {
    let sqlContent = '';

    it('2.1 Berkas migrasi trigger 20261101120000 tersedia di direktori lokal', () => {
      assert.ok(fs.existsSync(MIGRATION_PATH), 'File migrasi SQL tidak ditemukan di ' + MIGRATION_PATH);
      sqlContent = fs.readFileSync(MIGRATION_PATH, 'utf8');
      assert.ok(sqlContent.length > 0, 'File migrasi SQL kosong.');
    });

    it('2.2 Bagian IF NEW.status = "verified" memperhitungkan v_existing_verified + v_existing_pending + NEW.amount > v_target_amount', () => {
      // Memastikan kondisi verified memperhitungkan v_existing_pending
      assert.match(sqlContent, /IF\s+NEW\.status\s*=\s*'verified'\s+THEN[\s\S]+?IF\s*\(v_existing_verified\s*\+\s*v_existing_pending\s*\+\s*NEW\.amount\)\s*>\s*v_target_amount\s+THEN/i);
    });

    it('2.3 Perhitungan v_available_quota mengurangi total verified dan pending yang sudah ada', () => {
      assert.match(sqlContent, /v_available_quota\s*:=\s*pg_catalog\.GREATEST\(0,\s*v_target_amount\s*-\s*\(v_existing_verified\s*\+\s*v_existing_pending\)\);/i);
    });

    it('2.4 Menggunakan klausa SELECT ... FOR UPDATE untuk mengunci baris termin secara atomik', () => {
      assert.match(sqlContent, /SELECT\s+t\.jamaah_id,\s*t\.amount\s+INTO[\s\S]+?FROM\s+public\.installment_terms\s+t[\s\S]+?FOR\s+UPDATE/i);
    });

    it('2.5 Memuat isolasi search_path kosong (SET search_path = \'\')', () => {
      assert.match(sqlContent, /SECURITY\s+DEFINER/i);
      assert.match(sqlContent, /SET\s+search_path\s*=\s*''/i);
    });

    it('2.6 Seluruh fungsi bawaan dikualifikasikan secara eksplisit dengan pg_catalog', () => {
      assert.match(sqlContent, /pg_catalog\.COALESCE/i);
      assert.match(sqlContent, /pg_catalog\.SUM/i);
      assert.match(sqlContent, /pg_catalog\.GREATEST/i);
      assert.match(sqlContent, /pg_catalog\.to_char/i);
    });

    it('2.7 Validasi status menolak NULL secara eksplisit', () => {
      assert.match(sqlContent, /IF\s+NEW\.status\s+IS\s+NULL\s+OR\s+NEW\.status\s+NOT\s+IN/i);
    });

    it('2.8 Validasi kepemilikan jamaah menggunakan IS DISTINCT FROM dan menolak NULL', () => {
      assert.match(sqlContent, /IF\s+NEW\.jamaah_id\s+IS\s+NULL\s+OR\s+NEW\.jamaah_id\s+IS\s+DISTINCT\s+FROM\s+v_term_jamaah_id\s+THEN/i);
    });

    it('2.9 Mengecualikan baris transaksi sendiri saat UPDATE (TG_OP = "INSERT" OR p.id != NEW.id)', () => {
      assert.match(sqlContent, /TG_OP\s*=\s*'INSERT'\s+OR\s+p\.id\s*!=\s*NEW\.id/i);
    });

    it('2.10 Melepaskan konsumsi kuota termin saat status transaksi rejected', () => {
      assert.match(sqlContent, /IF\s+NEW\.status\s*=\s*'rejected'\s+THEN\s+RETURN\s+NEW;/i);
    });

    it('2.11 Membatasi hak akses eksekusi fungsi (REVOKE PUBLIC, anon, authenticated) tanpa grant berlebih', () => {
      assert.match(sqlContent, /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.validate_payment_term_integrity\(\)\s+FROM\s+PUBLIC;/i);
      assert.match(sqlContent, /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.validate_payment_term_integrity\(\)\s+FROM\s+anon;/i);
      assert.match(sqlContent, /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.validate_payment_term_integrity\(\)\s+FROM\s+authenticated;/i);
      assert.doesNotMatch(sqlContent, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.validate_payment_term_integrity\(\)\s+TO\s+authenticated/i);
    });
  });
});
