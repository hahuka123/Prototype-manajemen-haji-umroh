-- ========================================================
-- MIGRASI: Fungsi Pengingat Termin Cicilan Otomatis (H-7, H-1, Overdue)
-- File: supabase/migrations/20261025100000_create_installment_reminder_function.sql
-- ========================================================
-- Tujuan:
-- 1. Menyediakan fungsi database public.process_installment_reminders() untuk
--    memeriksa seluruh termin cicilan yang aktif dan belum lunas.
-- 2. Menghasilkan notifikasi in-app H-7, H-1, dan keterlambatan (overdue)
--    berbasis zona waktu kalender Indonesia Barat (Asia/Jakarta).
-- 3. Menjamin supresi pengingat untuk termin yang sudah lunas dan menahan
--    notifikasi keterlambatan jika terdapat pembayaran transfer yang berstatus pending.
-- 4. Menjamin idempotensi mutlak melalui INSERT ... ON CONFLICT (dedup_key) DO NOTHING.
-- 5. Menetapkan keamanan fungsi dengan SECURITY DEFINER, search_path aman,
--    serta pembatasan hak eksekusi hanya untuk Administrator dan service_role.
--
-- PENTING / BATASAN TAHAP 5:
-- - Skrip ini HANYA membuat definisi fungsi SQL lokal dan TIDAK mengaktifkan ekstensi pg_cron.
-- - Skrip ini TIDAK mendaftarkan jadwal cron otomatis ke remote database Supabase.
-- - Fungsi dapat diuji dan dijalankan secara manual oleh admin sebelum penjadwalan diaktifkan.
-- ========================================================

CREATE OR REPLACE FUNCTION public.process_installment_reminders()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_today DATE;
    v_month_cycle VARCHAR(7);
    v_created_count INT := 0;
    v_evaluated_count INT := 0;
    v_skipped_paid INT := 0;
    v_skipped_pending INT := 0;
    v_errors_count INT := 0;
    
    r RECORD;
    v_days_diff INT;
    v_type VARCHAR(50);
    v_title VARCHAR(200);
    v_message TEXT;
    v_dedup_key VARCHAR(150);
    v_nominal_formatted TEXT;
    v_due_date_formatted TEXT;
