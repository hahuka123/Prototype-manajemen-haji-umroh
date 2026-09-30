// src/services/documentService.js

import { jamaahService } from './jamaahService';

const REQUIRED_DOCUMENTS = ['ktp', 'kk', 'passport', 'foto', 'buku-nikah', 'kesehatan'];

// Initial mock data
// Key: jamaah_id
let mockDocuments = {
  1: [
    { id: 101, jamaah_id: 1, tipe: 'ktp', status: 'Lengkap', catatan: '', updated_at: new Date().toISOString(), url: '#' },
    { id: 102, jamaah_id: 1, tipe: 'kk', status: 'Lengkap', catatan: '', updated_at: new Date().toISOString(), url: '#' },
    { id: 103, jamaah_id: 1, tipe: 'passport', status: 'Menunggu Verifikasi', catatan: '', updated_at: new Date().toISOString(), url: '#' }
    // others are Belum Ada
  ],
  2: [
    { id: 201, jamaah_id: 2, tipe: 'ktp', status: 'Lengkap', catatan: '', updated_at: new Date().toISOString(), url: '#' },
    { id: 202, jamaah_id: 2, tipe: 'kk', status: 'Lengkap', catatan: '', updated_at: new Date().toISOString(), url: '#' },
    { id: 203, jamaah_id: 2, tipe: 'passport', status: 'Lengkap', catatan: '', updated_at: new Date().toISOString(), url: '#' },
    { id: 204, jamaah_id: 2, tipe: 'foto', status: 'Lengkap', catatan: '', updated_at: new Date().toISOString(), url: '#' },
    { id: 205, jamaah_id: 2, tipe: 'buku-nikah', status: 'Lengkap', catatan: '', updated_at: new Date().toISOString(), url: '#' },
    { id: 206, jamaah_id: 2, tipe: 'kesehatan', status: 'Lengkap', catatan: '', updated_at: new Date().toISOString(), url: '#' }
  ]
};

export const documentService = {
  // Get all documents for a jamaah
  getDocumentsByJamaah: async (jamaahId) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const docs = mockDocuments[jamaahId] || [];
    
    // Fill missing docs with 'Belum Ada'
    const fullDocs = REQUIRED_DOCUMENTS.map(tipe => {
      const existing = docs.find(d => d.tipe === tipe);
      if (existing) return existing;
      return {
        id: Math.random(),
        jamaah_id: jamaahId,
        tipe: tipe,
        status: 'Belum Ada',
        catatan: '',
        url: null
      };
    });
    
    return fullDocs;
  },

  // Upload a document (Jamaah)
  uploadDocument: async (jamaahId, tipe, file) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (!mockDocuments[jamaahId]) {
      mockDocuments[jamaahId] = [];
    }
    
    let docs = mockDocuments[jamaahId];
    let docIndex = docs.findIndex(d => d.tipe === tipe);
    
    const newDoc = {
      id: Math.random(),
      jamaah_id: jamaahId,
      tipe: tipe,
      status: 'Menunggu Verifikasi',
      catatan: '',
      url: URL.createObjectURL(file), // Mock URL
      updated_at: new Date().toISOString()
    };

    if (docIndex >= 0) {
      docs[docIndex] = newDoc;
    } else {
      docs.push(newDoc);
    }
    
    return newDoc;
  },

  // Verify document (Admin)
  verifyDocument: async (jamaahId, tipe, status, catatan = '') => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (!mockDocuments[jamaahId]) return null;
    
    let docs = mockDocuments[jamaahId];
    let doc = docs.find(d => d.tipe === tipe);
    
    if (doc) {
      doc.status = status;
      doc.catatan = catatan;
      doc.updated_at = new Date().toISOString();
      
      // Calculate percentage and update jamaah
      const fullDocs = await documentService.getDocumentsByJamaah(jamaahId);
      const lengkapCount = fullDocs.filter(d => d.status === 'Lengkap').length;
      const persentase = Math.round((lengkapCount / REQUIRED_DOCUMENTS.length) * 100);
      
      await jamaahService.updateDokumenPersentase(jamaahId, persentase);
      
      return doc;
    }
    
    throw new Error('Document not found');
  },
  
  // Get all documents waiting for verification (Admin)
  getPendingVerifications: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let pending = [];
    for (const jamaahId in mockDocuments) {
      const docs = mockDocuments[jamaahId].filter(d => d.status === 'Menunggu Verifikasi');
      if (docs.length > 0) {
        pending = pending.concat(docs);
      }
    }
    return pending;
  }
};
