import { useState, useEffect, useRef } from "react";
import { SlidersHorizontal, Search, Utensils, Wine, Coffee, Croissant, IceCream, Sun, Loader2 } from "lucide-react";
import { RestaurantCard } from "../components/RestaurantCard";
import { Restaurant, SortOption } from "../types";
import { C, VIBE_OPTIONS, SORT_LABELS } from "../constants/theme";

export function ListTab({ 
  restaurants, 
  onOpenSearch, 
  onDetail,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  filterTab,
  setFilterTab,
  filterCategory,
  setFilterCategory,
  filterVibes,
  setFilterVibes,
  sortBy,
  setSortBy
}: {
  restaurants: Restaurant[]; 
  onOpenSearch: () => void; 
  onDetail: (r: Restaurant) => void;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  filterTab: "cravelist" | "tried";
  setFilterTab: (t: "cravelist" | "tried") => void;
  filterCategory: string | null;
  setFilterCategory: (c: string | null) => void;
  filterVibes: string[];
  setFilterVibes: (v: string[]) => void;
  sortBy: SortOption;
  setSortBy: (s: SortOption) => void;
}) {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [observerTarget, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const PRIMARY_CATEGORIES = [
    { id: "Restaurants", label: "Restaurants", icon: Utensils },
    { id: "Breakfast & Brunch", label: "Breakfast", icon: Sun },
    { id: "Coffee & Tea", label: "Coffee", icon: Coffee },
    { id: "Bars", label: "Bars", icon: Wine },
    { id: "Bakeries", label: "Bakeries", icon: Croissant },
    { id: "Ice Cream & Dessert", label: "Sweets", icon: IceCream },
  ];

  const filtered = restaurants; // Server-side filtering applied

  const toggleVibe = (v: string) => setFilterVibes(filterVibes.includes(v) ? filterVibes.filter((x) => x !== v) : [...filterVibes, v]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex-shrink-0 border-b border-slate-100 bg-white">
        {/* Cravelist / Tried Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 mb-4">
          {(["cravelist", "tried"] as const).map((tab) => {
            const isActive = filterTab === tab;
            return (
              <button key={tab} type="button" onClick={() => setFilterTab(tab)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all capitalize ${isActive ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {tab === "cravelist" ? "Cravelist" : tab}
              </button>
            );
          })}
        </div>

        {/* Primary Categories (Restaurants, Bars, etc) */}
        <div className="flex gap-2.5 mb-5 overflow-x-auto scrollbar-none pb-2.5 px-1 -mx-1">
          {PRIMARY_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const isActive = filterCategory === cat.id;
            return (
              <button key={cat.id} type="button" onClick={() => setFilterCategory(isActive ? null : cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[13px] font-extrabold transition-all border flex-shrink-0 ${isActive
                    ? "bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-200/50"
                    : "bg-white text-slate-500 border-slate-200 shadow-sm hover:border-slate-300 hover:text-slate-700"
                  }`}
              >
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} /> {cat.label}
              </button>
            )
          })}
        </div>

        {/* Sub-Filters: Custom Vibes & Sort */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {VIBE_OPTIONS.map((vibe) => {
              const isActive = filterVibes.includes(vibe.label);
              return (
                <button key={vibe.label} type="button" onClick={() => toggleVibe(vibe.label)}
                  className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border-2 whitespace-nowrap"
                  style={isActive
                    ? { background: vibe.color, color: "#fff", borderColor: vibe.color }
                    : { background: "transparent", color: vibe.color, borderColor: C.slate200 }}>
                  {vibe.label}
                </button>
              );
            })}
          </div>
          <div className="relative flex-shrink-0 pb-1">
            <button type="button" onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all"
              style={sortBy !== "newest"
                ? { background: C.rose, color: "#fff", borderColor: C.rose }
                : { background: "transparent", color: C.slate500, borderColor: C.slate200 }}>
              <SlidersHorizontal size={14} />
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 z-20 min-w-[140px] overflow-hidden flex flex-col">
                {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                  <button key={opt} type="button"
                    onClick={() => { setSortBy(opt); setShowSortMenu(false); }}
                    className="w-full text-left px-4 py-3 text-xs font-bold transition-colors"
                    style={{ color: sortBy === opt ? C.rose : C.slate600, background: sortBy === opt ? C.roseLight : "transparent" }}>
                    {SORT_LABELS[opt]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><Search size={28} className="text-slate-300" /></div>
            <h3 className="text-base font-bold text-slate-800 mb-1">{restaurants.length === 0 ? "Start your list" : "No matches"}</h3>
            <p className="text-sm text-slate-400 max-w-[240px]">{restaurants.length === 0 ? "Search for restaurants you want to try" : "Adjust your filters"}</p>
            {restaurants.length === 0 && (
              <button type="button" onClick={onOpenSearch}
                className="mt-5 px-6 py-3 rounded-2xl text-sm font-bold text-white shadow-lg shadow-rose-200"
                style={{ background: C.rose }}>Find a restaurant</button>
            )}
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            {filtered.map((r) => <RestaurantCard key={r.id} restaurant={r} onDetail={onDetail} />)}
            
            {/* Infinite Scroll Trigger */}
            <div ref={observerTarget} className="h-4 w-full flex items-center justify-center pt-2 pb-4">
              {isFetchingNextPage && <Loader2 size={20} className="animate-spin text-slate-400" />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
