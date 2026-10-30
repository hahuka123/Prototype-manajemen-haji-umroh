import { supabase } from './supabase.js';
import { getJakartaCurrentDateStr } from './installmentService.js';

/**
 * Daftar seluruh tipe notifikasi resmi yang didukung oleh sistem dan CHECK constraint database.
 */
export const ALLOWED_NOTIFICATION_TYPES = [
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

/**
 * Memetakan record notifikasi mentah dari database menjadi objek siap pakai di UI.
 */
export function mapNotification(n) {
  if (!n) return null;
  return {
    id: n.id,
    profile_id: n.profile_id,
    jamaah_id: n.jamaah_id,
    type: n.type || 'general',
    title: n.title || 'Pemberitahuan',
    message: n.message || '',
    related_payment_id: n.related_payment_id || null,
    related_term_id: n.related_term_id || null,
    is_read: Boolean(n.is_read),
    read_at: n.read_at || null,
    dedup_key: n.dedup_key || null,
    created_at: n.created_at || new Date().toISOString()
  };
}

/**
 * Menghitung selisih hari kalender (targetDateStr - baseDateStr)
 * format string: YYYY-MM-DD
 */
export function getDaysDifference(targetDateStr, baseDateStr) {
  if (!targetDateStr || !baseDateStr) return null;
  const target = new Date(String(targetDateStr).slice(0, 10) + 'T00:00:00Z');
  const base = new Date(String(baseDateStr).slice(0, 10) + 'T00:00:00Z');
  const diffMs = target.getTime() - base.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Mengecek apakah suatu termin memenuhi kriteria untuk dikirimkan pengingat:
 * - H-7: tepat 7 hari kalender sebelum due_date
 * - H-1: tepat 1 hari kalender sebelum due_date
 * - overdue: tanggal hari ini melampaui due_date
 */
export function isDueReminderEligible({ term, type, currentDateStr = null }) {
  if (!term || !term.due_date) return false;

  const remaining = Number(term.remaining_amount ?? (term.target_amount - (term.verified_amount || 0)));
  const verified = Number(term.verified_amount || 0);
  const target = Number(term.target_amount || term.amount || 0);

  // Jika termin sudah lunas, TIDAK PERNAH mengirimkan pengingat apapun
  if (verified >= target && target > 0) {
    return false;
  }

  // Jika tidak ada sisa kewajiban
  if (remaining <= 0) {
    return false;
  }

  const today = currentDateStr || getJakartaCurrentDateStr();
  const daysDiff = getDaysDifference(term.due_date, today);

  if (type === 'due_h7') {
    return daysDiff === 7;
  }

  if (type === 'due_h1') {
    return daysDiff === 1;
  }

  if (type === 'overdue') {
    // Hari ini sudah melewati tanggal jatuh tempo (daysDiff < 0)
    // Dan tidak sedang memiliki pembayaran pending yang belum diverifikasi
    const pending = Number(term.pending_amount || 0);
    return daysDiff < 0 && pending === 0;
  }

  return false;
}

/**
 * Menghasilkan payload notifikasi pengingat dengan dedup_key yang unik dan idempoten.
 */
export function generateReminderNotificationPayload({
  term,
  type,
  currentDateStr = null,
  jamaahProfileId
}) {
  if (!isDueReminderEligible({ term, type, currentDateStr })) {
    return null;
  }

  const remaining = Number(term.remaining_amount ?? (term.target_amount - (term.verified_amount || 0)));
  const formattedNominal = 'Rp ' + remaining.toLocaleString('id-ID');
  const termTitle = term.title || `Termin ${term.term_number || ''}`;
  const termDueDate = String(term.due_date).slice(0, 10);
  const today = currentDateStr || getJakartaCurrentDateStr();

  let title = '';
  let message = '';
  let dedupKey = '';

  if (type === 'due_h7') {
    title = `Pengingat Jatuh Tempo (H-7): ${termTitle}`;
    message = `Pembayaran ${termTitle} sebesar ${formattedNominal} akan jatuh tempo dalam 7 hari (${termDueDate}). Mohon lakukan pembayaran sebelum batas waktu.`;
    dedupKey = `due_h7_${term.id}_${termDueDate}`;
  } else if (type === 'due_h1') {
    title = `Pengingat Besok Jatuh Tempo (H-1): ${termTitle}`;
    message = `Pembayaran ${termTitle} sebesar ${formattedNominal} jatuh tempo besok (${termDueDate}). Segera lakukan transfer dan unggah bukti pembayaran Anda.`;
    dedupKey = `due_h1_${term.id}_${termDueDate}`;
  } else if (type === 'overdue') {
    const monthCycle = today.slice(0, 7); // contoh: 2026-10
    title = `Pemberitahuan Termin Terlambat: ${termTitle}`;
    message = `Kewajiban ${termTitle} telah melewati tanggal jatuh tempo (${termDueDate}). Sisa tagihan saat ini adalah ${formattedNominal}. Silakan selesaikan pembayaran untuk kelancaran keberangkatan.`;
    dedupKey = `overdue_${term.id}_${monthCycle}`;
  } else {
    return null;
  }

  return {
    profile_id: jamaahProfileId,
    jamaah_id: term.jamaah_id,
    type,
    title,
    message,
    related_payment_id: null,
    related_term_id: term.id,
    dedup_key: dedupKey
  };
}

/**
 * Memancarkan event pembaruan notifikasi agar komponen UI (seperti NotificationBell)
 * langsung memperbarui badge dan daftar notifikasi secara real-time.
 */
export function broadcastNotificationUpdate() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('notification-updated'));
  }
}

