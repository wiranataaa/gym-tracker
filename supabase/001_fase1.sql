-- =====================================================================
-- Gym Tracker Nata — Fase 1: skema database + data awal
-- Aman dijalankan ulang (pakai IF NOT EXISTS / ON CONFLICT).
-- Cara pakai: Supabase → SQL Editor → New query → paste semua → Run.
-- =====================================================================

-- ---------- 1. Pengaturan (satu baris saja) ----------
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  height_cm numeric(5,1) not null default 178,
  age int not null default 27,
  target_weight_kg numeric(5,1) not null default 75,
  stretch_target_kg numeric(5,1) not null default 78,
  target_kcal int not null default 2700,
  target_protein_g int not null default 135,
  sessions_per_week int not null default 3,
  workout_days int[] not null default '{1,2,3,4,5}',      -- 1=Senin ... 7=Minggu
  morning_time time not null default '05:30',
  protein_reminder_time time not null default '19:00',
  summary_time time not null default '21:00',
  ramadan_start date not null default '2027-02-08',        -- perkiraan, bisa diubah
  lebaran_date date not null default '2027-03-10',         -- perkiraan, bisa diubah
  ramadan_mode boolean not null default false,
  timezone text not null default 'Asia/Jakarta',
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- ---------- 2. Gerakan ----------
create table if not exists exercises (
  id bigint generated always as identity primary key,
  name text not null unique,
  aliases text[] not null default '{}',                    -- untuk parsing: "bench", "bp", dst.
  muscle_group text not null,
  kind text not null check (kind in ('compound', 'isolation')),
  body_region text not null check (body_region in ('upper', 'lower')),
  equipment text not null,
  increment_kg numeric(4,2) not null default 2.5,          -- langkah naik beban
  is_active boolean not null default true
);

-- ---------- 3. Program (sistem antrean: urutan, bukan kalender) ----------
create table if not exists program_days (
  id bigint generated always as identity primary key,
  position int not null unique,                            -- urutan antrean: 1, 2, 3, lalu balik ke 1
  name text not null
);

create table if not exists program_day_exercises (
  id bigint generated always as identity primary key,
  program_day_id bigint not null references program_days(id) on delete cascade,
  exercise_id bigint not null references exercises(id),
  position int not null,
  sets int not null,
  rep_min int not null,
  rep_max int not null,
  is_core boolean not null default false,                  -- dipakai di "versi singkat 30 menit"
  unique (program_day_id, position)
);

