import React, { useState, useEffect } from 'react';
import { Check, X, FileText } from 'lucide-react';
import { documentService } from '../../services/documentService';
import { jamaahService } from '../../services/jamaahService';

export default function AdminDokumen() {
  const [pendingDocs, setPendingDocs] = useState([]);
  const [jamaahMap, setJamaahMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const docs = await documentService.getPendingVerifications();
      setPendingDocs(docs);
      
      const jamaahIds = [...new Set(docs.map(d => d.jamaah_id))];
      const jMap = {};
      for (const id of jamaahIds) {
          const j = await jamaahService.getJamaahById(id);
          jMap[id] = j.nama_lengkap;
      }
      setJamaahMap(jMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (jamaahId, tipe, status) => {
    let catatan = '';
    if (status === 'Ditolak') {
        catatan = prompt('Masukkan alasan penolakan dokumen:');
        if (catatan === null) return; // Cancelled
    }
    
    try {
        await documentService.verifyDocument(jamaahId, tipe, status, catatan);
        // Refresh data
        fetchData();
        alert(`Dokumen berhasil ${status === 'Lengkap' ? 'disetujui' : 'ditolak'}.`);
    } catch (err) {
        alert(err.message);
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
                  <tr><td colSpan="6" style={{ textAlign: 'center' }}>Loading...</td></tr>
              ) : pendingDocs.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center' }}>Tidak ada dokumen yang menunggu verifikasi.</td></tr>
              ) : (
                  pendingDocs.map(doc => (
                      <tr key={doc.id}>
                        <td style={{ fontWeight: 600 }}>{jamaahMap[doc.jamaah_id] || 'Loading...'}</td>
                        <td style={{ textTransform: 'capitalize' }}>{doc.tipe.replace('-', ' ')}</td>
                        <td>{doc.updated_at ? new Date(doc.updated_at).toLocaleDateString('id-ID') : '-'}</td>
                        <td>
                          <a href={doc.url || '#'} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', gap: '4px' }}>
                            <FileText size={14} /> Lihat File
                          </a>
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
                                onClick={() => handleVerify(doc.jamaah_id, doc.tipe, 'Lengkap')}
                            >
                              <Check size={14} /> Setujui
                            </button>
                            <button 
                                className="btn btn-danger btn-sm" 
                                style={{ padding: '6px 10px' }} 
                                title="Tolak Dokumen"
                                onClick={() => handleVerify(doc.jamaah_id, doc.tipe, 'Ditolak')}
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
