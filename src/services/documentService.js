import { supabase } from './supabase';
import { jamaahService } from './jamaahService';

const REQUIRED_DOCUMENTS = ['ktp', 'kk', 'passport', 'foto', 'buku-nikah', 'kesehatan'];
const DOCUMENTS_BUCKET = 'documents';

export const documentService = {
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
              status: existing.status,
              catatan: existing.notes || '',
              url: signedUrl,
              file_path: existing.file_path,
              updated_at: existing.updated_at
          };
      }
      return {
        id: `empty-${tipe}`,
        jamaah_id: jamaahId,
        tipe: tipe,
        status: 'Belum Ada',
        catatan: '',
        url: null
      };
    }));
    
    return fullDocs;
  },

  // Upload a document (Jamaah)
  uploadDocument: async (jamaahId, tipe, file) => {
    // 1. Upload to Storage (Private)
    const fileExt = file.name.split('.').pop();
    const fileName = `${jamaahId}_${tipe}_${Date.now()}.${fileExt}`;
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
        .eq('document_type', tipe)
        .single();
        
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
                document_type: tipe,
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
    
    return {
      id: newDoc.id,
      jamaah_id: newDoc.jamaah_id,
      tipe: newDoc.document_type,
      status: newDoc.status,
      catatan: newDoc.notes || '',
      url: signedUrl,
      file_path: newDoc.file_path,
      updated_at: newDoc.updated_at
    };
  },

  // Verify document (Admin)
  verifyDocument: async (jamaahId, tipe, status, catatan = '') => {
    const { data: existing } = await supabase
        .from('documents')
        .select('id, file_path')
        .eq('jamaah_id', jamaahId)
        .eq('document_type', tipe)
        .single();
        
    if (!existing) throw new Error('Document not found');
    
    const { data, error } = await supabase
        .from('documents')
        .update({
            status: status,
            notes: catatan,
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
    
    return {
      id: data.id,
      jamaah_id: data.jamaah_id,
      tipe: data.document_type,
      status: data.status,
      catatan: data.notes || '',
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
        
    if (error) throw error;
    
    return Promise.all(data.map(async (d) => {
        let signedUrl = null;
        if (d.file_path) {
          signedUrl = await documentService.getDocumentUrl(d.file_path);
        }
        return {
          id: d.id,
          jamaah_id: d.jamaah_id,
          tipe: d.document_type,
          status: d.status,
          catatan: d.notes || '',
          url: signedUrl,
          file_path: d.file_path,
          updated_at: d.updated_at,
          jamaah_name: d.jamaah?.profiles?.full_name || 'Jamaah'
        };
    }));
  }
};
