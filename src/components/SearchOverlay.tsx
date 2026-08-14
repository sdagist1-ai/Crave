import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X, Star, Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { searchPlaces, type PlaceResult } from "../lib/places";
import { useDebounce } from "../hooks/useDebounce";
import { C, VIBE_OPTIONS } from "../constants/theme";
import { formatPriceLevel, formatPrimaryType } from "../utils/helpers";
import { Restaurant, Group } from "../types";

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

export function SearchOverlay({ activeGroupId, globalRestaurants, groups, onSave, onClose }: { activeGroupId: string | null; globalRestaurants: Restaurant[]; groups: Group[]; onSave: () => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 350);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const searchQuery = useQuery({
    queryKey: ["searchRestaurants", debouncedQuery],
    queryFn: () => searchPlaces(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000,
  });

  const handleSave = async (place: PlaceResult) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Download from Google EXACTLY ONCE and cache heavily into Supabase Storage
      let finalPhotoUrl = null;
      if (place.photoUrl) {
        try {
          const googleUrl = `https://places.googleapis.com/v1/${place.photoUrl}/media?maxWidthPx=600&key=${import.meta.env.VITE_GOOGLE_API_KEY}`;
          const res = await fetch(googleUrl);
          if (res.ok) {
            const blob = await res.blob();
            const filename = `place_${place.id}_${Date.now()}.jpg`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("place_photos")
              .upload(filename, blob, { upsert: true, contentType: "image/jpeg" });

            if (!uploadError && uploadData) {
              const { data } = supabase.storage.from("place_photos").getPublicUrl(filename);
              finalPhotoUrl = data.publicUrl;
            } else {
              console.error("Photo upload error:", uploadError);
            }
          }
        } catch (e) {
          console.warn("Storage caching failed, proceeding without photo:", e);
        }
      }

      const { error } = await supabase.from("restaurants").insert({
        owner: user?.id ?? "",
        group_id: activeGroupId,
        place_id: place.id,
        name: place.name,
        address: place.address,
        latitude: String(place.lat),
        longitude: String(place.lng),
        rating: place.rating != null ? String(place.rating) : null,
        user_rating_count: place.userRatingCount ?? null,
        price_level: place.priceLevel ?? null,
        primary_type: place.primaryType ?? null,
        photo_url: finalPhotoUrl,
        vibes: JSON.stringify(selectedVibes),
        notes: notes || "",
        visited: false,
        created_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        opening_hours: place.openingHours ? JSON.stringify(place.openingHours) : null,
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
    } finally {
      setSaving(false);
    }
  };

  const handleSilentClone = async (place: PlaceResult, instanceToClone: Restaurant) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("restaurants").insert({
        owner: user?.id ?? "",
        group_id: activeGroupId,
        place_id: place.id,
        name: place.name,
        address: place.address,
        latitude: String(place.lat),
        longitude: String(place.lng),
        rating: place.rating != null ? String(place.rating) : null,
        user_rating_count: place.userRatingCount ?? null,
        price_level: place.priceLevel ?? null,
        primary_type: place.primaryType ?? null,
        photo_url: instanceToClone.photoUrl ?? null,
        vibes: JSON.stringify(instanceToClone.vibes || []),
        notes: instanceToClone.notes || "",
        visited: false,
        created_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        opening_hours: instanceToClone.openingHours ? JSON.stringify(instanceToClone.openingHours) : null,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      setSelectedPlace(null);
      setQuery("");
      onSave();
    } catch (err) {
      console.error("Failed to clone restaurant:", err);
    } finally {
      setSaving(false);
    }
  };

  const toggleVibe = (vibe: string) => {
    setSelectedVibes((prev) => prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe]);
  };

  if (!selectedPlace) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white">
        <div className="pt-safe-or-4 px-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="p-1.5 text-slate-400"><X size={22} /></button>
            <div className="flex-1 flex items-center gap-2.5 bg-slate-50 rounded-2xl px-4 py-3 border border-slate-200">
              <Search size={18} className="text-slate-400 flex-shrink-0" />
              <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a restaurant..."
                className="flex-1 bg-transparent text-slate-800 text-base placeholder:text-slate-400 outline-none font-medium" />
              {query && <button type="button" onClick={() => setQuery("")} className="text-slate-400"><X size={16} /></button>}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {searchQuery.isLoading && debouncedQuery.length >= 2 && (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full" />
            </div>
          )}
          {searchQuery.data?.map((place: PlaceResult) => {
            const savedInstances = globalRestaurants.filter(r => r.placeId === place.id);
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
                className={`w-full text-left px-4 py-4 border-b border-slate-50 transition-colors flex items-start gap-3.5 ${isAlreadyHere ? 'opacity-60 cursor-not-allowed' : 'active:bg-slate-50'} ${(saving && !isAlreadyHere) ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner" style={{ background: generateGradientFromName(place.name), color: "#ffffff" }}>
                  <span className="font-black text-xl tracking-tight drop-shadow-sm opacity-90">{place.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 text-base">{place.name}</div>

                  {savedGroupNames.length > 0 && (
                    <div className="mt-1">
                      <span className="inline-block text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-md" style={{ background: C.roseLight, color: C.rose }}>
                        {isAlreadyHere ? "Already in this Cravelist" : `Saved in: ${savedGroupNames.join(", ")}`}
                      </span>
                    </div>
                  )}

                  <div className="text-sm text-slate-400 mt-0.5 truncate">{place.address}</div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                    {place.rating && (
                      <span className="flex items-center gap-0.5 font-bold text-slate-700">
                        <Star size={12} fill={C.amber} stroke={C.amber} /> {place.rating}
                      </span>
                    )}
                    {place.priceLevel && <span className="font-semibold">{formatPriceLevel(place.priceLevel)}</span>}
                    {place.openNow !== undefined && (
                      <span className="font-semibold" style={{ color: place.openNow ? C.emerald : C.slate400 }}>
                        {place.openNow ? "Open" : "Closed"}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {debouncedQuery.length >= 2 && !searchQuery.isLoading && searchQuery.data?.length === 0 && (
            <div className="text-center text-slate-400 p-12 text-sm">No restaurants found</div>
          )}
          {debouncedQuery.length < 2 && (
            <div className="flex flex-col items-center justify-center p-16 text-slate-400">
              <Search size={40} strokeWidth={1} className="mb-4 opacity-30" />
              <p className="text-sm font-medium">Search by name, cuisine, or location</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="pt-safe-or-4 px-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setSelectedPlace(null)} className="p-1.5 text-slate-400"><X size={22} /></button>
          <span className="font-bold text-slate-800 text-base">Add to your list</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="p-6 pt-8 space-y-7">
          <div className="pr-2">
            <h2 className="text-[28px] font-black text-slate-800 leading-tight tracking-tight">{selectedPlace.name}</h2>
            <p className="text-sm text-slate-500 mt-2.5 font-medium leading-relaxed">
              {selectedPlace.primaryType && <span className="text-slate-700 font-bold mr-1.5 uppercase tracking-wide text-[11px] bg-slate-100 px-2 py-1 rounded-md">{formatPrimaryType(selectedPlace.primaryType)}</span>}
              {selectedPlace.address}
            </p>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-500 mb-2">
            {selectedPlace.rating && (
              <span className="flex items-center gap-1 font-bold text-slate-800 bg-amber-50 px-2.5 py-1 rounded-lg">
                <Star size={14} fill={C.amber} stroke={C.amber} /> {selectedPlace.rating}
              </span>
            )}
            {selectedPlace.priceLevel && <span className="font-bold">{formatPriceLevel(selectedPlace.priceLevel)}</span>}
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Assign Vibes</label>
            <div className="flex flex-wrap gap-2">
              {VIBE_OPTIONS.map((vibe) => {
                const isSelected = selectedVibes.includes(vibe.label);
                return (
                  <button key={vibe.label} type="button" onClick={() => toggleVibe(vibe.label)}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all border-2"
                    style={isSelected
                      ? { background: vibe.color, color: "#fff", borderColor: vibe.color, boxShadow: `0 4px 12px ${vibe.color}30` }
                      : { background: C.slate50, color: C.slate600, borderColor: C.slate200 }}>
                    {vibe.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Personal Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Why do you want to go here?"
              rows={3}
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-slate-700 text-sm placeholder:text-slate-400 resize-none outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all" />
          </div>
        </div>
      </div>
      <div className="px-5 pb-safe-or-4 pt-3 border-t border-slate-100">
        <button type="button" onClick={() => handleSave(selectedPlace)}
          disabled={saving || selectedVibes.length === 0}
          className="w-full py-4 rounded-2xl font-bold text-white text-sm disabled:opacity-40 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
          style={{ background: C.rose }}>
          <Plus size={18} />
          {saving ? "Saving..." : "Save to My List"}
        </button>
        {selectedVibes.length === 0 && <p className="text-xs text-slate-400 text-center mt-2">Pick at least one vibe</p>}
      </div>
    </div>
  );
}
