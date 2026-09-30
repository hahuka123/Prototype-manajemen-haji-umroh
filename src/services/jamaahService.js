import { supabase } from './supabase';

export const jamaahService = {
  // Get all jamaah (menggunakan view yang dibuat di SQL agar dapat field kalkulasi)
  getJamaah: async () => {
    const { data, error } = await supabase
        .from('v_jamaah_billing_summary')
        .select('*');
    if (error) throw error;
    
    // Map data from view to match our UI properties
    return data.map(j => ({
        id: j.jamaah_id,
        profile_id: j.profile_id,
        nik: j.nik,
        nama_lengkap: j.full_name,
        no_telepon: j.phone,
        paket_id: j.package_id,
        status_pembayaran: j.status_pelunasan,
        total_terbayar: j.total_terbayar,
        sisa_tagihan: j.sisa_tagihan,
        dokumen_persentase: j.persentase_dokumen,
        // Status keberangkatan kita default dari tabel jamaah, karena view ini fokus billing
        status_keberangkatan: j.persentase_dokumen === 100 && j.sisa_tagihan === 0 ? 'Siap Berangkat' : (j.persentase_dokumen > 0 ? 'Dokumen Diproses' : 'Pendaftaran')
    }));
  },

  // Get jamaah by ID
  getJamaahById: async (id) => {
    const { data, error } = await supabase
        .from('v_jamaah_billing_summary')
        .select('*')
        .eq('jamaah_id', id)
        .single();
    if (error) throw error;

    return {
        id: data.jamaah_id,
        profile_id: data.profile_id,
        nik: data.nik,
        nama_lengkap: data.full_name,
        no_telepon: data.phone,
        paket_id: data.package_id,
        status_pembayaran: data.status_pelunasan,
        total_terbayar: data.total_terbayar,
        sisa_tagihan: data.sisa_tagihan,
        dokumen_persentase: data.persentase_dokumen,
        status_keberangkatan: data.persentase_dokumen === 100 && data.sisa_tagihan === 0 ? 'Siap Berangkat' : (data.persentase_dokumen > 0 ? 'Dokumen Diproses' : 'Pendaftaran')
    };
  },

  // Add new jamaah
  addJamaah: async (payload) => {
    // 1. Simpan ke tabel profiles jika perlu, lalu insert ke tabel jamaah
    const { data, error } = await supabase
        .from('jamaah')
        .insert([{
            nik: payload.nik,
            gender: payload.jenis_kelamin,
            phone: payload.no_telepon,
            address: payload.alamat,
            package_id: payload.paket_id,
            birth_date: '1990-01-01', // Harusnya dinamis
        }])
        .select()
        .single();
    if (error) throw error;
    return data;
  },

  // Update jamaah
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

  // Delete jamaah
  deleteJamaah: async (id) => {
    const { error } = await supabase
        .from('jamaah')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return true;
  },
  
  // Note: updateDokumenPersentase is not strictly needed as a DB write anymore 
  // since the view `v_jamaah_billing_summary` dynamically calculates it in SQL.
  updateDokumenPersentase: async (id, percent) => {
      // In a real Supabase DB with views, you just fetch the view again.
  }
};
