import { bagiRamadan, hariKeRamadan, SARAN_LATIHAN_RAMADAN, type OverrideRamadan } from "../ramadan/ramadan.ts";
import { fmtInt, tglLengkap, todayWIB } from "../time.ts";
import { getSettings, setRamadanOverride } from "../workout/db.ts";
import type { Ctx } from "./handlers.ts";

/** Teks pembagian makan Ramadan (sahur, berbuka, setelah tarawih) dari target hari ini. */
export function teksBagiRamadan(kcal: number, proteinG: number): string[] {
  return bagiRamadan(kcal, proteinG).map((p) => `• ${p.nama}: ±${fmtInt(p.kcal)} kcal · protein ±${p.proteinG} g. ${p.saran}`);
}

/** /ramadan [on|off|auto]: lihat status atau ubah mode. */
export async function perintahRamadan(ctx: Ctx, arg: string): Promise<void> {
  const a = arg.trim().toLowerCase();
  if (a === "on" || a === "off" || a === "auto") {
    await setRamadanOverride(a as OverrideRamadan);
  } else if (a) {
    await ctx.send("Pakai: /ramadan on (paksa aktif), /ramadan off (paksa mati), atau /ramadan auto (ikut tanggal).");
    return;
  }

  const today = ctx.today ?? todayWIB();
  const s = await getSettings(today);
  const lines = [`🌙 Mode Ramadan: ${s.ramadan_aktif ? "AKTIF" : "tidak aktif"} (pengaturan: ${s.ramadan_override === "auto" ? "otomatis ikut tanggal" : s.ramadan_override === "on" ? "dipaksa aktif" : "dipaksa mati"})`];
  lines.push(`Tanggal: puasa mulai ${tglLengkap(s.ramadan_start)}, Lebaran ${tglLengkap(s.lebaran_date)} (bisa diubah di app → Pengaturan, karena tanggal resmi ditetapkan pemerintah)`);
  const hari = hariKeRamadan(today, s.ramadan_start);
  if (!s.ramadan_aktif && hari != null) lines.push(`Ramadan mulai ${hari} hari lagi.`);

  if (s.ramadan_aktif) {
    lines.push("", `Target jadi maintenance: ${fmtInt(s.kcal_maintenance)} kcal · protein ${s.target_protein_g} g (jaga berat dan kekuatan, bukan nambah).`, "Pembagian makan:");
    lines.push(...teksBagiRamadan(s.kcal_maintenance, s.target_protein_g));
    lines.push("", `Latihan: ${SARAN_LATIHAN_RAMADAN}`);
  } else {
    lines.push("", `Target sekarang: ${fmtInt(s.target_kcal)} kcal · protein ${s.target_protein_g} g. Saat Ramadan berubah ke maintenance ${fmtInt(s.kcal_maintenance)} kcal.`);
  }
  await ctx.send(lines.join("\n"));
}
