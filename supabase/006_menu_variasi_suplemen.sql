-- =====================================================================
-- Gym Tracker Nata — Migrasi 006
--  * menu variasi: hari "bonus" (D/E/F) selain hari utama (A/B/C), gerakan perut, gerakan bodyweight
--  * kardio per sesi, kondisi timbang "sebelum latihan"
--  * suplemen: creatine (checklist harian) dan whey (dihitung ke kalori/protein)
-- Aman dijalankan ulang. Cara pakai: Supabase → SQL Editor → New query → paste semua → Run.
-- =====================================================================

-- ---------- 1. Struktur ----------
alter table exercises        add column if not exists is_bodyweight boolean not null default false;
alter table workout_sessions add column if not exists cardio_min int check (cardio_min is null or cardio_min between 0 and 240);

alter table program_days add column if not exists kind text not null default 'utama';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'program_days_kind_check') then
    alter table program_days add constraint program_days_kind_check check (kind in ('utama', 'bonus'));
  end if;
end $$;

-- urutan sekarang unik per jenis (utama 1-3, bonus 1-3), bukan global
alter table program_days drop constraint if exists program_days_position_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'program_days_kind_position_key') then
    alter table program_days add constraint program_days_kind_position_key unique (kind, position);
  end if;
end $$;

-- kondisi timbang: tambah "sebelum_latihan" (timbang di gym sebelum mulai latihan)
do $$ declare c text; begin
  select conname into c from pg_constraint
   where conrelid = 'body_measurements'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%pagi_puasa%';
  if c is not null then execute format('alter table body_measurements drop constraint %I', c); end if;
end $$;
alter table body_measurements drop constraint if exists body_measurements_condition_check;
alter table body_measurements add constraint body_measurements_condition_check
  check (condition in ('pagi_puasa', 'sebelum_latihan', 'setelah_makan', 'setelah_olahraga', 'lainnya'));

-- ---------- 2. Suplemen ----------
create table if not exists supplements (
  id bigint generated always as identity primary key,
  name text not null unique,
  dose_desc text not null,                         -- contoh: '5 g (±1 sendok teh)'
  kcal numeric(6,1) not null default 0,
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  aktif boolean not null default true,
  pengingat boolean not null default false,        -- diingatkan di pesan pagi/malam kalau belum diminum
  created_at timestamptz not null default now()
);

create table if not exists supplement_logs (
  id bigint generated always as identity primary key,
  log_date date not null,                          -- tanggal WIB
  supplement_id bigint not null references supplements(id) on delete cascade,
  meal_id bigint references meals(id) on delete set null,   -- untuk yang punya kalori/protein (whey)
  created_at timestamptz not null default now()
);
create index if not exists idx_supp_logs_date on supplement_logs (log_date desc);

alter table supplements     enable row level security;
alter table supplement_logs enable row level security;
grant all on supplements, supplement_logs to service_role;
grant all on all sequences in schema public to service_role;

insert into supplements (name, dose_desc, kcal, protein_g, carbs_g, fat_g, pengingat) values
  ('Creatine monohydrate', '5 g (±1 sendok teh)', 0, 0, 0, 0, true),
  ('Whey protein',         '1 scoop (±30 g)',   120, 24, 3, 1.5, false)
on conflict (name) do nothing;

