import { useMemo, useRef, useState } from "react";
import Map, { GeolocateControl, Marker, Popup, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { Maximize2, UtensilsCrossed, X } from "lucide-react";
import type { Restaurant } from "../types";
import { Segmented } from "./ui";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

type Mode = "tried" | "cravelist";

export default function PassportMap({ places, onOpen, onClose }: {
  places: Restaurant[];
  onOpen: (r: Restaurant) => void;
  onClose: () => void;
}) {
  const mapRef = useRef<MapRef>(null);
  const [mode, setMode] = useState<Mode>("tried");
  const [selected, setSelected] = useState<Restaurant | null>(null);

  const shown = useMemo(
    () => places.filter((p) => (mode === "tried" ? p.visited : !p.visited) && (p.latitude || p.longitude)),
    [places, mode],
  );

  const fitAll = (list = shown) => {
    setSelected(null);
    const map = mapRef.current;
    if (!map || list.length === 0) return;
    if (list.length === 1) {
      map.flyTo({ center: [list[0].longitude, list[0].latitude], zoom: 12, duration: 700 });
      return;
    }
    const lngs = list.map((p) => p.longitude), lats = list.map((p) => p.latitude);
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: { top: 170, bottom: 120, left: 50, right: 50 }, maxZoom: 13, duration: 700 },
    );
  };

  const flyTo = (r: Restaurant) => {
    setSelected(r);
    const zoom = Math.max(mapRef.current?.getZoom() ?? 11, 12);
    mapRef.current?.flyTo({ center: [r.longitude, r.latitude], zoom, duration: 600 });
  };

  const color = mode === "tried" ? "#FF453A" : "#10B981";

  return (
    <div role="dialog" aria-modal="true" aria-label="Passport map" className="fixed inset-0 z-50 bg-subtle animate-fade-in">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: -40, latitude: 30, zoom: 1.6 }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        projection="globe"
        dragRotate={false}
        touchPitch={false}
        attributionControl={false}
        onLoad={() => fitAll()}
        onClick={() => setSelected(null)}
        style={{ width: "100%", height: "100%" }}
      >
        <GeolocateControl position="bottom-right" style={{ marginBottom: 110, marginRight: 16 }} />

        {shown.map((r) => (
          <Marker key={r.id} longitude={r.longitude} latitude={r.latitude} anchor="bottom"
            onClick={(e) => { e.originalEvent.stopPropagation(); flyTo(r); }}>
            <button type="button" aria-label={r.name}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white shadow-lg"
              style={{ background: color }}>
              {r.photoUrl
                ? <img src={r.photoUrl} alt="" className="h-full w-full object-cover" />
                : <UtensilsCrossed size={16} className="text-white" />}
            </button>
          </Marker>
        ))}

        {selected && (
          <Popup longitude={selected.longitude} latitude={selected.latitude} anchor="bottom" offset={44}
            closeButton={false} onClose={() => setSelected(null)}>
            <button type="button" onClick={() => onOpen(selected)} className="flex min-w-[160px] flex-col items-start gap-0.5 p-1 text-left">
              <span className="text-sm font-semibold text-ink">{selected.name}</span>
              <span className="text-xs text-muted">
                {selected.avgScore != null ? `Crew avg ${selected.avgScore.toFixed(1)} · ` : ""}Open details
              </span>
            </button>
          </Popup>
        )}
      </Map>

      {/* Chrome */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-3 bg-gradient-to-b from-background via-background/80 to-transparent px-5 pt-safe pb-8">
        <div className="pointer-events-auto flex items-center justify-between pt-2">
          <h2 className="m-0 font-display text-3xl font-extrabold tracking-[-0.03em]">Passport</h2>
          <button type="button" onClick={onClose} aria-label="Close map"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface">
            <X size={20} />
          </button>
        </div>
        <div className="pointer-events-auto">
          <Segmented<Mode>
            value={mode}
            onChange={(m) => { setMode(m); setSelected(null); setTimeout(() => fitAll(places.filter((p) => (m === "tried" ? p.visited : !p.visited))), 0); }}
            options={[
              { id: "tried", label: "Tried", count: places.filter((p) => p.visited).length },
              { id: "cravelist", label: "Cravelist", count: places.filter((p) => !p.visited).length },
            ]}
          />
        </div>
      </div>

      {shown.length > 1 && (
        <button type="button" onClick={() => fitAll()}
          className="absolute bottom-safe left-1/2 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-semibold text-white shadow-float">
          <Maximize2 size={15} /> Show all {shown.length}
        </button>
      )}
    </div>
  );
}
