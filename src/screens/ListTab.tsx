import { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { RestaurantCard } from "../components/RestaurantCard";
import { Restaurant, SortOption, Group } from "../types";
import { VIBE_OPTIONS, SORT_LABELS } from "../constants/theme";

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
  setSortBy,
  activeGroup,
  groups,
  setActiveGroupId,
  showWorkspaceDropdown,
  setShowWorkspaceDropdown
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
  activeGroup?: Group;
  groups: Group[];
  setActiveGroupId: (id: string) => void;
  showWorkspaceDropdown: boolean;
  setShowWorkspaceDropdown: (show: boolean) => void;
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
    { id: "Restaurants", label: "Restaurants", icon: "solar:chef-hat-linear" },
    { id: "Breakfast & Brunch", label: "Breakfast", icon: "solar:sun-2-linear" },
    { id: "Coffee & Tea", label: "Coffee", icon: "solar:cup-hot-linear" },
    { id: "Bars", label: "Bars", icon: "solar:wineglass-linear" },
    { id: "Bakeries", label: "Bakeries", icon: "fluent-emoji:croissant" },
    { id: "Ice Cream & Dessert", label: "Sweets", icon: "fluent-emoji:ice-cream" },
  ];

  const filtered = restaurants;

  const toggleVibe = (v: string) => setFilterVibes(filterVibes.includes(v) ? filterVibes.filter((x) => x !== v) : [...filterVibes, v]);

  const getGroupColor = (str: string) => {
    const colors = ["#ff453a", "#ff9f0a", "#32ade6", "#0a84ff", "#af52de", "#ff375f", "#34c759"];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getGroupInitials = (name: string) => {
    const parts = name.split(" ").filter(p => p.length > 0);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return "✨";
  };

  return (
    <div className="flex-1 flex flex-col font-sans overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md px-4 pt-safe-or-4 pb-4 flex items-center justify-between gap-3 border-b border-border/50">
        <div className="relative">
          <button 
            type="button"
            onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
            className="flex items-center gap-2 bg-secondary/50 hover:bg-secondary rounded-full py-1.5 pl-1.5 pr-3 transition-colors shrink-0"
          >
            {activeGroup?.avatar_url ? (
              <img
                src={activeGroup.avatar_url}
                alt={activeGroup.name}
                className="w-8 h-8 rounded-full object-cover shadow-sm"
              />
            ) : (
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
                style={{ background: getGroupColor(activeGroup?.name || "Workspace"), color: "#fff" }}
              >
                <span className="text-[11px] font-black tracking-wider">
                  {getGroupInitials(activeGroup?.name || "W")}
                </span>
              </div>
            )}
            <span className="font-semibold text-sm max-w-[140px] truncate">{activeGroup?.name || "Workspace"}</span>
            <Icon icon="solar:alt-arrow-down-linear" className="text-muted-foreground" />
          </button>
          
          {showWorkspaceDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowWorkspaceDropdown(false)} />
              <div className="absolute top-[calc(100%+12px)] left-0 w-[240px] bg-card rounded-[2rem] shadow-2xl shadow-foreground/10 border border-border/50 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase px-4 py-2 mb-1">Switch Cravelist</p>
                <div className="space-y-1">
                  {groups?.map(g => {
                    const isActive = activeGroup?.id === g.id;
                    return (
                      <button
                        key={g.id}
                        onClick={() => { setActiveGroupId(g.id); setShowWorkspaceDropdown(false); }}
                        className={`w-full text-left px-3 py-3 rounded-2xl transition-all flex items-center gap-3 ${isActive ? "bg-primary/10" : "hover:bg-secondary"}`}
                      >
                        {g.avatar_url ? (
                          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 shadow-sm border border-border">
                            <img src={g.avatar_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                            style={{ background: getGroupColor(g.name), color: "#fff" }}
                          >
                            <span className="text-[13px] font-black tracking-wider">{getGroupInitials(g.name)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <span className={`truncate block text-[15px] font-bold ${isActive ? "text-primary" : "text-foreground"}`}>{g.name}</span>
                        </div>
                        {isActive && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 ml-1 bg-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="relative flex-1" onClick={onOpenSearch}>
          <Icon
            icon="solar:magnifer-linear"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground size-5"
          />
          <input
            type="text"
            placeholder="Find or Add..."
            readOnly
            className="w-full bg-secondary border border-transparent rounded-full pl-11 pr-4 py-3 text-[15px] font-medium text-foreground placeholder:text-muted-foreground outline-none cursor-pointer hover:bg-secondary/80 transition-colors"
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 mb-5 pt-4">
          <div className="flex p-1 bg-secondary/70 rounded-full">
            {(["cravelist", "tried"] as const).map((tab) => {
              const isActive = filterTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterTab(tab)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-full transition-all capitalize ${
                    isActive
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "cravelist" ? "Cravelist" : tab}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
            {PRIMARY_CATEGORIES.map((cat) => {
              const isActive = filterCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFilterCategory(isActive ? null : cat.id)}
                  className={`snap-start shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium shadow-sm transition-all ${
                    isActive
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary hover:text-primary"
                  }`}
                >
                  <Icon icon={cat.icon} width={16} height={16} />
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {VIBE_OPTIONS.map((vibe) => {
                const isActive = filterVibes.includes(vibe.label);
                return (
                  <button
                    key={vibe.label}
                    type="button"
                    onClick={() => toggleVibe(vibe.label)}
                    className={`whitespace-nowrap px-4 py-1.5 rounded-full border text-xs font-semibold shadow-sm transition-all ${
                      isActive
                        ? "border-accent-foreground/20 bg-accent text-accent-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {vibe.label}
                  </button>
                );
              })}
            </div>
            
            <div className="relative flex-shrink-0 ml-2">
              <button
                type="button"
                onClick={() => setShowSortMenu(!showSortMenu)}
                className={`w-8 h-8 flex items-center justify-center rounded-full border shadow-sm transition-all ${
                  sortBy !== "newest"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon icon="solar:tuning-linear" width={16} height={16} />
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-2 bg-card rounded-2xl shadow-xl border border-border z-20 min-w-[140px] overflow-hidden flex flex-col">
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { setSortBy(opt); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors ${
                        sortBy === opt ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {SORT_LABELS[opt]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 flex flex-col gap-4 pb-8">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-secondary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon icon="solar:magnifer-linear" className="text-muted-foreground size-8" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">
                {restaurants.length === 0 ? "Start your list" : "No matches"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-[240px]">
                {restaurants.length === 0 ? "Search for restaurants you want to try" : "Adjust your filters"}
              </p>
              {restaurants.length === 0 && (
                <button
                  type="button"
                  onClick={onOpenSearch}
                  className="mt-5 px-6 py-3 rounded-2xl text-sm font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                >
                  Find a restaurant
                </button>
              )}
            </div>
          ) : (
            <>
              {filtered.map((r) => (
                <RestaurantCard key={r.id} restaurant={r} onDetail={onDetail} />
              ))}
              <div ref={observerTarget} className="h-4 w-full flex items-center justify-center pt-2">
                {isFetchingNextPage && <Icon icon="solar:spinner-broken-linear" className="animate-spin text-muted-foreground size-5" />}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