-- ---------- 4. Sesi dan set latihan ----------
create table if not exists workout_sessions (
  id bigint generated always as identity primary key,
  session_date date not null,
  program_day_id bigint references program_days(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  mode text not null default 'normal' check (mode in ('normal', 'singkat')),
  status text not null default 'berjalan' check (status in ('berjalan', 'selesai', 'dilewati')),
  energy smallint check (energy between 1 and 5),
  notes text
);
create index if not exists idx_sessions_date on workout_sessions (session_date desc);

create table if not exists workout_sets (
  id bigint generated always as identity primary key,
  session_id bigint not null references workout_sessions(id) on delete cascade,
  exercise_id bigint not null references exercises(id),
  set_number int not null,
  weight_kg numeric(6,2) not null,
  reps int not null,
  rpe numeric(3,1),
  is_warmup boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_sets_session on workout_sets (session_id);
create index if not exists idx_sets_exercise on workout_sets (exercise_id, created_at desc);

-- ---------- 5. Menu pagi dan kesimpulan ----------
create table if not exists daily_plans (
  id bigint generated always as identity primary key,
  plan_date date not null unique,
  program_day_id bigint references program_days(id),
  mode text not null default 'normal' check (mode in ('normal', 'singkat')),
  plan jsonb not null default '[]',                        -- target beban/reps per gerakan (hasil hitungan kode)
  status text not null default 'disarankan' check (status in ('disarankan', 'dikerjakan', 'dilewati')),
  created_at timestamptz not null default now()
);

create table if not exists daily_summaries (
  id bigint generated always as identity primary key,
  summary_date date not null unique,
  summary_text text not null,
  raw_numbers jsonb not null default '{}',                 -- angka yang dipakai AI
  created_at timestamptz not null default now()
);

-- ---------- 6. Berat badan dan komposisi (Tanita) ----------
create table if not exists body_measurements (
  id bigint generated always as identity primary key,
  measured_at timestamptz not null,
  weight_kg numeric(5,2) not null,
  body_fat_pct numeric(4,1),
  muscle_mass_kg numeric(5,2),
  muscle_score numeric(4,1),
  bmi numeric(4,1),
  muscle_quality numeric(5,1),
  visceral_fat numeric(4,1),
  bone_mass_kg numeric(4,2),
  body_water_pct numeric(4,1),
  bmr_kcal int,
  metabolic_age int,
  condition text not null default 'lainnya'
    check (condition in ('pagi_puasa', 'setelah_makan', 'setelah_olahraga', 'lainnya')),
  source text not null default 'manual' check (source in ('manual', 'telegram', 'foto_tanita')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_body_date on body_measurements (measured_at desc);

-- ---------- 7. Pendukung ----------
create table if not exists ai_usage_log (
  id bigint generated always as identity primary key,
  feature text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  est_cost_usd numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists telegram_updates (
  update_id bigint primary key,                            -- cegah input dobel
  processed_at timestamptz not null default now()
);

-- ---------- 8. Keamanan ----------
-- RLS aktif tanpa policy = kunci publishable/anon TIDAK bisa baca/tulis apa pun.
-- Hanya server (secret key) yang bisa akses. Policy login dashboard ditambah di Fase 3.
alter table settings               enable row level security;
alter table exercises              enable row level security;
alter table program_days           enable row level security;
alter table program_day_exercises  enable row level security;
alter table workout_sessions       enable row level security;
alter table workout_sets           enable row level security;
alter table daily_plans            enable row level security;
alter table daily_summaries        enable row level security;
alter table body_measurements      enable row level security;
alter table ai_usage_log           enable row level security;
alter table telegram_updates       enable row level security;

-- =====================================================================
-- DATA AWAL
-- =====================================================================

-- Gerakan (alat standar gym: barbell, Smith machine, cable, dumbbell, leg press)
insert into exercises (name, aliases, muscle_group, kind, body_region, equipment, increment_kg) values
  ('Barbell Back Squat',       '{squat,sq,back squat}',                         'Kaki',               'compound',  'lower', 'Barbell + rack',   5),
  ('Bench Press',              '{bench,bp,bench press}',                        'Dada',               'compound',  'upper', 'Barbell + bench',  2.5),
  ('Barbell Row',              '{row,brow,barbell row}',                        'Punggung',           'compound',  'upper', 'Barbell',          2.5),
  ('Overhead Press',           '{ohp,press,overhead press,shoulder press}',     'Bahu',               'compound',  'upper', 'Barbell',          2.5),
  ('Romanian Deadlift',        '{rdl,romanian deadlift}',                       'Hamstring & glutes', 'compound',  'lower', 'Barbell',          5),
  ('Lat Pulldown',             '{pulldown,lat pulldown,lat}',                   'Punggung',           'compound',  'upper', 'Cable machine',    2.5),
  ('Leg Press',                '{leg press,lp}',                                'Kaki',               'compound',  'lower', 'Leg press',        5),
  ('Smith Machine Squat',      '{smith squat,smith}',                           'Kaki',               'compound',  'lower', 'Smith machine',    5),
  ('Incline Dumbbell Press',   '{incline,incline press,incline db}',            'Dada',               'compound',  'upper', 'Dumbbell + bench', 2.5),
  ('Seated Cable Row',         '{cable row,seated row}',                        'Punggung',           'compound',  'upper', 'Cable machine',    2.5),
  ('Dumbbell Lateral Raise',   '{lateral raise,lat raise,side raise}',          'Bahu',               'isolation', 'upper', 'Dumbbell',         1),
  ('Triceps Pushdown',         '{pushdown,tricep pushdown,triceps pushdown}',   'Trisep',             'isolation', 'upper', 'Cable machine',    2.5),
  ('Cable Biceps Curl',        '{curl,bicep curl,cable curl}',                  'Bisep',              'isolation', 'upper', 'Cable machine',    2.5),
  ('Face Pull',                '{face pull,facepull}',                          'Bahu belakang',      'isolation', 'upper', 'Cable machine',    2.5),
  ('Cable Crunch',             '{crunch,cable crunch}',                         'Perut',              'isolation', 'upper', 'Cable machine',    2.5),
  ('Overhead Triceps Extension','{overhead extension,tricep extension}',        'Trisep',             'isolation', 'upper', 'Cable machine',    2.5)
on conflict (name) do nothing;

-- Program Full Body A / B / C (antrean: A → B → C → A → ...)
insert into program_days (position, name) values
  (1, 'Full Body A'),
  (2, 'Full Body B'),
  (3, 'Full Body C')
on conflict (position) do nothing;

insert into program_day_exercises (program_day_id, exercise_id, position, sets, rep_min, rep_max, is_core)
select d.id, e.id, v.pos, v.sets, v.rmin, v.rmax, v.core
from (values
  -- Full Body A
  (1, 'Barbell Back Squat',          1, 3,  6,  8, true),
  (1, 'Bench Press',                 2, 3,  6, 10, true),
  (1, 'Barbell Row',                 3, 3,  8, 10, true),
  (1, 'Dumbbell Lateral Raise',      4, 2, 12, 15, false),
  (1, 'Triceps Pushdown',            5, 2, 10, 12, false),
  -- Full Body B
  (2, 'Romanian Deadlift',           1, 3,  8, 10, true),
  (2, 'Overhead Press',              2, 3,  6, 10, true),
  (2, 'Lat Pulldown',                3, 3,  8, 12, true),
  (2, 'Leg Press',                   4, 2, 10, 12, false),
  (2, 'Cable Biceps Curl',           5, 2, 10, 12, false),
  (2, 'Face Pull',                   6, 2, 12, 15, false),
  -- Full Body C
  (3, 'Smith Machine Squat',         1, 3,  8, 10, true),
  (3, 'Incline Dumbbell Press',      2, 3,  8, 12, true),
  (3, 'Seated Cable Row',            3, 3,  8, 12, true),
  (3, 'Cable Crunch',                4, 2, 12, 15, false),
  (3, 'Overhead Triceps Extension',  5, 2, 10, 12, false)
) as v(day_pos, ex_name, pos, sets, rmin, rmax, core)
join program_days d on d.position = v.day_pos
join exercises e on e.name = v.ex_name
on conflict (program_day_id, position) do nothing;

-- Timbangan awal (Tanita RD-953AS, 30 Okt 2026 17.52 WIB). Nilai sudah dikoreksi
-- dari pergeseran satu baris di tampilan app. Bukan kondisi standar (sore hari).
insert into body_measurements
  (measured_at, weight_kg, body_fat_pct, muscle_mass_kg, muscle_score, bmi, muscle_quality,
   visceral_fat, bone_mass_kg, body_water_pct, bmr_kcal, metabolic_age, condition, source, note)
select
  '2026-10-30 17:52:00+07', 71.10, 19.5, 54.25, 0, 22.4, 68,
  7.5, 3.00, 53.7, 1625, 24, 'lainnya', 'foto_tanita',
  'Timbangan awal dari screenshot. Perlu ditimbang ulang pagi hari sebagai baseline resmi.'
where not exists (
  select 1 from body_measurements where measured_at = '2026-10-30 17:52:00+07'
);
