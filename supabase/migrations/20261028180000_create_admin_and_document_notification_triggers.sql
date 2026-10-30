-- ========================================================
-- MIGRASI: Trigger Notifikasi Admin (Pembayaran & Dokumen Masuk)
-- File: supabase/migrations/20261028180000_create_admin_and_document_notification_triggers.sql
-- ========================================================
-- Tujuan:
-- 1. Memperbarui CHECK constraint pada tabel public.notifications untuk mendukung tipe notifikasi admin dan dokumen.
-- 2. Memperbarui trigger trg_handle_payment_notification agar saat transfer baru diajukan (status 'pending'),
--    notifikasi otomatis dikirimkan ke SEMUA akun dengan role 'admin'.
-- 3. Membuat trigger trg_handle_document_notification pada tabel public.documents:
--    - Saat berkas diunggah/diperbarui jamaah ('Menunggu Verifikasi'), kirim notifikasi ke SEMUA akun 'admin'.
--    - Saat berkas diverifikasi ('Lengkap') atau ditolak ('Ditolak') oleh admin, kirim notifikasi ke jamaah terkait.
-- 4. Membuat fungsi helper RPC public.notify_admins() untuk kebutuhan pengiriman fleksibel via SECURITY DEFINER.
-- ========================================================

-- 1. Perluas tipe notifikasi pada CHECK constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
        'payment_verified',
        'payment_rejected',
        'payment_submitted',
        'payment_cash',
        'due_h7',
        'due_h1',
        'overdue',
        'general',
        'admin_new_payment',
        'admin_new_document',
        'document_submitted',
        'document_verified',
        'document_rejected'
    )
);

-- 2. Perbarui Trigger Pembayaran (Kirim ke Jamaah DAN seluruh Admin)
CREATE OR REPLACE FUNCTION public.trg_handle_payment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_profile_id UUID;
    v_jamaah_name TEXT;
    v_dedup_key VARCHAR(150);
    v_title VARCHAR(200);
    v_message TEXT;
    v_type VARCHAR(50);
    v_nominal_formatted TEXT;
    v_admin_record RECORD;
