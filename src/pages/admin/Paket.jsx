import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { packageService } from '../../services/packageService';
import Modal from '../../components/Modal';
import { 
  PackagePlus, 
  Calendar, 
  Clock, 
  Trash2, 
  Edit3, 
  CalendarDays, 
  AlertCircle,
  Tag
} from 'lucide-react';

export default function AdminPaket() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'Umrah Reguler',
    price: '',
    departure_date: '',
    return_date: '',
    duration: '',
    description: ''
  });
  const [errorMsg, setErrorMsg] = useState('');

  async function loadPackages() {
    setLoading(true);
    try {
      const data = await packageService.getAll();
      setPackages(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPackages();
  }, []);

  function calculateDuration(dep, ret) {
    if (!dep || !ret) return '';
    const d1 = new Date(dep);
    const d2 = new Date(ret);
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : '';
  }

  function handleDepartureChange(val) {
    const dur = calculateDuration(val, formData.return_date);
    setFormData(prev => ({
      ...prev,
      departure_date: val,
      duration: dur ? String(dur) : prev.duration
    }));
  }

  function handleReturnChange(val) {
    const dur = calculateDuration(formData.departure_date, val);
    setFormData(prev => ({
      ...prev,
      return_date: val,
      duration: dur ? String(dur) : prev.duration
    }));
  }

  function openCreateModal() {
    setEditingId(null);
    setFormData({
      name: '',
      type: 'Umrah Reguler',
      price: '',
      departure_date: '',
      return_date: '',
      duration: '',
      description: ''
    });
    setErrorMsg('');
    setIsModalOpen(true);
  }

  function openEditModal(pkg) {
    setEditingId(pkg.id);
    setFormData({
      name: pkg.name,
      type: pkg.type,
      price: String(pkg.price),
      departure_date: pkg.departure_date,
      return_date: pkg.return_date,
      duration: String(pkg.duration),
      description: pkg.description || ''
    });
    setErrorMsg('');
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    const priceNum = Number(formData.price);
    const durNum = Number(formData.duration);

    if (priceNum <= 0) {
      setErrorMsg('Harga paket harus lebih besar dari 0.');
      return;
    }

    if (!formData.departure_date || !formData.return_date) {
      setErrorMsg('Tanggal keberangkatan dan kepulangan wajib diisi.');
      return;
    }

    if (new Date(formData.return_date) < new Date(formData.departure_date)) {
      setErrorMsg('Tanggal kepulangan tidak boleh lebih awal dari tanggal keberangkatan.');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      price: priceNum,
      departure_date: formData.departure_date,
      return_date: formData.return_date,
      duration: durNum || 1,
      description: formData.description.trim()
    };

    try {
      if (editingId) {
        await packageService.update(editingId, payload);
      } else {
        await packageService.create(payload);
      }
      setIsModalOpen(false);
      await loadPackages();
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menyimpan paket.');
    }
  }

  async function handleDelete(id, name) {
    if (confirm(`Apakah Anda yakin ingin menghapus paket "${name}"? Seluruh jadwal terkait juga akan terpengaruh.`)) {
      await packageService.delete(id);
      await loadPackages();
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Manajemen Paket Perjalanan</h1>
          <p>Kelola katalog paket haji dan umroh, patokan nominal tagihan jamaah, dan durasi pelaksanaan.</p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <PackagePlus size={18} />
            <span>+ Buat Paket Baru</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Memuat daftar paket perjalanan...
        </div>
      ) : packages.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <Tag size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3>Belum Ada Paket Perjalanan</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
            Tambahkan paket haji atau umroh pertama Anda sekarang.
          </p>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <PackagePlus size={16} /> Buat Paket Baru
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '22px' }}>
          {packages.map((pkg) => (
            <div key={pkg.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span className="status-badge lengkap">{pkg.type}</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary-800)', letterSpacing: '-0.02em' }}>
                  Rp {Number(pkg.price).toLocaleString('id-ID')}
                </span>
              </div>

              <h3 style={{ fontSize: '1.2rem', marginBottom: '6px', color: 'var(--text-main)' }}>{pkg.name}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: 1.5, flex: 1 }}>
                {pkg.description || 'Tidak ada keterangan tambahan.'}
              </p>

              <div style={{
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                border: '1px solid var(--border-color)',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={15} color="var(--primary-700)" />
                  <span>Keberangkatan: <strong>{new Date(pkg.departure_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={15} color="var(--primary-700)" />
                  <span>Durasi: <strong>{pkg.duration} Hari</strong> (Pulang: {new Date(pkg.return_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })})</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ flex: 1 }}
                  onClick={() => openEditModal(pkg)}
                >
                  <Edit3 size={14} />
                  <span>Ubah</span>
                </button>
                <button 
                  className="btn btn-primary btn-sm" 
                  style={{ flex: 2 }}
                  onClick={() => navigate(`/admin/jadwal?packageId=${pkg.id}`)}
                >
                  <CalendarDays size={14} />
                  <span>Kelola Jadwal</span>
                </button>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ color: '#dc2626', padding: '6px 10px' }}
                  title="Hapus paket"
                  onClick={() => handleDelete(pkg.id, pkg.name)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form Tambah / Edit Paket */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Ubah Rincian Paket' : 'Buat Paket Perjalanan Baru'}
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Batal</button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {editingId ? 'Simpan Perubahan' : 'Buat Paket'}
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
            <label className="form-label">Nama Paket</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="Contoh: Umrah Reguler Awal Tahun 2027"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Jenis Paket</label>
              <select
                className="form-select"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="Umrah Reguler">Umrah Reguler</option>
                <option value="Umrah VIP">Umrah VIP / Ramadhan</option>
                <option value="Haji Khusus">Haji Khusus / Plus</option>
                <option value="Haji Furoda">Haji Furoda / Mujamalah</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Harga Paket (Rp)</label>
              <input
                type="number"
                required
                className="form-input"
                placeholder="Contoh: 35000000"
                min="100000"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Tanggal Keberangkatan</label>
              <input
                type="date"
                required
                className="form-input"
                value={formData.departure_date}
                onChange={(e) => handleDepartureChange(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tanggal Kepulangan</label>
              <input
                type="date"
                required
                className="form-input"
                value={formData.return_date}
                onChange={(e) => handleReturnChange(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Durasi Hari (Kalkulasi Otomatis)</label>
            <input
              type="number"
              required
              className="form-input"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              min="1"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Deskripsi & Fasilitas Utama</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Contoh: Hotel bintang 4, direct flight Saudia Airlines, muthawwif bersertifikat..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