const STORAGE_KEY = 'demo_notifications_store_v1';

const DEFAULT_DEMO_NOTIFICATIONS = [
  {
    id: 'demo-notif-1',
    profile_id: 'demo-jamaah-id-456',
    jamaah_id: 'demo-jamaah-uuid-001',
    type: 'payment_verified',
    title: 'Pembayaran Terverifikasi',
    message: 'Alhamdulillah, transfer pembayaran Anda sebesar Rp 10.000.000 telah diverifikasi sah oleh admin.',
    related_payment_id: 'demo-pay-1',
    related_term_id: 'demo-term-1',
    is_read: false,
    read_at: null,
    dedup_key: 'demo-dedup-1',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'demo-notif-2',
    profile_id: 'demo-jamaah-id-456',
    jamaah_id: 'demo-jamaah-uuid-001',
    type: 'due_h7',
    title: 'Pengingat Jatuh Tempo (H-7): Cicilan Tahap 1',
    message: 'Pembayaran Cicilan Tahap 1 sebesar Rp 5.000.000 akan jatuh tempo dalam 7 hari. Mohon persiapkan pembayaran Anda.',
    related_payment_id: null,
    related_term_id: 'demo-term-2',
    is_read: false,
    read_at: null,
    dedup_key: 'demo-dedup-2',
    created_at: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'demo-notif-3',
    profile_id: 'demo-jamaah-id-456',
    jamaah_id: 'demo-jamaah-uuid-001',
    type: 'payment_submitted',
    title: 'Konfirmasi Transfer Terkirim',
    message: 'Pengajuan pembayaran transfer sebesar Rp 5.000.000 telah kami terima dan sedang menunggu verifikasi admin.',
    related_payment_id: 'demo-pay-3',
    related_term_id: 'demo-term-2',
    is_read: true,
    read_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    dedup_key: 'demo-dedup-3',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString()
  }
];

function initDemoNotificationsStore() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      // Ignore
    }
  }
  return [...DEFAULT_DEMO_NOTIFICATIONS];
}

let DEMO_NOTIFICATIONS_STORE = initDemoNotificationsStore();

function syncDemoStore(newStore) {
  DEMO_NOTIFICATIONS_STORE = newStore;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newStore));
    } catch (e) {
      // Ignore
    }
  }
  broadcastNotificationUpdate();
}

