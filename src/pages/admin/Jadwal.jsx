import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { scheduleService } from '../../services/scheduleService';
import { packageService } from '../../services/packageService';
import Modal from '../../components/Modal';
import { 
  CalendarPlus, 
  MapPin, 
  Clock, 
  Calendar, 
  Edit3, 
  Trash2, 
  AlertCircle,
  Filter,
  CheckCircle2
} from 'lucide-react';

export default function AdminJadwal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPackageFilter = searchParams.get('packageId') || '';

  const [schedules, setSchedules] = useState([]);
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState(initialPackageFilter);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    package_id: '',
    date: '',
    time: '08:00',
    activity: '',
    location: '',
    description: ''
  });
  const [errorMsg, setErrorMsg] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const [pkgs, schs] = await Promise.all([
        packageService.getAll(),
        scheduleService.getAll()
      ]);
      setPackages(pkgs);
      setSchedules(schs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleFilterChange(pkgId) {
    setSelectedPackageId(pkgId);
    if (pkgId) {
      setSearchParams({ packageId: pkgId });
    } else {
      setSearchParams({});
    }
  }

  const filteredSchedules = selectedPackageId
    ? schedules.filter(s => s.package_id === selectedPackageId)
    : schedules;

  function getPackageName(pkgId) {
    const pkg = packages.find(p => p.id === pkgId);
    return pkg ? pkg.name : 'Paket Umum';
  }

  function openCreateModal() {
    setEditingId(null);
    setFormData({
      package_id: selectedPackageId || (packages[0]?.id || ''),
      date: new Date().toISOString().split('T')[0],
      time: '08:00',
      activity: '',
      location: '',
      description: ''
    });
    setErrorMsg('');
    setIsModalOpen(true);
  }

  function openEditModal(sch) {
    setEditingId(sch.id);
    setFormData({
      package_id: sch.package_id,
      date: sch.date,
      time: sch.time?.slice(0, 5) || '08:00',
      activity: sch.activity,
      location: sch.location,
      description: sch.description || ''
    });
    setErrorMsg('');
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.package_id) {
      setErrorMsg('Pilih paket perjalanan terlebih dahulu.');
      return;
    }

    if (!formData.activity.trim()) {
      setErrorMsg('Nama kegiatan wajib diisi.');
      return;
    }

    const payload = {
      package_id: formData.package_id,
      date: formData.date,
      time: formData.time,
      activity: formData.activity.trim(),
      location: formData.location.trim(),
      description: formData.description.trim()
    };

    try {
      if (editingId) {
        await scheduleService.update(editingId, payload);
      } else {
        await scheduleService.create(payload);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menyimpan agenda kegiatan.');
    }
  }

  async function handleDelete(id, title) {
    if (confirm(`Hapus agenda kegiatan "${title}"?`)) {
      await scheduleService.delete(id);
      await loadData();
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Jadwal & Agenda Perjalanan</h1>
          <p>Kelola rangkaian jadwal harian, manasik, dan rute perjalanan ibadah untuk setiap paket haji/umroh.</p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <CalendarPlus size={18} />
            <span>+ Tambah Jadwal Kegiatan</span>
          </button>
        </div>
      </div>

      {/* Filter Paket Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Filter size={18} color="var(--primary-700)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Filter Berdasarkan Paket:</span>
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '260px' }}
              value={selectedPackageId}
              onChange={(e) => handleFilterChange(e.target.value)}
            >
              <option value="">Semua Paket ({schedules.length} Agenda)</option>
              {packages.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Menampilkan <strong>{filteredSchedules.length}</strong> kegiatan
          </div>
        </div>
      </div>

      {/* Daftar Jadwal */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Memuat jadwal kegiatan...
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <Calendar size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3>Belum Ada Jadwal untuk Paket Ini</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
            Tambahkan agenda kegiatan harian seperti manasik, penerbangan, ziarah, atau kepulangan.
          </p>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <CalendarPlus size={16} /> Buat Agenda Baru
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredSchedules.map((item, index) => (
            <div 
              key={item.id} 
              className="card"
              style={{
                display: 'flex',
                gap: '20px',
                padding: '20px',
                alignItems: 'flex-start',
                borderLeft: '4px solid var(--primary-600)'
              }}
            >
              {/* Kolom Tanggal Badge */}
              <div style={{
                background: 'var(--primary-800)',
                color: '#fff',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                minWidth: '85px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ fontSize: '0.72rem', opacity: 0.8, textTransform: 'uppercase' }}>AGENDA</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>#{index + 1}</div>
              </div>

              {/* Detail Konten */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--accent-700)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {getPackageName(item.package_id)}
                    </span>
                    <h3 style={{ fontSize: '1.2rem', margin: '4px 0 6px', color: 'var(--text-main)' }}>
                      {item.activity}
                    </h3>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEditModal(item)}
                    >
                      <Edit3 size={14} /> Ubah
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ color: '#dc2626' }}
                      onClick={() => handleDelete(item.id, item.activity)}
                      title="Hapus agenda"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {item.description && (
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '6px 0 12px' }}>
                    {item.description}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '20px', fontSize: '0.84rem', color: 'var(--text-muted)', flexWrap: 'wrap', marginTop: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={15} color="var(--primary-700)" />
                    {new Date(item.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={15} color="var(--primary-700)" />
                    {item.time}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={15} color="var(--primary-700)" />
                    {item.location || 'Lokasi menyusul'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tambah / Edit Jadwal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Ubah Agenda Perjalanan' : 'Tambah Agenda Kegiatan Baru'}
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Batal</button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {editingId ? 'Simpan Perubahan' : 'Simpan Kegiatan'}
            </button>
          </>
        )}
      >
        {errorMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-md)',
            color: '#b91c1c',
            fontSize: '0.85rem',
            marginBottom: '16px'
          }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Paket Perjalanan Terkait</label>
            <select
              className="form-select"
              required
              value={formData.package_id}
              onChange={(e) => setFormData({ ...formData, package_id: e.target.value })}
            >
              <option value="">-- Pilih Paket --</option>
              {packages.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Nama Kegiatan / Agenda</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="Contoh: Ziarah Raudhah & Masjid Nabawi"
              value={formData.activity}
              onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Tanggal Pelaksanaan</label>
              <input
                type="date"
                required
                className="form-input"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Waktu (Jam & Zona)</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Contoh: 08:00 WIB atau 14:00 WAS"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Lokasi Kegiatan</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="Contoh: Masjid Nabawi Madinah / Terminal 3 Bandara Soetta"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Keterangan / Instruksi untuk Jamaah</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Contoh: Menggunakan seragam batik biro, berkumpul tepat waktu di lobi hotel..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
