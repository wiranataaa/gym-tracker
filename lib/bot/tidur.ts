import { getTidur, listTidur, setKualitasTidur, simpanTidur, type Tidur } from "../tidur/db.ts";
import { bacaTidurTeks, fmtDurasi, nilaiTidur, rataMenit, TARGET_TIDUR_JAM } from "../tidur/hitung.ts";
import type { Button } from "../telegram.ts";
import { todayWIB } from "../time.ts";
import type { Ctx } from "./handlers.ts";

const KUALITAS = ["😫 Parah", "😕 Gelisah", "😐 Biasa", "🙂 Nyenyak", "😴 Pulas"];

function tombolKualitas(tanggal: string): Button[][] {
  return [KUALITAS.map((k, i) => ({ text: k, data: `td:q:${tanggal}:${i + 1}` }))];
}

function barisTidur(t: Tidur): string {
  const n = nilaiTidur(t.durasiMenit);
  const ikon = n.level === "cukup" ? "✅" : n.level === "pas" ? "🟡" : "🔴";
  return `😴 Tidur ${t.jamTidur} → bangun ${t.jamBangun} = ${fmtDurasi(t.durasiMenit)} ${ikon} ${n.label}${t.kualitas ? ` · ${KUALITAS[t.kualitas - 1]}` : ""}`;
}

/** /tidur 23:30 6:00 nyenyak banget  — atau /tidur tanpa isi buat lihat tidur 7 hari terakhir. */
export async function perintahTidur(ctx: Ctx, arg: string): Promise<void> {
  const today = ctx.today ?? todayWIB();
  if (!arg.trim()) {
    const [hariIni, tujuh] = await Promise.all([getTidur(today), listTidur(today, 7)]);
    const lines: string[] = [];
    if (hariIni) {
      lines.push(barisTidur(hariIni));
      if (hariIni.catatan) lines.push(`“${hariIni.catatan}”`);
    } else lines.push("😴 Tidur semalam belum dicatat.");
    const rata = rataMenit(tujuh.map((t) => t.durasiMenit));
    if (tujuh.length >= 2 && rata != null) lines.push(`Rata-rata ${tujuh.length} malam terakhir: ${fmtDurasi(rata)} (target ±${TARGET_TIDUR_JAM} jam)`);
    lines.push("", "Catat: /tidur 23:30 6:00  (jam tidur dulu, baru jam bangun)", "Boleh tambah cerita: /tidur 23:30 6:00 nyenyak tapi kebangun sekali");
    await ctx.send(lines.join("\n"));
    return;
  }

  const t = bacaTidurTeks(arg);
  if (!t) {
    await ctx.send("Format: /tidur 23:30 6:00  (jam tidur dulu, baru jam bangun).\nBoleh tambah cerita di belakangnya: /tidur 23:30 6:00 nyenyak banget");
    return;
  }
  const r = await simpanTidur({ tanggalBangun: today, jamTidur: t.jamTidur, jamBangun: t.jamBangun, catatan: t.catatan || undefined });
  if (!r.ok) {
    await ctx.send(`😅 ${r.error}`);
    return;
  }
  const n = nilaiTidur(r.tidur.durasiMenit);
  const lines = [barisTidur(r.tidur)];
  if (n.level !== "cukup") lines.push(`Target tidur ±${TARGET_TIDUR_JAM} jam. Kurang tidur bikin pemulihan otot dan tenaga di gym turun, jadi malam ini usahain lebih awal ya.`);
  lines.push("", "Tidurnya gimana rasanya? Tap salah satu:");
  await ctx.send(lines.join("\n"), tombolKualitas(r.tidur.tanggalBangun));
}

/** Tombol "td:q:<tanggal>:<1-5>". true kalau milik fitur ini. */
export async function callbackTidur(ctx: Ctx, data: string): Promise<boolean> {
  if (!data.startsWith("td:")) return false;
  const m = data.match(/^td:q:(\d{4}-\d{2}-\d{2}):([1-5])$/);
  if (!m) return true;
  const t = await setKualitasTidur(m[1], Number(m[2]));
  const teks = t ? `${barisTidur(t)}\nTercatat 👍${t.catatan ? "" : " Mau nambah cerita? Kirim ulang: /tidur 23:30 6:00 ceritanya"}` : "Catatan tidurnya nggak ketemu.";
  if (ctx.edit) await ctx.edit(teks);
  else await ctx.send(teks);
  return true;
}

/** Baris buat pesan pagi: ingatkan catat tidur, atau ringkas tidur yang sudah dicatat. */
export async function barisTidurPagi(today: string): Promise<{ baris: string; sudah: boolean }> {
  const t = await getTidur(today);
  if (t) return { baris: barisTidur(t), sudah: true };
  return { baris: "😴 Tidur semalam belum dicatat. Tap tombol di bawah, atau ketik /tidur 23:30 6:00", sudah: false };
}
