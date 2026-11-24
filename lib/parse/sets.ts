// Parser format input cepat:
//   bench 60x10          -> 1 set
//   bench 60x10x3        -> 3 set, reps sama
//   bench 60 10,10,9     -> 3 set, reps beda
//   squat 80 8 8 7 rpe8  -> 3 set + RPE 8
// Desimal boleh pakai titik atau koma di berat (57,5x10 / 57.5x10).
// Kalau format nggak dikenali -> ok:false, nanti diparsing AI (dan dikonfirmasi dulu).

export type ParsedSets = {
  ok: true;
  exerciseQuery: string;
  weightKg: number;
  /** satu angka per set */
  reps: number[];
  rpe: number | null;
  isWarmup: boolean;
};

export type ParseFailure = { ok: false; reason: string };

const NUM = String.raw`\d+(?:[.,]\d+)?`;
const FORMAT_X = new RegExp(
  String.raw`^(${NUM})\s*(?:kg)?\s*[x×*]\s*(\d+)(?:\s*[x×*]\s*(\d+))?$`,
);
const FORMAT_LIST = new RegExp(
  String.raw`^(${NUM})\s*(?:kg)?\s+(\d+(?:\s*,\s*\d+|\s+\d+)*)$`,
);

const MAX_WEIGHT_KG = 500;
const MAX_REPS = 100;
const MAX_SETS = 10;

function toNumber(s: string): number {
  return parseFloat(s.replace(",", "."));
}

export function parseSetText(input: string): ParsedSets | ParseFailure {
  let text = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return { ok: false, reason: "kosong" };

  let rpe: number | null = null;
  const rpeMatch = text.match(/\brpe\s*(\d+(?:[.,]\d+)?)/);
  if (rpeMatch) {
    rpe = toNumber(rpeMatch[1]);
    text = text.replace(rpeMatch[0], " ").replace(/\s+/g, " ").trim();
    if (rpe < 1 || rpe > 10) return { ok: false, reason: "RPE harus 1-10" };
  }

  let isWarmup = false;
  const warm = text.match(/\b(warmup|warm-up|pemanasan)\b/);
  if (warm) {
    isWarmup = true;
    text = text.replace(warm[0], " ").replace(/\s+/g, " ").trim();
  }

  const firstDigit = text.search(/\d/);
  if (firstDigit <= 0) return { ok: false, reason: "nggak ada nama gerakan atau angka" };

  const exerciseQuery = text.slice(0, firstDigit).trim();
  const rest = text.slice(firstDigit).trim();
  if (!exerciseQuery) return { ok: false, reason: "nama gerakan kosong" };

  let weightKg: number;
  let reps: number[];

  const x = rest.match(FORMAT_X);
  if (x) {
    weightKg = toNumber(x[1]);
    const count = x[3] ? parseInt(x[3], 10) : 1;
    if (count < 1 || count > MAX_SETS) return { ok: false, reason: "jumlah set nggak masuk akal" };
    reps = Array.from({ length: count }, () => parseInt(x[2], 10));
  } else {
    const list = rest.match(FORMAT_LIST);
    if (!list) return { ok: false, reason: "format nggak dikenali" };
    weightKg = toNumber(list[1]);
    reps = list[2].split(/[\s,]+/).map((r) => parseInt(r, 10));
    if (reps.length > MAX_SETS) return { ok: false, reason: "jumlah set nggak masuk akal" };
  }

  if (!(weightKg >= 0 && weightKg <= MAX_WEIGHT_KG)) {
    return { ok: false, reason: "beban nggak masuk akal" };
  }
  if (reps.some((r) => !(r >= 1 && r <= MAX_REPS))) {
    return { ok: false, reason: "reps nggak masuk akal" };
  }

  return { ok: true, exerciseQuery, weightKg, reps, rpe, isWarmup };
}

// ---------- Cocokkan nama gerakan (nama resmi atau alias) ----------

export type ExerciseRef = { id: number; name: string; aliases: string[] };

export type ResolveResult =
  | { kind: "found"; exercise: ExerciseRef }
  | { kind: "ambiguous"; candidates: ExerciseRef[] }
  | { kind: "none" };

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function resolveExercise(query: string, exercises: ExerciseRef[]): ResolveResult {
  const q = normalize(query);
  if (!q) return { kind: "none" };

  const names = (e: ExerciseRef) => [e.name, ...e.aliases].map(normalize);
  // Sengaja TIDAK ada pencocokan "mengandung kata": "deadlift" nggak boleh diam-diam
  // dicatat sebagai "Romanian Deadlift" (gerakan beda).
  const tiers: ((n: string) => boolean)[] = [
    (n) => n === q,
    (n) => q.length >= 3 && n.startsWith(q),
  ];

  for (const matches of tiers) {
    const hits = exercises.filter((e) => names(e).some(matches));
    if (hits.length === 1) return { kind: "found", exercise: hits[0] };
    if (hits.length > 1) return { kind: "ambiguous", candidates: hits };
  }
  return { kind: "none" };
}
