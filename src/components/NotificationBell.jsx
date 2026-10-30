import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  CheckCheck, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  CreditCard,
  Banknote,
  FileText,
  X 
} from 'lucide-react';
import { notificationService } from '../services/notificationService';
import { useAuth } from '../hooks/useAuth';

export default function NotificationBell() {
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const profileId = profile?.id;

  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const dropdownRef = useRef(null);
  const currentProfileIdRef = useRef(profileId);

  // Perbarui ref saat profileId berubah
  useEffect(() => {
    currentProfileIdRef.current = profileId;
  }, [profileId]);

  // Reset state dan ambil jumlah unread saat awal atau saat profileId berganti
  useEffect(() => {
    // 1. Reset seketika saat akun berganti
    setNotifications([]);
    setUnreadCount(0);
    setIsOpen(false);
    setError(null);
    setLoading(false);

    if (!profileId) return;

    let isMounted = true;
    const activeId = profileId;

    const fetchUnread = async () => {
      try {
        const count = await notificationService.getUnreadCount(activeId);
        // Pastikan akun belum berganti dan komponen masih mounted
        if (isMounted && currentProfileIdRef.current === activeId) {
          setUnreadCount(count);
        }
      } catch (e) {
        if (isMounted && currentProfileIdRef.current === activeId) {
          console.warn('Gagal memuat unread count notifikasi:', e);
        }
      }
    };

    const fetchList = async () => {
      try {
        const data = await notificationService.getNotifications(activeId);
        if (isMounted && currentProfileIdRef.current === activeId) {
          setNotifications(data || []);
        }
      } catch (e) {
        // Ignore
      }
    };

    fetchUnread();

    // Event listener untuk sinkronisasi real-time instan tanpa refresh
    const handleNotificationUpdate = () => {
      if (isMounted && currentProfileIdRef.current === activeId) {
        fetchUnread();
        fetchList();
      }
    };

    window.addEventListener('notification-updated', handleNotificationUpdate);
    window.addEventListener('storage', handleNotificationUpdate);

    // Polling background setiap 6 detik
    const interval = setInterval(fetchUnread, 6000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('notification-updated', handleNotificationUpdate);
      window.removeEventListener('storage', handleNotificationUpdate);
    };
  }, [profileId]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Ambil daftar notifikasi lengkap saat dropdown dibuka
  const handleToggle = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    if (nextState && profileId) {
      const activeId = profileId;
      try {
        setLoading(true);
        setError(null);
        const data = await notificationService.getNotifications(activeId);
        // Cegah race condition jika akun berganti saat request berlangsung
        if (currentProfileIdRef.current === activeId) {
          setNotifications(data || []);
        }
      } catch (err) {
        if (currentProfileIdRef.current === activeId) {
          setError('Gagal memuat daftar notifikasi.');
        }
      } finally {
        if (currentProfileIdRef.current === activeId) {
          setLoading(false);
        }
      }
    }
  };

  const handleMarkAsRead = async (id, isRead) => {
    if (isRead) return;
    try {
      await notificationService.markAsRead(id, profileId);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.warn('Gagal menandai notifikasi dibaca:', e);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    try {
      await notificationService.markAllAsRead(profileId);
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (e) {
      console.warn('Gagal menandai semua dibaca:', e);
    }
  };

  const renderIcon = (type) => {
    switch (type) {
      case 'payment_verified':
      case 'document_verified':
        return <CheckCircle size={18} style={{ color: 'var(--success-color, #10b981)', flexShrink: 0 }} />;
      case 'payment_rejected':
      case 'document_rejected':
        return <XCircle size={18} style={{ color: 'var(--danger-color, #ef4444)', flexShrink: 0 }} />;
      case 'payment_submitted':
      case 'payment_cash':
        return <CreditCard size={18} style={{ color: 'var(--primary-color, #0284c7)', flexShrink: 0 }} />;
      case 'admin_new_payment':
        return <CreditCard size={18} style={{ color: '#0284c7', flexShrink: 0 }} />;
      case 'admin_new_document':
      case 'document_submitted':
        return <FileText size={18} style={{ color: '#d97706', flexShrink: 0 }} />;
      case 'due_h7':
      case 'due_h1':
        return <Clock size={18} style={{ color: 'var(--warning-color, #f59e0b)', flexShrink: 0 }} />;
      case 'overdue':
        return <AlertTriangle size={18} style={{ color: 'var(--danger-color, #ef4444)', flexShrink: 0 }} />;
      default:
        return <Bell size={18} style={{ color: 'var(--text-muted, #64748b)', flexShrink: 0 }} />;
    }
  };

  const handleItemClick = (item) => {
    handleMarkAsRead(item.id, item.is_read);
    setIsOpen(false);

    if (role === 'admin') {
      if (item.type === 'admin_new_payment' || item.type === 'payment_submitted') {
        navigate('/admin/pembayaran/verifikasi');
      } else if (item.type === 'admin_new_document' || item.type === 'document_submitted') {
        navigate('/admin/dokumen');
      }
    } else if (role === 'jamaah') {
      if (item.type?.startsWith('payment') || item.type?.startsWith('due') || item.type === 'overdue') {
        navigate('/jamaah/pembayaran');
      } else if (item.type?.startsWith('document')) {
        navigate('/jamaah/dokumen');
      }
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const diffMs = Date.now() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMin < 2) return 'Baru saja';
      if (diffMin < 60) return `${diffMin} mnt lalu`;
      if (diffHours < 24) return `${diffHours} jam lalu`;
      if (diffDays < 7) return `${diffDays} hari lalu`;
      return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Tombol Lonceng */}
      <button
        onClick={handleToggle}
        className="btn btn-secondary btn-sm"
        style={{
          position: 'relative',
          padding: '8px 10px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isOpen ? 'var(--bg-subtle, #f1f5f9)' : 'transparent',
          border: '1px solid var(--border-color, #e2e8f0)',
          cursor: 'pointer',
          overflow: 'visible'
        }}
        title="Notifikasi"
        aria-label="Buka notifikasi"
      >
        <Bell size={18} style={{ color: 'var(--text-main, #0f172a)' }} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 800,
              minWidth: '20px',
              height: '20px',
              padding: '0 5px',
              borderRadius: '9999px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              border: '2px solid #ffffff',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.45)',
              zIndex: 10,
              pointerEvents: 'none'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '360px',
            maxWidth: '90vw',
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)',
            border: '1px solid var(--border-color, #e2e8f0)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header Panel */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-subtle, #f8fafc)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main, #0f172a)' }}>
                Notifikasi
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontWeight: 600
                  }}
                >
                  {unreadCount} baru
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-color, #0284c7)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 4px'
                  }}
                  title="Tandai semua telah dibaca"
                >
                  <CheckCheck size={14} />
                  <span>Semua dibaca</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #64748b)',
                  cursor: 'pointer',
                  padding: '2px'
                }}
                title="Tutup"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body Daftar Notifikasi */}
          <div
            style={{
              maxHeight: '380px',
              overflowY: 'auto',
              padding: 0,
              margin: 0
            }}
          >
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: '0.88rem' }}>
                Memuat notifikasi...
              </div>
            ) : error ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#b91c1c', fontSize: '0.85rem' }}>
                {error}
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                <Bell size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <p style={{ fontSize: '0.88rem', margin: 0, fontWeight: 500 }}>Belum ada notifikasi.</p>
                <p style={{ fontSize: '0.78rem', marginTop: '4px', opacity: 0.8 }}>
                  Pemberitahuan pembayaran dan jadwal akan muncul di sini.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-color, #f1f5f9)',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    backgroundColor: item.is_read ? 'transparent' : 'rgba(2, 132, 199, 0.04)',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{ marginTop: '2px' }}>{renderIcon(item.type)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: '6px',
                        marginBottom: '3px'
                      }}
                    >
                      <span
                        style={{
                          fontWeight: item.is_read ? 500 : 700,
                          fontSize: '0.86rem',
                          color: 'var(--text-main, #0f172a)'
                        }}
                      >
                        {item.title}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-muted, #94a3b8)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {formatTimeAgo(item.created_at)}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.80rem',
                        color: 'var(--text-muted, #475569)',
                        lineHeight: 1.45,
                        wordBreak: 'break-word'
                      }}
                    >
                      {item.message}
                    </p>
                  </div>
                  {!item.is_read && (
                    <div
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-color, #0284c7)',
                        marginTop: '6px',
                        flexShrink: 0
                      }}
                      title="Belum dibaca"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
