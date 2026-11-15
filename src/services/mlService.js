import { supabase, isConfigured } from './supabase.js';

export const mlService = {
  /**
   * Mengambil status kesiapan model dan versi aktif dari tabel ml_models.
   * Jika tabel belum tersedia atau belum ada model aktif, mengembalikan status NOT_READY.
   */
  getModelStatus: async () => {
    if (!isConfigured) {
      return {
        isReady: false,
        status: 'NOT_READY',
        message: 'Model prediksi belum tersedia. Sistem menunggu dataset pembayaran yang memadai.',
        model: null
      };
    }

    try {
      const { data, error } = await supabase
        .from('ml_models')
        .select('*')
        .eq('status', 'active')
        .maybeSingle();

      if (error || !data) {
        return {
          isReady: false,
          status: 'NOT_READY',
          message: 'Model prediksi belum tersedia. Sistem menunggu dataset pembayaran yang memadai.',
          model: null
        };
      }

      return {
        isReady: true,
        status: data.status || 'READY',
        message: 'Model prediksi aktif.',
        model: data
      };
    } catch (e) {
      return {
        isReady: false,
        status: 'NOT_READY',
        message: 'Model prediksi belum tersedia. Sistem menunggu dataset pembayaran yang memadai.',
        model: null
      };
    }
  },

  /**
   * Mengambil daftar prediksi risiko keterlambatan cicilan aktif (khusus Admin).
   * Hanya menampilkan data jika model valid dan tersedia di database.
   */
  getRiskPredictions: async () => {
    if (!isConfigured) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('ml_predictions')
        .select(`
          id,
          risk_score,
          risk_level,
          model_version,
          predicted_at,
          term_id,
          jamaah_id,
          jamaah:jamaah_id (
            id,
            full_name,
            nik,
            paket_id
          ),
          term:term_id (
            id,
            term_number,
            title,
            amount,
            due_date,
            status
          )
        `)
        .order('risk_score', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data;
    } catch (e) {
      return [];
    }
  }
};
