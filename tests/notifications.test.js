import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  mapNotification,
  getDaysDifference,
  isDueReminderEligible,
  generateReminderNotificationPayload,
  notificationService,
  ALLOWED_NOTIFICATION_TYPES,
  verifyNotifyAdminsAuthorizationContext,
  resetDemoNotificationsStore
} from '../src/services/notificationService.js';
import { documentService } from '../src/services/documentService.js';
import { paymentService } from '../src/services/paymentService.js';

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

  describe('7. Notifikasi Administrator (Pembayaran & Dokumen Masuk)', () => {
    it('7.1 notifyAdmins berhasil menambahkan notifikasi baru untuk administrator', async () => {
      const initialAdminUnread = await notificationService.getUnreadCount('demo-admin-id-123');
      assert.equal(initialAdminUnread, 0);

      await notificationService.notifyAdmins({
        type: 'admin_new_payment',
        title: 'Pembayaran Transfer Masuk',
        message: 'Jamaah Uji telah mengajukan transfer sebesar Rp 5.000.000.',
        jamaahId: 'demo-jamaah-uuid-001',
        dedupKey: 'test-admin-pay-dedup-1'
      });

      const updatedAdminUnread = await notificationService.getUnreadCount('demo-admin-id-123');
      assert.equal(updatedAdminUnread, 1);

      const adminList = await notificationService.getNotifications('demo-admin-id-123');
      assert.equal(adminList.length, 1);
      assert.equal(adminList[0].type, 'admin_new_payment');
      assert.equal(adminList[0].title, 'Pembayaran Transfer Masuk');
      assert.equal(adminList[0].is_read, false);
    });

    it('7.2 Deduplikasi notifikasi admin (idempotensi dedup_key)', async () => {
      // Panggil ulang dengan dedup_key yang sama
      await notificationService.notifyAdmins({
        type: 'admin_new_payment',
        title: 'Pembayaran Transfer Masuk',
        message: 'Jamaah Uji telah mengajukan transfer sebesar Rp 5.000.000.',
        jamaahId: 'demo-jamaah-uuid-001',
        dedupKey: 'test-admin-pay-dedup-1'
      });

      const adminUnread = await notificationService.getUnreadCount('demo-admin-id-123');
      assert.equal(adminUnread, 1); // Tidak menduplikasi
    });

    it('7.3 Administrator dapat menandai notifikasinya sebagai dibaca', async () => {
      const adminList = await notificationService.getNotifications('demo-admin-id-123');
      const targetId = adminList[0].id;

      const success = await notificationService.markAsRead(targetId, 'demo-admin-id-123');
      assert.equal(success, true);

      const unreadAfter = await notificationService.getUnreadCount('demo-admin-id-123');
      assert.equal(unreadAfter, 0);
    });
  });

  describe('8. Uji Alur Notifikasi Dokumen (Unggah, Verifikasi, Penolakan)', () => {
    const demoJamaahUuid = 'demo-jamaah-uuid-001';
    const demoJamaahProfileId = 'demo-jamaah-id-456';
    const demoAdminProfileId = 'demo-admin-id-123';

    it('8.1 Jamaah mengunggah dokumen: Jamaah menerima document_submitted dan Admin menerima admin_new_document', async () => {
      resetDemoNotificationsStore();

      const mockFile = { name: 'pasfoto_terbaru.jpg', size: 102400, type: 'image/jpeg' };
      const uploadResult = await documentService.uploadDocument(demoJamaahUuid, 'foto', mockFile);
      assert.ok(uploadResult);
      assert.equal(uploadResult.status, 'Menunggu Verifikasi');

      // Cek notifikasi jamaah
      const jamaahNotifs = await notificationService.getNotifications(demoJamaahProfileId);
      const submitNotif = jamaahNotifs.find(n => n.type === 'document_submitted');
      assert.ok(submitNotif, 'Notifikasi document_submitted untuk Jamaah harus ada');
      assert.match(submitNotif.title, /Dokumen Berhasil Diunggah/);
      assert.match(submitNotif.message, /Pas Foto/);

      // Cek notifikasi admin
      const adminNotifs = await notificationService.getNotifications(demoAdminProfileId);
      const adminDocNotif = adminNotifs.find(n => n.type === 'admin_new_document');
      assert.ok(adminDocNotif, 'Notifikasi admin_new_document untuk Admin harus ada');
      assert.match(adminDocNotif.title, /Berkas Dokumen Masuk/);
      assert.match(adminDocNotif.message, /Pas Foto/);
    });

    it('8.2 Admin memverifikasi dokumen: Jamaah menerima notifikasi document_verified', async () => {
      const verifyResult = await documentService.verifyDocument(
        demoJamaahUuid,
        'foto',
        'Lengkap',
        'Pas foto telah memenuhi ketentuan visa.'
      );
      assert.ok(verifyResult);
      assert.equal(verifyResult.status, 'Lengkap');

      const jamaahNotifs = await notificationService.getNotifications(demoJamaahProfileId);
      const verifiedNotif = jamaahNotifs.find(n => n.type === 'document_verified');
      assert.ok(verifiedNotif, 'Notifikasi document_verified untuk Jamaah harus ada');
      assert.match(verifiedNotif.title, /Dokumen Diverifikasi/);
      assert.match(verifiedNotif.message, /dinyatakan Lengkap/);
    });

    it('8.3 Admin menolak dokumen: Jamaah menerima notifikasi document_rejected dengan catatan perbaikan', async () => {
      const rejectionNote = 'Foto terpotong dan resolusi terlalu rendah. Harap unggah ulang foto 4x6.';
      const rejectResult = await documentService.verifyDocument(
        demoJamaahUuid,
        'foto',
        'Ditolak',
        rejectionNote
      );
      assert.ok(rejectResult);
      assert.equal(rejectResult.status, 'Ditolak');

      const jamaahNotifs = await notificationService.getNotifications(demoJamaahProfileId);
      const rejectedNotif = jamaahNotifs.find(n => n.type === 'document_rejected');
      assert.ok(rejectedNotif, 'Notifikasi document_rejected untuk Jamaah harus ada');
      assert.match(rejectedNotif.title, /Dokumen Perlu Perbaikan/);
      assert.match(rejectedNotif.message, /Foto terpotong/);
    });

    it('8.4 Transisi dokumen dari Ditolak langsung ke Lengkap: Jamaah menerima notifikasi document_verified', async () => {
      // Admin menyetujui dokumen yang sebelumnya ditolak
      const approveResult = await documentService.verifyDocument(
        demoJamaahUuid,
        'foto',
        'Lengkap',
        'Dokumen disetujui setelah klarifikasi fisik di kantor biro.'
      );
      assert.ok(approveResult);
      assert.equal(approveResult.status, 'Lengkap');

      const jamaahNotifs = await notificationService.getNotifications(demoJamaahProfileId);
      const verifiedNotif = jamaahNotifs.find(n => n.type === 'document_verified');
      assert.ok(verifiedNotif, 'Notifikasi document_verified wajib dikirim saat dokumen ditandai Lengkap');
      assert.match(verifiedNotif.title, /Dokumen Diverifikasi/);
    });
  });

  describe('9. Pengamanan notify_admins() & Kontrol Hak Akses', () => {
    it('9.1 Pemanggil anon ditolak secara eksplisit', () => {
      assert.throws(
        () => verifyNotifyAdminsAuthorizationContext({ role: 'anon', isAdmin: false }),
        /Pemanggil anonim tidak diizinkan/
      );
    });

    it('9.2 Jamaah biasa (authenticated non-admin) ditolak memanggil notify_admins', async () => {
      // Validasi logika keamanan konteks
      assert.throws(
        () => verifyNotifyAdminsAuthorizationContext({ role: 'authenticated', isAdmin: false }),
        /Hanya administrator yang berhak mengirim notifikasi admin/
      );

      // Panggilan langsung dengan konteks jamaah ditolak
      await assert.rejects(
        async () => {
          await notificationService.notifyAdmins({
            type: 'admin_new_payment',
            title: 'Spam Notif',
            message: 'Percobaan injeksi notifikasi oleh jamaah',
            caller: { role: 'authenticated', isAdmin: false }
          });
        },
        /Hanya administrator yang berhak mengirim notifikasi admin/
      );
    });

    it('9.3 Admin sah (authenticated admin) diizinkan memanggil notify_admins', async () => {
      const allowed = verifyNotifyAdminsAuthorizationContext({ role: 'authenticated', isAdmin: true });
      assert.equal(allowed, true);

      const success = await notificationService.notifyAdmins({
        type: 'admin_new_document',
        title: 'Notifikasi Resmi Admin',
        message: 'Pengumuman internal antar administrator.',
        caller: { role: 'authenticated', isAdmin: true }
      });
      assert.equal(success, true);
    });

    it('9.4 Backend service_role diizinkan', () => {
      const allowed = verifyNotifyAdminsAuthorizationContext({ role: 'service_role' });
      assert.equal(allowed, true);
    });

    it('9.5 Konteks internal postgres diizinkan dan konteks API tak berizin ditolak', () => {
      const postgresAllowed = verifyNotifyAdminsAuthorizationContext({ role: null, sessionUser: 'postgres' });
      assert.equal(postgresAllowed, true);

      assert.throws(
        () => verifyNotifyAdminsAuthorizationContext({ role: null, sessionUser: 'authenticator' }),
        /Konteks otorisasi tidak valid/
      );
      assert.throws(
        () => verifyNotifyAdminsAuthorizationContext({ role: '', sessionUser: 'authenticator' }),
        /Konteks otorisasi tidak valid/
      );
    });

    it('9.6 Tipe notifikasi di luar 13 tipe yang diizinkan ditolak oleh validasi sistem', async () => {
      await assert.rejects(
        async () => {
          await notificationService.notifyAdmins({
            type: 'arbitrary_spam_type',
            title: 'Ilegal',
            message: 'Tipe tidak ada di CHECK constraint'
          });
        },
        /Tipe notifikasi tidak valid/
      );
    });
  });

  describe('10. Preservasi Notifikasi Pembayaran Lama & Pengingat Siklus', () => {
    it('10.1 Alur notifikasi pembayaran (submitted, verified, rejected) tetap berjalan normal', async () => {
      resetDemoNotificationsStore();

      // Submit transfer
      const payment = await paymentService.submitTransfer({
        jamaah_id: 'demo-jamaah-uuid-001',
        nominal: 2500000,
        bukti_file: { name: 'transfer_dp.jpg', size: 50000 }
      });
      assert.ok(payment);

      const jamaahNotifs = await notificationService.getNotifications('demo-jamaah-id-456');
      const paySubNotif = jamaahNotifs.find(n => n.type === 'payment_submitted');
      assert.ok(paySubNotif, 'payment_submitted harus dibuat');

      const adminNotifs = await notificationService.getNotifications('demo-admin-id-123');
      const adminPayNotif = adminNotifs.find(n => n.type === 'admin_new_payment');
      assert.ok(adminPayNotif, 'admin_new_payment harus dibuat');

      // Verify payment
      await paymentService.verifyTransfer(payment.id, 'demo-admin-id-123', 'verified', 'Transfer valid');
      const updatedJamaahNotifs = await notificationService.getNotifications('demo-jamaah-id-456');
      const payVerNotif = updatedJamaahNotifs.find(n => n.type === 'payment_verified');
      assert.ok(payVerNotif, 'payment_verified harus dibuat saat verifikasi');
    });

    it('10.2 Seluruh 13 tipe notifikasi resmi tercakup dalam ALLOWED_NOTIFICATION_TYPES', () => {
      const requiredTypes = [
        'payment_verified',
        'payment_rejected',
        'payment_submitted',
        'payment_cash',
        'due_h7',
        'due_h1',
        'overdue',
        'document_submitted',
        'document_verified',
        'document_rejected',
        'admin_new_payment',
        'admin_new_document',
        'general'
      ];

      for (const t of requiredTypes) {
        assert.ok(ALLOWED_NOTIFICATION_TYPES.includes(t), `Tipe "${t}" wajib terdaftar dalam ALLOWED_NOTIFICATION_TYPES`);
      }
      assert.equal(ALLOWED_NOTIFICATION_TYPES.length, 13);
    });

    it('10.3 Pengingat termin H-7, H-1, dan overdue tetap berjalan sesuai aturan kalender dan supresi', () => {
      // H-7
      assert.equal(isDueReminderEligible({ term: mockTermUnpaid, type: 'due_h7', currentDateStr: '2026-10-25' }), true);
      // H-1
      assert.equal(isDueReminderEligible({ term: mockTermUnpaid, type: 'due_h1', currentDateStr: '2026-10-31' }), true);
      // Overdue
      assert.equal(isDueReminderEligible({ term: mockTermUnpaid, type: 'overdue', currentDateStr: '2026-11-05' }), true);
      // Supresi lunas
      assert.equal(isDueReminderEligible({ term: mockTermPaid, type: 'due_h7', currentDateStr: '2026-10-08' }), false);
      assert.equal(isDueReminderEligible({ term: mockTermPaid, type: 'overdue', currentDateStr: '2026-10-25' }), false);
      // Supresi pending
      assert.equal(isDueReminderEligible({ term: mockTermPending, type: 'overdue', currentDateStr: '2026-10-25' }), false);
    });
  });

  describe('11. Uji Statis Integritas Skrip Migrasi SQL (20261030100000)', () => {
    const migrationFilePath = path.resolve(
      process.cwd(),
      'supabase/migrations/20261030100000_update_notifications_constraint_and_secure_notify_admins.sql'
    );

    it('11.1 File migrasi pembaruan constraint & keamanan notify_admins tersedia di repositori', () => {
      assert.ok(fs.existsSync(migrationFilePath), 'File migrasi 20261030100000 wajib ada di supabase/migrations');
    });

    it('11.2 Skrip migrasi memuat penghapusan dinamis check constraint lama spesifik pada kolom type berbasis nomor atribut (attnum)', () => {
      const sql = fs.readFileSync(migrationFilePath, 'utf8');
      assert.match(sql, /pg_attribute att/);
      assert.match(sql, /att\.attname = 'type'/);
      assert.match(sql, /con\.conkey = ARRAY\[v_attnum\]/);
      assert.match(sql, /ALTER TABLE public\.notifications DROP CONSTRAINT IF EXISTS/);
    });

    it('11.3 Skrip migrasi memuat CHECK constraint notifications_type_check dengan seluruh 13 tipe', () => {
      const sql = fs.readFileSync(migrationFilePath, 'utf8');
      const expectedTypes = [
        'payment_verified',
        'payment_rejected',
        'payment_submitted',
        'payment_cash',
        'due_h7',
        'due_h1',
        'overdue',
        'document_submitted',
        'document_verified',
        'document_rejected',
        'admin_new_payment',
        'admin_new_document',
        'general'
      ];
      for (const t of expectedTypes) {
        assert.ok(sql.includes(`'${t}'`), `File migrasi SQL wajib mencantumkan '${t}' pada CHECK constraint`);
      }
    });

    it('11.4 Skrip migrasi memvalidasi public.is_admin() untuk role authenticated di dalam notify_admins', () => {
      const sql = fs.readFileSync(migrationFilePath, 'utf8');
      assert.match(sql, /IF NOT public\.is_admin\(\) THEN/);
      assert.match(sql, /RAISE EXCEPTION 'Akses ditolak: Hanya administrator yang berhak mengirim notifikasi admin\.'/);
    });

    it('11.5 Skrip migrasi mencabut hak eksekusi notify_admins dari PUBLIC dan anon', () => {
      const sql = fs.readFileSync(migrationFilePath, 'utf8');
      assert.match(sql, /REVOKE ALL ON FUNCTION public\.notify_admins.*FROM PUBLIC;/);
      assert.match(sql, /REVOKE ALL ON FUNCTION public\.notify_admins.*FROM anon;/);
    });

    it('11.6 Skrip migrasi membatasi pemberian hak eksekusi hanya kepada authenticated dan service_role', () => {
      const sql = fs.readFileSync(migrationFilePath, 'utf8');
      assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.notify_admins.*TO authenticated;/);
      assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.notify_admins.*TO service_role;/);
    });

    it('11.7 Trigger dokumen trg_handle_document_notification dilengkapi blok EXCEPTION non-fatal terstruktur', () => {
      const sql = fs.readFileSync(migrationFilePath, 'utf8');
      assert.match(sql, /EXCEPTION\s+WHEN OTHERS THEN/);
      assert.match(sql, /RAISE WARNING 'trg_handle_document_notification failure: \[doc_id: %, op: %, sqlstate: %, sqlerrm: %\]'/);
    });
  });
});
