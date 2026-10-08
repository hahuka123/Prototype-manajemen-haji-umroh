import { supabase } from './supabase';

const DEMO_PACKAGE = {
  id: 'demo-pkg-1',
  nama: 'Umrah Reguler Awal Tahun 2027',
  name: 'Umrah Reguler Awal Tahun 2027',
  tipe: 'Umrah Reguler',
  type: 'Umrah Reguler',
  harga: 35000000,
  price: 35000000,
  tanggal_keberangkatan: '2027-01-10',
  departure_date: '2027-01-10',
  tanggal_kepulangan: '2027-01-21',
  return_date: '2027-01-21',
  durasi_hari: 12,
  duration: 12,
  deskripsi: 'Paket perjalanan ibadah Umrah 12 hari direct flight Jakarta - Madinah dengan hotel bintang 4.'
};

export const packageService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .order('departure_date', { ascending: true });
        
      if (error) throw error;
      
      const mapped = (data || []).map(p => ({
          id: p.id,
          nama: p.name,
          name: p.name,
          tipe: p.type,
          type: p.type,
          harga: p.price,
          price: p.price,
          tanggal_keberangkatan: p.departure_date,
          departure_date: p.departure_date,
          tanggal_kepulangan: p.return_date,
          return_date: p.return_date,
          durasi_hari: p.duration,
          duration: p.duration,
          deskripsi: p.description
      }));
      return mapped.length > 0 ? mapped : [DEMO_PACKAGE];
    } catch (e) {
      return [DEMO_PACKAGE];
    }
  },

  async getPackages() {
      return this.getAll();
  },

  async getById(id) {
    if (id === 'demo-pkg-1' || !id || (typeof id === 'string' && id.startsWith('demo-'))) {
      return DEMO_PACKAGE;
    }

    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) {
        return DEMO_PACKAGE;
      }
      
      return {
          id: data.id,
          nama: data.name,
          name: data.name,
          tipe: data.type,
          type: data.type,
          harga: data.price,
          price: data.price,
          tanggal_keberangkatan: data.departure_date,
          departure_date: data.departure_date,
          tanggal_kepulangan: data.return_date,
          return_date: data.return_date,
          durasi_hari: data.duration,
          duration: data.duration,
          deskripsi: data.description
      };
    } catch (e) {
      return DEMO_PACKAGE;
    }
  },

  async create(payload) {
    const { data, error } = await supabase
      .from('packages')
      .insert([{
          name: payload.nama,
          type: payload.tipe,
          price: payload.harga,
          departure_date: payload.tanggal_keberangkatan,
          return_date: payload.tanggal_kepulangan,
          duration: payload.durasi_hari,
          description: payload.deskripsi
      }])
      .select()
      .single();
      
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const updateData = {};
    if (payload.nama) updateData.name = payload.nama;
    if (payload.tipe) updateData.type = payload.tipe;
    if (payload.harga) updateData.price = payload.harga;
    if (payload.tanggal_keberangkatan) updateData.departure_date = payload.tanggal_keberangkatan;
    if (payload.tanggal_kepulangan) updateData.return_date = payload.tanggal_kepulangan;
    if (payload.durasi_hari) updateData.duration = payload.durasi_hari;
    if (payload.deskripsi) updateData.description = payload.deskripsi;

    const { data, error } = await supabase
      .from('packages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    return true;
  }
};
