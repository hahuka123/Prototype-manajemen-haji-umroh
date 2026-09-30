import React, { useState, useEffect } from 'react';
import StatCard from '../../components/StatCard';
import { Users, FileCheck, CheckCircle, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { jamaahService } from '../../services/jamaahService';
import { documentService } from '../../services/documentService';
import { paymentService } from '../../services/paymentService';
import { scheduleService } from '../../services/scheduleService';
import { packageService } from '../../services/packageService';

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

  useEffect(() => {
      const fetchData = async () => {
          try {
              setLoading(true);
              const [jamaahList, pendingDocs, pendingPays, schedules, pkgs] = await Promise.all([
                  jamaahService.getJamaah(),
                  documentService.getPendingVerifications(),
                  paymentService.getPendingTransfers(),
                  scheduleService.getSchedules(),
                  packageService.getPackages()
              ]);
              
              const pMap = {};
              pkgs.forEach(p => pMap[p.id] = p.nama);
              setPaketMap(pMap);

              let active = 0, lunas = 0, cicilan = 0, belum = 0, docFull = 0;
              jamaahList.forEach(j => {
                  if (j.status_keberangkatan !== 'Selesai') active++;
                  if (j.status_pembayaran === 'Lunas') lunas++;
                  else if (j.status_pembayaran === 'Cicilan') cicilan++;
                  else belum++;
                  if (j.dokumen_persentase === 100) docFull++;
              });

              setMetrics({
                  totalJamaah: jamaahList.length,
                  jamaahAktif: active,
                  dokumenLengkap: docFull,
                  totalLunas: lunas,
                  totalCicilan: cicilan,
                  totalBelumBayar: belum,
                  pendingVerifikasi: pendingPays.length
              });

              // Enrich pending payments
              const enriched = [];
              for (const p of pendingPays.slice(0, 5)) { // take top 5
                  const j = jamaahList.find(x => x.id === p.jamaah_id);
                  enriched.push({
                      ...p,
                      jamaah_name: j ? j.nama_lengkap : '-',
                      package_name: j && j.paket_id ? pMap[j.paket_id] : '-'
                  });
              }
              setPendingPayments(enriched);

              // Find closest schedule
              const now = new Date();
              const upcoming = schedules.filter(s => new Date(s.tanggal_keberangkatan) >= now)
                                        .sort((a, b) => new Date(a.tanggal_keberangkatan) - new Date(b.tanggal_keberangkatan));
              if (upcoming.length > 0) {
                  setTerdekat(upcoming[0]);
              }

          } catch (err) {
              console.error(err);
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
              Jadwal Keberangkatan Terdekat
            </div>
            <h2 style={{ color: '#fff', margin: '6px 0 4px', fontSize: '1.4rem' }}>
              {terdekat ? (paketMap[terdekat.paket_id] || 'Paket Umum') : 'Belum Ada Jadwal'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} /> {terdekat ? new Date(terdekat.tanggal_keberangkatan).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-'} 
              {terdekat ? ` • Pesawat ${terdekat.maskapai}` : ''}
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
              {loading ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center' }}>Loading...</td></tr>
              ) : pendingPayments.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center' }}>Tidak ada antrean verifikasi transfer.</td></tr>
              ) : (
                  pendingPayments.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.jamaah_name}</td>
                      <td>{p.package_name}</td>
                      <td style={{ fontWeight: 700 }}>Rp {p.nominal.toLocaleString('id-ID')}</td>
                      <td style={{ textTransform: 'capitalize' }}>Transfer ({p.jenis})</td>
                      <td>{p.bank_asal}</td>
                      <td><code>{p.no_referensi}</code></td>
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
