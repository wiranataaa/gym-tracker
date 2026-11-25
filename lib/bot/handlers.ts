import { detectPR } from "../program/pr.ts";
import type { ExerciseSession } from "../program/types.ts";
import { parseSetText, resolveExercise } from "../parse/sets.ts";
import type { Keyboard } from "../telegram.ts";
import { fmtInt, fmtKg, todayWIB } from "../time.ts";
import {
  addWeight,
  closeStaleSessions,
  finishSession,
  getHistory,
  getOpenSession,
  getSessionById,
  getSessionSets,
  getTodayPlan,
  loadExercises,
  logSets,
  loadProgram,
  loadRecentSessions,
  savePlan,
  startSession,
  type ExerciseRow,
  type SessionRow,
} from "../workout/db.ts";
import { buildMenu, formatMenu, getSettings, isWorkoutDay, SESI_UTAMA_PER_MINGGU, targetLine, type TodayMenu } from "../workout/menu.ts";
import { pilihHariIni } from "../program/queue.ts";
import { bannerTimbang } from "../workout/today.ts";
import { callbackSuplemen, catatKardio, pilihMenu, showGantiMenu, tampilSuplemen } from "./menuSuplemen.ts";
import { perintahRamadan } from "./ramadan.ts";
import { callbackDeload, perintahDeload } from "./deload.ts";
import { callbackTanita, handleTanita, KATA_TANITA } from "./tanita.ts";
import { tebakSetBebas } from "../ai/setBebas.ts";
import { bacaKodeSet, kodeSet } from "./kodeSet.ts";
import { buatKesimpulanSesi } from "../ai/summary.ts";
import { handleMakanText, handleNutriCallback, handlePhoto, showFavorites, showProgress } from "./nutrition.ts";

export type Ctx = {
  send: (text: string, keyboard?: Keyboard) => Promise<void>;
  /** Ganti isi pesan yang tombolnya diklik (kalau ada); kalau nggak ada, kirim pesan baru */
  edit?: (text: string, keyboard?: Keyboard) => Promise<void>;
  /** Unduh foto dari Telegram (diisi route; di tes diisi foto palsu) */
  downloadPhoto?: (fileId: string) => Promise<{ bytes: Uint8Array; mime: string } | null>;
  /** Bisa diisi saat tes supaya "hari ini" nggak bergantung jam asli */
  today?: string;
};

const HELP = [
  "Perintah yang udah jalan:",
  "/hari_ini — menu latihan + target beban",
  "/mulai — mulai sesi latihan",
  "/singkat — versi 30 menit buat hari capek",
  "/skip — lewati latihan hari ini (antrean nggak maju)",
  "/selesai — tutup sesi",
  "/timbang 71.4 gym — catat berat badan (tambah 'gym' kalau timbang di gym sebelum latihan, 'pagi' kalau habis bangun & belum makan)",
  "/menu — ganti menu hari ini (utama A/B/C atau bonus D/E/F buat variasi)",
  "/ramadan — status mode Ramadan (on / off / auto buat mengubah)",
  "/deload — saran minggu ringan (deload); /deload mulai atau /deload selesai",
  "Kalimat bebas juga bisa, contoh: tadi bench 60 kilo 10 kali 3 set (gua konfirmasi dulu sebelum dicatat)",
  "/suplemen — catat creatine dan whey",
  "kardio 20 — catat menit kardio (jalan di treadmill)",
  "📸 Kirim foto makanan — gua hitung kalori dan proteinnya",
  "⚖️ Kirim screenshot layar Tanita dengan caption 'tanita' — gua baca semua angka komposisi badan (konfirmasi dulu sebelum disimpan)",
  "/makan nasi putih + ayam bakar + tempe 2 — hitung dari teks. Lupa foto? Ketik aja kayak ngobrol: 'tadi makan pizza 2 potong'",
  "/fav — catat makanan favorit sekali tap",
  "/nutrisi — progres kalori dan protein hari ini",
  "",
  "Log set: ketik langsung, contoh",
  "bench 60x10  ·  bench 60x10x3  ·  bench 60 10,10,9  ·  squat 80 8 8 7 rpe8",
].join("\n");

