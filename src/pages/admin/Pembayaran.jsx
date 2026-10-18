import React, { useState, useEffect } from 'react';
import PaymentStatusBadge from '../../components/PaymentStatusBadge';
import { Plus, Download, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { paymentService } from '../../services/paymentService';

export default function AdminPembayaran() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const allPayments = await paymentService.getAllPayments();
      setPayments(allPayments || []);
    } catch (err) {
      console.error(err);
      setLoadError(err.message || 'Gagal memuat riwayat transaksi pembayaran.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Riwayat Transaksi Keuangan</h1>
          <p>Catatan seluruh pembayaran paket haji dan umroh baik melalui transfer bank maupun tunai (cash).</p>
        </div>
        <div>
          <Link to="/admin/pembayaran/catat-cash" className="btn btn-primary">
            <Plus size={18} />
            <span>Catat Pembayaran Cash</span>
          </Link>
        </div>
      </div>

      {loadError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#b91c1c',
          fontSize: '0.9rem',
          marginBottom: '20px'
        }}>
          <AlertCircle size={18} />
          <span>{loadError}</span>
        </div>
      )}

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Nama Jamaah</th>
                <th>Jenis</th>
                <th>Metode</th>
                <th>Nominal</th>
                <th>Status</th>
                <th>Catatan / Pemeriksa</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>Memuat riwayat transaksi...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Belum ada data transaksi.</td></tr>
              ) : (
                payments.map(trx => (
                  <tr key={trx.id}>
                    <td>{new Date(trx.payment_date || trx.tanggal).toLocaleDateString('id-ID')}</td>
                    <td style={{ fontWeight: 600 }}>{trx.jamaah_name || '-'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{trx.payment_type || trx.jenis}</td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {trx.payment_method || trx.metode} {(trx.bank_name || trx.bank_asal) ? `(${trx.bank_name || trx.bank_asal})` : ''}
                    </td>
                    <td style={{ fontWeight: 700 }}>Rp {Number(trx.amount || trx.nominal || 0).toLocaleString('id-ID')}</td>
                    <td><PaymentStatusBadge status={trx.status} /></td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {trx.admin_notes || trx.catatan_admin || (trx.status === 'pending' ? '-' : 'Sistem/Admin')}
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
