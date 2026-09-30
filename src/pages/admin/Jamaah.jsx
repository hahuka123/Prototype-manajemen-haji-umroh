import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Filter, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { jamaahService } from '../../services/jamaahService';
import { packageService } from '../../services/packageService';

export default function AdminJamaah() {
  const [jamaahList, setJamaahList] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [jData, pData] = await Promise.all([
            jamaahService.getJamaah(),
            packageService.getPackages()
        ]);
        setJamaahList(jData);
        setPackages(pData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getPackageName = (id) => {
      const p = packages.find(pkg => pkg.id === id);
      return p ? p.nama : '-';
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Siap Berangkat': return 'verified';
      case 'Lunas': return 'verified';
      case 'Selesai': return 'verified';
      case 'Dokumen Diproses': return 'pending';
      case 'Belum Lunas': return 'pending';
      case 'Pendaftaran': return 'pending';
      default: return '';
    }
  };

  const filteredJamaah = jamaahList.filter(j => 
      j.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) || 
      j.nik.includes(searchTerm)
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Manajemen Data Jamaah</h1>
          <p>Kelola data identitas, NIK, dokumen, dan keberangkatan seluruh jamaah.</p>
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
              placeholder="Cari nama atau NIK..." 
              className="form-input" 
              style={{ paddingLeft: '38px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
          <select className="form-select" style={{ width: 'auto' }}>
            <option value="">Semua Paket</option>
            {packages.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
          <select className="form-select" style={{ width: 'auto' }}>
            <option value="">Semua Status</option>
            <option value="Pendaftaran">Pendaftaran</option>
            <option value="Dokumen Diproses">Dokumen Diproses</option>
            <option value="Siap Berangkat">Siap Berangkat</option>
          </select>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Lengkap</th>
                <th>NIK</th>
                <th>Paket</th>
                <th>Status Jamaah</th>
                <th>Dokumen</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center' }}>Loading...</td></tr>
              ) : filteredJamaah.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center' }}>Tidak ada data jamaah.</td></tr>
              ) : (
                  filteredJamaah.map(j => (
                      <tr key={j.id}>
                        <td style={{ fontWeight: 600 }}>{j.nama_lengkap}</td>
                        <td>{j.nik}</td>
                        <td>{getPackageName(j.paket_id)}</td>
                        <td><span className={`status-badge ${getStatusBadgeClass(j.status_keberangkatan)}`}>{j.status_keberangkatan}</span></td>
                        <td>
                            <strong style={{ color: j.dokumen_persentase === 100 ? 'var(--success-color)' : 'inherit' }}>
                                {j.dokumen_persentase}%
                            </strong>
                        </td>
                        <td>
                            <button 
                                className="btn btn-secondary btn-sm" 
                                onClick={() => navigate(`/admin/jamaah/${j.id}`)}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <Eye size={14} /> Detail
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