// ---------- Tombol ----------

const MENU_BUTTONS: Keyboard = [
  [{ text: "💪 Gas, mulai", data: "mulai" }],
  [
    { text: "😮‍💨 Versi singkat", data: "singkat" },
    { text: "⏭️ Hari ini skip", data: "skip" },
  ],
  [{ text: "🔀 Ganti menu", data: "ganti" }],
];

const DURING_BUTTONS: Keyboard = [
  [
    { text: "➡️ Gerakan berikutnya", data: "next" },
    { text: "🏁 Selesai", data: "selesai" },
  ],
];

// ---------- Util ----------

function best(sets: { weightKg: number; reps: number }[]): { weightKg: number; reps: number } {
  const w = Math.max(...sets.map((s) => s.weightKg));
  return { weightKg: w, reps: Math.max(...sets.filter((s) => s.weightKg === w).map((s) => s.reps)) };
}

function compareToLast(last: ExerciseSession | undefined, weightKg: number, reps: number[]): string {
  if (!last || last.sets.length === 0) return "Pertama kali dicatat, ini jadi patokan 👌";
  const prev = best(last.sets);
  const cur = { weightKg, reps: Math.max(...reps) };
  const prevTxt = `Sesi lalu: ${fmtKg(prev.weightKg)} kg × ${prev.reps}.`;
  if (cur.weightKg > prev.weightKg) return `${prevTxt} Beban naik 👍`;
  if (cur.weightKg === prev.weightKg) {
    if (cur.reps > prev.reps) return `${prevTxt} Rep naik 👍`;
    if (cur.reps === prev.reps) return `${prevTxt} Sama, konsisten.`;
    return `${prevTxt} Rep turun dikit, wajar kalau lagi capek.`;
  }
  return `${prevTxt} Lebih ringan dari sesi lalu, nggak apa-apa.`;
}

async function currentMode(today: string): Promise<"normal" | "singkat"> {
  return (await getTodayPlan(today))?.mode ?? "normal";
}

// ---------- Perintah ----------

async function showToday(ctx: Ctx, today: string, force = false): Promise<void> {
  // Sesi kemarin yang lupa /selesai ditutup dulu supaya antrean maju dengan benar
  await closeStaleSessions(today);
  const settings = await getSettings();
  const plan = await getTodayPlan(today);

  if (plan?.status === "dilewati") {
    await ctx.send("Hari ini udah lo skip. Antrean nggak maju, besok lanjut dari menu yang sama. Kalau berubah pikiran, ketik /mulai.");
    return;
  }
  if (!force && !isWorkoutDay(today, settings)) {
    await ctx.send("😴 Hari ini jadwalnya istirahat. Jalan kaki santai atau stretching aja cukup.\nKalau mau tetap latihan, klik tombol di bawah.", [
      [{ text: "💪 Tetap latihan", data: "menu" }],
    ]);
    return;
  }

  const menu = await buildMenu(today, plan?.mode ?? "normal");
  if (!menu) {
    await ctx.send("Program latihan belum ada di database.");
    return;
  }
  await ctx.send(formatMenu(menu, today, settings), MENU_BUTTONS);
}

async function startWorkout(ctx: Ctx, today: string): Promise<SessionRow | null> {
  await closeStaleSessions(today);
  const open = await getOpenSession(today);
  if (open) {
    await ctx.send("Sesi hari ini udah jalan. Tinggal ketik set lo, atau /selesai kalau udah kelar.");
    return open;
  }

  const mode = await currentMode(today);
  const menu = await buildMenu(today, mode);
  if (!menu) {
    await ctx.send("Program latihan belum ada di database.");
    return null;
  }
  const session = await startSession(today, menu.day.id, mode);
  await savePlan(today, { program_day_id: menu.day.id, mode, status: "dikerjakan" });
  await ctx.send(`🔥 Sesi ${menu.day.name} dimulai. Semangat!\n\n${formatMenu(menu, today, await getSettings())}`, DURING_BUTTONS);
  return session;
}

