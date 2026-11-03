import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../../components/StatCard';
import PaymentStatusBadge from '../../components/PaymentStatusBadge';
import { CreditCard, Send, CheckCircle, Clock, Calendar, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { paymentService } from '../../services/paymentService';
import { jamaahService } from '../../services/jamaahService';
import { packageService } from '../../services/packageService';
import { installmentService } from '../../services/installmentService';
import { useAuth } from '../../hooks/useAuth';

export default function JamaahPembayaran() {
  const { profile } = useAuth();
  const [jamaah, setJamaah] = useState(null);
  const [payments, setPayments] = useState([]);
  const [terms, setTerms] = useState([]);
  const [paket, setPaket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (!profile?.id) {
          throw new Error('Profil pengguna belum tersedia.');
        }

        console.log('[DEBUG] profile.id login:', profile.id);

        const jData = await jamaahService.getMyJamaah(profile.id);
        console.log('[DEBUG] hasil getMyJamaah:', jData);
        setJamaah(jData);

        if (jData?.id) {
          if (jData.paket_id) {
            const pkgs = await packageService.getPackages();
            setPaket((pkgs || []).find(p => p.id === jData.paket_id));
          }

          const pData = await paymentService.getPaymentsByJamaah(jData.id);
          const sorted = (pData || []).sort(
            (a, b) => new Date(b.tanggal) - new Date(a.tanggal)
          );
          setPayments(sorted);

          const tData = await installmentService.getTermsByJamaah(jData.id);
          setTerms(tData || []);
        } else {
          setPayments([]);
        }
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
  if (!jamaah) return (
    <div className="card" style={{ margin: '24px', padding: '32px', textAlign: 'center' }}>
      <Clock size={44} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Data Pembayaran Belum Terhubung</h3>
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

      {/* Rencana Jadwal Termin Cicilan */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} className="text-primary" />
              Rencana Jadwal Termin Cicilan
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Pemantauan progres pelunasan bertahap (termin) sesuai kesepakatan paket ibadah Anda.
            </p>
          </div>
          {terms.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {terms.some(t => t.status === 'overdue') && (
                <span className="status-badge rejected" style={{ fontSize: '0.75rem' }}>
                  <AlertTriangle size={13} />
                  Perlu Perhatian: Termin Terlambat
                </span>
              )}
              <span className="status-badge neutral" style={{ fontSize: '0.75rem' }}>
                {terms.filter(t => t.status === 'paid').length} dari {terms.length} Termin Lunas
              </span>
            </div>
          )}
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '90px' }}>Termin</th>
                <th>Keterangan</th>
                <th>Jatuh Tempo</th>
                <th style={{ textAlign: 'right' }}>Target Tagihan</th>
                <th style={{ textAlign: 'right' }}>Terbayar Sah</th>
                <th style={{ textAlign: 'right' }}>Sisa Termin</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center', width: '100px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {terms.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Belum ada jadwal termin cicilan yang ditetapkan oleh pihak travel untuk akun Anda.
                  </td>
                </tr>
              ) : (
                terms.map((term) => {
                  const targetNominal = Number(term.target_amount ?? term.amount ?? 0);
                  const verifiedNominal = Number(term.verified_amount ?? 0);
                  const remainingNominal = Number(term.remaining_amount ?? Math.max(0, targetNominal - verifiedNominal));
                  const isPaid = term.status === 'paid' || remainingNominal <= 0;

                  return (
                    <tr key={term.id || term.term_id || term.term_number}>
                      <td style={{ fontWeight: 700 }}>
                        Termin #{term.term_number}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{term.title || `Cicilan Tahap ${term.term_number}`}</div>
                        {term.notes && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {term.notes}
                          </div>
                        )}
                        {Number(term.pending_amount || 0) > 0 && (
                          <div style={{ fontSize: '0.72rem', color: '#d97706', marginTop: '2px' }}>
                            (Ada Rp {Number(term.pending_amount).toLocaleString('id-ID')} sedang diverifikasi)
                          </div>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {term.due_date ? new Date(term.due_date).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        }) : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        Rp {targetNominal.toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'right', color: verifiedNominal > 0 ? 'var(--success-color)' : 'var(--text-muted)', fontWeight: 600 }}>
                        Rp {verifiedNominal.toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: remainingNominal > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        Rp {remainingNominal.toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <PaymentStatusBadge status={term.status} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isPaid ? (
                          <span style={{ fontSize: '0.78rem', color: 'var(--success-color)', fontWeight: 600 }}>
                            ✓ Lunas
                          </span>
                        ) : (
                          <Link
                            to={`/jamaah/pembayaran/ajukan?term_id=${term.id || term.term_id}&termin=${term.term_number}&nominal=${remainingNominal}`}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 10px', fontSize: '0.75rem', textDecoration: 'none' }}
                          >
                            <span>Bayar</span>
                            <ArrowUpRight size={12} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