BEGIN
    -- Dapatkan profile_id dan nama lengkap jamaah
    SELECT j.profile_id, COALESCE(p.full_name, 'Jamaah')
    INTO v_profile_id, v_jamaah_name
    FROM public.jamaah j
    LEFT JOIN public.profiles p ON p.id = j.profile_id
    WHERE j.id = NEW.jamaah_id;

    v_nominal_formatted := 'Rp ' || to_char(NEW.amount, 'FM999,999,999,999');

    -- KASUS A: INSERT baru pembayaran transfer (status pending)
    IF TG_OP = 'INSERT' AND NEW.payment_method = 'transfer' AND NEW.status = 'pending' THEN
        -- A.1 Notifikasi ke Jamaah pengaju
        IF v_profile_id IS NOT NULL THEN
            v_type := 'payment_submitted';
            v_dedup_key := 'pay_submitted_' || NEW.id::text;
            v_title := 'Konfirmasi Transfer Terkirim';
            v_message := 'Pengajuan pembayaran transfer sebesar ' || v_nominal_formatted || ' telah kami terima dan sedang menunggu verifikasi admin.';

            INSERT INTO public.notifications (
                profile_id, jamaah_id, type, title, message, related_payment_id, related_term_id, dedup_key
            ) VALUES (
                v_profile_id, NEW.jamaah_id, v_type, v_title, v_message, NEW.id, NEW.installment_term_id, v_dedup_key
            ) ON CONFLICT (dedup_key) DO NOTHING;
        END IF;

        -- A.2 Notifikasi ke seluruh AKUN ADMIN
        FOR v_admin_record IN SELECT id FROM public.profiles WHERE role = 'admin' LOOP
            INSERT INTO public.notifications (
                profile_id, jamaah_id, type, title, message, related_payment_id, related_term_id, dedup_key
            ) VALUES (
                v_admin_record.id,
                NEW.jamaah_id,
                'admin_new_payment',
                'Pembayaran Transfer Masuk',
                'Jamaah ' || v_jamaah_name || ' telah mengajukan transfer sebesar ' || v_nominal_formatted || '. Harap verifikasi bukti transaksi.',
                NEW.id,
                NEW.installment_term_id,
                'admin_pay_' || NEW.id::text || '_' || v_admin_record.id::text
            ) ON CONFLICT (dedup_key) DO NOTHING;
        END LOOP;

        RETURN NEW;

    -- KASUS B: INSERT baru pembayaran tunai langsung sah (status verified)
    ELSIF TG_OP = 'INSERT' AND NEW.payment_method = 'cash' AND NEW.status = 'verified' THEN
        IF v_profile_id IS NOT NULL THEN
            v_type := 'payment_cash';
            v_dedup_key := 'pay_cash_' || NEW.id::text;
            v_title := 'Pembayaran Tunai Diterima';
            v_message := 'Pembayaran tunai di kantor biro sebesar ' || v_nominal_formatted || ' telah sah dicatat dan mengurangi tagihan Anda.';

            INSERT INTO public.notifications (
                profile_id, jamaah_id, type, title, message, related_payment_id, related_term_id, dedup_key
            ) VALUES (
                v_profile_id, NEW.jamaah_id, v_type, v_title, v_message, NEW.id, NEW.installment_term_id, v_dedup_key
            ) ON CONFLICT (dedup_key) DO NOTHING;
        END IF;

        RETURN NEW;

    -- KASUS C: UPDATE status pembayaran transfer dari pending menjadi verified
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'verified' THEN
        IF v_profile_id IS NOT NULL THEN
            v_type := 'payment_verified';
            v_dedup_key := 'pay_verified_' || NEW.id::text;
            v_title := 'Pembayaran Terverifikasi';
            v_message := 'Alhamdulillah, transfer pembayaran Anda sebesar ' || v_nominal_formatted || ' telah diverifikasi sah oleh admin.';

            INSERT INTO public.notifications (
                profile_id, jamaah_id, type, title, message, related_payment_id, related_term_id, dedup_key
            ) VALUES (
                v_profile_id, NEW.jamaah_id, v_type, v_title, v_message, NEW.id, NEW.installment_term_id, v_dedup_key
            ) ON CONFLICT (dedup_key) DO NOTHING;
        END IF;

        RETURN NEW;

    -- KASUS D: UPDATE status pembayaran transfer dari pending menjadi rejected
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'rejected' THEN
        IF v_profile_id IS NOT NULL THEN
            v_type := 'payment_rejected';
            v_dedup_key := 'pay_rejected_' || NEW.id::text;
            v_title := 'Pembayaran Ditolak';
            v_message := 'Pengajuan pembayaran sebesar ' || v_nominal_formatted || ' ditolak. Alasan: ' || COALESCE(NEW.rejection_reason, 'Bukti transfer tidak terbaca atau tidak valid.') || '. Silakan ajukan ulang dengan bukti yang sesuai.';

            INSERT INTO public.notifications (
                profile_id, jamaah_id, type, title, message, related_payment_id, related_term_id, dedup_key
            ) VALUES (
                v_profile_id, NEW.jamaah_id, v_type, v_title, v_message, NEW.id, NEW.installment_term_id, v_dedup_key
            ) ON CONFLICT (dedup_key) DO NOTHING;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

-- Pasang ulang trigger payments
DROP TRIGGER IF EXISTS trg_payments_notification ON public.payments;
CREATE TRIGGER trg_payments_notification
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.trg_handle_payment_notification();

-- 3. Trigger Notifikasi Dokumen (Kirim ke Admin saat Upload, Kirim ke Jamaah saat Verifikasi/Tolak)
CREATE OR REPLACE FUNCTION public.trg_handle_document_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_profile_id UUID;
    v_jamaah_name TEXT;
    v_admin_record RECORD;
    v_doc_title TEXT;
    v_timestamp_epoch TEXT;
