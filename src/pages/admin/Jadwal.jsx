import React from 'react';
import { CalendarPlus, MapPin, Clock } from 'lucide-react';

export default function AdminJadwal() {
  const scheduleItems = [
    {
      id: 'sch-001',
      date: '10 Januari 2027',
      time: '08:00 WIB',
      activity: 'Kumpul Bandara & Manasik Singkat',
      location: 'Bandara Soekarno Hatta (Terminal 3 Gate 1)',
      package_name: 'Umrah Reguler Awal Tahun 2027'
    },
    {
      id: 'sch-002',
      date: '10 Januari 2027',
      time: '12:30 WIB',
      activity: 'Penerbangan Menuju Madinah',
      location: 'Saudia Airlines SV-819',
      package_name: 'Umrah Reguler Awal Tahun 2027'
    },
    {
      id: 'sch-003',
      date: '11 Januari 2027',
      time: '14:00 WAS',
      activity: 'Ziarah Raudhah & Masjid Nabawi',
      location: 'Masjid Nabawi Madinah',
      package_name: 'Umrah Reguler Awal Tahun 2027'
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Jadwal & Agenda Perjalanan</h1>
          <p>Atur rangkaian jadwal perjalanan harian ibadah haji dan umroh per paket.</p>
        </div>
        <div>
          <button className="btn btn-primary">
            <CalendarPlus size={18} />
            <span>+ Tambah Jadwal Kegiatan</span>
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {scheduleItems.map((item, index) => (
            <div 
              key={item.id} 
              style={{
                display: 'flex',
                gap: '18px',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                alignItems: 'center'
              }}
            >
              <div style={{
                background: 'var(--primary-800)',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                minWidth: '80px'
              }}>
                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>HARI</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>0{index + 1}</div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--primary-700)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {item.package_name} • {item.date}
                </div>
                <h4 style={{ margin: '4px 0' }}>{item.activity}</h4>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} /> {item.time}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={14} /> {item.location}
                  </span>
                </div>
              </div>

              <div>
                <button className="btn btn-secondary btn-sm">Edit</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
