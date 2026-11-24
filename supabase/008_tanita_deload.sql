-- =====================================================================
-- Gym Tracker Nata — Migrasi 008
--  * tanita_draft: hasil baca foto layar Tanita yang menunggu konfirmasi (dari Telegram)
--  * settings.deload_sampai / deload_terakhir: mode deload (minggu ringan) dan kapan terakhir
-- Aman dijalankan ulang. Cara pakai: Supabase → SQL Editor → New query → paste → Run.
-- =====================================================================

create table if not exists tanita_draft (
  id bigint generated always as identity primary key,
  data jsonb not null,                        -- nilai hasil baca AI + peringatan
  kondisi text not null default 'sebelum_latihan',
  created_at timestamptz not null default now()
);
alter table tanita_draft enable row level security;
grant all on tanita_draft to service_role;
grant all on all sequences in schema public to service_role;

alter table settings add column if not exists deload_sampai date;      -- mode deload aktif sampai tanggal ini (termasuk)
alter table settings add column if not exists deload_terakhir date;    -- tanggal mulai deload terakhir
