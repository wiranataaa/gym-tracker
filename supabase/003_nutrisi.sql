-- =====================================================================
-- Gym Tracker Nata — Fase 2: nutrisi (kalori dan protein)
-- Aman dijalankan ulang. Cara pakai: Supabase → SQL Editor → New query → paste → Run.
-- =====================================================================

-- Satu "makan" = satu foto/teks/favorit yang dihitung AI, berisi beberapa item.
create table if not exists meals (
  id bigint generated always as identity primary key,
  eaten_at timestamptz not null default now(),
  meal_date date not null,                                   -- tanggal WIB, diisi kode
  source text not null default 'foto' check (source in ('foto', 'teks', 'favorit', 'manual')),
  description text,                                          -- ringkasan singkat dari AI
  photo_path text,                                           -- path di Storage bucket meal-photos
  total_kcal numeric(7,1) not null default 0,
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  kcal_min numeric(7,1),                                     -- rentang perkiraan AI
  kcal_max numeric(7,1),
  confidence text check (confidence in ('rendah', 'sedang', 'tinggi')),
  status text not null default 'draft' check (status in ('draft', 'tersimpan')),
  portion_factor numeric(4,2) not null default 1,            -- pengali porsi (0,5 / 1 / 1,5 / 2)
  ai_raw jsonb,                                              -- jawaban mentah AI (buat audit)
  created_at timestamptz not null default now()
);
create index if not exists idx_meals_date on meals (meal_date desc, eaten_at desc);

create table if not exists meal_items (
  id bigint generated always as identity primary key,
  meal_id bigint not null references meals(id) on delete cascade,
  name text not null,
  portion_g numeric(7,1),
  kcal numeric(7,1) not null default 0,
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  note text
);
create index if not exists idx_meal_items_meal on meal_items (meal_id);

-- Favorit: nilai gizi yang sudah dikoreksi Nata, makin lama makin akurat.
create table if not exists favorite_foods (
  id bigint generated always as identity primary key,
  name text not null unique,
  portion_desc text,
  kcal numeric(7,1) not null,
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  use_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Keamanan: RLS aktif tanpa policy (kunci publik nggak bisa akses), server saja yang boleh.
alter table meals          enable row level security;
alter table meal_items     enable row level security;
alter table favorite_foods enable row level security;

grant all on meals, meal_items, favorite_foods to service_role;
grant all on all sequences in schema public to service_role;
