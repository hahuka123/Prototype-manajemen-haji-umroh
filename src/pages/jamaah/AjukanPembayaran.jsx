import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Send, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { paymentService } from '../../services/paymentService';
import { jamaahService } from '../../services/jamaahService';

export default function JamaahAjukanPembayaran() {
  const navigate = useNavigate();

  const [sisaTagihan, setSisaTagihan] = useState(0);
  const [jamaah, setJamaah] = useState(null);
  const [loading, setLoading] = useState(true);

  const [paymentType, setPaymentType] = useState('installment'); // 'full' | 'installment'
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('Bank Syariah Indonesia (BSI)');
  const [refNumber, setRefNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [proofFileName, setProofFileName] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const j = await jamaahService.getJamaahById(1);
        setJamaah(j);
        setSisaTagihan(j.sisa_tagihan);
        setAmount('5000000'); // default
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  function handleTypeChange(type) {
    setPaymentType(type);
    setErrorMsg('');
    if (type === 'full') {
      // Rule 8: Bayar Penuh otomatis mengunci nominal sebesar sisa tagihan
      setAmount(String(sisaTagihan));
    }
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Ukuran file maksimal 5 MB.');
        return;
      }
      setProofFileName(file.name);
      setErrorMsg('');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const num = Number(amount);

    // Rule 7 & Validasi: 0 < Nominal <= Sisa Tagihan
    if (num <= 0) {
      setErrorMsg('Nominal pembayaran harus lebih besar dari Rp 0.');
      return;
    }

    if (num > sisaTagihan) {
      setErrorMsg(`Nominal pembayaran melebihi sisa tagihan (Maksimal Rp ${sisaTagihan.toLocaleString('id-ID')}).`);
      return;
    }

    if (!proofFileName) {
      setErrorMsg('Wajib mengunggah bukti struk transfer pembayaran.');
      return;
    }

    try {
        await paymentService.submitTransfer({
            jamaah_id: 1, // Assuming logged in user is 1
            jenis: paymentType,
            nominal: num,
            bank_asal: bankName,
            no_referensi: refNumber,
            catatan: notes,
            bukti_url: proofFileName // just mock
        });
        
        setIsSuccess(true);
        setTimeout(() => {
          navigate('/jamaah/pembayaran');
        }, 1800);
    } catch (err) {
        setErrorMsg(err.message);
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!jamaah) return <div className="p-8 text-center">Data Jamaah tidak ditemukan.</div>;

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Ajukan Pembayaran Transfer Bank</h1>
          <p>Kirimkan konfirmasi transfer pembayaran paket ibadah beserta bukti struk transaksi.</p>
        </div>
      </div>

      <div className="card">
        {/* Banner Info Sisa Tagihan */}
        <div style={{
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '1px solid var(--border-color)'
        }}>
          <div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Sisa Tagihan Paket Saat Ini</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary-800)' }}>
              Rp {sisaTagihan.toLocaleString('id-ID')}
            </div>
          </div>
          <span className={`status-badge ${jamaah.status_pembayaran === 'Lunas' ? 'verified' : 'pending'}`}>
            Status: {jamaah.status_pembayaran}
          </span>
        </div>

        {sisaTagihan === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px' }}>
                <CheckCircle size={56} color="#10b981" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ marginBottom: '8px' }}>Tagihan Sudah Lunas</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Anda tidak memiliki tagihan aktif saat ini.</p>
                <button className="btn btn-primary mt-4" onClick={() => navigate('/jamaah/dashboard')}>Kembali ke Dashboard</button>
            </div>
        ) : isSuccess ? (
          <div style={{ textAlign: 'center', padding: '36px 16px' }}>
            <CheckCircle size={56} color="#10b981" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ marginBottom: '8px' }}>Pengajuan Pembayaran Terkirim!</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '450px', margin: '0 auto' }}>
              Status transaksi Anda saat ini adalah <strong>Menunggu Verifikasi</strong>. Admin biro perjalanan akan memeriksa mutasi bank dan memvalidasi pembayaran Anda.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {errorMsg && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)',
                color: '#b91c1c',
                fontSize: '0.85rem',
                marginBottom: '20px'
              }}>
                <AlertCircle size={18} />
                <span>{errorMsg}</span>
              </div>
            )}
            
            {/* Pilihan Jenis Pembayaran */}
            <div className="form-group">
              <label className="form-label">Jenis Pembayaran</label>
              <div style={{ display: 'flex', gap: '20px', marginTop: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.92rem' }}>
                  <input
                    type="radio"
                    name="paymentType"
                    checked={paymentType === 'installment'}
                    onChange={() => handleTypeChange('installment')}
                  />
                  <span>Cicilan (Sebagian dari sisa tagihan)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.92rem' }}>
                  <input
                    type="radio"
                    name="paymentType"
                    checked={paymentType === 'full'}
                    onChange={() => handleTypeChange('full')}
                  />
                  <span>Bayar Penuh (Pelunasan total)</span>
                </label>
              </div>
            </div>

            {/* Nominal Pembayaran */}
            <div className="form-group">
              <label className="form-label">
                Nominal Transfer (Rp)
                {paymentType === 'full' && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--primary-600)', marginLeft: '6px' }}>
                    (Terkunci otomatis sebesar sisa tagihan)
                  </span>
                )}
              </label>
              <input
                type="number"
                required
                className="form-input"
                readOnly={paymentType === 'full'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1000"
                max={sisaTagihan}
              />
              <span className="form-helper">
                {paymentType === 'installment' ? 'Masukkan nominal cicilan yang Anda transfer' : 'Nominal otomatis sama persis dengan sisa tagihan'}
              </span>
            </div>

            {/* Rekening Tujuan */}
            <div className="form-group">
              <label className="form-label">Rekening Bank Tujuan Biro Travel</label>
              <select
                className="form-select"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              >
                <option value="Bank Syariah Indonesia (BSI)">BSI (Bank Syariah Indonesia) - No. Rek: 7123-4567-89 (a.n PT Travel Haji)</option>
                <option value="Bank Mandiri">Bank Mandiri - No. Rek: 137-00-1234567-8 (a.n PT Travel Haji)</option>
                <option value="Bank BCA">Bank BCA - No. Rek: 882-0192837 (a.n PT Travel Haji)</option>
              </select>
            </div>

            {/* Nomor Referensi */}
            <div className="form-group">
              <label className="form-label">Nomor Referensi Transfer / No. Resi</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Contoh: TRX-1298492 atau 20260930001"
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
              />
            </div>

            {/* Upload Bukti Struk */}
            <div className="form-group">
              <label className="form-label">Upload Bukti Transfer (Struk / Screenshot)</label>
              <div style={{
                border: '2px dashed var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                textAlign: 'center',
                background: 'var(--bg-subtle)',
                cursor: 'pointer'
              }}>
                <input
                  type="file"
                  id="proof-upload"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <label htmlFor="proof-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <Upload size={28} color="var(--primary-600)" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    {proofFileName || 'Klik di sini untuk memilih file bukti transfer'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Mendukung JPG, PNG, atau PDF (Maks. 5 MB)
                  </span>
                </label>
              </div>
            </div>

            {/* Catatan Tambahan */}
            <div className="form-group">
              <label className="form-label">Catatan Tambahan (Opsional)</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Contoh: Transfer atas nama rekening Ahmad Fauzan dari Bank BSI"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => navigate('/jamaah/pembayaran')}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-accent"
                style={{ flex: 2 }}
              >
                <Send size={18} />
                <span>Kirim Pengajuan Pembayaran</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