async function setMode(ctx: Ctx, today: string, mode: "normal" | "singkat"): Promise<void> {
  const open = await getOpenSession(today);
  if (open) {
    await ctx.send("Sesi udah jalan, mode nggak bisa diganti lagi. Lanjut aja, atau /selesai kapan pun lo mau berhenti.");
    return;
  }
  await savePlan(today, { mode, status: "disarankan" });
  await ctx.send("Oke, versi singkat: cuma gerakan intinya, tetap kehitung latihan 👍");
  await showToday(ctx, today, true);
}

async function skipToday(ctx: Ctx, today: string): Promise<void> {
  const open = await getOpenSession(today);
  if (open) {
    await ctx.send("Sesi hari ini udah jalan. Kalau mau berhenti, ketik /selesai.");
    return;
  }
  await savePlan(today, { status: "dilewati" });
  await ctx.send("Oke, hari ini skip. Antrean nggak maju, jadi besok menunya tetap sama. Istirahat yang cukup 🙌");
}

async function askEnergy(ctx: Ctx, today: string): Promise<void> {
  const open = await getOpenSession(today);
  if (!open) {
    await ctx.send("Belum ada sesi yang jalan hari ini. Ketik /mulai dulu.");
    return;
  }
  await ctx.send("Seberapa berenergi lo tadi? (1 = habis banget, 5 = fit banget)", [
    [1, 2, 3, 4, 5].map((n) => ({ text: String(n), data: `energi:${open.id}:${n}` })),
  ]);
}

async function closeWorkout(ctx: Ctx, today: string, sessionId: number, energy: number): Promise<void> {
  await finishSession(sessionId, energy);

  const [sets, exercises, settings] = await Promise.all([getSessionSets(sessionId), loadExercises(), getSettings()]);
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const working = sets.filter((s) => !s.is_warmup);

  const history = await getHistory([...new Set(working.map((s) => s.exercise_id))], today);

  const lines: string[] = ["🏁 Latihan selesai!", ""];
  const perExercise = new Map<number, typeof working>();
  for (const s of working) perExercise.set(s.exercise_id, [...(perExercise.get(s.exercise_id) ?? []), s]);

  let volume = 0;
  const volumeByGroup = new Map<string, number>();
  for (const [exId, list] of perExercise) {
    const ex = byId.get(exId);
    const vol = list.reduce((a, s) => a + s.weight_kg * s.reps, 0);
    volume += vol;
    if (ex) volumeByGroup.set(ex.muscle_group, (volumeByGroup.get(ex.muscle_group) ?? 0) + vol);
    const top = best(list.map((s) => ({ weightKg: s.weight_kg, reps: s.reps })));
    lines.push(`• ${ex?.name ?? "Gerakan"}: ${list.length} set, terbaik ${fmtKg(top.weightKg)} kg × ${top.reps}`);
    const last = history.get(exId)?.[0];
    if (last) lines.push(`   ${compareToLast(last, top.weightKg, [top.reps])}`);
  }

  if (working.length === 0) {
    lines.push("Nggak ada set yang tercatat. Nggak apa-apa, yang penting udah niat datang 💪");
  } else {
    lines.push("");
    lines.push(`Total: ${working.length} set · volume ${fmtInt(volume)} kg`);
    const groups = [...volumeByGroup.entries()].sort((a, b) => b[1] - a[1]).map(([g, v]) => `${g} ${fmtInt(v)}`);
    lines.push(`Per otot (kg): ${groups.join(" · ")}`);
  }
  lines.push(`Energi: ${energy}/5`);
  const sesiNow = await getSessionById(sessionId);
  if (sesiNow?.cardio_min) lines.push(`🚶 Kardio: ${sesiNow.cardio_min} menit`);

  const [{ days }, sessions] = await Promise.all([loadProgram(), loadRecentSessions()]);
  const next = pilihHariIni(days, sessions, today, SESI_UTAMA_PER_MINGGU);
  if (next) lines.push(`Berikutnya: ${next.day.name}${next.jenis === "bonus" ? " (bonus, kalau mau latihan lagi)" : ""}`);
  lines.push(`🎯 Jangan lupa nutrisi: ${fmtInt(settings.target_kcal)} kcal · protein ${settings.target_protein_g} g`);
  if (!sesiNow?.cardio_min) lines.push("🚶 Belum kardio? Catat dengan: kardio 20 (menit)");

  // Pengingat timbang di gym (hari latihan terakhir minggu itu)
  const timbang = await bannerTimbang(today, settings);
  if (timbang) lines.push("", timbang, "Catat: /timbang 71.4 gym");
  await ctx.send(lines.join("\n"));

  // Kesimpulan: angka dihitung kode, AI cuma menulis; kalau AI gagal ada versi tanpa AI
  if (working.length > 0) {
    await ctx.send("🧠 Lagi nulis kesimpulan…");
    try {
      const k = await buatKesimpulanSesi(sessionId);
      await ctx.send(k ? k.text : "Kesimpulannya belum bisa dibuat.");
    } catch (err) {
      console.error("Kesimpulan gagal:", err);
      await ctx.send("Kesimpulannya belum bisa dibuat sekarang. Rekap di atas tetap tersimpan.");
    }
  }
}

