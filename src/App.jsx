import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';

// Layout & Proteksi
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Halaman Publik
import Login from './pages/Login';

// Halaman Admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminJamaah from './pages/admin/Jamaah';
import AdminDokumen from './pages/admin/Dokumen';
import AdminPembayaran from './pages/admin/Pembayaran';
import AdminVerifikasiPembayaran from './pages/admin/VerifikasiPembayaran';
import AdminCatatPembayaranCash from './pages/admin/CatatPembayaranCash';
import AdminPaket from './pages/admin/Paket';
import AdminJadwal from './pages/admin/Jadwal';

// Halaman Jamaah
import JamaahDashboard from './pages/jamaah/Dashboard';
import JamaahProfil from './pages/jamaah/Profil';
import JamaahDokumen from './pages/jamaah/Dokumen';
import JamaahPembayaran from './pages/jamaah/Pembayaran';
import JamaahAjukanPembayaran from './pages/jamaah/AjukanPembayaran';
import JamaahJadwal from './pages/jamaah/Jadwal';

// Komponen penentu redirect awal berdasarkan role
function RootRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-app)'
      }}>
        <p>Memuat sesi...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return role === 'admin' 
    ? <Navigate to="/admin/dashboard" replace /> 
    : <Navigate to="/jamaah/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

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
