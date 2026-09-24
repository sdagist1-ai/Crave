import { lazy, Suspense, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import type { Group, Restaurant } from "../types";
import { fetchRestaurants } from "../lib/restaurants";
import { Eyebrow, PageTitle, Sheet } from "../components/ui";

// Mapbox (~1.8 MB) loads only when the full map is opened.
const PassportMap = lazy(() => import("../components/PassportMap"));

const STAMP_TONES = [
  { border: "border-accent", text: "text-accent-ink" },
  { border: "border-mint", text: "text-mint-ink" },
  { border: "border-[#3b82f6]", text: "text-sky-ink" },
];
const STAMP_TILT = [-3, 2, -1, 3, -2];

function lastVisit(r: Restaurant) {
  const dates = r.reviews.map((rev) => rev.created_at);
  return r.visitedAt ?? (dates.length ? dates.sort()[dates.length - 1] : r.createdAt);
}

export function PassportTab({ uid, group, onOpen }: {
  uid: string;
  group: Group | undefined;
  onOpen: (r: Restaurant) => void;
}) {
  const [showMap, setShowMap] = useState(false);
  const [showAllStamps, setShowAllStamps] = useState(false);

  const places = useQuery({
    queryKey: ["restaurants", "passport", uid, group?.id],
    queryFn: async () => (await fetchRestaurants({ uid, groupId: group!.id, all: true })).restaurants,
    enabled: !!group,
  });

  const stamps = useMemo(
    () => (places.data ?? []).filter((r) => r.visited).sort((a, b) => lastVisit(b).localeCompare(lastVisit(a))),
    [places.data],
  );

  const stats = [
    { label: "Places", value: group?.tried_count ?? 0 },
    { label: "Cities", value: group?.city_count ?? 0 },
    { label: "Countries", value: group?.country_count ?? 0 },
  ];

  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden pb-[120px]">
      <div className="flex flex-col gap-4 px-5 pt-safe">
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
          <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 py-2">
            {stamps.slice(0, 12).map((r, i) => (
              <Stamp key={r.id} r={r} index={i} onOpen={onOpen} />
            ))}
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
          <div className="grid grid-cols-3 gap-2.5 pb-4">
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
  const score = r.userScore ?? r.avgScore;
  const month = new Date(lastVisit(r)).toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
  return (
    <button
      type="button"
      onClick={() => onOpen(r)}
      className={`flex shrink-0 flex-col gap-2 rounded-[18px] border-[1.5px] border-dashed bg-surface p-3 text-left ${tone.border} ${fluid ? "w-full" : "w-[104px]"}`}
      style={{ transform: `rotate(${STAMP_TILT[index % STAMP_TILT.length]}deg)` }}
    >
      <span className={`font-mono text-[10px] ${tone.text}`}>{month}</span>
      <span className="line-clamp-2 text-sm leading-[1.15] font-semibold">{r.name}</span>
      {score != null && <span className="font-mono text-lg font-semibold tabular">{Number.isInteger(score) ? score : score.toFixed(1)}</span>}
    </button>
  );
}

/** A dot-grid "map" with the list's places projected onto it — no map tiles needed. */
function MapPreview({ places }: { places: Restaurant[] }) {
  const W = 350, H = 200, PAD = 24;
  const projected = useMemo(() => {
    const pts = places.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && (p.latitude || p.longitude));
    if (pts.length === 0) return [];
    // Frame the main cluster: ignore the outer 10% on each axis so one far-away
    // place doesn't squash the rest into a corner (the full map shows everything).
    const q = (xs: number[], f: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(f * (s.length - 1))))]; };
    const lats = pts.map((p) => p.latitude), lngs = pts.map((p) => p.longitude);
    const trim = pts.length >= 8 ? 0.1 : 0;
    let minLat = q(lats, trim), maxLat = q(lats, 1 - trim);
    let minLng = q(lngs, trim), maxLng = q(lngs, 1 - trim);
    // Keep a minimum span so a single neighbourhood doesn't collapse to one point.
    const span = 0.03;
    if (maxLat - minLat < span) { const c = (maxLat + minLat) / 2; minLat = c - span / 2; maxLat = c + span / 2; }
    if (maxLng - minLng < span) { const c = (maxLng + minLng) / 2; minLng = c - span / 2; maxLng = c + span / 2; }
    const pad = 0.15;
    const dLat = (maxLat - minLat) * pad, dLng = (maxLng - minLng) * pad;
    minLat -= dLat; maxLat += dLat; minLng -= dLng; maxLng += dLng;
    return pts.filter((p) => p.latitude >= minLat && p.latitude <= maxLat && p.longitude >= minLng && p.longitude <= maxLng).map((p) => ({
      id: p.id,
      tried: p.visited,
      x: PAD + ((p.longitude - minLng) / (maxLng - minLng)) * (W - PAD * 2),
      y: PAD + (1 - (p.latitude - minLat) / (maxLat - minLat)) * (H - PAD * 2 - 24),
      at: lastVisit(p),
    }));
  }, [places]);

  const route = projected.filter((p) => p.tried).sort((a, b) => a.at.localeCompare(b.at)).slice(-6);
  const path = route.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" role="img"
      aria-label={`Map preview of ${places.length} places`}>
      <defs>
        <pattern id="dots" width="20" height="30" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="15" r="1.6" fill="#E2E8F0" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#dots)" />
      {route.length > 1 && <path d={path} fill="none" stroke="#FF453A" strokeWidth="1.5" strokeDasharray="3 5" opacity="0.7" />}
      {projected.filter((p) => !p.tried).map((p) => <circle key={p.id} cx={p.x} cy={p.y} r="4" fill="#10B981" />)}
      {projected.filter((p) => p.tried).map((p) => (
        <g key={p.id}>
          <circle cx={p.x} cy={p.y} r="12" fill="#FF453A" opacity="0.14" />
          <circle cx={p.x} cy={p.y} r="5" fill="#FF453A" />
        </g>
      ))}
    </svg>
  );
}
