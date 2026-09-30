import React from 'react';

export default function DocumentStatusBadge({ status }) {
    const getStatusColor = () => {
        switch (status) {
            case 'Lengkap':
                return 'bg-green-100 text-green-800';
            case 'Pending':
            case 'Diproses':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
            {status || 'Belum Ada'}
        </span>
    );
}