async function showNext(ctx: Ctx, today: string): Promise<void> {
  const open = await getOpenSession(today);
  if (!open) {
    await ctx.send("Belum ada sesi yang jalan. Ketik /mulai dulu.");
    return;
  }
  const menu = await buildMenu(today, open.mode, open.program_day_id);
  if (!menu) return;
  const done = await getSessionSets(open.id);
  const nextItem = pickNext(menu, done);
  if (!nextItem) {
    await ctx.send("Semua gerakan di menu udah beres 🎉 Ketik /selesai buat nutup sesi.", [[{ text: "🏁 Selesai", data: "selesai" }]]);
    return;
  }
  await ctx.send(`Berikutnya: ${nextItem.exercise.name}\n${targetLine(nextItem)}\n↳ ${nextItem.target.note}`, DURING_BUTTONS);
}

function pickNext(menu: TodayMenu, doneSets: { exercise_id: number; is_warmup: boolean }[]) {
  return menu.items.find((p) => doneSets.filter((s) => s.exercise_id === p.exercise.id && !s.is_warmup).length < p.sets);
}

const BANTUAN_FORMAT = "Format nggak kebaca 🤔 Coba kayak gini:\nbench 60x10x3\nbench 60 10,10,9\nsquat 80 8 8 7 rpe8\n\nKalau mau cek perintah, ketik /bantuan.";

/** Format cepat gagal: coba kalimat bebas lewat AI kecil, lalu minta konfirmasi Nata (nggak langsung disimpan). */
async function tanyaKalimatBebas(ctx: Ctx, text: string): Promise<void> {
  // Pesan yang terlalu pendek atau panjang jelas bukan laporan set maupun makanan: nggak perlu panggil AI
  if (text.length < 4 || text.length > 200) {
    await ctx.send(BANTUAN_FORMAT);
    return;
  }
  const exercises = await loadExercises();
  const tebakan = await tebakSetBebas(text, exercises.map((e) => ({ nama: e.name, bodyweight: e.is_bodyweight })));
  // "tadi makan pizza 2 potong" tanpa /makan: arahkan ke penghitung kalori
  if (!tebakan.ok && tebakan.alasan === "makanan") {
    await handleMakanText(ctx, text);
    return;
  }
  if (!tebakan.ok) {
    await ctx.send(
      tebakan.alasan === "tidak_jelas"
        ? `Gua kurang yakin maksudnya. ${BANTUAN_FORMAT}`
        : tebakan.alasan === "error"
          ? `AI lagi nggak bisa bantu baca kalimat itu. ${BANTUAN_FORMAT}`
          : BANTUAN_FORMAT,
    );
    return;
  }
  const s = tebakan.set;
  const ex = exercises.find((e) => e.name === s.gerakan)!;
  const kode = kodeSet({ exerciseId: ex.id, bebanKg: s.bebanKg, reps: s.reps, rpe: s.rpe, pemanasan: s.pemanasan });
  await ctx.send(
    `Maksud lo: ${ex.name}${s.pemanasan ? " (pemanasan)" : ""} ${fmtKg(s.bebanKg)} kg × ${s.reps.join(", ")}${s.rpe ? ` · RPE ${s.rpe}` : ""}?`,
    [[{ text: "✅ Catat", data: kode }, { text: "❌ Bukan", data: "ft:x" }]],
  );
}

