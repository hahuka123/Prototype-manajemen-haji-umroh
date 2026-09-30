import React from 'react';
import { PackagePlus, Calendar, Clock } from 'lucide-react';

export default function AdminPaket() {
  const packages = [
    {
      id: 'pkg-001',
      name: 'Umrah Reguler Awal Tahun 2027',
      type: 'Umrah Reguler',
      price: 35000000,
      departure: '10 Januari 2027',
      return: '21 Januari 2027',
      duration: '12 Hari',
      description: 'Penerbangan direct Saudia Airlines Jakarta - Madinah, akomodasi hotel bintang 4 dekat pelataran masjid.'
    },
    {
      id: 'pkg-002',
      name: 'Haji Khusus / Plus VIP 2027',
      type: 'Haji Plus',
      price: 165000000,
      departure: '20 Mei 2027',
      return: '15 Juni 2027',
      duration: '27 Hari',
      description: 'Maktab VIP zona 1 Mina & Arafah, hotel bintang 5 langsung pelataran Masjidil Haram.'
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Manajemen Paket Perjalanan</h1>
          <p>Kelola katalog paket haji dan umroh, harga patokan tagihan jamaah, dan durasi perjalanan.</p>
        </div>
        <div>
          <button className="btn btn-primary">
            <PackagePlus size={18} />
            <span>+ Buat Paket Baru</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {packages.map((pkg) => (
          <div key={pkg.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <span className="status-badge lengkap">{pkg.type}</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-800)' }}>
                Rp {pkg.price.toLocaleString('id-ID')}
              </span>
            </div>

            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{pkg.name}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              {pkg.description}
            </p>

            <div style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', padding: '12px', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={14} color="var(--primary-600)" />
                <span>Keberangkatan: <strong>{pkg.departure}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={14} color="var(--primary-600)" />
                <span>Durasi: <strong>{pkg.duration}</strong> (Kembali: {pkg.return})</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1 }}>Ubah Paket</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }}>Kelola Jadwal</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
