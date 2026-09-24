import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, CloudOff, Loader2, LocateFixed, Plus, Search, Star, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { cachePlacePhoto, PlacesError, searchPlaces, type PlaceResult } from "../lib/places";
import { useDebounce } from "../hooks/useDebounce";
import { useApproxLocation } from "../hooks/useApproxLocation";
import { VIBE_OPTIONS } from "../constants/theme";
import { formatPriceLevel, formatPrimaryType } from "../utils/helpers";
import type { Group } from "../types";
import { FilterChip, PrimaryButton, Tag } from "./ui";

/** A place already saved in one of the user's lists (for "already saved" badges and pre-filling). */
export type SavedPlace = {
  placeId: string;
  groupId: string;
  photoUrl: string | null;
  vibes: string[];
  notes: string | null;
  openingHours: string[] | null;
};

function saveErrorMessage(err: unknown) {
  if (err && typeof err === "object" && "code" in err && err.code === "23505") {
    return "That spot is already in this Cravelist.";
  }
  return "Couldn't save that spot. Check your connection and try again.";
}

const TILE_TINTS = ["bg-accent-soft text-accent-ink", "bg-mint-soft text-mint-ink", "bg-sky-soft text-sky-ink", "bg-sun-soft text-sun-ink", "bg-violet-soft text-violet-ink"];
function tileTint(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return TILE_TINTS[Math.abs(h) % TILE_TINTS.length];
}