/** Tombol konfirmasi set dari kalimat bebas ("ft:..."). true kalau milik fitur ini. */
async function callbackKalimatBebas(ctx: Ctx, today: string, data: string): Promise<boolean> {
  if (data === "ft:x") {
    await ctx.send("Oke, nggak dicatat. Ketik ulang pakai format cepat, contoh: bench 60x10x3");
    return true;
  }
  if (!data.startsWith("ft:")) return false;
  const s = bacaKodeSet(data);
  if (!s) {
    await ctx.send("Kodenya nggak valid. Ketik ulang setmu ya.");
    return true;
  }
  const exercise = (await loadExercises()).find((e) => e.id === s.exerciseId);
  if (!exercise) {
    await ctx.send("Gerakannya nggak ketemu.");
    return true;
  }
  await catatSetKeSesi(ctx, today, exercise, { weightKg: s.bebanKg, reps: s.reps, rpe: s.rpe, isWarmup: s.pemanasan });
  return true;
}

async function logText(ctx: Ctx, today: string, text: string): Promise<void> {
  const parsed = parseSetText(text);
  if (!parsed.ok) return tanyaKalimatBebas(ctx, text);

  const exercises = await loadExercises();
  const found = resolveExercise(parsed.exerciseQuery, exercises);
  if (found.kind === "none") {
    await ctx.send(`Gerakan "${parsed.exerciseQuery}" nggak ada di daftar. Gerakan yang tersedia:\n${exercises.map((e) => `• ${e.name}`).join("\n")}`);
    return;
  }
  if (found.kind === "ambiguous") {
    await ctx.send(`"${parsed.exerciseQuery}" bisa berarti:\n${found.candidates.map((c) => `• ${c.name}`).join("\n")}\nUlangi pakai nama yang lebih lengkap.`);
    return;
  }
  const exercise: ExerciseRow = exercises.find((e) => e.id === found.exercise.id)!;
  return catatSetKeSesi(ctx, today, exercise, parsed);
}

