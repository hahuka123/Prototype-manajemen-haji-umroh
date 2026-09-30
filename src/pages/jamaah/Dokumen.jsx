import React, { useState } from 'react';
import { Upload, CheckCircle2, Clock, XCircle, AlertCircle, FileText } from 'lucide-react';

export default function JamaahDokumen() {
  const [documents, setDocuments] = useState([
    { id: 'doc-1', type: 'KTP (Kartu Tanda Penduduk)', status: 'Lengkap', date: '15/08/2026', notes: '' },
    { id: 'doc-2', type: 'Kartu Keluarga (KK)', status: 'Lengkap', date: '15/08/2026', notes: '' },
    { id: 'doc-3', type: 'Paspor Asli', status: 'Lengkap', date: '20/08/2026', notes: '' },
    { id: 'doc-4', type: 'Pas Foto Background Putih (4x6)', status: 'Lengkap', date: '20/08/2026', notes: '' },
    { id: 'doc-5', type: 'Buku Nikah (Bagi Suami Istri)', status: 'Lengkap', date: '22/08/2026', notes: '' },
    { id: 'doc-6', type: 'Buku Kuning / Dokumen Kesehatan Meningitis', status: 'Menunggu Verifikasi', date: '28/09/2026', notes: 'Sedang diperiksa petugas' }
  ]);

  const totalWajib = 6;
  const totalLengkap = documents.filter(d => d.status === 'Lengkap').length;
  const persentase = Math.round((totalLengkap / totalWajib) * 100);

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
              {documents.map((doc, idx) => (
                <tr key={doc.id}>
                  <td>{idx + 1}</td>
                  <td style={{ fontWeight: 600 }}>{doc.type}</td>
                  <td>
                    {doc.status === 'Lengkap' && <span className="status-badge lengkap">Lengkap</span>}
                    {doc.status === 'Menunggu Verifikasi' && <span className="status-badge pending">Menunggu Verifikasi</span>}
                    {doc.status === 'Ditolak' && <span className="status-badge rejected">Ditolak</span>}
                    {doc.status === 'Belum Ada' && <span className="status-badge neutral">Belum Ada</span>}
                  </td>
                  <td>{doc.date || '-'}</td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{doc.notes || '-'}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', gap: '6px' }}>
                      <Upload size={14} />
                      <span>{doc.status === 'Belum Ada' ? 'Upload' : 'Ganti File'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
