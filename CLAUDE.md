# Gym Tracker Pribadi Nata — Brief Proyek untuk Claude Code

> File ini adalah brief utama proyek. Baca seluruhnya sebelum mulai kerja, dan ikuti aturan di bagian "Cara Kerja dengan Nata".

---

## 1. Tentang proyek ini

Aplikasi gym tracker pribadi (1 pengguna, yaitu Nata) yang terdiri dari:

1. **Bot Telegram** sebagai antarmuka harian utama (log latihan, kirim foto makanan, terima menu pagi, terima kesimpulan malam).
2. **Dashboard web** untuk lihat riwayat, grafik progres, nutrisi, dan komposisi badan.
3. **AI (Claude API)** untuk kesimpulan latihan harian, saran menu latihan tiap pagi, dan estimasi kalori/protein dari foto makanan.

### Masalah yang mau diselesaikan
- Nata latihan gym **on-off**, sudah lebih dari seminggu tidak gym karena merasa capek dan tidak ada progres.
- Dia capek **mikir menu latihan** tiap kali mau ke gym.
- Tidak ada catatan latihan, jadi **progres tidak kelihatan**, dan motivasi turun.
- Tidak tahu apakah **kalori dan protein harian** sudah cukup.

### Prinsip desain
- **Konsistensi > kesempurnaan.** Aplikasi harus bikin datang ke gym jadi gampang, bukan menambah beban.
- **Input secepat mungkin.** Log satu set harus bisa dalam beberapa detik dari HP.
- **Kode yang menghitung, AI yang menjelaskan.** Semua angka (target beban, volume, PR, total kalori, rata-rata berat) dihitung oleh kode. AI hanya menerima angka hasil hitungan dan menuliskan penjelasan/saran. AI **tidak boleh mengarang angka**.
- **Ramah on-off.** Kalau Nata bolos, program tidak "rusak". Menu berikutnya tetap jalan dari urutan terakhir.

---

## 2. Cara kerja dengan Nata (WAJIB)

- Nata **bukan programmer** ("awam soal coding"). Dia pakai **Claude Code lewat aplikasi desktop Claude**, di **laptop Windows** (HP Pavilion Gaming 15). Folder user Windows-nya `C:\Users\ayuke` (nama pemilik lama, bukan typo). Perintah `claude` tidak tersedia di PowerShell-nya.
- Untuk **setiap langkah yang harus Nata lakukan sendiri** di dashboard pihak ketiga (Supabase, Vercel, Telegram BotFather, Anthropic Console, Google Cloud, dll.):
  - Jelaskan langkahnya **sangat detail sampai nama menu dan tombolnya** (contoh: "Klik **Project Settings** di sidebar kiri bawah → tab **API** → copy nilai **Project URL**").
  - Satu langkah besar per pesan, lalu **tunggu Nata bilang sudah selesai** sebelum lanjut.
  - Beri tahu persis nilai apa yang harus dia copy dan ke mana menempelkannya.
- Komunikasi dalam **bahasa Indonesia santai** (pakai "gua/lo" boleh). UI aplikasi dan pesan bot juga bahasa Indonesia santai.
- Jangan pernah commit secret. Semua API key di `.env.local` (lokal) dan Environment Variables di Vercel. Pastikan `.env*` masuk `.gitignore`.
- Sebelum deploy, tes dulu. Setelah deploy, beri Nata cara mengecek bahwa semuanya jalan (misal: "kirim /start ke bot, harusnya dibalas ...").
- Kalau ada biaya (API Claude, plan berbayar), sampaikan perkiraan secara jujur sebelum mengaktifkan.
- Nata lebih nyaman lihat data di **Google Sheets** daripada Excel. Kalau butuh export, utamakan Google Sheets / CSV yang bisa dibuka di Google Sheets.

### Pertanyaan pembuka (tanyakan ke Nata di awal sesi pertama, sebelum menyusun program)
1. Realistisnya **berapa kali seminggu** bisa ke gym? (3x / 4x / 5x)
2. Hari apa saja yang paling memungkinkan? Jam berapa biasanya latihan?
3. Alat apa saja yang ada di gym-nya? (barbell, rack, dumbbell sampai berapa kg, mesin cable, leg press, dll.)
4. Ada cedera atau gerakan yang perlu dihindari?
5. Tinggi badan pasti dan umur (untuk hitungan kalori). Perkiraan dari BMI di timbangan: ±178 cm.

