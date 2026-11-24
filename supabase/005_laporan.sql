-- =====================================================================
-- Gym Tracker Nata — laporan mingguan (Minggu malam) + riwayat penyesuaian target kalori
-- Aman dijalankan ulang. Cara pakai: Supabase → SQL Editor → New query → paste → Run.
-- =====================================================================

create table if not exists weekly_reports (
  id bigint generated always as identity primary key,
  week_end date not null unique,            -- hari Minggu penutup minggu yang dilaporkan
  report_text text not null,
  data jsonb not null default '{}',         -- angka mentah yang dipakai
  kcal_before int,
  kcal_after int,                           -- sama dengan kcal_before kalau nggak diubah
  created_at timestamptz not null default now()
);

alter table weekly_reports enable row level security;   -- tanpa policy: hanya server yang bisa akses
grant all on weekly_reports to service_role;
grant all on all sequences in schema public to service_role;
