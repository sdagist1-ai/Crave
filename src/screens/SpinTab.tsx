import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Dices, Shuffle } from "lucide-react";
import type { Restaurant } from "../types";
import { fetchRestaurants } from "../lib/restaurants";
import { CATEGORIES, VIBE_OPTIONS } from "../constants/theme";
import { placeSubtitle } from "../utils/helpers";
import { Eyebrow, FilterChip, PageTitle, Segmented } from "../components/ui";

type Mode = "new" | "nostalgia";

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Unbiased random index in [0, n). */
function randomIndex(n: number) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return Math.floor((buf[0] / 0x1_0000_0000) * n);
}

export function SpinTab({ uid, groupId, onOpen }: { uid: string; groupId: string | undefined; onOpen: (r: Restaurant) => void }) {
  const [mode, setMode] = useState<Mode>("new");
  const [category, setCategory] = useState<string | null>(null);
  const [vibes, setVibes] = useState<string[]>([]);
  // The pick belongs to the pool it was drawn from; changing the pool clears it.
  const poolKey = [groupId, mode, category, vibes.join(",")].join("|");
  const [picked, setPicked] = useState<{ key: string; r: Restaurant } | null>(null);
  const pick = picked?.key === poolKey ? picked.r : null;
  const setPick = (r: Restaurant | null) => setPicked(r ? { key: poolKey, r } : null);
  const [flash, setFlash] = useState<Restaurant | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timers = useRef<number[]>([]);

  const pool = useQuery({
    queryKey: ["restaurants", "spin", uid, groupId, mode, category, vibes],
    queryFn: async () => (await fetchRestaurants({
      uid, groupId: groupId!, filterTab: mode === "new" ? "cravelist" : "tried",
      filterCategory: category, filterVibes: vibes, all: true,
    })).restaurants,
    enabled: !!groupId,
  });
  const places = pool.data ?? [];

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const spin = () => {
    if (spinning || places.length === 0) return;
    const eligible = pick && places.length > 1 ? places.filter((p) => p.id !== pick.id) : places;
    const winner = eligible[randomIndex(eligible.length)];

    const finish = () => {
      setFlash(null);
      setPick(winner);
      setSpinning(false);
      Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      if (!prefersReducedMotion()) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.4 }, colors: ["#ff453a", "#ffe0de", "#10b981", "#0f172a"], disableForReducedMotion: true });
      }
    };

    if (prefersReducedMotion() || places.length === 1) return finish();

    // Flick through the pool, slowing down, then land on the winner.
    setSpinning(true);
    setPick(null);
    timers.current = [];
    let elapsed = 0;
    for (let step = 0; step < 16; step++) {
      elapsed += 45 + step * step * 1.1; // ~2 s, easing out
      timers.current.push(window.setTimeout(() => {
        setFlash(places[randomIndex(places.length)]);
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      }, elapsed));
    }
    timers.current.push(window.setTimeout(finish, elapsed + 240));
  };

  const shown = flash ?? pick;
  const toggleVibe = (v: string) => setVibes(vibes.includes(v) ? vibes.filter((x) => x !== v) : [...vibes, v]);

  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden pb-[120px]">
      <div className="flex flex-col gap-1 px-5 pt-safe">
        <Eyebrow className="pt-2">
          {pool.isPending ? "Loading the pool…"
            : mode === "new" ? `${places.length} ${places.length === 1 ? "spot" : "spots"} on the cravelist`
            : `${places.length} ${places.length === 1 ? "favorite" : "favorites"} in the pool`}
        </Eyebrow>
        <PageTitle>The Spin</PageTitle>
      </div>

      {/* Orbit + result */}
      <div className="relative mt-2 flex h-[318px] items-center justify-center">
        <div aria-hidden="true" className="absolute h-[300px] w-[300px] rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(255,69,58,0.22), rgba(255,69,58,0))" }} />
        <div aria-hidden="true"
          className="absolute h-[296px] w-[296px] rounded-full border border-dashed border-border-strong animate-orbit"
          style={spinning ? { animationDuration: "1.2s" } : undefined}>
          <div className="absolute -top-1.5 left-[142px] h-3 w-3 rounded-full bg-accent shadow-[0_0_16px_#ff453a]" />
        </div>
        <div aria-hidden="true"
          className="absolute h-[230px] w-[230px] rounded-full border border-border animate-orbit-rev"
          style={spinning ? { animationDuration: "0.9s" } : undefined}>
          <div className="absolute bottom-2.5 left-[30px] h-2 w-2 rounded-full bg-mint" />
        </div>

        <button
          type="button"
          onClick={() => pick && onOpen(pick)}
          disabled={!pick}
          aria-live="polite"
          className="relative flex h-[184px] w-[184px] flex-col items-center justify-center gap-1.5 rounded-full border border-border bg-surface p-5 text-center shadow-[0_30px_60px_rgba(15,23,42,0.10)]"
        >
          {shown ? (
            <span key={shown.id} className={`flex flex-col items-center gap-1.5 ${spinning ? "" : "animate-pop"}`}>
              {!spinning && <span className="font-mono text-[10px] tracking-[0.14em] text-accent-ink">TONIGHT</span>}
              <span className="line-clamp-3 font-display text-2xl leading-[1.05] font-extrabold">{shown.name}</span>
              {!spinning && (
                <span className="text-xs text-muted">
                  {mode === "nostalgia" && shown.avgScore != null
                    ? `Crew avg ${shown.avgScore.toFixed(1)} · ${shown.ratedCount} rated`
                    : placeSubtitle(shown) || "Tap for details"}
                </span>
              )}
            </span>
          ) : (
            <>
              <Dices size={28} className="text-border-strong" aria-hidden="true" />
              <span className="text-[13px] text-muted">
                {!pool.isPending && places.length === 0
                  ? mode === "new" ? "Nothing on the cravelist matches" : "No tried spots match yet"
                  : "Let fate pick dinner"}
              </span>
            </>
          )}
        </button>
      </div>

      <div className="flex flex-col gap-3 px-5">
        <Segmented<Mode>
          size="lg"
          value={mode}
          onChange={setMode}
          options={[{ id: "new", label: "New spots" }, { id: "nostalgia", label: "Nostalgia" }]}
        />

        <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
          <FilterChip active={!category} onClick={() => setCategory(null)}>All</FilterChip>
          {CATEGORIES.map((c) => (
            <FilterChip key={c.id} active={category === c.id} onClick={() => setCategory(category === c.id ? null : c.id)}>
              {c.label}
            </FilterChip>
          ))}
          <span className="my-2 w-px shrink-0 bg-border" aria-hidden="true" />
          {VIBE_OPTIONS.map((v) => (
            <FilterChip key={v} active={vibes.includes(v)} onClick={() => toggleVibe(v)}>{v}</FilterChip>
          ))}
        </div>

        <button
          type="button"
          onClick={spin}
          disabled={spinning || places.length === 0}
          className="mt-1 flex h-[60px] items-center justify-center gap-2.5 rounded-[20px] bg-accent text-[17px] font-bold tracking-[0.02em] text-white shadow-accent transition-transform active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          <Shuffle size={20} strokeWidth={2.4} />
          {spinning ? "Spinning…" : pick ? "Spin again" : "Spin now"}
        </button>
        {pick && !spinning && (
          <button type="button" onClick={() => onOpen(pick)} className="h-11 text-sm font-semibold text-accent-ink">
            See {pick.name}
          </button>
        )}
      </div>
    </div>
  );
}
