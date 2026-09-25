import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Plus, SlidersHorizontal } from "lucide-react";
import type { Group, Restaurant, SortOption } from "../types";
import { feedQuery } from "../lib/restaurants";
import { CATEGORIES, SORT_LABELS, VIBE_OPTIONS } from "../constants/theme";
import { RestaurantCard, RestaurantCardSkeleton } from "../components/RestaurantCard";
import { AvatarStack, Eyebrow, FilterChip, Glow, PrimaryButton, Segmented, Sheet } from "../components/ui";

type Tab = "cravelist" | "tried";

export function ListTab({ uid, group, groups, onSelectGroup, onAdd, onOpen, active = true }: {
  uid: string;
  group: Group | undefined;
  groups: Group[];
  onSelectGroup: (id: string) => void;
  /** Open "add a place", optionally pre-filled with a search */
  onAdd: (query?: string) => void;
  onOpen: (r: Restaurant) => void;
  /** On screen now (hidden tabs don't refetch). */
  active?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("cravelist");
  const [category, setCategory] = useState<string | null>(null);
  const [vibes, setVibes] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>("newest");
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const feed = useInfiniteQuery({
    ...feedQuery(uid, group?.id, { tab, category, vibes, sort }),
    enabled: !!group,
    placeholderData: keepPreviousData,
    // Hidden tabs keep their data but don't refetch; they catch up when shown.
    subscribed: active,
  });
  const restaurants = feed.data?.pages.flatMap((p) => p.restaurants) ?? [];

  // Infinite scroll. Re-observe whenever a page lands so a sentinel that is
  // still on screen triggers the next page.
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) fetchNextPage();
    }, { rootMargin: "400px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, restaurants.length]);

  const memberCount = group?.members.length ?? 1;
  const triedCount = group?.tried_count ?? 0;
  const cravelistCount = (group?.place_count ?? 0) - triedCount;
  const filtersActive = sort !== "newest" || vibes.length > 0;
  const anyFilter = filtersActive || !!category;

  const clearFilters = () => { setCategory(null); setVibes([]); setSort("newest"); };

  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden pb-[120px]">
      <Glow side="right" />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-[18px] px-5 pt-safe">
        {/* Top row: list switcher + add */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setShowSwitcher(true)}
            className="flex min-h-11 items-center gap-2.5 rounded-full border border-border bg-surface py-1.5 pr-3.5 pl-1.5 text-left"
            aria-haspopup="dialog"
          >
            <AvatarStack people={group?.members ?? []} max={3} size={30} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="max-w-[150px] truncate text-[15px] font-semibold">{group?.name ?? "Cravelist"}</span>
              <span className="text-[11px] font-medium text-muted">
                {memberCount} {memberCount === 1 ? "member" : "members"}
              </span>
            </span>
            <ChevronDown size={14} className="text-muted" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onAdd()}
            aria-label="Add a restaurant"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white shadow-accent transition-transform active:scale-95"
          >
            <Plus size={20} strokeWidth={2.6} />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <Eyebrow>
            <span className="tabular">{group?.place_count ?? 0}</span> saved · <span className="tabular">{triedCount}</span> tried
          </Eyebrow>
          <h1 className="m-0 font-display text-[44px] leading-none font-extrabold tracking-[-0.03em]">
            What are we<br />craving?
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { id: "cravelist", label: "Cravelist", count: Math.max(0, cravelistCount) },
                { id: "tried", label: "Tried", count: triedCount },
              ]}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            aria-label={filtersActive ? "Sort and filter (active)" : "Sort and filter"}
            className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[14px] border ${filtersActive ? "border-accent bg-accent-soft text-accent-ink" : "border-border bg-surface text-muted"}`}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
          <FilterChip active={!category} onClick={() => setCategory(null)}>All</FilterChip>
          {CATEGORIES.map((c) => (
            <FilterChip key={c.id} active={category === c.id} onClick={() => setCategory(category === c.id ? null : c.id)}>
              {c.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* The list */}
      <div className={`relative mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 px-5 pt-[18px] transition-opacity md:grid-cols-2 ${feed.isPlaceholderData ? "opacity-60" : ""}`}>
        {feed.isPending ? (
          [0, 1, 2, 3].map((i) => <RestaurantCardSkeleton key={i} />)
        ) : feed.isError && restaurants.length === 0 ? (
          <EmptyState
            title="Couldn't load your list"
            body="Check your connection and try again."
            action={<PrimaryButton onClick={() => feed.refetch()} block={false}>Try again</PrimaryButton>}
          />
        ) : restaurants.length === 0 ? (
          (group?.place_count ?? 0) === 0 ? (
            <EmptyState
              title="Start your Cravelist"
              body="Save the places you want to try. Everyone in this list sees them."
              action={<PrimaryButton onClick={() => onAdd()} block={false}><Plus size={18} /> Add a place</PrimaryButton>}
            />
          ) : anyFilter ? (
            <EmptyState
              title="Nothing matches"
              body="Try another category or clear your filters."
              action={<button type="button" onClick={clearFilters} className="h-11 rounded-full px-4 text-sm font-semibold text-accent-ink">Clear filters</button>}
            />
          ) : (
            <EmptyState
              title={tab === "tried" ? "Nothing tried yet" : "Everything's been tried"}
              body={tab === "tried" ? "Rate a place after you visit and it lands here." : "Add somewhere new to keep the list going."}
            />
          )
        ) : (
          <>
            {restaurants.map((r) => (
              <RestaurantCard key={r.id} restaurant={r} memberCount={memberCount} onOpen={onOpen} />
            ))}
            <div ref={sentinel} className="flex h-10 items-center justify-center md:col-span-2" aria-hidden="true">
              {feed.isFetchingNextPage && <Loader2 size={18} className="animate-spin text-muted" />}
            </div>
          </>
        )}
      </div>

      {showSwitcher && (
        <Sheet title="Your Cravelists" onClose={() => setShowSwitcher(false)}>
          <div className="flex flex-col gap-1 pb-2">
            {groups.map((g) => {
              const active = g.id === group?.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { onSelectGroup(g.id); setShowSwitcher(false); }}
                  className={`flex items-center gap-3 rounded-2xl p-3 text-left ${active ? "bg-accent-tint" : "active:bg-subtle"}`}
                  aria-current={active ? "true" : undefined}
                >
                  <AvatarStack people={g.members} max={3} size={32} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold">{g.name}</span>
                    <span className="text-xs text-muted">
                      {g.members.length} {g.members.length === 1 ? "member" : "members"} · {g.place_count} spots
                    </span>
                  </span>
                  {active && <Check size={18} className="text-accent" aria-label="Current list" />}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}

      {showFilters && (
        <Sheet title="Sort & filter" onClose={() => setShowFilters(false)}>
          <fieldset className="m-0 mb-5 border-0 p-0">
            <legend className="mb-2 text-[13px] font-medium text-ink-2">Sort by</legend>
            <div className="flex flex-col gap-1">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                <label key={opt} className={`flex min-h-12 items-center justify-between rounded-2xl px-4 ${sort === opt ? "bg-accent-tint" : ""}`}>
                  <span className="text-[15px]">{SORT_LABELS[opt]}</span>
                  <input type="radio" name="sort" value={opt} checked={sort === opt} onChange={() => setSort(opt)}
                    className="h-5 w-5 accent-[#ff453a]" />
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="m-0 mb-6 border-0 p-0">
            <legend className="mb-2 text-[13px] font-medium text-ink-2">Vibe</legend>
            <div className="flex gap-2">
              {VIBE_OPTIONS.map((v) => (
                <FilterChip key={v} active={vibes.includes(v)}
                  onClick={() => setVibes(vibes.includes(v) ? vibes.filter((x) => x !== v) : [...vibes, v])}>
                  {v}
                </FilterChip>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-2 pb-2">
            <button type="button" onClick={() => { setSort("newest"); setVibes([]); }}
              className="h-[54px] flex-1 rounded-[18px] border border-border text-[15px] font-semibold">Reset</button>
            <PrimaryButton onClick={() => setShowFilters(false)} className="flex-1">Done</PrimaryButton>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center animate-rise md:col-span-2">
      <h2 className="m-0 mb-1.5 font-display text-2xl font-bold tracking-[-0.02em]">{title}</h2>
      <p className="m-0 mb-5 max-w-[260px] text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}
