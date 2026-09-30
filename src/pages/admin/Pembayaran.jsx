import React, { useState, useEffect } from 'react';
import PaymentStatusBadge from '../../components/PaymentStatusBadge';
import { Plus, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { paymentService } from '../../services/paymentService';
import { jamaahService } from '../../services/jamaahService';

export default function AdminPembayaran() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      fetchData();
  }, []);

  const fetchData = async () => {
      try {
          setLoading(true);
          const allPayments = await paymentService.getAllPayments();
          
          const enriched = [];
          for (const p of allPayments) {
              const j = await jamaahService.getJamaahById(p.jamaah_id);
              enriched.push({
                  ...p,
                  jamaah_name: j.nama_lengkap
              });
          }
          setPayments(enriched);
      } catch (err) {
          console.error(err);
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
                  <tr><td colSpan="7" style={{ textAlign: 'center' }}>Loading...</td></tr>
              ) : payments.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center' }}>Belum ada data transaksi.</td></tr>
              ) : (
                  payments.map(trx => (
                    <tr key={trx.id}>
                      <td>{new Date(trx.tanggal).toLocaleDateString('id-ID')}</td>
                      <td style={{ fontWeight: 600 }}>{trx.jamaah_name}</td>
                      <td style={{ textTransform: 'capitalize' }}>{trx.jenis}</td>
                      <td style={{ textTransform: 'capitalize' }}>
                          {trx.metode} {trx.bank_asal ? `(${trx.bank_asal})` : ''}
                      </td>
                      <td style={{ fontWeight: 700 }}>Rp {trx.nominal.toLocaleString('id-ID')}</td>
                      <td><PaymentStatusBadge status={trx.status} /></td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {trx.catatan_admin || (trx.status === 'pending' ? '-' : 'Sistem/Admin')}
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
