import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { MUST_SCORE, type Group, type Restaurant } from "../types";
import { fetchRestaurants } from "../lib/restaurants";
import { backfillLocations } from "../lib/places";
import { formatScore } from "../utils/helpers";
import { Eyebrow, PageTitle, Sheet } from "../components/ui";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

// Mapbox (~1.8 MB) loads only when the full map is opened.
const PassportMap = lazy(() => import("../components/PassportMap"));

const STAMP_TONES = [
  { border: "border-accent", text: "text-accent-ink" },
  { border: "border-mint", text: "text-mint-ink" },
  { border: "border-[#3b82f6]", text: "text-sky-ink" },
];
const STAMP_TILT = [-3, 2, -1, 3, -2];

// Lists whose missing locations were already requested this session.
const backfillRequested = new Set<string>();

function lastVisit(r: Restaurant) {
  const dates = r.reviews.map((rev) => rev.created_at);
  return r.visitedAt ?? (dates.length ? dates.sort()[dates.length - 1] : r.createdAt);
}

export function PassportTab({ uid, group, onOpen, active = true }: {
  uid: string;
  group: Group | undefined;
  onOpen: (r: Restaurant) => void;
  /** On screen now (hidden tabs don't refetch). */
  active?: boolean;
}) {
  const [showMap, setShowMap] = useState(false);
  const [showAllStamps, setShowAllStamps] = useState(false);

  const places = useQuery({
    queryKey: ["restaurants", "passport", uid, group?.id],
    queryFn: async () => (await fetchRestaurants({ uid, groupId: group!.id, all: true })).restaurants,
    enabled: !!group,
    subscribed: active,
  });

  // Places saved before city/country were stored count as 0 Cities/Countries.
  // Fill them in once, in the background, then refresh the counts.
  const queryClient = useQueryClient();
  const groupId = group?.id;
  const missingLocations = (places.data ?? []).some((r) => !r.countryCode);
  useEffect(() => {
    if (!groupId || !missingLocations || backfillRequested.has(groupId)) return;
    backfillRequested.add(groupId);
    backfillLocations()
      .then(({ updated }) => {
        if (updated > 0) {
          queryClient.invalidateQueries({ queryKey: ["groups"] });
          queryClient.invalidateQueries({ queryKey: ["restaurants"] });
        }
      })
      .catch((err) => console.warn("Location backfill failed:", err));
  }, [groupId, missingLocations, queryClient]);

  const stamps = useMemo(
    () => (places.data ?? []).filter((r) => r.visited).sort((a, b) => lastVisit(b).localeCompare(lastVisit(a))),
    [places.data],
  );

  // A cravelist place to aim for next; changes once a day, not on every render.
  const [today] = useState(() => Math.floor(Date.now() / 86_400_000));
  const nextStamp = useMemo(() => {
    const todo = (places.data ?? []).filter((r) => !r.visited);
    if (todo.length === 0) return null;
    return todo[today % todo.length];
  }, [places.data, today]);

  const stats = [
    { label: "Places", value: group?.tried_count ?? 0 },
    { label: "Cities", value: group?.city_count ?? 0 },
    { label: "Countries", value: group?.country_count ?? 0 },
  ];

  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden pb-[120px]">
      <div className="mx-auto w-full max-w-2xl flex flex-col gap-4 px-5 pt-safe">
        <div className="flex flex-col gap-1 pt-2">
          <Eyebrow>Your culinary journey</Eyebrow>
          <PageTitle>Passport</PageTitle>
        </div>

        {/* Map preview */}
        <div className="relative h-[200px] overflow-hidden rounded-3xl border border-border bg-surface">
          <MapPreview places={places.data ?? []} />
          <div className="absolute bottom-3.5 left-3.5 flex items-center gap-2 rounded-full border border-border bg-surface/90 py-1.5 pr-3 pl-2 text-xs backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-accent" /> Tried
            <span className="ml-1.5 h-2 w-2 rounded-full bg-mint" /> Cravelist
          </div>
          <button
            type="button"
            onClick={() => setShowMap(true)}
            className="absolute right-3.5 bottom-2.5 h-9 rounded-full bg-ink px-3.5 text-xs font-semibold text-white"
          >
            Open map
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-1 rounded-[18px] border border-border bg-surface px-2.5 py-3">
              <span className="font-display text-[28px] leading-none font-extrabold tabular">{s.value}</span>
              <span className="text-[11px] text-muted">{s.label}</span>
            </div>
          ))}
          <div className="flex flex-col gap-1 rounded-[18px] bg-accent px-2.5 py-3 text-white">
            <span className="font-display text-[28px] leading-none font-extrabold tabular">{group?.must_count ?? 0}</span>
            <span className="text-[11px]">MUSTs</span>
          </div>
        </div>

        {/* Stamps */}
        <div className="mt-1 flex items-baseline justify-between">
          <h2 className="m-0 text-lg font-semibold">Recent stamps</h2>
          {stamps.length > 3 && (
            <button type="button" onClick={() => setShowAllStamps(true)} className="h-11 text-[13px] font-medium text-accent-ink">
              See all {stamps.length}
            </button>
          )}
        </div>

        {places.isPending ? (
          <div className="flex gap-2.5">
            {[0, 1, 2].map((i) => <div key={i} className="h-[120px] w-[104px] animate-pulse rounded-[18px] bg-subtle" />)}
          </div>
        ) : stamps.length === 0 ? (
          <p className="m-0 rounded-[18px] border border-dashed border-border-strong p-5 text-center text-sm text-muted">
            No stamps yet. Rate a place after you visit and it lands here.
          </p>
        ) : (
          <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pt-4 pb-3">
            {stamps.slice(0, 12).map((r, i) => (
              <Stamp key={r.id} r={r} index={i} onOpen={onOpen} />
            ))}
            {nextStamp && (
              <button type="button" onClick={() => onOpen(nextStamp)}
                className="flex w-[136px] shrink-0 flex-col gap-1.5 rounded-[16px] border-2 border-dashed border-border-strong p-3 text-left text-muted">
                <span className="font-mono text-[9px] tracking-[0.12em]">NEXT STAMP?</span>
                <span className="line-clamp-2 text-[15px] leading-[1.1] font-semibold text-ink">{nextStamp.name}</span>
                <span className="mt-auto flex items-center gap-1 text-xs"><Plus size={13} /> Go try it</span>
              </button>
            )}
          </div>
        )}
      </div>

      {showMap && createPortal(
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-background" />}>
          <PassportMap places={places.data ?? []} onOpen={(r) => { setShowMap(false); onOpen(r); }} onClose={() => setShowMap(false)} />
        </Suspense>,
        document.body,
      )}

      {showAllStamps && (
        <Sheet title={`${stamps.length} stamps`} onClose={() => setShowAllStamps(false)}>
          <div className="grid grid-cols-2 gap-4 px-1 pt-3 pb-4">
            {stamps.map((r, i) => (
              <Stamp key={r.id} r={r} index={i} onOpen={(x) => { setShowAllStamps(false); onOpen(x); }} fluid />
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Stamp({ r, index, onOpen, fluid = false }: { r: Restaurant; index: number; onOpen: (r: Restaurant) => void; fluid?: boolean }) {
  const tone = STAMP_TONES[index % STAMP_TONES.length];
  const score = r.avgScore ?? r.userScore;
  const must = r.avgScore != null && r.avgScore >= MUST_SCORE;
  const d = new Date(lastVisit(r));
  const date = `${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()} '${String(d.getFullYear()).slice(2)}`;
  const where = (r.area ?? r.city ?? "").toUpperCase();
  return (
    <button
      type="button"
      onClick={() => onOpen(r)}
      className={`relative flex min-h-[132px] shrink-0 rounded-[16px] border-2 bg-surface p-[3px] text-left ${tone.border} ${tone.text} ${fluid ? "w-full" : "w-[136px]"}`}
      style={{ transform: `rotate(${STAMP_TILT[index % STAMP_TILT.length]}deg)` }}
      aria-label={`${r.name}, ${where ? `${where.toLowerCase()}, ` : ""}${date}${score != null ? `, scored ${formatScore(score)}` : ""}${must ? ", a must" : ""}`}
    >
      {/* min-w-0: a long neighbourhood must truncate, not widen the stamp past its border. */}
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-[12px] border border-dashed px-2.5 py-2.5"
        style={{ borderColor: "color-mix(in srgb, currentColor 55%, transparent)" }}>
        {/* Country code first (text, not a flag emoji, so it renders everywhere), and room on the right for the MUST seal. */}
        <span className={`flex min-w-0 items-center gap-1 font-mono text-[9px] tracking-[0.12em] ${must ? "pr-6" : ""}`}>
          {r.countryCode && (
            <span className="shrink-0 rounded-[3px] border border-current px-[3px] text-[8px] leading-[12px] font-semibold">{r.countryCode.toUpperCase()}</span>
          )}
          <span className="truncate">{where || "VISITED"}</span>
        </span>
        <span className="line-clamp-2 font-display text-[15px] leading-[1.1] font-extrabold text-ink">{r.name}</span>
        <span className="mt-auto flex items-end justify-between gap-1">
          <span className="min-w-0 font-mono text-[9px] leading-tight tracking-[0.06em]">{date}</span>
          {score != null && <span className="shrink-0 font-mono text-lg leading-none font-semibold text-ink tabular">{formatScore(score)}</span>}
        </span>
      </span>
      {must && (
        <span aria-hidden="true"
          className="absolute -top-3 -right-3 flex h-11 w-11 rotate-12 items-center justify-center rounded-full border-2 border-double border-accent bg-surface font-mono text-[9px] font-bold tracking-wide text-accent-ink shadow-sm">
          MUST
        </span>
      )}
    </button>
  );
}

/**
 * A real map of the list's main cluster (Mapbox Static Images), with a pin per
 * place. Falls back to a dot grid when there's no token or the image fails.
 */
function MapPreview({ places }: { places: Restaurant[] }) {
  const [failed, setFailed] = useState(false);
  // The image is requested at the box's real size, so pins keep their size on iPad.
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const measure = (el: HTMLDivElement | null) => {
    if (el && !box && el.clientWidth) setBox({ w: el.clientWidth, h: el.clientHeight });
  };
  const view = useMemo(() => frame(places), [places]);
  if (!view) return <DotGrid />;
  if (MAPBOX_TOKEN && !failed && !box) return <div ref={measure} className="absolute inset-0" />;

  if (MAPBOX_TOKEN && !failed) {
    const inBox = (p: Restaurant) =>
      p.longitude >= view.minLng && p.longitude <= view.maxLng && p.latitude >= view.minLat && p.latitude <= view.maxLat;
    const pin = (p: Restaurant) => `pin-s+${p.visited ? "ff453a" : "10b981"}(${p.longitude.toFixed(4)},${p.latitude.toFixed(4)})`;
    // Cravelist first so tried pins are drawn on top. Cap keeps the URL short.
    const pts = view.pts.filter(inBox).sort((a, b) => Number(a.visited) - Number(b.visited)).slice(-90);
    const bbox = [view.minLng, view.minLat, view.maxLng, view.maxLat].map((n) => n.toFixed(4)).join(",");
    const src = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${pts.map(pin).join(",")}/[${bbox}]/${Math.min(1280, Math.round(box!.w))}x${Math.min(1280, Math.round(box!.h))}@2x`
      + `?padding=28,24,48,24&logo=false&attribution=false&access_token=${MAPBOX_TOKEN}`;
    return (
      <img src={src} alt={`Map of ${places.length} places`} onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover" decoding="async" />
    );
  }
  return <DotGrid view={view} />;
}

/** Frame the main cluster: ignore the outer 10% on each axis so one far-away
 *  place doesn't zoom the preview out to a continent (the full map shows everything). */
function frame(places: Restaurant[]) {
  const pts = places.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && (p.latitude || p.longitude));
  if (pts.length === 0) return null;
  const q = (xs: number[], f: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(f * (s.length - 1))))]; };
  const lats = pts.map((p) => p.latitude), lngs = pts.map((p) => p.longitude);
  const trim = pts.length >= 8 ? 0.1 : 0;
  let minLat = q(lats, trim), maxLat = q(lats, 1 - trim);
  let minLng = q(lngs, trim), maxLng = q(lngs, 1 - trim);
  // Keep a minimum span so a single neighbourhood doesn't collapse to one point.
  const span = 0.03;
  if (maxLat - minLat < span) { const c = (maxLat + minLat) / 2; minLat = c - span / 2; maxLat = c + span / 2; }
  if (maxLng - minLng < span) { const c = (maxLng + minLng) / 2; minLng = c - span / 2; maxLng = c + span / 2; }
  const dLat = (maxLat - minLat) * 0.15, dLng = (maxLng - minLng) * 0.15;
  return { pts, minLat: minLat - dLat, maxLat: maxLat + dLat, minLng: minLng - dLng, maxLng: maxLng + dLng };
}

function DotGrid({ view }: { view?: ReturnType<typeof frame> }) {
  const W = 350, H = 200, PAD = 24;
  const dots = (view?.pts ?? [])
    .filter((p) => p.latitude >= view!.minLat && p.latitude <= view!.maxLat && p.longitude >= view!.minLng && p.longitude <= view!.maxLng)
    .map((p) => ({
      id: p.id,
      tried: p.visited,
      x: PAD + ((p.longitude - view!.minLng) / (view!.maxLng - view!.minLng)) * (W - PAD * 2),
      y: PAD + (1 - (p.latitude - view!.minLat) / (view!.maxLat - view!.minLat)) * (H - PAD * 2 - 24),
    }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <pattern id="dots" width="20" height="30" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="15" r="1.6" fill="#E2E8F0" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#dots)" />
      {dots.filter((p) => !p.tried).map((p) => <circle key={p.id} cx={p.x} cy={p.y} r="4" fill="#10B981" />)}
      {dots.filter((p) => p.tried).map((p) => <circle key={p.id} cx={p.x} cy={p.y} r="5" fill="#FF453A" />)}
    </svg>
  );
}