BEGIN
    -- Dapatkan profile_id dan nama lengkap jamaah
    SELECT j.profile_id, COALESCE(p.full_name, 'Jamaah')
    INTO v_profile_id, v_jamaah_name
    FROM public.jamaah j
    LEFT JOIN public.profiles p ON p.id = j.profile_id
    WHERE j.id = NEW.jamaah_id;

    -- Judul dokumen yang ramah tampilan
    v_doc_title := CASE NEW.document_type::text
        WHEN 'ktp' THEN 'KTP'
        WHEN 'kk' THEN 'Kartu Keluarga (KK)'
        WHEN 'passport' THEN 'Paspor'
        WHEN 'foto' THEN 'Pas Foto'
        WHEN 'buku-nikah' THEN 'Buku Nikah'
        WHEN 'kesehatan' THEN 'Surat Kesehatan'
        ELSE NEW.document_type::text
    END;

    v_timestamp_epoch := EXTRACT(EPOCH FROM COALESCE(NEW.updated_at, NOW()))::bigint::text;

    -- ALUR 1: Jamaah mengunggah atau memperbarui berkas ('Menunggu Verifikasi') -> Beritahu Seluruh Admin
    IF NEW.status = 'Menunggu Verifikasi' AND (
        TG_OP = 'INSERT' OR 
        (TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM 'Menunggu Verifikasi' OR OLD.file_path IS DISTINCT FROM NEW.file_path))
    ) THEN
        FOR v_admin_record IN SELECT id FROM public.profiles WHERE role = 'admin' LOOP
            INSERT INTO public.notifications (
                profile_id,
                jamaah_id,
                type,
                title,
                message,
                dedup_key
            ) VALUES (
                v_admin_record.id,
                NEW.jamaah_id,
                'admin_new_document',
                'Berkas Dokumen Masuk',
                'Jamaah ' || v_jamaah_name || ' telah mengunggah berkas ' || v_doc_title || '. Harap lakukan verifikasi.',
                'admin_doc_' || NEW.id::text || '_' || v_admin_record.id::text || '_' || v_timestamp_epoch
            ) ON CONFLICT (dedup_key) DO NOTHING;
        END LOOP;
    END IF;

    -- ALUR 2: Admin menyetujui dokumen ('Lengkap') -> Beritahu Jamaah
    IF TG_OP = 'UPDATE' AND v_profile_id IS NOT NULL AND OLD.status = 'Menunggu Verifikasi' AND NEW.status = 'Lengkap' THEN
        INSERT INTO public.notifications (
            profile_id,
            jamaah_id,
            type,
            title,
            message,
            dedup_key
        ) VALUES (
            v_profile_id,
            NEW.jamaah_id,
            'document_verified',
            'Dokumen Diverifikasi',
            'Alhamdulillah, berkas ' || v_doc_title || ' Anda telah diverifikasi dan dinyatakan Lengkap oleh admin.',
            'doc_verified_' || NEW.id::text || '_' || v_timestamp_epoch
        ) ON CONFLICT (dedup_key) DO NOTHING;
    END IF;

    -- ALUR 3: Admin menolak dokumen ('Ditolak') -> Beritahu Jamaah
    IF TG_OP = 'UPDATE' AND v_profile_id IS NOT NULL AND OLD.status = 'Menunggu Verifikasi' AND NEW.status = 'Ditolak' THEN
        INSERT INTO public.notifications (
            profile_id,
            jamaah_id,
            type,
            title,
            message,
            dedup_key
        ) VALUES (
            v_profile_id,
            NEW.jamaah_id,
            'document_rejected',
            'Dokumen Perlu Perbaikan',
            'Berkas ' || v_doc_title || ' Anda ditolak. Catatan: ' || COALESCE(NEW.notes, 'Berkas tidak jelas atau tidak memenuhi syarat.') || '. Silakan unggah perbaikan berkas.',
            'doc_rejected_' || NEW.id::text || '_' || v_timestamp_epoch
        ) ON CONFLICT (dedup_key) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- Pasang trigger documents
DROP TRIGGER IF EXISTS trg_documents_notification ON public.documents;
CREATE TRIGGER trg_documents_notification
AFTER INSERT OR UPDATE OF status, file_path ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.trg_handle_document_notification();

-- 4. Fungsi RPC SECURITY DEFINER untuk broadcast notifikasi ke seluruh Admin
CREATE OR REPLACE FUNCTION public.notify_admins(
    p_type VARCHAR(50),
    p_title VARCHAR(200),
    p_message TEXT,
    p_jamaah_id UUID DEFAULT NULL,
    p_related_payment_id UUID DEFAULT NULL,
    p_dedup_prefix VARCHAR(50) DEFAULT 'admin_notif'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_admin_record RECORD;
    v_count INT := 0;
BEGIN
    FOR v_admin_record IN SELECT id FROM public.profiles WHERE role = 'admin' LOOP
        INSERT INTO public.notifications (
            profile_id,
            jamaah_id,
            type,
            title,
            message,
            related_payment_id,
            dedup_key
        ) VALUES (
            v_admin_record.id,
            p_jamaah_id,
            p_type,
            p_title,
            p_message,
            p_related_payment_id,
            p_dedup_prefix || '_' || v_admin_record.id::text || '_' || EXTRACT(EPOCH FROM NOW())::bigint::text
        ) ON CONFLICT (dedup_key) DO NOTHING;
        
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_admins FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_admins TO authenticated;

