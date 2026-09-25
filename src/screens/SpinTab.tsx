import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Dices, Shuffle } from "lucide-react";
import type { Restaurant } from "../types";
import { fetchRestaurants, filterLocally, wholeListQuery } from "../lib/restaurants";
import { facetsQuery } from "../lib/cuisines";
import { FilterRow } from "../components/CuisineFilters";
import { placeSubtitle } from "../utils/helpers";
import { Eyebrow, PageTitle, Segmented } from "../components/ui";

type Mode = "new" | "nostalgia";

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const VERDICTS = ["Tonight", "Fate has spoken", "Dinner is decided", "No take-backs", "The dice say", "It's written"];

function spinNudge(spins: number) {
  if (spins >= 8) return "Just pick one 😅";
  if (spins >= 5) return `Spin #${spins}, picky tonight?`;
  if (spins >= 3) return `Spin #${spins}`;
  return null;
}

/** Unbiased random index in [0, n). */
function randomIndex(n: number) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return Math.floor((buf[0] / 0x1_0000_0000) * n);
}

export function SpinTab({ uid, groupId, onOpen, active = true }: {
  uid: string; groupId: string | undefined; onOpen: (r: Restaurant) => void;
  /** On screen now (hidden tabs don't refetch). */
  active?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("new");
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [occasion, setOccasion] = useState<string | null>(null);
  // The pick belongs to the pool it was drawn from; changing the pool clears it.
  const poolKey = [groupId, mode, cuisines.join(","), occasion].join("|");
  const [picked, setPicked] = useState<{ key: string; r: Restaurant } | null>(null);
  const pick = picked?.key === poolKey ? picked.r : null;
  const setPick = (r: Restaurant | null) => setPicked(r ? { key: poolKey, r } : null);
  const [flash, setFlash] = useState<Restaurant | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [verdict, setVerdict] = useState(VERDICTS[0]);
  // Re-spins in a row, for a little ribbing when nobody can decide.
  const [spins, setSpins] = useState(0);
  const timers = useRef<number[]>([]);

  const whole = useQuery({ ...wholeListQuery(uid, groupId), subscribed: active }).data;
  const pool = useQuery({
    queryKey: ["restaurants", "spin", uid, groupId, mode, cuisines, occasion],
    queryFn: async () => (await fetchRestaurants({
      uid, groupId: groupId!, filterTab: mode === "new" ? "cravelist" : "tried",
      filterCuisines: cuisines, filterOccasion: occasion, all: true,
    })).restaurants,
    enabled: !!groupId,
    subscribed: active,
    // Instant from the whole list when it's on the phone; the server's pool replaces it.
    placeholderData: () => whole ? filterLocally(whole, { tab: mode === "new" ? "cravelist" : "tried", cuisines, occasion }) : undefined,
  });
  const places = pool.data ?? [];
  const facets = useQuery({ ...facetsQuery(groupId), subscribed: active }).data;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const spin = () => {
    if (spinning || places.length === 0) return;
    const eligible = pick && places.length > 1 ? places.filter((p) => p.id !== pick.id) : places;
    const winner = eligible[randomIndex(eligible.length)];

    const finish = () => {
      setFlash(null);
      setPick(winner);
      setSpinning(false);
      setVerdict(VERDICTS[randomIndex(VERDICTS.length)]);
      Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      if (!prefersReducedMotion()) {
        // Two bursts from either side of the dial, plus a pop from the centre.
        const colors = ["#ff453a", "#ffb4ae", "#10b981", "#0f172a", "#fbbf24"];
        confetti({ particleCount: 60, angle: 60, spread: 55, startVelocity: 45, origin: { x: 0, y: 0.45 }, colors, disableForReducedMotion: true });
        confetti({ particleCount: 60, angle: 120, spread: 55, startVelocity: 45, origin: { x: 1, y: 0.45 }, colors, disableForReducedMotion: true });
        confetti({ particleCount: 40, spread: 360, startVelocity: 22, gravity: 0.7, scalar: 0.8, origin: { y: 0.33 }, colors, disableForReducedMotion: true });
      }
    };

    if (prefersReducedMotion() || places.length === 1) return finish();

    // Flick through the pool fast, ease out, then land on the winner (~1.1 s).
    setSpinning(true);
    setPick(null);
    setSpins((n) => n + 1);
    timers.current = [];
    let elapsed = 0;
    let last = -1;
    for (let step = 0; step < 18; step++) {
      elapsed += 28 + step * step * 0.45;
      timers.current.push(window.setTimeout(() => {
        // Never show the same name twice in a row, so it visibly ticks.
        let i = randomIndex(places.length);
        if (i === last && places.length > 1) i = (i + 1) % places.length;
        last = i;
        setFlash(places[i]);
        Haptics.impact({ style: step < 12 ? ImpactStyle.Light : ImpactStyle.Medium }).catch(() => {});
      }, elapsed));
    }
    timers.current.push(window.setTimeout(finish, elapsed + 160));
  };

  const shown = flash ?? pick;

  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden pb-[120px]">
      <div className="mx-auto w-full max-w-2xl flex flex-col gap-1 px-5 pt-safe">
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
          style={spinning ? { animationDuration: "0.5s" } : undefined}>
          <div className="absolute -top-1.5 left-[142px] h-3 w-3 rounded-full bg-accent shadow-[0_0_16px_#ff453a]" />
        </div>
        <div aria-hidden="true"
          className="absolute h-[230px] w-[230px] rounded-full border border-border animate-orbit-rev"
          style={spinning ? { animationDuration: "0.35s" } : undefined}>
          <div className="absolute bottom-2.5 left-[30px] h-2 w-2 rounded-full bg-mint" />
        </div>

        <button
          type="button"
          onClick={() => pick && onOpen(pick)}
          disabled={!pick}
          aria-live="polite"
          className={`relative flex h-[184px] w-[184px] flex-col items-center justify-center gap-1.5 rounded-full border bg-surface p-5 text-center transition-[box-shadow,border-color] duration-300 ${spinning ? "animate-wiggle border-accent shadow-[0_0_0_6px_rgba(255,69,58,0.12),0_30px_60px_rgba(255,69,58,0.25)]" : "border-border shadow-[0_30px_60px_rgba(15,23,42,0.10)]"}`}
        >
          {shown ? (
            <span key={shown.id} className={`flex flex-col items-center gap-1.5 ${spinning ? "animate-tick" : "animate-land"}`}>
              {!spinning && <span className="font-mono text-[10px] tracking-[0.14em] text-accent-ink uppercase">{verdict}</span>}
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

      <div className="mx-auto w-full max-w-2xl flex flex-col gap-3 px-5">
        <Segmented<Mode>
          size="lg"
          value={mode}
          onChange={setMode}
          options={[{ id: "new", label: "New spots" }, { id: "nostalgia", label: "Nostalgia" }]}
        />

        <FilterRow facets={facets} tab={mode === "new" ? "cravelist" : "tried"} cuisines={cuisines} occasion={occasion}
          onCuisines={setCuisines} onOccasion={setOccasion} />

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
        {!spinning && spinNudge(spins) && (
          <p className="m-0 text-center font-mono text-xs text-muted animate-fade-in">{spinNudge(spins)}</p>
        )}
      </div>
    </div>
  );
}
