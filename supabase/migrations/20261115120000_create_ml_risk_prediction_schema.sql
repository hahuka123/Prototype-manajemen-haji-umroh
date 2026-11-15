-- ========================================================
-- MIGRASI LOKAL: Skema Database Machine Learning Prediksi Risiko Keterlambatan Cicilan
-- File: supabase/migrations/20261115120000_create_ml_risk_prediction_schema.sql
-- ========================================================
-- Tujuan:
-- 1. Menyimpan metadata versi model dan parameter bobot terlatih (public.ml_models).
-- 2. Menyimpan rekam jejak evaluasi performa model formal (public.ml_model_evaluations).
-- 3. Menyimpan hasil inferensi risiko keterlambatan per termin cicilan (public.ml_predictions).
-- 4. Menjamin keamanan ketat:
--    - Tidak mengekspos PII jamaah (hanya mereferensikan UUID dan snapshot fitur anonim).
--    - Tidak menyimpan kredensial atau rahasia apapun.
--    - Menerapkan Row Level Security (RLS) ketat: HANYA role Admin (public.is_admin()) yang dapat mengakses.
--    - Menolak hak akses bagi anon dan jamaah umum.
--
-- PERINGATAN KESELAMATAN ARSITEKTUR:
-- - Skrip ini adalah RANCANGAN MIGRASI LOKAL.
-- - JANGAN dieksekusi secara otomatis ke database remote Supabase tanpa persetujuan eksplisit.
-- - Seluruh prediksi risiko HANYA berfungsi sebagai alat bantu pengawasan internal (decision-support) bagi Admin.
-- - Sistem DILARANG KERAS mengubah status pembayaran jamaah secara otomatis berdasarkan hasil prediksi.
-- ========================================================

-- 1. Tipe ENUM Status Model dan Tingkat Risiko
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ml_model_status') THEN
        CREATE TYPE public.ml_model_status AS ENUM ('ready', 'active', 'archived', 'not_ready');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ml_risk_level') THEN
        CREATE TYPE public.ml_risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH');
    END IF;
END $$;


-- 2. Tabel Registri Versi Model (ml_models)
CREATE TABLE IF NOT EXISTS public.ml_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(50) NOT NULL UNIQUE,
    algorithm VARCHAR(100) NOT NULL DEFAULT 'LogisticRegression',
    status public.ml_model_status NOT NULL DEFAULT 'ready',
    feature_names TEXT[] NOT NULL,
    weights JSONB NOT NULL,
    hyperparameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indeks performa model
CREATE INDEX IF NOT EXISTS idx_ml_models_status ON public.ml_models(status);
CREATE INDEX IF NOT EXISTS idx_ml_models_version ON public.ml_models(version);


-- 3. Tabel Riwayat Evaluasi Model (ml_model_evaluations)
CREATE TABLE IF NOT EXISTS public.ml_model_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES public.ml_models(id) ON DELETE CASCADE,
    evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    sample_count INT NOT NULL CHECK (sample_count >= 0),
    class_0_count INT NOT NULL DEFAULT 0 CHECK (class_0_count >= 0),
    class_1_count INT NOT NULL DEFAULT 0 CHECK (class_1_count >= 0),
    precision_score NUMERIC(5, 4),
    recall_score NUMERIC(5, 4),
    f1_score NUMERIC(5, 4),
    pr_auc NUMERIC(5, 4),
    confusion_matrix JSONB NOT NULL DEFAULT '{"tp": 0, "fp": 0, "tn": 0, "fn": 0}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_evaluations_model_id ON public.ml_model_evaluations(model_id);


-- 4. Tabel Hasil Prediksi Risiko Keterlambatan (ml_predictions)
CREATE TABLE IF NOT EXISTS public.ml_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES public.ml_models(id) ON DELETE SET NULL,
    term_id UUID NOT NULL REFERENCES public.installment_terms(id) ON DELETE CASCADE,
    jamaah_id UUID NOT NULL REFERENCES public.jamaah(id) ON DELETE CASCADE,
    risk_score NUMERIC(5, 4) NOT NULL CHECK (risk_score >= 0.0 AND risk_score <= 1.0),
    risk_level public.ml_risk_level NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    feature_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_term_model_prediction UNIQUE (term_id, model_version)
);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_term_id ON public.ml_predictions(term_id);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_jamaah_id ON public.ml_predictions(jamaah_id);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_risk_level ON public.ml_predictions(risk_level);


-- 5. Trigger Otomatis Kolom updated_at pada ml_models
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ml_models_updated_at'
    ) THEN
        CREATE TRIGGER trg_ml_models_updated_at 
        BEFORE UPDATE ON public.ml_models 
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;


-- 6. Konfigurasi Row Level Security (RLS) Ketat — Khusus Admin
ALTER TABLE public.ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_model_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_predictions ENABLE ROW LEVEL SECURITY;

-- Cabut akses bawaan dari publik dan anon
REVOKE ALL ON TABLE public.ml_models FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ml_model_evaluations FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ml_predictions FROM PUBLIC, anon;

-- Policy Admin: Hanya user dengan role 'admin' yang dapat membaca dan memodifikasi data ML
DROP POLICY IF EXISTS "Admin dapat mengelola seluruh data ml_models" ON public.ml_models;
CREATE POLICY "Admin dapat mengelola seluruh data ml_models"
ON public.ml_models FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin dapat mengelola seluruh data ml_model_evaluations" ON public.ml_model_evaluations;
CREATE POLICY "Admin dapat mengelola seluruh data ml_model_evaluations"
ON public.ml_model_evaluations FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin dapat mengelola seluruh data ml_predictions" ON public.ml_predictions;
CREATE POLICY "Admin dapat mengelola seluruh data ml_predictions"
ON public.ml_predictions FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Berikan izin eksplisit hanya kepada authenticated (yang kemudian difilter oleh RLS is_admin())
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ml_models TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ml_model_evaluations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ml_predictions TO authenticated;

-- Dokumentasi Objek Database
COMMENT ON TABLE public.ml_models IS 'Registri model machine learning dan parameter bobot terlatih.';
COMMENT ON TABLE public.ml_model_evaluations IS 'Riwayat evaluasi metrik performa model (Precision, Recall, F1, PR-AUC).';
COMMENT ON TABLE public.ml_predictions IS 'Prediksi risiko keterlambatan pembayaran termin cicilan (decision-support internal Admin).';