BEGIN
    -- 1. Validasi Keamanan Otorisasi Berlapis (Defense-in-Depth):
    -- - Tolak pemanggil 'anon' secara eksplisit
    -- - Tolak pengguna 'authenticated' yang bukan admin (jamaah ditolak)
    -- - Izinkan admin yang sah (authenticated + public.is_admin())
    -- - Izinkan backend/service_role
    -- - Izinkan internal database worker (session_user = 'postgres' saat auth.role() IS NULL)
    -- - Tolak semua kondisi lain / konteks tidak valid
    IF auth.role() = 'anon' THEN
        RAISE EXCEPTION 'Akses ditolak: Pemanggil anonim tidak diizinkan menjalankan fungsi pengingat.';
    ELSIF auth.role() = 'authenticated' THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Akses ditolak: Hanya administrator yang dapat memproses pengingat termin cicilan.';
        END IF;
    ELSIF auth.role() = 'service_role' THEN
        -- Diizinkan: Token service_role dari backend tepercaya
        NULL;
    ELSIF session_user = 'postgres' AND (auth.role() IS NULL OR auth.role() = '') THEN
        -- Diizinkan: Eksekusi internal postgres (misal pg_cron worker atau maintenance superuser)
        NULL;
    ELSE
        -- Tolak jika konteks autentikasi NULL melalui API atau role tidak terdaftar
        RAISE EXCEPTION 'Akses ditolak: Konteks otorisasi tidak valid atau tidak memiliki izin.';
    END IF;

    -- 2. Kunci Tanggal Hari Ini Menggunakan Zona Waktu Indonesia Barat (WIB)
    v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::DATE;
    v_month_cycle := to_char(v_today, 'YYYY-MM');

    -- 3. Kueri Termin Aktif yang Masih Memiliki Sisa Kewajiban
    FOR r IN (
        SELECT 
            t.id AS term_id,
            t.term_number,
            t.title,
            t.amount AS target_amount,
            t.due_date,
            j.id AS jamaah_id,
            j.profile_id,
            COALESCE(s.total_verified, 0) AS verified_amount,
            COALESCE(s.total_pending, 0) AS pending_amount,
            GREATEST(0, t.amount - COALESCE(s.total_verified, 0)) AS remaining_amount
        FROM public.installment_terms t
        JOIN public.jamaah j ON t.jamaah_id = j.id
        LEFT JOIN (
            SELECT 
                installment_term_id,
                COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0) AS total_verified,
                COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS total_pending
            FROM public.payments
            WHERE installment_term_id IS NOT NULL
            GROUP BY installment_term_id
        ) s ON t.id = s.installment_term_id
        WHERE j.profile_id IS NOT NULL
        ORDER BY t.due_date ASC
    ) LOOP
        v_evaluated_count := v_evaluated_count + 1;

        -- Sub-blok dengan exception handler agar galat pada 1 baris tidak membatalkan termin lain
        BEGIN
            -- Evaluasi Aturan 1: Termin yang sudah lunas TIDAK PERNAH dikirimi pengingat
            IF r.verified_amount >= r.target_amount OR r.remaining_amount <= 0 THEN
                v_skipped_paid := v_skipped_paid + 1;
                CONTINUE;
            END IF;

            v_days_diff := r.due_date - v_today;
            v_type := NULL;
            v_nominal_formatted := 'Rp ' || to_char(r.remaining_amount, 'FM999,999,999,999');
            v_due_date_formatted := to_char(r.due_date, 'YYYY-MM-DD');

            -- Evaluasi Aturan 2: Pengingat H-7 (Tepat 7 hari sebelum jatuh tempo)
            IF v_days_diff = 7 THEN
                v_type := 'due_h7';
                v_title := 'Pengingat Jatuh Tempo (H-7): ' || r.title;
                v_message := 'Pembayaran ' || r.title || ' sebesar ' || v_nominal_formatted || 
                             ' akan jatuh tempo dalam 7 hari (' || v_due_date_formatted || '). Mohon persiapkan pembayaran Anda.';
                v_dedup_key := 'due_h7_' || r.term_id::text || '_' || v_due_date_formatted;

            -- Evaluasi Aturan 3: Pengingat H-1 (Tepat 1 hari sebelum jatuh tempo)
            ELSIF v_days_diff = 1 THEN
                v_type := 'due_h1';
                v_title := 'Pengingat Besok Jatuh Tempo (H-1): ' || r.title;
                v_message := 'Pembayaran ' || r.title || ' sebesar ' || v_nominal_formatted || 
                             ' jatuh tempo besok (' || v_due_date_formatted || '). Segera lakukan transfer dan konfirmasi pembayaran Anda.';
                v_dedup_key := 'due_h1_' || r.term_id::text || '_' || v_due_date_formatted;

            -- Evaluasi Aturan 4: Pemberitahuan Keterlambatan (Overdue)
            ELSIF v_days_diff < 0 THEN
                -- Jika ada transaksi transfer yang masih menunggu verifikasi admin, tahan notifikasi overdue
                -- agar tidak menuduh jamaah terlambat saat jamaah sudah beritikad baik membayar
                IF r.pending_amount > 0 THEN
                    v_skipped_pending := v_skipped_pending + 1;
                    CONTINUE;
                ELSE
                    v_type := 'overdue';
                    v_title := 'Pemberitahuan Termin Terlambat: ' || r.title;
                    v_message := 'Kewajiban ' || r.title || ' telah melewati tanggal jatuh tempo (' || v_due_date_formatted || 
                                 '). Sisa tagihan saat ini adalah ' || v_nominal_formatted || '. Silakan selesaikan pembayaran untuk kelancaran keberangkatan.';
                    -- Batasi maksimal 1 notifikasi keterlambatan per bulan siklus tagihan
                    v_dedup_key := 'overdue_' || r.term_id::text || '_' || v_month_cycle;
                END IF;

            ELSE
                -- Termin berada di luar jendela pengingat (misal H-6 s.d. H-2, atau masih jauh di masa depan)
                CONTINUE;
            END IF;

            -- Simpan Notifikasi Secara Idempoten
            IF v_type IS NOT NULL THEN
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
                    r.profile_id,
                    r.jamaah_id,
                    v_type,
                    v_title,
                    v_message,
                    NULL,
                    r.term_id,
                    v_dedup_key
                )
                ON CONFLICT (dedup_key) DO NOTHING;

                IF FOUND THEN
                    v_created_count := v_created_count + 1;
                END IF;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            v_errors_count := v_errors_count + 1;
            RAISE WARNING 'Galat saat memproses pengingat termin %: %', r.term_id, SQLERRM;
        END;
    END LOOP;

    -- Kembalikan Ringkasan Hasil Proses
    RETURN jsonb_build_object(
        'success', (v_errors_count = 0),
        'status', CASE WHEN v_errors_count > 0 THEN 'partial_success' ELSE 'success' END,
        'execution_date_wib', to_char(v_today, 'YYYY-MM-DD'),
        'terms_evaluated', v_evaluated_count,
        'notifications_created', v_created_count,
        'skipped_paid_terms', v_skipped_paid,
        'skipped_pending_verification', v_skipped_pending,
        'errors_encountered', v_errors_count,
        'timestamp', NOW()
    );
END;
$$;

-- Cabut akses eksekusi dari PUBLIC dan anon secara eksplisit
REVOKE ALL ON FUNCTION public.process_installment_reminders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_installment_reminders() FROM anon;

-- Berikan hak eksekusi kepada authenticated (khusus admin terotorisasi di dalam fungsi) dan service_role
GRANT EXECUTE ON FUNCTION public.process_installment_reminders() TO authenticated, service_role;

-- Komentar dokumentasi
COMMENT ON FUNCTION public.process_installment_reminders IS 'Fungsi batch idempoten untuk mengevaluasi termin cicilan dan menghasilkan notifikasi pengingat H-7, H-1, dan keterlambatan (Asia/Jakarta).';

-- ========================================================
-- DOKUMENTASI AKTIVASI PENJADWALAN (HANYA DIEKSEKUSI JIKA SUDAH DISETUJUI):
-- ========================================================
-- Jangan jalankan perintah di bawah ini secara otomatis pada tahap persiapan lokal!
-- Jika di kemudian hari pg_cron disetujui untuk diaktifkan di Supabase remote:
--
-- 1. Aktifkan ekstensi di SQL Editor:
--    CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- 2. Daftarkan jadwal cron harian pada pukul 07:00 WIB (00:00 UTC):
--    SELECT cron.schedule(
--        'daily-installment-reminder-job',
--        '0 0 * * *',
--        $$SELECT public.process_installment_reminders()$$
--    );
--
-- 3. Periksa status jadwal:
--    SELECT * FROM cron.job WHERE jobname = 'daily-installment-reminder-job';
--
-- 4. Batalkan jadwal jika diperlukan:
--    SELECT cron.unschedule('daily-installment-reminder-job');
-- ========================================================
