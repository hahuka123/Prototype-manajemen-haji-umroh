import { supabase } from './supabase';

const DEMO_SCHEDULES = [
  {
    id: 'demo-sch-1',
    package_id: 'demo-pkg-1',
    paket_id: 'demo-pkg-1',
    date: '2027-01-10',
    tanggal_keberangkatan: '2027-01-10',
    time: '08:00',
    waktu: '08:00',
    activity: 'Keberangkatan & Manasik Bandara',
    kegiatan: 'Keberangkatan & Manasik Bandara',
    location: 'Bandara Soekarno Hatta (CGK)',
    lokasi: 'Bandara Soekarno Hatta (CGK)',
    description: 'Kumpul di Terminal 3 Gate 1 Internasional untuk pengarahan akhir dan pembagian paspor.',
    maskapai: 'Saudia Airlines'
  },
  {
    id: 'demo-sch-2',
    package_id: 'demo-pkg-1',
    paket_id: 'demo-pkg-1',
    date: '2027-01-11',
    tanggal_keberangkatan: '2027-01-11',
    time: '14:00',
    waktu: '14:00',
    activity: 'Ziarah Kota Madinah & Raudhah',
    kegiatan: 'Ziarah Kota Madinah & Raudhah',
    location: 'Masjid Nabawi & Raudhah',
    lokasi: 'Masjid Nabawi & Raudhah',
    description: 'Ziarah ke makam Rasulullah SAW dan pelaksanaan ibadah sunnah di Raudhah Syarifah.',
    maskapai: 'Saudia Airlines'
  },
  {
    id: 'demo-sch-3',
    package_id: 'demo-pkg-1',
    paket_id: 'demo-pkg-1',
    date: '2027-01-15',
    tanggal_keberangkatan: '2027-01-15',
    time: '16:00',
    waktu: '16:00',
    activity: 'Pelaksanaan Ibadah Umrah Wajib',
    kegiatan: 'Pelaksanaan Ibadah Umrah Wajib',
    location: 'Masjidil Haram, Makkah',
    lokasi: 'Masjidil Haram, Makkah',
    description: 'Tawaf, Sai, dan Tahallul dibimbing langsung oleh Muthawwif biro perjalanan.',
    maskapai: 'Saudia Airlines'
  }
];

export const scheduleService = {
  async getSchedules() {
    try {
      const { data, error } = await supabase
          .from('schedules')
          .select('*, packages(name)')
          .order('date', { ascending: true })
          .order('time', { ascending: true });
      
      if (error) throw error;
      
      const mapped = (data || []).map(s => ({
          id: s.id,
          paket_id: s.package_id,
          tanggal_keberangkatan: s.date,
          waktu: s.time,
          kegiatan: s.activity,
          lokasi: s.location,
          deskripsi: s.description,
          maskapai: 'Saudia Airlines'
      }));
      return mapped.length > 0 ? mapped : DEMO_SCHEDULES;
    } catch (e) {
      return DEMO_SCHEDULES;
    }
  },
  
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('*, packages(name)')
        .order('date', { ascending: true })
        .order('time', { ascending: true });
        
      if (error) throw error;
      return (data && data.length > 0) ? data : DEMO_SCHEDULES;
    } catch (e) {
      return DEMO_SCHEDULES;
    }
  },

  async getByPackage(packageId) {
    if (packageId === 'demo-pkg-1' || !packageId || (typeof packageId === 'string' && packageId.startsWith('demo-'))) {
      return DEMO_SCHEDULES;
    }

    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('package_id', packageId)
        .order('date', { ascending: true })
        .order('time', { ascending: true });
        
      if (error) throw error;
      return (data && data.length > 0) ? data : DEMO_SCHEDULES;
    } catch (e) {
      return DEMO_SCHEDULES;
    }
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
