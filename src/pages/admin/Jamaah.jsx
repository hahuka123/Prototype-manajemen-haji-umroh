import React from 'react';
import { UserPlus, Search, Filter } from 'lucide-react';

export default function AdminJamaah() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Manajemen Data Jamaah</h1>
          <p>Kelola data identitas, NIK, nomor paspor, dan paket perjalanan seluruh jamaah.</p>
        </div>
        <div>
          <button className="btn btn-primary">
            <UserPlus size={18} />
            <span>+ Daftarkan Jamaah Baru</span>
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <input 
              type="text" 
              placeholder="Cari nama, NIK, atau nomor paspor..." 
              className="form-input" 
              style={{ paddingLeft: '38px' }}
            />
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
          <select className="form-select" style={{ width: 'auto' }}>
            <option value="">Semua Paket</option>
            <option value="umrah">Umrah Reguler 2027</option>
            <option value="haji">Haji Plus 2027</option>
          </select>
          <select className="form-select" style={{ width: 'auto' }}>
            <option value="">Semua Status</option>
            <option value="pendaftaran">Pendaftaran</option>
            <option value="dokumen">Dokumen Diproses</option>
            <option value="cicilan">Belum Lunas</option>
            <option value="siap">Siap Berangkat</option>
            <option value="selesai">Selesai</option>
          </select>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Lengkap</th>
                <th>NIK</th>
                <th>No. Paspor</th>
                <th>Paket</th>
                <th>Status Jamaah</th>
                <th>Kelengkapan Dokumen</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Ahmad Fauzan</td>
                <td>3271020038840001</td>
                <td>B9872615</td>
                <td>Umrah Reguler 2027</td>
                <td><span className="status-badge pending">Belum Lunas</span></td>
                <td><strong>83%</strong> (5/6)</td>
                <td><button className="btn btn-secondary btn-sm">Detail</button></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Siti Aminah</td>
                <td>3271020038840002</td>
                <td>B1123489</td>
                <td>Umrah Reguler 2027</td>
                <td><span className="status-badge verified">Siap Berangkat</span></td>
                <td><strong>100%</strong> (6/6)</td>
                <td><button className="btn btn-secondary btn-sm">Detail</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
