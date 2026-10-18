import { supabase } from './supabase';

const DEMO_PACKAGE = {
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
  description: 'Paket perjalanan ibadah Umrah 12 hari direct flight Jakarta - Madinah dengan hotel bintang 4.',
  deskripsi: 'Paket perjalanan ibadah Umrah 12 hari direct flight Jakarta - Madinah dengan hotel bintang 4.'
};

function formatPackage(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    nama: p.name,
    type: p.type,
    tipe: p.type,
    price: Number(p.price || 0),
    harga: Number(p.price || 0),
    departure_date: p.departure_date,
    tanggal_keberangkatan: p.departure_date,
    return_date: p.return_date,
    tanggal_kepulangan: p.return_date,
    duration: Number(p.duration || 0),
    durasi_hari: Number(p.duration || 0),
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
      
      return (data || []).map(formatPackage);
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
      return DEMO_PACKAGE;
    }

    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      return formatPackage(data);
    } catch (e) {
      console.error('[packageService] Error getById:', e);
      throw e;
    }
  },

  async create(payload) {
    const insertData = {
      name: (payload.name ?? payload.nama ?? '').trim(),
      type: payload.type ?? payload.tipe ?? 'Umrah Reguler',
      price: Number(payload.price ?? payload.harga ?? 0),
      departure_date: payload.departure_date ?? payload.tanggal_keberangkatan,
      return_date: payload.return_date ?? payload.tanggal_kepulangan,
      duration: Number(payload.duration ?? payload.durasi_hari ?? 1),
      description: (payload.description ?? payload.deskripsi ?? '').trim() || null
    };

    const { data, error } = await supabase
      .from('packages')
      .insert([insertData])
      .select()
      .single();
      
    if (error) {
      console.error('[packageService] Error create:', error.message);
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
