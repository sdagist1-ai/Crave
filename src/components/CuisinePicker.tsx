import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { byRegion, catalogQuery, type ListFacets } from "../lib/cuisines";
import { OCCASIONS } from "../constants/theme";
import { FilterChip, PrimaryButton, Sheet } from "./ui";

const tidy = (s: string) => s.replace(/[^\p{L} &'-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 30);

/**
 * "What cuisine is it?" Pick from what's likely, what's already on the list, or every
 * cuisine Crave knows; anything else can be typed in. With `occasions`, the place's
 * occasions can be changed here too. Whatever is saved is shared with the whole list.
 */
export function CuisinePicker({ value, suggestions = [], facets, occasions, onSave, onClose, saving, error }: {
  value: string | null;
  /** Likely cuisines first: the guess and what other lists call this place. */
  suggestions?: string[];
  facets?: ListFacets;
  /** Pass to edit occasions as well. */
  occasions?: string[];
  onSave: (next: { cuisine: string | null; occasions?: string[] }) => void;
  onClose: () => void;
  saving?: boolean;
  error?: string | null;
}) {
  const catalog = useQuery(catalogQuery).data ?? [];
  const [cuisine, setCuisine] = useState<string | null>(value);
  const [picked, setPicked] = useState<string[]>(occasions ?? []);
  const [query, setQuery] = useState("");

  const q = tidy(query).toLowerCase();
  const onList = (facets?.cuisines ?? []).map((c) => c.label);
  const suggested = [...new Set(suggestions.filter(Boolean))];
  const matches = !q ? [] : [...new Set([...catalog.map((c) => c.label), ...onList])]
    .filter((l) => l.toLowerCase().includes(q))
    .sort((a, b) => Number(!a.toLowerCase().startsWith(q)) - Number(!b.toLowerCase().startsWith(q)));
  // Typed something Crave doesn't know: offer it as-is (it stays on this list until
  // another list calls the place the same thing).
  const custom = q && !matches.some((m) => m.toLowerCase() === q) ? tidy(query) : null;

  const chip = (label: string) => (
    <FilterChip key={label} active={cuisine === label} onClick={() => setCuisine(cuisine === label ? null : label)}>
      {label}
    </FilterChip>
  );
  const section = (title: string, labels: string[]) => labels.length > 0 && (
    <section key={title}>
      <h3 className="m-0 mb-2 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">{title}</h3>
      <div className="flex flex-wrap gap-2">{labels.map(chip)}</div>
    </section>
  );

  const sameOccasions = (a: string[], b: string[]) => a.length === b.length && a.every((o) => b.includes(o));
  const changed = cuisine !== value || (occasions !== undefined && !sameOccasions(picked, occasions));

  return (
    <Sheet title="What cuisine is it?" onClose={onClose}>
      <label className="mb-4 flex h-11 items-center gap-2 rounded-2xl bg-subtle px-3.5 text-muted">
        <Search size={16} aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search or type a cuisine"
          aria-label="Search or type a cuisine"
          maxLength={40}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
        />
      </label>

      <div className="flex flex-col gap-4 pb-4">
        {q ? (
          <>
            {section("Matches", matches.slice(0, 12))}
            {custom && (
              <div className="flex flex-wrap gap-2">
                <FilterChip active={cuisine === custom} onClick={() => setCuisine(custom)}>Use “{custom}”</FilterChip>
              </div>
            )}
          </>
        ) : (
          <>
            {cuisine && !suggested.includes(cuisine) && !onList.includes(cuisine) && section("Current", [cuisine])}
            {section("Suggested", suggested)}
            {section("On your list", onList.filter((l) => !suggested.includes(l)))}
            {occasions !== undefined && (
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
            )}
            {byRegion(catalog.filter((c) => !suggested.includes(c.label) && !onList.includes(c.label)))
              .map(([region, items]) => section(region, items.map((c) => c.label)))}
          </>
        )}
      </div>

      {error && <p role="alert" className="m-0 mb-2 text-center text-sm font-medium text-danger">{error}</p>}
      <div className="sticky bottom-0 -mx-5 flex gap-2 bg-surface px-5 pt-2 pb-2">
        {value && (
          <button type="button" onClick={() => setCuisine(null)} disabled={!cuisine}
            className="h-[54px] flex-1 rounded-[18px] border border-border text-[15px] font-semibold disabled:opacity-40">
            No cuisine
          </button>
        )}
        <PrimaryButton
          onClick={() => onSave({ cuisine, ...(occasions !== undefined ? { occasions: OCCASIONS.filter((o) => picked.includes(o)) } : {}) })}
          disabled={saving || !changed}
          className="flex-[2]"
        >
          {saving ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>
    </Sheet>
  );
}
