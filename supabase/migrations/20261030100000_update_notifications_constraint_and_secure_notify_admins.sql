-- ========================================================
-- MIGRASI: Pembaruan CHECK Constraint Notifikasi & Pengamanan notify_admins()
-- File: supabase/migrations/20261030100000_update_notifications_constraint_and_secure_notify_admins.sql
-- ========================================================
-- Tujuan:
-- 1. Menjamin seluruh tipe notifikasi yang digunakan oleh frontend, service, trigger, dan migrasi
--    diizinkan oleh CHECK constraint tabel public.notifications secara aditif dan aman.
-- 2. Menghapus check constraint lama pada kolom type secara dinamis agar tidak gagal jika
--    nama constraint bervariasi pada database yang sudah berjalan.
-- 3. Memperketat keamanan fungsi public.notify_admins():
--    - Memvalidasi identitas pemanggil menggunakan public.is_admin().
--    - Menolak pemanggil anon dan pengguna authenticated yang bukan Admin (misal Jamaah).
--    - Mencabut hak eksekusi dari PUBLIC dan anon.
--    - Memberikan hak eksekusi hanya kepada authenticated dan service_role.
-- 4. Memastikan trigger trg_handle_document_notification memiliki proteksi exception handling
--    sehingga tidak pernah menggagalkan operasi upload atau verifikasi dokumen yang valid.
--
-- Catatan Keamanan:
-- - Bersifat ADITIF: Tidak menghapus tabel, kolom, maupun data notifikasi yang sudah ada.
-- - Idempoten: Aman dijalankan berulang kali tanpa merusak integritas database.
-- ========================================================

-- 1. Pembaruan CHECK Constraint Tipe Notifikasi secara Aman dan Dinamis
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Cari dan hapus semua check constraint lama pada kolom 'type' di tabel 'notifications'
    FOR r IN (
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'notifications'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%type%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
        -- Tipe Pembayaran (Jamaah)
        'payment_verified',
        'payment_rejected',
        'payment_submitted',
        'payment_cash',
        -- Tipe Pengingat Jatuh Tempo (H-7, H-1, Overdue)
        'due_h7',
        'due_h1',
        'overdue',
        -- Tipe Notifikasi Dokumen (Jamaah)
        'document_submitted',
        'document_verified',
        'document_rejected',
        -- Tipe Notifikasi Masuk Khusus Administrator
        'admin_new_payment',
        'admin_new_document',
        -- Tipe Notifikasi Umum / Broadcast
        'general'
    )
);

-- 2. Perbaikan Keamanan Fungsi RPC notify_admins() (Anti-Tampering & Role Guard)
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
    -- Validasi Keamanan Otorisasi Berlapis (Defense-in-Depth):
    IF auth.role() = 'anon' THEN
        RAISE EXCEPTION 'Akses ditolak: Pemanggil anonim tidak diizinkan.';
    ELSIF auth.role() = 'authenticated' THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Akses ditolak: Hanya administrator yang berhak mengirim notifikasi admin.';
        END IF;
    ELSIF auth.role() = 'service_role' THEN
        -- Diizinkan: Token backend tepercaya
        NULL;
    ELSIF session_user = 'postgres' AND (auth.role() IS NULL OR auth.role() = '') THEN
        -- Diizinkan: Eksekusi internal postgres (trigger atau superuser maintenance)
        NULL;
    ELSE
        -- Tolak jika konteks autentikasi tidak valid
        RAISE EXCEPTION 'Akses ditolak: Konteks otorisasi tidak valid atau tidak memiliki izin.';
    END IF;

    -- Validasi tipe notifikasi sesuai constraint
    IF p_type NOT IN (
        'payment_verified', 'payment_rejected', 'payment_submitted', 'payment_cash',
        'due_h7', 'due_h1', 'overdue', 'document_submitted', 'document_verified',
        'document_rejected', 'admin_new_payment', 'admin_new_document', 'general'
    ) THEN
        RAISE EXCEPTION 'Tipe notifikasi tidak valid: %', p_type;
    END IF;

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

-- Cabut seluruh izin eksekusi dari PUBLIC dan anon
REVOKE ALL ON FUNCTION public.notify_admins(VARCHAR, VARCHAR, TEXT, UUID, UUID, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_admins(VARCHAR, VARCHAR, TEXT, UUID, UUID, VARCHAR) FROM anon;

-- Berikan izin eksekusi hanya kepada authenticated (yang lolos pemeriksaan is_admin) dan service_role
GRANT EXECUTE ON FUNCTION public.notify_admins(VARCHAR, VARCHAR, TEXT, UUID, UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_admins(VARCHAR, VARCHAR, TEXT, UUID, UUID, VARCHAR) TO service_role;

-- 3. Pembaruan Trigger Notifikasi Dokumen dengan Perlindungan Kesalahan (Fail-Safe)
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

    EXCEPTION
        WHEN OTHERS THEN
            -- Jangan menggagalkan operasi upload atau verifikasi dokumen jika terjadi galat notifikasi non-kritis
            RAISE WARNING 'trg_handle_document_notification non-fatal error: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$;

-- Pasang ulang trigger documents
DROP TRIGGER IF EXISTS trg_documents_notification ON public.documents;
CREATE TRIGGER trg_documents_notification
AFTER INSERT OR UPDATE OF status, file_path ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.trg_handle_document_notification();

-- Komentar dokumentasi
COMMENT ON FUNCTION public.notify_admins IS 'RPC aman dengan validasi admin untuk mengirim notifikasi in-app ke seluruh administrator.';

