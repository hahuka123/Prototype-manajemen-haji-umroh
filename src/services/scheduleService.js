import { supabase } from './supabase';

export const scheduleService = {
  async getSchedules() {
    const { data, error } = await supabase
        .from('schedules')
        .select('*, packages(name)')
        .order('date', { ascending: true })
        .order('time', { ascending: true });
    
    if (error) throw error;
    
    // Map DB fields to match UI
    return data.map(s => ({
        id: s.id,
        paket_id: s.package_id,
        tanggal_keberangkatan: s.date, // For UI compatibility if needed, though schema uses date
        waktu: s.time,
        kegiatan: s.activity,
        lokasi: s.location,
        deskripsi: s.description,
        maskapai: 'Saudia Airlines' // Mock addition since it was used in UI
    }));
  },
  
  async getAll() {
    const { data, error } = await supabase
      .from('schedules')
      .select('*, packages(name)')
      .order('date', { ascending: true })
      .order('time', { ascending: true });
      
    if (error) throw error;
    return data;
  },

  async getByPackage(packageId) {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('package_id', packageId)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
      
    if (error) throw error;
    return data;
  },

  async create(payload) {
    const { data, error } = await supabase
      .from('schedules')
      .insert([{
          package_id: payload.package_id,
          date: payload.date,
          time: payload.time,
          activity: payload.activity,
          location: payload.location,
          description: payload.description
      }])
      .select()
      .single();
      
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('schedules')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    return true;
  }
};
