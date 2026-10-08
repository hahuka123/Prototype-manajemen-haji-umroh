import React, { useState, useEffect } from 'react';
import { scheduleService } from '../../services/scheduleService';
import { packageService } from '../../services/packageService';
import { jamaahService } from '../../services/jamaahService';
import { useAuth } from '../../hooks/useAuth';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Info, 
  Search, 
  Compass, 
  AlertCircle 
} from 'lucide-react';

export default function JamaahJadwal() {
  const { profile } = useAuth();
  const [jamaah, setJamaah] = useState(null);
  const [packageData, setPackageData] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      if (!profile?.id) return;
      const jData = await jamaahService.getMyJamaah(profile.id);
      setJamaah(jData);

      if (jData?.paket_id) {
        const [pkg, schs] = await Promise.all([
          packageService.getById(jData.paket_id),
          scheduleService.getByPackage(jData.paket_id)
        ]);
        setPackageData(pkg);
        setSchedules(schs || []);
      } else {
        setPackageData(null);
        setSchedules([]);
      }
    } catch (e) {
      console.error('Gagal memuat jadwal jamaah:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile?.id) {
      loadData();
    }
  }, [profile?.id]);

  const filtered = schedules.filter(s => 
    (s.activity && s.activity.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.location && s.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return <div className="p-8 text-center">Memuat jadwal kegiatan ibadah...</div>;
  }

  if (!jamaah) {
    return (
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
        </div>
      </div>
    );
  }

  if (!jamaah.paket_id || !packageData) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-title">
            <h1>Jadwal & Agenda Perjalanan Ibadah</h1>
            <p>Rangkaian itinerary harian perjalanan ibadah khusus untuk paket yang Anda ikuti.</p>
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <Calendar size={44} color="var(--primary-600)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Belum Terdaftar pada Paket Perjalanan</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '500px', margin: '8px auto' }}>
            Data Anda belum terhubung dengan paket haji atau umroh. Hubungi admin biro untuk menentukan paket keberangkatan agar jadwal itinerary dapat ditampilkan.
          </p>
        </div>
      </div>
    );
  }

  const packageName = packageData.name || packageData.nama || 'Paket Perjalanan';
  const depDate = packageData.departure_date || packageData.tanggal_keberangkatan;
  const durationDays = packageData.duration || packageData.durasi_hari || '-';

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Jadwal & Agenda Perjalanan Ibadah</h1>
          <p>Rangkaian itinerary harian perjalanan ibadah khusus untuk paket yang Anda ikuti.</p>
        </div>
      </div>

      {/* Info Paket Banner */}
      <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #064e3b, #022c22)', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Paket Anda Terdaftar
            </div>
            <h2 style={{ color: '#fff', margin: '4px 0 6px', fontSize: '1.4rem' }}>
              {packageName}
            </h2>
            <div style={{ display: 'flex', gap: '18px', fontSize: '0.86rem', color: 'rgba(255,255,255,0.85)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={15} color="#6ee7b7" />
                Keberangkatan: <strong>{depDate ? new Date(depDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={15} color="#6ee7b7" />
                Durasi: <strong>{durationDays} Hari</strong>
              </span>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px 18px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#a7f3d0' }}>Status Paket</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Penerbangan Terjadwal</div>
          </div>
        </div>
      </div>

      {/* Notice Card */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 18px',
        background: 'var(--primary-50)',
        border: '1px solid var(--primary-100)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '20px',
        color: 'var(--primary-800)'
      }}>
        <Info size={22} style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.86rem' }}>
          Agenda dapat mengalami penyesuaian waktu (Waktu Arab Saudi / WAS) mengikuti koordinasi pembimbing (Muthawwif) dan regulasi otoritas setempat.
        </div>
      </div>

      {/* Pencarian Jadwal */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Cari kegiatan, ziarah, atau lokasi (contoh: Raudhah, Miqat, Bandara)..."
            style={{ paddingLeft: '38px' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>
      </div>

      {/* Timeline List */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Memuat jadwal kegiatan ibadah...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px' }}>
          <Compass size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
          <h3>Tidak Ada Kegiatan yang Cocok</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Coba gunakan kata kunci pencarian yang lain.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filtered.map((item, index) => (
            <div 
              key={item.id}
              className="card"
              style={{
                display: 'flex',
                gap: '20px',
                padding: '20px',
                alignItems: 'flex-start',
                borderLeft: '4px solid var(--primary-600)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
            >
              <div style={{
                background: 'linear-gradient(135deg, var(--primary-800), var(--primary-600))',
                color: '#fff',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                minWidth: '85px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>AGENDA</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>#{index + 1}</div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-700)', fontWeight: 700 }}>
                  {new Date(item.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <h3 style={{ fontSize: '1.2rem', margin: '4px 0 6px', color: 'var(--text-main)' }}>
                  {item.activity}
                </h3>
                {item.description && (
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
                    {item.description}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '20px', fontSize: '0.84rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={15} color="var(--primary-700)" />
                    <strong>{item.time}</strong>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={15} color="var(--primary-700)" />
                    {item.location}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
