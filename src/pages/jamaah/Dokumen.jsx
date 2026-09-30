import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle2, Clock, XCircle, AlertCircle, FileText } from 'lucide-react';
import { documentService } from '../../services/documentService';
import { jamaahService } from '../../services/jamaahService';

export default function JamaahDokumen() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [persentase, setPersentase] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Assuming Jamaah ID 1
      const jamaahId = 1;
      const docs = await documentService.getDocumentsByJamaah(jamaahId);
      setDocuments(docs);
      
      const jamaah = await jamaahService.getJamaahById(jamaahId);
      setPersentase(jamaah.dokumen_persentase);
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (tipe) => {
    // Mock file selection
    const mockFile = new File(['mock content'], `${tipe}.pdf`, { type: 'application/pdf' });
    
    try {
        await documentService.uploadDocument(1, tipe, mockFile);
        alert(`Dokumen ${tipe} berhasil diunggah dan menunggu verifikasi.`);
        fetchData();
    } catch (err) {
        alert(err.message);
    }
  };

  const totalWajib = 6;
  const totalLengkap = documents.filter(d => d.status === 'Lengkap').length;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Dokumen Persyaratan Ibadah</h1>
          <p>Pantau kelengkapan berkas fisik dan digital persyaratan pendaftaran haji/umroh Anda.</p>
        </div>
      </div>

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
              {loading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center' }}>Loading...</td></tr>
              ) : documents.length === 0 ? (
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
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ display: 'inline-flex', gap: '6px' }}
                            onClick={() => handleUpload(doc.tipe)}
                          >
                            <Upload size={14} />
                            <span>{doc.status === 'Belum Ada' ? 'Upload' : 'Ganti File'}</span>
                          </button>
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
