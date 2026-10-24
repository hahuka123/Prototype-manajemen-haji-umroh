-- ========================================================
-- MIGRASI: Model Data Notifikasi In-App & Otomatisasi Status Pembayaran
-- File: supabase/migrations/20261024110000_create_notifications_schema.sql
-- ========================================================
-- Tujuan:
-- 1. Membuat tabel public.notifications untuk menyimpan notifikasi in-app
--    secara persisten bagi jamaah dan admin.
-- 2. Menjamin integritas deduplikasi notifikasi melalui unique constraint dedup_key.
-- 3. Menerapkan Row Level Security (RLS) ketat:
--    - Jamaah HANYA dapat membaca notifikasi miliknya sendiri (profile_id = auth.uid()).
--    - Jamaah TIDAK memiliki hak INSERT atau UPDATE langsung ke kolom tabel.
-- 4. Membuat fungsi RPC aman (SECURITY DEFINER) untuk menandai notifikasi sebagai dibaca
--    (mark_notification_as_read & mark_all_notifications_as_read) dengan validasi auth.uid().
-- 5. Membuat trigger otomatis idempoten pada tabel public.payments untuk membuat notifikasi
--    saat pembayaran transfer diajukan, diverifikasi, ditolak, atau saat pembayaran tunai dicatat.
--
-- Catatan Keamanan:
-- - Skrip ini bersifat ADITIF dan tidak menghapus data pembayaran atau tabel lama.
-- - Foreign key menggunakan ON DELETE SET NULL atau CASCADE yang aman.
-- - Ekstensi pg_cron TIDAK diaktifkan di sini (audit scheduler terpisah di Tahap 4).
-- ========================================================

