-- =====================================================================
-- Gym Tracker Nata — Migrasi 011
--  1. Nama gerakan dibuat jelas alatnya (mis. "Overhead Press" -> "Barbell Overhead Press"),
--     nama lama tetap dikenali waktu diketik di bot.
--  2. Menu dipangkas supaya muat ±1 jam: maksimal 5 gerakan (±13 set) + kardio 15-20 menit.
--     Riwayat latihan yang sudah tercatat TIDAK berubah/terhapus.
--  3. Kolom buat fitur "lewati sisa set".
-- Aman dijalankan ulang. Cara pakai: Supabase → SQL Editor → New query → paste semua → Run.
-- Catatan: setelah ini jangan jalankan ulang file 001 atau 006 (bisa memunculkan nama lama lagi).
-- =====================================================================

-- ---------- 1. Nama gerakan ----------
with ganti(lama, baru) as (
  values
    ('Bench Press',                'Barbell Bench Press'),
    ('Overhead Press',             'Barbell Overhead Press'),
    ('Romanian Deadlift',          'Barbell Romanian Deadlift'),
    ('Lat Pulldown',               'Cable Lat Pulldown'),
    ('Face Pull',                  'Cable Face Pull'),
    ('Triceps Pushdown',           'Cable Triceps Pushdown'),
    ('Overhead Triceps Extension', 'Cable Overhead Triceps Extension'),
    ('Hip Thrust',                 'Barbell Hip Thrust'),
    ('Standing Calf Raise',        'Smith Machine Calf Raise'),
    ('Walking Lunge',              'Dumbbell Walking Lunge')
)
update exercises e
set name = g.baru,
    aliases = case when lower(g.lama) = any(e.aliases) then e.aliases else array_append(e.aliases, lower(g.lama)) end
from ganti g
where e.name = g.lama
  and not exists (select 1 from exercises x where x.name = g.baru);

-- ---------- 2. Menu muat 1 jam ----------
-- Buang aksesori paling "tumpang tindih" dari hari yang kebanyakan:
--   A: triceps pushdown (trisep sudah kena bench, dan ada di C)
--   B: face pull
--   D: cable fly dan triceps pushdown
delete from program_day_exercises pde
using program_days d, exercises e
where pde.program_day_id = d.id
  and pde.exercise_id = e.id
  and (d.name, e.name) in (
    ('Full Body A',          'Cable Triceps Pushdown'),
    ('Full Body B',          'Cable Face Pull'),
    ('Bonus D — Upper Pump', 'Cable Fly'),
    ('Bonus D — Upper Pump', 'Cable Triceps Pushdown')
  );

update program_day_exercises pde
set sets = 2
from program_days d, exercises e
where pde.program_day_id = d.id
  and pde.exercise_id = e.id
  and (d.name, e.name) in (
    ('Full Body A',            'Hanging Leg Raise'),
    ('Bonus D — Upper Pump',   'Dumbbell Lateral Raise'),
    ('Bonus E — Lower Ringan', 'Smith Machine Calf Raise')
  );

-- ---------- 3. Lewati sisa set ----------
alter table workout_sessions add column if not exists skipped_exercises jsonb not null default '[]';
