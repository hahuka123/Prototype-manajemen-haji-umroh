import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { jamaahService } from '../../services/jamaahService';
import { documentService } from '../../services/documentService';
import { packageService } from '../../services/packageService';
import { scheduleService } from '../../services/scheduleService';
import { installmentService, getJakartaCurrentDateStr, validateTermInput } from '../../services/installmentService';
import PaymentStatusBadge from '../../components/PaymentStatusBadge';
import Modal from '../../components/Modal';
import { useAuth } from '../../hooks/useAuth';
import { 
  ArrowLeft, 
  CheckCircle, 
  FileText, 
  User, 
  CreditCard, 
  AlertTriangle, 
  Calendar,
  PlusCircle,
  AlertCircle
} from 'lucide-react';

export default function AdminDetailJamaah() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [jamaah, setJamaah] = useState(null);
  const [dokumen, setDokumen] = useState([]);
  const [terms, setTerms] = useState([]);
  const [paket, setPaket] = useState(null);
  const [jadwal, setJadwal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State Modal Tambah Termin
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submittingTerm, setSubmittingTerm] = useState(false);
  const [termFormError, setTermFormError] = useState('');
  const [toastNotification, setToastNotification] = useState(null);

  const [termFormData, setTermFormData] = useState({
    term_number: 1,
    title: '',
    amount: '',
    due_date: '',
    notes: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const j = await jamaahService.getJamaahById(id);
      setJamaah(j);
      
      const d = await documentService.getDocumentsByJamaah(id);
      setDokumen(d);

      const t = await installmentService.getTermsByJamaah(id);
      setTerms(t || []);
      
      if (j && j.paket_id) {
          const p = await packageService.getPackages();
          setPaket(p.find(pkg => pkg.id === j.paket_id));
      }
      
      if (j && j.jadwal_id) {
          const s = await scheduleService.getSchedules();
          setJadwal(s.find(sch => sch.id === j.jadwal_id));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Menentukan nomor urut berikutnya secara otomatis
  const getNextTermNumber = () => {
    if (!terms || terms.length === 0) return 1;
    const nums = terms.map(t => Number(t.term_number || 0)).filter(n => !isNaN(n) && n > 0);
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  };

  // Menentukan tanggal jatuh tempo default (30 hari dari hari ini di WIB)
  const getDefaultDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    try {
      return getJakartaCurrentDateStr(d);
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  };

  // Menghitung batas maksimum alokasi nominal termin cicilan
  const pkgPrice = Number(jamaah?.package_price || paket?.price || paket?.harga || 0);
  const termsTargetSum = terms.reduce((sum, t) => sum + Number(t.target_amount ?? t.amount ?? 0), 0);
  const termsVerifiedSum = terms.reduce((sum, t) => sum + Number(t.verified_amount ?? 0), 0);
  const termsPendingSum = terms.reduce((sum, t) => sum + Number(t.pending_amount ?? 0), 0);

  // Pembayaran yang belum/tidak terikat pada termin (legacy unallocated payments)
  const unlinkedVerified = Math.max(0, Number(jamaah?.total_terbayar || 0) - termsVerifiedSum);
  const unlinkedPending = Math.max(0, Number(jamaah?.pending_verifikasi || 0) - termsPendingSum);

  const isFullyPaid = jamaah?.status_pembayaran === 'Lunas' || Number(jamaah?.sisa_tagihan || 0) <= 0;

  let maxSchedulableAmount = 0;
  if (isFullyPaid) {
    maxSchedulableAmount = 0;
  } else if (pkgPrice > 0) {
    // Total target seluruh termin + pembayaran di luar termin tidak boleh melebihi harga paket
    maxSchedulableAmount = Math.max(0, pkgPrice - termsTargetSum - unlinkedVerified - unlinkedPending);
  } else {
    // Fallback berbasis sisa tagihan jika data harga paket belum terisi
    const termsRemainingSum = terms.reduce(
      (sum, t) => sum + Number(t.remaining_amount ?? Math.max(0, (t.target_amount || t.amount || 0) - (t.verified_amount || 0))),
      0
    );
    maxSchedulableAmount = Math.max(0, Number(jamaah?.sisa_tagihan || 0) - termsRemainingSum - unlinkedPending);
  }

  const handleOpenModal = () => {
    const nextNum = getNextTermNumber();
    setTermFormData({
      term_number: nextNum,
      title: `Cicilan Tahap ${nextNum}`,
      amount: maxSchedulableAmount > 0 ? String(maxSchedulableAmount) : '',
      due_date: getDefaultDueDate(),
      notes: ''
    });
    setTermFormError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (submittingTerm) return;
    setIsModalOpen(false);
    setTermFormError('');
  };

  const handleSubmitTerm = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    // 1. Role Guard
    const activeRole = profile?.role || user?.app_metadata?.role;
    if (profile && activeRole && activeRole !== 'admin') {
      setTermFormError('Hanya akun dengan peran Admin yang berwenang menambahkan termin cicilan.');
      return;
    }

    const termNum = Number(termFormData.term_number);
    const amountVal = Number(termFormData.amount);
    const titleVal = (termFormData.title || '').trim();
    const dueDateVal = (termFormData.due_date || '').trim();

    // 2. Validasi nomor urut
    if (!termNum || termNum <= 0 || !Number.isInteger(termNum)) {
      setTermFormError('Nomor urut termin harus berupa bilangan bulat positif (>= 1).');
      return;
    }

    const isDuplicate = terms.some(t => Number(t.term_number) === termNum);
    if (isDuplicate) {
      setTermFormError(`Nomor termin #${termNum} sudah digunakan untuk jamaah ini. Harap gunakan nomor termin lain.`);
      return;
    }

    // 3. Validasi judul
    if (!titleVal) {
      setTermFormError('Judul / keterangan termin cicilan wajib diisi.');
      return;
    }

    // 4. Validasi nominal dan kapasitas tagihan
    if (isNaN(amountVal) || amountVal <= 0) {
      setTermFormError('Nominal target termin harus berupa angka positif lebih besar dari Rp 0.');
      return;
    }

    if (maxSchedulableAmount <= 0) {
      setTermFormError('Seluruh tagihan jamaah sudah lunas atau sudah terjadwal penuh ke dalam termin.');
      return;
    }

    if (amountVal > maxSchedulableAmount) {
      setTermFormError(
        `Nominal target (Rp ${amountVal.toLocaleString('id-ID')}) melebihi sisa alokasi tagihan yang diperbolehkan (Rp ${maxSchedulableAmount.toLocaleString('id-ID')}).`
      );
      return;
    }

    // 5. Validasi tanggal jatuh tempo
    if (!dueDateVal || !/^\d{4}-\d{2}-\d{2}/.test(dueDateVal)) {
      setTermFormError('Tanggal jatuh tempo wajib diisi dengan format YYYY-MM-DD yang valid.');
      return;
    }

    // 6. Validasi service contract
    const payload = {
      jamaah_id: id,
      term_number: termNum,
      title: titleVal,
      amount: amountVal,
      due_date: dueDateVal,
      notes: (termFormData.notes || '').trim() || null
    };

    const serviceValidation = validateTermInput(payload);
    if (!serviceValidation.isValid) {
      setTermFormError(serviceValidation.errors.join(' '));
      return;
    }

    try {
      setSubmittingTerm(true);
      setTermFormError('');
      const adminId = user?.id || profile?.id || null;
      await installmentService.createTerm(payload, adminId);

      // Muat ulang data terbaru
      const [updatedTerms, updatedJamaah] = await Promise.all([
        installmentService.getTermsByJamaah(id),
        jamaahService.getJamaahById(id)
      ]);

      setTerms(updatedTerms || []);
      if (updatedJamaah) {
        setJamaah(updatedJamaah);
      }

      handleCloseModal();
      setToastNotification({
        type: 'success',
        message: `Termin #${termNum} ("${titleVal}") sebesar Rp ${amountVal.toLocaleString('id-ID')} berhasil ditambahkan!`
      });

      setTimeout(() => {
        setToastNotification(null);
      }, 5000);
    } catch (err) {
      console.error('[DetailJamaah] Gagal menambah termin cicilan:', err);
      setTermFormError(err.message || 'Gagal menyimpan termin cicilan.');
    } finally {
      setSubmittingTerm(false);
    }
  };

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

      {toastNotification && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: 'var(--radius-md, 8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: toastNotification.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: toastNotification.type === 'success' ? '#065f46' : '#991b1b',
            border: `1px solid ${toastNotification.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            fontSize: '0.9rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {toastNotification.type === 'success' ? <CheckCircle size={18} color="#10b981" /> : <AlertCircle size={18} color="#ef4444" />}
            <span>{toastNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastNotification(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
            aria-label="Tutup notifikasi"
          >
            ×
          </button>
        </div>
      )}

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="status-badge neutral" style={{ fontSize: '0.75rem' }}>
              {terms.filter(t => t.status === 'paid').length} dari {terms.length} Termin Lunas
            </span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleOpenModal}
              disabled={maxSchedulableAmount <= 0}
              title={maxSchedulableAmount <= 0 ? 'Tagihan sudah lunas atau sudah terjadwal penuh' : 'Tambah jadwal termin cicilan'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <PlusCircle size={16} />
              <span>Tambah Termin</span>
            </button>
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
                    Belum ada jadwal termin cicilan untuk jamaah ini. Klik <strong>Tambah Termin</strong> untuk membuat jadwal cicilan.
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

      {/* Modal Tambah Termin Cicilan */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Tambah Jadwal Termin Cicilan"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCloseModal}
              disabled={submittingTerm}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmitTerm}
              disabled={submittingTerm || maxSchedulableAmount <= 0}
            >
              {submittingTerm ? 'Menyimpan...' : 'Simpan Termin'}
            </button>
          </div>
        }
      >
        {termFormError && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              fontSize: '0.85rem'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{termFormError}</div>
          </div>
        )}

        <div style={{
          padding: '12px',
          backgroundColor: 'var(--surface-color, #f8fafc)',
          borderRadius: '6px',
          border: '1px solid var(--border-color, #e2e8f0)',
          marginBottom: '16px',
          fontSize: '0.82rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Sisa Tagihan Pokok:</span>
            <strong>Rp {Number(jamaah.sisa_tagihan || 0).toLocaleString('id-ID')}</strong>
          </div>
          {Number(jamaah.pending_verifikasi || 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#d97706' }}>
              <span>Menunggu Verifikasi:</span>
              <span>- Rp {Number(jamaah.pending_verifikasi || 0).toLocaleString('id-ID')}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color, #cbd5e1)', paddingTop: '4px', marginTop: '4px' }}>
            <span style={{ fontWeight: 600 }}>Maks. Alokasi Termin Baru:</span>
            <strong style={{ color: maxSchedulableAmount > 0 ? 'var(--primary-color, #0284c7)' : 'var(--danger-color)' }}>
              Rp {maxSchedulableAmount.toLocaleString('id-ID')}
            </strong>
          </div>
        </div>

        <form onSubmit={handleSubmitTerm}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '14px', marginBottom: '14px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="termNumber">
                No. Termin <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="termNumber"
                type="number"
                min="1"
                step="1"
                required
                className="form-input"
                value={termFormData.term_number}
                onChange={(e) => setTermFormData({ ...termFormData, term_number: e.target.value })}
                disabled={submittingTerm}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="termTitle">
                Judul / Keterangan Termin <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="termTitle"
                type="text"
                required
                className="form-input"
                placeholder="Contoh: Cicilan Tahap 2, Pelunasan"
                value={termFormData.title}
                onChange={(e) => setTermFormData({ ...termFormData, title: e.target.value })}
                disabled={submittingTerm}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="termAmount">
                Nominal Target (Rp) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="termAmount"
                type="number"
                min="1"
                required
                className="form-input"
                placeholder="Contoh: 10000000"
                value={termFormData.amount}
                onChange={(e) => setTermFormData({ ...termFormData, amount: e.target.value })}
                disabled={submittingTerm}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="termDueDate">
                Tanggal Jatuh Tempo <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="termDueDate"
                type="date"
                required
                className="form-input"
                value={termFormData.due_date}
                onChange={(e) => setTermFormData({ ...termFormData, due_date: e.target.value })}
                disabled={submittingTerm}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="termNotes">
              Catatan Khusus (Opsional)
            </label>
            <textarea
              id="termNotes"
              rows="2"
              className="form-input"
              placeholder="Catatan tambahan termin cicilan..."
              value={termFormData.notes}
              onChange={(e) => setTermFormData({ ...termFormData, notes: e.target.value })}
              disabled={submittingTerm}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