---

## 3. Data awal dan target

### Hasil timbangan awal (Tanita RD-953AS, 30 Okt 2026, jam 17.52)

> **Catatan penting:** tampilan app Tanita di HP Nata **bergeser satu baris** (nilai muncul satu baris di bawah labelnya). Mapping yang benar:

| Metrik | Nilai | Keterangan app |
|---|---|---|
| Berat | 71,10 kg | — |
| Body fat | 19,5% | Healthy(+) |
| Muscle mass | 54,25 kg | Average |
| Muscle score | 0 | — |
| BMI | 22,4 | Healthy |
| Muscle quality | 68 | Average |
| Visceral fat level | 7,5 | Average |
| Bone mass | 3,00 kg | Average |
| Body water | 53,7% | — |
| BMR | 1.625 kcal | Average |
| Metabolic age | 24 | — |

Turunan: massa lemak ≈ 13,9 kg, massa bebas lemak ≈ 57,2 kg.

Interpretasi: sehat tapi "rata-rata". Body fat di batas atas range sehat pria, otot standar (muscle score 0). Pola khas latihan yang tidak konsisten.

### Target
- **Target utama:** ±**75 kg sebelum Lebaran 2027** (Idul Fitri diperkirakan ±9–10 Maret 2027) dengan **body fat tetap di bawah 20%**.
- **Target lanjutan:** 78 kg **setelah** Lebaran. 78 kg sebelum Lebaran dinilai terlalu agresif (butuh ±0,5 kg/minggu, sebagian besar bakal jadi lemak).
- **Laju naik berat yang dituju:** +0,3 s.d. +0,4 kg/minggu (lean bulk).
- **Ramadan** (perkiraan mulai ±8 Feb 2027): fokus **mempertahankan** berat dan kekuatan, bukan menambah.
- Tanggal Ramadan dan Lebaran harus bisa diubah di pengaturan (jangan hardcode), karena tanggal resmi ditetapkan pemerintah.
- Data timbangan di atas sudah hampir sebulan. **Minta Nata timbang ulang** saat aplikasi pertama kali jalan dan jadikan itu baseline resmi.

### Target nutrisi awal
- **Kalori:** 2.600–2.800 kcal/hari (perkiraan maintenance 2.300–2.500 + surplus kecil). Mulai dari **2.700**.
- **Protein:** **130–140 g/hari** (±1,8–2 g/kg). Target harian default 135 g.
- Penyesuaian otomatis mingguan (lihat bagian 6.4).

---

## 4. Tech stack

Samakan dengan proyek Nata yang lain biar familiar:

- **Next.js** (App Router, TypeScript) di-deploy ke **Vercel**
- **Supabase** (Postgres + Storage untuk foto makanan/timbangan)
- **Telegram Bot API** via **webhook** ke route Next.js (`/api/telegram`)
- **Claude API (Anthropic)** untuk teks dan vision (baca foto). Cek dokumentasi Anthropic untuk model terbaru yang mendukung vision; pilih yang seimbang antara kualitas dan biaya.
- **Penjadwalan:** Vercel Cron untuk menu pagi, kesimpulan malam, laporan mingguan. **Cek limit cron di plan Vercel yang dipakai Nata** (plan gratis punya batasan jumlah dan frekuensi). Kalau tidak cukup, pakai **Supabase pg_cron** atau **GitHub Actions** sebagai pemicu.
- **Zona waktu:** semua logika "hari ini" pakai **Asia/Jakarta (WIB, UTC+7)**. Ingat cron Vercel pakai UTC (06.00 WIB = 23.00 UTC hari sebelumnya).
- **Grafik dashboard:** library chart sederhana (misal Recharts).
- **Login dashboard:** Google login (Supabase Auth) yang hanya mengizinkan email Nata. Satu pengguna saja.

