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
  // Mengambil seluruh data jamaah untuk Admin
  getJamaah: async () => {
    try {
      const { data, error } = await supabase
        .from('v_jamaah_billing_summary')
        .select('*');
      if (error) {
        console.error('[jamaahService] getJamaah error:', error.message);
        throw error;
      }
      
      return (data || []).map(mapJamaah);
    } catch (e) {
      console.error('[jamaahService] Gagal memuat data jamaah:', e);
      throw e;
    }
  },

  // Mengambil data jamaah milik akun yang sedang login
  getMyJamaah: async (profileId) => {
    if (!profileId) return null;

    // Dukungan instan HANYA jika akun demo aktif
    if (typeof profileId === 'string' && profileId.startsWith('demo-')) {
      return { ...DEMO_JAMAAH, profile_id: profileId };
    }

    // Akun riil Supabase
    try {
      const { data, error } = await supabase
        .from('v_jamaah_billing_summary')
        .select('*')
        .eq('profile_id', profileId)
        .maybeSingle();
        
      if (error) {
        console.error('[jamaahService] Gagal getMyJamaah:', error.message);
        throw error;
      }
      return data ? mapJamaah(data) : null;
    } catch (err) {
      console.error('[jamaahService] Exception getMyJamaah:', err);
      throw err;
    }
  },

  // Mengambil detail 1 jamaah berdasarkan ID
  getJamaahById: async (id) => {
    if (typeof id === 'string' && id.startsWith('demo-')) {
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
      console.error('[jamaahService] getJamaahById error:', err);
      throw err;
    }
  },

  // Mendaftarkan jamaah baru
  addJamaah: async (payload) => {
    const { data, error } = await supabase
      .from('jamaah')
      .insert([{
        profile_id: payload.profile_id,
        nik: payload.nik,
        passport_number: payload.nomor_paspor || payload.passport_number || null,
        gender: payload.jenis_kelamin || payload.gender,
        phone: payload.no_telepon || payload.phone,
        address: payload.alamat || payload.address,
        package_id: payload.paket_id || payload.package_id || null,
        birth_date: payload.tanggal_lahir || payload.birth_date,
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Update data jamaah
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

  // Hapus data jamaah
  deleteJamaah: async (id) => {
    const { error } = await supabase
      .from('jamaah')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },
  
  updateDokumenPersentase: async (id, percent) => {
    // Pada arsitektur dengan SQL View, persentase dihitung otomatis real-time
  },

  // Cek apakah data onboarding jamaah sudah selesai diisi
  checkOnboardingStatus: async (profileId) => {
    if (!profileId) {
      return { completed: false, data: null };
    }
    if (typeof profileId === 'string' && profileId.startsWith('demo-')) {
      return { completed: true, data: DEMO_JAMAAH };
    }

    try {
      const { data: jamaahData, error } = await supabase
        .from('jamaah')
        .select('*')
        .eq('profile_id', profileId)
        .maybeSingle();

      if (error) {
        console.warn('[jamaahService] Gagal cek status onboarding:', error.message);
        return { completed: false, data: null, error };
      }

      // Jika belum ada record jamaah ATAU belum memilih paket ATAU belum ada NIK
      const nik = jamaahData?.nik || jamaahData?.NIK;
      const packageId = jamaahData?.package_id || jamaahData?.paket_id;
      if (!jamaahData || !packageId || !nik) {
        return { completed: false, data: jamaahData };
      }

      return { completed: true, data: jamaahData };
    } catch (e) {
      console.warn('[jamaahService] Error checkOnboardingStatus:', e);
      return { completed: false, data: null };
    }
  },

  // Simpan atau update data pendaftaran onboarding jamaah
  saveOnboardingData: async (payload) => {
    const { data: existing, error: checkError } = await supabase
      .from('jamaah')
      .select('id')
      .eq('profile_id', payload.profile_id)
      .maybeSingle();

    if (checkError) {
      console.warn('[jamaahService] Error saat memeriksa data jamaah existing:', checkError.message);
    }

    const payloadData = {
      profile_id: payload.profile_id,
      nik: payload.nik,
      passport_number: payload.passport_number || null,
      gender: payload.jenis_kelamin,
      phone: payload.no_telepon,
      address: payload.alamat,
      package_id: payload.paket_id || null,
      birth_date: payload.tanggal_lahir,
    };

    if (existing?.id) {
      const { data, error } = await supabase
        .from('jamaah')
        .update(payloadData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('jamaah')
        .insert([payloadData])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }
};
