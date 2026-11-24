// Uji BACA-SAJA terhadap data asli: cetak pesan pengingat protein dan laporan mingguan ke konsol.
// Tidak mengirim ke Telegram, tidak menulis ke database, tidak mengubah target kalori.
// Jalankan: node --env-file=.env.local scripts/coba-malam.ts [YYYY-MM-DD hari Minggu]

import { laporanMingguan, pengingatProtein } from "../lib/bot/malam.ts";
import type { Keyboard } from "../lib/telegram.ts";
import { todayWIB } from "../lib/time.ts";

const hari = process.argv[2] ?? todayWIB();
const minggu = process.argv[3] ?? "2026-12-06";

function ctxUntuk(tanggal: string) {
  return {
    today: tanggal,
    send: async (text: string, kb?: Keyboard) => {
      console.log(text + (kb ? `\n   [tombol: ${kb.flat().map((b) => `${b.text}=${b.url ?? b.data}`).join(" | ")}]` : ""));
      console.log("---");
    },
  };
}

console.log(`\n=== Pengingat protein (${hari}) ===`);
console.log("terkirim:", await pengingatProtein(ctxUntuk(hari)));

console.log(`\n=== Laporan mingguan untuk Minggu ${minggu} (baca-saja, tanpa simpan) ===`);
console.log("hasil:", await laporanMingguan(ctxUntuk(minggu), { tulis: false }));

// Pesan pagi TIDAK dicoba di sini: ia memanggil /hari_ini yang menutup "sesi lama" berdasarkan tanggal,
// dan dengan tanggal palsu bisa menutup sesi latihan asli yang lagi berjalan.
