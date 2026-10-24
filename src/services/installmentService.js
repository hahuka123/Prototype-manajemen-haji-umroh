import { supabase } from './supabase.js';

/**
 * Mendapatkan tanggal hari ini dalam format YYYY-MM-DD sesuai zona waktu Asia/Jakarta (WIB).
 */
export function getJakartaCurrentDateStr(dateObj = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(dateObj); // Menghasilkan format YYYY-MM-DD
  } catch (e) {
    return dateObj.toISOString().slice(0, 10);
  }
}

/**
 * Logika deterministik murni untuk menghitung status termin cicilan.
 * Status:
 * - 'paid'    : pembayaran terverifikasi >= nominal target termin
 * - 'pending' : belum lunas, namun terdapat pembayaran yang menunggu verifikasi admin
 * - 'overdue' : belum lunas, tidak ada pending, dan tanggal hari ini (WIB) melampaui due_date
 * - 'unpaid'  : belum lunas dan belum melampaui tanggal jatuh tempo
 */
export function calculateTermStatus({
  target_amount,
  verified_amount = 0,
  pending_amount = 0,
  due_date,
  currentDateStr = null
}) {
  const target = Number(target_amount || 0);
  const verified = Number(verified_amount || 0);
  const pending = Number(pending_amount || 0);
  const today = currentDateStr || getJakartaCurrentDateStr();

  if (verified >= target && target > 0) {
    return 'paid';
  }

  if (pending > 0) {
    return 'pending';
  }

  if (due_date && today > String(due_date).slice(0, 10)) {
    return 'overdue';
  }

  return 'unpaid';
}

/**
 * Validasi input data termin saat dibuat atau diubah oleh admin.
 */
