import { supabase } from './supabase.js';

export const REQUIRED_DOCUMENTS = ['ktp', 'kk', 'passport', 'foto', 'buku-nikah', 'kesehatan'];
const DOCUMENTS_BUCKET = 'documents';

const DEMO_DOCUMENTS = [
  { id: 'demo-doc-1', jamaah_id: 'demo-jamaah-uuid-001', tipe: 'ktp', document_type: 'ktp', status: 'Lengkap', catatan: 'KTP jelas dan terverifikasi.', notes: 'KTP jelas dan terverifikasi.', url: null, updated_at: '2026-09-10' },
  { id: 'demo-doc-2', jamaah_id: 'demo-jamaah-uuid-001', tipe: 'kk', document_type: 'kk', status: 'Lengkap', catatan: 'Kartu Keluarga terverifikasi.', notes: 'Kartu Keluarga terverifikasi.', url: null, updated_at: '2026-09-10' },
  { id: 'demo-doc-3', jamaah_id: 'demo-jamaah-uuid-001', tipe: 'passport', document_type: 'passport', status: 'Lengkap', catatan: 'Paspor aktif (masa berlaku > 12 bulan).', notes: 'Paspor aktif (masa berlaku > 12 bulan).', url: null, updated_at: '2026-09-12' },
  { id: 'demo-doc-4', jamaah_id: 'demo-jamaah-uuid-001', tipe: 'foto', document_type: 'foto', status: 'Lengkap', catatan: 'Pas foto 4x6 latar putih 80% wajah.', notes: 'Pas foto 4x6 latar putih 80% wajah.', url: null, updated_at: '2026-09-12' },
  { id: 'demo-doc-5', jamaah_id: 'demo-jamaah-uuid-001', tipe: 'buku-nikah', document_type: 'buku-nikah', status: 'Menunggu Verifikasi', catatan: '', notes: '', url: null, updated_at: '2026-09-28' },
  { id: 'demo-doc-6', jamaah_id: 'demo-jamaah-uuid-001', tipe: 'kesehatan', document_type: 'kesehatan', status: 'Belum Ada', catatan: '', notes: '', url: null, updated_at: null },
];

