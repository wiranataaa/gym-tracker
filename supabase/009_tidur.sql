-- =====================================================================
-- Gym Tracker Nata — Migrasi 009
--  * sleep_logs: catatan tidur per malam (jam tidur, jam bangun, kualitas 1-5, cerita bebas)
--    Kuncinya tanggal BANGUN (WIB), jadi "tidur malam Selasa -> bangun Rabu" disimpan di tanggal Rabu.
-- Aman dijalankan ulang. Cara pakai: Supabase → SQL Editor → New query → paste → Run.
-- =====================================================================

create table if not exists sleep_logs (
  id bigint generated always as identity primary key,
  wake_date date not null unique,                 -- tanggal bangun (WIB)
  slept_at timestamptz not null,                  -- waktu mulai tidur
  woke_at timestamptz not null,                   -- waktu bangun
  duration_min integer not null check (duration_min between 30 and 960),
  quality smallint check (quality between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sleep_wake_date on sleep_logs (wake_date desc);

alter table sleep_logs enable row level security;
grant all on sleep_logs to service_role;
grant all on all sequences in schema public to service_role;
