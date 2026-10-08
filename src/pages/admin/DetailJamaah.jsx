import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { jamaahService } from '../../services/jamaahService';
import { documentService } from '../../services/documentService';
import { packageService } from '../../services/packageService';
import { scheduleService } from '../../services/scheduleService';
import { ArrowLeft, CheckCircle, FileText, User, CreditCard, AlertTriangle } from 'lucide-react';

export default function AdminDetailJamaah() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [jamaah, setJamaah] = useState(null);
  const [dokumen, setDokumen] = useState([]);
  const [paket, setPaket] = useState(null);
  const [jadwal, setJadwal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const j = await jamaahService.getJamaahById(id);
        setJamaah(j);
        
        const d = await documentService.getDocumentsByJamaah(id);
        setDokumen(d);
        
        if (j.paket_id) {
            const p = await packageService.getPackages();
            setPaket(p.find(pkg => pkg.id === j.paket_id));
        }
        
        if (j.jadwal_id) {
            const s = await scheduleService.getSchedules();
            setJadwal(s.find(sch => sch.id === j.jadwal_id));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  if (!jamaah) return <div className="p-8 text-center">Jamaah tidak ditemukan.</div>;

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Lengkap': return 'verified';
      case 'Lunas': return 'verified';
      case 'Siap Berangkat': return 'verified';
      case 'Menunggu Verifikasi': return 'pending';
      case 'Belum Lunas': return 'pending';
      case 'Dokumen Diproses': return 'pending';
      case 'Ditolak': return 'rejected';
      default: return '';
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <button onClick={() => navigate('/admin/jamaah')} className="btn btn-secondary btn-sm" style={{ padding: '6px' }}>
                <ArrowLeft size={18} />
             </button>
             <h1>Detail Jamaah: {jamaah.nama_lengkap}</h1>
          </div>
          <p>NIK: {jamaah.nik}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Identitas */}
        <div className="card">
            <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={18} className="text-primary" /> Data Identitas
            </h3>
            <table className="data-table">
                <tbody>
                    <tr><td width="30%">Nama Lengkap</td><td><strong>{jamaah.nama_lengkap}</strong></td></tr>
                    <tr><td>NIK</td><td>{jamaah.nik}</td></tr>
                    <tr><td>Jenis Kelamin</td><td>{jamaah.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</td></tr>
                    <tr><td>No. Telepon</td><td>{jamaah.no_telepon}</td></tr>
                    <tr><td>Alamat</td><td>{jamaah.alamat}</td></tr>
                    <tr><td>Status Keberangkatan</td><td><span className={`status-badge ${getStatusBadgeClass(jamaah.status_keberangkatan)}`}>{jamaah.status_keberangkatan}</span></td></tr>
                </tbody>
            </table>
        </div>

        {/* Finansial */}
        <div className="card">
            <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} className="text-primary" /> Ringkasan Finansial
            </h3>
            <div style={{ padding: '15px', backgroundColor: 'var(--surface-color)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Status Pembayaran</span>
                    <span className={`status-badge ${getStatusBadgeClass(jamaah.status_pembayaran)}`}>{jamaah.status_pembayaran}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Total Terbayar Sah</span>
                    <strong style={{ color: 'var(--success-color)', fontSize: '1.1rem' }}>Rp {jamaah.total_terbayar.toLocaleString('id-ID')}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Sisa Tagihan</span>
                    <strong style={{ color: 'var(--danger-color)', fontSize: '1.1rem' }}>Rp {jamaah.sisa_tagihan.toLocaleString('id-ID')}</strong>
                </div>
            </div>
            
            <table className="data-table">
                <tbody>
                    <tr><td width="30%">Paket</td><td>{paket ? paket.nama : '-'}</td></tr>
                    <tr><td>Jadwal</td><td>{jadwal ? jadwal.tanggal_keberangkatan : '-'}</td></tr>
                </tbody>
            </table>
        </div>
      </div>

      {/* Dokumen */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} className="text-primary" /> Kelengkapan Dokumen
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>Persentase:</span>
                <strong style={{ fontSize: '1.2rem', color: jamaah.dokumen_persentase === 100 ? 'var(--success-color)' : 'var(--warning-color)' }}>
                    {jamaah.dokumen_persentase}%
                </strong>
            </div>
        </div>
        
        <div className="table-container">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Tipe Dokumen</th>
                        <th>Status</th>
                        <th>Terakhir Diupdate</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    {dokumen.map(doc => (
                        <tr key={doc.tipe}>
                            <td style={{ textTransform: 'capitalize' }}>{doc.tipe.replace('-', ' ')}</td>
                            <td><span className={`status-badge ${getStatusBadgeClass(doc.status)}`}>{doc.status}</span></td>
                            <td>{doc.updated_at ? new Date(doc.updated_at).toLocaleDateString('id-ID') : '-'}</td>
                            <td>
                                {doc.status === 'Menunggu Verifikasi' && (
                                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/dokumen')}>Verifikasi di Antrean</button>
                                )}
                                {doc.status !== 'Belum Ada' && doc.status !== 'Menunggu Verifikasi' && (
                                     doc.url ? (
                                       <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">Lihat</a>
                                     ) : (
                                       <button className="btn btn-secondary btn-sm" disabled>Lihat</button>
                                     )
                                )}
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
