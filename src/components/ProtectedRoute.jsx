import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AlertCircle, LogOut, ShieldAlert } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, role, loading, profileError, logout } = useAuth();
  const location = useLocation();

  // 1. Tampilkan loading spinner saat memverifikasi sesi dan profil
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
        background: 'var(--bg-app)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--primary-600)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Memverifikasi sesi & role pengguna...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // 2. Jika belum login, redirect ke halaman login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Jika pengguna terotentikasi tetapi tidak memiliki profil di tabel profiles atau role tidak dikenal
  if (!role || (role !== 'admin' && role !== 'jamaah')) {
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
          maxWidth: '520px',
          width: '100%',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: '32px',
          border: '1px solid var(--border-color)',
          textAlign: 'center'
        }}>
          <ShieldAlert size={48} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.35rem', color: 'var(--text-main)', marginBottom: '8px' }}>
            Akses Ditolak: Profil Belum Terhubung
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.5 }}>
            {profileError || 'Akun Anda berhasil terautentikasi, namun belum memiliki profil dengan role resmi (Admin/Jamaah) di tabel profiles database.'}
          </p>

          <div style={{
            background: 'var(--bg-app)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            textAlign: 'left',
            marginBottom: '24px',
            border: '1px solid var(--border-color)',
            lineHeight: 1.6
          }}>
            <div><strong>User ID:</strong> <code>{user.id}</code></div>
            <div><strong>Email:</strong> {user.email || '-'}</div>
            <div><strong>Status Profil:</strong> {profile ? `Role: ${profile.role || 'kosong'}` : 'Tidak ditemukan di tabel profiles'}</div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={logout}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <LogOut size={16} />
              <span>Keluar Akun</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Jika role tidak sesuai hak akses rute (misal: Jamaah membuka /admin atau sebaliknya)
  if (allowedRoles && !allowedRoles.includes(role)) {
    if (role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (role === 'jamaah') {
      return <Navigate to="/jamaah/dashboard" replace />;
    } else {
      return <Navigate to="/login" replace />;
    }
  }

  return children;
}
