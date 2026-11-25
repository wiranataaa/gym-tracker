-- =====================================================================
-- Gym Tracker Nata — Migrasi 010
--  * progress_photos: foto progres badan (depan / samping / belakang), satu foto per sudut per tanggal.
--    File fotonya disimpan di Storage bucket yang sama dengan foto makanan (meal-photos, privat),
--    di folder "progres/", jadi nggak perlu bikin bucket baru.
-- Aman dijalankan ulang. Cara pakai: Supabase → SQL Editor → New query → paste → Run.
-- =====================================================================

create table if not exists progress_photos (
  id bigint generated always as identity primary key,
  photo_date date not null,                                   -- tanggal WIB
  angle text not null check (angle in ('depan', 'samping', 'belakang')),
  photo_path text not null,                                   -- path di Storage bucket meal-photos
  weight_kg numeric(5,2),                                     -- berat terdekat saat foto (kalau ada timbangan <= 7 hari)
  created_at timestamptz not null default now(),
  unique (photo_date, angle)
);

create index if not exists idx_progress_photos_date on progress_photos (photo_date desc);

alter table progress_photos enable row level security;
grant all on progress_photos to service_role;
grant all on all sequences in schema public to service_role;
