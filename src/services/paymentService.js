import { supabase } from './supabase';

const PAYMENT_BUCKET = 'payment-proofs';

function mapPayment(p) {
  return {
    id: p.id,
    jamaah_id: p.jamaah_id,
    metode: p.payment_method,
    jenis: p.payment_type,
    nominal: p.amount,
    bank_asal: p.bank_name,
    no_referensi: p.reference_number,
    tanggal: p.payment_date,
    status: p.status,
    bukti_url: p.proof_file_path,
    catatan_admin: p.admin_notes || p.rejection_reason || '',
    verified_by: p.verified_by,
    verified_at: p.verified_at,
  };
}

async function getJamaahBilling(jamaahId) {
  const { data, error } = await supabase
    .from('v_jamaah_billing_summary')
    .select('*')
    .eq('jamaah_id', jamaahId)
    .single();

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
  const path = `${jamaahId}/${crypto.randomUUID()}.${ext}`;

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

export const paymentService = {
  getPaymentsByJamaah: async (jamaahId) => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('jamaah_id', jamaahId)
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapPayment);
  },

  getAllPayments: async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapPayment);
  },

  getPendingTransfers: async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('status', 'pending')
      .eq('payment_method', 'transfer')
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapPayment);
  },

  submitTransfer: async (payload) => {
    const jamaah = await getJamaahBilling(payload.jamaah_id);

    if (payload.jenis === 'full' && payload.nominal !== Number(jamaah.sisa_tagihan)) {
      throw new Error('Bayar penuh harus sama dengan sisa tagihan.');
    }

    if (payload.nominal <= 0 || payload.nominal > Number(jamaah.sisa_tagihan)) {
      throw new Error(
        `Nominal tidak valid. Sisa tagihan: Rp ${Number(jamaah.sisa_tagihan).toLocaleString('id-ID')}`
      );
    }

    const proofPath = await uploadPaymentProof(
      payload.bukti_file,
      payload.jamaah_id
    );

    const { data, error } = await supabase
      .from('payments')
      .insert([{
        jamaah_id: payload.jamaah_id,
        amount: payload.nominal,
        payment_type: payload.jenis,
        payment_method: 'transfer',
        payment_date: payload.tanggal || new Date().toISOString().slice(0, 10),
        bank_name: payload.bank_asal,
        reference_number: payload.no_referensi || null,
        proof_file_path: proofPath,
        status: 'pending',
      }])
      .select()
      .single();

    if (error) {
      // Jika insert gagal, hapus file agar tidak menjadi file yatim.
      await supabase.storage.from(PAYMENT_BUCKET).remove([proofPath]);
      throw error;
    }

    return data;
  },

  submitCash: async (payload, adminId) => {
    const jamaah = await getJamaahBilling(payload.jamaah_id);

    if (payload.jenis === 'full' && payload.nominal !== Number(jamaah.sisa_tagihan)) {
      throw new Error('Bayar penuh harus sama dengan sisa tagihan.');
    }

    if (payload.nominal <= 0 || payload.nominal > Number(jamaah.sisa_tagihan)) {
      throw new Error(
        `Nominal tidak valid. Sisa tagihan: Rp ${Number(jamaah.sisa_tagihan).toLocaleString('id-ID')}`
      );
    }

    const { data, error } = await supabase
      .from('payments')
      .insert([{
        jamaah_id: payload.jamaah_id,
        amount: payload.nominal,
        payment_type: payload.jenis,
        payment_method: 'cash',
        payment_date: payload.tanggal || new Date().toISOString().slice(0, 10),
        status: 'verified',
        admin_notes: payload.catatan || null,
        verified_by: adminId,
        verified_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  verifyTransfer: async (paymentId, adminId, status, catatan) => {
    if (!['verified', 'rejected'].includes(status)) {
      throw new Error('Status verifikasi tidak valid.');
    }

    const updateData = {
      status,
      verified_by: adminId,
      verified_at: new Date().toISOString(),
    };

    if (status === 'rejected') {
      updateData.rejection_reason = catatan || 'Pembayaran ditolak admin.';
    } else {
      updateData.admin_notes = catatan || null;
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

    if (error) throw error;
    return data;
  },

  getPaymentProofUrl: async (path) => {
    if (!path) return null;
    const { data, error } = await supabase.storage
      .from(PAYMENT_BUCKET)
      .createSignedUrl(path, 300);

    if (error) throw error;
    return data.signedUrl;
  },
};
