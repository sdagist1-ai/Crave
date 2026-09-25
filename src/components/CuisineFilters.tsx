import { useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { byRegion, cuisinesLabel, NEEDS_CUISINE, type ListFacets } from "../lib/cuisines";
import { OCCASIONS } from "../constants/theme";
import { FilterChip, PrimaryButton, Sheet } from "./ui";

type Tab = "cravelist" | "tried";

/**
 * The filter chips on the list and Spin: All · [your cuisines ✕] · Cuisines ▾ · the
 * occasions this list actually has. Cuisines are picked in a sheet, so the row stays
 * short however many there are.
 */
export function FilterRow({ facets, tab, cuisines, occasion, onCuisines, onOccasion }: {
  facets: ListFacets | undefined;
  tab: Tab;
  cuisines: string[];
  occasion: string | null;
  onCuisines: (cuisines: string[]) => void;
  onOccasion: (occasion: string | null) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const occasions = OCCASIONS.filter((o) =>
    o === occasion || (facets?.occasions.find((f) => f.label === o)?.[tab] ?? 0) > 0);
  const hasCuisines = !facets || facets.cuisines.length > 0 || facets.needs_cuisine[tab] > 0;

  return (
    <>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
        <FilterChip active={cuisines.length === 0 && !occasion} onClick={() => { onCuisines([]); onOccasion(null); }}>All</FilterChip>
        {cuisines.length > 0 && (
          <button
            type="button"
            onClick={() => onCuisines([])}
            aria-label={`Showing ${cuisinesLabel(cuisines)}. Tap to show every cuisine`}
            className="flex h-9 max-w-[220px] shrink-0 items-center gap-1.5 rounded-full border border-accent bg-accent-soft pr-2.5 pl-3.5 text-[13px] font-medium text-accent-ink"
          >
            <span className="truncate">{cuisinesLabel(cuisines)}</span>
            <X size={14} strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
        {hasCuisines && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-border pr-2.5 pl-3.5 text-[13px] text-ink-2 active:bg-subtle"
          >
            Cuisines <ChevronDown size={14} aria-hidden="true" />
          </button>
        )}
        {occasions.length > 0 && <span className="my-2 w-px shrink-0 bg-border" aria-hidden="true" />}
        {occasions.map((o) => (
          <FilterChip key={o} active={occasion === o} onClick={() => onOccasion(occasion === o ? null : o)}>{o}</FilterChip>
        ))}
      </div>

      {sheetOpen && (
        <CuisineSheet
          facets={facets}
          tab={tab}
          selected={cuisines}
          onApply={(next) => { onCuisines(next); setSheetOpen(false); }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}

/** Every cuisine on the list, grouped by region with counts. Pick one or several. */
function CuisineSheet({ facets, tab, selected, onApply, onClose }: {
  facets: ListFacets | undefined;
  tab: Tab;
  selected: string[];
  onApply: (cuisines: string[]) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(selected);
  const [query, setQuery] = useState("");
  const toggle = (label: string) =>
    setPicked(picked.includes(label) ? picked.filter((c) => c !== label) : [...picked, label]);

  const q = query.trim().toLowerCase();
  const all = facets?.cuisines ?? [];
  const regions = byRegion(all.filter((c) =>
    (c[tab] > 0 || picked.includes(c.label)) && (!q || c.label.toLowerCase().includes(q) || c.region.toLowerCase().includes(q))));
  const needs = facets?.needs_cuisine[tab] ?? 0;
  const showNeeds = (needs > 0 || picked.includes(NEEDS_CUISINE)) && (!q || "needs a cuisine".includes(q));

  const count = (label: string) =>
    label === NEEDS_CUISINE ? needs : all.find((c) => c.label === label)?.[tab] ?? 0;
  const total = picked.reduce((sum, c) => sum + count(c), 0);

  const chip = (label: string, name: string, n: number) => {
    const on = picked.includes(label);
    return (
      <button
        key={label || "needs"}
        type="button"
        onClick={() => toggle(label)}
        aria-pressed={on}
        className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors ${on ? "border-accent bg-accent-soft font-medium text-accent-ink" : "border-border text-ink-2 active:bg-subtle"}`}
      >
        {name}
        <span className={`font-mono text-[11px] tabular ${on ? "text-accent-ink" : "text-muted"}`}>{n}</span>
      </button>
    );
  };

  return (
    <Sheet title="Cuisines" onClose={onClose}>
      <label className="mb-4 flex h-11 items-center gap-2 rounded-2xl bg-subtle px-3.5 text-muted">
        <Search size={16} aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cuisines"
          aria-label="Search cuisines"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
        />
      </label>

      <div className="flex flex-col gap-4 pb-4">
        {regions.map(([region, items]) => (
          <section key={region}>
            <h3 className="m-0 mb-2 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">{region}</h3>
            <div className="flex flex-wrap gap-2">{items.map((c) => chip(c.label, c.label, c[tab]))}</div>
          </section>
        ))}
        {showNeeds && (
          <section>
            <h3 className="m-0 mb-2 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">Not sorted yet</h3>
            <div className="flex flex-wrap gap-2">{chip(NEEDS_CUISINE, "Needs a cuisine", needs)}</div>
          </section>
        )}
        {regions.length === 0 && !showNeeds && (
          <p className="m-0 py-6 text-center text-sm text-muted">
            {q ? `No “${query.trim()}” on this list yet.` : "No cuisines here yet."}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 flex gap-2 bg-surface px-5 pt-2 pb-2">
        <button type="button" onClick={() => setPicked([])} disabled={picked.length === 0}
          className="h-[54px] flex-1 rounded-[18px] border border-border text-[15px] font-semibold disabled:opacity-40">Clear</button>
        <PrimaryButton onClick={() => onApply(picked)} className="flex-[2]">
          {picked.length === 0 ? "Show everything" : `Show ${total} ${total === 1 ? "place" : "places"}`}
        </PrimaryButton>
      </div>
    </Sheet>
  );
}
