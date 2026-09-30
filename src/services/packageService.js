import { supabase } from './supabase';

export const packageService = {
  async getAll() {
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .order('departure_date', { ascending: true });
      
    if (error) throw error;
    
    // Map DB fields to UI fields if needed
    return data.map(p => ({
        id: p.id,
        nama: p.name,
        tipe: p.type,
        harga: p.price,
        tanggal_keberangkatan: p.departure_date,
        tanggal_kepulangan: p.return_date,
        durasi_hari: p.duration,
        deskripsi: p.description
    }));
  },

  async getPackages() {
      // Alias for getAll, mapping to match UI
      return this.getAll();
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) throw error;
    
    return {
        id: data.id,
        nama: data.name,
        tipe: data.type,
        harga: data.price,
        tanggal_keberangkatan: data.departure_date,
        tanggal_kepulangan: data.return_date,
        durasi_hari: data.duration,
        deskripsi: data.description
    };
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
