import { MUST_SCORE } from "../types";

/** 1–10 score picker (radio group). 9–10 are highlighted as MUST territory. */
export function ScoreRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Score out of 10" className="grid grid-cols-5 gap-2">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const selected = n === value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${n} out of 10`}
            onClick={() => onChange(n)}
            className={`h-12 rounded-2xl font-mono text-base font-semibold transition-all active:scale-95 ${
              selected
                ? n >= MUST_SCORE ? "bg-accent text-white shadow-accent" : "bg-ink text-white"
                : "border border-border bg-surface text-ink-2"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
