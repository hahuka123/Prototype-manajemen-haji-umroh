import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogOut, User, ShieldCheck } from 'lucide-react';

export default function Navbar() {
  const { profile, role, logout, isConfigured } = useAuth();

  const displayName = profile?.full_name || 'Pengguna';
  const displayRole = role === 'admin' ? 'Administrator' : 'Jamaah';

  return (
    <header className="top-navbar">
      <div className="navbar-greeting">
        <h3>
          Sistem Manajemen Haji & Umroh
          {!isConfigured && (
            <span style={{
              fontSize: '0.68rem',
              background: '#fef3c7',
              color: '#92400e',
              border: '1px solid #fcd34d',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontWeight: 600
            }}>
              Demo Mode
            </span>
          )}
        </h3>
        <p>Biro Penyelenggara Perjalanan Ibadah Terpadu</p>
      </div>

      <div className="navbar-user-menu">
        <div className="user-badge">
          <div className="user-avatar">
            {role === 'admin' ? <ShieldCheck size={18} /> : <User size={18} />}
          </div>
          <div className="user-details">
            <div className="user-name">{displayName}</div>
            <div className="user-role-tag">{displayRole}</div>
          </div>
        </div>

        <button 
          onClick={logout} 
          className="btn btn-secondary btn-sm"
          title="Keluar dari akun"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <LogOut size={16} />
          <span>Keluar</span>
        </button>
      </div>
    </header>
  );
}