/** Simpan set ke sesi hari ini (sesi dimulai otomatis kalau belum ada), lalu balas dengan perbandingan dan PR. */
async function catatSetKeSesi(
  ctx: Ctx,
  today: string,
  exercise: ExerciseRow,
  parsed: { weightKg: number; reps: number[]; rpe: number | null; isWarmup: boolean },
): Promise<void> {
  // Kalau belum /mulai, sesi dimulai otomatis (input secepat mungkin)
  await closeStaleSessions(today);
  let session = await getOpenSession(today);
  let autoStarted = "";
  if (!session) {
    const mode = await currentMode(today);
    const menu = await buildMenu(today, mode);
    if (!menu) {
      await ctx.send("Program latihan belum ada di database.");
      return;
    }
    session = await startSession(today, menu.day.id, mode);
    await savePlan(today, { program_day_id: menu.day.id, mode, status: "dikerjakan" });
    autoStarted = `(Sesi ${menu.day.name} dimulai otomatis.)\n`;
  }

  const [history, before] = await Promise.all([getHistory([exercise.id], today), getSessionSets(session.id)]);
  const pastSessions = history.get(exercise.id) ?? [];
  const previousSets = [
    ...pastSessions.flatMap((s) => s.sets),
    ...before.filter((s) => s.exercise_id === exercise.id && !s.is_warmup).map((s) => ({ weightKg: s.weight_kg, reps: s.reps })),
  ];

  await logSets({
    sessionId: session.id,
    exerciseId: exercise.id,
    weightKg: parsed.weightKg,
    reps: parsed.reps,
    rpe: parsed.rpe,
    isWarmup: parsed.isWarmup,
  });

  const lines: string[] = [];
  if (autoStarted) lines.push(autoStarted.trim());
  const repsTxt = parsed.reps.join(", ");
  lines.push(`✅ ${exercise.name}${parsed.isWarmup ? " (pemanasan)" : ""}: ${fmtKg(parsed.weightKg)} kg × ${repsTxt}${parsed.rpe ? ` · RPE ${parsed.rpe}` : ""}`);

  if (!parsed.isWarmup) {
    lines.push(compareToLast(pastSessions[0], parsed.weightKg, parsed.reps));

    let prE1rm = false;
    let prReps = false;
    let prevBest: number | null = null;
    let running = previousSets;
    for (const reps of parsed.reps) {
      const r = detectPR({ weightKg: parsed.weightKg, reps }, running);
      prE1rm ||= r.e1rm;
      prReps ||= r.reps;
      prevBest = r.previousBestE1rm;
      running = [...running, { weightKg: parsed.weightKg, reps }];
    }
    if (prE1rm) lines.push(`🎉 PR baru! Estimasi 1RM naik${prevBest ? ` (sebelumnya ±${fmtKg(prevBest)} kg)` : ""}.`);
    else if (prReps) lines.push(`🎉 PR rep di ${fmtKg(parsed.weightKg)} kg!`);

    const mode = session.mode;
    const menu = await buildMenu(today, mode, session.program_day_id);
    if (menu) {
      const planned = menu.items.find((p) => p.exercise.id === exercise.id);
      const doneNow =
        before.filter((s) => s.exercise_id === exercise.id && !s.is_warmup).length + parsed.reps.length;
      if (planned) lines.push(`Progres ${exercise.name}: ${doneNow}/${planned.sets} set${doneNow >= planned.sets ? " ✅" : ""}`);
      const after = [
        ...before,
        ...parsed.reps.map(() => ({ exercise_id: exercise.id, is_warmup: false })),
      ];
      const nxt = pickNext(menu, after);
      if (nxt && (!planned || doneNow >= planned.sets)) lines.push(`Berikutnya: ${nxt.exercise.name} — ${targetLine(nxt)}`);
      else if (!nxt) lines.push("Semua gerakan di menu beres! Ketik /selesai kalau udah puas.");
    }
  }

  await ctx.send(lines.join("\n"), DURING_BUTTONS);
}

async function logWeight(ctx: Ctx, arg: string): Promise<void> {
  const m = arg.toLowerCase().match(/(\d+(?:[.,]\d+)?)/);
  if (!m) {
    await ctx.send("Contoh: /timbang 71.4\nTambah kata 'pagi' kalau habis bangun, ke toilet, dan belum makan/minum: /timbang 71.4 pagi");
    return;
  }
  const kg = parseFloat(m[1].replace(",", "."));
  if (!(kg >= 30 && kg <= 250)) {
    await ctx.send("Angkanya kayaknya nggak masuk akal. Coba lagi, contoh: /timbang 71.4");
    return;
  }
  const a = arg.toLowerCase();
  const condition = /\bgym\b|\bsebelum\b/.test(a)
    ? "sebelum_latihan"
    : /\bpagi\b/.test(a)
      ? "pagi_puasa"
      : /\bsetelah\b|\bhabis\b/.test(a)
        ? "setelah_olahraga"
        : "lainnya";
  const { previous, avg7 } = await addWeight(kg, condition);
  const standar = condition === "sebelum_latihan" || condition === "pagi_puasa";
  const label = { sebelum_latihan: "sebelum latihan di gym", pagi_puasa: "pagi, belum makan", setelah_olahraga: "setelah latihan", setelah_makan: "setelah makan", lainnya: "" }[condition];
  const lines = [`⚖️ Tercatat ${fmtKg(kg)} kg${standar ? ` (kondisi standar: ${label})` : label ? ` (${label})` : ""}.`];
  if (previous != null) {
    const d = kg - previous;
    lines.push(`Dibanding timbangan sebelumnya: ${d >= 0 ? "+" : ""}${fmtKg(d)} kg`);
  }
  lines.push(`Rata-rata 7 hari: ${fmtKg(avg7)} kg`);
  if (!standar) lines.push("Tip: timbang di gym SEBELUM latihan, hari latihan terakhir minggu itu, dan tambah kata 'gym': /timbang 71.4 gym");
  await ctx.send(lines.join("\n"));
}

