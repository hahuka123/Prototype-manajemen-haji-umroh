import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isDueReminderEligible,
  generateReminderNotificationPayload,
  getDaysDifference,
  notificationService,
  verifyReminderAuthorizationContext,
  buildReminderExecutionSummary
} from '../src/services/notificationService.js';
import { getJakartaCurrentDateStr } from '../src/services/installmentService.js';

describe('Uji Logika Pengingat Termin Cicilan & Scheduler (Tahap 5 & 5.2)', () => {
  const baseTerm = {
    id: 'term-scheduler-001',
    jamaah_id: 'jamaah-scheduler-001',
    term_number: 1,
    title: 'Cicilan Tahap 1',
    target_amount: 10000000,
    amount: 10000000,
    due_date: '2026-11-10',
    verified_amount: 0,
    pending_amount: 0,
    remaining_amount: 10000000
  };

  const sampleProfileId = 'profile-scheduler-001';

  describe('1. Uji Batas Tanggal H-7 (Tepat 7 Hari Kalender)', () => {
    it('1.1 Tepat H-7 menghasilkan kelayakan dan payload due_h7', () => {
      // due_date: 2026-11-10, H-7 adalah 2026-11-03
      const currentDate = '2026-11-03';
      const daysDiff = getDaysDifference(baseTerm.due_date, currentDate);
      assert.equal(daysDiff, 7);

      const isEligible = isDueReminderEligible({
        term: baseTerm,
        type: 'due_h7',
        currentDateStr: currentDate
      });
      assert.equal(isEligible, true);

      const payload = generateReminderNotificationPayload({
        term: baseTerm,
        type: 'due_h7',
        currentDateStr: currentDate,
        jamaahProfileId: sampleProfileId
      });
      assert.ok(payload);
      assert.equal(payload.type, 'due_h7');
      assert.equal(payload.dedup_key, 'due_h7_term-scheduler-001_2026-11-10');
      assert.match(payload.title, /H-7/);
      assert.match(payload.message, /Rp 10\.000\.000/);
    });

    it('1.2 Batas luar H-7 (H-8 dan H-6) ditolak', () => {
      // H-8: 2026-11-02
      assert.equal(isDueReminderEligible({ term: baseTerm, type: 'due_h7', currentDateStr: '2026-11-02' }), false);
      // H-6: 2026-11-04
      assert.equal(isDueReminderEligible({ term: baseTerm, type: 'due_h7', currentDateStr: '2026-11-04' }), false);
    });
  });

  describe('2. Uji Batas Tanggal H-1 (Tepat 1 Hari Kalender)', () => {
    it('2.1 Tepat H-1 menghasilkan kelayakan dan payload due_h1', () => {
      // due_date: 2026-11-10, H-1 adalah 2026-11-09
      const currentDate = '2026-11-09';
      const daysDiff = getDaysDifference(baseTerm.due_date, currentDate);
      assert.equal(daysDiff, 1);

      const isEligible = isDueReminderEligible({
        term: baseTerm,
        type: 'due_h1',
        currentDateStr: currentDate
      });
      assert.equal(isEligible, true);

      const payload = generateReminderNotificationPayload({
        term: baseTerm,
        type: 'due_h1',
        currentDateStr: currentDate,
        jamaahProfileId: sampleProfileId
      });
      assert.ok(payload);
      assert.equal(payload.type, 'due_h1');
      assert.equal(payload.dedup_key, 'due_h1_term-scheduler-001_2026-11-10');
      assert.match(payload.title, /H-1/);
    });

    it('2.2 Batas luar H-1 (H-2 dan Hari H) ditolak', () => {
      // H-2: 2026-11-08
      assert.equal(isDueReminderEligible({ term: baseTerm, type: 'due_h1', currentDateStr: '2026-11-08' }), false);
      // Hari H: 2026-11-10
      assert.equal(isDueReminderEligible({ term: baseTerm, type: 'due_h1', currentDateStr: '2026-11-10' }), false);
    });
  });

  describe('3. Uji Keterlambatan (Overdue) dan Siklus Dedup Bulanan', () => {
    it('3.1 Tanggal melewati due_date dan tanpa pending: eligible overdue', () => {
      // due_date: 2026-11-10, tanggal cek: 2026-11-15 (5 hari terlambat)
      const currentDate = '2026-11-15';
      const daysDiff = getDaysDifference(baseTerm.due_date, currentDate);
      assert.ok(daysDiff < 0);

      const isEligible = isDueReminderEligible({
        term: baseTerm,
        type: 'overdue',
        currentDateStr: currentDate
      });
      assert.equal(isEligible, true);

      const payload = generateReminderNotificationPayload({
        term: baseTerm,
        type: 'overdue',
        currentDateStr: currentDate,
        jamaahProfileId: sampleProfileId
      });
      assert.ok(payload);
      assert.equal(payload.type, 'overdue');
      // Kunci deduplikasi mengikat pada siklus bulan berjalan (2026-11)
      assert.equal(payload.dedup_key, 'overdue_term-scheduler-001_2026-11');
      assert.match(payload.title, /Terlambat/);
    });

    it('3.2 Tanggal belum melewati due_date: tidak boleh overdue', () => {
      assert.equal(isDueReminderEligible({ term: baseTerm, type: 'overdue', currentDateStr: '2026-11-09' }), false);
      assert.equal(isDueReminderEligible({ term: baseTerm, type: 'overdue', currentDateStr: '2026-11-10' }), false);
    });
  });

  describe('4. Supresi Termin Lunas dan Pembayaran Pending', () => {
    it('4.1 Termin yang sudah lunas (verified >= target) tidak pernah dikirimi pengingat apapun', () => {
      const paidTerm = {
        ...baseTerm,
        verified_amount: 10000000,
        remaining_amount: 0
      };

      // Cek H-7, H-1, dan Overdue
      assert.equal(isDueReminderEligible({ term: paidTerm, type: 'due_h7', currentDateStr: '2026-11-03' }), false);
      assert.equal(isDueReminderEligible({ term: paidTerm, type: 'due_h1', currentDateStr: '2026-11-09' }), false);
      assert.equal(isDueReminderEligible({ term: paidTerm, type: 'overdue', currentDateStr: '2026-11-15' }), false);

      assert.equal(generateReminderNotificationPayload({ term: paidTerm, type: 'due_h7', currentDateStr: '2026-11-03', jamaahProfileId: sampleProfileId }), null);
      assert.equal(generateReminderNotificationPayload({ term: paidTerm, type: 'overdue', currentDateStr: '2026-11-15', jamaahProfileId: sampleProfileId }), null);
    });

    it('4.2 Pembayaran berstatus pending menahan notifikasi keterlambatan (overdue)', () => {
      const pendingTerm = {
        ...baseTerm,
        due_date: '2026-11-10',
        verified_amount: 0,
        pending_amount: 10000000, // Jamaah sudah transfer, menunggu admin verifikasi
        remaining_amount: 10000000
      };

      // Meskipun tanggal sudah lewat (2026-11-12), overdue wajib ditahan
      const isEligible = isDueReminderEligible({
        term: pendingTerm,
        type: 'overdue',
        currentDateStr: '2026-11-12'
      });
      assert.equal(isEligible, false);

      const payload = generateReminderNotificationPayload({
        term: pendingTerm,
        type: 'overdue',
        currentDateStr: '2026-11-12',
        jamaahProfileId: sampleProfileId
      });
      assert.equal(payload, null);
    });
  });

  describe('5. Eksekusi Berulang & Stabilitas Kunci Deduplikasi (Idempotensi)', () => {
    it('5.1 Eksekusi ulang pada hari yang sama menghasilkan dedup_key yang identik (anti-duplikat)', () => {
      const run1 = generateReminderNotificationPayload({
        term: baseTerm,
        type: 'due_h7',
        currentDateStr: '2026-11-03',
        jamaahProfileId: sampleProfileId
      });
      const run2 = generateReminderNotificationPayload({
        term: baseTerm,
        type: 'due_h7',
        currentDateStr: '2026-11-03',
        jamaahProfileId: sampleProfileId
      });

      assert.equal(run1.dedup_key, run2.dedup_key);
      assert.equal(run1.dedup_key, 'due_h7_term-scheduler-001_2026-11-10');
    });

    it('5.2 Eksekusi overdue berulang pada hari berbeda di bulan yang sama menghasilkan dedup_key identik', () => {
      const day15 = generateReminderNotificationPayload({
        term: baseTerm,
        type: 'overdue',
        currentDateStr: '2026-11-15',
        jamaahProfileId: sampleProfileId
      });
      const day20 = generateReminderNotificationPayload({
        term: baseTerm,
        type: 'overdue',
        currentDateStr: '2026-11-20',
        jamaahProfileId: sampleProfileId
      });

      // Keduanya berada di siklus 2026-11
      assert.equal(day15.dedup_key, day20.dedup_key);
      assert.equal(day15.dedup_key, 'overdue_term-scheduler-001_2026-11');
    });
  });

  describe('6. Pemanggilan Manual RPC triggerManualReminderCheck', () => {
    it('6.1 Service layer mendukung pemanggilan pemeriksaan manual tanpa cron otomatis', async () => {
      const result = await notificationService.triggerManualReminderCheck('demo-admin-id-123');
      assert.ok(result);
      assert.equal(result.success, true);
      assert.equal(result.status, 'success');
      assert.ok(result.execution_date_wib);
      assert.equal(typeof result.terms_evaluated, 'number');
      assert.equal(typeof result.notifications_created, 'number');
    });
  });

  describe('7. Uji Kontrol Akses & Otorisasi Pemanggil (Simulasi Aturan SQL)', () => {
    it('7.1 Pemanggil anon ditolak secara eksplisit', () => {
      assert.throws(
        () => verifyReminderAuthorizationContext({ role: 'anon', isAdmin: false }),
        /Pemanggil anonim tidak diizinkan/
      );
    });

    it('7.2 Jamaah biasa (authenticated non-admin) ditolak secara eksplisit', () => {
      assert.throws(
        () => verifyReminderAuthorizationContext({ role: 'authenticated', isAdmin: false }),
        /Hanya administrator yang dapat memproses pengingat/
      );
    });

    it('7.3 Admin sah (authenticated admin) diizinkan', () => {
      const allowed = verifyReminderAuthorizationContext({ role: 'authenticated', isAdmin: true });
      assert.equal(allowed, true);
    });

    it('7.4 Backend service_role diizinkan', () => {
      const allowed = verifyReminderAuthorizationContext({ role: 'service_role' });
      assert.equal(allowed, true);
    });

    it('7.5 Konteks autentikasi tidak tersedia / auth.role() NULL dari API ditolak', () => {
      assert.throws(
        () => verifyReminderAuthorizationContext({ role: null, sessionUser: 'authenticator' }),
        /Konteks otorisasi tidak valid/
      );
      assert.throws(
        () => verifyReminderAuthorizationContext({ role: '', sessionUser: 'authenticator' }),
        /Konteks otorisasi tidak valid/
      );
    });

    it('7.6 Sesi internal postgres superuser / pg_cron worker diizinkan saat auth.role() NULL', () => {
      const allowed = verifyReminderAuthorizationContext({ role: null, sessionUser: 'postgres' });
      assert.equal(allowed, true);
    });
  });

  describe('8. Uji Akurasi Status Hasil Eksekusi (success vs partial_success)', () => {
    it('8.1 Eksekusi bersih tanpa galat (errors_count = 0) menghasilkan success: true dan status: "success"', () => {
      const summary = buildReminderExecutionSummary({
        executionDateWib: '2026-10-25',
        termsEvaluated: 5,
        notificationsCreated: 2,
        skippedPaid: 2,
        skippedPending: 1,
        errorsEncountered: 0
      });

      assert.equal(summary.success, true);
      assert.equal(summary.status, 'success');
      assert.equal(summary.errors_encountered, 0);
      assert.equal(summary.notifications_created, 2);
    });

    it('8.2 Eksekusi dengan galat parsial (errors_count > 0) menghasilkan success: false dan status: "partial_success"', () => {
      const summary = buildReminderExecutionSummary({
        executionDateWib: '2026-10-25',
        termsEvaluated: 5,
        notificationsCreated: 3,
        skippedPaid: 1,
        skippedPending: 0,
        errorsEncountered: 1
      });

      assert.equal(summary.success, false);
      assert.equal(summary.status, 'partial_success');
      assert.equal(summary.errors_encountered, 1);
      assert.equal(summary.notifications_created, 3);
    });
  });

  describe('9. Uji Statis Integritas Skrip Migrasi SQL Tahap 5.2', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20261025100000_create_installment_reminder_function.sql'
    );
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    it('9.1 Memuat penolakan eksplisit untuk pemanggil anon', () => {
      assert.match(sqlContent, /IF auth\.role\(\) = 'anon' THEN/);
      assert.match(sqlContent, /RAISE EXCEPTION 'Akses ditolak: Pemanggil anonim/);
    });

    it('9.2 Memuat pemeriksaan ketat public.is_admin() untuk role authenticated', () => {
      assert.match(sqlContent, /ELSIF auth\.role\(\) = 'authenticated' THEN/);
      assert.match(sqlContent, /IF NOT public\.is_admin\(\) THEN/);
    });

    it('9.3 Memuat proteksi terhadap auth.role() NULL di luar postgres session', () => {
      assert.match(sqlContent, /ELSIF session_user = 'postgres' AND \(auth\.role\(\) IS NULL OR auth\.role\(\) = ''\) THEN/);
      assert.match(sqlContent, /RAISE EXCEPTION 'Akses ditolak: Konteks otorisasi tidak valid/);
    });

    it('9.4 Memuat pencabutan hak eksekusi eksplisit dari PUBLIC dan anon', () => {
      assert.match(sqlContent, /REVOKE ALL ON FUNCTION public\.process_installment_reminders\(\) FROM PUBLIC;/);
      assert.match(sqlContent, /REVOKE ALL ON FUNCTION public\.process_installment_reminders\(\) FROM anon;/);
    });

    it('9.5 Menggunakan SECURITY DEFINER dengan search_path aman', () => {
      assert.match(sqlContent, /SECURITY DEFINER/);
      assert.match(sqlContent, /SET search_path = public, pg_temp/);
    });

    it('9.6 Mengembalikan status partial_success dan success secara kondisional', () => {
      assert.match(sqlContent, /'success', \(v_errors_count = 0\)/);
      assert.match(sqlContent, /'status', CASE WHEN v_errors_count > 0 THEN 'partial_success' ELSE 'success' END/);
    });
  });
});

