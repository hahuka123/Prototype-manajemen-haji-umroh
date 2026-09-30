import { supabase, isConfigured } from './supabase';

const STORAGE_KEY = 'haji_umroh_schedules';

const INITIAL_SCHEDULES = [
  {
    id: 'sch-1',
    package_id: 'pkg-1',
    date: '2027-01-10',
    time: '08:00',
    activity: 'Kumpul Bandara Soekarno Hatta & Pembagian Paspor',
    location: 'Terminal 3 Gate 1 Internasional',
    description: 'Pengarahan akhir dari muthawwif, pembagian koper kabin dan identitas jamaah.'
  },
  {
    id: 'sch-2',
    package_id: 'pkg-1',
    date: '2027-01-10',
    time: '12:30',
    activity: 'Penerbangan Menuju Madinah (SV-819)',
    location: 'Bandara Soekarno Hatta (CGK) -> Madinah (MED)',
    description: 'Penerbangan langsung Jakarta - Madinah tanpa transit.'
  },
  {
    id: 'sch-3',
    package_id: 'pkg-1',
    date: '2027-01-11',
    time: '09:00',
    activity: 'Ziarah Masjid Nabawi & Makam Rasulullah SAW',
    location: 'Masjid Nabawi Madinah',
    description: 'Ziarah ke makam Rasulullah SAW, Sayyidina Abu Bakar Ash-Shiddiq, dan Umar bin Khattab.'
  },
  {
    id: 'sch-4',
    package_id: 'pkg-1',
    date: '2027-01-11',
    time: '14:00',
    activity: 'Masuk Raudhah Syarifah (Tasrih Resmi)',
    location: 'Raudhah Masjid Nabawi',
    description: 'Pelaksanaan sholat sunnah dan doa di taman surga Raudhah Syarifah.'
  },
  {
    id: 'sch-5',
    package_id: 'pkg-1',
    date: '2027-01-14',
    time: '10:00',
    activity: 'Check-out Madinah & Miqat di Bir Ali Menuju Makkah',
    location: 'Masjid Dzulhulaifah (Bir Ali)',
    description: 'Mandi ihram, berniat umrah, dan menaiki bus executive menuju Makkah Al-Mukarramah.'
  },
  {
    id: 'sch-6',
    package_id: 'pkg-1',
    date: '2027-01-14',
    time: '20:30',
    activity: 'Pelaksanaan Ibadah Umrah (Thawaf, Sa\'i, Tahallul)',
    location: 'Masjidil Haram Makkah',
    description: 'Pelaksanaan rukun umrah didampingi pembimbing biro hingga tahallul sempurna.'
  },
  {
    id: 'sch-7',
    package_id: 'pkg-2',
    date: '2027-03-25',
    time: '15:00',
    activity: 'Keberangkatan & Buka Puasa Bersama di Bandara',
    location: 'Terminal 3 Bandara Soetta',
    description: 'Kumpul keluarga jamaah umrah Ramadhan dan persiapan manasik safar.'
  }
];

function getLocalSchedules() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SCHEDULES));
    return INITIAL_SCHEDULES;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return INITIAL_SCHEDULES;
  }
}

function saveLocalSchedules(schedules) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

export const scheduleService = {
  async getAll() {
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('schedules')
          .select('*, packages(name)')
          .order('date', { ascending: true })
          .order('time', { ascending: true });
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Gagal ambil jadwal dari Supabase:', e);
      }
    }
    return getLocalSchedules();
  },

  async getByPackage(packageId) {
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('schedules')
          .select('*')
          .eq('package_id', packageId)
          .order('date', { ascending: true })
          .order('time', { ascending: true });
        if (!error && data) return data;
      } catch (e) {
        console.warn('Gagal ambil jadwal paket dari Supabase:', e);
      }
    }
    const all = getLocalSchedules();
    return all.filter(s => s.package_id === packageId);
  },

  async create(payload) {
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('schedules')
          .insert([payload])
          .select()
          .single();
        if (!error && data) return data;
        if (error) throw error;
      } catch (e) {
        console.warn('Fallback save lokal jadwal:', e);
      }
    }
    const all = getLocalSchedules();
    const newSch = {
      ...payload,
      id: `sch-${Date.now()}`
    };
    all.push(newSch);
    saveLocalSchedules(all);
    return newSch;
  },

  async update(id, payload) {
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('schedules')
          .update(payload)
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data;
        if (error) throw error;
      } catch (e) {
        console.warn('Fallback update lokal jadwal:', e);
      }
    }
    const all = getLocalSchedules();
    const idx = all.findIndex(s => s.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...payload };
      saveLocalSchedules(all);
      return all[idx];
    }
    return null;
  },

  async delete(id) {
    if (isConfigured) {
      try {
        const { error } = await supabase
          .from('schedules')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } catch (e) {
        console.warn('Fallback delete lokal jadwal:', e);
      }
    }
    const all = getLocalSchedules();
    const filtered = all.filter(s => s.id !== id);
    saveLocalSchedules(filtered);
    return true;
  }
};
