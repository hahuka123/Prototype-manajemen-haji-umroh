import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import StatCard from '../../components/StatCard';
import { CreditCard, FileCheck2, Calendar, AlertCircle, ArrowUpRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { jamaahService } from '../../services/jamaahService';
import { packageService, formatIndoDate, resolveReturnDateText } from '../../services/packageService';
import { scheduleService } from '../../services/scheduleService';
import { documentService } from '../../services/documentService';
import { paymentService } from '../../services/paymentService';
import DocumentStatusBadge from '../../components/DocumentStatusBadge';

export default function JamaahDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
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

        // Jika akun demo, biarkan lewat
        const isDemo = profile.id === 'demo-jamaah-id-456' || (typeof profile.id === 'string' && profile.id.startsWith('demo-'));

        // Jika belum ada record jamaah ATAU belum memilih paket ATAU belum mengisi NIK
        if (!isDemo && (!jData || !jData.paket_id || !jData.nik)) {
          navigate('/jamaah/lengkapi-data', { replace: true });
          return;
        }

        setJamaah(jData);

        const jamaahId = jData?.id;

        if (jData.paket_id) {
          let pkg = null;
          try {
            pkg = await packageService.getById(jData.paket_id);
          } catch (pkgErr) {
            console.warn('[JamaahDashboard] Gagal getById, fallback ke getPackages:', pkgErr);
            const pkgs = await packageService.getPackages();
            pkg = pkgs.find(p => p.id === jData.paket_id) || null;
          }
          setPaket(pkg);

          const schedules = await scheduleService.getSchedules();
          setJadwal(
            schedules.find(s => s.paket_id === jData.paket_id || s.package_id === jData.paket_id)
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

  const handleGoToOnboarding = () => {
    navigate('/jamaah/lengkapi-data');
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!jamaah) return (
    <div className="card" style={{ margin: '24px', padding: '32px', textAlign: 'center' }}>
      <AlertCircle size={44} style={{ color: '#f59e0b', margin: '0 auto 16px' }} />
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Data Jamaah Belum Terdaftar</h3>
      <p style={{ color: 'var(--text-muted)', marginTop: '8px', maxWidth: '600px', margin: '8px auto' }}>
        Akun Anda (ID: <code>{profile?.id}</code>) belum memiliki data administratif jamaah dan paket perjalanan ibadah.
      </p>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
        <button 
          className="btn btn-primary"
          onClick={handleGoToOnboarding}
          style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', padding: '10px 20px' }}
        >
          <span>+ Lengkapi Data Jamaah & Pilih Paket</span>
        </button>
      </div>

      <div style={{ marginTop: '24px', fontSize: '0.85rem', color: 'var(--text-muted)', background: '#f8fafc', padding: '16px', borderRadius: '8px', display: 'inline-block', textAlign: 'left', lineHeight: 1.6, border: '1px solid var(--border-color)' }}>
        <strong>Catatan Sistem:</strong><br />
        1. Klik tombol di atas untuk mengisi NIK (16 digit), data pribadi, dan paket umroh/haji.<br />
        2. Data akan langsung terhubung ke profil akun Anda di Supabase secara aman.<br />
        3. Jika memerlukan bantuan, hubungi bagian administrasi biro perjalanan.
      </div>
    </div>
  );

  const getDocName = (type) => {
    const map = {
      ktp: 'KTP',
      kk: 'Kartu Keluarga',
      paspor: 'Paspor Asli',
      passport: 'Paspor Asli',
      buku_kuning: 'Buku Kuning / Vaksin',
      foto: 'Pas Foto',
      'buku-nikah': 'Buku Nikah',
      surat_kesehatan: 'Surat Kesehatan',
      kesehatan: 'Surat Kesehatan'
    };
    return map[type] || type || '-';
  };

  const hargaPaket = jamaah.total_terbayar + jamaah.sisa_tagihan;

  // Resolusi tanggal keberangkatan dan kepulangan secara akurat
  const departureDateText = (() => {
    const rawDep = paket?.departure_date || paket?.tanggal_keberangkatan || jadwal?.tanggal_keberangkatan || jadwal?.date;
    if (!rawDep) return 'Belum ditentukan';
    return formatIndoDate(rawDep) || 'Belum ditentukan';
  })();

  const returnDateText = (() => {
    if (!paket) return 'Belum ditentukan';
    return resolveReturnDateText(paket);
  })();

  // Resolusi kuota paket perjalanan
  const quotaTotal = paket?.quota ?? paket?.kuota;
  const hasQuota = quotaTotal !== null && quotaTotal !== undefined;
  const registeredCount = Number(paket?.terisi || 0);
  const remainingQuota = hasQuota ? Math.max(0, quotaTotal - registeredCount) : null;
  const isPenuh = hasQuota ? (registeredCount >= quotaTotal || Boolean(paket?.is_penuh)) : false;

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
              Pembayaran {p.status === 'rejected' ? 'Ditolak' : 'Menunggu Verifikasi'}: Rp {Number(p.nominal || p.amount || 0).toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
              {p.status === 'rejected'
                ? `Pembayaran Anda ditolak admin. Alasan: ${p.catatan_admin || '-'}. Silakan upload ulang.`
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
          value={`${documents.length > 0 ? documentService.calculateProgress(documents).persentase : Math.round(Number(jamaah.dokumen_persentase || 0))}%`}
          subtext={`${documents.length > 0 ? documentService.calculateProgress(documents).lengkap : Number(jamaah.dokumen_lengkap || 0)} dari 6 dokumen lengkap`}
          icon={<FileCheck2 size={24} />}
          variant="accent"
        />
      </div>

      {/* Info Paket & Keberangkatan */}
      <div className="grid-cols-2">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Paket Perjalanan Anda</h3>
            {paket && isPenuh && (
              <span style={{
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '9999px',
                border: '1px solid #fecaca'
              }}>
                Kuota Penuh
              </span>
            )}
            {paket && !hasQuota && (
              <span style={{
                backgroundColor: '#fef3c7',
                color: '#92400e',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '9999px',
                border: '1px solid #fde68a'
              }}>
                Kuota Belum Diatur
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nama Paket:</span>
              <span style={{ fontWeight: 600 }}>{paket ? (paket.nama || paket.name) : '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Durasi:</span>
              <span style={{ fontWeight: 600 }}>{paket ? `${paket.durasi_hari || paket.duration || '-'} Hari` : '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Tanggal Keberangkatan:</span>
              <span style={{ fontWeight: 600, color: 'var(--primary-700)' }}>
                {departureDateText}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Tanggal Kepulangan:</span>
              <span style={{ fontWeight: 600 }}>
                {returnDateText}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Kuota Total:</span>
              <span style={{ fontWeight: 600 }}>
                {hasQuota ? (
                  `${quotaTotal} jamaah`
                ) : (
                  <span style={{ color: '#d97706', fontWeight: 600 }}>Kuota belum ditentukan</span>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Jamaah Terdaftar:</span>
              <span style={{ fontWeight: 600 }}>
                {paket ? `${registeredCount} jamaah` : '-'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Sisa Kuota:</span>
              <span style={{ fontWeight: 600 }}>
                {!hasQuota ? (
                  <span style={{ color: 'var(--text-muted)' }}>Belum ditentukan</span>
                ) : isPenuh ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#dc2626' }}>0 jamaah</strong>
                    <span style={{
                      backgroundColor: '#fee2e2',
                      color: '#991b1b',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      border: '1px solid #fecaca'
                    }}>
                      Kuota penuh
                    </span>
                  </span>
                ) : (
                  <span style={{ color: 'var(--primary-700)', fontWeight: 700 }}>
                    {remainingQuota} jamaah
                  </span>
                )}
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
                <span style={{ fontSize: '0.88rem' }}>{getDocName(doc.tipe || doc.jenis_dokumen)}</span>
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