### Catatan teknis penting
- **Keamanan bot:** whitelist `chat_id` Telegram milik Nata saja. Pesan dari chat lain diabaikan. Pasang `secret_token` di webhook dan verifikasi header `X-Telegram-Bot-Api-Secret-Token`.
- **Timeout:** proses foto + panggilan Claude bisa lebih lama dari batas fungsi serverless. Atur `maxDuration` di route, kirim balasan cepat ("Lagi gua hitung...") lalu edit pesan setelah hasil keluar.
- **Idempoten:** Telegram mengulang update kalau tidak dapat respons 200. Simpan `update_id` yang sudah diproses supaya tidak dobel input.
- **Biaya AI:** log jumlah token per panggilan di tabel supaya biaya bulanan bisa dipantau di dashboard.

---

## 5. Model data (usulan, boleh disesuaikan)

- `settings` — tinggi, umur, target berat, target kalori/protein, frekuensi latihan per minggu, hari latihan, jam kirim menu pagi, tanggal Ramadan & Lebaran, mode Ramadan on/off, chat_id Telegram.
- `exercises` — nama gerakan (+ alias untuk parsing, misal "bench", "bp", "bench press"), kelompok otot, tipe (compound/isolation), alat, langkah kenaikan beban default.
- `program_templates` / `program_days` / `program_day_exercises` — split latihan, urutan hari, gerakan per hari, set, rentang reps (misal 8–12), urutan.
- `workout_sessions` — tanggal, program_day, mulai/selesai, mode (normal/singkat), catatan, perasaan/energi (1–5).
- `workout_sets` — session, exercise, nomor set, beban (kg), reps, RPE opsional, warm-up atau working set.
- `daily_plans` — menu yang disarankan tiap pagi (gerakan + target beban/reps hasil hitungan kode), status (dikerjakan/dilewati).
- `daily_summaries` — kesimpulan AI per hari (teks) + angka mentah yang dipakai.
- `meals` / `meal_items` — waktu, foto (Storage), item makanan, porsi (gram), kcal, protein, karbo, lemak, tingkat keyakinan AI, sudah dikonfirmasi atau belum.
- `favorite_foods` — makanan yang sering dimakan beserta nilai gizinya yang sudah dikoreksi.
- `body_measurements` — tanggal, jam, berat, body fat %, muscle mass, muscle score, BMI, muscle quality, visceral fat, bone mass, body water %, BMR, metabolic age, kondisi saat timbang (pagi/puasa/setelah makan).
- `ai_usage_log` — fitur, model, token masuk/keluar, perkiraan biaya.
- `telegram_updates` — update_id yang sudah diproses.

---

## 6. Fitur lengkap

### 6.1 Log latihan (Telegram + web)
- `/mulai` → bot kirim menu hari ini dan memulai sesi.
- Format input cepat, contoh yang harus didukung:
  - `bench 60x10` (1 set)
  - `bench 60x10x3` (3 set sama)
  - `bench 60 10,10,9` (3 set, reps berbeda)
  - `squat 80 8 8 7 rpe8`
- Kalau format tidak dikenali, pakai Claude untuk mem-parsing bahasa bebas ("tadi bench 60 kilo 10 kali 3 set"), lalu **konfirmasi dulu** ke Nata sebelum disimpan.
- Setelah tiap input, bot balas singkat: set tercatat + perbandingan dengan sesi sebelumnya ("Minggu lalu 57,5×10. Naik 👍").
- Tombol inline: **Set berikutnya**, **Gerakan berikutnya**, **Lewati gerakan**, **Selesai**.
- `/selesai` → tutup sesi, tanya energi (1–5), lalu kirim kesimpulan AI.
- Web: halaman input yang sama untuk yang lebih suka layar besar, dan untuk edit/hapus set yang salah.

### 6.2 Program latihan dan menu pagi otomatis
- Program disusun berdasarkan jawaban pertanyaan pembuka:
  - **3x/minggu** → Full Body A / B / C
  - **4x/minggu** → Upper / Lower / Upper / Lower
  - **5x/minggu** → Upper / Lower / Push / Pull / Legs