// ---------- Pintu masuk ----------

export type BotUpdate = {
  text?: string;
  callbackData?: string;
  /** file_id foto terbesar yang dikirim, plus keterangannya */
  photoFileId?: string;
  caption?: string;
};

export async function handleBotInput(input: BotUpdate, ctx: Ctx): Promise<void> {
  const today = ctx.today ?? todayWIB();

  if (input.photoFileId) {
    // Foto dengan caption "tanita" = layar timbangan komposisi badan; selain itu dianggap makanan
    if (KATA_TANITA.test(input.caption ?? "")) return handleTanita(ctx, input.photoFileId, input.caption);
    return handlePhoto(ctx, input.photoFileId, input.caption);
  }

  if (input.callbackData) {
    const data = input.callbackData;
    if (await callbackTanita(ctx, data)) return;
    if (await callbackDeload(ctx, data)) return;
    if (await callbackKalimatBebas(ctx, today, data)) return;
    if (await handleNutriCallback(ctx, data)) return;
    if (data === "mulai") return void (await startWorkout(ctx, today));
    if (data === "singkat") return setMode(ctx, today, "singkat");
    if (data === "skip") return skipToday(ctx, today);
    if (data === "menu") return showToday(ctx, today, true);
    if (data === "ganti") return showGantiMenu(ctx, today);
    const pm = data.match(/^pm:(\d+)$/);
    if (pm) return pilihMenu(ctx, today, Number(pm[1]), () => showToday(ctx, today, true));
    if (await callbackSuplemen(ctx, today, data)) return;
    if (data === "next") return showNext(ctx, today);
    if (data === "selesai") return askEnergy(ctx, today);
    const e = data.match(/^energi:(\d+):([1-5])$/);
    if (e) return closeWorkout(ctx, today, parseInt(e[1], 10), parseInt(e[2], 10));
    return;
  }

  const text = (input.text ?? "").trim();
  if (!text) return;

  if (text.startsWith("/")) {
    const [rawCmd, ...rest] = text.split(/\s+/);
    const cmd = rawCmd.toLowerCase().replace(/@.*$/, "");
    switch (cmd) {
      case "/start":
        return ctx.send("Halo Nata! 💪 Bot Gym Tracker udah nyala.\nKetik /hari_ini buat lihat menu latihan, atau /bantuan buat daftar perintah.");
      case "/bantuan":
      case "/help":
        return ctx.send(HELP);
      case "/hari_ini":
        return showToday(ctx, today);
      case "/mulai":
        return void (await startWorkout(ctx, today));
      case "/singkat":
        return setMode(ctx, today, "singkat");
      case "/skip":
        return skipToday(ctx, today);
      case "/selesai":
        return askEnergy(ctx, today);
      case "/timbang":
        return logWeight(ctx, rest.join(" "));
      case "/makan":
        return handleMakanText(ctx, rest.join(" "));
      case "/fav":
        return showFavorites(ctx);
      case "/nutrisi":
        return showProgress(ctx);
      case "/menu":
        return showGantiMenu(ctx, today);
      case "/ramadan":
        return perintahRamadan(ctx, rest.join(" "));
      case "/deload":
        return perintahDeload(ctx, rest.join(" "));
      case "/suplemen":
        return tampilSuplemen(ctx, today);
      case "/kardio":
        return catatKardio(ctx, today, parseInt(rest[0] ?? "", 10));
      default:
        return ctx.send("Perintah itu belum ada. Ketik /bantuan buat daftar yang tersedia.");
    }
  }

  // "kardio 20" (menit) tanpa garis miring
  const kardio = text.toLowerCase().match(/^kardio\s+(\d{1,3})$/);
  if (kardio) return catatKardio(ctx, today, parseInt(kardio[1], 10));

  return logText(ctx, today, text);
}
