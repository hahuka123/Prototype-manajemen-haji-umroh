import { supabase } from './supabase';

const DEMO_SCHEDULES = [
  {
    id: 'demo-sch-1',
    package_id: 'demo-pkg-1',
    paket_id: 'demo-pkg-1',
    date: '2027-01-10',
    tanggal: '2027-01-10',
    tanggal_keberangkatan: '2027-01-10',
    time: '08:00',
    waktu: '08:00',
    activity: 'Keberangkatan & Manasik Bandara',
    kegiatan: 'Keberangkatan & Manasik Bandara',
    location: 'Bandara Soekarno Hatta (CGK)',
    lokasi: 'Bandara Soekarno Hatta (CGK)',
    description: 'Kumpul di Terminal 3 Gate 1 Internasional untuk pengarahan akhir dan pembagian paspor.',
    deskripsi: 'Kumpul di Terminal 3 Gate 1 Internasional untuk pengarahan akhir dan pembagian paspor.',
    maskapai: 'Saudia Airlines'
  },
  {
    id: 'demo-sch-2',
    package_id: 'demo-pkg-1',
    paket_id: 'demo-pkg-1',
    date: '2027-01-11',
    tanggal: '2027-01-11',
    tanggal_keberangkatan: '2027-01-11',
    time: '14:00',
    waktu: '14:00',
    activity: 'Ziarah Kota Madinah & Raudhah',
    kegiatan: 'Ziarah Kota Madinah & Raudhah',
    location: 'Masjid Nabawi & Raudhah',
    lokasi: 'Masjid Nabawi & Raudhah',
    description: 'Ziarah ke makam Rasulullah SAW dan pelaksanaan ibadah sunnah di Raudhah Syarifah.',
    deskripsi: 'Ziarah ke makam Rasulullah SAW dan pelaksanaan ibadah sunnah di Raudhah Syarifah.',
    maskapai: 'Saudia Airlines'
  },
  {
    id: 'demo-sch-3',
    package_id: 'demo-pkg-1',
    paket_id: 'demo-pkg-1',
    date: '2027-01-15',
    tanggal: '2027-01-15',
    tanggal_keberangkatan: '2027-01-15',
    time: '16:00',
    waktu: '16:00',
    activity: 'Pelaksanaan Ibadah Umrah Wajib',
    kegiatan: 'Pelaksanaan Ibadah Umrah Wajib',
    location: 'Masjidil Haram, Makkah',
    lokasi: 'Masjidil Haram, Makkah',
    description: 'Tawaf, Sai, dan Tahallul dibimbing langsung oleh Muthawwif biro perjalanan.',
    deskripsi: 'Tawaf, Sai, dan Tahallul dibimbing langsung oleh Muthawwif biro perjalanan.',
    maskapai: 'Saudia Airlines'
  }
];

function formatSchedule(s) {
  if (!s) return null;
  const timeFormatted = s.time ? (s.time.length > 5 ? s.time.slice(0, 5) : s.time) : '08:00';
  return {
    id: s.id,
    package_id: s.package_id,
    paket_id: s.package_id,
    date: s.date,
    tanggal: s.date,
    tanggal_keberangkatan: s.date,
    time: timeFormatted,
    waktu: timeFormatted,
    activity: s.activity,
    kegiatan: s.activity,
    location: s.location,
    lokasi: s.location,
    description: s.description || '',
    deskripsi: s.description || '',
    maskapai: s.maskapai || 'Saudia Airlines',
    packages: s.packages,
    created_at: s.created_at,
    updated_at: s.updated_at
  };
}

function sanitizeTime(timeStr) {
  if (!timeStr) return '08:00';
  const match = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hh = match[1].padStart(2, '0');
    const mm = match[2];
    return `${hh}:${mm}:00`;
  }
  return '08:00:00';
}

export const scheduleService = {
  async getSchedules() {
    return this.getAll();
  },
  
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('*, packages(name)')
        .order('date', { ascending: true })
        .order('time', { ascending: true });
        
      if (error) {
        console.error('[scheduleService] Error getAll:', error.message);
        throw error;
      }
      return (data || []).map(formatSchedule);
    } catch (e) {
      console.error('[scheduleService] Exception getAll:', e);
      throw e;
    }
  },

  async getByPackage(packageId) {
    if (typeof packageId === 'string' && packageId.startsWith('demo-')) {
      return DEMO_SCHEDULES;
    }

    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('package_id', packageId)
        .order('date', { ascending: true })
        .order('time', { ascending: true });
        
      if (error) {
        console.error('[scheduleService] Error getByPackage:', error.message);
        throw error;
      }
      return (data || []).map(formatSchedule);
    } catch (e) {
      console.error('[scheduleService] Exception getByPackage:', e);
      throw e;
    }
  },

  async create(payload) {
    const insertData = {
      package_id: payload.package_id ?? payload.paket_id,
      date: payload.date ?? payload.tanggal ?? payload.tanggal_keberangkatan,
      time: sanitizeTime(payload.time ?? payload.waktu),
      activity: (payload.activity ?? payload.kegiatan ?? '').trim(),
      location: (payload.location ?? payload.lokasi ?? '').trim(),
      description: (payload.description ?? payload.deskripsi ?? '').trim() || null
    };

    const { data, error } = await supabase
      .from('schedules')
      .insert([insertData])
      .select('*, packages(name)')
      .single();
      
    if (error) {
      console.error('[scheduleService] Error create:', error.message);
      throw error;
    }
    return formatSchedule(data);
  },

  async update(id, payload) {
    const updateData = {};
    if (payload.package_id !== undefined || payload.paket_id !== undefined) {
      updateData.package_id = payload.package_id ?? payload.paket_id;
    }
    if (payload.date !== undefined || payload.tanggal !== undefined || payload.tanggal_keberangkatan !== undefined) {
      updateData.date = payload.date ?? payload.tanggal ?? payload.tanggal_keberangkatan;
    }
    if (payload.time !== undefined || payload.waktu !== undefined) {
      updateData.time = sanitizeTime(payload.time ?? payload.waktu);
    }
    if (payload.activity !== undefined || payload.kegiatan !== undefined) {
      updateData.activity = (payload.activity ?? payload.kegiatan ?? '').trim();
    }
    if (payload.location !== undefined || payload.lokasi !== undefined) {
      updateData.location = (payload.location ?? payload.lokasi ?? '').trim();
    }
    if (payload.description !== undefined || payload.deskripsi !== undefined) {
      const desc = payload.description ?? payload.deskripsi;
      updateData.description = desc ? String(desc).trim() : null;
    }

    const { data, error } = await supabase
      .from('schedules')
      .update(updateData)
      .eq('id', id)
      .select('*, packages(name)')
      .single();
      
    if (error) {
      console.error('[scheduleService] Error update:', error.message);
      throw error;
    }
    return formatSchedule(data);
  },

  async delete(id) {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('[scheduleService] Error delete:', error.message);
      throw error;
    }
    return true;
  }
};
