"use client";

// Tombol +/− besar supaya gampang dipencet di gym. Angka juga bisa diketik kalau perlu.

type Props = {
  label: string;
  unit?: string;
  value: number;
  onChange: (n: number) => void;
  step: number;
  min?: number;
  max?: number;
};

const bulat = (n: number) => Math.round(n * 100) / 100;

export function Stepper({ label, unit, value, onChange, step, min = 0, max = 500 }: Props) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, bulat(n))));

  return (
    <div className="flex flex-col items-center">
      <span className="mb-1.5 text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <div className="flex w-full items-center gap-2">
        <button
          type="button"
          aria-label={`Kurangi ${label}`}
          onClick={() => set(value - step)}
          className="h-14 w-14 shrink-0 rounded-2xl bg-white/10 text-3xl font-light active:scale-95 active:bg-white/20"
        >
          −
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            type="number"
            inputMode="decimal"
            value={Number.isFinite(value) ? value : ""}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (Number.isFinite(n)) set(n);
            }}
            onFocus={(e) => e.currentTarget.select()}
            className="h-14 w-full rounded-2xl bg-black/30 text-center text-2xl font-semibold outline-none ring-1 ring-white/10 focus:ring-emerald-400/60"
          />
          {unit && <span className="pointer-events-none absolute bottom-1 right-3 text-[10px] text-slate-500">{unit}</span>}
        </div>
        <button
          type="button"
          aria-label={`Tambah ${label}`}
          onClick={() => set(value + step)}
          className="h-14 w-14 shrink-0 rounded-2xl bg-white/10 text-3xl font-light active:scale-95 active:bg-white/20"
        >
          +
        </button>
      </div>
    </div>
  );
}
