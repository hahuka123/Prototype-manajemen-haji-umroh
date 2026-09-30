// src/services/jamaahService.js

// Mock data for Jamaah
let mockJamaah = [
  {
    id: 1,
    nik: '3201010101010001',
    nama_lengkap: 'Budi Santoso',
    jenis_kelamin: 'L',
    no_telepon: '081234567890',
    alamat: 'Jl. Merdeka No. 1, Jakarta',
    paket_id: 1, // Umroh Reguler 9 Hari
    jadwal_id: 1,
    status_pembayaran: 'Belum Lunas',
    total_terbayar: 10000000,
    sisa_tagihan: 20000000,
    dokumen_persentase: 33, // Example
    status_keberangkatan: 'Dokumen Diproses',
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    nik: '3201010101010002',
    nama_lengkap: 'Siti Aminah',
    jenis_kelamin: 'P',
    no_telepon: '081298765432',
    alamat: 'Jl. Sudirman No. 2, Bandung',
    paket_id: 2, // Haji Plus
    jadwal_id: 2,
    status_pembayaran: 'Lunas',
    total_terbayar: 250000000,
    sisa_tagihan: 0,
    dokumen_persentase: 100,
    status_keberangkatan: 'Siap Berangkat',
    created_at: new Date().toISOString()
  }
];

// In-memory cache for demo mode
let jamaahData = [...mockJamaah];

export const jamaahService = {
  // Get all jamaah
  getJamaah: async () => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return [...jamaahData];
  },

  // Get jamaah by ID
  getJamaahById: async (id) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const jamaah = jamaahData.find(j => j.id === parseInt(id));
    if (!jamaah) throw new Error('Jamaah not found');
    return { ...jamaah };
  },

  // Add new jamaah
  addJamaah: async (data) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newId = Math.max(...jamaahData.map(j => j.id), 0) + 1;
    const newJamaah = {
      ...data,
      id: newId,
      created_at: new Date().toISOString(),
      dokumen_persentase: 0,
      status_pembayaran: 'Belum Lunas',
      total_terbayar: 0,
      status_keberangkatan: 'Pendaftaran'
    };
    jamaahData.push(newJamaah);
    return newJamaah;
  },

  // Update jamaah
  updateJamaah: async (id, data) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const index = jamaahData.findIndex(j => j.id === parseInt(id));
    if (index === -1) throw new Error('Jamaah not found');
    
    jamaahData[index] = { ...jamaahData[index], ...data };
    return { ...jamaahData[index] };
  },

  // Delete jamaah
  deleteJamaah: async (id) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const index = jamaahData.findIndex(j => j.id === parseInt(id));
    if (index === -1) throw new Error('Jamaah not found');
    
    jamaahData.splice(index, 1);
    return true;
  },
  
  // Calculate persentase & update status (to be called when doc status changes)
  updateDokumenPersentase: async (id, percent) => {
    const jamaah = jamaahData.find(j => j.id === parseInt(id));
    if (jamaah) {
        jamaah.dokumen_persentase = percent;
        // Simple state machine logic
        if (percent === 100 && jamaah.sisa_tagihan === 0) {
            jamaah.status_keberangkatan = 'Siap Berangkat';
        } else if (percent > 0) {
            jamaah.status_keberangkatan = 'Dokumen Diproses';
        } else {
            jamaah.status_keberangkatan = 'Pendaftaran';
        }
    }
  }
};
