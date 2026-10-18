import { supabase } from './supabase';

const PAYMENT_BUCKET = 'payment-proofs';

function mapPayment(p) {
  if (!p) return null;
  return {
    id: p.id,
    jamaah_id: p.jamaah_id,
    payment_method: p.payment_method,
    metode: p.payment_method,
    payment_type: p.payment_type,
    jenis: p.payment_type,
    amount: Number(p.amount || 0),
    nominal: Number(p.amount || 0),
    bank_name: p.bank_name || '',
    bank_asal: p.bank_name || '',
    reference_number: p.reference_number || '',
    no_referensi: p.reference_number || '',
    payment_date: p.payment_date,
    tanggal: p.payment_date,
    status: p.status,
    proof_file_path: p.proof_file_path,
    bukti_url: p.proof_file_path,
    admin_notes: p.admin_notes || '',
    rejection_reason: p.rejection_reason || '',
    catatan_admin: p.admin_notes || p.rejection_reason || '',
    verified_by: p.verified_by,
    verified_at: p.verified_at,
    created_at: p.created_at,
    updated_at: p.updated_at
  };
}

async function getJamaahBilling(jamaahId) {
  const { data, error } = await supabase
    .from('v_jamaah_billing_summary')
    .select('*')
    .eq('jamaah_id', jamaahId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function uploadPaymentProof(file, jamaahId) {
  if (!file) throw new Error('Bukti transfer wajib diunggah.');

  const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowed.includes(file.type)) {
    throw new Error('File harus JPG, PNG, atau PDF.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran file maksimal 5 MB.');
  }

  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${jamaahId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;

  const { error } = await supabase.storage
    .from(PAYMENT_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (error) throw error;
  return path;
}

const DEMO_PAYMENTS = [
  {
    id: 'demo-pay-1',
    jamaah_id: 'demo-jamaah-uuid-001',
    metode: 'transfer',
    payment_method: 'transfer',
    jenis: 'installment',
    payment_type: 'installment',
    nominal: 10000000,
    amount: 10000000,
    bank_asal: 'Bank Syariah Indonesia (BSI)',
    bank_name: 'Bank Syariah Indonesia (BSI)',
    no_referensi: 'TRX-BSI-99281',
    reference_number: 'TRX-BSI-99281',
    tanggal: '2026-09-01',
    payment_date: '2026-09-01',
    status: 'verified',
    bukti_url: null,
    proof_file_path: null,
    catatan_admin: 'Pembayaran DP Awal Paket Umrah terverifikasi.',
    admin_notes: 'Pembayaran DP Awal Paket Umrah terverifikasi.',
    verified_by: 'demo-admin-id-123',
    verified_at: '2026-09-01T10:00:00Z',
    jamaah_name: 'H. Muhammad Fauzan',
    package_name: 'Umrah Reguler Awal Tahun 2027'
  },
  {
    id: 'demo-pay-2',
    jamaah_id: 'demo-jamaah-uuid-001',
    metode: 'transfer',
    payment_method: 'transfer',
    jenis: 'installment',
    payment_type: 'installment',
    nominal: 5000000,
    amount: 5000000,
    bank_asal: 'Bank Mandiri',
    bank_name: 'Bank Mandiri',
    no_referensi: 'MDR-20260920-881',
    reference_number: 'MDR-20260920-881',
    tanggal: '2026-09-20',
    payment_date: '2026-09-20',
    status: 'verified',
    bukti_url: null,
    proof_file_path: null,
    catatan_admin: 'Cicilan ke-2 terverifikasi.',
    admin_notes: 'Cicilan ke-2 terverifikasi.',
    verified_by: 'demo-admin-id-123',
    verified_at: '2026-09-20T14:30:00Z',
    jamaah_name: 'H. Muhammad Fauzan',
    package_name: 'Umrah Reguler Awal Tahun 2027'
  },
  {
    id: 'demo-pay-3',
    jamaah_id: 'demo-jamaah-uuid-001',
    metode: 'transfer',
    payment_method: 'transfer',
    jenis: 'installment',
    payment_type: 'installment',
    nominal: 5000000,
    amount: 5000000,
    bank_asal: 'Bank Syariah Indonesia (BSI)',
    bank_name: 'Bank Syariah Indonesia (BSI)',
    no_referensi: 'BSI-20261002-109',
    reference_number: 'BSI-20261002-109',
    tanggal: '2026-10-02',
    payment_date: '2026-10-02',
    status: 'pending',
    bukti_url: null,
    proof_file_path: null,
    catatan_admin: '',
    admin_notes: '',
    verified_by: null,
    verified_at: null,
    jamaah_name: 'H. Muhammad Fauzan',
    package_name: 'Umrah Reguler Awal Tahun 2027'
  }
];

export const paymentService = {
  getPaymentsByJamaah: async (jamaahId) => {
    if (jamaahId === 'demo-jamaah-uuid-001' || jamaahId === 'demo-jamaah-id-456' || (typeof jamaahId === 'string' && jamaahId.startsWith('demo-'))) {
      return DEMO_PAYMENTS;
    }

    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('jamaah_id', jamaahId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return (data || []).map(mapPayment);
    } catch (e) {
      if (typeof jamaahId === 'string' && jamaahId.startsWith('demo-')) {
        return DEMO_PAYMENTS;
      }
      throw e;
    }
  },

  getAllPayments: async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          jamaah (
            profile_id,
            profiles:profile_id ( full_name )
          )
        `)
        .order('payment_date', { ascending: false });

      if (error) {
        console.error('[paymentService] Error getAllPayments:', error.message);
        throw error;
      }
      return (data || []).map(p => {
        const mapped = mapPayment(p);
        mapped.jamaah_name = p.jamaah?.profiles?.full_name || 'Jamaah';
        return mapped;
      });
    } catch (e) {
      console.error('[paymentService] Exception getAllPayments:', e);
      throw e;
    }
  },

  getPendingTransfers: async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          jamaah (
            package_id,
            profile_id,
            packages:package_id ( name ),
            profiles:profile_id ( full_name )
          )
        `)
        .eq('status', 'pending')
        .eq('payment_method', 'transfer')
        .order('payment_date', { ascending: false });

      if (error) {
        console.error('[paymentService] Error getPendingTransfers:', error.message);
        throw error;
      }
      return (data || []).map(p => {
        const mapped = mapPayment(p);
        mapped.jamaah_name = p.jamaah?.profiles?.full_name || 'Jamaah';
        mapped.package_name = p.jamaah?.packages?.name || '-';
        return mapped;
      });
    } catch (e) {
      console.error('[paymentService] Exception getPendingTransfers:', e);
      throw e;
    }
  },

  submitTransfer: async (payload) => {
    const jamaah = await getJamaahBilling(payload.jamaah_id);
    const nominalNum = Number(payload.nominal ?? payload.amount ?? 0);
    const sisa = Number(jamaah?.sisa_tagihan ?? 0);
    const jenis = payload.jenis ?? payload.payment_type ?? 'installment';

    if (jenis === 'full' && sisa > 0 && nominalNum !== sisa) {
      throw new Error(`Bayar penuh harus sama persis dengan sisa tagihan (Rp ${sisa.toLocaleString('id-ID')}).`);
    }

    if (nominalNum <= 0 || (sisa > 0 && nominalNum > sisa)) {
      throw new Error(
        `Nominal tidak valid. Sisa tagihan: Rp ${sisa.toLocaleString('id-ID')}`
      );
    }

    const proofFile = payload.bukti_file ?? payload.file;
    const proofPath = await uploadPaymentProof(
      proofFile,
      payload.jamaah_id
    );

    const tgl = payload.tanggal ?? payload.payment_date;
    const paymentDate = tgl ? String(tgl).slice(0, 10) : new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('payments')
      .insert([{
        jamaah_id: payload.jamaah_id,
        amount: nominalNum,
        payment_type: jenis,
        payment_method: 'transfer',
        payment_date: paymentDate,
        bank_name: payload.bank_asal ?? payload.bank_name ?? null,
        reference_number: payload.no_referensi ?? payload.reference_number ?? null,
        proof_file_path: proofPath,
        status: 'pending',
      }])
      .select()
      .single();

    if (error) {
      await supabase.storage.from(PAYMENT_BUCKET).remove([proofPath]);
      console.error('[paymentService] Error submitTransfer:', error.message);
      throw error;
    }

    return mapPayment(data);
  },

  submitCash: async (payload, adminId) => {
    const jamaah = await getJamaahBilling(payload.jamaah_id);
    const nominalNum = Number(payload.nominal ?? payload.amount ?? 0);
    const sisa = Number(jamaah?.sisa_tagihan ?? 0);
    const jenis = payload.jenis ?? payload.payment_type ?? 'installment';

    if (jenis === 'full' && sisa > 0 && nominalNum !== sisa) {
      throw new Error(`Bayar penuh harus sama persis dengan sisa tagihan (Rp ${sisa.toLocaleString('id-ID')}).`);
    }

    if (nominalNum <= 0 || (sisa > 0 && nominalNum > sisa)) {
      throw new Error(
        `Nominal tidak valid. Sisa tagihan: Rp ${sisa.toLocaleString('id-ID')}`
      );
    }

    const tgl = payload.tanggal ?? payload.payment_date;
    const paymentDate = tgl ? String(tgl).slice(0, 10) : new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('payments')
      .insert([{
        jamaah_id: payload.jamaah_id,
        amount: nominalNum,
        payment_type: jenis,
        payment_method: 'cash',
        payment_date: paymentDate,
        status: 'verified',
        admin_notes: (payload.catatan ?? payload.admin_notes ?? '').trim() || 'Pembayaran tunai di kantor biro',
        verified_by: adminId || null,
        verified_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('[paymentService] Error submitCash:', error.message);
      throw error;
    }
    return mapPayment(data);
  },

  verifyTransfer: async (paymentId, adminId, status, catatan) => {
    if (!['verified', 'rejected'].includes(status)) {
      throw new Error('Status verifikasi tidak valid.');
    }

    const updateData = {
      status,
      verified_by: adminId || null,
      verified_at: new Date().toISOString(),
    };

    if (status === 'rejected') {
      updateData.rejection_reason = (catatan || '').trim() || 'Pembayaran ditolak admin.';
      updateData.admin_notes = null;
    } else {
      updateData.admin_notes = (catatan || '').trim() || 'Pembayaran diverifikasi admin.';
      updateData.rejection_reason = null;
    }

    const { data, error } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', paymentId)
      .eq('payment_method', 'transfer')
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      console.error('[paymentService] Error verifyTransfer:', error.message);
      throw error;
    }
    return mapPayment(data);
  },

  getPaymentProofUrl: async (path) => {
    if (!path) return null;
    try {
      const { data, error } = await supabase.storage
        .from(PAYMENT_BUCKET)
        .createSignedUrl(path, 300);

      if (error) {
        console.warn('Gagal membuat signed URL pembayaran:', error.message);
        return null;
      }
      return data?.signedUrl || null;
    } catch (e) {
      console.warn('Exception getPaymentProofUrl:', e);
      return null;
    }
  },
};
