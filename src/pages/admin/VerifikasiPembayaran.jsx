import React, { useState } from 'react';
import PaymentStatusBadge from '../../components/PaymentStatusBadge';
import Modal from '../../components/Modal';
import { Check, X, Eye, AlertCircle } from 'lucide-react';

export default function AdminVerifikasiPembayaran() {
  const [selectedTrx, setSelectedTrx] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const pendingList = [
    {
      id: 'pay-001',
      jamaah_name: 'Ahmad Fauzan',
      package_name: 'Umrah Reguler 2027',
      payment_type: 'Cicilan',
      amount: 7000000,
      bank_name: 'Bank Syariah Indonesia (BSI)',
      reference_number: 'TRX-99881122',
      payment_date: '30/09/2026',
      notes: 'Cicilan ke-3 pelunasan umrah',
      proof_file: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80'
    }
  ];

  function handleVerify(trx) {
    if (confirm(`Verifikasi pembayaran dari ${trx.jamaah_name} sebesar Rp ${trx.amount.toLocaleString('id-ID')}?`)) {
      alert('Pembayaran berhasil diverifikasi! Dana telah sah masuk ke total terbayar.');
    }
  }

  function handleRejectSubmit() {
    if (!rejectionReason.trim()) {
      alert('Wajib mengisi alasan penolakan.');
      return;
    }
    alert(`Pembayaran ditolak dengan alasan: "${rejectionReason}". Jamaah akan menerima notifikasi status ditolak.`);
    setRejectModalOpen(false);
    setRejectionReason('');
    setSelectedTrx(null);
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
                <th>Bukti Transfer</th>
                <th>Aksi Verifikasi</th>
              </tr>
            </thead>
            <tbody>
              {pendingList.map((trx) => (
                <tr key={trx.id}>
                  <td style={{ fontWeight: 600 }}>{trx.jamaah_name}</td>
                  <td>{trx.package_name}</td>
                  <td>{trx.payment_type}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary-800)' }}>
                    Rp {trx.amount.toLocaleString('id-ID')}
                  </td>
                  <td>
                    <div>{trx.bank_name}</div>
                    <code style={{ fontSize: '0.75rem' }}>{trx.reference_number}</code>
                  </td>
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
              ))}
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
              <div><strong>Nominal:</strong> Rp {selectedTrx.amount.toLocaleString('id-ID')}</div>
              <div><strong>Bank Tujuan:</strong> {selectedTrx.bank_name}</div>
              <div><strong>No. Referensi:</strong> {selectedTrx.reference_number}</div>
            </div>
            <div style={{ textAlign: 'center', background: '#000', borderRadius: 'var(--radius-md)', padding: '10px' }}>
              <img 
                src={selectedTrx.proof_file} 
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
