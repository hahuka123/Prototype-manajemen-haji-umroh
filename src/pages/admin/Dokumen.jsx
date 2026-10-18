import React, { useState, useEffect } from 'react';
import { Check, X, FileText, AlertCircle } from 'lucide-react';
import { documentService } from '../../services/documentService';
import { jamaahService } from '../../services/jamaahService';

export default function AdminDokumen() {
  const [pendingDocs, setPendingDocs] = useState([]);
  const [jamaahMap, setJamaahMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [verifyingId, setVerifyingId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const docs = await documentService.getPendingVerifications();
      setPendingDocs(docs || []);
      
      const jamaahIds = [...new Set((docs || []).map(d => d.jamaah_id).filter(Boolean))];
      const jMap = {};
      await Promise.all(jamaahIds.map(async (id) => {
        try {
          const j = await jamaahService.getJamaahById(id);
          jMap[id] = j?.nama_lengkap || 'Jamaah';
        } catch (e) {
          jMap[id] = 'Jamaah';
        }
      }));
      setJamaahMap(jMap);
    } catch (err) {
      console.error(err);
      setLoadError(err.message || 'Gagal memuat antrean verifikasi dokumen.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (docId, jamaahId, tipe, status) => {
    let catatan = '';
    if (status === 'Ditolak') {
      catatan = prompt('Masukkan alasan penolakan dokumen:');
      if (catatan === null) return; // Cancelled
      if (!catatan.trim()) {
        alert('Alasan penolakan wajib diisi agar jamaah mengetahui apa yang perlu diperbaiki.');
        return;
      }
    }
    
    setVerifyingId(docId);
    try {
      await documentService.verifyDocument(jamaahId, tipe, status, catatan);
      await fetchData();
      alert(`Dokumen berhasil ${status === 'Lengkap' ? 'disetujui' : 'ditolak'}.`);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Gagal memproses verifikasi dokumen.');
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Verifikasi Dokumen Jamaah</h1>
          <p>Tinjau dan verifikasi 6 dokumen wajib jamaah (KTP, KK, Paspor, Pas Foto, Buku Nikah, Kesehatan).</p>
        </div>
      </div>

      {loadError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#b91c1c',
          fontSize: '0.9rem',
          marginBottom: '20px'
        }}>
          <AlertCircle size={18} />
          <span>{loadError}</span>
        </div>
      )}

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Jamaah</th>
                <th>Jenis Dokumen</th>
                <th>Tgl Upload</th>
                <th>Berkas</th>
                <th>Status Saat Ini</th>
                <th>Aksi Verifikasi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>Memuat antrean verifikasi...</td></tr>
              ) : pendingDocs.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Tidak ada dokumen yang menunggu verifikasi.</td></tr>
              ) : (
                pendingDocs.map(doc => (
                  <tr key={doc.id}>
                    <td style={{ fontWeight: 600 }}>{doc.jamaah_name || jamaahMap[doc.jamaah_id] || 'Jamaah'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{(doc.tipe || doc.document_type || '').replace('-', ' ')}</td>
                    <td>{doc.updated_at ? new Date(doc.updated_at).toLocaleDateString('id-ID') : '-'}</td>
                    <td>
                      {doc.url ? (
                        <a 
                          href={doc.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn btn-secondary btn-sm" 
                          style={{ display: 'inline-flex', gap: '4px' }}
                        >
                          <FileText size={14} /> Lihat File
                        </a>
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tidak ada berkas</span>
                      )}
                    </td>
                    <td>
                      <span className="status-badge pending">{doc.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="btn btn-primary btn-sm" 
                          style={{ padding: '6px 10px' }} 
                          title="Setujui Dokumen"
                          disabled={verifyingId === doc.id}
                          onClick={() => handleVerify(doc.id, doc.jamaah_id, doc.tipe || doc.document_type, 'Lengkap')}
                        >
                          <Check size={14} /> {verifyingId === doc.id ? 'Memproses...' : 'Setujui'}
                        </button>
                        <button 
                          className="btn btn-danger btn-sm" 
                          style={{ padding: '6px 10px' }} 
                          title="Tolak Dokumen"
                          disabled={verifyingId === doc.id}
                          onClick={() => handleVerify(doc.id, doc.jamaah_id, doc.tipe || doc.document_type, 'Ditolak')}
                        >
                          <X size={14} /> Tolak
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
