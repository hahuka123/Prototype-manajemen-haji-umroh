import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import StatCard from '../../components/StatCard';
import { CreditCard, FileCheck2, Calendar, AlertCircle, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { jamaahService } from '../../services/jamaahService';
import { packageService } from '../../services/packageService';
import { scheduleService } from '../../services/scheduleService';
import { documentService } from '../../services/documentService';
import { paymentService } from '../../services/paymentService';

export default function JamaahDashboard() {
  const { profile } = useAuth();
  const namaJamaah = profile?.full_name || 'Jamaah';

  const [jamaah, setJamaah] = useState(null);
  const [paket, setPaket] = useState(null);
  const [jadwal, setJadwal] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (!profile?.id) {
          throw new Error('Profil pengguna belum tersedia.');
        }

        console.log('[DEBUG] profile.id login:', profile.id);

        // Ambil data jamaah berdasarkan profile user yang sedang login
        const jData = await jamaahService.getMyJamaah(profile.id);
        console.log('[DEBUG] hasil getMyJamaah:', jData);
        setJamaah(jData);

        const jamaahId = jData.id;

        if (jData.paket_id) {
          const pkgs = await packageService.getPackages();
          setPaket(pkgs.find(p => p.id === jData.paket_id));

          const schedules = await scheduleService.getSchedules();
          setJadwal(
            schedules.find(s => s.paket_id === jData.paket_id)
          );
        }

        const [docs, pays] = await Promise.all([
          documentService.getDocumentsByJamaah(jamaahId),
          paymentService.getPaymentsByJamaah(jamaahId)
        ]);

        setDocuments(docs);
        setPendingPayments(
          pays.filter(
            p => p.status === 'pending' || p.status === 'rejected'
          )
        );
      } catch (err) {
        console.error('Gagal mengambil data dashboard jamaah:', err);
      } finally {
        setLoading(false);
      }
    };

    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!jamaah) return (
    <div className="card" style={{ margin: '24px', padding: '32px', textAlign: 'center' }}>
      <AlertCircle size={44} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Data Jamaah Belum Terhubung</h3>
      <p style={{ color: 'var(--text-muted)', marginTop: '8px', maxWidth: '600px', margin: '8px auto' }}>
        Akun yang sedang login (ID: <code>{profile?.id}</code>) belum memiliki data jamaah yang terdaftar di database Supabase.
      </p>
      <div style={{ marginTop: '20px', fontSize: '0.875rem', color: 'var(--text-muted)', background: '#f8fafc', padding: '16px', borderRadius: '8px', display: 'inline-block', textAlign: 'left', lineHeight: 1.6, border: '1px solid var(--border-color)' }}>
        <strong>Checklist Supabase:</strong><br />
        1. Pastikan tidak login menggunakan <strong>Demo Mode</strong>.<br />
        2. Buka Supabase Table Editor &rarr; tabel <code>jamaah</code>.<br />
        3. Pastikan kolom <code>profile_id</code> diisi sesuai ID akun: <code>{profile?.id}</code>.<br />
        4. Buka Console Browser (F12) untuk melihat rincian log query.
      </div>
    </div>
  );

  const getDocName = (type) => {
    const map = {
      ktp: 'KTP',
      kk: 'Kartu Keluarga',
      paspor: 'Paspor Asli',
      buku_kuning: 'Buku Kuning / Vaksin',
      foto: 'Pas Foto',
      surat_kesehatan: 'Surat Kesehatan'
    };
    return map[type] || type;
  };

  const hargaPaket = jamaah.total_terbayar + jamaah.sisa_tagihan;

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

      {/* Alert Jika Ada Pembayaran Menunggu Verifikasi atau Ditolak */}
      {pendingPayments.map(p => (
        <div key={p.id} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 18px',
          background: p.status === 'rejected' ? '#fef2f2' : '#fffbeb',
          border: `1px solid ${p.status === 'rejected' ? '#fecaca' : '#fcd34d'}`,
          borderRadius: 'var(--radius-lg)',
          marginBottom: '16px',
          color: p.status === 'rejected' ? '#991b1b' : '#92400e'
        }}>
          <AlertCircle size={22} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              Pembayaran {p.status === 'rejected' ? 'Ditolak' : 'Menunggu Verifikasi'}: Rp {p.nominal.toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
              {p.status === 'rejected'
                ? `Pembayaran Anda ditolak admin. Alasan: ${p.catatan_admin}. Silakan upload ulang.`
                : 'Bukti transfer Anda telah dikirim dan sedang dalam antrean verifikasi oleh petugas biro.'
              }
            </div>
          </div>
        </div>
      ))}

      {/* Ringkasan Tagihan & Status */}
      <div className="grid-cols-4">
        <StatCard
          title="Harga Paket"
          value={`Rp ${hargaPaket.toLocaleString('id-ID')}`}
          subtext={paket ? paket.nama : 'Belum pilih paket'}
          icon={<CreditCard size={24} />}
          variant="primary"
        />
        <StatCard
          title="Total Terverifikasi"
          value={`Rp ${jamaah.total_terbayar.toLocaleString('id-ID')}`}
          subtext="Dana sah masuk"
          icon={<CreditCard size={24} />}
          variant="success"
        />
        <StatCard
          title="Sisa Tagihan"
          value={`Rp ${jamaah.sisa_tagihan.toLocaleString('id-ID')}`}
          subtext={`Status: ${jamaah.status_pembayaran}`}
          icon={<CreditCard size={24} />}
          variant={jamaah.sisa_tagihan > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Kelengkapan Berkas"
          value={`${Math.round(jamaah.dokumen_persentase)}%`}
          subtext={`${documents.filter(d => d.status === 'verified').length} dari 6 dokumen lengkap`}
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
              <span style={{ fontWeight: 600 }}>{paket ? paket.nama : '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Durasi:</span>
              <span style={{ fontWeight: 600 }}>{paket ? `${paket.durasi_hari} Hari` : '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Tanggal Keberangkatan:</span>
              <span style={{ fontWeight: 600, color: 'var(--primary-700)' }}>
                {jadwal ? new Date(jadwal.tanggal_keberangkatan).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Tanggal Kepulangan:</span>
              <span style={{ fontWeight: 600 }}>
                {jadwal ? new Date(jadwal.tanggal_kepulangan).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
              </span>
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
            {documents.slice(0, 3).map(doc => (
              <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.88rem' }}>{getDocName(doc.jenis_dokumen)}</span>
                <DocumentStatusBadge status={doc.status} />
              </div>
            ))}
            {documents.length === 0 && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Belum ada dokumen yang diunggah.</div>}
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
