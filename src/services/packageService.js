import { supabase } from './supabase';

export const DEMO_PACKAGE = {
  id: 'demo-pkg-1',
  name: 'Umrah Reguler Awal Tahun 2027',
  nama: 'Umrah Reguler Awal Tahun 2027',
  type: 'Umrah Reguler',
  tipe: 'Umrah Reguler',
  price: 35000000,
  harga: 35000000,
  departure_date: '2027-01-10',
  tanggal_keberangkatan: '2027-01-10',
  return_date: '2027-01-21',
  tanggal_kepulangan: '2027-01-21',
  duration: 12,
  durasi_hari: 12,
  quota: 40,
  kuota: 40,
  terisi: 15,
  description: 'Paket perjalanan ibadah Umrah 12 hari direct flight Jakarta - Madinah dengan hotel bintang 4.',
  deskripsi: 'Paket perjalanan ibadah Umrah 12 hari direct flight Jakarta - Madinah dengan hotel bintang 4.'
};

/**
 * Memformat objek Date atau tanggal string (YYYY-MM-DD) ke dalam format bahasa Indonesia yang konsisten,
 * misalnya: "27 Maret 2027".
 * Memperhatikan timezone agar tidak terjadi pergeseran hari karena konversi UTC.
 */
export function formatIndoDate(dateInput) {
  if (!dateInput) return null;
  let d;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // Jika format tanggal YYYY-MM-DD murni, parse local date
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    } else {
      d = new Date(trimmed);
    }
  } else {
    d = new Date(dateInput);
  }

  if (isNaN(d.getTime())) return null;

  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Menghitung dan memastikan tanggal kepulangan paket perjalanan:
 * 1. Jika return_date ada di DB, gunakan nilai asli dari DB.
 * 2. Jika return_date NULL / kosong, hitung berdasarkan departure_date + duration
 *    dengan definisi durasi proyek inklusif: return = departure + (duration - 1) hari.
 * 3. Jika departure_date atau duration tidak valid/kosong, kembalikan null (tidak membuat tanggal palsu).
 */
export function resolveReturnDate(pkg) {
  if (!pkg) return null;

  // 1. Cek return_date dari database
  const rawReturn = pkg.return_date || pkg.tanggal_kepulangan;
  if (rawReturn) {
    if (rawReturn instanceof Date && !isNaN(rawReturn.getTime())) {
      return rawReturn;
    }
    if (typeof rawReturn === 'string' && rawReturn.trim()) {
      const match = rawReturn.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
      const parsed = match 
        ? new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10))
        : new Date(rawReturn);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  // 2. Jika return_date kosong/NULL, hitung dari departure_date dan duration jika valid
  const rawDep = pkg.departure_date || pkg.tanggal_keberangkatan;
  const rawDuration = Number(pkg.duration ?? pkg.durasi_hari);

  if (rawDep && !isNaN(rawDuration) && rawDuration > 0) {
    let depDate;
    if (rawDep instanceof Date) {
      depDate = rawDep;
    } else if (typeof rawDep === 'string') {
      const match = rawDep.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
      depDate = match 
        ? new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10))
        : new Date(rawDep);
    } else {
      depDate = new Date(rawDep);
    }

    if (!isNaN(depDate.getTime())) {
      // Definisi durasi proyek: duration = (return - dep) + 1 hari
      // Maka return = dep + (duration - 1) hari
      const calculated = new Date(depDate.getTime());
      calculated.setDate(calculated.getDate() + (rawDuration - 1));
      return calculated;
    }
  }

  return null;
}

/**
 * Mengembalikan teks label tanggal kepulangan yang siap ditampilkan:
 * Jika tanggal dapat dipastikan -> "27 Maret 2027"
 * Jika tanggal tidak dapat dipastikan -> "Belum ditentukan"
 */
export function resolveReturnDateText(pkg) {
  const d = resolveReturnDate(pkg);
  if (!d) return 'Belum ditentukan';
  return formatIndoDate(d) || 'Belum ditentukan';
}

