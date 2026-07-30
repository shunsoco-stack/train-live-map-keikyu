"use client";

import { TRAIN_FILTERS, type TrainFilterKey } from "@/lib/trainStatus";

interface TrainFilterBarProps {
  value: TrainFilterKey;
  onChange: (key: TrainFilterKey) => void;
  counts: Record<TrainFilterKey, number>;
}

/**
 * 列車の絞り込みフィルター。
 * スマホでも押しやすいよう、十分なタップ領域(高さ)を確保する。
 */
export function TrainFilterBar({ value, onChange, counts }: TrainFilterBarProps) {
  return (
    <div
      role="group"
      aria-label="列車の絞り込み"
      className="scrollbar-none pointer-events-auto flex snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain"
    >
      {TRAIN_FILTERS.map((f) => {
        const active = f.key === value;
        return (
          <button
            key={f.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(f.key)}
            className={`pressable flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-xl border px-3 text-sm font-bold focus-visible:outline-none ${
              active
                ? "border-rail-accent bg-rail-accent text-white shadow-[0_6px_14px_rgba(184,0,36,0.18)]"
                : "border-transparent bg-white/45 text-rail-text hover:border-[#e7a7b4] hover:bg-white/80"
            }`}
          >
            <span>{f.label}</span>
            <span
              className={`min-w-[1.25rem] rounded-full px-1 text-center text-[11px] tabular-nums ${
                active ? "bg-black/20 text-white" : "bg-[#eee6e8] text-rail-muted"
              }`}
            >
              {counts[f.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