- Fokus gerakan compound utama (squat, bench press, row, overhead press, Romanian deadlift/deadlift, pull-up/lat pulldown) + aksesori secukupnya. Durasi target 60–75 menit.
- **Sistem antrean, bukan kalender.** Menu berikutnya = hari berikutnya di urutan program, bukan berdasarkan hari dalam seminggu. Bolos tidak merusak program.
- **Tiap pagi (default 06.00 WIB, bisa diatur)** bot mengirim:
  - Menu latihan hari ini lengkap dengan **target beban dan reps per gerakan** (dihitung kode, bukan AI)
  - Kalau hari ini jadwal istirahat: bilang istirahat + saran ringan (jalan kaki/stretching)
  - Rekap singkat kemarin (latihan + kalori/protein)
  - Target kalori dan protein hari ini
  - Satu kalimat penyemangat/fokus dari AI yang relevan dengan data (bukan kata-kata motivasi generik)
- **Mode singkat (untuk hari capek):** tombol **"Lagi capek, versi 30 menit"** → kode memotong menu ke 2–3 gerakan compound utama, tetap tercatat sebagai latihan. Tujuannya supaya Nata tetap datang walau energi rendah.
- Tombol di pesan pagi: **Gas, mulai** / **Versi singkat** / **Hari ini skip**.

### 6.3 Aturan progressive overload (dihitung kode)
- **Double progression** dengan rentang reps per gerakan (misal 8–12):
  - Semua working set mencapai **batas atas** rentang (dan RPE ≤ 8 kalau diisi) → sesi berikutnya naik beban:
    - Compound tubuh atas: +2,5 kg
    - Compound tubuh bawah: +5 kg
    - Dumbbell/isolation: naik ke langkah dumbbell/beban berikutnya yang tersedia
  - Belum mencapai batas atas → beban sama, target tambah 1 rep.
  - **Gagal mencapai batas bawah 2 sesi berturut-turut** → turunkan beban 5–10%.
- **Kembali dari libur:**
  - Libur 7–13 hari → sesi pertama pakai ±90% beban terakhir.
  - Libur ≥14 hari → ±80%, lalu naik bertahap.
  - (Ini langsung berlaku di awal karena Nata sudah libur lebih dari seminggu.)
- **Deload:** tiap 6–8 minggu, atau kalau performa turun di banyak gerakan 2 sesi berturut-turut → minggu ringan (volume ±50–60%). Bot memberi tahu dan menjelaskan alasannya.
- **PR (personal record):** deteksi otomatis berdasarkan estimasi 1RM (rumus Epley) dan reps terbanyak di beban yang sama. Rayakan di bot 🎉.

### 6.4 Nutrisi: kalori dan protein
- **Kirim foto makanan ke bot** → Claude vision mengembalikan JSON terstruktur: daftar item, perkiraan porsi (gram), kcal, protein, karbo, lemak, tingkat keyakinan, dan rentang kcal (min–maks).
- Instruksi prompt untuk vision:
  - Paham makanan Indonesia (nasi padang, ayam geprek, gado-gado, soto, nasi goreng, gorengan, warteg, dll.).
  - **Perhitungkan minyak goreng, santan, dan saus yang tidak terlihat.** Makanan Indonesia sering lebih tinggi kalori dari kelihatannya.
  - Kalau ragu, beri rentang dan tanyakan porsi.
- Bot menampilkan hasil + tombol: **✅ Simpan**, **✏️ Ubah porsi** (½ / 1 / 1½ / 2 atau ketik gram), **⭐ Simpan sebagai favorit**.
- **Input teks juga bisa:** "nasi putih 1 piring + ayam bakar paha + tempe 2" → dihitung dengan cara yang sama.
- **Favorit:** `/fav` menampilkan makanan favorit untuk input satu ketukan. Nilai favorit adalah nilai yang sudah dikoreksi Nata, jadi lama-lama makin akurat.
- Setelah tiap input makan: tampilkan **progres harian** (contoh: "1.450 / 2.700 kcal · Protein 62 / 135 g").
- **Pengingat protein** (jam bisa diatur, default 19.00 WIB): kalau protein masih jauh dari target, kirim saran makanan tinggi protein yang praktis (telur, dada ayam, tempe, tahu, susu, whey, ikan) beserta jumlah yang dibutuhkan untuk menutup kekurangan.
- Catatan kejujuran: tampilkan di dashboard bahwa estimasi foto bisa meleset ±20–30%. Yang penting konsistensi tren, bukan presisi per piring.
- **Penyesuaian kalori mingguan otomatis** (dijalankan tiap Minggu):
  - Pakai **rata-rata bergerak 7 hari** berat badan, bukan satu angka timbangan.
  - Naik < 0,2 kg/minggu selama 2 minggu → target kalori +150 kcal.
  - Naik > 0,5 kg/minggu → target kalori −150 kcal.
  - Di rentang 0,2–0,5 → tetap.
  - Kirim penjelasan perubahannya ke Nata.

