import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Lock, Mail, ShieldCheck, UserCheck, AlertCircle, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, demoLogin, isConfigured, isDemoAllowed, user, role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname;

  // Jika pengguna sudah terautentikasi dan memiliki role valid, arahkan langsung ke dashboard
  React.useEffect(() => {
    if (!loading && user && role) {
      if (role === 'admin') {
        const adminDest = from && from.startsWith('/admin') ? from : '/admin/dashboard';
        navigate(adminDest, { replace: true });
      } else if (role === 'jamaah') {
        const jamaahDest = from && from.startsWith('/jamaah') ? from : '/';
        navigate(jamaahDest, { replace: true });
      }
    }
  }, [user, role, loading, from, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Silakan masukkan alamat email Anda.');
      return;
    }

    if (!password) {
      setErrorMsg('Silakan masukkan kata sandi akun Anda.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Panggil login riil Supabase dan validasi role dari tabel profiles
      const authResult = await login(cleanEmail, password);

      // 2. Navigasi hanya setelah identitas dan role tervalidasi
      const userRole = authResult?.role;

      if (userRole === 'admin') {
        // Jika sebelumnya diarahkan dari rute admin tertentu, kembali ke rute tersebut
        const adminDest = from && from.startsWith('/admin') ? from : '/admin/dashboard';
        navigate(adminDest, { replace: true });
      } else if (userRole === 'jamaah') {
        // Jika sebelumnya diarahkan dari rute jamaah tertentu
        const jamaahDest = from && from.startsWith('/jamaah') ? from : '/';
        navigate(jamaahDest, { replace: true });
      } else {
        // Pengguna tanpa role yang valid tidak boleh masuk
        setErrorMsg('Role akun Anda tidak valid atau tidak memiliki hak akses dashboard.');
      }
    } catch (err) {
      console.error('[Login] Error:', err);
      setErrorMsg(err.message || 'Email atau kata sandi tidak valid. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDemoSelect(role) {
    try {
      demoLogin(role);
      if (role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/jamaah/dashboard', { replace: true });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Gagal mengaktifkan mode demo.');
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #0f172a 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative background circle */}
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
        top: '-10%',
        right: '-10%',
        pointerEvents: 'none'
      }} />

      <div style={{
        maxWidth: '460px',
        width: '100%',
        background: 'rgba(255, 255, 255, 0.98)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        padding: '36px 32px',
        position: 'relative',
        zIndex: 10,
        border: '1px solid rgba(255, 255, 255, 0.6)'
      }}>
        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 16px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--primary-800), var(--primary-600))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            boxShadow: '0 10px 15px -3px rgba(6, 78, 59, 0.4)'
          }}>
            🕋
          </div>
          <h2 style={{ fontSize: '1.45rem', color: 'var(--text-main)', marginBottom: '6px' }}>
            Masuk ke Sistem
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Portal Manajemen Haji & Umroh Terpadu
          </p>
        </div>

        {errorMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '12px 14px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-md)',
            color: '#b91c1c',
            fontSize: '0.85rem',
            marginBottom: '20px',
            lineHeight: 1.45
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Alamat Email</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-email"
                type="email"
                required
                className="form-input"
                style={{ paddingLeft: '40px' }}
                placeholder="nama@email.com"
                value={email}
                disabled={isSubmitting}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Mail size={18} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Kata Sandi</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type="password"
                required
                className="form-input"
                style={{ paddingLeft: '40px' }}
                placeholder="••••••••"
                value={password}
                disabled={isSubmitting}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Lock size={18} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spin-icon" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Memverifikasi Akun & Role...</span>
              </>
            ) : (
              <span>Masuk Akun</span>
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.88rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Belum punya akun?</span>{' '}
          <Link to="/register" style={{ color: 'var(--primary-600)', fontWeight: 600, textDecoration: 'none' }}>
            Daftar sekarang
          </Link>
        </div>

        {/* Demo Fast Login Switcher (Hanya jika mode demo diizinkan secara eksplisit) */}
        {isDemoAllowed && (
          <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              textAlign: 'center',
              marginBottom: '12px'
            }}>
              Akses Cepat Pengujian (Mode Demo Presentasi)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleDemoSelect('admin')}
                className="btn btn-secondary"
                disabled={isSubmitting}
                style={{
                  fontSize: '0.8rem',
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  border: '1px solid var(--primary-100)',
                  background: 'var(--primary-50)',
                  color: 'var(--primary-800)'
                }}
              >
                <ShieldCheck size={16} />
                <span>Demo Admin</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoSelect('jamaah')}
                className="btn btn-secondary"
                disabled={isSubmitting}
                style={{
                  fontSize: '0.8rem',
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  border: '1px solid var(--accent-100)',
                  background: 'var(--accent-50)',
                  color: 'var(--accent-800)'
                }}
              >
                <UserCheck size={16} />
                <span>Demo Jamaah</span>
              </button>
            </div>

            <p style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
              marginTop: '10px',
              lineHeight: 1.4
            }}>
              Tombol demo ini hanya untuk simulasi antarmuka dan terpisah dari autentikasi Supabase nyata.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
