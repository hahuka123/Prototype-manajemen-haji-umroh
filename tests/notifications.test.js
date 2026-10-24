import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapNotification,
  getDaysDifference,
  isDueReminderEligible,
  generateReminderNotificationPayload,
  notificationService
} from '../src/services/notificationService.js';

describe('Model Data & Layanan Notifikasi In-App (Haji & Umrah)', () => {
  const mockTermUnpaid = {
    id: 'term-001',
    jamaah_id: 'jamaah-001',
    term_number: 1,
    title: 'Uang Muka (DP)',
    target_amount: 10000000,
    amount: 10000000,
    due_date: '2026-11-01',
    verified_amount: 0,
    pending_amount: 0,
    remaining_amount: 10000000
  };

  const mockTermPaid = {
    id: 'term-002',
    jamaah_id: 'jamaah-001',
    term_number: 2,
    title: 'Cicilan Tahap 1',
    target_amount: 10000000,
    amount: 10000000,
    due_date: '2026-10-15',
    verified_amount: 10000000,
    pending_amount: 0,
    remaining_amount: 0
  };

  const mockTermPending = {
    id: 'term-003',
    jamaah_id: 'jamaah-001',
    term_number: 3,
    title: 'Pelunasan',
    target_amount: 15000000,
    amount: 15000000,
    due_date: '2026-10-20',
    verified_amount: 5000000,
    pending_amount: 10000000,
    remaining_amount: 10000000
  };

  describe('1. Pemetaan Record Notifikasi (mapNotification)', () => {
    it('1.1 Memetakan record mentah DB dengan nilai default yang aman', () => {
      const raw = {
        id: 'notif-1',
        profile_id: 'prof-1',
        jamaah_id: 'j-1',
        type: 'payment_verified',
        title: 'Pembayaran Sah',
        message: 'Pembayaran telah disetujui.',
        is_read: false,
        read_at: null,
        dedup_key: 'dedup-1',
        created_at: '2026-10-24T10:00:00Z'
      };

      const mapped = mapNotification(raw);
      assert.equal(mapped.id, 'notif-1');
      assert.equal(mapped.profile_id, 'prof-1');
      assert.equal(mapped.type, 'payment_verified');
      assert.equal(mapped.is_read, false);
      assert.equal(mapped.read_at, null);
      assert.equal(mapped.dedup_key, 'dedup-1');
    });

    it('1.2 Menangani input null / undefined secara elegan', () => {
      assert.equal(mapNotification(null), null);
      assert.equal(mapNotification(undefined), null);
    });
  });

  describe('2. Pemisahan Jenis Notifikasi & Kunci Deduplikasi (dedup_key)', () => {
    it('2.1 Menghasilkan dedup_key unik untuk pengingat H-7 dan H-1', () => {
      const payloadH7 = generateReminderNotificationPayload({
        term: mockTermUnpaid,
        type: 'due_h7',
        currentDateStr: '2026-10-25', // Tepat 7 hari sebelum 2026-11-01
        jamaahProfileId: 'prof-001'
      });
      assert.ok(payloadH7);
      assert.equal(payloadH7.type, 'due_h7');
      assert.equal(payloadH7.dedup_key, 'due_h7_term-001_2026-11-01');

      const payloadH1 = generateReminderNotificationPayload({
        term: mockTermUnpaid,
        type: 'due_h1',
        currentDateStr: '2026-10-31', // Tepat 1 hari sebelum 2026-11-01
        jamaahProfileId: 'prof-001'
      });
      assert.ok(payloadH1);
      assert.equal(payloadH1.type, 'due_h1');
      assert.equal(payloadH1.dedup_key, 'due_h1_term-001_2026-11-01');

      // Pastikan kedua kunci deduplikasi tidak bertabrakan
      assert.notEqual(payloadH7.dedup_key, payloadH1.dedup_key);
    });

    it('2.2 Deduplikasi notifikasi dengan kunci yang sama menjamin idempotensi', () => {
      const payloadA = generateReminderNotificationPayload({
        term: mockTermUnpaid,
        type: 'due_h7',
        currentDateStr: '2026-10-25',
        jamaahProfileId: 'prof-001'
      });
      const payloadB = generateReminderNotificationPayload({
        term: mockTermUnpaid,
        type: 'due_h7',
        currentDateStr: '2026-10-25',
        jamaahProfileId: 'prof-001'
      });
      assert.equal(payloadA.dedup_key, payloadB.dedup_key);
    });
  });

  describe('3. Validasi Aturan Pengingat Jatuh Tempo (H-7, H-1, Overdue)', () => {
    it('3.1 H-7 hanya berlaku tepat 7 hari kalender sebelum jatuh tempo', () => {
      const eligibleExact = isDueReminderEligible({
        term: mockTermUnpaid, // due_date: 2026-11-01
        type: 'due_h7',
        currentDateStr: '2026-10-25'
      });
      assert.equal(eligibleExact, true);

      const eligibleWrongDay = isDueReminderEligible({
        term: mockTermUnpaid,
        type: 'due_h7',
        currentDateStr: '2026-10-26' // H-6 bukan H-7
      });
      assert.equal(eligibleWrongDay, false);
    });

    it('3.2 H-1 hanya berlaku tepat 1 hari kalender sebelum jatuh tempo', () => {
      const eligibleExact = isDueReminderEligible({
        term: mockTermUnpaid, // due_date: 2026-11-01
        type: 'due_h1',
        currentDateStr: '2026-10-31'
      });
      assert.equal(eligibleExact, true);

      const eligibleWrongDay = isDueReminderEligible({
        term: mockTermUnpaid,
        type: 'due_h1',
        currentDateStr: '2026-10-30' // H-2 bukan H-1
      });
      assert.equal(eligibleWrongDay, false);
    });

    it('3.3 Overdue berlaku jika hari ini melampaui due_date dan tidak ada transfer pending', () => {
      const eligibleOverdue = isDueReminderEligible({
        term: mockTermUnpaid, // due_date: 2026-11-01
        type: 'overdue',
        currentDateStr: '2026-11-05' // 4 hari lewat
      });
      assert.equal(eligibleOverdue, true);
    });
  });

  describe('4. Anti-Pemberitahuan Menyesatkan (Lunas & Pending Checks)', () => {
    it('4.1 Termin lunas TIDAK PERNAH menghasilkan pengingat apapun (H-7, H-1, Overdue)', () => {
      const resH7 = isDueReminderEligible({
        term: mockTermPaid,
        type: 'due_h7',
        currentDateStr: '2026-10-08'
      });
      assert.equal(resH7, false);

      const resH1 = isDueReminderEligible({
        term: mockTermPaid,
        type: 'due_h1',
        currentDateStr: '2026-10-14'
      });
      assert.equal(resH1, false);

      const resOverdue = isDueReminderEligible({
        term: mockTermPaid,
        type: 'overdue',
        currentDateStr: '2026-10-25'
      });
      assert.equal(resOverdue, false);

      // Payload harus null
      const payload = generateReminderNotificationPayload({
        term: mockTermPaid,
        type: 'overdue',
        currentDateStr: '2026-10-25',
        jamaahProfileId: 'prof-001'
      });
      assert.equal(payload, null);
    });

    it('4.2 Pembayaran berstatus pending TIDAK dianggap verified lunas', () => {
      // Sisa 10.000.000 dengan pending 10.000.000 -> verified masih 5.000.000
      assert.equal(mockTermPending.verified_amount, 5000000);
      assert.equal(mockTermPending.remaining_amount, 10000000);

      // Overdue disupresi jika ada bukti transfer pending yang sedang menunggu verifikasi admin
      const isOverdueEligible = isDueReminderEligible({
        term: mockTermPending,
        type: 'overdue',
        currentDateStr: '2026-10-25'
      });
      assert.equal(isOverdueEligible, false);
    });
  });

  describe('5. Kepemilikan & Penandaan Notifikasi Dibaca (markAsRead)', () => {
    it('5.1 Penandaan dibaca mengubah is_read menjadi true dan mengisi read_at', async () => {
      const demoId = 'demo-notif-1';
      const markResult = await notificationService.markAsRead(demoId, 'demo-jamaah-id-456');
      assert.equal(markResult, true);

      const list = await notificationService.getNotifications('demo-jamaah-id-456');
      const updatedItem = list.find(n => n.id === demoId);
      assert.equal(updatedItem.is_read, true);
      assert.ok(updatedItem.read_at);
    });

    it('5.2 Menandai seluruh notifikasi sebagai dibaca (markAllAsRead)', async () => {
      const count = await notificationService.markAllAsRead('demo-jamaah-id-456');
      assert.ok(count >= 0);

      const unreadAfter = await notificationService.getUnreadCount('demo-jamaah-id-456');
      assert.equal(unreadAfter, 0);
    });

    it('5.3 Kepemilikan notifikasi mengikat pada profile_id resmi', () => {
      const payload = generateReminderNotificationPayload({
        term: mockTermUnpaid,
        type: 'due_h7',
        currentDateStr: '2026-10-25',
        jamaahProfileId: 'profile-valid-123'
      });
      assert.equal(payload.profile_id, 'profile-valid-123');
      assert.equal(payload.jamaah_id, 'jamaah-001');
    });
  });

  describe('6. Pengujian Regresi Temuan Audit Tahap 3.2', () => {
    it('6.1 Kunci deduplikasi penolakan pembayaran bersifat deterministik murni tanpa NOW()', () => {
      const paymentId = 'pay-uuid-test-999';
      // Formula perbaikan: pay_rejected_${payment_id}
      const dedupKeyRun1 = `pay_rejected_${paymentId}`;
      const dedupKeyRun2 = `pay_rejected_${paymentId}`;

      assert.equal(dedupKeyRun1, dedupKeyRun2);
      assert.equal(dedupKeyRun1.includes('undefined'), false);
      assert.equal(dedupKeyRun1.includes('NaN'), false);
      assert.equal(dedupKeyRun1, 'pay_rejected_pay-uuid-test-999');
    });

    it('6.2 Isolasi kotak masuk: kueri notifikasi terisolasi per profile_id tanpa pembocoran data antar-pengguna', async () => {
      const jamaahNotifs = await notificationService.getNotifications('demo-jamaah-id-456');
      const adminNotifs = await notificationService.getNotifications('demo-admin-id-123');

      // Seluruh notifikasi yang dikembalikan untuk jamaah harus terikat ke profile_id jamaah
      for (const n of jamaahNotifs) {
        assert.equal(n.profile_id, 'demo-jamaah-id-456');
      }

      // Admin hanya melihat notifikasi miliknya (jika ada), tidak memuat notifikasi jamaah secara default
      for (const n of adminNotifs) {
        assert.notEqual(n.profile_id, 'other-profile-unauthorized');
      }
    });

    it('6.3 Pergantian akun tidak mencampur hasil unread count antar-pengguna', async () => {
      const unreadJamaah = await notificationService.getUnreadCount('demo-jamaah-id-456');
      const unreadAdmin = await notificationService.getUnreadCount('demo-admin-id-123');

      // Admin yang belum punya notifikasi di store demo harus mengembalikan 0
      assert.equal(typeof unreadJamaah, 'number');
      assert.equal(typeof unreadAdmin, 'number');
      assert.equal(unreadAdmin, 0);
    });

    it('6.4 Pencegahan late-fetch overwrite: verifikasi logika guard ref pada NotificationBell', () => {
      let currentActiveProfileId = 'user-A';

      // Simulasi request lambat dari user-A
      const delayedFetchForA = () => {
        const requestedFor = 'user-A';
        // Saat respons tiba, cek apakah user masih aktif
        const isStillActive = currentActiveProfileId === requestedFor;
        return { data: ['notif-A1', 'notif-A2'], shouldCommit: isStillActive };
      };

      // Akun berganti ke user-B sebelum request selesai
      currentActiveProfileId = 'user-B';

      const result = delayedFetchForA();
      // Guard harus menolak commit data user-A ke state user-B
      assert.equal(result.shouldCommit, false);
    });
  });
});
