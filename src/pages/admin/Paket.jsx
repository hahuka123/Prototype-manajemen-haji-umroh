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
  Tag,
  Users
} from 'lucide-react';

export default function AdminPaket() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'Umrah Reguler',
    price: '',
    departure_date: '',
    return_date: '',
    duration: '',
    quota: '',
    description: ''
  });
  const [errorMsg, setErrorMsg] = useState('');

  async function loadPackages() {
    setLoading(true);
    setLoadError('');
    try {
      const data = await packageService.getAll();
      setPackages(data);
    } catch (e) {
      console.error(e);
      setLoadError(e.message || 'Gagal memuat daftar paket perjalanan.');
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
      quota: '',
      description: ''
    });
    setErrorMsg('');
    setIsModalOpen(true);
  }

  function openEditModal(pkg) {
    setEditingId(pkg.id);
    setFormData({
      name: pkg.name || pkg.nama || '',
      type: pkg.type || pkg.tipe || 'Umrah Reguler',
      price: String(pkg.price ?? pkg.harga ?? ''),
      departure_date: pkg.departure_date || pkg.tanggal_keberangkatan || '',
      return_date: pkg.return_date || pkg.tanggal_kepulangan || '',
      duration: String(pkg.duration ?? pkg.durasi_hari ?? ''),
      quota: (pkg.quota !== null && pkg.quota !== undefined) ? String(pkg.quota) : '',
      description: pkg.description || pkg.deskripsi || ''
    });
    setErrorMsg('');
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMsg('');

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setErrorMsg('Nama paket tidak boleh kosong.');
      return;
    }

    const priceNum = Number(formData.price);
    if (!formData.price || isNaN(priceNum) || priceNum <= 0) {
      setErrorMsg('Harga paket harus berupa angka lebih besar dari 0.');
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

    const durNum = Number(formData.duration);
    if (!formData.duration || isNaN(durNum) || durNum <= 0) {
      setErrorMsg('Durasi hari harus berupa angka lebih besar dari 0.');
      return;
    }

    // Validasi ketat kuota jamaah
    const quotaRaw = formData.quota;
    if (quotaRaw === '' || quotaRaw === null || quotaRaw === undefined) {
      setErrorMsg('Kuota jamaah wajib diisi.');
      return;
    }

    const quotaNum = Number(quotaRaw);
    if (isNaN(quotaNum)) {
      setErrorMsg('Kuota jamaah harus berupa angka.');
      return;
    }

    if (!Number.isInteger(quotaNum)) {
      setErrorMsg('Kuota jamaah harus berupa bilangan bulat (bukan pecahan atau desimal).');
      return;
    }

    if (quotaNum <= 0) {
      setErrorMsg('Kuota jamaah harus berupa bilangan bulat positif minimal 1 (tidak boleh 0 atau bernilai negatif).');
      return;
    }

    // Jika mengedit, pastikan kuota baru tidak lebih kecil dari jamaah yang sudah terdaftar
    if (editingId) {
      const currentPkg = packages.find(p => p.id === editingId);
      if (currentPkg && typeof currentPkg.terisi === 'number' && quotaNum < currentPkg.terisi) {
        setErrorMsg(`Kuota baru (${quotaNum}) tidak boleh lebih kecil dari jumlah jamaah yang sudah terdaftar saat ini (${currentPkg.terisi} jamaah).`);
        return;
      }
    }

    const payload = {
      name: trimmedName,
      type: formData.type,
      price: priceNum,
      departure_date: formData.departure_date,
      return_date: formData.return_date,
      duration: durNum,
      quota: quotaNum,
      description: formData.description.trim()
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await packageService.update(editingId, payload);
      } else {
        await packageService.create(payload);
      }
      setIsModalOpen(false);
      await loadPackages();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal menyimpan paket ke database.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus paket "${name}"? Pastikan tidak ada data jamaah atau jadwal yang terikat.`)) {
      return;
    }
    setActionError('');
    setDeletingId(id);
    try {
      await packageService.delete(id);
      await loadPackages();
    } catch (err) {
      console.error('Delete error:', err);
      setActionError(err.message || 'Gagal menghapus paket.');
      alert(err.message || 'Gagal menghapus paket.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Manajemen Paket Perjalanan</h1>
          <p>Kelola katalog paket haji dan umroh, patokan nominal tagihan jamaah, kuota kapasitas, dan durasi pelaksanaan.</p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <PackagePlus size={18} />
            <span>+ Buat Paket Baru</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#b91c1c',
          fontSize: '0.9rem',
          marginBottom: '20px'
        }}>
          <AlertCircle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {loadError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#b91c1c',
          fontSize: '0.9rem',
          marginBottom: '20px'
        }}>
          <AlertCircle size={18} />
          <span>{loadError}</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Memuat daftar paket perjalanan...
        </div>
      ) : packages.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <Tag size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3>Belum Ada Paket Perjalanan</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
            Tambahkan paket haji atau umroh pertama Anda sekarang lengkap dengan penetapan kuota jamaah.
          </p>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <PackagePlus size={16} /> Buat Paket Baru
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '22px' }}>
          {packages.map((pkg) => (
            <div key={pkg.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span className="status-badge lengkap">{pkg.type}</span>
                  {pkg.is_penuh && (
                    <span className="status-badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
                      Kuota Penuh
                    </span>
                  )}
                  {pkg.quota === null && (
                    <span className="status-badge" style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                      Kuota Belum Diatur
                    </span>
                  )}
                </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={15} color="var(--primary-700)" />
                  <span>
                    Kuota Jamaah:{' '}
                    {pkg.quota !== null && pkg.quota !== undefined ? (
                      <strong>{pkg.quota} orang</strong>
                    ) : (
                      <span style={{ color: '#d97706', fontWeight: 600 }}>Belum diatur</span>
                    )}
                  </span>
                </div>

                <div style={{
                  marginTop: '4px',
                  paddingTop: '8px',
                  borderTop: '1px dashed var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.82rem'
                }}>
                  <span>Terisi: <strong>{pkg.terisi ?? 0} jamaah</strong></span>
                  <span>
                    {pkg.quota !== null && pkg.quota !== undefined ? (
                      <>
                        Sisa Kuota:{' '}
                        <strong style={{ color: pkg.sisa_kuota === 0 ? '#dc2626' : 'var(--primary-700)' }}>
                          {pkg.sisa_kuota} kursi
                        </strong>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Sisa: Belum ditentukan</span>
                    )}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ flex: 1 }}
                  onClick={() => openEditModal(pkg)}
                  disabled={deletingId === pkg.id}
                >
                  <Edit3 size={14} />
                  <span>Ubah</span>
                </button>
                <button 
                  className="btn btn-primary btn-sm" 
                  style={{ flex: 2 }}
                  onClick={() => navigate(`/admin/jadwal?packageId=${pkg.id}`)}
                  disabled={deletingId === pkg.id}
                >
                  <CalendarDays size={14} />
                  <span>Kelola Jadwal</span>
                </button>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ color: '#dc2626', padding: '6px 10px' }}
                  title="Hapus paket"
                  onClick={() => handleDelete(pkg.id, pkg.name)}
                  disabled={deletingId === pkg.id}
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
        onClose={() => !submitting && setIsModalOpen(false)}
        title={editingId ? 'Ubah Rincian Paket' : 'Buat Paket Perjalanan Baru'}
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={submitting}>Batal</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Menyimpan...' : (editingId ? 'Simpan Perubahan' : 'Buat Paket')}
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
            <label className="form-label" htmlFor="packageName">
              Nama Paket <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="packageName"
              type="text"
              required
              className="form-input"
              placeholder="Contoh: Umrah Reguler Awal Tahun 2027"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="packageType">
                Jenis Paket <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="packageType"
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
              <label className="form-label" htmlFor="packagePrice">
                Harga Paket (Rp) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="packagePrice"
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="departureDate">
                Tanggal Keberangkatan <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="departureDate"
                type="date"
                required
                className="form-input"
                value={formData.departure_date}
                onChange={(e) => handleDepartureChange(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="returnDate">
                Tanggal Kepulangan <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="returnDate"
                type="date"
                required
                className="form-input"
                value={formData.return_date}
                onChange={(e) => handleReturnChange(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="packageDuration">
                Durasi Hari (Kalkulasi Otomatis) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="packageDuration"
                type="number"
                required
                className="form-input"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                min="1"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="packageQuota">
                Kuota Jamaah (Orang) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="packageQuota"
                type="number"
                required
                className="form-input"
                placeholder="Contoh: 40"
                value={formData.quota}
                onChange={(e) => setFormData({ ...formData, quota: e.target.value })}
                min="1"
                step="1"
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Kapasitas maksimal jamaah untuk paket perjalanan (minimal 1).
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="packageDescription">Deskripsi & Fasilitas Utama</label>
            <textarea
              id="packageDescription"
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