### 6.5 Komposisi badan dan timbangan
- `/timbang 71.4` untuk input cepat berat badan (idealnya tiap pagi, atau minimal 3x seminggu).
- **Foto layar app Tanita** → Claude vision membaca semua metrik. **Penting:** layar app Tanita RD-953AS di HP Nata menampilkan nilai **bergeser satu baris** dari labelnya. Prompt vision harus diberi tahu ini dan memakai urutan metrik di bagian 3. Tampilkan hasil baca untuk dikonfirmasi sebelum disimpan.
- **Panduan kondisi timbang** (ditampilkan di bot & dashboard): pagi hari, setelah ke toilet, sebelum makan/minum, sebelum olahraga. Hasil BIA (body fat, air, otot) sangat dipengaruhi hidrasi, jadi kondisi harus sama tiap kali.
- Simpan **kondisi saat timbang**; grafik bisa menandai data yang tidak diambil dalam kondisi standar.
- Pengingat timbang komposisi badan lengkap: tiap **Minggu pagi**.

### 6.6 Kesimpulan AI harian (malam)
- Dikirim setelah `/selesai`, atau otomatis jam 21.00 WIB kalau ada data hari itu.
- Kode menyiapkan data dulu: total volume per kelompok otot, perbandingan dengan sesi yang sama sebelumnya, PR, gerakan yang naik/turun/stagnan, energi yang dilaporkan, total kalori/protein vs target.
- AI menuliskan (singkat, bahasa santai):
  - **Apa yang berubah** dibanding sesi sebelumnya
  - **Apa yang perlu dipertahankan**
  - **Apa yang perlu diperbaiki** (maks 1–2 poin, konkret)
  - Status nutrisi hari itu
  - Gambaran besok (latihan apa / istirahat)
- Kalau hari istirahat: kesimpulan nutrisi saja.

### 6.7 Laporan mingguan (Minggu malam)
- Jumlah sesi vs target (**skor konsistensi %**), streak minggu konsisten
- Tren berat (rata-rata 7 hari), perubahan dibanding minggu lalu, proyeksi ke target 75 kg di tanggal Lebaran
- PR minggu ini, gerakan yang stagnan
- Rata-rata kalori dan protein, berapa hari target protein tercapai
- Penyesuaian kalori untuk minggu depan (dari 6.4)
- Peringatan deload kalau perlu

### 6.8 Mode Ramadan
- Aktif otomatis berdasarkan tanggal di pengaturan (bisa juga dinyalakan/dimatikan manual dengan `/ramadan`).
- Target berubah ke **maintenance** (pertahankan berat dan kekuatan).
- Target kalori dan protein dibagi ke **sahur** dan **buka/malam**, dengan saran praktis (protein cukup saat sahur, minum air yang cukup di malam hari).
- Saran waktu latihan: menjelang buka (versi ringan/singkat) atau setelah tarawih.
- Volume latihan sedikit dikurangi; mode singkat lebih sering disarankan.
- Pesan pagi dipindah ke setelah sahur (jamnya bisa diatur).