export function validateTermInput(payload) {
  const errors = [];
  const termNumber = Number(payload.term_number);
  const amount = Number(payload.amount ?? payload.target_amount);

  if (!payload.jamaah_id) {
    errors.push('ID Jamaah wajib diisi.');
  }

  if (!termNumber || termNumber <= 0 || !Number.isInteger(termNumber)) {
    errors.push('Nomor urut termin harus berupa bilangan bulat positif (>= 1).');
  }

  if (!payload.title || !String(payload.title).trim()) {
    errors.push('Judul termin cicilan wajib diisi.');
  }

  if (isNaN(amount) || amount <= 0) {
    errors.push('Nominal target termin harus lebih besar dari Rp 0.');
  }

  if (!payload.due_date || !/^\d{4}-\d{2}-\d{2}/.test(String(payload.due_date))) {
    errors.push('Tanggal jatuh tempo wajib diisi dengan format YYYY-MM-DD yang valid.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validasi nominal pembayaran yang diajukan terhadap sisa kewajiban termin.
 * Mencegah over-alokasi pada layer aplikasi sebelum proses submit.
 */
export function validatePaymentAgainstTerm({ term, paymentAmount }) {
  const amount = Number(paymentAmount);
  if (isNaN(amount) || amount <= 0) {
    return {
      isValid: false,
      error: 'Nominal pembayaran harus lebih besar dari Rp 0.'
    };
  }

  if (!term) {
    return {
      isValid: true,
      error: null
    };
  }

  const remaining = Number(term.remaining_amount ?? (term.target_amount - (term.verified_amount || 0)));
  if (amount > remaining) {
    return {
      isValid: false,
      error: `Nominal pembayaran (Rp ${amount.toLocaleString('id-ID')}) melebihi sisa kewajiban termin ini (Rp ${remaining.toLocaleString('id-ID')}).`
    };
  }

  return {
    isValid: true,
    error: null
  };
}

/**
 * Memetakan record DB atau objek raw menjadi representasi termin yang bersih dan konsisten.
 */
export function mapInstallmentTerm(t) {
  if (!t) return null;

  const targetAmount = Number(t.target_amount ?? t.amount ?? 0);
  const verifiedAmount = Number(t.verified_amount ?? 0);
  const pendingAmount = Number(t.pending_amount ?? 0);
  const remainingAmount = Number(
    t.remaining_amount ?? Math.max(0, targetAmount - verifiedAmount)
  );

  const status = t.status || calculateTermStatus({
    target_amount: targetAmount,
    verified_amount: verifiedAmount,
    pending_amount: pendingAmount,
    due_date: t.due_date
  });

  return {
    id: t.term_id || t.id,
    term_id: t.term_id || t.id,
    jamaah_id: t.jamaah_id,
    term_number: Number(t.term_number || 1),
    nomor_termin: Number(t.term_number || 1),
    title: t.title || 'Termin',
    judul: t.title || 'Termin',
    target_amount: targetAmount,
    nominal_target: targetAmount,
    amount: targetAmount,
    due_date: t.due_date,
    tanggal_jatuh_tempo: t.due_date,
    notes: t.notes || '',
    catatan: t.notes || '',
    verified_amount: verifiedAmount,
    terbayar_sah: verifiedAmount,
    pending_amount: pendingAmount,
    menunggu_verifikasi: pendingAmount,
    remaining_amount: remainingAmount,
    sisa_kewajiban: remainingAmount,
    status,
    created_by: t.created_by,
    created_at: t.created_at,
    updated_at: t.updated_at
  };
}

export const DEMO_INSTALLMENT_TERMS = [
  {
    id: 'demo-term-1',
    term_id: 'demo-term-1',
    jamaah_id: 'demo-jamaah-uuid-001',
    term_number: 1,
    title: 'Uang Muka (DP Awal)',
    target_amount: 10000000,
    amount: 10000000,
    due_date: '2026-09-05',
    notes: 'Pembayaran DP pendaftaran paket ibadah',
    verified_amount: 10000000,
    pending_amount: 0,
    remaining_amount: 0,
    status: 'paid',
    created_at: '2026-08-20T08:00:00Z'
  },
  {
    id: 'demo-term-2',
    term_id: 'demo-term-2',
    jamaah_id: 'demo-jamaah-uuid-001',
    term_number: 2,
    title: 'Cicilan Tahap 1',
    target_amount: 10000000,
    amount: 10000000,
    due_date: '2026-10-10',
    notes: 'Cicilan pertengahan',
    verified_amount: 5000000,
    pending_amount: 5000000,
    remaining_amount: 5000000,
    status: 'pending',
    created_at: '2026-08-20T08:00:00Z'
  },
  {
    id: 'demo-term-3',
    term_id: 'demo-term-3',
    jamaah_id: 'demo-jamaah-uuid-001',
    term_number: 3,
    title: 'Pelunasan Akhir',
    target_amount: 15000000,
    amount: 15000000,
    due_date: '2026-12-01',
    notes: 'Pelunasan maksimal H-30 keberangkatan',
    verified_amount: 0,
    pending_amount: 0,
    remaining_amount: 15000000,
    status: 'unpaid',
    created_at: '2026-08-20T08:00:00Z'
  }
];

export const installmentService = {
  /**
   * Mengambil daftar seluruh termin cicilan milik seorang jamaah.
   */
  getTermsByJamaah: async (jamaahId) => {
    if (!jamaahId) return [];

    if (
      jamaahId === 'demo-jamaah-uuid-001' ||
      jamaahId === 'demo-jamaah-id-456' ||
      (typeof jamaahId === 'string' && jamaahId.startsWith('demo-'))
    ) {
      return DEMO_INSTALLMENT_TERMS.map(mapInstallmentTerm);
    }

    try {
      const { data, error } = await supabase
        .from('v_installment_terms_summary')
        .select('*')
        .eq('jamaah_id', jamaahId)
        .order('term_number', { ascending: true });

      if (error) {
        console.error('[installmentService] Error getTermsByJamaah:', error.message);
        throw error;
      }

      return (data || []).map(mapInstallmentTerm);
    } catch (e) {
      if (typeof jamaahId === 'string' && jamaahId.startsWith('demo-')) {
        return DEMO_INSTALLMENT_TERMS.map(mapInstallmentTerm);
      }
      throw e;
    }
  },

  /**
   * Mengambil satu termin spesifik berdasarkan ID termin.
   */
  getTermById: async (termId) => {
    if (!termId) return null;

    if (typeof termId === 'string' && termId.startsWith('demo-')) {
      const found = DEMO_INSTALLMENT_TERMS.find(t => t.id === termId);
      return found ? mapInstallmentTerm(found) : null;
    }

    const { data, error } = await supabase
      .from('v_installment_terms_summary')
      .select('*')
      .eq('term_id', termId)
      .maybeSingle();

    if (error) {
      console.error('[installmentService] Error getTermById:', error.message);
      throw error;
    }

    return mapInstallmentTerm(data);
  },

  /**
   * Membuat termin cicilan baru untuk jamaah (Khusus Admin).
   */
  createTerm: async (payload, adminId) => {
    const validation = validateTermInput(payload);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(' '));
    }

    const insertData = {
      jamaah_id: payload.jamaah_id,
      term_number: Number(payload.term_number),
      title: String(payload.title).trim(),
      amount: Number(payload.amount ?? payload.target_amount),
      due_date: String(payload.due_date).slice(0, 10),
      notes: (payload.notes || '').trim() || null,
      created_by: adminId || null
    };

    const { data, error } = await supabase
      .from('installment_terms')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('[installmentService] Error createTerm:', error.message);
      if (error.code === '23505') {
        throw new Error(`Nomor termin ${payload.term_number} sudah ada untuk jamaah ini.`);
      }
      throw error;
    }

    return mapInstallmentTerm(data);
  },

  /**
   * Mengubah data termin cicilan (Khusus Admin).
   */
  updateTerm: async (termId, payload, adminId) => {
    const validation = validateTermInput(payload);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(' '));
    }

    const updateData = {
      term_number: Number(payload.term_number),
      title: String(payload.title).trim(),
      amount: Number(payload.amount ?? payload.target_amount),
      due_date: String(payload.due_date).slice(0, 10),
      notes: (payload.notes || '').trim() || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('installment_terms')
      .update(updateData)
      .eq('id', termId)
      .select()
      .single();

    if (error) {
      console.error('[installmentService] Error updateTerm:', error.message);
      throw error;
    }

    return mapInstallmentTerm(data);
  },

  /**
   * Menghapus termin cicilan (Khusus Admin).
   * Mencegah penghapusan jika termin sudah memiliki riwayat pembayaran terverifikasi atau pending.
   */
  deleteTerm: async (termId) => {
    // 1. Cek apakah ada pembayaran yang terikat pada termin ini
    const { data: linkedPayments, error: checkError } = await supabase
      .from('payments')
      .select('id, status, amount')
      .eq('installment_term_id', termId);

    if (checkError) {
      console.error('[installmentService] Error check linked payments:', checkError.message);
      throw checkError;
    }

    const activePayments = (linkedPayments || []).filter(
      p => p.status === 'verified' || p.status === 'pending'
    );

    if (activePayments.length > 0) {
      throw new Error(
        `Termin tidak dapat dihapus karena memiliki ${activePayments.length} transaksi pembayaran terhubung.`
      );
    }

    const { error: deleteError } = await supabase
      .from('installment_terms')
      .delete()
      .eq('id', termId);

    if (deleteError) {
      console.error('[installmentService] Error deleteTerm:', deleteError.message);
      throw deleteError;
    }

    return true;
  }
};
