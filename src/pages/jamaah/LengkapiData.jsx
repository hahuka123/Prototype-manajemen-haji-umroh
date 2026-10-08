import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { jamaahService } from '../../services/jamaahService';
import { 
  UserCheck, 
  CreditCard, 
  Calendar, 
  MapPin, 
  Phone, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  PlaneTakeoff,
  Package
} from 'lucide-react';

export default function JamaahLengkapiData() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const [packagesList, setPackagesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form states
  const [nik, setNik] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [gender, setGender] = useState('Laki-laki');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [address, setAddress] = useState('');
  const [packageId, setPackageId] = useState('');

  useEffect(() => {
    async function fetchPackages() {
      try {
        setLoading(true);
        // Mengambil data paket asli (UUID) dari tabel packages Supabase
        const { data, error } = await supabase
          .from('packages')
          .select('id, name, price, type, departure_date, duration')
          .order('departure_date', { ascending: true });

        if (error) {
          console.error('Gagal memuat paket dari Supabase:', error.message);
        } else if (data) {
          setPackagesList(data);
        }

        // Ambil data jamaah jika sudah ada sebagian di DB
        if (profile?.id || user?.id) {
          const status = await jamaahService.checkOnboardingStatus(profile?.id || user?.id);
          if (status?.data) {
            if (status.data.nik || status.data.NIK) setNik(status.data.nik || status.data.NIK);
            if (status.data.package_id) setPackageId(status.data.package_id);
            if (status.data.gender) setGender(status.data.gender);
            if (status.data.birth_date) setBirthDate(status.data.birth_date);
            if (status.data.phone) setPhone(status.data.phone);
            if (status.data.address) setAddress(status.data.address);
            if (status.data.passport_number) setPassportNumber(status.data.passport_number);
          }
        }
      } catch (err) {
        console.error('Error saat fetch packages:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPackages();
  }, [profile?.id, user?.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    // Validasi NIK
    const cleanNik = nik.trim();
    if (!/^\d{16}$/.test(cleanNik)) {
      setErrorMsg('NIK harus terdiri dari 16 digit angka sesuai KTP.');
      return;
    }

    if (!packageId) {
      setErrorMsg('Silakan pilih salah satu paket ibadah yang ingin Anda ikuti.');
      return;
    }

    if (!birthDate) {
      setErrorMsg('Tanggal lahir wajib diisi.');
      return;
    }

    if (!phone.trim()) {
      setErrorMsg('Nomor telepon / WhatsApp wajib diisi.');
      return;
    }

    if (!address.trim()) {
      setErrorMsg('Alamat lengkap domisili wajib diisi.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        profile_id: profile?.id || user?.id,
        nik: cleanNik,
        passport_number: passportNumber.trim() || null,
        jenis_kelamin: gender,
        tanggal_lahir: birthDate,
        no_telepon: phone.trim(),
        alamat: address.trim(),
        paket_id: packageId,
      };

      await jamaahService.saveOnboardingData(payload);
      alert('Pendaftaran data jamaah & pemilihan paket berhasil disimpan!');
      navigate('/jamaah/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal menyimpan data pendaftaran. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-app)'
      }}>
        <p>Memuat formulir pendaftaran...</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f0fdf4 0%, var(--bg-app) 100%)',
      padding: '40px 20px',
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header Card */}
        <div className="card" style={{
          marginBottom: '24px',
          background: 'linear-gradient(135deg, #064e3b, #022c22)',
          color: '#fff',
          padding: '28px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a7f3d0'
            }}>
              <PlaneTakeoff size={32} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Langkah Awal Pendaftaran
              </div>
              <h1 style={{ color: '#fff', fontSize: '1.6rem', margin: '4px 0 6px' }}>
                Lengkapi Data & Pilih Paket Ibadah
              </h1>
              <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.9rem', margin: 0 }}>
                Ahlan wa Sahlan, <strong>{profile?.full_name || 'Jamaah'}</strong>! Silakan lengkapi data identitas Anda untuk mengaktifkan portal jamaah.
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 18px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-lg)',
            color: '#b91c1c',
            fontSize: '0.9rem',
            marginBottom: '24px'
          }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Container */}
        <div className="card" style={{ padding: '32px' }}>
          <form onSubmit={handleSubmit}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              1. Identitas Kependudukan & Pribadi
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="nik">
                  Nomor Induk Kependudukan (NIK) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="nik"
                  type="text"
                  required
                  maxLength={16}
                  className="form-input"
                  placeholder="16 digit sesuai e-KTP"
                  value={nik}
                  onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Wajib 16 digit angka
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="passport">
                  Nomor Paspor (Opsional)
                </label>
                <input
                  id="passport"
                  type="text"
                  className="form-input"
                  placeholder="Contoh: B1234567 (Bisa dilengkapi nanti)"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value.toUpperCase())}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="gender">
                  Jenis Kelamin <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  id="gender"
                  className="form-select"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="birthDate">
                  Tanggal Lahir <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="birthDate"
                  type="date"
                  required
                  className="form-input"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="phone">
                  Nomor Telepon / WhatsApp <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  className="form-input"
                  placeholder="Contoh: 081234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="address">
                  Alamat Lengkap Domisili <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  id="address"
                  required
                  rows={3}
                  className="form-textarea"
                  placeholder="Masukkan jalan, RT/RW, kelurahan, kecamatan, kota/kabupaten..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>

            <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              2. Pilih Paket Perjalanan Ibadah
            </h3>

            {/* Dropdown Pemilihan Paket sesuai panduan */}
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" htmlFor="packageSelect" style={{ fontWeight: 600 }}>
                Pilihan Paket Ibadah <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="packageSelect"
                className="form-select"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border-color)',
                  fontSize: '1rem',
                  backgroundColor: '#fff',
                  cursor: 'pointer'
                }}
              >
                <option value="">-- Pilih Paket Ibadah --</option>
                {packagesList.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name || pkg.nama} - Rp {Number(pkg.price || pkg.harga || 0).toLocaleString('id-ID')}
                  </option>
                ))}
              </select>

              {packagesList.length === 0 && (
                <div style={{ marginTop: '10px', padding: '12px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', color: '#92400e', fontSize: '0.88rem' }}>
                  ⚠️ Belum ada paket perjalanan ibadah yang terdaftar di database Supabase. Silakan hubungi admin biro untuk menambahkan paket terlebih dahulu.
                </div>
              )}
            </div>

            {/* Visual Card List untuk kemudahan memilih */}
            {packagesList.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                {packagesList.map((pkg) => {
                  const isSelected = packageId === pkg.id;
                  const pkgName = pkg.name || pkg.nama;
                  const pkgPrice = pkg.price || pkg.harga;
                  const pkgDuration = pkg.duration || pkg.durasi_hari;
                  const pkgDepDate = pkg.departure_date || pkg.tanggal_keberangkatan;

                  return (
                    <div
                      key={pkg.id}
                      onClick={() => setPackageId(pkg.id)}
                      style={{
                        border: isSelected ? '2px solid var(--primary-600)' : '1px solid var(--border-color)',
                        background: isSelected ? 'var(--primary-50)' : '#fff',
                        borderRadius: 'var(--radius-lg)',
                        padding: '18px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span className="status-badge" style={{ backgroundColor: 'var(--primary-100)', color: 'var(--primary-800)', fontWeight: 600 }}>
                          {pkg.type || pkg.tipe || 'Paket Ibadah'}
                        </span>
                        {isSelected && (
                          <CheckCircle2 size={22} color="var(--primary-600)" />
                        )}
                      </div>
                      <h4 style={{ fontSize: '1.05rem', margin: '4px 0 8px', color: 'var(--text-main)' }}>
                        {pkgName}
                      </h4>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-700)', marginBottom: '10px' }}>
                        Rp {Number(pkgPrice || 0).toLocaleString('id-ID')}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span>📅 Berangkat: {pkgDepDate ? new Date(pkgDepDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span>
                        <span>⏱️ Durasi: {pkgDuration || '-'} Hari</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => logout()}
              >
                Keluar
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', padding: '12px 28px', fontSize: '1rem' }}
              >
                <span>{submitting ? 'Menyimpan...' : 'Simpan & Lanjutkan ke Dashboard'}</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
