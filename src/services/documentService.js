import { supabase } from './supabase';
import { jamaahService } from './jamaahService';

const REQUIRED_DOCUMENTS = ['ktp', 'kk', 'passport', 'foto', 'buku-nikah', 'kesehatan'];

export const documentService = {
  // Get all documents for a jamaah
  getDocumentsByJamaah: async (jamaahId) => {
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('jamaah_id', jamaahId);
        
    if (error) throw error;
    
    const docs = data || [];
    
    // Fill missing docs with 'Belum Ada' for the UI
    const fullDocs = REQUIRED_DOCUMENTS.map(tipe => {
      const existing = docs.find(d => d.document_type === tipe);
      if (existing) {
          return {
              id: existing.id,
              jamaah_id: existing.jamaah_id,
              tipe: existing.document_type,
              status: existing.status,
              catatan: existing.notes || '',
              url: existing.file_path,
              updated_at: existing.updated_at
          };
      }
      return {
        id: `mock-${Math.random()}`,
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
    // 1. Upload to Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${jamaahId}_${tipe}_${Date.now()}.${fileExt}`;
    const filePath = `${jamaahId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);
        
    const fileUrl = urlData.publicUrl;

    // 2. Upsert record in database
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
                file_path: fileUrl,
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
                file_path: fileUrl,
                status: 'Menunggu Verifikasi',
                notes: ''
            }])
            .select()
            .single();
    }
    
    if (dbResponse.error) throw dbResponse.error;
    
    const newDoc = dbResponse.data;
    
    return {
      id: newDoc.id,
      jamaah_id: newDoc.jamaah_id,
      tipe: newDoc.document_type,
      status: newDoc.status,
      catatan: newDoc.notes || '',
      url: newDoc.file_path,
      updated_at: newDoc.updated_at
    };
  },

  // Verify document (Admin)
  verifyDocument: async (jamaahId, tipe, status, catatan = '') => {
    const { data: existing } = await supabase
        .from('documents')
        .select('id')
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
    
    // Note: No need to call updateDokumenPersentase manually anymore,
    // the PostgreSQL view v_jamaah_billing_summary handles the calculation automatically!
    
    return {
      id: data.id,
      jamaah_id: data.jamaah_id,
      tipe: data.document_type,
      status: data.status,
      catatan: data.notes || '',
      url: data.file_path,
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
    
    return data.map(d => ({
        id: d.id,
        jamaah_id: d.jamaah_id,
        tipe: d.document_type,
        status: d.status,
        catatan: d.notes || '',
        url: d.file_path,
        updated_at: d.updated_at,
        jamaah_name: d.jamaah?.profiles?.full_name || 'Jamaah'
    }));
  }
};