-- 1. Tabel notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    jamaah_id UUID REFERENCES public.jamaah(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (
        type IN (
            'payment_verified',
            'payment_rejected',
            'payment_submitted',
            'payment_cash',
            'due_h7',
            'due_h1',
            'overdue',
            'general'
        )
    ),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    related_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    related_term_id UUID REFERENCES public.installment_terms(id) ON DELETE SET NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    dedup_key VARCHAR(150) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indeks performa query notifikasi
CREATE INDEX IF NOT EXISTS idx_notifications_profile_unread 
ON public.notifications(profile_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
ON public.notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_related_payment 
ON public.notifications(related_payment_id);

CREATE INDEX IF NOT EXISTS idx_notifications_related_term 
ON public.notifications(related_term_id);

-- 2. Konfigurasi Row Level Security (RLS) pada tabel notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pengguna dapat membaca notifikasi sendiri" ON public.notifications;
DROP POLICY IF EXISTS "Admin dapat melihat seluruh notifikasi" ON public.notifications;
DROP POLICY IF EXISTS "Admin dapat menghapus notifikasi" ON public.notifications;

-- Policy 1: Pengguna (baik Jamaah maupun Admin) HANYA dapat membaca notifikasi miliknya sendiri di kotak masuk
CREATE POLICY "Pengguna dapat membaca notifikasi sendiri"
ON public.notifications FOR SELECT
USING (profile_id = auth.uid());

-- Policy 2: Admin dapat menghapus notifikasi lama jika diperlukan untuk pemeliharaan sistem
CREATE POLICY "Admin dapat menghapus notifikasi"
ON public.notifications FOR DELETE
USING (public.is_admin());

-- CATATAN: TIDAK ADA policy INSERT atau UPDATE untuk jamaah!
-- Penulisan baris notifikasi dilakukan oleh trigger internal atau fungsi SECURITY DEFINER.
-- Penandaan dibaca hanya diizinkan melalui fungsi RPC di bawah ini.

-- 3. Fungsi RPC Aman untuk Menandai Notifikasi Dibaca (Anti-Tampering)
CREATE OR REPLACE FUNCTION public.mark_notification_as_read(target_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    affected_rows INT;
BEGIN
    UPDATE public.notifications
    SET is_read = TRUE,
        read_at = NOW()
    WHERE id = target_notification_id
      AND profile_id = auth.uid() -- Kunci: Hanya pemilik notifikasi yang dapat menandai
      AND is_read = FALSE;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    affected_rows INT;
BEGIN
    UPDATE public.notifications
    SET is_read = TRUE,
        read_at = NOW()
    WHERE profile_id = auth.uid()
      AND is_read = FALSE;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows;
END;
$$;

-- Izin eksekusi fungsi RPC
REVOKE ALL ON FUNCTION public.mark_notification_as_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_notification_as_read(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_all_notifications_as_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_as_read() TO authenticated;

-- 4. Trigger Otomatis Pembuatan Notifikasi Pembayaran (Idempoten)
CREATE OR REPLACE FUNCTION public.trg_handle_payment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id UUID;
    v_dedup_key VARCHAR(150);
    v_title VARCHAR(200);
    v_message TEXT;
    v_type VARCHAR(50);
    v_nominal_formatted TEXT;
BEGIN
    -- Dapatkan profile_id pemilik jamaah dari tabel jamaah
    SELECT profile_id INTO v_profile_id
    FROM public.jamaah
    WHERE id = NEW.jamaah_id;

    -- Jika tidak terhubung ke profil akun, batalkan pembuatan notifikasi
    IF v_profile_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_nominal_formatted := 'Rp ' || to_char(NEW.amount, 'FM999,999,999,999');

    -- KASUS A: INSERT baru pembayaran transfer (status pending)
    IF TG_OP = 'INSERT' AND NEW.payment_method = 'transfer' AND NEW.status = 'pending' THEN
        v_type := 'payment_submitted';
        v_dedup_key := 'pay_submitted_' || NEW.id::text;
        v_title := 'Konfirmasi Transfer Terkirim';
        v_message := 'Pengajuan pembayaran transfer sebesar ' || v_nominal_formatted || ' telah kami terima dan sedang menunggu verifikasi admin.';
    
    -- KASUS B: INSERT baru pembayaran tunai langsung sah (status verified)
    ELSIF TG_OP = 'INSERT' AND NEW.payment_method = 'cash' AND NEW.status = 'verified' THEN
        v_type := 'payment_cash';
        v_dedup_key := 'pay_cash_' || NEW.id::text;
        v_title := 'Pembayaran Tunai Diterima';
        v_message := 'Pembayaran tunai di kantor biro sebesar ' || v_nominal_formatted || ' telah sah dicatat dan mengurangi tagihan Anda.';

    -- KASUS C: UPDATE status pembayaran transfer dari pending menjadi verified
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'verified' THEN
        v_type := 'payment_verified';
        v_dedup_key := 'pay_verified_' || NEW.id::text;
        v_title := 'Pembayaran Terverifikasi';
        v_message := 'Alhamdulillah, transfer pembayaran Anda sebesar ' || v_nominal_formatted || ' telah diverifikasi sah oleh admin.';

    -- KASUS D: UPDATE status pembayaran transfer dari pending menjadi rejected
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'rejected' THEN
        v_type := 'payment_rejected';
        v_dedup_key := 'pay_rejected_' || NEW.id::text;
        v_title := 'Pembayaran Ditolak';
        v_message := 'Pengajuan pembayaran sebesar ' || v_nominal_formatted || ' ditolak. Alasan: ' || COALESCE(NEW.rejection_reason, 'Bukti transfer tidak terbaca atau tidak valid.') || '. Silakan ajukan ulang dengan bukti yang sesuai.';

    ELSE
        -- Perubahan status lain yang tidak memerlukan notifikasi
        RETURN NEW;
    END IF;

    -- Simpan notifikasi secara idempoten
    INSERT INTO public.notifications (
        profile_id,
        jamaah_id,
        type,
        title,
        message,
        related_payment_id,
        related_term_id,
        dedup_key
    ) VALUES (
        v_profile_id,
        NEW.jamaah_id,
        v_type,
        v_title,
        v_message,
        NEW.id,
        NEW.installment_term_id,
        v_dedup_key
    )
    ON CONFLICT (dedup_key) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_notification ON public.payments;
CREATE TRIGGER trg_payments_notification
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.trg_handle_payment_notification();

-- Izin pada tabel notifications
GRANT SELECT ON public.notifications TO authenticated;

-- Komentar dokumentasi
COMMENT ON TABLE public.notifications IS 'Notifikasi in-app persisten untuk jamaah dan admin.';
COMMENT ON COLUMN public.notifications.dedup_key IS 'Kunci unik untuk mencegah duplikasi notifikasi dari trigger atau scheduler.';
COMMENT ON FUNCTION public.mark_notification_as_read IS 'RPC aman untuk menandai satu notifikasi milik akun aktif sebagai dibaca.';
COMMENT ON FUNCTION public.mark_all_notifications_as_read IS 'RPC aman untuk menandai seluruh notifikasi milik akun aktif sebagai dibaca.';
