import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { documentService, REQUIRED_DOCUMENTS } from '../src/services/documentService.js';
import { mapJamaah } from '../src/services/jamaahService.js';

describe('Verifikasi Status Dokumen Jamaah (Haji & Umrah)', () => {
  // Mock data 6 dokumen wajib
  const createAllApprovedDocs = (jamaahId = 'j-001') => [
    { id: '1', jamaah_id: jamaahId, document_type: 'ktp', status: 'Lengkap', verified_at: '2026-10-10T10:00:00Z' },
    { id: '2', jamaah_id: jamaahId, document_type: 'kk', status: 'Lengkap', verified_at: '2026-10-10T10:00:00Z' },
    { id: '3', jamaah_id: jamaahId, document_type: 'passport', status: 'Lengkap', verified_at: '2026-10-10T10:00:00Z' },
    { id: '4', jamaah_id: jamaahId, document_type: 'foto', status: 'Lengkap', verified_at: '2026-10-10T10:00:00Z' },
    { id: '5', jamaah_id: jamaahId, document_type: 'buku-nikah', status: 'Lengkap', verified_at: '2026-10-10T10:00:00Z' },
    { id: '6', jamaah_id: jamaahId, document_type: 'kesehatan', status: 'Lengkap', verified_at: '2026-10-10T10:00:00Z' },
  ];

  it('1. Kondisi Seluruh Dokumen Wajib Disetujui Admin: status harus "Dokumen Terverifikasi"', () => {
    const docs = createAllApprovedDocs();
    const status = documentService.determineVerificationStatus(docs);
    assert.equal(status, 'Dokumen Terverifikasi');

    const progress = documentService.calculateProgress(docs);
    assert.equal(progress.persentase, 100);
    assert.equal(progress.lengkap, 6);
    assert.equal(progress.statusLabel, 'Lengkap');

    // Uji pemetaan ke record jamaah (kasus nyata: kelengkapan 100% dan ada sisa tagihan)
    const rawJamaah = {
      jamaah_id: 'j-001',
      full_name: 'hasud',
      sisa_tagihan: 25000000,
      total_terbayar: 15000000,
      package_price: 40000000,
      persentase_dokumen: 100,
      dokumen_lengkap: 6,
    };
    const mapped = mapJamaah(rawJamaah, docs);
    assert.equal(mapped.status, 'Dokumen Terverifikasi');
    assert.equal(mapped.status_keberangkatan, 'Dokumen Terverifikasi');
  });

  it('2. Kondisi Masih Menunggu Verifikasi: status harus "Dokumen Diproses"', () => {
    const docs = [
      { id: '1', document_type: 'ktp', status: 'Lengkap' },
      { id: '2', document_type: 'kk', status: 'Lengkap' },
      { id: '3', document_type: 'passport', status: 'Lengkap' },
      { id: '4', document_type: 'foto', status: 'Lengkap' },
      { id: '5', document_type: 'buku-nikah', status: 'Lengkap' },
      { id: '6', document_type: 'kesehatan', status: 'Menunggu Verifikasi' },
    ];
    const status = documentService.determineVerificationStatus(docs);
    assert.equal(status, 'Dokumen Diproses');

    const rawJamaah = {
      jamaah_id: 'j-002',
      full_name: 'Ahmad',
      sisa_tagihan: 20000000,
    };
    const mapped = mapJamaah(rawJamaah, docs);
    assert.equal(mapped.status, 'Dokumen Diproses');
    assert.equal(mapped.status_keberangkatan, 'Dokumen Diproses');
  });

  it('3. Kondisi Terdapat Dokumen yang Ditolak: status harus "Perlu Perbaikan"', () => {
    const docs = [
      { id: '1', document_type: 'ktp', status: 'Lengkap' },
      { id: '2', document_type: 'kk', status: 'Lengkap' },
      { id: '3', document_type: 'passport', status: 'Lengkap' },
      { id: '4', document_type: 'foto', status: 'Lengkap' },
      { id: '5', document_type: 'buku-nikah', status: 'Lengkap' },
      { id: '6', document_type: 'kesehatan', status: 'Ditolak', notes: 'Surat dokter buram, mohon upload ulang.' },
    ];
    const status = documentService.determineVerificationStatus(docs);
    assert.equal(status, 'Perlu Perbaikan');

    const rawJamaah = {
      jamaah_id: 'j-003',
      full_name: 'Siti',
      sisa_tagihan: 0,
    };
    const mapped = mapJamaah(rawJamaah, docs);
    assert.equal(mapped.status, 'Perlu Perbaikan');
    assert.equal(mapped.status_keberangkatan, 'Perlu Perbaikan');
  });

  it('4. Kondisi Kombinasi Ditolak dan Menunggu Verifikasi: prioritas tetap "Perlu Perbaikan"', () => {
    const docs = [
      { id: '1', document_type: 'ktp', status: 'Lengkap' },
      { id: '2', document_type: 'kk', status: 'Ditolak', notes: 'KK tidak terbaca' },
      { id: '3', document_type: 'passport', status: 'Menunggu Verifikasi' },
      { id: '4', document_type: 'foto', status: 'Lengkap' },
      { id: '5', document_type: 'buku-nikah', status: 'Lengkap' },
      { id: '6', document_type: 'kesehatan', status: 'Belum Ada' },
    ];
    const status = documentService.determineVerificationStatus(docs);
    assert.equal(status, 'Perlu Perbaikan');
  });

  it('5. Kondisi Dokumen Belum Ada: status harus "Pendaftaran"', () => {
    const docs = [
      { id: '1', document_type: 'ktp', status: 'Belum Ada' },
      { id: '2', document_type: 'kk', status: 'Belum Ada' },
      { id: '3', document_type: 'passport', status: 'Belum Ada' },
      { id: '4', document_type: 'foto', status: 'Belum Ada' },
      { id: '5', document_type: 'buku-nikah', status: 'Belum Ada' },
      { id: '6', document_type: 'kesehatan', status: 'Belum Ada' },
    ];
    const status = documentService.determineVerificationStatus(docs);
    assert.equal(status, 'Pendaftaran');

    const rawJamaah = {
      jamaah_id: 'j-005',
      full_name: 'Baru Daftar',
      sisa_tagihan: 40000000,
    };
    const mapped = mapJamaah(rawJamaah, docs);
    assert.equal(mapped.status, 'Pendaftaran');
  });

  it('6. Anti-Bypass / Verifiable: Dokumen tidak otomatis disetujui tanpa 6 berkas wajib berstatus Lengkap', () => {
    // Hanya 3 dokumen lengkap dari 6 berkas wajib (50%)
    const docs3 = [
      { id: '1', document_type: 'ktp', status: 'Lengkap' },
      { id: '2', document_type: 'kk', status: 'Lengkap' },
      { id: '3', document_type: 'passport', status: 'Lengkap' },
      { id: '4', document_type: 'foto', status: 'Belum Ada' },
      { id: '5', document_type: 'buku-nikah', status: 'Belum Ada' },
      { id: '6', document_type: 'kesehatan', status: 'Belum Ada' },
    ];
    const status = documentService.determineVerificationStatus(docs3);
    assert.equal(status, 'Dokumen Diproses');
    assert.notEqual(status, 'Dokumen Terverifikasi');

    // Dokumen palsu/luar ketentuan tidak dihitung ke 6 berkas wajib
    const docsWithExtra = [
      ...docs3,
      { id: '7', document_type: 'ijazah', status: 'Lengkap' },
      { id: '8', document_type: 'sim', status: 'Lengkap' },
      { id: '9', document_type: 'npwp', status: 'Lengkap' },
    ];
    const statusExtra = documentService.determineVerificationStatus(docsWithExtra);
    assert.equal(statusExtra, 'Dokumen Diproses');
    assert.notEqual(statusExtra, 'Dokumen Terverifikasi');
  });

  it('7. Preservasi Status Keberangkatan Pasca-Berangkat', () => {
    const docs = createAllApprovedDocs();
    const rawJamaah = {
      jamaah_id: 'j-007',
      full_name: 'Sudah Berangkat',
      status: 'Sudah Berangkat',
      status_keberangkatan: 'Sudah Berangkat',
      sisa_tagihan: 0,
      total_terbayar: 40000000,
    };
    const mapped = mapJamaah(rawJamaah, docs);
    assert.equal(mapped.status, 'Sudah Berangkat');
    assert.equal(mapped.status_keberangkatan, 'Sudah Berangkat');
  });
});
