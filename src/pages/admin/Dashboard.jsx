import React, { useState, useEffect } from 'react';
import StatCard from '../../components/StatCard';
import { Users, FileCheck, CheckCircle, Clock, Calendar, AlertTriangle, AlertCircle, TrendingUp, Info, BrainCircuit } from 'lucide-react';
import { Link } from 'react-router-dom';
import { jamaahService } from '../../services/jamaahService';
import { documentService } from '../../services/documentService';
import { paymentService } from '../../services/paymentService';
import { scheduleService } from '../../services/scheduleService';
import { packageService } from '../../services/packageService';
import { mlService } from '../../services/mlService';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState({
    totalJamaah: 0,
    jamaahAktif: 0,
    dokumenLengkap: 0,
    totalLunas: 0,
    totalCicilan: 0,
    totalBelumBayar: 0,
    pendingVerifikasi: 0
  });
  const [pendingPayments, setPendingPayments] = useState([]);
  const [terdekat, setTerdekat] = useState(null);
  const [paketMap, setPaketMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mlStatus, setMlStatus] = useState({
    isReady: false,
    message: 'Model prediksi belum tersedia. Sistem menunggu dataset pembayaran yang memadai.'
  });
  const [riskPredictions, setRiskPredictions] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setLoadError('');
        const [jamaahList, pendingDocs, pendingPays, schedules, pkgs, modelStat, predictions] = await Promise.all([
          jamaahService.getJamaah(),
          documentService.getPendingVerifications(),
          paymentService.getPendingTransfers(),
          scheduleService.getSchedules(),
          packageService.getPackages(),
          mlService.getModelStatus(),
          mlService.getRiskPredictions()
        ]);
        
        setMlStatus(modelStat);
        setRiskPredictions(predictions || []);

        const pMap = {};
        (pkgs || []).forEach(p => {
          pMap[p.id] = p.name || p.nama;
        });
        setPaketMap(pMap);

        let active = 0, lunas = 0, cicilan = 0, belum = 0, docFull = 0;
        (jamaahList || []).forEach(j => {
          if ((j.status_keberangkatan || j.status) !== 'Selesai') active++;
          if (j.status_pembayaran === 'Lunas') lunas++;
          else if (j.status_pembayaran === 'Cicilan') cicilan++;
          else belum++;
          if (Number(j.dokumen_persentase || 0) === 100) docFull++;
        });

        setMetrics({
          totalJamaah: (jamaahList || []).length,
          jamaahAktif: active,
          dokumenLengkap: docFull,
          totalLunas: lunas,
          totalCicilan: cicilan,
          totalBelumBayar: belum,
          pendingVerifikasi: (pendingPays || []).length
        });

        // Enrich pending payments (top 5)
        const enriched = (pendingPays || []).slice(0, 5).map(p => {
          const j = (jamaahList || []).find(x => x.id === p.jamaah_id);
          const pkgId = p.package_id || (j && (j.paket_id || j.package_id));
          return {
            ...p,
            jamaah_name: p.jamaah_name || (j ? j.nama_lengkap : '-'),
            package_name: p.package_name || (pkgId ? pMap[pkgId] : '-')
          };
        });
        setPendingPayments(enriched);

        // Find closest schedule
        const todayStr = new Date().toISOString().split('T')[0];
        const upcoming = (schedules || [])
          .filter(s => (s.date || s.tanggal || s.tanggal_keberangkatan) >= todayStr)
          .sort((a, b) => (a.date || a.tanggal || a.tanggal_keberangkatan).localeCompare(b.date || b.tanggal || b.tanggal_keberangkatan));
          
        if (upcoming.length > 0) {
          setTerdekat(upcoming[0]);
        } else if ((schedules || []).length > 0) {
          setTerdekat(schedules[0]);
        }

      } catch (err) {
        console.error(err);
        setLoadError(err.message || 'Gagal memuat metrik dashboard admin.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
            <span>Verifikasi Transfer ({metrics.pendingVerifikasi})</span>
          </Link>
          <Link to="/admin/pembayaran/catat-cash" className="btn btn-primary btn-sm">
            <span>+ Catat Bayar Cash</span>
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

      {/* Grid Statistik Utama */}
      <div className="grid-cols-4">
        <StatCard
          title="Total Jamaah"
          value={metrics.totalJamaah}
          subtext={`${metrics.jamaahAktif} Jamaah Aktif`}
          icon={<Users size={24} />}
          variant="primary"
        />
        <StatCard
          title="Kelengkapan Dokumen"
          value={`${metrics.totalJamaah > 0 ? Math.round((metrics.dokumenLengkap / metrics.totalJamaah)*100) : 0}%`}
          subtext={`${metrics.dokumenLengkap} dari ${metrics.totalJamaah} berkas lengkap`}
          icon={<FileCheck size={24} />}
          variant="accent"
        />
        <StatCard
          title="Status Lunas"
          value={metrics.totalLunas}
          subtext={`${metrics.totalCicilan} Jamaah Cicilan • ${metrics.totalBelumBayar} Belum Bayar`}
          icon={<CheckCircle size={24} />}
          variant="success"
        />
        <StatCard
          title="Menunggu Verifikasi"
          value={metrics.pendingVerifikasi}
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
              Jadwal Agenda Terdekat
            </div>
            <h2 style={{ color: '#fff', margin: '6px 0 4px', fontSize: '1.4rem' }}>
              {terdekat ? (paketMap[terdekat.package_id || terdekat.paket_id] || terdekat.activity || 'Paket Umum') : 'Belum Ada Jadwal'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} /> {terdekat ? new Date(terdekat.date || terdekat.tanggal || terdekat.tanggal_keberangkatan).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-'} 
              {terdekat?.activity ? ` • ${terdekat.activity}` : ''}
              {terdekat?.time ? ` (${terdekat.time.slice(0, 5)})` : ''}
            </p>
          </div>
          <Link to="/admin/jadwal" className="btn btn-accent" style={{ color: '#fff' }}>
            Lihat Detail Jadwal
          </Link>
        </div>
      </div>

      {/* Bagian Prediksi Risiko Keterlambatan Cicilan (Machine Learning) */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} className="text-primary" />
              Prediksi Risiko Keterlambatan Cicilan (ML Baseline)
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Alat bantu analisis Admin berbasis algoritma Logistic Regression untuk mendeteksi potensi termin terlambat bayar.
            </p>
          </div>
          {mlStatus.isReady && mlStatus.model && (
            <span className="status-badge verified" style={{ fontSize: '0.75rem' }}>
              Model: {mlStatus.model.version || 'v1.0.0'} (Aktif)
            </span>
          )}
        </div>

        {/* Disclaimer Operasional Wajib */}
        <div style={{
          padding: '10px 14px',
          backgroundColor: 'var(--surface-color, #f8fafc)',
          borderRadius: 'var(--radius-md, 8px)',
          border: '1px solid var(--border-color, #e2e8f0)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Info size={16} style={{ flexShrink: 0 }} />
          <span>
            <strong>Disclaimer:</strong> Prediksi ini hanya berfungsi sebagai alat bantu pengawasan internal Admin. Sistem <strong>tidak akan otomatis</strong> menolak pembayaran, mengubah status pembayaran, atau mengambil tindakan apa pun terhadap jamaah.
          </span>
        </div>

        {!mlStatus.isReady || riskPredictions.length === 0 ? (
          <div style={{
            padding: '28px 20px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: '8px',
            color: 'var(--text-muted)'
          }}>
            <BrainCircuit size={36} style={{ margin: '0 auto 10px', color: '#94a3b8' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              {mlStatus.message || 'Model prediksi belum tersedia. Sistem menunggu dataset pembayaran yang memadai.'}
            </div>
            <p style={{ fontSize: '0.82rem', margin: 0 }}>
              Sistem membutuhkan data historis pelunasan termin yang mencukupi untuk melakukan pelatihan model secara valid tanpa manipulasi skor.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Jamaah</th>
                  <th>Paket Perjalanan</th>
                  <th>Termin Cicilan</th>
                  <th>Jatuh Tempo</th>
                  <th style={{ textAlign: 'center' }}>Tingkat Risiko</th>
                  <th style={{ textAlign: 'right' }}>Skor Probabilitas</th>
                  <th>Versi Model</th>
                  <th>Waktu Prediksi</th>
                </tr>
              </thead>
              <tbody>
                {riskPredictions.map(p => {
                  const getRiskBadge = (level) => {
                    if (level === 'HIGH') return <span className="status-badge rejected">Tinggi</span>;
                    if (level === 'MEDIUM') return <span className="status-badge pending">Sedang</span>;
                    return <span className="status-badge verified">Rendah</span>;
                  };

                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.jamaah?.full_name || 'Jamaah'}</td>
                      <td>{paketMap[p.jamaah?.paket_id] || '-'}</td>
                      <td>{p.term?.title || `Termin #${p.term?.term_number || '-'}`}</td>
                      <td>
                        {p.term?.due_date ? new Date(p.term.due_date).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        }) : '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>{getRiskBadge(p.risk_level)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {(Number(p.risk_score || 0) * 100).toFixed(1)}%
                      </td>
                      <td><code>{p.model_version || '-'}</code></td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {p.predicted_at ? new Date(p.predicted_at).toLocaleString('id-ID') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>Memuat data antrean...</td></tr>
              ) : pendingPayments.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Tidak ada antrean verifikasi transfer.</td></tr>
              ) : (
                pendingPayments.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.jamaah_name}</td>
                    <td>{p.package_name}</td>
                    <td style={{ fontWeight: 700 }}>Rp {Number(p.amount || p.nominal || 0).toLocaleString('id-ID')}</td>
                    <td style={{ textTransform: 'capitalize' }}>Transfer ({p.payment_type || p.jenis})</td>
                    <td>{p.bank_name || p.bank_asal || '-'}</td>
                    <td><code>{p.reference_number || p.no_referensi || '-'}</code></td>
                    <td>
                      <span className="status-badge pending">Menunggu Verifikasi</span>
                    </td>
                    <td>
                      <Link to="/admin/pembayaran/verifikasi" className="btn btn-primary btn-sm">
                        Periksa
                      </Link>
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
