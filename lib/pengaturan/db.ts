import type { OverrideRamadan } from "../ramadan/ramadan.ts";
import { db, must } from "../supabase.ts";

// Pengaturan mentah (nilai yang disimpan), BUKAN nilai efektif (itu getSettings di lib/workout/db.ts).

export type Pengaturan = {
  targetKcal: number;
  kcalMaintenance: number;
  targetProteinG: number;
  sessionsPerWeek: number;
  targetWeightKg: number;
  stretchTargetKg: number;
  ramadanOverride: OverrideRamadan;
  ramadanStart: string;
  lebaranDate: string;
};

type Row = {
  target_kcal: number;
  kcal_maintenance: number;
  target_protein_g: number;
  sessions_per_week: number;
  target_weight_kg: number;
  stretch_target_kg: number;
  ramadan_override: OverrideRamadan;
  ramadan_start: string;
  lebaran_date: string;
};

export async function ambilPengaturan(): Promise<Pengaturan> {
  const r = must(
    await db()
      .from("settings")
      .select("target_kcal,kcal_maintenance,target_protein_g,sessions_per_week,target_weight_kg,stretch_target_kg,ramadan_override,ramadan_start,lebaran_date")
      .eq("id", 1)
      .single(),
  ) as Row;
  return {
    targetKcal: r.target_kcal,
    kcalMaintenance: r.kcal_maintenance,
    targetProteinG: r.target_protein_g,
    sessionsPerWeek: r.sessions_per_week,
    targetWeightKg: Number(r.target_weight_kg),
    stretchTargetKg: Number(r.stretch_target_kg),
    ramadanOverride: r.ramadan_override,
    ramadanStart: r.ramadan_start,
    lebaranDate: r.lebaran_date,
  };
}

export async function simpanPengaturanDb(p: Pengaturan): Promise<void> {
  must(
    await db()
      .from("settings")
      .update({
        target_kcal: p.targetKcal,
        kcal_maintenance: p.kcalMaintenance,
        target_protein_g: p.targetProteinG,
        sessions_per_week: p.sessionsPerWeek,
        target_weight_kg: p.targetWeightKg,
        stretch_target_kg: p.stretchTargetKg,
        ramadan_override: p.ramadanOverride,
        ramadan_start: p.ramadanStart,
        lebaran_date: p.lebaranDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1),
  );
}

const LABEL_FITUR: Record<string, string> = {
  nutrisi_foto: "Baca foto makanan",
  nutrisi_teks: "Hitung makanan dari teks",
  kesimpulan_harian: "Kesimpulan latihan",
};

export type BiayaFitur = { fitur: string; label: string; panggilan: number; tokenMasuk: number; tokenKeluar: number; usd: number };

/** Pemakaian AI sejak awal bulan berjalan (WIB). */
export async function biayaBulanIni(today: string): Promise<{ bulan: string; total: number; fitur: BiayaFitur[] }> {
  const bulan = today.slice(0, 7);
  const rows = must(
    await db()
      .from("ai_usage_log")
      .select("feature,input_tokens,output_tokens,est_cost_usd")
      .gte("created_at", `${bulan}-01T00:00:00+07:00`)
      .limit(20000),
  ) as { feature: string; input_tokens: number; output_tokens: number; est_cost_usd: number }[];

  const m = new Map<string, BiayaFitur>();
  for (const r of rows) {
    const cur = m.get(r.feature) ?? { fitur: r.feature, label: LABEL_FITUR[r.feature] ?? r.feature, panggilan: 0, tokenMasuk: 0, tokenKeluar: 0, usd: 0 };
    cur.panggilan++;
    cur.tokenMasuk += r.input_tokens;
    cur.tokenKeluar += r.output_tokens;
    cur.usd += Number(r.est_cost_usd);
    m.set(r.feature, cur);
  }
  const fitur = [...m.values()].sort((a, b) => b.usd - a.usd);
  return { bulan, total: fitur.reduce((a, f) => a + f.usd, 0), fitur };
}