export function resetDemoNotificationsStore() {
  DEMO_NOTIFICATIONS_STORE = [...DEFAULT_DEMO_NOTIFICATIONS];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // Ignore
    }
  }
  broadcastNotificationUpdate();
}

export const notificationService = {
  /**
   * Mengambil seluruh notifikasi milik profil pengguna aktif.
   */
  getNotifications: async (profileId) => {
    if (!profileId) return [];

    if (
      profileId === 'demo-jamaah-id-456' ||
      profileId === 'demo-admin-id-123' ||
      (typeof profileId === 'string' && profileId.startsWith('demo-'))
    ) {
      return DEMO_NOTIFICATIONS_STORE.filter(
        n => n.profile_id === profileId
      ).map(mapNotification);
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[notificationService] Error getNotifications:', error.message);
        throw error;
      }

      return (data || []).map(mapNotification);
    } catch (e) {
      if (typeof profileId === 'string' && profileId.startsWith('demo-')) {
        return DEMO_NOTIFICATIONS_STORE.filter(n => n.profile_id === profileId).map(mapNotification);
      }
      throw e;
    }
  },

  /**
   * Menghitung jumlah notifikasi yang belum dibaca (unread).
   */
  getUnreadCount: async (profileId) => {
    if (!profileId) return 0;

    if (
      profileId === 'demo-jamaah-id-456' ||
      profileId === 'demo-admin-id-123' ||
      (typeof profileId === 'string' && profileId.startsWith('demo-'))
    ) {
      return DEMO_NOTIFICATIONS_STORE.filter(
        n => n.profile_id === profileId && !n.is_read
      ).length;
    }

    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .eq('is_read', false);

      if (error) {
        console.error('[notificationService] Error getUnreadCount:', error.message);
        throw error;
      }

      return count || 0;
    } catch (e) {
      if (typeof profileId === 'string' && profileId.startsWith('demo-')) {
        return DEMO_NOTIFICATIONS_STORE.filter(n => n.profile_id === profileId && !n.is_read).length;
      }
      return 0;
    }
  },

  /**
   * Mengirimkan notifikasi ke seluruh administrator.
   * Mendukung mode demo dan integrasi RPC / trigger Supabase.
   */
  notifyAdmins: async ({
    type = 'admin_new_payment',
    title,
    message,
    jamaahId = null,
    relatedPaymentId = null,
    relatedTermId = null,
    dedupKey = null,
    caller = null
  }) => {
    // Validasi otorisasi jika konteks pemanggil disediakan
    if (caller) {
      verifyNotifyAdminsAuthorizationContext(caller);
    }

    if (!ALLOWED_NOTIFICATION_TYPES.includes(type)) {
      throw new Error(`Tipe notifikasi tidak valid: ${type}`);
    }

    const demoAdminId = 'demo-admin-id-123';
    const uniqueDedup = dedupKey || `admin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Tambahkan ke Demo Store jika di mode demo
    const isDuplicate = DEMO_NOTIFICATIONS_STORE.some(n => n.dedup_key === uniqueDedup);
    if (!isDuplicate) {
      const newAdminItem = {
        id: `demo-notif-admin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        profile_id: demoAdminId,
        jamaah_id: jamaahId,
        type,
        title,
        message,
        related_payment_id: relatedPaymentId,
        related_term_id: relatedTermId,
        is_read: false,
        read_at: null,
        dedup_key: uniqueDedup,
        created_at: new Date().toISOString()
      };
      syncDemoStore([newAdminItem, ...DEMO_NOTIFICATIONS_STORE]);
    } else {
      broadcastNotificationUpdate();
    }

    // 2. Jika di lingkungan Supabase live, coba panggil RPC broadcast jika tersedia
    try {
      const { error: rpcError } = await supabase.rpc('notify_admins', {
        p_type: type,
        p_title: title,
        p_message: message,
        p_jamaah_id: jamaahId,
        p_related_payment_id: relatedPaymentId,
        p_dedup_prefix: 'admin_call'
      });

      if (rpcError) {
        // Non-blocking: database trigger trg_handle_payment_notification / trg_handle_document_notification
        // otomatis bertindak sebagai garda utama di Supabase
      }
    } catch (e) {
      // Non-blocking
    }

    return true;
  },

  /**
   * Mengirimkan notifikasi ke satu pengguna spesifik (misal verifikasi berkas jamaah).
   */
  sendNotification: async ({
    profileId,
    jamaahId = null,
    type = 'general',
    title,
    message,
    relatedPaymentId = null,
    relatedTermId = null,
    dedupKey = null
  }) => {
    if (!profileId) return false;

    if (!ALLOWED_NOTIFICATION_TYPES.includes(type)) {
      throw new Error(`Tipe notifikasi tidak valid: ${type}`);
    }

    const uniqueDedup = dedupKey || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (profileId.startsWith('demo-') || (typeof profileId === 'string' && profileId.includes('demo'))) {
      const isDuplicate = DEMO_NOTIFICATIONS_STORE.some(n => n.dedup_key === uniqueDedup);
      if (!isDuplicate) {
        const newItem = {
          id: `demo-notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          profile_id: profileId,
          jamaah_id: jamaahId,
          type,
          title,
          message,
          related_payment_id: relatedPaymentId,
          related_term_id: relatedTermId,
          is_read: false,
          read_at: null,
          dedup_key: uniqueDedup,
          created_at: new Date().toISOString()
        };
        syncDemoStore([newItem, ...DEMO_NOTIFICATIONS_STORE]);
      } else {
        broadcastNotificationUpdate();
      }
      return true;
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .insert([{
          profile_id: profileId,
          jamaah_id: jamaahId,
          type,
          title,
          message,
          related_payment_id: relatedPaymentId,
          related_term_id: relatedTermId,
          dedup_key: uniqueDedup
        }]);

      broadcastNotificationUpdate();
      return !error;
    } catch (e) {
      broadcastNotificationUpdate();
      return false;
    }
  },

  /**
   * Menandai satu notifikasi sebagai dibaca via RPC mark_notification_as_read.
   */
  markAsRead: async (notificationId, profileId = null) => {
    if (!notificationId) return false;

    if (
      (profileId && profileId.startsWith('demo-')) ||
      (typeof notificationId === 'string' && notificationId.startsWith('demo-'))
    ) {
      const updated = DEMO_NOTIFICATIONS_STORE.map(n => {
        if (n.id === notificationId) {
          return { ...n, is_read: true, read_at: new Date().toISOString() };
        }
        return n;
      });
      syncDemoStore(updated);
      return true;
    }

    try {
      const { data, error } = await supabase.rpc('mark_notification_as_read', {
        target_notification_id: notificationId
      });

      broadcastNotificationUpdate();
      if (error) {
        console.error('[notificationService] Error markAsRead:', error.message);
        throw error;
      }

      return Boolean(data);
    } catch (e) {
      console.warn('[notificationService] Exception markAsRead:', e);
      return false;
    }
  },

  /**
   * Menandai seluruh notifikasi milik pengguna aktif sebagai dibaca via RPC mark_all_notifications_as_read.
   */
  markAllAsRead: async (profileId = null) => {
    if (profileId && profileId.startsWith('demo-')) {
      const updated = DEMO_NOTIFICATIONS_STORE.map(n => {
        if (n.profile_id === profileId) {
          return { ...n, is_read: true, read_at: new Date().toISOString() };
        }
        return n;
      });
      syncDemoStore(updated);
      return updated.filter(n => n.profile_id === profileId).length;
    }

    try {
      const { data, error } = await supabase.rpc('mark_all_notifications_as_read');
      broadcastNotificationUpdate();
      if (error) {
        console.error('[notificationService] Error markAllAsRead:', error.message);
        throw error;
      }

      return typeof data === 'number' ? data : 0;
    } catch (e) {
      console.warn('[notificationService] Exception markAllAsRead:', e);
      return 0;
    }
  },

  /**
   * Menjalankan pemrosesan pengingat termin secara manual via RPC public.process_installment_reminders().
   * Khusus Admin / Pengujian tanpa pendaftaran cron otomatis.
   */
  triggerManualReminderCheck: async (profileId = null) => {
    if (profileId && profileId.startsWith('demo-')) {
      return {
        success: true,
        status: 'success',
        execution_date_wib: getJakartaCurrentDateStr(),
        terms_evaluated: 3,
        notifications_created: 0,
        skipped_paid_terms: 1,
        skipped_pending_verification: 1,
        errors_encountered: 0,
        is_demo: true
      };
    }

    try {
      const { data, error } = await supabase.rpc('process_installment_reminders');
      if (error) {
        console.error('[notificationService] Error triggerManualReminderCheck:', error.message);
        throw error;
      }
      return data;
    } catch (e) {
      console.warn('[notificationService] Exception triggerManualReminderCheck:', e);
      throw e;
    }
  }
};

/**
 * Memvalidasi konteks otorisasi pemanggil notify_admins
 * (Simulasi aturan keamanan berlapis SQL):
 * - anon: ditolak
 * - authenticated non-admin: ditolak
 * - authenticated admin: diizinkan
 * - service_role: diizinkan
 * - NULL auth role dengan session postgres: diizinkan
 * - konteks tidak valid / role NULL dari API: ditolak
 */
export function verifyNotifyAdminsAuthorizationContext({ role, isAdmin = false, sessionUser = 'authenticator' }) {
  if (role === 'anon') {
    throw new Error('Akses ditolak: Pemanggil anonim tidak diizinkan.');
  }
  if (role === 'authenticated') {
    if (!isAdmin) {
      throw new Error('Akses ditolak: Hanya administrator yang berhak mengirim notifikasi admin.');
    }
    return true;
  }
  if (role === 'service_role') {
    return true;
  }
  if ((!role || role === '') && sessionUser === 'postgres') {
    return true;
  }
  throw new Error('Akses ditolak: Konteks otorisasi tidak valid atau tidak memiliki izin.');
}

/**
 * Memvalidasi konteks otorisasi pemanggil process_installment_reminders
 * (Simulasi aturan keamanan berlapis SQL untuk pengujian unit):
 * - anon: ditolak
 * - authenticated non-admin: ditolak
 * - authenticated admin: diizinkan
 * - service_role: diizinkan
 * - NULL auth role dengan session postgres: diizinkan (internal pg_cron / superuser)
 * - kondisi tak terdefinisi / role NULL dari API: ditolak
 */
export function verifyReminderAuthorizationContext({ role, isAdmin = false, sessionUser = 'authenticator' }) {
  if (role === 'anon') {
    throw new Error('Akses ditolak: Pemanggil anonim tidak diizinkan menjalankan fungsi pengingat.');
  }
  if (role === 'authenticated') {
    if (!isAdmin) {
      throw new Error('Akses ditolak: Hanya administrator yang dapat memproses pengingat termin cicilan.');
    }
    return true;
  }
  if (role === 'service_role') {
    return true;
  }
  if ((!role || role === '') && sessionUser === 'postgres') {
    return true;
  }
  throw new Error('Akses ditolak: Konteks otorisasi tidak valid atau tidak memiliki izin.');
}

/**
 * Membangun ringkasan hasil pemrosesan termin cicilan
 * (Simulasi kembalian jsonb_build_object fungsi SQL):
 * - errors_encountered === 0 => success: true, status: 'success'
 * - errors_encountered > 0 => success: false, status: 'partial_success'
 */
export function buildReminderExecutionSummary({
  executionDateWib,
  termsEvaluated = 0,
  notificationsCreated = 0,
  skippedPaid = 0,
  skippedPending = 0,
  errorsEncountered = 0
}) {
  const isSuccess = errorsEncountered === 0;
  return {
    success: isSuccess,
    status: isSuccess ? 'success' : 'partial_success',
    execution_date_wib: executionDateWib,
    terms_evaluated: termsEvaluated,
    notifications_created: notificationsCreated,
    skipped_paid_terms: skippedPaid,
    skipped_pending_verification: skippedPending,
    errors_encountered: errorsEncountered
  };
}
