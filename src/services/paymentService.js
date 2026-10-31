import { supabase } from './supabase.js';
import { notificationService } from './notificationService.js';

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
    // 1. Penanganan khusus demo mode: langsung proses tanpa memanggil database billing
    if (typeof payload.jamaah_id === 'string' && payload.jamaah_id.startsWith('demo-')) {
      const nominalNum = Number(payload.nominal ?? payload.amount ?? 0);
      const jenis = payload.jenis ?? payload.payment_type ?? 'installment';

      if (nominalNum <= 0) {
        throw new Error('Nominal tidak valid.');
      }

      const tgl = payload.tanggal ?? payload.payment_date;
      const paymentDate = tgl ? String(tgl).slice(0, 10) : new Date().toISOString().slice(0, 10);
      const demoId = `demo-pay-${Date.now()}`;
      const demoRecord = {
        id: demoId,
        jamaah_id: payload.jamaah_id,
        payment_method: 'transfer',
        metode: 'transfer',
        payment_type: jenis,
        jenis: jenis,
        amount: nominalNum,
        nominal: nominalNum,
        bank_name: payload.bank_asal ?? payload.bank_name ?? 'Bank Mandiri',
        bank_asal: payload.bank_asal ?? payload.bank_name ?? 'Bank Mandiri',
        reference_number: payload.no_referensi ?? payload.reference_number ?? 'TRX-DEMO',
        no_referensi: payload.no_referensi ?? payload.reference_number ?? 'TRX-DEMO',
        payment_date: paymentDate,
        tanggal: paymentDate,
        status: 'pending',
        proof_file_path: null,
        bukti_url: null,
        admin_notes: '',
        catatan_admin: '',
        created_at: new Date().toISOString()
      };
      DEMO_PAYMENTS.unshift(demoRecord);

      // Notifikasi instan untuk Jamaah
      await notificationService.sendNotification({
        profileId: 'demo-jamaah-id-456',
        jamaahId: payload.jamaah_id,
        type: 'payment_submitted',
        title: 'Konfirmasi Transfer Terkirim',
        message: `Pengajuan pembayaran transfer sebesar Rp ${nominalNum.toLocaleString('id-ID')} telah kami terima dan sedang menunggu verifikasi admin.`,
        relatedPaymentId: demoId,
        dedupKey: `demo_pay_sub_${demoId}`
      });

      // Notifikasi instan untuk Administrator
      await notificationService.notifyAdmins({
        type: 'admin_new_payment',
        title: 'Pembayaran Transfer Masuk',
        message: `Jamaah telah mengajukan transfer sebesar Rp ${nominalNum.toLocaleString('id-ID')}. Mohon verifikasi bukti transaksi.`,
        jamaahId: payload.jamaah_id,
        relatedPaymentId: demoId,
        dedupKey: `admin_pay_${demoId}`
      });

      return mapPayment(demoRecord);
    }

    // 2. Alur Produksi Akun Nyata: validasi saldo tagihan via view v_jamaah_billing_summary
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

    const proofFile = payload.bukti_file ?? payload.file;
    const proofPath = await uploadPaymentProof(
      proofFile,
      payload.jamaah_id
    );

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

    const result = mapPayment(data);

    // Kirim notifikasi ke Jamaah dan Admin (non-blocking)
    try {
      const { data: jData } = await supabase
        .from('jamaah')
        .select('profile_id')
        .eq('id', payload.jamaah_id)
        .maybeSingle();

      if (jData?.profile_id) {
        await notificationService.sendNotification({
          profileId: jData.profile_id,
          jamaahId: payload.jamaah_id,
          type: 'payment_submitted',
          title: 'Konfirmasi Transfer Terkirim',
          message: `Pengajuan transfer sebesar Rp ${nominalNum.toLocaleString('id-ID')} berhasil dikirim dan menunggu verifikasi admin.`,
          relatedPaymentId: data?.id,
          dedupKey: `pay_submitted_${data?.id}`
        });
      }

      await notificationService.notifyAdmins({
        type: 'admin_new_payment',
        title: 'Pembayaran Transfer Masuk',
        message: `Jamaah telah mengajukan transfer sebesar Rp ${nominalNum.toLocaleString('id-ID')}. Mohon verifikasi bukti transaksi.`,
        jamaahId: payload.jamaah_id,
        relatedPaymentId: data?.id,
        dedupKey: `admin_pay_${data?.id}`
      });
    } catch (e) {
      console.warn('[paymentService] notify error:', e);
    }

    return result;
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

    // Penanganan khusus demo mode
    if (typeof paymentId === 'string' && paymentId.startsWith('demo-')) {
      const pIdx = DEMO_PAYMENTS.findIndex(p => p.id === paymentId);
      if (pIdx >= 0) {
        DEMO_PAYMENTS[pIdx].status = status;
        DEMO_PAYMENTS[pIdx].verified_by = adminId;
        DEMO_PAYMENTS[pIdx].verified_at = new Date().toISOString();
        if (status === 'rejected') {
          DEMO_PAYMENTS[pIdx].rejection_reason = (catatan || '').trim() || 'Pembayaran ditolak admin.';
        } else {
          DEMO_PAYMENTS[pIdx].admin_notes = (catatan || '').trim() || 'Pembayaran diverifikasi admin.';
        }
      }

      const amountStr = DEMO_PAYMENTS[pIdx]?.nominal ? ` sebesar Rp ${DEMO_PAYMENTS[pIdx].nominal.toLocaleString('id-ID')}` : '';
      if (status === 'verified') {
        await notificationService.sendNotification({
          profileId: 'demo-jamaah-id-456',
          jamaahId: 'demo-jamaah-uuid-001',
          type: 'payment_verified',
          title: 'Pembayaran Terverifikasi',
          message: `Alhamdulillah, transfer pembayaran Anda${amountStr} telah diverifikasi sah oleh admin.`,
          relatedPaymentId: paymentId,
          dedupKey: `demo_pay_ver_${paymentId}`
        });
      } else {
        await notificationService.sendNotification({
          profileId: 'demo-jamaah-id-456',
          jamaahId: 'demo-jamaah-uuid-001',
          type: 'payment_rejected',
          title: 'Pembayaran Ditolak',
          message: `Pengajuan pembayaran Anda ditolak. Alasan: ${(catatan || '').trim() || 'Bukti transfer tidak valid.'}. Silakan ajukan ulang.`,
          relatedPaymentId: paymentId,
          dedupKey: `demo_pay_rej_${paymentId}`
        });
      }

      return DEMO_PAYMENTS[pIdx] ? mapPayment(DEMO_PAYMENTS[pIdx]) : null;
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

    // Trigger pembaruan real-time ke UI
    notificationService.broadcastNotificationUpdate?.();

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
