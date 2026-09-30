import { supabase } from './supabase';
import { jamaahService } from './jamaahService';

export const paymentService = {
  getPaymentsByJamaah: async (jamaahId) => {
    const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('jamaah_id', jamaahId)
        .order('payment_date', { ascending: false });
        
    if (error) throw error;
    
    // Map db fields to UI fields
    return data.map(p => ({
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
        catatan_admin: p.admin_notes || p.rejection_reason || ''
    }));
  },
  
  getAllPayments: async () => {
    const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('payment_date', { ascending: false });
        
    if (error) throw error;
    
    return data.map(p => ({
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
        catatan_admin: p.admin_notes || p.rejection_reason || ''
    }));
  },
  
  getPendingTransfers: async () => {
    const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('status', 'pending')
        .eq('payment_method', 'transfer')
        .order('payment_date', { ascending: false });
        
    if (error) throw error;
    
    return data.map(p => ({
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
        catatan_admin: p.admin_notes || p.rejection_reason || ''
    }));
  },

  // Jamaah mengajukan transfer
  submitTransfer: async (payload) => {
    const jamaah = await jamaahService.getJamaahById(payload.jamaah_id);
    if (payload.nominal <= 0 || payload.nominal > jamaah.sisa_tagihan) {
        throw new Error(`Nominal tidak valid. Sisa tagihan Anda: Rp ${jamaah.sisa_tagihan.toLocaleString('id-ID')}`);
    }

    const { data, error } = await supabase
        .from('payments')
        .insert([{
            jamaah_id: payload.jamaah_id,
            amount: payload.nominal,
            payment_type: payload.jenis,
            payment_method: 'transfer',
            payment_date: payload.tanggal || new Date().toISOString().split('T')[0],
            bank_name: payload.bank_asal,
            reference_number: payload.no_referensi,
            status: 'pending',
            proof_file_path: payload.bukti_url
        }])
        .select()
        .single();
        
    if (error) throw error;
    return data;
  },

  // Admin mencatat cash
  submitCash: async (payload) => {
    const jamaah = await jamaahService.getJamaahById(payload.jamaah_id);
    if (payload.nominal <= 0 || payload.nominal > jamaah.sisa_tagihan) {
        throw new Error(`Nominal tidak valid. Sisa tagihan jamaah: Rp ${jamaah.sisa_tagihan.toLocaleString('id-ID')}`);
    }

    const { data, error } = await supabase
        .from('payments')
        .insert([{
            jamaah_id: payload.jamaah_id,
            amount: payload.nominal,
            payment_type: payload.jenis,
            payment_method: 'cash',
            payment_date: payload.tanggal || new Date().toISOString().split('T')[0],
            status: 'verified',
            admin_notes: payload.catatan
        }])
        .select()
        .single();
        
    if (error) throw error;
    
    // Not needed to call recalculate explicitly if we rely on the SQL view to get the billing status!
    // The view `v_jamaah_billing_summary` will automatically aggregate this new 'verified' payment.
    return data;
  },

  // Admin verifikasi transfer
  verifyTransfer: async (paymentId, jamaahId, status, catatan) => {
    const updateData = { status: status };
    if (status === 'rejected') updateData.rejection_reason = catatan;
    if (status === 'verified') updateData.admin_notes = catatan;
    
    const { data, error } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', paymentId)
        .select()
        .single();
        
    if (error) throw error;
    return data;
  },
  
  // Note: recalculateJamaahFinance is no longer needed since we use a Database View!
  recalculateJamaahFinance: async (jamaahId) => {
      // Logic has moved to PostgreSQL View `v_jamaah_billing_summary`
  }
};