export function SearchOverlay({ activeGroupId, savedPlaces, groups, initialQuery = "", onSave, onClose }: {
  activeGroupId: string | null;
  savedPlaces: SavedPlace[];
  groups: Group[];
  initialQuery?: string;
  onSave: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 350);
  const [selected, setSelected] = useState<{ place: PlaceResult; from?: SavedPlace } | null>(null);
  const [vibes, setVibes] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { coords, status: locationStatus, request: requestLocation } = useApproxLocation();
  // Wait for a location we already have permission for, so results come back
  // near-you-first instead of searching twice.
  const locationSettled = locationStatus !== "checking" && !(locationStatus === "granted" && !coords);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const listName = groups.find((g) => g.id === activeGroupId)?.name ?? "your list";

  useEffect(() => { if (!selected) inputRef.current?.focus(); }, [selected]);

  const trimmedQuery = debouncedQuery.trim();
  const canSearch = trimmedQuery.length >= 2;
  const results = useQuery({
    queryKey: ["searchRestaurants", trimmedQuery, coords?.lat.toFixed(2), coords?.lng.toFixed(2)],
    queryFn: ({ signal }) => searchPlaces(trimmedQuery, { coords, signal }),
    enabled: canSearch && locationSettled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData, // keep previous results on screen while typing
  });
  const isTyping = query.trim() !== trimmedQuery;

  const choose = (place: PlaceResult, from?: SavedPlace) => {
    setSelected({ place, from });
    setVibes(from?.vibes ?? []);
    setNotes(from?.notes ?? "");
    setSaveError(null);
  };

  const save = async () => {
    if (!selected || !activeGroupId) return;
    const { place, from } = selected;
    setSaving(true);
    setSaveError(null);
    try {
      // Reuse the photo already cached for this place; otherwise copy Google's.
      const photoUrl = from?.photoUrl ?? (place.photoUrl ? await cachePlacePhoto(place.photoUrl, place.id) : null);

      // owner, created_at and visited are set by the database
      const { error } = await supabase.from("restaurants").insert({
        group_id: activeGroupId,
        place_id: place.id,
        name: place.name,
        address: place.address,
        city: place.city,
        area: place.area,
        country_code: place.countryCode,
        latitude: place.lat,
        longitude: place.lng,
        rating: place.rating ?? null,
        user_rating_count: place.userRatingCount ?? null,
        price_level: place.priceLevel ?? null,
        primary_type: place.primaryType ?? null,
        photo_url: photoUrl,
        vibes,
        notes: notes.trim(),
        last_synced_at: new Date().toISOString(),
        opening_hours: place.openingHours ?? from?.openingHours ?? null,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      onSave();
    } catch (err) {
      console.error("Failed to save restaurant:", err);
      setSaveError(saveErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ─── Step 2: confirm & add ────────────────────────────────────────────────
  if (selected) {
    const { place, from } = selected;
    const fromName = from ? groups.find((g) => g.id === from.groupId)?.name : null;
    return (
      <div role="dialog" aria-modal="true" aria-label={`Add ${place.name}`} className="fixed inset-0 z-50 flex flex-col bg-background animate-fade-in">
        <div className="flex items-center gap-2 px-3 pt-safe">
          <button type="button" onClick={() => setSelected(null)} aria-label="Back to results"
            className="mt-2 flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-subtle">
            <ChevronLeft size={24} />
          </button>
          <span className="mt-2 text-[15px] font-semibold">Add to {listName}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-page pt-4 pb-6">
          <h1 className="m-0 mb-2 font-display text-[32px] leading-none font-extrabold tracking-[-0.03em]">{place.name}</h1>
          <p className="m-0 mb-3 text-sm text-muted">
            {[formatPrimaryType(place.primaryType), place.address].filter(Boolean).join(" · ")}
          </p>
          <div className="mb-7 flex flex-wrap gap-1.5">
            {place.rating != null && <Tag tone="sun"><Star size={11} className="mr-1 fill-current" />{place.rating}</Tag>}
            {formatPriceLevel(place.priceLevel) && <Tag>{formatPriceLevel(place.priceLevel)}</Tag>}
            {fromName && <Tag tone="bg-accent-tint text-accent-ink">Also in {fromName}</Tag>}
          </div>

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

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Why this spot?</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Heard the brunch is unreal…"
              className="w-full resize-none rounded-2xl border border-border bg-surface p-3.5 text-[15px] outline-none placeholder:text-muted focus:border-accent" />
          </label>
        </div>

        <div className="border-t border-border bg-background px-page pt-3 pb-safe">
          {saveError && <p role="alert" className="m-0 mb-2 text-center text-sm font-medium text-danger">{saveError}</p>}
          <PrimaryButton onClick={save} disabled={saving || vibes.length === 0} tone="accent">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} strokeWidth={2.6} />}
            {saving ? "Saving…" : `Save to ${listName}`}
          </PrimaryButton>
          {vibes.length === 0 && <p className="m-0 mt-2 text-center text-xs text-muted">Pick a vibe to save</p>}
        </div>
      </div>
    );
  }

  // ─── Step 1: search Google ────────────────────────────────────────────────
  return (
    <div role="dialog" aria-modal="true" aria-label="Add a place" className="fixed inset-0 z-50 flex flex-col bg-background animate-fade-in">
      <div className="flex flex-col gap-3 border-b border-border px-page pt-safe pb-3">
        <div className="flex items-center justify-between pt-2">
          <h1 className="m-0 font-display text-[28px] font-extrabold tracking-[-0.03em]">Add a place</h1>
          <button type="button" onClick={onClose} aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface">
            <X size={20} />
          </button>
        </div>
        <div className="flex h-[50px] items-center gap-2.5 rounded-2xl border border-border bg-surface px-3.5 focus-within:border-accent">
          <Search size={18} className="shrink-0 text-muted" aria-hidden="true" />
          <label htmlFor="place-search" className="sr-only">Search restaurants, cafés and bars</label>
          <input id="place-search" ref={inputRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Restaurant, café, bar…" enterKeyHint="search" autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden" />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted">
              {canSearch && (isTyping || results.isFetching) ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
            </button>
          )}
        </div>
      </div>

      {locationStatus === "prompt" && (
        <button type="button" onClick={requestLocation}
          className="mx-5 mt-3 flex items-center gap-3 rounded-2xl bg-accent-tint px-4 py-3 text-left md:mx-auto md:w-full md:max-w-[40rem]">
          <LocateFixed size={20} className="shrink-0 text-accent-ink" aria-hidden="true" />
          <span className="flex flex-1 flex-col">
            <span className="text-sm font-semibold text-ink">See spots near you first</span>
            <span className="text-xs text-muted">Share your location to rank results by distance.</span>
          </span>
          <span className="text-sm font-semibold text-accent-ink">Allow</span>
        </button>
      )}

      <div className="flex-1 overflow-y-auto pb-safe">
        {query.trim().length < 2 ? (
          <div className="flex flex-col items-center px-8 py-16 text-center text-muted">
            <Search size={32} className="mb-3 text-border-strong" aria-hidden="true" />
            <p className="m-0 text-sm">
              Search by name, cuisine or neighbourhood.
              {coords ? " Results near you come first."
                : locationStatus === "denied" ? " Turn on location for Crave in Settings to see nearby spots first." : ""}
            </p>
          </div>
        ) : results.isError && !results.data ? (
          <div className="flex flex-col items-center px-8 py-12 text-center">
            <CloudOff size={32} className="mb-3 text-muted" aria-hidden="true" />
            <p className="m-0 mb-1 text-[15px] font-semibold">Search isn't working right now</p>
            <p className="m-0 mb-5 text-sm text-muted">Check your connection and try again.</p>
            <PrimaryButton onClick={() => results.refetch()} block={false}>Try again</PrimaryButton>
            {results.error instanceof PlacesError && (
              <p className="m-0 mt-4 font-mono text-[11px] text-muted">Error: {results.error.code}</p>
            )}
          </div>
        ) : !results.data ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-accent" aria-label="Searching" /></div>
        ) : results.data.length === 0 && !isTyping && !results.isFetching ? (
          <p className="m-0 px-8 py-12 text-center text-sm text-muted">No spots found for "{trimmedQuery}"</p>
        ) : (
          <ul className={`m-0 list-none p-0 transition-opacity ${isTyping || results.isPlaceholderData ? "opacity-60" : ""}`}>
            {results.data.map((place) => {
              const saved = savedPlaces.filter((s) => s.placeId === place.id);
              const inThisList = saved.some((s) => s.groupId === activeGroupId);
              const otherLists = saved.map((s) => groups.find((g) => g.id === s.groupId)?.name).filter(Boolean);
              const subtitle = [formatPrimaryType(place.primaryType), place.area].filter(Boolean).join(" · ");
              return (
                <li key={place.id} className="border-b border-border">
                  <button type="button" disabled={inThisList} onClick={() => choose(place, saved[0])}
                    className="flex w-full items-center gap-3.5 px-page py-3.5 text-left active:bg-subtle disabled:opacity-60">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-display text-xl font-extrabold ${tileTint(place.name)}`}>
                      {place.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-semibold">{place.name}</span>
                      <span className="truncate text-[13px] text-muted">{subtitle || place.address}</span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        {place.rating != null && <span className="flex items-center gap-0.5 font-medium text-ink"><Star size={11} className="fill-[#f59e0b] text-[#f59e0b]" />{place.rating}</span>}
                        {formatPriceLevel(place.priceLevel) && <span>{formatPriceLevel(place.priceLevel)}</span>}
                        {place.openNow != null && <span className={place.openNow ? "text-mint-ink" : ""}>{place.openNow ? "Open now" : "Closed"}</span>}
                        {inThisList ? <Tag tone="bg-accent-tint text-accent-ink">In this list</Tag>
                          : otherLists.length > 0 && <Tag tone="bg-subtle text-ink-2">In {otherLists.join(", ")}</Tag>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
