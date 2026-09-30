import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { User, Phone, MapPin, CreditCard, ShieldCheck } from 'lucide-react';

export default function JamaahProfil() {
  const { profile } = useAuth();

  const jamaahData = {
    nama: profile?.full_name || 'Ahmad Fauzan',
    nik: '3271020038840001',
    paspor: 'B9872615',
    tglLahir: '15 Maret 1988',
    gender: 'Laki-laki',
    alamat: 'Jl. Melati No. 45, Kebayoran Baru, Jakarta Selatan',
    noHp: profile?.phone || '081234567890',
    paket: 'Umrah Reguler 2027',
    status: 'Belum Lunas'
  };

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
            <h2 style={{ fontSize: '1.35rem' }}>{jamaahData.nama}</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
              <span className="status-badge pending">{jamaahData.status}</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>• Paket {jamaahData.paket}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <span className="stat-label">Nomor Induk Kependudukan (NIK)</span>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>{jamaahData.nik}</div>
          </div>
          <div>
            <span className="stat-label">Nomor Paspor</span>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>{jamaahData.paspor}</div>
          </div>
          <div>
            <span className="stat-label">Tanggal Lahir</span>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>{jamaahData.tglLahir}</div>
          </div>
          <div>
            <span className="stat-label">Jenis Kelamin</span>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>{jamaahData.gender}</div>
          </div>
          <div>
            <span className="stat-label">Nomor Telepon / WhatsApp</span>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>{jamaahData.noHp}</div>
          </div>
          <div>
            <span className="stat-label">Paket Ibadah</span>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px', color: 'var(--primary-700)' }}>
              {jamaahData.paket}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <span className="stat-label">Alamat Domisili</span>
          <div style={{ fontWeight: 500, fontSize: '0.92rem', marginTop: '4px', lineHeight: 1.5 }}>
            {jamaahData.alamat}
          </div>
        </div>
      </div>
    </div>
  );
}
