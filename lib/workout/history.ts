import { estimate1RM } from "../program/pr.ts";
import { db, must } from "../supabase.ts";

// Query untuk halaman Riwayat dan Progres. Semua angka dihitung di sini (kode), bukan AI.

export type SessionSummary = {
  id: number;
  date: string;
  dayName: string;
  mode: "normal" | "singkat";
  status: "berjalan" | "selesai" | "dilewati";
  energy: number | null;
  totalSets: number;
  volumeKg: number;
};

type SessionBase = {
  id: number;
  session_date: string;
  program_day_id: number | null;
  mode: "normal" | "singkat";
  status: "berjalan" | "selesai" | "dilewati";
  energy: number | null;
};

async function dayNames(): Promise<Map<number, string>> {
  const days = must(await db().from("program_days").select("id,name")) as { id: number; name: string }[];
  return new Map(days.map((d) => [d.id, d.name]));
}

export async function listSessions(limit = 40): Promise<SessionSummary[]> {
  const sessions = must(
    await db()
      .from("workout_sessions")
      .select("id,session_date,program_day_id,mode,status,energy")
      .in("status", ["selesai", "berjalan"])
      .order("session_date", { ascending: false })
      .order("started_at", { ascending: false })
      .limit(limit),
  ) as SessionBase[];
  if (sessions.length === 0) return [];

  const [names, sets] = await Promise.all([
    dayNames(),
    db()
      .from("workout_sets")
      .select("session_id,weight_kg,reps,is_warmup")
      .in(
        "session_id",
        sessions.map((s) => s.id),
      )
      .then((r) => must(r) as { session_id: number; weight_kg: number; reps: number; is_warmup: boolean }[]),
  ]);

  return sessions.map((s) => {
    const mine = sets.filter((x) => x.session_id === s.id && !x.is_warmup);
    return {
      id: s.id,
      date: s.session_date,
      dayName: (s.program_day_id && names.get(s.program_day_id)) || "Latihan",
      mode: s.mode,
      status: s.status,
      energy: s.energy,
      totalSets: mine.length,
      volumeKg: mine.reduce((a, x) => a + x.weight_kg * x.reps, 0),
    };
  });
}

export type SessionDetail = {
  id: number;
  date: string;
  dayName: string;
  mode: "normal" | "singkat";
  status: "berjalan" | "selesai" | "dilewati";
  energy: number | null;
  exercises: {
    exerciseId: number;
    name: string;
    sets: { id: number; weightKg: number; reps: number; rpe: number | null; isWarmup: boolean }[];
  }[];
};

export async function getSessionDetail(id: number): Promise<SessionDetail | null> {
  const s = must(
    await db()
      .from("workout_sessions")
      .select("id,session_date,program_day_id,mode,status,energy")
      .eq("id", id)
      .maybeSingle(),
  ) as SessionBase | null;
  if (!s) return null;

  const [names, rows] = await Promise.all([
    dayNames(),
    db()
      .from("workout_sets")
      .select("id,exercise_id,weight_kg,reps,rpe,is_warmup,exercises(name)")
      .eq("session_id", id)
      .order("id")
      .then(
        (r) =>
          must(r) as unknown as {
            id: number;
            exercise_id: number;
            weight_kg: number;
            reps: number;
            rpe: number | null;
            is_warmup: boolean;
            exercises: { name: string };
          }[],
      ),
  ]);

  const exercises: SessionDetail["exercises"] = [];
  for (const r of rows) {
    let ex = exercises.find((e) => e.exerciseId === r.exercise_id);
    if (!ex) {
      ex = { exerciseId: r.exercise_id, name: r.exercises.name, sets: [] };
      exercises.push(ex);
    }
    ex.sets.push({ id: r.id, weightKg: r.weight_kg, reps: r.reps, rpe: r.rpe, isWarmup: r.is_warmup });
  }

  return {
    id: s.id,
    date: s.session_date,
    dayName: (s.program_day_id && names.get(s.program_day_id)) || "Latihan",
    mode: s.mode,
    status: s.status,
    energy: s.energy,
    exercises,
  };
}

export async function updateSet(setId: number, weightKg: number, reps: number, rpe: number | null): Promise<void> {
  must(await db().from("workout_sets").update({ weight_kg: weightKg, reps, rpe }).eq("id", setId));
}

export async function deleteSession(sessionId: number): Promise<void> {
  // workout_sets ikut terhapus (on delete cascade)
  must(await db().from("workout_sessions").delete().eq("id", sessionId));
}

// ---------- Progres per gerakan ----------

export async function exercisesWithData(): Promise<{ id: number; name: string; count: number }[]> {
  const rows = must(
    await db().from("workout_sets").select("exercise_id,exercises(name)").eq("is_warmup", false).limit(5000),
  ) as unknown as { exercise_id: number; exercises: { name: string } }[];

  const m = new Map<number, { id: number; name: string; count: number }>();
  for (const r of rows) {
    const cur = m.get(r.exercise_id) ?? { id: r.exercise_id, name: r.exercises.name, count: 0 };
    cur.count++;
    m.set(r.exercise_id, cur);
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

export type ProgressPoint = { date: string; bestWeightKg: number; bestReps: number; e1rm: number; volumeKg: number };

export type Progress = {
  points: ProgressPoint[];
  bestE1rm: { value: number; date: string; weightKg: number; reps: number } | null;
  heaviest: { weightKg: number; reps: number; date: string } | null;
};

export async function getProgress(exerciseId: number): Promise<Progress> {
  const rows = must(
    await db()
      .from("workout_sets")
      .select("weight_kg,reps,workout_sessions!inner(session_date,status)")
      .eq("exercise_id", exerciseId)
      .eq("is_warmup", false)
      .in("workout_sessions.status", ["selesai", "berjalan"])
      .limit(3000),
  ) as unknown as { weight_kg: number; reps: number; workout_sessions: { session_date: string } }[];

  const byDate = new Map<string, { weight_kg: number; reps: number }[]>();
  for (const r of rows) {
    const d = r.workout_sessions.session_date;
    byDate.set(d, [...(byDate.get(d) ?? []), { weight_kg: r.weight_kg, reps: r.reps }]);
  }

  const points: ProgressPoint[] = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, sets]) => {
      const bestW = Math.max(...sets.map((s) => s.weight_kg));
      return {
        date,
        bestWeightKg: bestW,
        bestReps: Math.max(...sets.filter((s) => s.weight_kg === bestW).map((s) => s.reps)),
        e1rm: Math.max(...sets.map((s) => estimate1RM(s.weight_kg, s.reps))),
        volumeKg: sets.reduce((a, s) => a + s.weight_kg * s.reps, 0),
      };
    });

  let bestE1rm: Progress["bestE1rm"] = null;
  let heaviest: Progress["heaviest"] = null;
  for (const r of rows) {
    const date = r.workout_sessions.session_date;
    const e = estimate1RM(r.weight_kg, r.reps);
    if (!bestE1rm || e > bestE1rm.value) bestE1rm = { value: e, date, weightKg: r.weight_kg, reps: r.reps };
    if (!heaviest || r.weight_kg > heaviest.weightKg || (r.weight_kg === heaviest.weightKg && r.reps > heaviest.reps)) {
      heaviest = { weightKg: r.weight_kg, reps: r.reps, date };
    }
  }

  return { points, bestE1rm, heaviest };
}
