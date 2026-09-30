import { supabase } from './supabase';

function mapJamaah(j) {
  return {
    id: j.jamaah_id,
    profile_id: j.profile_id,
    nik: j.nik,
    nama_lengkap: j.full_name,
    no_telepon: j.phone,
    paket_id: j.package_id,
    status_pembayaran: j.status_pelunasan,
    total_terbayar: Number(j.total_terbayar || 0),
    pending_verifikasi: Number(j.pending_verifikasi || 0),
    sisa_tagihan: Number(j.sisa_tagihan || 0),
    dokumen_persentase: Number(j.persentase_dokumen || 0),
    status_keberangkatan:
      Number(j.persentase_dokumen || 0) === 100 && Number(j.sisa_tagihan || 0) === 0
        ? 'Siap Berangkat'
        : Number(j.persentase_dokumen || 0) > 0
        ? 'Dokumen Diproses'
        : 'Pendaftaran',
  };
}

export const jamaahService = {
  getJamaah: async () => {
    const { data, error } = await supabase
      .from('v_jamaah_billing_summary')
      .select('*');
    if (error) throw error;
    
    return data.map(mapJamaah);
  },

  getMyJamaah: async (profileId) => {
    const { data, error } = await supabase
      .from('v_jamaah_billing_summary')
      .select('*')
      .eq('profile_id', profileId)
      .single();
    if (error) throw error;
    return mapJamaah(data);
  },

  getJamaahById: async (id) => {
    const { data, error } = await supabase
      .from('v_jamaah_billing_summary')
      .select('*')
      .eq('jamaah_id', id)
      .single();
    if (error) throw error;
    return mapJamaah(data);
  },

  addJamaah: async (payload) => {
    const { data, error } = await supabase
      .from('jamaah')
      .insert([{
        nik: payload.nik,
        gender: payload.jenis_kelamin,
        phone: payload.no_telepon,
        address: payload.alamat,
        package_id: payload.paket_id,
        birth_date: '1990-01-01',
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateJamaah: async (id, payload) => {
    const { data, error } = await supabase
      .from('jamaah')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  deleteJamaah: async (id) => {
    const { error } = await supabase
      .from('jamaah')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },
  
  updateDokumenPersentase: async (id, percent) => {
      // In a real Supabase DB with views, you just fetch the view again.
  }
};