### 6.9 Dashboard web
- **Hari ini:** menu latihan, progres kalori/protein, tombol cepat
- **Riwayat latihan:** daftar sesi, detail set per sesi, edit/hapus
- **Progres per gerakan:** grafik beban dan estimasi 1RM per gerakan, daftar PR
- **Nutrisi:** ringkasan harian/mingguan, daftar makan dengan foto, kelola favorit
- **Badan:** grafik berat (titik harian + garis rata-rata 7 hari + garis target menuju 75 kg di tanggal Lebaran), body fat %, muscle mass, visceral fat
- **Program & pengaturan:** ubah split, gerakan, rentang reps, jam notifikasi, target, tanggal Ramadan/Lebaran
- **Biaya AI:** pemakaian token dan perkiraan biaya bulan ini
- Tampilan **mobile-first** (paling sering dibuka di HP). Bisa dipasang sebagai PWA.
- Fitur tambahan: **export ke Google Sheets / CSV** (riwayat latihan, nutrisi, timbangan).

### 6.10 Daftar perintah bot
| Perintah | Fungsi |
|---|---|
| `/start` | Daftarkan chat (hanya chat_id Nata) |
| `/hari_ini` | Lihat menu latihan + target nutrisi hari ini |
| `/mulai` | Mulai sesi latihan |
| (teks set) | Log set, contoh `bench 60x10x3` |
| `/selesai` | Tutup sesi + kesimpulan AI |
| `/singkat` | Ubah menu hari ini ke versi 30 menit |
| `/skip` | Lewati latihan hari ini (antrean tidak maju) |
| (foto makanan) | Estimasi kalori & protein |
| `/makan <teks>` | Input makanan lewat teks |
| `/fav` | Pilih makanan favorit |
| `/timbang <kg>` | Input berat badan |
| (foto layar Tanita) | Input komposisi badan lengkap |
| `/status` | Ringkasan minggu ini + progres menuju target |
| `/ramadan` | Nyalakan/matikan mode Ramadan |
| `/bantuan` | Daftar perintah |

---

## 7. Gaya pesan AI
- Bahasa Indonesia santai, singkat, langsung ke inti. Seperti teman gym yang paham data.
- Selalu sebut angka spesifik (yang sudah dihitung kode).
- Jujur: kalau progres stagnan atau nutrisi kurang, bilang dengan jelas plus satu saran konkret.
- Hindari motivasi generik yang tidak berhubungan dengan data.
- Tidak memberi saran medis. Kalau Nata melaporkan nyeri atau cedera, sarankan istirahatkan bagian itu dan konsultasi ke tenaga kesehatan kalau berlanjut.

---

## 8. Tahapan pengerjaan

### Fase 0 — Setup (bareng Nata, langkah detail)
1. Tanyakan pertanyaan pembuka (bagian 2).
2. Buat bot di **@BotFather** → dapatkan token.
3. Buat project **Supabase** → URL + key.
4. Buat **API key Anthropic** di Anthropic Console (jelaskan juga soal billing/kredit).
5. Siapkan repo GitHub + project **Vercel**, isi Environment Variables.
6. Pasang webhook Telegram.

### Fase 1 — MVP (prioritas, langsung menyelesaikan masalah utama)
- Skema database + seed daftar gerakan
- Program latihan sesuai frekuensi Nata + sistem antrean
- Log latihan via bot (format cepat + parsing AI dengan konfirmasi)
- Aturan progressive overload + aturan kembali dari libur
- Menu pagi otomatis + mode singkat
- Kesimpulan AI malam
- `/timbang` dasar

### Fase 2 — Nutrisi
- Foto makanan → estimasi + konfirmasi + ubah porsi
- Input teks makanan, favorit
- Progres harian, pengingat protein
- Penyesuaian kalori mingguan

### Fase 3 — Dashboard & badan
- Dashboard web lengkap dengan grafik
- Baca foto layar Tanita (dengan koreksi pergeseran baris)
- Laporan mingguan, skor konsistensi, streak
- Mode Ramadan

### Fase 4 — Pelengkap
- Deteksi deload otomatis
- Export ke Google Sheets
- Monitor biaya AI
- PWA

Selesaikan dan uji tiap fase dengan Nata sebelum lanjut ke fase berikutnya. Di akhir tiap fase, beri ringkasan singkat: apa yang sudah jalan, cara mencobanya, dan apa yang berikutnya.
