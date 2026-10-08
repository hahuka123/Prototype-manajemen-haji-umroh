import React from 'react';
import { CheckCircle2, Clock, XCircle, FileQuestion } from 'lucide-react';

export default function DocumentStatusBadge({ status }) {
  if (!status) return null;

  const normalized = String(status).toLowerCase();

  if (normalized === 'lengkap' || normalized === 'verified') {
    return (
      <span className="status-badge verified" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <CheckCircle2 size={12} />
        <span>Lengkap</span>
      </span>
    );
  }

  if (normalized === 'menunggu verifikasi' || normalized === 'pending') {
    return (
      <span className="status-badge pending" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <Clock size={12} />
        <span>Menunggu Verifikasi</span>
      </span>
    );
  }

  if (normalized === 'ditolak' || normalized === 'rejected') {
    return (
      <span className="status-badge rejected" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <XCircle size={12} />
        <span>Ditolak</span>
      </span>
    );
  }

  return (
    <span className="status-badge" style={{ backgroundColor: '#e2e8f0', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <FileQuestion size={12} />
      <span>Belum Ada</span>
    </span>
  );
}
