-- =====================================================================
-- Gym Tracker Nata — Migrasi 007: mode Ramadan otomatis + pengaturan
--  * kcal_maintenance: target kalori saat Ramadan (jaga berat, bukan menambah)
--  * ramadan_override: 'auto' (ikut tanggal), 'on' (paksa aktif), 'off' (paksa mati)
-- Aman dijalankan ulang. Cara pakai: Supabase → SQL Editor → New query → paste → Run.
-- =====================================================================

alter table settings add column if not exists kcal_maintenance int not null default 2450;
alter table settings add column if not exists ramadan_override text not null default 'auto';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'settings_ramadan_override_check') then
    alter table settings add constraint settings_ramadan_override_check check (ramadan_override in ('auto', 'on', 'off'));
  end if;
end $$;

-- Kalau sebelumnya mode Ramadan sudah dinyalakan manual lewat kolom lama, pertahankan
update settings set ramadan_override = 'on' where ramadan_mode = true and ramadan_override = 'auto';