-- ---------- 3. Gerakan baru (perut, bodyweight, variasi) ----------
insert into exercises (name, aliases, muscle_group, kind, body_region, equipment, increment_kg, is_bodyweight) values
  ('Dumbbell Shoulder Press',   '{db press,shoulder db,dumbbell press}',   'Bahu',               'compound',  'upper', 'Dumbbell + bench',   2, false),
  ('Dumbbell Curl',             '{db curl,bicep db}',                      'Bisep',              'isolation', 'upper', 'Dumbbell',           2, false),
  ('Cable Fly',                 '{fly,cable fly}',                         'Dada',               'isolation', 'upper', 'Cable machine',      2, false),
  ('One-Arm Dumbbell Row',      '{db row,one arm row,single arm row}',     'Punggung',           'compound',  'upper', 'Dumbbell + bench',   2, false),
  ('Dumbbell Romanian Deadlift','{db rdl}',                                'Hamstring & glutes', 'compound',  'lower', 'Dumbbell',           2, false),
  ('Walking Lunge',             '{lunge,walking lunge}',                   'Kaki',               'compound',  'lower', 'Dumbbell',           2, false),
  ('Hip Thrust',                '{hip thrust,thrust}',                     'Glutes',             'compound',  'lower', 'Barbell + bench',    4, false),
  ('Standing Calf Raise',       '{calf raise,calf,betis}',                 'Betis',              'isolation', 'lower', 'Smith machine',      4, false),
  ('Hanging Leg Raise',         '{leg raise,hanging leg raise,hlr}',       'Perut',              'isolation', 'upper', 'Captain chair / bar',2, true),
  ('Ab Wheel Rollout',          '{ab wheel,rollout,roda perut}',           'Perut',              'isolation', 'upper', 'Ab wheel',           2, true),
  ('Decline Sit-Up',            '{sit up,situp,decline situp,decline sit up}','Perut',           'isolation', 'upper', 'Bangku decline',     2, true)
on conflict (name) do nothing;

-- ---------- 4. Hari bonus (D/E/F) buat yang latihan lebih dari 3x seminggu ----------
insert into program_days (kind, position, name) values
  ('bonus', 1, 'Bonus D — Upper Pump'),
  ('bonus', 2, 'Bonus E — Lower Ringan'),
  ('bonus', 3, 'Bonus F — Kardio + Core (Recovery)')
on conflict (kind, position) do nothing;

insert into program_day_exercises (program_day_id, exercise_id, position, sets, rep_min, rep_max, is_core)
select d.id, e.id, v.pos, v.sets, v.rmin, v.rmax, v.core
from (values
  -- Bonus D: Upper Pump
  ('bonus', 1, 'Dumbbell Shoulder Press',  1, 3, 10, 12, true),
  ('bonus', 1, 'Incline Dumbbell Press',   2, 3, 10, 12, true),
  ('bonus', 1, 'One-Arm Dumbbell Row',     3, 3, 10, 12, true),
  ('bonus', 1, 'Cable Fly',                4, 2, 12, 15, false),
  ('bonus', 1, 'Dumbbell Lateral Raise',   5, 3, 12, 15, false),
  ('bonus', 1, 'Dumbbell Curl',            6, 2, 10, 12, false),
  ('bonus', 1, 'Triceps Pushdown',         7, 2, 12, 15, false),
  -- Bonus E: Lower Ringan
  ('bonus', 2, 'Leg Press',                1, 3, 12, 15, true),
  ('bonus', 2, 'Dumbbell Romanian Deadlift',2, 3, 10, 12, true),
  ('bonus', 2, 'Walking Lunge',            3, 2, 10, 12, true),
  ('bonus', 2, 'Hip Thrust',               4, 3, 10, 12, false),
  ('bonus', 2, 'Standing Calf Raise',      5, 3, 12, 15, false),
  -- Bonus F: Kardio + Core (hari pemulihan, beban ringan). Gerakan perutnya beda dari A dan C.
  ('bonus', 3, 'Ab Wheel Rollout',         1, 3,  8, 12, true),
  ('bonus', 3, 'Decline Sit-Up',           2, 3, 12, 15, true),
  ('bonus', 3, 'Hanging Leg Raise',        3, 2,  8, 12, false),
  -- Perut TIDAK tiap hari: cuma di Full Body A (Hanging Leg Raise), C (Cable Crunch yang sudah ada)
  -- dan Bonus F. B, D, dan E tanpa perut. Jadi sekitar tiap dua hari latihan, gerakannya bergantian.
  ('utama', 1, 'Hanging Leg Raise',        6, 3,  8, 15, false)
) as v(kind, day_pos, ex_name, pos, sets, rmin, rmax, core)
join program_days d on d.kind = v.kind and d.position = v.day_pos
join exercises e on e.name = v.ex_name
on conflict (program_day_id, position) do nothing;
