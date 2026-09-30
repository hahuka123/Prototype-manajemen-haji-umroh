import React from 'react';
import { Check, X, FileText } from 'lucide-react';

export default function AdminDokumen() {
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
              <tr>
                <td style={{ fontWeight: 600 }}>Ahmad Fauzan</td>
                <td>Buku Kuning / Dokumen Kesehatan</td>
                <td>28/09/2026</td>
                <td>
                  <a href="#" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', gap: '4px' }}>
                    <FileText size={14} /> Lihat File
                  </a>
                </td>
                <td>
                  <span className="status-badge pending">Menunggu Verifikasi</span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-primary btn-sm" style={{ padding: '6px 10px' }} title="Setujui Dokumen">
                      <Check size={14} /> Setujui
                    </button>
                    <button className="btn btn-danger btn-sm" style={{ padding: '6px 10px' }} title="Tolak Dokumen">
                      <X size={14} /> Tolak
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
