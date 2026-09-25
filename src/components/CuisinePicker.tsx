import { useState } from "react";
import { CUISINES, OCCASIONS } from "../constants/theme";
import { FilterChip, PrimaryButton, Sheet } from "./ui";

/**
 * "What cuisine is it?" One of the cuisine groups, plus what the place is good for.
 * Whatever is saved is shared with the whole list.
 */
export function CuisinePicker({ value, occasions, onSave, onClose, saving, error }: {
  value: string | null;
  occasions: string[];
  onSave: (next: { cuisine: string | null; occasions: string[] }) => void;
  onClose: () => void;
  saving?: boolean;
  error?: string | null;
}) {
  const [cuisine, setCuisine] = useState<string | null>(value);
  const [picked, setPicked] = useState<string[]>(occasions);

  const sameOccasions = picked.length === occasions.length && picked.every((o) => occasions.includes(o));
  const changed = cuisine !== value || !sameOccasions;

  return (
    <Sheet title="What cuisine is it?" onClose={onClose}>
      <div className="flex flex-col gap-5 pb-4">
        <div className="flex flex-wrap gap-2">
          {CUISINES.map((c) => (
            <FilterChip key={c} active={cuisine === c} onClick={() => setCuisine(cuisine === c ? null : c)}>{c}</FilterChip>
          ))}
        </div>

        <section>
          <h3 className="m-0 mb-2 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">Good for</h3>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <FilterChip key={o} active={picked.includes(o)}
                onClick={() => setPicked(picked.includes(o) ? picked.filter((x) => x !== o) : [...picked, o])}>
                {o}
              </FilterChip>
            ))}
          </div>
        </section>
      </div>

      {error && <p role="alert" className="m-0 mb-2 text-center text-sm font-medium text-danger">{error}</p>}
      <div className="sticky bottom-0 -mx-5 flex gap-2 bg-surface px-5 pt-2 pb-2">
        <PrimaryButton
          onClick={() => onSave({ cuisine, occasions: OCCASIONS.filter((o) => picked.includes(o)) })}
          disabled={saving || !changed}
        >
          {saving ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>
    </Sheet>
  );
}
