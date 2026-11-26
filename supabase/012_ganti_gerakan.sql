-- =====================================================================
-- Gym Tracker Nata — Migrasi 012
--  * Kolom buat fitur "Ganti gerakan" (kalau alatnya penuh). Berlaku per sesi, program nggak berubah.
--  * 5 gerakan pengganti tambahan di luar area dumbbell (Smith machine, cable, barbell, leg press).
-- Aman dijalankan ulang. Cara pakai: Supabase → SQL Editor → New query → paste semua → Run.
-- =====================================================================

alter table workout_sessions add column if not exists swaps jsonb not null default '[]';

insert into exercises (name, aliases, muscle_group, kind, body_region, equipment, increment_kg, is_bodyweight) values
  ('Smith Machine Incline Press',  '{smith incline,incline smith}',        'Dada',  'compound',  'upper', 'Smith machine + bench', 4, false),
  ('Smith Machine Shoulder Press', '{smith shoulder press,smith ohp}',     'Bahu',  'compound',  'upper', 'Smith machine + bench', 4, false),
  ('Cable Lateral Raise',          '{cable lateral}',                      'Bahu',  'isolation', 'upper', 'Cable machine',         1, false),
  ('Barbell Curl',                 '{bb curl,barbell curl}',               'Bisep', 'isolation', 'upper', 'Barbell',               2, false),
  ('Leg Press Calf Raise',         '{leg press calf,calf leg press}',      'Betis', 'isolation', 'lower', 'Leg press',             4, false)
on conflict (name) do nothing;