function formatPackage(p, extraStats = {}) {
  if (!p) return null;
  const rawQuota = p.quota ?? p.kuota;
  const quota = rawQuota !== null && rawQuota !== undefined && rawQuota !== '' ? Number(rawQuota) : null;
  
  const terisi = typeof extraStats.terisi === 'number' 
    ? extraStats.terisi 
    : (typeof p.terisi === 'number' ? p.terisi : 0);
  const sisa = quota !== null ? Math.max(0, quota - terisi) : null;

  const returnDateObj = resolveReturnDate(p);
  const formattedReturn = returnDateObj ? formatIndoDate(returnDateObj) : 'Belum ditentukan';
  const formattedDeparture = p.departure_date ? formatIndoDate(p.departure_date) : '-';

  return {
    id: p.id,
    name: p.name,
    nama: p.name,
    type: p.type,
    tipe: p.type,
    price: Number(p.price || 0),
    harga: Number(p.price || 0),
    departure_date: p.departure_date || null,
    tanggal_keberangkatan: p.departure_date || null,
    return_date: p.return_date || null,
    tanggal_kepulangan: p.return_date || null,
    formatted_departure_date: formattedDeparture,
    formatted_return_date: formattedReturn,
    duration: Number(p.duration || 0),
    durasi_hari: Number(p.duration || 0),
    quota: quota,
    kuota: quota,
    terisi: terisi,
    sisa_kuota: sisa,
    is_penuh: quota !== null ? terisi >= quota : false,
    description: p.description || '',
    deskripsi: p.description || '',
    created_at: p.created_at,
    updated_at: p.updated_at
  };
}

