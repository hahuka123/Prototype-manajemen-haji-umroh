import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, Send, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { paymentService } from '../../services/paymentService';
import { jamaahService } from '../../services/jamaahService';
import { installmentService } from '../../services/installmentService';
import { useAuth } from '../../hooks/useAuth';

export default function JamaahAjukanPembayaran() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paramTermId = searchParams.get('term_id');
  const paramTermin = searchParams.get('termin');
  const paramNominal = searchParams.get('nominal');
  const { user, profile } = useAuth();

  const [sisaTagihan, setSisaTagihan] = useState(0);
  const [jamaah, setJamaah] = useState(null);
  const [terms, setTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [termId, setTermId] = useState(paramTermId || null);
  const [loading, setLoading] = useState(true);

  const [paymentType, setPaymentType] = useState('installment'); // 'full' | 'installment'
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('Bank Syariah Indonesia (BSI)');
  const [refNumber, setRefNumber] = useState('');
  const [notes, setNotes] = useState(paramTermin ? `Pembayaran Termin #${paramTermin}` : '');
  const [proofFile, setProofFile] = useState(null);
  const [proofFileName, setProofFileName] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (!profile?.id) {
          throw new Error('Profil pengguna belum tersedia.');
        }
        const j = await jamaahService.getMyJamaah(profile.id);
        setJamaah(j);
        if (j) {
          const sisa = Number(j.sisa_tagihan || 0);
          setSisaTagihan(sisa);

          // Ambil daftar termin resmi milik jamaah yang login
          let tList = [];
          try {
            tList = await installmentService.getTermsByJamaah(j.id);
            setTerms(tList || []);
          } catch (tListErr) {
            console.warn('[AjukanPembayaran] Gagal memuat daftar termin:', tListErr);
          }

          if (paramTermId) {
            setPaymentType('installment');
            try {
              let t = (tList || []).find(item => (item.id === paramTermId || item.term_id === paramTermId));
              if (!t) {
                t = await installmentService.getTermById(paramTermId);
              }
              if (t) {
                if (t.jamaah_id !== j.id) {
                  setErrorMsg('Termin cicilan tidak sesuai dengan data akun Anda.');
                  setTermId(null);
                  setSelectedTerm(null);
                } else {
                  setSelectedTerm(t);
                  setTermId(t.id || t.term_id);
                  const effectiveRemaining = Math.max(
                    0,
                    Number(t.target_amount || 0) - (Number(t.verified_amount || 0) + Number(t.pending_amount || 0))
                  );
                  const remaining = Number(t.remaining_amount || 0);
                  const targetNom = Math.min(effectiveRemaining > 0 ? effectiveRemaining : remaining, sisa);
                  setAmount(String(targetNom));
                  setNotes(`Pembayaran Termin #${t.term_number}: ${t.title}`);
                }
              }
            } catch (tErr) {
              console.warn('[AjukanPembayaran] Gagal memuat data termin:', tErr);
            }
          } else if (paramNominal) {
            setPaymentType('installment');
            const targetNom = Math.min(Number(paramNominal), sisa);
            setAmount(String(targetNom));
            if (paramTermin) {
              setNotes(`Pembayaran Termin #${paramTermin}`);
              const matchingTerm = (tList || []).find(item => Number(item.term_number) === Number(paramTermin));
              if (matchingTerm && matchingTerm.jamaah_id === j.id) {
                setSelectedTerm(matchingTerm);
                setTermId(matchingTerm.id || matchingTerm.term_id);
              }
            }
          } else {
            // Pengajuan cicilan umum: pilih otomatis termin aktif pertama yang belum lunas
            setPaymentType('installment');
            const unpaidTerm = (tList || []).find(item => item.status !== 'paid' && Number(item.remaining_amount || 0) > 0);
            if (unpaidTerm) {
              setSelectedTerm(unpaidTerm);
              setTermId(unpaidTerm.id || unpaidTerm.term_id);
              const effectiveRemaining = Math.max(
                0,
                Number(unpaidTerm.target_amount || 0) - (Number(unpaidTerm.verified_amount || 0) + Number(unpaidTerm.pending_amount || 0))
              );
              const remaining = Number(unpaidTerm.remaining_amount || 0);
              const targetNom = Math.min(effectiveRemaining > 0 ? effectiveRemaining : remaining, sisa);
              setAmount(String(targetNom));
              setNotes(`Pembayaran Termin #${unpaidTerm.term_number}: ${unpaidTerm.title}`);
            } else {
              setTermId(null);
              setSelectedTerm(null);
              setAmount(String(sisa));
            }
          }
        }
      } catch (err) {
        console.error(err);
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile?.id, paramTermId, paramNominal, paramTermin]);

  function handleTypeChange(type) {
    setPaymentType(type);
    setErrorMsg('');
    if (type === 'full') {
      setAmount(String(sisaTagihan));
      setTermId(null);
    } else {
      if (selectedTerm) {
        setTermId(selectedTerm.id || selectedTerm.term_id);
        const effectiveRemaining = Math.max(
          0,
          Number(selectedTerm.target_amount || 0) - (Number(selectedTerm.verified_amount || 0) + Number(selectedTerm.pending_amount || 0))
        );
        const remaining = Number(selectedTerm.remaining_amount || 0);
        setAmount(String(Math.min(effectiveRemaining > 0 ? effectiveRemaining : remaining, sisaTagihan)));
        if (!notes) {
          setNotes(`Pembayaran Termin #${selectedTerm.term_number}: ${selectedTerm.title}`);
        }
      } else {
        const unpaidTerm = (terms || []).find(item => item.status !== 'paid' && Number(item.remaining_amount || 0) > 0);
        if (unpaidTerm) {
          setSelectedTerm(unpaidTerm);
          setTermId(unpaidTerm.id || unpaidTerm.term_id);
          const effectiveRemaining = Math.max(
            0,
            Number(unpaidTerm.target_amount || 0) - (Number(unpaidTerm.verified_amount || 0) + Number(unpaidTerm.pending_amount || 0))
          );
          const remaining = Number(unpaidTerm.remaining_amount || 0);
          setAmount(String(Math.min(effectiveRemaining > 0 ? effectiveRemaining : remaining, sisaTagihan)));
          setNotes(`Pembayaran Termin #${unpaidTerm.term_number}: ${unpaidTerm.title}`);
        } else {
          setAmount(String(sisaTagihan));
        }
      }
    }
  }

  function handleTermSelectChange(e) {
    const chosenId = e.target.value;
    setErrorMsg('');
    if (!chosenId) {
      setTermId(null);
      setSelectedTerm(null);
      return;
    }
    const found = terms.find(t => (t.id === chosenId || t.term_id === chosenId));
    if (found) {
      if (found.jamaah_id !== jamaah.id) {
        setErrorMsg('Termin cicilan tidak sesuai dengan data akun Anda.');
        return;
      }
      setSelectedTerm(found);
      setTermId(found.id || found.term_id);
      const effectiveRemaining = Math.max(
        0,
        Number(found.target_amount || 0) - (Number(found.verified_amount || 0) + Number(found.pending_amount || 0))
      );
      const remaining = Number(found.remaining_amount || 0);
      const targetNom = Math.min(effectiveRemaining > 0 ? effectiveRemaining : remaining, sisaTagihan);
      setAmount(String(targetNom));
      setNotes(`Pembayaran Termin #${found.term_number}: ${found.title}`);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setErrorMsg('Bukti harus JPG, PNG, atau PDF.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Ukuran file maksimal 5 MB.');
      return;
    }

    setProofFile(file);
    setProofFileName(file.name);
    setErrorMsg('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return; // Mencegah double submit
    const num = Number(amount);

    if (isNaN(num) || num <= 0) {
      setErrorMsg('Nominal pembayaran harus lebih besar dari Rp 0.');
      return;
    }

    if (paymentType === 'full') {
      if (num !== Number(sisaTagihan)) {
        setErrorMsg(`Bayar penuh harus sama persis dengan sisa tagihan (Rp ${Number(sisaTagihan).toLocaleString('id-ID')}).`);
        return;
      }
    } else {
      // paymentType === 'installment'
      if (num > Number(sisaTagihan)) {
        setErrorMsg(`Nominal pembayaran (Rp ${num.toLocaleString('id-ID')}) melebihi sisa tagihan paket (Rp ${Number(sisaTagihan).toLocaleString('id-ID')}).`);
        return;
      }

      if (termId && selectedTerm) {
        // Validasi terhadap sisa kewajiban termin via helper
        const termValidation = installmentService.validatePaymentAgainstTerm({
          term: selectedTerm,
          paymentAmount: num
        });
        if (!termValidation.isValid) {
          setErrorMsg(termValidation.error);
          return;
        }

        // Validasi kuota efektif (memperhitungkan pending_amount)
        const target = Number(selectedTerm.target_amount || selectedTerm.amount || 0);
        const verified = Number(selectedTerm.verified_amount || 0);
        const pending = Number(selectedTerm.pending_amount || 0);
        const effectiveRemaining = Math.max(0, target - (verified + pending));

        if (num > effectiveRemaining) {
          setErrorMsg(
            `Nominal pembayaran (Rp ${num.toLocaleString('id-ID')}) melebihi sisa kuota termin ` +
            `(Sisa kuota tersedia setelah memperhitungkan verifikasi tertunda: Rp ${effectiveRemaining.toLocaleString('id-ID')}).`
          );
          return;
        }
      }
    }

    if (!proofFile) {
      setErrorMsg('Bukti transfer wajib diunggah.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      await paymentService.submitTransfer({
        jamaah_id: jamaah.id,
        installment_term_id: paymentType === 'full' ? null : (termId || null),
        jenis: paymentType,
        nominal: num,
        bank_asal: bankName,
        no_referensi: refNumber,
        catatan: notes,
        bukti_file: proofFile
      });
        
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/jamaah/pembayaran');
      }, 1800);
    } catch (err) {
      setErrorMsg(err.message);
      setSubmitting(false);
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
                  <span>Cicilan (Bertahap / Per Termin)</span>
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

            {/* Pemilihan Termin Cicilan (Khusus Jenis Cicilan) */}
            {paymentType === 'installment' && (
              <div className="form-group" style={{ background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                {terms.length === 0 ? (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', color: '#64748b', fontSize: '0.85rem' }}>
                    <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>Belum Ada Jadwal Termin Cicilan Aktif</strong>
                      <div style={{ marginTop: '2px', lineHeight: 1.5 }}>
                        Pihak biro travel belum menetapkan rencana jadwal termin untuk akun Anda. Anda tetap dapat melanjutkan pembayaran cicilan umum (tanpa pengikatan termin) sesuai nominal yang ditransfer.
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <label className="form-label" htmlFor="select-term" style={{ marginBottom: '6px' }}>
                      Alokasi Termin Cicilan
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 400 }}>
                        (Pilih termin yang akan dibayarkan)
                      </span>
                    </label>
                    <select
                      id="select-term"
                      className="form-select"
                      value={termId || ''}
                      onChange={handleTermSelectChange}
                    >
                      <option value="">-- Tanpa Termin (Cicilan Bebas) --</option>
                      {terms.map((t) => {
                        const targetNom = Number(t.target_amount ?? t.amount ?? 0);
                        const verifiedNom = Number(t.verified_amount ?? 0);
                        const remainingNom = Number(t.remaining_amount ?? Math.max(0, targetNom - verifiedNom));
                        const isPaid = t.status === 'paid' || remainingNom <= 0;
                        const dueDateStr = t.due_date ? new Date(t.due_date).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        }) : '-';

                        return (
                          <option
                            key={t.id || t.term_id}
                            value={t.id || t.term_id}
                            disabled={isPaid}
                          >
                            Termin #{t.term_number}: {t.title} — {isPaid ? '[LUNAS]' : `Sisa Rp ${remainingNom.toLocaleString('id-ID')}`} (Jatuh tempo: {dueDateStr})
                          </option>
                        );
                      })}
                    </select>

                    {selectedTerm ? (
                      <div style={{
                        marginTop: '12px',
                        padding: '12px 14px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.83rem',
                        color: '#1e40af'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div>
                            <strong>Termin #{selectedTerm.term_number}: {selectedTerm.title}</strong>
                          </div>
                          <span className="status-badge" style={{ fontSize: '0.72rem', background: '#dbeafe', color: '#1e40af' }}>
                            Jatuh tempo: {selectedTerm.due_date ? new Date(selectedTerm.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginTop: '6px', fontSize: '0.78rem' }}>
                          <div>Target: <strong>Rp {Number(selectedTerm.target_amount ?? selectedTerm.amount ?? 0).toLocaleString('id-ID')}</strong></div>
                          <div>Terbayar Sah: <strong style={{ color: '#047857' }}>Rp {Number(selectedTerm.verified_amount || 0).toLocaleString('id-ID')}</strong></div>
                          <div>Sisa Kewajiban: <strong style={{ color: '#b91c1c' }}>Rp {Number(selectedTerm.remaining_amount || 0).toLocaleString('id-ID')}</strong></div>
                          {Number(selectedTerm.pending_amount || 0) > 0 && (
                            <div style={{ color: '#d97706' }}>Menunggu Verifikasi: <strong>Rp {Number(selectedTerm.pending_amount).toLocaleString('id-ID')}</strong></div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Pilih termin di atas untuk menyelaraskan histori pembayaran dengan target jatuh tempo.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

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
                disabled={submitting}
              >
                <Send size={18} />
                <span>{submitting ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Pembayaran'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
