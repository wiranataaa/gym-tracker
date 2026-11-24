-- Beban di Fithub Tebet kelipatan 2 kg. Kenaikan per gerakan disesuaikan.
-- (Sudah diterapkan ke database lewat API pada 2026-11-24; file ini sebagai catatan dan aman dijalankan ulang.)
update exercises set increment_kg = 2 where body_region = 'upper';
update exercises set increment_kg = 4 where body_region = 'lower';
