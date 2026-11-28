import { hapusTidur, listTidur, mulaiTidur, selesaiTidur, setKualitasTidur, simpanTidur, tidurAktif, tidurHari, type Tidur, type TidurAktif } from "../tidur/db.ts";
import { bacaTidurTeks, fmtDurasi, jamWIB, MIN_DURASI_MENIT, nilaiTidur, rataMenit, ringkasHari, TARGET_TIDUR_JAM, totalPerHari } from "../tidur/hitung.ts";
import type { Button } from "../telegram.ts";
import { namaHari, todayWIB } from "../time.ts";
import type { Ctx } from "./handlers.ts";

const KUALITAS = ["😫 Parah", "😕 Gelisah", "😐 Biasa", "🙂 Nyenyak", "😴 Pulas"];

const TOMBOL_MAU_TIDUR: Button = { text: "🌙 Gua mau tidur", data: "td:mulai" };
const TOMBOL_BANGUN: Button = { text: "☀️ Gua udah bangun", data: "td:bangun" };

function tombolKualitas(id: number): Button[][] {
  return [KUALITAS.map((k, i) => ({ text: k, data: `td:q:${id}:${i + 1}` }))];
}

const ikon = (menit: number) => ({ cukup: "✅", pas: "🟡", kurang: "🔴" })[nilaiTidur(menit).level];

function barisTidur(t: Tidur): string {
  return `😴 Tidur ${t.jamTidur} (${namaHari(t.tanggalTidur)}) → bangun ${t.jamBangun} (${namaHari(t.tanggalBangun)}) = ${fmtDurasi(t.durasiMenit)}${t.kualitas ? ` · ${KUALITAS[t.kualitas - 1]}` : ""}`;
}

/** Ringkasan semua tidur yang bangunnya di satu hari (bisa lebih dari satu). */
function barisHari(sesi: Tidur[]): string[] {
  const r = ringkasHari(sesi);
  if (!r) return [];
  const nilai = `${ikon(r.totalMenit)} ${nilaiTidur(r.totalMenit).label}`;
  if (sesi.length === 1) return [`${barisTidur(sesi[0])} ${nilai}`];
  return [...sesi.map(barisTidur), `Total: ${fmtDurasi(r.totalMenit)} ${nilai}`];
}

const sedangTidur = (a: TidurAktif) => `💤 Tidur dicatat sejak ${namaHari(a.tanggalTidur)} ${a.jamTidur}.`;

