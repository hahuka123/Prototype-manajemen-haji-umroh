import { supabase } from './supabase';

function mapJamaah(j) {
  if (!j) return null;
  const dokLengkap = Number(j.dokumen_lengkap || 0);
  const docPercent = Math.min(100, Math.round((dokLengkap / 6) * 100));
  const sisa = Number(j.sisa_tagihan || 0);
  const total = Number(j.total_terbayar || 0);
  const pending = Number(j.pending_verifikasi || 0);
  
  // Status keberangkatan / siklus jamaah
  const statusKeberangkatan = j.status || (
    docPercent === 100 && sisa === 0
      ? 'Siap Berangkat'
      : docPercent > 0
      ? 'Dokumen Diproses'
      : 'Pendaftaran'
  );

  const statusBayar = j.status_pembayaran || (
    sisa === 0 && total > 0
      ? 'Lunas'
      : total > 0
      ? 'Cicilan'
      : 'Belum Bayar'
  );

  return {
    id: j.jamaah_id,
    jamaah_id: j.jamaah_id,
    profile_id: j.profile_id,
    nik: j.nik || '',
    nama_lengkap: j.full_name || 'Jamaah',
    full_name: j.full_name || 'Jamaah',
    no_telepon: j.phone || '-',
    phone: j.phone || '-',
    paket_id: j.package_id,
    package_id: j.package_id,
    package_name: j.package_name || '-',
    package_price: Number(j.package_price || 0),
    status: j.status || statusKeberangkatan,
    status_keberangkatan: statusKeberangkatan,
    status_pembayaran: statusBayar,
    status_pelunasan: statusBayar,
    total_terbayar: total,
    pending_verifikasi: pending,
    sisa_tagihan: sisa,
    dokumen_lengkap: dokLengkap,
    dokumen_persentase: docPercent,
    persentase_dokumen: docPercent,
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
  passport_number: 'B1234567',
  nomor_paspor: 'B1234567',
  gender: 'Laki-laki',
  jenis_kelamin: 'Laki-laki',
  address: 'Jl. Merdeka No. 45, Jakarta Selatan',
  alamat: 'Jl. Merdeka No. 45, Jakarta Selatan',
  birth_date: '1985-06-15',
  tanggal_lahir: '1985-06-15',
  paket_id: 'demo-pkg-1',
  package_id: 'demo-pkg-1',
  package_name: 'Umrah Reguler Awal Tahun 2027',
  package_price: 35000000,
  status: 'Dokumen Diproses',
  status_keberangkatan: 'Dokumen Diproses',
  status_pembayaran: 'Cicilan',
  status_pelunasan: 'Cicilan',
  total_terbayar: 15000000,
  pending_verifikasi: 5000000,
  sisa_tagihan: 20000000,
  dokumen_lengkap: 4,
  dokumen_persentase: 67,
  persentase_dokumen: 67,
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

    if (typeof profileId === 'string' && profileId.startsWith('demo-')) {
      return { ...DEMO_JAMAAH, profile_id: profileId };
    }

    try {
      const [summaryRes, detailRes] = await Promise.all([
        supabase
          .from('v_jamaah_billing_summary')
          .select('*')
          .eq('profile_id', profileId)
          .maybeSingle(),
        supabase
          .from('jamaah')
          .select('*, profiles(full_name, phone)')
          .eq('profile_id', profileId)
          .maybeSingle()
      ]);

      if (summaryRes.error) {
        console.warn('[jamaahService] Gagal getMyJamaah view:', summaryRes.error.message);
      }

      if (!summaryRes.data && !detailRes.data) {
        return null;
      }

      const summary = summaryRes.data || {};
      const detail = detailRes.data || {};
      const base = mapJamaah(summary);

      return {
        ...base,
        id: detail.id || base.id,
        jamaah_id: detail.id || base.jamaah_id,
        passport_number: detail.passport_number || '',
        nomor_paspor: detail.passport_number || '',
        gender: detail.gender || 'Laki-laki',
        jenis_kelamin: detail.gender || 'Laki-laki',
        address: detail.address || '',
        alamat: detail.address || '',
        birth_date: detail.birth_date || '',
        tanggal_lahir: detail.birth_date || '',
        paket_id: detail.package_id || base.paket_id,
        package_id: detail.package_id || base.package_id
      };
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
      const [summaryRes, detailRes] = await Promise.all([
        supabase
          .from('v_jamaah_billing_summary')
          .select('*')
          .eq('jamaah_id', id)
          .maybeSingle(),
        supabase
          .from('jamaah')
          .select('*, profiles(full_name, phone)')
          .eq('id', id)
          .maybeSingle()
      ]);

      if (summaryRes.error && detailRes.error) {
        throw summaryRes.error || detailRes.error;
      }

      const summary = summaryRes.data || {};
      const detail = detailRes.data || {};
      const base = mapJamaah(summary);

      const fullName = summary.full_name || detail.profiles?.full_name || 'Jamaah';
      const phone = summary.phone || detail.phone || detail.profiles?.phone || '-';

      return {
        ...base,
        id: detail.id || summary.jamaah_id || id,
        jamaah_id: detail.id || summary.jamaah_id || id,
        profile_id: detail.profile_id || summary.profile_id,
        nik: detail.nik || summary.nik || '',
        nama_lengkap: fullName,
        full_name: fullName,
        no_telepon: phone,
        phone: phone,
        passport_number: detail.passport_number || '',
        nomor_paspor: detail.passport_number || '',
        birth_date: detail.birth_date || '',
        tanggal_lahir: detail.birth_date || '',
        gender: detail.gender || 'Laki-laki',
        jenis_kelamin: detail.gender || 'Laki-laki',
        address: detail.address || '',
        alamat: detail.address || '',
        package_id: detail.package_id || summary.package_id,
        paket_id: detail.package_id || summary.package_id,
        status: detail.status || summary.status || base.status,
        status_keberangkatan: detail.status || summary.status || base.status_keberangkatan,
      };
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
        nik: (payload.nik || '').trim(),
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
    const updateData = {};
    if (payload.nik !== undefined) updateData.nik = String(payload.nik).trim();
    if (payload.passport_number !== undefined || payload.nomor_paspor !== undefined) {
      updateData.passport_number = payload.passport_number ?? payload.nomor_paspor;
    }
    if (payload.gender !== undefined || payload.jenis_kelamin !== undefined) {
      updateData.gender = payload.gender ?? payload.jenis_kelamin;
    }
    if (payload.phone !== undefined || payload.no_telepon !== undefined) {
      updateData.phone = payload.phone ?? payload.no_telepon;
    }
    if (payload.address !== undefined || payload.alamat !== undefined) {
      updateData.address = payload.address ?? payload.alamat;
    }
    if (payload.package_id !== undefined || payload.paket_id !== undefined) {
      updateData.package_id = payload.package_id ?? payload.paket_id;
    }
    if (payload.birth_date !== undefined || payload.tanggal_lahir !== undefined) {
      updateData.birth_date = payload.birth_date ?? payload.tanggal_lahir;
    }
    if (payload.status !== undefined) updateData.status = payload.status;

    const { data, error } = await supabase
      .from('jamaah')
      .update(updateData)
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

      const nik = jamaahData?.nik;
      const packageId = jamaahData?.package_id;
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
      gender: payload.jenis_kelamin || payload.gender,
      phone: payload.no_telepon || payload.phone,
      address: payload.alamat || payload.address,
      package_id: payload.paket_id || payload.package_id || null,
      birth_date: payload.tanggal_lahir || payload.birth_date,
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
