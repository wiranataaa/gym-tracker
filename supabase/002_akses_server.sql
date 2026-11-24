-- =====================================================================
-- Beri akses penuh ke SERVER saja (service_role / secret key).
-- anon & authenticated sengaja TIDAK diberi akses (data tetap terkunci dari publik).
-- Aman dijalankan ulang.
-- =====================================================================

grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Tabel yang dibuat di migrasi berikutnya otomatis ikut dapat akses
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
