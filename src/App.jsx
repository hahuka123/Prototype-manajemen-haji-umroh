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
  const { user, profile, role, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [targetPath, setTargetPath] = useState(null);

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
        if (user.id === 'demo-jamaah-id-456' || (typeof user.id === 'string' && user.id.startsWith('demo-'))) {
          setTargetPath('/jamaah/dashboard');
          setChecking(false);
          return;
        }

        try {
          // Ambil data profil jika belum ada di state
          let currentProfile = profile;
          if (!currentProfile) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .maybeSingle();
            currentProfile = profileData;
          }

          // Cek apakah jamaah sudah punya data & memilih package_id serta NIK
          const { data: jamaahData } = await supabase
            .from('jamaah')
            .select('*')
            .eq('profile_id', user.id)
            .maybeSingle();

          const hasNik = Boolean(jamaahData?.nik || jamaahData?.NIK);
          const hasPackage = Boolean(jamaahData?.package_id || jamaahData?.paket_id);

          // Jika belum ada record jamaah ATAU belum memilih paket ATAU belum mengisi NIK
          if (!jamaahData || !hasPackage || !hasNik) {
            setTargetPath('/jamaah/lengkapi-data'); // Arahkan ke form onboarding
          } else {
            setTargetPath('/jamaah/dashboard'); // Arahkan ke dashboard
          }
        } catch (err) {
          console.warn('Error saat memeriksa onboarding jamaah:', err);
          setTargetPath('/jamaah/lengkapi-data');
        } finally {
          setChecking(false);
        }
      } else {
        setTargetPath('/jamaah/dashboard');
        setChecking(false);
      }
    }

    checkJamaahOnboarding();
  }, [user, profile, role, loading]);

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