/** "/tidur" tanpa isi: rekap + tombol. "/tidur 23:30 6:00 cerita": catat tidur yang bangunnya hari ini. */
export async function perintahTidur(ctx: Ctx, arg: string): Promise<void> {
  const today = ctx.today ?? todayWIB();
  if (!arg.trim()) {
    const [aktif, hariIni, tujuh] = await Promise.all([tidurAktif(), tidurHari(today), listTidur(today, 7)]);
    const lines: string[] = [];
    if (aktif) lines.push(sedangTidur(aktif));
    lines.push(...(hariIni.length ? barisHari(hariIni) : ["Belum ada tidur yang selesai hari ini."]));
    const harian = [...totalPerHari(tujuh).values()];
    const rata = rataMenit(harian);
    if (harian.length >= 2 && rata != null) lines.push(`Rata-rata ${harian.length} hari terakhir: ${fmtDurasi(rata)} (target ±${TARGET_TIDUR_JAM} jam)`);
    lines.push("", "Tap tombolnya pas mau tidur dan pas bangun. Atau catat manual: /tidur 23:30 6:00 nyenyak");
    await ctx.send(lines.join("\n"), [[aktif ? TOMBOL_BANGUN : TOMBOL_MAU_TIDUR]]);
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
  await balasSelesai(ctx, r.tidur);
}

/** Setelah satu tidur tersimpan: ringkasan hari itu + tanya rasanya. */
async function balasSelesai(ctx: Ctx, tidur: Tidur): Promise<void> {
  const sesi = await tidurHari(tidur.tanggalBangun);
  const total = ringkasHari(sesi)?.totalMenit ?? tidur.durasiMenit;
  const lines = barisHari(sesi.length ? sesi : [tidur]);
  if (nilaiTidur(total).level !== "cukup") lines.push(`Target tidur ±${TARGET_TIDUR_JAM} jam. Kurang tidur bikin pemulihan otot dan tenaga di gym turun.`);
  lines.push("", "Tidurnya gimana rasanya? Tap salah satu:");
  await ctx.send(lines.join("\n"), tombolKualitas(tidur.id));
}

/** "mau tidur" sekarang. */
export async function mauTidur(ctx: Ctx): Promise<void> {
  const now = new Date();
  const r = await mulaiTidur(todayWIB(now), jamWIB(now.toISOString()));
  if (!r.ok) {
    const aktif = await tidurAktif();
    await ctx.send(`😅 ${r.error}`, aktif ? [[TOMBOL_BANGUN]] : undefined);
    return;
  }
  await ctx.send(`${sedangTidur(r.aktif)}\nPas bangun, tap tombol di bawah. Met tidur!`, [[TOMBOL_BANGUN], [{ text: "❌ Batalin (salah tap)", data: "td:batal" }]]);
}

/** "udah bangun" sekarang. */
export async function sudahBangun(ctx: Ctx): Promise<void> {
  const now = new Date();
  const aktif = await tidurAktif();
  if (aktif && now.getTime() - Date.parse(aktif.sleptAt) < MIN_DURASI_MENIT * 60_000) {
    await ctx.send(`😅 ${sedangTidur(aktif)} Belum ${MIN_DURASI_MENIT} menit, jadi belum gua tutup.`, [[TOMBOL_BANGUN], [{ text: "❌ Batalin (salah tap)", data: "td:batal" }]]);
    return;
  }
  const r = await selesaiTidur({ tanggalBangun: todayWIB(now), jamBangun: jamWIB(now.toISOString()) });
  if (!r.ok) {
    await ctx.send(`😅 ${r.error}\nKalau jamnya perlu dikoreksi, buka app → tab Hari ini → kartu Tidur.`);
    return;
  }
  await balasSelesai(ctx, r.tidur);
}

/** Tombol "td:...". true kalau milik fitur ini. */
export async function callbackTidur(ctx: Ctx, data: string): Promise<boolean> {
  if (!data.startsWith("td:")) return false;
  if (data === "td:mulai") {
    await mauTidur(ctx);
    return true;
  }
  if (data === "td:bangun") {
    await sudahBangun(ctx);
    return true;
  }
  if (data === "td:batal") {
    const aktif = await tidurAktif();
    if (aktif) await hapusTidur(aktif.id);
    const teks = aktif ? "Dibatalin. Nggak ada tidur yang lagi dicatat." : "Nggak ada tidur yang lagi dicatat.";
    if (ctx.edit) await ctx.edit(teks);
    else await ctx.send(teks);
    return true;
  }
  const m = data.match(/^td:q:(\d+):([1-5])$/);
  if (!m) {
    await ctx.send("Tombol itu dari pesan lama. Ubah lewat app → tab Hari ini → kartu Tidur.");
    return true;
  }
  const t = await setKualitasTidur(Number(m[1]), Number(m[2]));
  const teks = t ? `${barisTidur(t)}\nTercatat 👍${t.catatan ? "" : " Mau nambah cerita? Tulis lewat app → kartu Tidur."}` : "Catatan tidurnya nggak ketemu.";
  if (ctx.edit) await ctx.edit(teks);
  else await ctx.send(teks);
  return true;
}

/**
 * Bagian tidur di pesan pagi. `bangun` = tombol "udah bangun" kalau tidurnya lagi dicatat;
 * `perluCatat` = belum ada catatan sama sekali (pesan pagi menambah tombol ke app).
 */
export async function barisTidurPagi(today: string): Promise<{ baris: string; bangun: Button | null; perluCatat: boolean }> {
  const aktif = await tidurAktif();
  if (aktif) return { baris: `${sedangTidur(aktif)} Udah bangun? Tap tombol di bawah.`, bangun: TOMBOL_BANGUN, perluCatat: false };
  const sesi = await tidurHari(today);
  if (sesi.length) return { baris: barisHari(sesi).join("\n"), bangun: null, perluCatat: false };
  return { baris: "😴 Tidur semalam belum dicatat. Tap tombol di bawah buat catat di app, atau ketik /tidur 23:30 6:00", bangun: null, perluCatat: true };
}
