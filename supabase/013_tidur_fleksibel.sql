-- =====================================================================
-- Gym Tracker Nata — Migrasi 013
--  Tidur jadi fleksibel:
--   * tiap tidur satu baris sendiri, boleh lebih dari sekali per hari (tidur siang, tidur dua kali)
--   * bisa dicatat dua langkah: "mau tidur" dulu (jam bangun masih kosong), "udah bangun" belakangan
--   * maksimal satu tidur yang belum ditutup
--  Catatan tidur lama TIDAK berubah/terhapus.
-- Aman dijalankan ulang. Cara pakai: Supabase → SQL Editor → New query → paste semua → Run.
-- =====================================================================

alter table sleep_logs drop constraint if exists sleep_logs_wake_date_key;
alter table sleep_logs alter column wake_date drop not null;
alter table sleep_logs alter column woke_at drop not null;
alter table sleep_logs alter column duration_min drop not null;

-- baris harus lengkap (sudah bangun) atau kosong total di sisi bangun (masih tidur)
alter table sleep_logs drop constraint if exists sleep_logs_lengkap;
alter table sleep_logs add constraint sleep_logs_lengkap check (
  (woke_at is null and wake_date is null and duration_min is null)
  or (woke_at is not null and wake_date is not null and duration_min is not null)
);

create unique index if not exists idx_sleep_satu_aktif on sleep_logs ((true)) where woke_at is null;