export const packageService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .order('departure_date', { ascending: true });
        
      if (error) {
        console.error('[packageService] Error getAll:', error.message);
        throw error;
      }

      // Ambil data real jumlah pendaftar per paket dari tabel jamaah
      let counts = {};
      try {
        // Coba panggil fungsi RPC agregat jika tersedia di database Supabase
        const { data: statsData, error: statsErr } = await supabase
          .rpc('get_packages_registered_counts');

        if (!statsErr && Array.isArray(statsData)) {
          statsData.forEach(row => {
            if (row.package_id) {
              counts[row.package_id] = Number(row.registered_count || 0);
            }
          });
        } else {
          // Fallback: Query tabel jamaah langsung dengan pencegahan duplikasi akun
          const { data: jamaahList, error: jErr } = await supabase
            .from('jamaah')
            .select('id, profile_id, package_id, status');
          
          if (!jErr && jamaahList) {
            const seenAccounts = new Set();
            jamaahList.forEach(j => {
              const accountKey = j.profile_id || j.id;
              if (accountKey) {
                if (seenAccounts.has(accountKey)) return;
                seenAccounts.add(accountKey);
              }
              if (j.package_id) {
                counts[j.package_id] = (counts[j.package_id] || 0) + 1;
              }
            });
          }
        }
      } catch (countError) {
        console.warn('[packageService] Gagal menghitung jamaah terdaftar:', countError);
      }
      
      return (data || []).map(p => {
        const terisiVal = counts[p.id] !== undefined ? counts[p.id] : (typeof p.terisi === 'number' ? p.terisi : 0);
        return formatPackage(p, { terisi: terisiVal });
      });
    } catch (e) {
      console.error('[packageService] Exception getAll:', e);
      throw e;
    }
  },

  async getPackages() {
    return this.getAll();
  },

  async getById(id) {
    if (typeof id === 'string' && id.startsWith('demo-')) {
      return formatPackage(DEMO_PACKAGE, { terisi: 15 });
    }

    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;

      // Hitung pendaftar riil
      let terisi = 0;
      try {
        // 1. Coba via RPC spesifik jika tersedia
        const { data: rpcCount, error: rpcErr } = await supabase
          .rpc('get_package_registered_count', { target_package_id: id });
        
        if (!rpcErr && typeof rpcCount === 'number') {
          terisi = rpcCount;
        } else {
          // 2. Fallback query tabel jamaah dengan deduplikasi akun
          const { data: list, error: countErr } = await supabase
            .from('jamaah')
            .select('id, profile_id, status')
            .eq('package_id', id);

          if (!countErr && list) {
            const seen = new Set();
            list.forEach(j => {
              const key = j.profile_id || j.id;
              if (key && !seen.has(key)) {
                seen.add(key);
                terisi++;
              }
            });
          }
        }
      } catch (errCount) {
        console.warn('[packageService] Gagal hitung pendaftar getById:', errCount);
      }

      return formatPackage(data, { terisi });
    } catch (e) {
      console.error('[packageService] Error getById:', e);
      throw e;
    }
  },

  async create(payload) {
    const rawQuota = payload.quota ?? payload.kuota;
    const quotaNum = Number(rawQuota);
    if (rawQuota === undefined || rawQuota === null || rawQuota === '' || isNaN(quotaNum) || !Number.isInteger(quotaNum) || quotaNum < 1) {
      throw new Error('Kuota jamaah wajib diisi dengan bilangan bulat positif minimal 1.');
    }

    const insertData = {
      name: (payload.name ?? payload.nama ?? '').trim(),
      type: payload.type ?? payload.tipe ?? 'Umrah Reguler',
      price: Number(payload.price ?? payload.harga ?? 0),
      departure_date: payload.departure_date ?? payload.tanggal_keberangkatan,
      return_date: payload.return_date ?? payload.tanggal_kepulangan,
      duration: Number(payload.duration ?? payload.durasi_hari ?? 1),
      quota: quotaNum,
      description: (payload.description ?? payload.deskripsi ?? '').trim() || null
    };

    const { data, error } = await supabase
      .from('packages')
      .insert([insertData])
      .select()
      .single();
      
    if (error) {
      console.error('[packageService] Error create:', error.message);
      if (error.code === '42703' || (error.message && error.message.includes('quota'))) {
        throw new Error("Kolom 'quota' belum tersedia di tabel packages Supabase. Harap jalankan file migrasi SQL 'supabase/migrations/20261019_add_quota_to_packages.sql' di Supabase SQL Editor.");
      }
      throw error;
    }
    return formatPackage(data);
  },

  async update(id, payload) {
    const updateData = {};
    if (payload.name !== undefined || payload.nama !== undefined) {
      updateData.name = (payload.name ?? payload.nama ?? '').trim();
    }
    if (payload.type !== undefined || payload.tipe !== undefined) {
      updateData.type = payload.type ?? payload.tipe;
    }
    if (payload.price !== undefined || payload.harga !== undefined) {
      updateData.price = Number(payload.price ?? payload.harga ?? 0);
    }
    if (payload.departure_date !== undefined || payload.tanggal_keberangkatan !== undefined) {
      updateData.departure_date = payload.departure_date ?? payload.tanggal_keberangkatan;
    }
    if (payload.return_date !== undefined || payload.tanggal_kepulangan !== undefined) {
      updateData.return_date = payload.return_date ?? payload.tanggal_kepulangan;
    }
    if (payload.duration !== undefined || payload.durasi_hari !== undefined) {
      updateData.duration = Number(payload.duration ?? payload.durasi_hari ?? 1);
    }
    if (payload.quota !== undefined || payload.kuota !== undefined) {
      const rawQuota = payload.quota ?? payload.kuota;
      const quotaNum = Number(rawQuota);
      if (rawQuota === '' || isNaN(quotaNum) || !Number.isInteger(quotaNum) || quotaNum < 1) {
        throw new Error('Kuota jamaah harus berupa bilangan bulat positif minimal 1.');
      }
      updateData.quota = quotaNum;
    }
    if (payload.description !== undefined || payload.deskripsi !== undefined) {
      const desc = payload.description ?? payload.deskripsi;
      updateData.description = desc ? String(desc).trim() : null;
    }

    const { data, error } = await supabase
      .from('packages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.error('[packageService] Error update:', error.message);
      if (error.code === '42703' || (error.message && error.message.includes('quota'))) {
        throw new Error("Kolom 'quota' belum tersedia di tabel packages Supabase. Harap jalankan file migrasi SQL 'supabase/migrations/20261019_add_quota_to_packages.sql' di Supabase SQL Editor.");
      }
      throw error;
    }
    return formatPackage(data);
  },

  async checkRelations(id) {
    try {
      const [jamaahRes, scheduleRes] = await Promise.all([
        supabase.from('jamaah').select('id', { count: 'exact', head: true }).eq('package_id', id),
        supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('package_id', id)
      ]);

      if (jamaahRes.error) console.warn('[packageService] checkRelations jamaah error:', jamaahRes.error.message);
      if (scheduleRes.error) console.warn('[packageService] checkRelations schedule error:', scheduleRes.error.message);

      return {
        jamaahCount: jamaahRes.count || 0,
        scheduleCount: scheduleRes.count || 0
      };
    } catch (e) {
      console.warn('[packageService] checkRelations exception:', e);
      return { jamaahCount: 0, scheduleCount: 0 };
    }
  },

  async delete(id) {
    // Check relations first to prevent orphaned jamaah or unintended cascading schedule deletions
    const relations = await this.checkRelations(id);
    if (relations.jamaahCount > 0) {
      throw new Error(`Paket tidak dapat dihapus karena masih terhubung dengan ${relations.jamaahCount} data jamaah terdaftar. Silakan pindahkan jamaah ke paket lain sebelum menghapus.`);
    }
    if (relations.scheduleCount > 0) {
      throw new Error(`Paket tidak dapat dihapus karena masih memiliki ${relations.scheduleCount} agenda kegiatan pada jadwal. Silakan hapus atau pindahkan jadwal kegiatan terkait terlebih dahulu.`);
    }

    const { error } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('[packageService] Error delete:', error.message);
      throw error;
    }
    return true;
  }
};
