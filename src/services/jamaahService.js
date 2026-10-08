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

const DEMO_JAMAAH = {
  id: 'demo-jamaah-uuid-001',
  jamaah_id: 'demo-jamaah-uuid-001',
  profile_id: 'demo-jamaah-id-456',
  nik: '3201123456780001',
  nama_lengkap: 'H. Muhammad Fauzan',
  full_name: 'H. Muhammad Fauzan',
  no_telepon: '081234567890',
  phone: '081234567890',
  paket_id: 'demo-pkg-1',
  package_id: 'demo-pkg-1',
  status_pembayaran: 'Cicilan',
  status_pelunasan: 'Cicilan',
  total_terbayar: 15000000,
  pending_verifikasi: 5000000,
  sisa_tagihan: 20000000,
  dokumen_persentase: 67,
  persentase_dokumen: 67,
  status_keberangkatan: 'Dokumen Diproses',
};

export const jamaahService = {
  getJamaah: async () => {
    try {
      const { data, error } = await supabase
        .from('v_jamaah_billing_summary')
        .select('*');
      if (error) throw error;
      
      const mapped = (data || []).map(mapJamaah);
      return mapped.length > 0 ? mapped : [DEMO_JAMAAH];
    } catch (e) {
      return [DEMO_JAMAAH];
    }
  },

  getMyJamaah: async (profileId) => {
    // 1. Dukungan instan untuk akun demo
    if (profileId === 'demo-jamaah-id-456' || (typeof profileId === 'string' && profileId.startsWith('demo-'))) {
      return { ...DEMO_JAMAAH, profile_id: profileId };
    }

    // 2. Akun riil Supabase
    try {
      const { data, error } = await supabase
        .from('v_jamaah_billing_summary')
        .select('*')
        .eq('profile_id', profileId)
        .single();
        
      if (error) throw error;
      return mapJamaah(data);
    } catch (err) {
      throw err;
    }
  },

  getJamaahById: async (id) => {
    if (id === 'demo-jamaah-uuid-001' || id === 'demo-jamaah-id-456' || id === 1 || id === '1' || (typeof id === 'string' && id.startsWith('demo-'))) {
      return DEMO_JAMAAH;
    }

    try {
      const { data, error } = await supabase
        .from('v_jamaah_billing_summary')
        .select('*')
        .eq('jamaah_id', id)
        .single();
      if (error) throw error;
      return mapJamaah(data);
    } catch (err) {
      if (typeof id === 'string' && id.startsWith('demo-')) {
        return DEMO_JAMAAH;
      }
      throw err;
    }
  },

  addJamaah: async (payload) => {
    const { data, error } = await supabase
      .from('jamaah')
      .insert([{
        profile_id: payload.profile_id,
        nik: payload.nik,
        passport_number: payload.nomor_paspor || null,
        gender: payload.jenis_kelamin,
        phone: payload.no_telepon,
        address: payload.alamat,
        package_id: payload.paket_id || null,
        birth_date: payload.tanggal_lahir,
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
