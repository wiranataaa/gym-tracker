import { bacaTanita } from "../ai/tanita.ts";
import type { ImageType } from "../ai/nutrition.ts";
import { ambilDraftTanita, buatDraftTanita, hapusDraftTanita, LABEL_KONDISI, simpanKomposisi, tinggiCm, type Kondisi } from "../body/db.ts";
import { validasiKomposisi, type KomposisiBaca } from "../body/tanitaValid.ts";
import type { Keyboard } from "../telegram.ts";
import { fmtKg, tglLengkap } from "../time.ts";
import type { Ctx } from "./handlers.ts";

/** Foto dengan caption yang menyebut kata-kata ini dianggap layar Tanita (bukan makanan). */
export const KATA_TANITA = /tanita|komposisi|body\s*comp|bia\b|fat\s*%/i;

const MAKS_BYTE = 5 * 1024 * 1024;

export function kondisiDariCaption(caption: string | undefined): Kondisi {
  const c = (caption ?? "").toLowerCase();
  if (/\bpagi\b/.test(c)) return "pagi_puasa";
  if (/\bsetelah\b|\bhabis\b/.test(c)) return "setelah_olahraga";
  return "sebelum_latihan"; // rencana: timbang di gym sebelum latihan
}

const baris = (label: string, nilai: number | null, satuan = "") => `• ${label}: ${nilai == null ? "—" : `${fmtKg(nilai)}${satuan}`}`;

export function formatKomposisi(d: KomposisiBaca): string[] {
  return [
    baris("Berat", d.beratKg, " kg"),
    baris("Body fat", d.bodyFatPct, "%"),
    baris("Massa otot", d.muscleMassKg, " kg"),
    baris("Muscle score", d.muscleScore),
    baris("BMI", d.bmi),
    baris("Muscle quality", d.muscleQuality),
    baris("Visceral fat", d.visceralFat),
    baris("Massa tulang", d.boneMassKg, " kg"),
    baris("Body water", d.bodyWaterPct, "%"),
    baris("BMR", d.bmrKcal, " kcal"),
    baris("Usia metabolik", d.metabolicAge),
  ];
}

export async function handleTanita(ctx: Ctx, fileId: string, caption?: string): Promise<void> {
  await ctx.send("⚖️ Lagi baca layar Tanita…");
  const file = ctx.downloadPhoto ? await ctx.downloadPhoto(fileId) : null;
  if (!file) {
    await ctx.send("Fotonya nggak bisa diunduh 😅 Coba kirim ulang.");
    return;
  }
  if (file.bytes.byteLength > MAKS_BYTE) {
    await ctx.send("Fotonya kebesaran (maks 5 MB). Kirim ulang sebagai foto biasa, bukan file.");
    return;
  }

  const hasil = await bacaTanita(Buffer.from(file.bytes).toString("base64"), file.mime as ImageType);
  if (!hasil.ok) {
    await ctx.send(`😅 ${hasil.reason}`);
    return;
  }

  const kondisi = kondisiDariCaption(caption);
  const v = validasiKomposisi(hasil.data, await tinggiCm());
  const id = await buatDraftTanita(hasil.data, kondisi);

  const lines = [
    `⚖️ Hasil baca layar Tanita${hasil.data.tanggal ? ` (${tglLengkap(hasil.data.tanggal)}${hasil.data.jam ? ` ${hasil.data.jam}` : ""})` : ""}`,
    "",
    ...formatKomposisi(hasil.data),
    "",
    `Kondisi dicatat: ${LABEL_KONDISI[kondisi]}. (Mau beda? Kirim ulang dengan kata 'pagi' atau 'setelah' di caption.)`,
  ];
  if (v.masalah.length > 0) lines.push("", "⚠️ Ada angka yang mencurigakan:", ...v.masalah.map((m) => `• ${m}`), "Kirim ulang foto yang lebih jelas, atau koreksi lewat app (tab Badan → Baca dari foto).");
  if (v.peringatan.length > 0) lines.push("", ...v.peringatan.map((p) => `ℹ️ ${p}`));
  if (hasil.catatan) lines.push("", `Catatan pembaca: ${hasil.catatan}`);

  const kb: Keyboard = [
    v.masalah.length > 0
      ? [{ text: "⚠️ Tetap simpan", data: `tn:s:${id}` }, { text: "❌ Batal", data: `tn:b:${id}` }]
      : [{ text: "✅ Simpan", data: `tn:s:${id}` }, { text: "❌ Batal", data: `tn:b:${id}` }],
  ];
  await ctx.send(lines.join("\n"), kb);
}

/** Tombol "tn:s:{id}" (simpan) dan "tn:b:{id}" (batal). true kalau milik fitur ini. */
export async function callbackTanita(ctx: Ctx, data: string): Promise<boolean> {
  const m = data.match(/^tn:(s|b):(\d+)$/);
  if (!m) return false;
  const id = Number(m[2]);

  const draft = await ambilDraftTanita(id);
  if (!draft) {
    await ctx.send("Hasil baca itu udah nggak ada (mungkin udah disimpan atau dibatalkan).");
    return true;
  }
  if (m[1] === "b") {
    await hapusDraftTanita(id);
    await ctx.send("Oke, dibatalkan. Nggak ada yang disimpan.");
    return true;
  }

  const r = await simpanKomposisi(draft.data, draft.kondisi, "foto_tanita");
  await hapusDraftTanita(id);
  await ctx.send(
    r.duplikat
      ? "Timbangan di waktu yang sama udah tercatat sebelumnya, jadi nggak disimpan dobel."
      : `✅ Tersimpan: ${fmtKg(draft.data.beratKg ?? 0)} kg, body fat ${draft.data.bodyFatPct != null ? `${fmtKg(draft.data.bodyFatPct)}%` : "—"}. Lihat grafiknya di app (tab Badan).`,
  );
  return true;
}
