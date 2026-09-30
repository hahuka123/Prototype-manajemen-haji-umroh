import React, { useState, useEffect } from 'react';
import PaymentStatusBadge from '../../components/PaymentStatusBadge';
import Modal from '../../components/Modal';
import { Check, X, Eye, AlertCircle } from 'lucide-react';
import { paymentService } from '../../services/paymentService';
import { jamaahService } from '../../services/jamaahService';
import { packageService } from '../../services/packageService';

export default function AdminVerifikasiPembayaran() {
  const [selectedTrx, setSelectedTrx] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  const [pendingList, setPendingList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      fetchData();
  }, []);

  const fetchData = async () => {
      try {
          setLoading(true);
          const payments = await paymentService.getPendingTransfers();
          
          // Hydrate with Jamaah and Package info
          const enriched = [];
          for (const p of payments) {
              const j = await jamaahService.getJamaahById(p.jamaah_id);
              let packageName = '-';
              if (j.paket_id) {
                  const pkgs = await packageService.getPackages();
                  const pkg = pkgs.find(x => x.id === j.paket_id);
                  if (pkg) packageName = pkg.nama;
              }
              enriched.push({
                  ...p,
                  jamaah_name: j.nama_lengkap,
                  package_name: packageName
              });
          }
          setPendingList(enriched);
      } catch (err) {
          console.error(err);
      } finally {
          setLoading(false);
      }
  };

  async function handleVerify(trx) {
    if (confirm(`Verifikasi pembayaran dari ${trx.jamaah_name} sebesar Rp ${trx.nominal.toLocaleString('id-ID')}?`)) {
      try {
          await paymentService.verifyTransfer(trx.id, trx.jamaah_id, 'verified', '');
          alert('Pembayaran berhasil diverifikasi! Dana telah sah masuk ke total terbayar.');
          fetchData();
      } catch (err) {
          alert(err.message);
      }
    }
  }

  async function handleRejectSubmit() {
    if (!rejectionReason.trim()) {
      alert('Wajib mengisi alasan penolakan.');
      return;
    }
    
    try {
        await paymentService.verifyTransfer(selectedTrx.id, selectedTrx.jamaah_id, 'rejected', rejectionReason);
        alert(`Pembayaran ditolak dengan alasan: "${rejectionReason}". Jamaah akan menerima notifikasi status ditolak.`);
        setRejectModalOpen(false);
        setRejectionReason('');
        setSelectedTrx(null);
        fetchData();
    } catch (err) {
        alert(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Verifikasi Pembayaran Transfer Bank</h1>
          <p>Tinjau bukti struk transfer yang diajukan oleh jamaah sebelum diakui sebagai pembayaran sah.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Jamaah</th>
                <th>Paket</th>
                <th>Jenis</th>
                <th>Nominal</th>
                <th>Bank & No. Ref</th>
                <th>Tanggal</th>
                <th>Bukti Transfer</th>
                <th>Aksi Verifikasi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center' }}>Loading...</td></tr>
              ) : pendingList.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center' }}>Tidak ada transaksi yang menunggu verifikasi.</td></tr>
              ) : (
                  pendingList.map((trx) => (
                    <tr key={trx.id}>
                      <td style={{ fontWeight: 600 }}>{trx.jamaah_name}</td>
                      <td>{trx.package_name}</td>
                      <td style={{ textTransform: 'capitalize' }}>{trx.jenis}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary-800)' }}>
                        Rp {trx.nominal.toLocaleString('id-ID')}
                      </td>
                      <td>
                        <div>{trx.bank_asal}</div>
                        <code style={{ fontSize: '0.75rem' }}>{trx.no_referensi}</code>
                      </td>
                      <td>{new Date(trx.tanggal).toLocaleDateString('id-ID')}</td>
                      <td>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedTrx(trx)}
                        >
                          <Eye size={14} /> Lihat Struk
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => handleVerify(trx)}
                          >
                            <Check size={14} /> Verifikasi
                          </button>
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              setSelectedTrx(trx);
                              setRejectModalOpen(true);
                            }}
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

      {/* Modal Preview Bukti Transfer */}
      <Modal
        isOpen={Boolean(selectedTrx && !rejectModalOpen)}
        onClose={() => setSelectedTrx(null)}
        title="Pratinjau Bukti Struk Transfer"
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setSelectedTrx(null)}>Tutup</button>
            <button 
              className="btn btn-danger" 
              onClick={() => setRejectModalOpen(true)}
            >
              Tolak Pembayaran
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                const cur = selectedTrx;
                setSelectedTrx(null);
                handleVerify(cur);
              }}
            >
              Verifikasi Sekarang
            </button>
          </>
        )}
      >
        {selectedTrx && (
          <div>
            <div style={{ marginBottom: '14px', fontSize: '0.88rem' }}>
              <div><strong>Jamaah:</strong> {selectedTrx.jamaah_name}</div>
              <div><strong>Nominal:</strong> Rp {selectedTrx.nominal.toLocaleString('id-ID')}</div>
              <div><strong>Bank Tujuan:</strong> {selectedTrx.bank_asal}</div>
              <div><strong>No. Referensi:</strong> {selectedTrx.no_referensi}</div>
            </div>
            <div style={{ textAlign: 'center', background: '#000', borderRadius: 'var(--radius-md)', padding: '10px' }}>
              <img 
                src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80" 
                alt="Bukti Transfer" 
                style={{ maxWidth: '100%', maxHeight: '350px', borderRadius: '4px', objectFit: 'contain' }} 
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Input Alasan Penolakan */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Tolak Pembayaran Transfer"
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setRejectModalOpen(false)}>Batal</button>
            <button className="btn btn-danger" onClick={handleRejectSubmit}>Konfirmasi Penolakan</button>
          </>
        )}
      >
        <div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Harap berikan alasan penolakan yang jelas agar jamaah dapat memperbaiki atau mengajukan transfer ulang.
          </p>
          <div className="form-group">
            <label className="form-label">Alasan Penolakan (Wajib)</label>
            <textarea
              className="form-textarea"
              rows={4}
              placeholder="Contoh: Bukti transfer buram / nominal yang masuk ke rekening biro tidak sesuai / rekening tujuan salah."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
