import React, { useState, useEffect, useRef } from 'react';
import { Upload, CheckCircle2, Clock, XCircle, AlertCircle, FileText, Eye, Loader2 } from 'lucide-react';
import { documentService } from '../../services/documentService';
import { jamaahService } from '../../services/jamaahService';
import { useAuth } from '../../hooks/useAuth';

export default function JamaahDokumen() {
  const { profile } = useAuth();
  const [jamaah, setJamaah] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [persentase, setPersentase] = useState(0);
  const [uploadingTipe, setUploadingTipe] = useState(null);
  const [activeTipe, setActiveTipe] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (!profile?.id) return;
      const jData = await jamaahService.getMyJamaah(profile.id);
      setJamaah(jData);
      setPersentase(jData.dokumen_persentase);

      const docs = await documentService.getDocumentsByJamaah(jData.id);
      setDocuments(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerUpload = (tipe) => {
    if (!jamaah?.id) {
      alert('Data jamaah belum terhubung dengan akun login Anda.');
      return;
    }
    setActiveTipe(tipe);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeTipe || !jamaah?.id) return;

    // Validasi tipe file
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Format file tidak didukung. Harap unggah berkas PDF, JPG, atau PNG.');
      return;
    }

    // Validasi ukuran file (maksimal 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran berkas melebihi batas 5MB. Silakan kompres atau pilih berkas lain.');
      return;
    }

    try {
      setUploadingTipe(activeTipe);
      await documentService.uploadDocument(jamaah.id, activeTipe, file);
      alert(`Berkas ${activeTipe.replace('-', ' ')} berhasil diunggah dan masuk antrean verifikasi.`);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Gagal mengunggah berkas: ' + (err.message || 'Terjadi kesalahan sistem'));
    } finally {
      setUploadingTipe(null);
      setActiveTipe(null);
    }
  };

  const totalWajib = 6;
  const totalLengkap = documents.filter(d => d.status === 'Lengkap').length;

  if (loading) return <div className="p-8 text-center">Loading dokumen...</div>;
  if (!jamaah) return (
    <div className="card" style={{ margin: '24px', padding: '32px', textAlign: 'center' }}>
      <AlertCircle size={44} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Data Jamaah Belum Terhubung</h3>
      <p style={{ color: 'var(--text-muted)', marginTop: '8px', maxWidth: '600px', margin: '8px auto' }}>
        Akun yang sedang login (ID: <code>{profile?.id}</code>) belum memiliki data jamaah yang terdaftar di database Supabase.
      </p>
      <div style={{ marginTop: '20px', fontSize: '0.875rem', color: 'var(--text-muted)', background: '#f8fafc', padding: '16px', borderRadius: '8px', display: 'inline-block', textAlign: 'left', lineHeight: 1.6, border: '1px solid var(--border-color)' }}>
        <strong>Checklist Supabase:</strong><br />
        1. Pastikan tidak login menggunakan <strong>Demo Mode</strong>.<br />
        2. Buka Supabase Table Editor &rarr; tabel <code>jamaah</code>.<br />
        3. Pastikan kolom <code>profile_id</code> diisi sesuai ID akun: <code>{profile?.id}</code>.<br />
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Dokumen Persyaratan Ibadah</h1>
          <p>Pantau kelengkapan berkas fisik dan digital persyaratan pendaftaran haji/umroh Anda.</p>
        </div>
      </div>

      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/jpeg,image/png,application/pdf"
        style={{ display: 'none' }} 
      />

      {/* Progress Card Persentase Kelengkapan */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Progres Kelengkapan Berkas</span>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--primary-800)', marginTop: '2px' }}>
              {persentase}% • {persentase === 100 ? 'Lengkap' : persentase >= 70 ? 'Hampir Lengkap' : 'Belum Lengkap'}
            </h2>
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
            {totalLengkap} dari {totalWajib} Dokumen Lengkap
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: '10px', background: 'var(--border-color)', borderRadius: '9999px', overflow: 'hidden' }}>
          <div style={{
            width: `${persentase}%`,
            height: '100%',
            background: persentase === 100 ? '#10b981' : 'linear-gradient(90deg, var(--accent-500), var(--primary-600))',
            borderRadius: '9999px',
            transition: 'width 0.4s ease'
          }} />
        </div>
      </div>

      {/* Tabel Dokumen */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Jenis Dokumen</th>
                <th>Status Berkas</th>
                <th>Tanggal Upload</th>
                <th>Catatan Verifikator</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center' }}>Tidak ada dokumen.</td></tr>
              ) : (
                  documents.map((doc, idx) => (
                      <tr key={doc.id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{doc.tipe.replace('-', ' ')}</td>
                        <td>
                          {doc.status === 'Lengkap' && <span className="status-badge verified">Lengkap</span>}
                          {doc.status === 'Menunggu Verifikasi' && <span className="status-badge pending">Menunggu Verifikasi</span>}
                          {doc.status === 'Ditolak' && <span className="status-badge rejected">Ditolak</span>}
                          {doc.status === 'Belum Ada' && <span className="status-badge" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>Belum Ada</span>}
                        </td>
                        <td>{doc.updated_at ? new Date(doc.updated_at).toLocaleDateString('id-ID') : '-'}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{doc.catatan || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {doc.url && (
                              <a 
                                href={doc.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="btn btn-secondary btn-sm"
                                style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}
                                title="Lihat Berkas"
                              >
                                <Eye size={14} />
                                <span>Lihat</span>
                              </a>
                            )}
                            <button 
                              className="btn btn-primary btn-sm" 
                              style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
                              onClick={() => handleTriggerUpload(doc.tipe)}
                              disabled={uploadingTipe === doc.tipe}
                            >
                              {uploadingTipe === doc.tipe ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  <span>Mengunggah...</span>
                                </>
                              ) : (
                                <>
                                  <Upload size={14} />
                                  <span>{doc.status === 'Belum Ada' ? 'Upload Berkas' : 'Ganti File'}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
