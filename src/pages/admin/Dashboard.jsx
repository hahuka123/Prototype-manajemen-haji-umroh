import React from 'react';
import StatCard from '../../components/StatCard';
import { Users, FileCheck, CheckCircle, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Dashboard Administrator</h1>
          <p>Pusat pemantauan administrasi jamaah, status dokumen, verifikasi pembayaran, dan keberangkatan.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/admin/pembayaran/verifikasi" className="btn btn-accent btn-sm">
            <Clock size={16} />
            <span>Verifikasi Transfer (5)</span>
          </Link>
          <Link to="/admin/pembayaran/catat-cash" className="btn btn-primary btn-sm">
            <span>+ Catat Bayar Cash</span>
          </Link>
        </div>
      </div>

      {/* Grid Statistik Utama */}
      <div className="grid-cols-4">
        <StatCard
          title="Total Jamaah"
          value="125"
          subtext="118 Jamaah Aktif"
          icon={<Users size={24} />}
          variant="primary"
        />
        <StatCard
          title="Kelengkapan Dokumen"
          value="87%"
          subtext="109 dari 125 berkas lengkap"
          icon={<FileCheck size={24} />}
          variant="accent"
        />
        <StatCard
          title="Status Lunas"
          value="72"
          subtext="45 Jamaah Cicilan • 8 Belum Bayar"
          icon={<CheckCircle size={24} />}
          variant="success"
        />
        <StatCard
          title="Menunggu Verifikasi"
          value="5"
          subtext="Bukti transfer menunggu review"
          icon={<AlertTriangle size={24} />}
          variant="warning"
        />
      </div>

      {/* Keberangkatan Terdekat & Quick Action Banner */}
      <div className="card" style={{ marginBottom: '28px', background: 'linear-gradient(135deg, #064e3b, #022c22)', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Jadwal Keberangkatan Terdekat
            </div>
            <h2 style={{ color: '#fff', margin: '6px 0 4px', fontSize: '1.4rem' }}>
              Umrah Reguler Awal Tahun 2027
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} /> 10 Januari 2027 • 45 Jamaah Terdaftar • Pesawat Saudia Airlines
            </p>
          </div>
          <Link to="/admin/jadwal" className="btn btn-accent" style={{ color: '#fff' }}>
            Lihat Detail Jadwal
          </Link>
        </div>
      </div>

      {/* Tabel Ringkasan Cepat */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem' }}>Antrean Verifikasi Pembayaran Transfer Terbaru</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Verifikasi transfer bank yang diunggah oleh jamaah.
            </p>
          </div>
          <Link to="/admin/pembayaran/verifikasi" className="btn btn-secondary btn-sm">
            Lihat Semua Antrean
          </Link>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Jamaah</th>
                <th>Paket</th>
                <th>Nominal</th>
                <th>Metode</th>
                <th>Bank</th>
                <th>No. Referensi</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Ahmad Fauzan</td>
                <td>Umrah Reguler 2027</td>
                <td style={{ fontWeight: 700 }}>Rp 10.000.000</td>
                <td>Transfer</td>
                <td>Bank Syariah Indonesia (BSI)</td>
                <td><code>TRX-9823145</code></td>
                <td>
                  <span className="status-badge pending">Menunggu Verifikasi</span>
                </td>
                <td>
                  <Link to="/admin/pembayaran/verifikasi" className="btn btn-primary btn-sm">
                    Periksa
                  </Link>
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Siti Aminah</td>
                <td>Umrah Reguler 2027</td>
                <td style={{ fontWeight: 700 }}>Rp 25.000.000</td>
                <td>Transfer (Bayar Penuh)</td>
                <td>Bank Mandiri</td>
                <td><code>TRX-7762190</code></td>
                <td>
                  <span className="status-badge pending">Menunggu Verifikasi</span>
                </td>
                <td>
                  <Link to="/admin/pembayaran/verifikasi" className="btn btn-primary btn-sm">
                    Periksa
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
