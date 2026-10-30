import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { jamaahService } from '../../services/jamaahService';
import { documentService } from '../../services/documentService';
import { packageService } from '../../services/packageService';
import { scheduleService } from '../../services/scheduleService';
import { installmentService } from '../../services/installmentService';
import PaymentStatusBadge from '../../components/PaymentStatusBadge';
import { ArrowLeft, CheckCircle, FileText, User, CreditCard, AlertTriangle, Calendar } from 'lucide-react';

export default function AdminDetailJamaah() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [jamaah, setJamaah] = useState(null);
  const [dokumen, setDokumen] = useState([]);
  const [terms, setTerms] = useState([]);
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

        const t = await installmentService.getTermsByJamaah(id);
        setTerms(t || []);
        
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
      case 'Dokumen Terverifikasi': return 'verified';
      case 'Lunas': return 'verified';
      case 'Siap Berangkat': return 'verified';
      case 'Menunggu Verifikasi': return 'pending';
      case 'Belum Lunas': return 'pending';
      case 'Dokumen Diproses': return 'pending';
      case 'Perlu Perbaikan': return 'rejected';
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
                    <tr><td>Jenis Kelamin</td><td>{jamaah.jenis_kelamin === 'L' || jamaah.jenis_kelamin === 'Laki-laki' ? 'Laki-laki' : (jamaah.jenis_kelamin === 'P' || jamaah.jenis_kelamin === 'Perempuan' ? 'Perempuan' : (jamaah.jenis_kelamin || '-'))}</td></tr>
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
                    <tr><td width="30%">Paket</td><td>{paket ? (paket.name || paket.nama) : (jamaah.package_name || '-')}</td></tr>
                    <tr><td>Keberangkatan</td><td>{paket?.departure_date ? new Date(paket.departure_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : (jadwal?.tanggal_keberangkatan || '-')}</td></tr>
                </tbody>
            </table>
        </div>
      </div>

      {/* Jadwal Termin Cicilan */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} className="text-primary" /> Jadwal Termin Cicilan
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="status-badge neutral" style={{ fontSize: '0.75rem' }}>
              {terms.filter(t => t.status === 'paid').length} dari {terms.length} Termin Lunas
            </span>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '90px' }}>Termin</th>
                <th>Keterangan</th>
                <th>Jatuh Tempo</th>
                <th style={{ textAlign: 'right' }}>Target Tagihan</th>
                <th style={{ textAlign: 'right' }}>Terbayar Sah</th>
                <th style={{ textAlign: 'right' }}>Sisa Termin</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {terms.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                    Belum ada jadwal termin cicilan untuk jamaah ini.
                  </td>
                </tr>
              ) : (
                terms.map((term) => {
                  const targetNominal = Number(term.target_amount ?? term.amount ?? 0);
                  const verifiedNominal = Number(term.verified_amount ?? 0);
                  const remainingNominal = Number(term.remaining_amount ?? Math.max(0, targetNominal - verifiedNominal));

                  return (
                    <tr key={term.id || term.term_id || term.term_number}>
                      <td style={{ fontWeight: 700 }}>Termin #{term.term_number}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{term.title || `Cicilan Tahap ${term.term_number}`}</div>
                        {term.notes && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{term.notes}</div>
                        )}
                        {Number(term.pending_amount || 0) > 0 && (
                          <div style={{ fontSize: '0.72rem', color: '#d97706' }}>
                            (Ada Rp {Number(term.pending_amount).toLocaleString('id-ID')} pending verifikasi)
                          </div>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {term.due_date ? new Date(term.due_date).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        }) : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        Rp {targetNominal.toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'right', color: verifiedNominal > 0 ? 'var(--success-color)' : 'var(--text-muted)', fontWeight: 600 }}>
                        Rp {verifiedNominal.toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        Rp {remainingNominal.toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <PaymentStatusBadge status={term.status} />
                      </td>
                    </tr>
                  );
                })
              )}
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
                {(() => {
                  const docProgress = documentService.calculateProgress(dokumen);
                  const percent = dokumen.length > 0 ? docProgress.persentase : Number(jamaah.dokumen_persentase || 0);
                  return (
                    <strong style={{ fontSize: '1.2rem', color: percent === 100 ? 'var(--success-color)' : 'var(--warning-color)' }}>
                        {percent}%
                    </strong>
                  );
                })()}
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
