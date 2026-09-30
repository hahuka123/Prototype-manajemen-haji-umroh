import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  LayoutDashboard, 
  Users, 
  FileCheck2, 
  CreditCard, 
  CheckSquare, 
  Banknote, 
  Package, 
  CalendarDays, 
  UserCircle2, 
  Send
} from 'lucide-react';

export default function Sidebar() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="sidebar-logo">🕋</div>
        <div>
          <div className="sidebar-title">Haji & Umroh</div>
          <div className="sidebar-subtitle">
            {isAdmin ? 'Portal Administrasi' : 'Portal Jamaah'}
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav">
        {isAdmin ? (
          <>
            <div className="sidebar-section-title">Menu Utama</div>
            <NavLink 
              to="/admin/dashboard" 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <LayoutDashboard size={19} />
              <span>Dashboard Admin</span>
            </NavLink>

            <NavLink 
              to="/admin/jamaah" 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Users size={19} />
              <span>Data Jamaah</span>
            </NavLink>

            <NavLink 
              to="/admin/dokumen" 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <FileCheck2 size={19} />
              <span>Verifikasi Dokumen</span>
            </NavLink>

            <div className="sidebar-section-title">Keuangan</div>
            <NavLink 
              to="/admin/pembayaran" 
              end
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <CreditCard size={19} />
              <span>Semua Transaksi</span>
            </NavLink>

            <NavLink 
              to="/admin/pembayaran/verifikasi" 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <CheckSquare size={19} />
              <span>Verifikasi Transfer</span>
            </NavLink>

            <NavLink 
              to="/admin/pembayaran/catat-cash" 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Banknote size={19} />
              <span>Catat Bayar Cash</span>
            </NavLink>

            <div className="sidebar-section-title">Operasional</div>
            <NavLink 
              to="/admin/paket" 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Package size={19} />
              <span>Paket Perjalanan</span>
            </NavLink>

            <NavLink 
              to="/admin/jadwal" 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <CalendarDays size={19} />
              <span>Jadwal Keberangkatan</span>
            </NavLink>
          </>
        ) : (
          <>
            <div className="sidebar-section-title">Menu Jamaah</div>
            <NavLink 
              to="/jamaah/dashboard" 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <LayoutDashboard size={19} />
              <span>Dashboard Saya</span>
            </NavLink>

            <NavLink 
              to="/jamaah/profil" 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <UserCircle2 size={19} />
              <span>Profil Pribadi</span>
            </NavLink>

            <NavLink 
              to="/jamaah/dokumen" 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <FileCheck2 size={19} />
              <span>Dokumen Persyaratan</span>
            </NavLink>

            <div className="sidebar-section-title">Pembayaran</div>
            <NavLink 
              to="/jamaah/pembayaran" 
              end
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <CreditCard size={19} />
              <span>Rincian Tagihan</span>
            </NavLink>

            <NavLink 
              to="/jamaah/pembayaran/ajukan" 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Send size={19} />
              <span>Ajukan Transfer Bank</span>
            </NavLink>

            <div className="sidebar-section-title">Perjalanan</div>
            <NavLink 
              to="/jamaah/jadwal" 
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <CalendarDays size={19} />
              <span>Jadwal Agenda Ibadah</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer Info */}
      <div className="sidebar-footer">
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
          Prototipe v2.0 • Supabase RLS
        </div>
      </div>
    </aside>
  );
}
