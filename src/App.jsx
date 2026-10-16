import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { supabase } from './services/supabase';

// Layout & Proteksi
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Halaman Publik
import Login from './pages/Login';
import Register from './pages/Register';

// Halaman Admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminJamaah from './pages/admin/Jamaah';
import AdminDetailJamaah from './pages/admin/DetailJamaah';
import AdminDokumen from './pages/admin/Dokumen';
import AdminPembayaran from './pages/admin/Pembayaran';
import AdminVerifikasiPembayaran from './pages/admin/VerifikasiPembayaran';
import AdminCatatPembayaranCash from './pages/admin/CatatPembayaranCash';
import AdminPaket from './pages/admin/Paket';
import AdminJadwal from './pages/admin/Jadwal';

// Halaman Jamaah
import JamaahDashboard from './pages/jamaah/Dashboard';
import JamaahLengkapiData from './pages/jamaah/LengkapiData';
import JamaahProfil from './pages/jamaah/Profil';
import JamaahDokumen from './pages/jamaah/Dokumen';
import JamaahPembayaran from './pages/jamaah/Pembayaran';
import JamaahAjukanPembayaran from './pages/jamaah/AjukanPembayaran';
import JamaahJadwal from './pages/jamaah/Jadwal';

// Komponen penentu redirect awal berdasarkan role & status onboarding jamaah
function RootRedirect() {
  const { user, profile, role, loading, isDemo, logout } = useAuth();
  const [checking, setChecking] = useState(true);
  const [targetPath, setTargetPath] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    async function checkJamaahOnboarding() {
      if (loading) return;

      if (!user) {
        setTargetPath('/login');
        setChecking(false);
        return;
      }

      const activeRole = role || profile?.role;

      // 1. Role Admin langsung ke Dashboard Admin
      if (activeRole === 'admin') {
        setTargetPath('/admin/dashboard');
        setChecking(false);
        return;
      }

      // 2. Role Jamaah: periksa kelengkapan data & paket ibadah
      if (activeRole === 'jamaah') {
        // Cek akun demo
        if (isDemo || (typeof user.id === 'string' && user.id.startsWith('demo-'))) {
          setTargetPath('/jamaah/dashboard');
          setChecking(false);
          return;
        }

        try {
          setChecking(true);
          setQueryError(null);

          // Cek apakah data pendaftaran jamaah sudah ada di tabel public.jamaah
          const { data: jamaahData, error } = await supabase
            .from('jamaah')
            .select('*')
            .eq('profile_id', user.id)
            .maybeSingle();

          if (error) {
            console.error('[RootRedirect] Error memeriksa onboarding jamaah:', error.message);
            // PENTING: Bedakan kegagalan query dengan kondisi profil belum lengkap
            setQueryError(`Gagal menghubungi server database: ${error.message}`);
            setChecking(false);
            return;
          }

          const hasNik = Boolean(jamaahData?.nik || jamaahData?.NIK);
          const hasPackage = Boolean(jamaahData?.package_id || jamaahData?.paket_id);

          // Jika memang data belum diisi di database
          if (!jamaahData || !hasPackage || !hasNik) {
            setTargetPath('/jamaah/lengkapi-data'); // Arahkan ke formulir kelengkapan data
          } else {
            setTargetPath('/jamaah/dashboard'); // Arahkan ke dashboard jamaah
          }
        } catch (err) {
          console.error('[RootRedirect] Exception onboarding jamaah:', err);
          setQueryError(err.message || 'Terjadi kesalahan saat memeriksa data akun.');
        } finally {
          setChecking(false);
        }
      } else {
        // Role kosong atau tidak dikenali -> jangan izinkan masuk ke dashboard
        setTargetPath('/login');
        setChecking(false);
      }
    }

    checkJamaahOnboarding();
  }, [user, profile, role, loading, isDemo, retryKey]);

  if (loading || checking) {
    return (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '12px',
        background: 'var(--bg-app)'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid #e2e8f0',
          borderTopColor: 'var(--primary-600, #059669)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.9rem' }}>Memverifikasi sesi & status akun...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Jika terjadi kegagalan query database, jangan paksa user mengisi data ulang
  if (queryError) {
    return (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--bg-app)'
      }}>
        <div style={{
          maxWidth: '480px',
          width: '100%',
          background: 'var(--bg-card, #fff)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: 'var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1))',
          padding: '32px',
          border: '1px solid var(--border-color, #e2e8f0)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚠️</div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main, #0f172a)', marginBottom: '8px' }}>
            Gangguan Koneksi Database
          </h2>
          <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.88rem', marginBottom: '24px', lineHeight: 1.5 }}>
            {queryError}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => setRetryKey(k => k + 1)}
              className="btn btn-primary"
              style={{ padding: '8px 18px', fontSize: '0.88rem' }}
            >
              Coba Lagi
            </button>
            <button
              onClick={logout}
              className="btn btn-secondary"
              style={{ padding: '8px 18px', fontSize: '0.88rem' }}
            >
              Keluar Akun
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Navigate to={targetPath || '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Root Redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Admin Routes */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="jamaah" element={<AdminJamaah />} />
            <Route path="jamaah/:id" element={<AdminDetailJamaah />} />
            <Route path="dokumen" element={<AdminDokumen />} />
            <Route path="pembayaran" element={<AdminPembayaran />} />
            <Route path="pembayaran/verifikasi" element={<AdminVerifikasiPembayaran />} />
            <Route path="pembayaran/catat-cash" element={<AdminCatatPembayaranCash />} />
            <Route path="paket" element={<AdminPaket />} />
            <Route path="jadwal" element={<AdminJadwal />} />
          </Route>

          {/* Jamaah Routes */}
          <Route 
            path="/jamaah" 
            element={
              <ProtectedRoute allowedRoles={['jamaah']}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/jamaah/dashboard" replace />} />
            <Route path="dashboard" element={<JamaahDashboard />} />
            <Route path="lengkapi-data" element={<JamaahLengkapiData />} />
            <Route path="profil" element={<JamaahProfil />} />
            <Route path="dokumen" element={<JamaahDokumen />} />
            <Route path="pembayaran" element={<JamaahPembayaran />} />
            <Route path="pembayaran/ajukan" element={<JamaahAjukanPembayaran />} />
            <Route path="jadwal" element={<JamaahJadwal />} />
          </Route>

          {/* Fallback Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
