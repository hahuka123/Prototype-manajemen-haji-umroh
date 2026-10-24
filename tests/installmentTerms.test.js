import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTermStatus,
  validatePaymentAgainstTerm,
  validateTermInput,
  mapInstallmentTerm,
  getJakartaCurrentDateStr
} from '../src/services/installmentService.js';

describe('Model Data & Logika Termin Cicilan (Haji & Umrah)', () => {
  const mockTerm = {
    id: 'term-uuid-001',
    jamaah_id: 'jamaah-uuid-001',
    term_number: 1,
    title: 'Uang Muka (DP)',
    target_amount: 10000000,
    amount: 10000000,
    due_date: '2026-11-01',
    verified_amount: 5000000,
    pending_amount: 0,
    remaining_amount: 5000000,
    status: 'unpaid'
  };

  describe('1. Mesin Penentu Status Termin Dinamis', () => {
    it('1.1 Pembayaran terverifikasi memenuhi target: status harus "paid"', () => {
      const status = calculateTermStatus({
        target_amount: 10000000,
        verified_amount: 10000000,
        pending_amount: 0,
        due_date: '2026-11-01',
        currentDateStr: '2026-10-24'
      });
      assert.equal(status, 'paid');
    });

    it('1.2 Pembayaran terverifikasi melebihi target: status harus tetap "paid"', () => {
      const status = calculateTermStatus({
        target_amount: 10000000,
        verified_amount: 12000000,
        pending_amount: 0,
        due_date: '2026-11-01',
        currentDateStr: '2026-10-24'
      });
      assert.equal(status, 'paid');
    });

    it('1.3 Belum lunas dan ada transaksi transfer berstatus pending: status harus "pending"', () => {
      const status = calculateTermStatus({
        target_amount: 10000000,
        verified_amount: 5000000,
        pending_amount: 5000000,
        due_date: '2026-11-01',
        currentDateStr: '2026-10-24'
      });
      assert.equal(status, 'pending');
    });

    it('1.4 Belum lunas, tidak ada pending, dan tanggal melampaui due_date: status harus "overdue"', () => {
      const status = calculateTermStatus({
        target_amount: 10000000,
        verified_amount: 5000000,
        pending_amount: 0,
        due_date: '2026-10-20', // Jatuh tempo sudah lewat
        currentDateStr: '2026-10-24' // Hari ini
      });
      assert.equal(status, 'overdue');
    });

    it('1.5 Belum lunas dan belum jatuh tempo: status harus "unpaid"', () => {
      const status = calculateTermStatus({
        target_amount: 10000000,
        verified_amount: 3000000,
        pending_amount: 0,
        due_date: '2026-11-15',
        currentDateStr: '2026-10-24'
      });
      assert.equal(status, 'unpaid');
    });

    it('1.6 Jatuh tempo lewat tetapi ada bukti transfer pending: status diprioritaskan "pending"', () => {
      // Jamaah sudah transfer sebelum/saat jatuh tempo, admin belum periksa; jangan beri cap overdue yang menyesatkan
      const status = calculateTermStatus({
        target_amount: 10000000,
        verified_amount: 5000000,
        pending_amount: 5000000,
        due_date: '2026-10-20',
        currentDateStr: '2026-10-24'
      });
      assert.equal(status, 'pending');
    });

    it('1.7 Status lunas (paid) tidak terpengaruh jika tanggal sudah lewat', () => {
      const status = calculateTermStatus({
        target_amount: 10000000,
        verified_amount: 10000000,
        pending_amount: 0,
        due_date: '2026-09-01',
        currentDateStr: '2026-10-24'
      });
      assert.equal(status, 'paid');
    });
  });

  describe('2. Validasi Nominal Pembayaran & Anti Over-Alokasi', () => {
    it('2.1 Pembayaran tepat sebesar sisa kewajiban: valid', () => {
      const result = validatePaymentAgainstTerm({
        term: mockTerm, // sisa = 5.000.000
        paymentAmount: 5000000
      });
      assert.equal(result.isValid, true);
      assert.equal(result.error, null);
    });

    it('2.2 Pembayaran sebagian (cicilan bertahap): valid', () => {
      const result = validatePaymentAgainstTerm({
        term: mockTerm, // sisa = 5.000.000
        paymentAmount: 2500000
      });
      assert.equal(result.isValid, true);
      assert.equal(result.error, null);
    });

    it('2.3 Pembayaran melebihi sisa kewajiban termin: ditolak (invalid)', () => {
      const result = validatePaymentAgainstTerm({
        term: mockTerm, // sisa = 5.000.000
        paymentAmount: 6000000
      });
      assert.equal(result.isValid, false);
      assert.match(result.error, /melebihi sisa kewajiban termin/i);
    });

    it('2.4 Nominal pembayaran 0 atau negatif: ditolak', () => {
      const resZero = validatePaymentAgainstTerm({ term: mockTerm, paymentAmount: 0 });
      assert.equal(resZero.isValid, false);

      const resNeg = validatePaymentAgainstTerm({ term: mockTerm, paymentAmount: -500000 });
      assert.equal(resNeg.isValid, false);
    });
  });

  describe('3. Validasi Form Input Termin (Khusus Admin)', () => {
    it('3.1 Data input valid: lolos validasi', () => {
      const validPayload = {
        jamaah_id: 'jamaah-uuid-001',
        term_number: 2,
        title: 'Cicilan Tahap 2',
        amount: 15000000,
        due_date: '2026-12-15'
      };
      const result = validateTermInput(validPayload);
      assert.equal(result.isValid, true);
      assert.equal(result.errors.length, 0);
    });

    it('3.2 Data input dengan nominal <= 0 atau nomor termin <= 0: ditolak', () => {
      const invalidPayload = {
        jamaah_id: 'jamaah-uuid-001',
        term_number: 0,
        title: '',
        amount: -1000,
        due_date: 'invalid-date'
      };
      const result = validateTermInput(invalidPayload);
      assert.equal(result.isValid, false);
      assert.equal(result.errors.length >= 3, true);
    });
  });

  describe('4. Pemetaan Entitas Termin (mapInstallmentTerm)', () => {
    it('4.1 Memetakan field DB ke properti camelCase dan alias bahasa Indonesia', () => {
      const raw = {
        id: 'term-1',
        jamaah_id: 'j-1',
        term_number: 1,
        title: 'Termin DP',
        target_amount: 10000000,
        due_date: '2026-11-01',
        verified_amount: 4000000,
        pending_amount: 0,
        remaining_amount: 6000000,
        status: 'unpaid'
      };
      const mapped = mapInstallmentTerm(raw);

      assert.equal(mapped.nominal_target, 10000000);
      assert.equal(mapped.terbayar_sah, 4000000);
      assert.equal(mapped.sisa_kewajiban, 6000000);
      assert.equal(mapped.nomor_termin, 1);
      assert.equal(mapped.status, 'unpaid');
    });
  });

  describe('5. Penanganan Zona Waktu Jakarta (WIB)', () => {
    it('5.1 Format tanggal Jakarta konsisten YYYY-MM-DD', () => {
      const str = getJakartaCurrentDateStr(new Date('2026-10-24T02:00:00Z'));
      assert.match(str, /^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
