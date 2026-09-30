// src/services/paymentService.js

import { jamaahService } from './jamaahService';

// Mock payments data
// jamaahId -> array of payments
let mockPayments = {
  1: [
    {
      id: 1001,
      jamaah_id: 1,
      metode: 'transfer',
      jenis: 'cicilan',
      nominal: 10000000,
      bank_asal: 'BCA',
      no_referensi: 'REF-BCA-001',
      tanggal: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      status: 'verified',
      bukti_url: '#',
      catatan_admin: ''
    }
  ],
  2: [
    {
      id: 1002,
      jamaah_id: 2,
      metode: 'cash',
      jenis: 'full',
      nominal: 250000000,
      bank_asal: '',
      no_referensi: '',
      tanggal: new Date(Date.now() - 172800000).toISOString(),
      status: 'verified',
      bukti_url: null,
      catatan_admin: 'Penerimaan cash di kantor'
    }
  ]
};

export const paymentService = {
  getPaymentsByJamaah: async (jamaahId) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockPayments[jamaahId] || [];
  },
  
  getAllPayments: async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
    let all = [];
    for (const key in mockPayments) {
      all = all.concat(mockPayments[key]);
    }
    // Sort descending by date
    return all.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  },
  
  getPendingTransfers: async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
    let pending = [];
    for (const key in mockPayments) {
      const p = mockPayments[key].filter(x => x.metode === 'transfer' && x.status === 'pending');
      pending = pending.concat(p);
    }
    return pending.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  },

  // Jamaah mengajukan transfer
  submitTransfer: async (data) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Validation
    const jamaah = await jamaahService.getJamaahById(data.jamaah_id);
    if (data.nominal <= 0 || data.nominal > jamaah.sisa_tagihan) {
        throw new Error(`Nominal tidak valid. Sisa tagihan Anda: Rp ${jamaah.sisa_tagihan.toLocaleString('id-ID')}`);
    }

    const newPayment = {
      ...data,
      id: Math.floor(Math.random() * 100000),
      metode: 'transfer',
      tanggal: new Date().toISOString(),
      status: 'pending',
      catatan_admin: ''
    };

    if (!mockPayments[data.jamaah_id]) mockPayments[data.jamaah_id] = [];
    mockPayments[data.jamaah_id].push(newPayment);
    return newPayment;
  },

  // Admin mencatat cash
  submitCash: async (data) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Validation
    const jamaah = await jamaahService.getJamaahById(data.jamaah_id);
    if (data.nominal <= 0 || data.nominal > jamaah.sisa_tagihan) {
        throw new Error(`Nominal tidak valid. Sisa tagihan jamaah: Rp ${jamaah.sisa_tagihan.toLocaleString('id-ID')}`);
    }

    const newPayment = {
      ...data,
      id: Math.floor(Math.random() * 100000),
      metode: 'cash',
      tanggal: new Date().toISOString(),
      status: 'verified',
      bukti_url: null
    };

    if (!mockPayments[data.jamaah_id]) mockPayments[data.jamaah_id] = [];
    mockPayments[data.jamaah_id].push(newPayment);
    
    // Automatically recalculate balances because status is verified
    await paymentService.recalculateJamaahFinance(data.jamaah_id);
    
    return newPayment;
  },

  // Admin verifikasi transfer
  verifyTransfer: async (paymentId, jamaahId, status, catatan) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const payments = mockPayments[jamaahId];
    if (!payments) throw new Error('Jamaah tidak ditemukan');
    
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) throw new Error('Pembayaran tidak ditemukan');
    
    payment.status = status;
    payment.catatan_admin = catatan;
    
    if (status === 'verified') {
        await paymentService.recalculateJamaahFinance(jamaahId);
    }
    
    return payment;
  },
  
  // Rekalkulasi Sisa Tagihan dan Status Pembayaran
  recalculateJamaahFinance: async (jamaahId) => {
    const payments = mockPayments[jamaahId] || [];
    const verifiedPayments = payments.filter(p => p.status === 'verified');
    const totalTerbayarSah = verifiedPayments.reduce((sum, p) => sum + p.nominal, 0);
    
    const jamaah = await jamaahService.getJamaahById(jamaahId);
    // Assuming Harga Paket is derived from initial sisa tagihan + total terbayar for demo simplicity
    // Or we just calculate based on known total
    const hargaPaket = jamaah.sisa_tagihan + jamaah.total_terbayar;
    
    const sisaTagihan = Math.max(0, hargaPaket - totalTerbayarSah);
    let statusPembayaran = 'Belum Lunas';
    
    if (totalTerbayarSah === 0) {
        statusPembayaran = 'Belum Bayar';
    } else if (totalTerbayarSah > 0 && totalTerbayarSah < hargaPaket) {
        statusPembayaran = 'Cicilan';
    } else if (totalTerbayarSah >= hargaPaket) {
        statusPembayaran = 'Lunas';
    }
    
    // Update the Jamaah
    await jamaahService.updateJamaah(jamaahId, {
        total_terbayar: totalTerbayarSah,
        sisa_tagihan: sisaTagihan,
        status_pembayaran: statusPembayaran
    });
  }
};
