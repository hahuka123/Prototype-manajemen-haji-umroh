import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import StatCard from '../../components/StatCard';
import { CreditCard, FileCheck2, Calendar, AlertCircle, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function JamaahDashboard() {
  const { profile } = useAuth();
  const namaJamaah = profile?.full_name || 'Ahmad Fauzan';

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Ahlan wa Sahlan, {namaJamaah}! 👋</h1>
          <p>Selamat datang di portal jamaah. Pantau status paket perjalanan, kelengkapan berkas, dan riwayat pembayaran Anda.</p>
        </div>
        <div>
          <Link to="/jamaah/pembayaran/ajukan" className="btn btn-accent">
            <ArrowUpRight size={18} />
            <span>Ajukan Pembayaran Transfer</span>
          </Link>
        </div>
      </div>

      {/* Alert Jika Ada Pembayaran Menunggu Verifikasi */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 18px',
        background: '#fffbeb',
        border: '1px solid #fcd34d',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '24px',
        color: '#92400e'
      }}>
        <AlertCircle size={22} style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            Pembayaran Menunggu Verifikasi: Rp 5.000.000
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
            Bukti transfer Anda telah dikirim dan sedang dalam antrean verifikasi oleh petugas biro. Nominal ini belum mengurangi sisa tagihan sampai diverifikasi sah.
          </div>
        </div>
      </div>

      {/* Ringkasan Tagihan & Status */}
      <div className="grid-cols-4">
        <StatCard
          title="Harga Paket"
          value="Rp 35.000.000"
          subtext="Umrah Reguler 2027"
          icon={<CreditCard size={24} />}
          variant="primary"
        />
        <StatCard
          title="Total Terverifikasi"
          value="Rp 20.000.000"
          subtext="Dana sah masuk"
          icon={<CreditCard size={24} />}
          variant="success"
        />
        <StatCard
          title="Sisa Tagihan"
          value="Rp 15.000.000"
          subtext="Status: Cicilan"
          icon={<CreditCard size={24} />}
          variant="warning"
        />
        <StatCard
          title="Kelengkapan Berkas"
          value="83%"
          subtext="5 dari 6 dokumen lengkap"
          icon={<FileCheck2 size={24} />}
          variant="accent"
        />
      </div>

      {/* Info Paket & Keberangkatan */}
      <div className="grid-cols-2">
        <div className="card">
          <h3 style={{ marginBottom: '14px', fontSize: '1.1rem' }}>Paket Perjalanan Anda</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nama Paket:</span>
              <span style={{ fontWeight: 600 }}>Umrah Reguler 2027</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Durasi:</span>
              <span style={{ fontWeight: 600 }}>12 Hari</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Tanggal Keberangkatan:</span>
              <span style={{ fontWeight: 600, color: 'var(--primary-700)' }}>10 Januari 2027</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Tanggal Kepulangan:</span>
              <span style={{ fontWeight: 600 }}>21 Januari 2027</span>
            </div>
          </div>
          <div style={{ marginTop: '18px' }}>
            <Link to="/jamaah/jadwal" className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
              <Calendar size={16} />
              <span>Lihat Jadwal & Agenda Perjalanan</span>
            </Link>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '14px', fontSize: '1.1rem' }}>Status Berkas Persyaratan</h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Pastikan seluruh dokumen berstatus <strong>Lengkap</strong> sebelum tanggal keberangkatan.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.88rem' }}>KTP & Kartu Keluarga</span>
              <span className="status-badge lengkap">Lengkap</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.88rem' }}>Paspor Asli (Masa aktif &gt; 7 bulan)</span>
              <span className="status-badge lengkap">Lengkap</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.88rem' }}>Buku Kuning / Vaksin Meningitis</span>
              <span className="status-badge pending">Menunggu Verifikasi</span>
            </div>
          </div>
          <div style={{ marginTop: '18px' }}>
            <Link to="/jamaah/dokumen" className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
              <FileCheck2 size={16} />
              <span>Kelola Seluruh Dokumen</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
