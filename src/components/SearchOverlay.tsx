import { useState, useEffect, useRef } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import { supabase } from "../lib/supabase";
import { cachePlacePhoto, searchPlaces, type PlaceResult } from "../lib/places";
import { useDebounce } from "../hooks/useDebounce";
import { useApproxLocation } from "../hooks/useApproxLocation";
import { VIBE_OPTIONS } from "../constants/theme";
import { formatPriceLevel, formatPrimaryType } from "../utils/helpers";
import { Group } from "../types";

/** A place already saved in one of the user's lists (for "already saved" badges and cloning). */
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

// Hash function to generate a consistent, beautiful gradient based on the restaurant name
function generateGradientFromName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 80%, 75%), hsl(${h2}, 80%, 65%))`;
}

export function SearchOverlay({ activeGroupId, savedPlaces, groups, onSave, onClose }: { activeGroupId: string | null; savedPlaces: SavedPlace[]; groups: Group[]; onSave: () => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 350);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const coords = useApproxLocation();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const trimmedQuery = debouncedQuery.trim();
  const canSearch = trimmedQuery.length >= 2;
  const searchQuery = useQuery({
    queryKey: ["searchRestaurants", trimmedQuery, coords?.lat.toFixed(2), coords?.lng.toFixed(2)],
    queryFn: ({ signal }) => searchPlaces(trimmedQuery, { coords, signal }),
    enabled: canSearch,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    // Keep the previous results on screen while the next query loads
    placeholderData: keepPreviousData,
  });
  const isTyping = query.trim() !== trimmedQuery;

  const handleSave = async (place: PlaceResult) => {
    setSaving(true);
    setSaveError(null);
    try {
      const finalPhotoUrl = place.photoUrl ? await cachePlacePhoto(place.photoUrl, place.id) : null;

      // owner, created_at and visited are set by the database
      const { error } = await supabase.from("restaurants").insert({
        group_id: activeGroupId!,
        place_id: place.id,
        name: place.name,
        address: place.address,
        latitude: place.lat,
        longitude: place.lng,
        rating: place.rating ?? null,
        user_rating_count: place.userRatingCount ?? null,
        price_level: place.priceLevel ?? null,
        primary_type: place.primaryType ?? null,
        photo_url: finalPhotoUrl,
        vibes: selectedVibes,
        notes: notes || "",
        last_synced_at: new Date().toISOString(),
        opening_hours: place.openingHours ?? null,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      setSelectedPlace(null);
      setSelectedVibes([]);
      setNotes("");
      setQuery("");
      onSave();
    } catch (err) {
      console.error("Failed to save restaurant:", err);
      setSaveError(saveErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSilentClone = async (place: PlaceResult, instanceToClone: SavedPlace) => {
    setSaving(true);
    setSaveError(null);
    try {
      const { error } = await supabase.from("restaurants").insert({
        group_id: activeGroupId!,
        place_id: place.id,
        name: place.name,
        address: place.address,
        latitude: place.lat,
        longitude: place.lng,
        rating: place.rating ?? null,
        user_rating_count: place.userRatingCount ?? null,
        price_level: place.priceLevel ?? null,
        primary_type: place.primaryType ?? null,
        photo_url: instanceToClone.photoUrl ?? null,
        vibes: instanceToClone.vibes || [],
        notes: instanceToClone.notes || "",
        last_synced_at: new Date().toISOString(),
        opening_hours: instanceToClone.openingHours ?? null,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      setSelectedPlace(null);
      setQuery("");
      onSave();
    } catch (err) {
      console.error("Failed to clone restaurant:", err);
      setSaveError(saveErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleVibe = (vibe: string) => {
    setSelectedVibes((prev) => prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe]);
  };

  if (!selectedPlace) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background font-sans text-foreground">
        <div className="pt-safe-or-4 px-4 pb-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <Icon icon="solar:close-circle-linear" className="size-6" />
            </button>
            <div className="relative flex-1">
              <Icon
                icon="solar:magnifer-linear"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground size-5"
              />
              <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a restaurant..."
                className="w-full bg-secondary border border-transparent rounded-full pl-11 pr-10 py-3 text-[15px] font-medium text-foreground placeholder:text-muted-foreground outline-none transition-colors" />
              {query && (
                <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {canSearch && (isTyping || searchQuery.isFetching)
                    ? <Icon icon="ph:spinner-gap-bold" className="animate-spin size-4" />
                    : <Icon icon="solar:close-circle-bold" className="size-4" />}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {saveError && (
            <div role="alert" className="mx-4 mt-3 rounded-2xl bg-destructive/10 text-destructive px-4 py-3 text-sm font-medium">
              {saveError}
            </div>
          )}
          {query.trim().length < 2 ? (
            <div className="flex flex-col items-center justify-center p-16 text-muted-foreground/50">
              <Icon icon="solar:magnifer-linear" className="size-10 mb-4" />
              <p className="text-sm font-medium">Search by name, cuisine, or location</p>
            </div>
          ) : searchQuery.isError && !searchQuery.data ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Icon icon="solar:cloud-cross-linear" className="size-10 mb-3 text-muted-foreground" />
              <p className="text-sm font-bold text-foreground mb-1">Search isn't working right now</p>
              <p className="text-sm text-muted-foreground mb-5">Check your connection and try again.</p>
              <button type="button" onClick={() => searchQuery.refetch()}
                className="px-5 py-2.5 rounded-full text-sm font-bold bg-primary text-primary-foreground active:scale-95 transition-transform">
                Try again
              </button>
            </div>
          ) : !searchQuery.data ? (
            <div className="flex items-center justify-center p-12">
              <Icon icon="ph:spinner-gap-bold" className="animate-spin text-primary size-8" />
            </div>
          ) : searchQuery.data.length === 0 && !isTyping && !searchQuery.isFetching ? (
            <div className="text-center text-muted-foreground p-12 text-sm font-medium">No spots found for "{trimmedQuery}"</div>
          ) : (
          <div className={`transition-opacity ${isTyping || searchQuery.isPlaceholderData ? "opacity-60" : "opacity-100"}`}>
          {searchQuery.data?.map((place: PlaceResult) => {
            const savedInstances = savedPlaces.filter(r => r.placeId === place.id);
            const savedGroupNames = savedInstances.map(r => groups.find(g => g.id === r.groupId)?.name).filter(Boolean);
            const isAlreadyHere = savedInstances.some(r => r.groupId === activeGroupId);

            return (
              <button key={place.id} type="button" disabled={saving} onClick={() => {
                if (isAlreadyHere) return;
                if (savedInstances.length > 0) {
                  handleSilentClone(place, savedInstances[0]);
                } else {
                  setSelectedPlace(place);
                }
              }}
                className={`w-full text-left px-4 py-4 border-b border-border/50 transition-colors flex items-start gap-3.5 ${isAlreadyHere ? 'opacity-60 cursor-not-allowed' : 'active:bg-secondary'} ${(saving && !isAlreadyHere) ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner" style={{ background: generateGradientFromName(place.name), color: "#ffffff" }}>
                  <span className="font-black text-xl tracking-tight drop-shadow-sm opacity-90">{place.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base">{place.name}</div>

                  {savedGroupNames.length > 0 && (
                    <div className="mt-1">
                      <span className="inline-block text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                        {isAlreadyHere ? "Already in this Cravelist" : `Saved in: ${savedGroupNames.join(", ")}`}
                      </span>
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground mt-0.5 truncate">{place.address}</div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    {place.rating && (
                      <span className="flex items-center gap-0.5 font-bold text-foreground">
                        <Icon icon="solar:star-bold" className="text-amber-500 size-3" /> {place.rating}
                      </span>
                    )}
                    {place.priceLevel && <span className="font-semibold">{formatPriceLevel(place.priceLevel)}</span>}
                    {place.openNow !== undefined && (
                      <span className="font-semibold" style={{ color: place.openNow ? "#10b981" : "inherit" }}>
                        {place.openNow ? "Open" : "Closed"}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background font-sans text-foreground">
      <div className="pt-safe-or-4 px-4 pb-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setSelectedPlace(null)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <Icon icon="solar:alt-arrow-left-linear" className="size-6" />
          </button>
          <span className="font-bold text-base">Add to your list</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 pt-8 space-y-8">
          <div className="pr-2">
            <h2 className="font-heading text-3xl font-black leading-tight tracking-tight mb-2">{selectedPlace.name}</h2>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
              {selectedPlace.primaryType && <span className="text-foreground font-bold mr-1.5 uppercase tracking-wide text-[11px] bg-secondary px-2 py-1 rounded-md">{formatPrimaryType(selectedPlace.primaryType)}</span>}
              {selectedPlace.address}
            </p>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
            {selectedPlace.rating && (
              <span className="flex items-center gap-1 font-bold text-foreground bg-amber-500/10 px-2.5 py-1 rounded-lg">
                <Icon icon="solar:star-bold" className="text-amber-500 size-4" /> {selectedPlace.rating}
              </span>
            )}
            {selectedPlace.priceLevel && <span className="font-bold text-foreground">{formatPriceLevel(selectedPlace.priceLevel)}</span>}
          </div>

          <div>
            <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Assign Vibes</label>
            <div className="flex flex-wrap gap-2">
              {VIBE_OPTIONS.map((vibe) => {
                const isSelected = selectedVibes.includes(vibe.label);
                return (
                  <button key={vibe.label} type="button" onClick={() => toggleVibe(vibe.label)}
                    className="px-4 py-2 rounded-full text-xs font-bold transition-all border-2 active:scale-95"
                    style={isSelected
                      ? { background: vibe.color, color: "#fff", borderColor: vibe.color }
                      : { background: "transparent", color: vibe.color, borderColor: "var(--color-border)" }}>
                    {vibe.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Personal Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Why do you want to go here?"
              rows={3}
              className="w-full bg-secondary border border-transparent rounded-2xl p-4 text-sm placeholder:text-muted-foreground resize-none outline-none focus:border-primary/50 transition-all" />
          </div>
        </div>
      </div>
      <div className="px-5 pb-safe-or-4 pt-3 border-t border-border/50 bg-background/90 backdrop-blur-sm">
        <button type="button" onClick={() => handleSave(selectedPlace)}
          disabled={saving || selectedVibes.length === 0}
          className="w-full py-4 rounded-full font-bold text-primary-foreground text-sm disabled:opacity-40 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95"
          style={{ background: "var(--color-primary)" }}>
          {saving ? <Icon icon="ph:spinner-gap-bold" className="animate-spin size-5" /> : <Icon icon="solar:add-circle-bold" className="size-5" />}
          {saving ? "Saving..." : "Save to My List"}
        </button>
        {saveError && <p role="alert" className="text-xs text-destructive font-semibold text-center mt-2">{saveError}</p>}
        {selectedVibes.length === 0 && <p className="text-[11px] text-muted-foreground font-medium text-center mt-2">Pick at least one vibe</p>}
      </div>
    </div>
  );
}
