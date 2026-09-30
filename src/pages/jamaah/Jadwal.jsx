import React from 'react';
import { Calendar, Clock, MapPin, Info } from 'lucide-react';

export default function JamaahJadwal() {
  const scheduleItems = [
    {
      day: 1,
      date: '10 Januari 2027',
      time: '08:00 WIB',
      activity: 'Kumpul Bandara Soekarno Hatta & Manasik Bandara',
      location: 'Terminal 3 Gate 1 Internasional',
      desc: 'Pengarahan akhir dari pembimbing (Muthawwif), pembagian paspor dan boarding pass penerbangan.'
    },
    {
      day: 1,
      date: '10 Januari 2027',
      time: '12:30 WIB',
      activity: 'Take-off Menuju Bandara Madinah (MED)',
      location: 'Pesawat Saudia Airlines SV-819',
      desc: 'Penerbangan langsung Jakarta - Madinah tanpa transit.'
    },
    {
      day: 2,
      date: '11 Januari 2027',
      time: '09:00 WAS',
      activity: 'Ziarah Masjid Nabawi & Makam Baqi',
      location: 'Pelataran Masjid Nabawi Madinah',
      desc: 'Ziarah bersama pembimbing biro perjalanan ke makam Rasulullah SAW, Sayyidina Abu Bakar, dan Umar bin Khattab.'
    },
    {
      day: 2,
      date: '11 Januari 2027',
      time: '14:00 WAS',
      activity: 'Masuk Raudhah Syarifah (Tasrih Resmi)',
      location: 'Raudhah Masjid Nabawi',
      desc: 'Pelaksanaan sholat sunnah dan doa di Raudhah sesuai jadwal izin Tasrih Kementerian Haji Saudi.'
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Jadwal & Agenda Perjalanan Ibadah</h1>
          <p>Rangkaian itinerary harian perjalanan ibadah untuk <strong>Paket Umrah Reguler 2027</strong>.</p>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 18px',
        background: 'var(--primary-50)',
        border: '1px solid var(--primary-100)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '24px',
        color: 'var(--primary-800)'
      }}>
        <Info size={22} style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.88rem' }}>
          Jadwal dapat mengalami penyesuaian waktu (*Waktu Arab Saudi / WAS*) mengikuti koordinasi muthawwif dan otoritas setempat.
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {scheduleItems.map((item, idx) => (
            <div 
              key={idx}
              style={{
                display: 'flex',
                gap: '20px',
                padding: '18px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                alignItems: 'flex-start'
              }}
            >
              <div style={{
                background: 'linear-gradient(135deg, var(--primary-800), var(--primary-600))',
                color: '#fff',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                minWidth: '85px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>HARI KE</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{item.day}</div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-700)', fontWeight: 700 }}>
                  {item.date}
                </div>
                <h3 style={{ fontSize: '1.15rem', margin: '4px 0 6px' }}>{item.activity}</h3>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '10px' }}>
                  {item.desc}
                </p>
                <div style={{ display: 'flex', gap: '18px', fontSize: '0.82rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Clock size={14} color="var(--primary-600)" /> {item.time}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <MapPin size={14} color="var(--primary-600)" /> {item.location}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
