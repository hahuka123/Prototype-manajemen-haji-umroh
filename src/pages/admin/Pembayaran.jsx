import React from 'react';
import PaymentStatusBadge from '../../components/PaymentStatusBadge';
import { Plus, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminPembayaran() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Riwayat Transaksi Keuangan</h1>
          <p>Catatan seluruh pembayaran paket haji dan umroh baik melalui transfer bank maupun tunai (cash).</p>
        </div>
        <div>
          <Link to="/admin/pembayaran/catat-cash" className="btn btn-primary">
            <Plus size={18} />
            <span>Catat Pembayaran Cash</span>
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Nama Jamaah</th>
                <th>Jenis</th>
                <th>Metode</th>
                <th>Nominal</th>
                <th>Status</th>
                <th>Pemeriksa</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>30/09/2026</td>
                <td style={{ fontWeight: 600 }}>Ahmad Fauzan</td>
                <td>Cicilan</td>
                <td>Transfer (BSI)</td>
                <td style={{ fontWeight: 700 }}>Rp 7.000.000</td>
                <td><PaymentStatusBadge status="pending" /></td>
                <td>-</td>
              </tr>
              <tr>
                <td>20/09/2026</td>
                <td style={{ fontWeight: 600 }}>Ahmad Fauzan</td>
                <td>Cicilan</td>
                <td>Transfer (BCA)</td>
                <td style={{ fontWeight: 700 }}>Rp 5.000.000</td>
                <td><PaymentStatusBadge status="rejected" /></td>
                <td>Admin Biro (Bukti buram)</td>
              </tr>
              <tr>
                <td>10/09/2026</td>
                <td style={{ fontWeight: 600 }}>Ahmad Fauzan</td>
                <td>Cicilan</td>
                <td>Cash</td>
                <td style={{ fontWeight: 700 }}>Rp 3.000.000</td>
                <td><PaymentStatusBadge status="verified" /></td>
                <td>Ustadz Ahmad (Kasir)</td>
              </tr>
              <tr>
                <td>01/09/2026</td>
                <td style={{ fontWeight: 600 }}>Ahmad Fauzan</td>
                <td>Cicilan</td>
                <td>Transfer (BSI)</td>
                <td style={{ fontWeight: 700 }}>Rp 5.000.000</td>
                <td><PaymentStatusBadge status="verified" /></td>
                <td>Ustadz Ahmad</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
