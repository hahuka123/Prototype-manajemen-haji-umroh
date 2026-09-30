import React from 'react';
import { CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';

export default function PaymentStatusBadge({ status, textOverride }) {
  if (!status) return null;

  const normalized = String(status).toLowerCase();

  let className = 'status-badge neutral';
  let icon = null;
  let label = textOverride || status;

  if (normalized === 'verified' || normalized === 'terverifikasi' || normalized === 'lunas' || normalized === 'lengkap') {
    className = 'status-badge verified';
    icon = <CheckCircle2 size={13} />;
    label = textOverride || (normalized === 'verified' ? 'Terverifikasi' : status);
  } else if (normalized === 'pending' || normalized === 'menunggu verifikasi' || normalized === 'cicilan' || normalized === 'hampir lengkap') {
    className = 'status-badge pending';
    icon = <Clock size={13} />;
    label = textOverride || (normalized === 'pending' ? 'Menunggu Verifikasi' : status);
  } else if (normalized === 'rejected' || normalized === 'ditolak' || normalized === 'belum bayar') {
    className = 'status-badge rejected';
    icon = <XCircle size={13} />;
    label = textOverride || (normalized === 'rejected' ? 'Ditolak' : status);
  } else {
    className = 'status-badge neutral';
    icon = <AlertCircle size={13} />;
  }

  return (
    <span className={className}>
      {icon}
      <span>{label}</span>
    </span>
  );
}
