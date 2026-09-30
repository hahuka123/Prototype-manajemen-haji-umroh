import React from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../../components/StatCard';
import PaymentStatusBadge from '../../components/PaymentStatusBadge';
import { CreditCard, Send, CheckCircle, Clock } from 'lucide-react';

export default function JamaahPembayaran() {
  const hargaPaket = 35000000;
  const totalVerified = 20000000;
  const sisaTagihan = hargaPaket - totalVerified;
  const statusPelunasan = 'Cicilan';

  const history = [
    {
      id: 'p-1',
      date: '30/09/2026',
      type: 'Cicilan',
      method: 'Transfer (BSI)',
      amount: 7000000,
      status: 'pending',
      notes: 'Sedang diverifikasi'
    },
    {
      id: 'p-2',
      date: '20/09/2026',
      type: 'Cicilan',
      method: 'Transfer (BCA)',
      amount: 5000000,
      status: 'rejected',
      notes: 'Bukti transfer buram/tidak terbaca'
    },
    {
      id: 'p-3',
      date: '10/09/2026',
      type: 'Cicilan',
      method: 'Cash',
      amount: 3000000,
      status: 'verified',
      notes: 'Diterima di kantor'
    },
    {
      id: 'p-4',
      date: '01/09/2026',
      type: 'Cicilan',
      method: 'Transfer (BSI)',
      amount: 5000000,
      status: 'verified',
      notes: 'DP Awal Pendaftaran'
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Rincian Pembayaran & Tagihan</h1>
          <p>Transparansi informasi pelunasan paket haji/umroh Anda secara real-time.</p>
        </div>
        <div>
          <Link to="/jamaah/pembayaran/ajukan" className="btn btn-accent">
            <Send size={18} />
            <span>+ Ajukan Pembayaran Transfer</span>
          </Link>
        </div>
      </div>

      {/* Grid Status Keuangan */}
      <div className="grid-cols-4">
        <StatCard
          title="Harga Paket"
          value={`Rp ${hargaPaket.toLocaleString('id-ID')}`}
          subtext="Umrah Reguler 2027"
          icon={<CreditCard size={24} />}
          variant="primary"
        />
        <StatCard
          title="Total Sah Terverifikasi"
          value={`Rp ${totalVerified.toLocaleString('id-ID')}`}
          subtext="Dana yang sudah diakui"
          icon={<CheckCircle size={24} />}
          variant="success"
        />
        <StatCard
          title="Sisa Tagihan"
          value={`Rp ${sisaTagihan.toLocaleString('id-ID')}`}
          subtext={`Status: ${statusPelunasan}`}
          icon={<CreditCard size={24} />}
          variant="warning"
        />
        <StatCard
          title="Status Pelunasan"
          value={statusPelunasan}
          subtext="Sisa belum lunas"
          icon={<Clock size={24} />}
          variant="accent"
        />
      </div>

      {/* Riwayat Pembayaran */}
      <div className="card">
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.1rem' }}>Riwayat Seluruh Transaksi Pembayaran</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Catatan: Hanya transaksi berstatus <strong>Terverifikasi</strong> yang mengurangi sisa tagihan.
          </p>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Jenis Pembayaran</th>
                <th>Metode</th>
                <th>Nominal</th>
                <th>Status Verifikasi</th>
                <th>Keterangan / Catatan</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.type}</td>
                  <td>{row.method}</td>
                  <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    Rp {row.amount.toLocaleString('id-ID')}
                  </td>
                  <td>
                    <PaymentStatusBadge status={row.status} />
                  </td>
                  <td style={{ fontSize: '0.82rem', color: row.status === 'rejected' ? '#b91c1c' : 'var(--text-muted)' }}>
                    {row.notes}
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
