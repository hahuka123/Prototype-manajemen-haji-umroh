import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, CheckCircle, Info } from 'lucide-react';

export default function AdminCatatPembayaranCash() {
  const navigate = useNavigate();

  // State form
  const [selectedJamaah, setSelectedJamaah] = useState('j-001');
  const [paymentType, setPaymentType] = useState('installment'); // full | installment
  const [nominal, setNominal] = useState('5000000');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('Pembayaran tunai di kantor biro');
  const [isSuccess, setIsSuccess] = useState(false);

  // Mock data jamaah & sisa tagihan
  const sisaTagihan = 15000000;

  function handleTypeChange(type) {
    setPaymentType(type);
    if (type === 'full') {
      // Rule 8: Bayar Penuh mengunci nominal otomatis sebesar sisa tagihan
      setNominal(String(sisaTagihan));
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const num = Number(nominal);

    // Rule 7: Tidak boleh melebihi sisa tagihan
    if (num <= 0 || num > sisaTagihan) {
      alert(`Nominal harus lebih besar dari 0 dan maksimal Rp ${sisaTagihan.toLocaleString('id-ID')}`);
      return;
    }

    // Rule 2 & 17: Cash yang dicatat admin langsung berstatus verified
    setIsSuccess(true);
    setTimeout(() => {
      navigate('/admin/pembayaran');
    }, 1500);
  }

  return (
    <div style={{ maxWidth: '650px', margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Catat Pembayaran Tunai (Cash)</h1>
          <p>Khusus dicatat oleh Admin/Petugas saat jamaah menyerahkan uang fisik di kantor biro travel.</p>
        </div>
      </div>

      <div className="card">
        {/* Banner Rule 2 */}
        <div style={{
          display: 'flex',
          gap: '10px',
          padding: '12px 16px',
          background: 'var(--primary-50)',
          border: '1px solid var(--primary-100)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          color: 'var(--primary-800)',
          fontSize: '0.85rem'
        }}>
          <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Rule Pembayaran Cash:</strong> Transaksi cash yang Anda catat akan <strong>langsung berstatus Terverifikasi (Verified)</strong> dan otomatis mengurangi sisa tagihan jamaah seketika.
          </div>
        </div>

        {isSuccess ? (
          <div style={{ textAlign: 'center', padding: '30px 10px' }}>
            <CheckCircle size={54} color="#10b981" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ marginBottom: '8px' }}>Pembayaran Cash Berhasil Dicatat!</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Status: <strong>Terverifikasi (Verified)</strong>. Mengalihkan ke riwayat transaksi...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Pilih Jamaah</label>
              <select 
                className="form-select"
                value={selectedJamaah}
                onChange={(e) => setSelectedJamaah(e.target.value)}
              >
                <option value="j-001">Ahmad Fauzan (Umrah Reguler 2027 • Sisa: Rp 15.000.000)</option>
                <option value="j-002">Siti Aminah (Umrah Reguler 2027 • Sisa: Rp 25.000.000)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Jenis Pembayaran</label>
              <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="radio"
                    name="cashPaymentType"
                    checked={paymentType === 'installment'}
                    onChange={() => handleTypeChange('installment')}
                  />
                  <span>Cicilan (Sebagian Tagihan)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="radio"
                    name="cashPaymentType"
                    checked={paymentType === 'full'}
                    onChange={() => handleTypeChange('full')}
                  />
                  <span>Bayar Penuh (Pelunasan Otomatis)</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Nominal Pembayaran (Rp)
                {paymentType === 'full' && <span style={{ color: 'var(--primary-600)', fontSize: '0.78rem', marginLeft: '6px' }}>(Otomatis Sisa Tagihan)</span>}
              </label>
              <input
                type="number"
                required
                className="form-input"
                readOnly={paymentType === 'full'}
                value={nominal}
                onChange={(e) => setNominal(e.target.value)}
                min="1000"
                max={sisaTagihan}
              />
              <span className="form-helper">
                Maksimal nominal input: Rp {sisaTagihan.toLocaleString('id-ID')}
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Tanggal Transaksi Tunai</label>
              <input
                type="date"
                required
                className="form-input"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Catatan Kwitansi / Keterangan</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Contoh: Diterima oleh staf kasir kantor pusat"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => navigate('/admin/pembayaran')}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2 }}
              >
                <Banknote size={18} />
                <span>Simpan Transaksi Cash (Verified)</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
