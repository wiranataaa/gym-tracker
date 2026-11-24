"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth.ts";
import { simpanPengaturanDb, type Pengaturan } from "@/lib/pengaturan/db.ts";

type Result = { ok: true } | { ok: false; error: string };

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const dalam = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max;

function selisihHari(a: string, b: string): number {
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86_400_000);
}

export async function simpanPengaturan(p: Pengaturan): Promise<Result> {
  await requireOwner();

  if (!dalam(p.targetKcal, 1800, 4500)) return { ok: false, error: "Target kalori harus 1.800-4.500" };
  if (!dalam(p.kcalMaintenance, 1800, 4500)) return { ok: false, error: "Kalori maintenance harus 1.800-4.500" };
  if (!dalam(p.targetProteinG, 60, 300)) return { ok: false, error: "Target protein harus 60-300 g" };
  if (!Number.isInteger(p.sessionsPerWeek) || p.sessionsPerWeek < 1 || p.sessionsPerWeek > 7) return { ok: false, error: "Sesi per minggu harus 1-7" };
  if (!dalam(p.targetWeightKg, 40, 150) || !dalam(p.stretchTargetKg, 40, 150)) return { ok: false, error: "Target berat harus 40-150 kg" };
  if (p.stretchTargetKg < p.targetWeightKg) return { ok: false, error: "Target lanjutan nggak boleh lebih kecil dari target utama" };
  if (!["auto", "on", "off"].includes(p.ramadanOverride)) return { ok: false, error: "Pilihan mode Ramadan nggak valid" };
  if (!TANGGAL.test(p.ramadanStart) || !TANGGAL.test(p.lebaranDate)) return { ok: false, error: "Tanggal nggak valid" };
  const lama = selisihHari(p.ramadanStart, p.lebaranDate);
  if (lama < 28 || lama > 32) return { ok: false, error: "Jarak awal puasa ke Lebaran harusnya 29-30 hari. Cek lagi tanggalnya." };

  await simpanPengaturanDb({
    ...p,
    targetWeightKg: Math.round(p.targetWeightKg * 10) / 10,
    stretchTargetKg: Math.round(p.stretchTargetKg * 10) / 10,
  });
  for (const path of ["/", "/nutrisi", "/badan", "/pengaturan"]) revalidatePath(path);
  return { ok: true };
}
