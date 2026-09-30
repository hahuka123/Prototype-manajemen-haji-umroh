import { supabase, isConfigured } from './supabase';

const STORAGE_KEY = 'haji_umroh_packages';

const INITIAL_PACKAGES = [
  {
    id: 'pkg-1',
    name: 'Umrah Reguler Awal Tahun 2027',
    type: 'Umrah Reguler',
    price: 35000000,
    departure_date: '2027-01-10',
    return_date: '2027-01-21',
    duration: 12,
    description: 'Penerbangan direct Saudia Airlines Jakarta - Madinah, hotel bintang 4 dekat pelataran masjid.'
  },
  {
    id: 'pkg-2',
    name: 'Umrah Ramadhan Lailatul Qadar 2027',
    type: 'Umrah VIP',
    price: 52000000,
    departure_date: '2027-03-25',
    return_date: '2027-04-10',
    duration: 17,
    description: 'Paket Umrah 10 malam terakhir Ramadhan dengan hotel bintang 5 langsung menghadap Ka\'bah.'
  },
  {
    id: 'pkg-3',
    name: 'Haji Khusus / Plus VIP 2027',
    type: 'Haji Plus',
    price: 165000000,
    departure_date: '2027-05-20',
    return_date: '2027-06-15',
    duration: 27,
    description: 'Maktab VIP zona 1 Mina & Arafah, tenda ber-AC eksklusif, hotel bintang 5 pelataran Masjidil Haram.'
  }
];

function getLocalPackages() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PACKAGES));
    return INITIAL_PACKAGES;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return INITIAL_PACKAGES;
  }
}

function saveLocalPackages(packages) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
}

export const packageService = {
  async getAll() {
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('packages')
          .select('*')
          .order('departure_date', { ascending: true });
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Gagal load paket dari Supabase, menggunakan lokal:', e);
      }
    }
    return getLocalPackages();
  },

  async getById(id) {
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('packages')
          .select('*')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Gagal ambil detail paket:', e);
      }
    }
    const all = getLocalPackages();
    return all.find(p => p.id === id) || null;
  },

  async create(payload) {
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('packages')
          .insert([payload])
          .select()
          .single();
        if (!error && data) return data;
        if (error) throw error;
      } catch (e) {
        console.warn('Fallback save lokal paket:', e);
      }
    }
    const all = getLocalPackages();
    const newPkg = {
      ...payload,
      id: `pkg-${Date.now()}`
    };
    all.push(newPkg);
    saveLocalPackages(all);
    return newPkg;
  },

  async update(id, payload) {
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('packages')
          .update(payload)
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data;
        if (error) throw error;
      } catch (e) {
        console.warn('Fallback update lokal paket:', e);
      }
    }
    const all = getLocalPackages();
    const idx = all.findIndex(p => p.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...payload };
      saveLocalPackages(all);
      return all[idx];
    }
    return null;
  },

  async delete(id) {
    if (isConfigured) {
      try {
        const { error } = await supabase
          .from('packages')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } catch (e) {
        console.warn('Fallback delete lokal paket:', e);
      }
    }
    const all = getLocalPackages();
    const filtered = all.filter(p => p.id !== id);
    saveLocalPackages(filtered);
    return true;
  }
};