export const documentService = {
  // Menentukan status verifikasi dokumen jamaah berdasarkan status berkas yang tersimpan dan dapat dibuktikan
  determineVerificationStatus: (documents = []) => {
    const docs = documents || [];
    const totalWajib = REQUIRED_DOCUMENTS.length; // 6
    
    // 1. Jika ada dokumen yang ditolak, status jamaah = 'Perlu Perbaikan'
    const hasRejected = docs.some(d => d.status === 'Ditolak');
    if (hasRejected) {
      return 'Perlu Perbaikan';
    }
    
    // 2. Jika ada dokumen yang masih menunggu verifikasi admin, status = 'Dokumen Diproses'
    const hasPending = docs.some(d => d.status === 'Menunggu Verifikasi');
    if (hasPending) {
      return 'Dokumen Diproses';
    }
    
    // 3. Hitung dokumen wajib yang sudah benar-benar berstatus 'Lengkap' (disetujui admin)
    const approvedTypes = new Set(
      docs
        .filter(d => d.status === 'Lengkap' && REQUIRED_DOCUMENTS.includes(d.tipe || d.document_type))
        .map(d => d.tipe || d.document_type)
    );
    
    // Jika seluruh 6 dokumen wajib sudah berstatus 'Lengkap'
    if (approvedTypes.size >= totalWajib) {
      return 'Dokumen Terverifikasi';
    }
    
    // Jika ada sebagian berkas yang sudah lengkap namun belum semuanya (dan belum ada yang ditolak/menunggu)
    if (approvedTypes.size > 0) {
      return 'Dokumen Diproses';
    }
    
    // Belum ada dokumen yang diunggah
    return 'Pendaftaran';
  },

  // Sinkronisasi status dokumen ke tabel jamaah di Supabase (best-effort / non-blocking)
  syncJamaahDocumentStatus: async (jamaahId) => {
    if (!jamaahId || typeof jamaahId !== 'string' || jamaahId.startsWith('demo-')) {
      return null;
    }
    try {
      const { data: allDocs, error: docErr } = await supabase
        .from('documents')
        .select('document_type, status')
        .eq('jamaah_id', jamaahId);
        
      if (docErr) throw docErr;
      
      const newStatus = documentService.determineVerificationStatus(allDocs || []);
      
      const { error: updateErr } = await supabase
        .from('jamaah')
        .update({ status: newStatus })
        .eq('id', jamaahId);
        
      if (updateErr) {
        console.warn('[documentService] Sinkronisasi jamaah.status ke DB ditunda (memerlukan migrasi enum):', updateErr.message);
      }
      return newStatus;
    } catch (e) {
      console.warn('[documentService] syncJamaahDocumentStatus error:', e?.message || e);
      return null;
    }
  },

  // Generate signed URL for private document access (300 seconds)
  getDocumentUrl: async (pathOrUrl) => {
    if (!pathOrUrl) return null;
    let path = pathOrUrl;
    if (pathOrUrl.startsWith('http')) {
      const parts = pathOrUrl.split('/documents/');
      if (parts.length > 1) {
        path = decodeURIComponent(parts[1].split('?')[0]);
      } else {
        return pathOrUrl;
      }
    }
    try {
      const { data, error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(path, 300);

      if (error) {
        console.warn('Gagal membuat signed URL dokumen:', error.message);
        return pathOrUrl;
      }
      return data?.signedUrl || pathOrUrl;
    } catch (e) {
      console.warn('Error saat generate signed URL:', e);
      return pathOrUrl;
    }
  },

  // Get all documents for a jamaah
  getDocumentsByJamaah: async (jamaahId) => {
    if (jamaahId === 'demo-jamaah-uuid-001' || jamaahId === 'demo-jamaah-id-456' || (typeof jamaahId === 'string' && jamaahId.startsWith('demo-'))) {
      return DEMO_DOCUMENTS;
    }

    try {
      const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('jamaah_id', jamaahId);
          
      if (error) throw error;
      
      const docs = data || [];
      
      // Fill missing docs with 'Belum Ada' for the UI and generate signed URLs
      const fullDocs = await Promise.all(REQUIRED_DOCUMENTS.map(async (tipe) => {
        const existing = docs.find(d => d.document_type === tipe);
        if (existing) {
            let signedUrl = null;
            if (existing.file_path) {
              signedUrl = await documentService.getDocumentUrl(existing.file_path);
            }
            return {
                id: existing.id,
                jamaah_id: existing.jamaah_id,
                tipe: existing.document_type,
                document_type: existing.document_type,
                status: existing.status,
                catatan: existing.notes || '',
                notes: existing.notes || '',
                url: signedUrl,
                file_path: existing.file_path,
                updated_at: existing.updated_at
            };
        }
        return {
          id: `empty-${tipe}`,
          jamaah_id: jamaahId,
          tipe: tipe,
          document_type: tipe,
          status: 'Belum Ada',
          catatan: '',
          notes: '',
          url: null
        };
      }));
      
      return fullDocs;
    } catch (e) {
      if (typeof jamaahId === 'string' && jamaahId.startsWith('demo-')) {
        return DEMO_DOCUMENTS;
      }
      throw e;
    }
  },

  // Upload a document (Jamaah)
  uploadDocument: async (jamaahId, tipe, file) => {
    const docType = tipe;
    // 1. Upload to Storage (Private)
    const fileExt = file.name.split('.').pop();
    const fileName = `${jamaahId}_${docType}_${Date.now()}.${fileExt}`;
    const filePath = `${jamaahId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePath, file, {
        upsert: true
      });

    if (uploadError) throw uploadError;

    // 2. Upsert record in database with private relative filePath
    const { data: existing } = await supabase
        .from('documents')
        .select('id')
        .eq('jamaah_id', jamaahId)
        .eq('document_type', docType)
        .maybeSingle();
        
    let dbResponse;

    if (existing) {
        dbResponse = await supabase
            .from('documents')
            .update({
                file_path: filePath,
                status: 'Menunggu Verifikasi',
                notes: ''
            })
            .eq('id', existing.id)
            .select()
            .single();
    } else {
        dbResponse = await supabase
            .from('documents')
            .insert([{
                jamaah_id: jamaahId,
                document_type: docType,
                file_path: filePath,
                status: 'Menunggu Verifikasi',
                notes: ''
            }])
            .select()
            .single();
    }
    
    if (dbResponse.error) throw dbResponse.error;
    
    const newDoc = dbResponse.data;
    const signedUrl = await documentService.getDocumentUrl(filePath);
    
    // Sinkronisasi status ke tabel jamaah secara asinkron
    await documentService.syncJamaahDocumentStatus(jamaahId);

    return {
      id: newDoc.id,
      jamaah_id: newDoc.jamaah_id,
      tipe: newDoc.document_type,
      document_type: newDoc.document_type,
      status: newDoc.status,
      catatan: newDoc.notes || '',
      notes: newDoc.notes || '',
      url: signedUrl,
      file_path: newDoc.file_path,
      updated_at: newDoc.updated_at
    };
  },

  // Verify document (Admin)
  verifyDocument: async (jamaahId, tipe, status, catatan = '') => {
    const docType = tipe;
    const { data: existing, error: findError } = await supabase
        .from('documents')
        .select('id, file_path')
        .eq('jamaah_id', jamaahId)
        .eq('document_type', docType)
        .maybeSingle();
        
    if (findError) throw findError;
    if (!existing) throw new Error('Dokumen tidak ditemukan.');
    
    const { data, error } = await supabase
        .from('documents')
        .update({
            status: status,
            notes: catatan || null,
            verified_at: status === 'Lengkap' ? new Date().toISOString() : null
        })
        .eq('id', existing.id)
        .select()
        .single();
        
    if (error) throw error;
    
    let signedUrl = null;
    if (data.file_path) {
      signedUrl = await documentService.getDocumentUrl(data.file_path);
    }
    
    // Sinkronisasi status ke tabel jamaah secara asinkron
    await documentService.syncJamaahDocumentStatus(jamaahId);

    return {
      id: data.id,
      jamaah_id: data.jamaah_id,
      tipe: data.document_type,
      document_type: data.document_type,
      status: data.status,
      catatan: data.notes || '',
      notes: data.notes || '',
      url: signedUrl,
      file_path: data.file_path,
      updated_at: data.updated_at
    };
  },
  
  // Get all documents waiting for verification (Admin)
  getPendingVerifications: async () => {
    const { data, error } = await supabase
        .from('documents')
        .select(`
            *,
            jamaah (
                profile_id,
                profiles:profile_id ( full_name )
            )
        `)
        .eq('status', 'Menunggu Verifikasi')
        .order('updated_at', { ascending: false });
        
    if (error) {
      console.error('[documentService] getPendingVerifications error:', error.message);
      throw error;
    }
    
    return Promise.all((data || []).map(async (d) => {
        let signedUrl = null;
        if (d.file_path) {
          signedUrl = await documentService.getDocumentUrl(d.file_path);
        }
        return {
          id: d.id,
          jamaah_id: d.jamaah_id,
          tipe: d.document_type,
          document_type: d.document_type,
          status: d.status,
          catatan: d.notes || '',
          notes: d.notes || '',
          url: signedUrl,
          file_path: d.file_path,
          updated_at: d.updated_at,
          jamaah_name: d.jamaah?.profiles?.full_name || 'Jamaah'
        };
    }));
  },

  // Hitung progres kelengkapan dokumen (rumus: jumlah dokumen lengkap / 6 * 100)
  calculateProgress: (documents = []) => {
    const totalWajib = REQUIRED_DOCUMENTS.length; // 6
    const lengkap = (documents || []).filter(d => d.status === 'Lengkap' && REQUIRED_DOCUMENTS.includes(d.tipe || d.document_type)).length;
    const persentase = totalWajib > 0 ? Math.min(100, Math.round((lengkap / totalWajib) * 100)) : 0;
    const statusLabel = persentase === 100 ? 'Lengkap' : persentase >= 70 ? 'Hampir Lengkap' : 'Belum Lengkap';
    return {
      total: totalWajib,
      lengkap,
      persentase,
      statusLabel
    };
  }
};
