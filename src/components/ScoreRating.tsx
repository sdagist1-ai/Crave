import { C } from "../constants/theme";

export function ScoreRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  function getScoreColor(n: number): string {
    if (n <= 3) return C.rose;
    if (n <= 5) return "#F97316";
    if (n <= 7) return C.amber;
    if (n <= 9) return "#84CC16";
    return C.emerald;
  }

  return (
    <div className="flex gap-1.5 flex-wrap justify-center">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => {
        const isSelected = i === value;
        const color = getScoreColor(i);
        return (
          <button key={i} type="button" onClick={() => onChange?.(i)} disabled={!onChange}
            className="w-10 h-10 rounded-xl text-sm font-black transition-all active:scale-110 flex items-center justify-center"
            style={isSelected
              ? { background: color, color: "#fff", boxShadow: `0 4px 12px ${color}40` }
              : { background: C.slate100, color: C.slate500 }}>
            {i}
          </button>
        );
      })}
    </div>
  );
}
