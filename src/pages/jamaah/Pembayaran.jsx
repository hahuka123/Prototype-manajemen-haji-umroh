import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../../components/StatCard';
import PaymentStatusBadge from '../../components/PaymentStatusBadge';
import { CreditCard, Send, CheckCircle, Clock } from 'lucide-react';
import { paymentService } from '../../services/paymentService';
import { jamaahService } from '../../services/jamaahService';
import { packageService } from '../../services/packageService';
import { useAuth } from '../../hooks/useAuth';

export default function JamaahPembayaran() {
  const { profile } = useAuth();
  const [jamaah, setJamaah] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paket, setPaket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (!profile?.id) {
          throw new Error('Profil pengguna belum tersedia.');
        }

        const jData = await jamaahService.getMyJamaah(profile.id);
        setJamaah(jData);

        const jamaahId = jData.id;

        if (jData.paket_id) {
          const pkgs = await packageService.getPackages();
          setPaket(pkgs.find(p => p.id === jData.paket_id));
        }

        const pData = await paymentService.getPaymentsByJamaah(jamaahId);
        pData.sort(
          (a, b) => new Date(b.tanggal) - new Date(a.tanggal)
        );
        setPayments(pData);
      } catch (err) {
        console.error('Gagal mengambil data pembayaran:', err);
      } finally {
        setLoading(false);
      }
    };

    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!jamaah) return <div className="p-8 text-center">Data Jamaah tidak ditemukan.</div>;

  const hargaPaket = jamaah.sisa_tagihan + jamaah.total_terbayar;
  const totalVerified = jamaah.total_terbayar;
  const sisaTagihan = jamaah.sisa_tagihan;
  const statusPelunasan = jamaah.status_pembayaran;

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
          subtext={paket ? paket.nama : 'Belum pilih paket'}
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
          variant={sisaTagihan > 0 ? "warning" : "success"}
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
              {payments.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center' }}>Belum ada histori pembayaran.</td></tr>
              ) : (
                  payments.map((row) => (
                    <tr key={row.id}>
                      <td>{new Date(row.tanggal).toLocaleDateString('id-ID')}</td>
                      <td style={{ textTransform: 'capitalize' }}>{row.jenis}</td>
                      <td style={{ textTransform: 'capitalize' }}>
                          {row.metode} {row.bank_asal ? `(${row.bank_asal})` : ''}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        Rp {row.nominal.toLocaleString('id-ID')}
                      </td>
                      <td>
                        <PaymentStatusBadge status={row.status} />
                      </td>
                      <td style={{ fontSize: '0.82rem', color: row.status === 'rejected' ? '#b91c1c' : 'var(--text-muted)' }}>
                        {row.catatan_admin || (row.status === 'pending' ? 'Menunggu verifikasi admin' : 'Sistem')}
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
