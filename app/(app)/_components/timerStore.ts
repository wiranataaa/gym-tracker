// Penyimpanan timer istirahat di browser (localStorage), supaya hitungannya tetap jalan walau layar
// dikunci, pindah tab/app, atau halaman dimuat ulang. Yang disimpan waktu SELESAI (bukan sisa detik),
// jadi hitungan selalu benar walau browser sempat "tidur".

const KEY_TIMER = "gym-rest-timer";
const KEY_ON = "gym-rest-on";

export type TimerState = { akhir: number; total: number };

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY_TIMER || e.key === KEY_ON) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function baca(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function tulis(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // mode privat: timer tetap jalan di sesi ini lewat emit, hanya nggak tahan muat ulang
  }
  emit();
}

export const bacaTimerMentah = () => baca(KEY_TIMER);
export const bacaSakelarMentah = () => baca(KEY_ON);

export function parseTimer(raw: string | null): TimerState | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as TimerState;
    return Number.isFinite(t.akhir) && Number.isFinite(t.total) && t.total > 0 ? t : null;
  } catch {
    return null;
  }
}

export const timerNyala = (raw: string | null) => raw !== "0";

export function setTimerNyala(nyala: boolean) {
  tulis(KEY_ON, nyala ? "1" : "0");
  if (!nyala) hentikanTimer();
}

export function mulaiTimer(detik: number) {
  tulis(KEY_TIMER, JSON.stringify({ akhir: Date.now() + detik * 1000, total: detik } satisfies TimerState));
}

export function ubahTimer(t: TimerState) {
  tulis(KEY_TIMER, JSON.stringify(t));
}

export function hentikanTimer() {
  tulis(KEY_TIMER, null);
}

// ---------- Bunyi & getar ----------

let audio: AudioContext | null = null;

/** Panggil di dalam tap/klik pengguna (aturan browser), supaya bunyi bisa keluar nanti saat timer habis. */
export function bukaAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audio ??= new Ctor();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    // tanpa suara pun timer tetap jalan
  }
}

export function bunyi() {
  try {
    navigator.vibrate?.([250, 120, 250, 120, 400]); // Android; iPhone nggak mendukung getar dari web
    if (!audio) return;
    const mulai = audio.currentTime;
    [0, 0.25, 0.5].forEach((delay, i) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.frequency.value = i === 2 ? 1175 : 880;
      gain.gain.setValueAtTime(0.0001, mulai + delay);
      gain.gain.exponentialRampToValueAtTime(0.4, mulai + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, mulai + delay + 0.2);
      osc.connect(gain).connect(audio!.destination);
      osc.start(mulai + delay);
      osc.stop(mulai + delay + 0.22);
    });
  } catch {
    // diam saja
  }
}
