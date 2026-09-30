import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { User, Phone, MapPin, CreditCard, ShieldCheck } from 'lucide-react';
import { jamaahService } from '../../services/jamaahService';
import { packageService } from '../../services/packageService';

export default function JamaahProfil() {
  const { profile } = useAuth();
  const [jamaah, setJamaah] = useState(null);
  const [paket, setPaket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Default mapping demo user to jamaah ID 1
        const j = await jamaahService.getJamaahById(1);
        setJamaah(j);
        if (j.paket_id) {
            const pkgs = await packageService.getPackages();
            setPaket(pkgs.find(p => p.id === j.paket_id));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!jamaah) return <div className="p-8 text-center">Data Jamaah tidak ditemukan.</div>;

  return (
    <div style={{ maxWidth: '750px', margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Profil Data Jamaah</h1>
          <p>Informasi identitas pribadi Anda yang terdaftar pada sistem biro perjalanan.</p>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary-700), var(--primary-500))',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem'
          }}>
            <User size={32} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem' }}>{jamaah.nama_lengkap}</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
              <span className={`status-badge ${jamaah.status_pembayaran === 'Lunas' ? 'verified' : 'pending'}`}>
                  {jamaah.status_pembayaran}
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>• Paket {paket ? paket.nama : '-'}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <span className="stat-label">Nomor Induk Kependudukan (NIK)</span>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>{jamaah.nik}</div>
          </div>
          <div>
            <span className="stat-label">Jenis Kelamin</span>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>{jamaah.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</div>
          </div>
          <div>
            <span className="stat-label">Nomor Telepon / WhatsApp</span>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>{jamaah.no_telepon}</div>
          </div>
          <div>
            <span className="stat-label">Status Keberangkatan</span>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>{jamaah.status_keberangkatan}</div>
          </div>
        </div>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <span className="stat-label">Alamat Domisili</span>
          <div style={{ fontWeight: 500, fontSize: '0.92rem', marginTop: '4px', lineHeight: 1.5 }}>
            {jamaah.alamat}
          </div>
        </div>
      </div>
    </div>
  );
}
