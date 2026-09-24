import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Google Places goes through the `places` Edge Function (supabase/functions/places),
// which holds the API key. Until its GOOGLE_PLACES_API_KEY secret is set the function
// answers 503 "not_configured" and we fall back to calling Google directly with the
// bundled key, so search keeps working during the switch-over.
const LEGACY_GOOGLE_KEY = import.meta.env.VITE_GOOGLE_API_KEY || "";
const PLACES = "https://places.googleapis.com/v1";
const SEARCH_FIELDS =
  "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.primaryType,places.photos,places.currentOpeningHours,places.regularOpeningHours";

export type PlaceResult = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  primaryType?: string;
  /** Google photo resource name (places/…/photos/…), not a URL */
  photoUrl?: string;
  openNow?: boolean;
  openingHours?: string[];
};

export type Coords = { lat: number; lng: number };

export class PlacesError extends Error {}

class NotConfigured extends Error {}

async function callPlaces<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("places", { body, signal });
  if (!error) return data as T;

  if (error instanceof FunctionsHttpError) {
    const detail = await error.context.json().catch(() => null);
    if (detail?.error === "not_configured") throw new NotConfigured();
    throw new PlacesError(detail?.error ?? `places_${error.context.status}`);
  }
  throw new PlacesError(error.message);
}

// ─── Direct-to-Google fallback (remove once the Edge Function secret is set) ──

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  primaryType?: string;
  photos?: { name: string }[];
  currentOpeningHours?: { openNow: boolean };
  regularOpeningHours?: { weekdayDescriptions: string[] };
}

async function legacySearch(query: string, coords: Coords | null, signal?: AbortSignal): Promise<PlaceResult[]> {
  const body: Record<string, unknown> = { textQuery: query, pageSize: 15 };
  if (coords) {
    body.locationBias = { circle: { center: { latitude: coords.lat, longitude: coords.lng }, radius: 30000 } };
  }
  const res = await fetch(`${PLACES}/places:searchText`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": LEGACY_GOOGLE_KEY,
      "X-Goog-FieldMask": SEARCH_FIELDS,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new PlacesError(`google_${res.status}`);
  const data = await res.json();
  return (data.places || []).map((p: GooglePlace) => ({
    id: p.id,
    name: p.displayName?.text || "",
    address: p.formattedAddress || "",
    lat: p.location?.latitude || 0,
    lng: p.location?.longitude || 0,
    rating: p.rating,
    userRatingCount: p.userRatingCount,
    priceLevel: p.priceLevel,
    primaryType: p.primaryType,
    photoUrl: p.photos?.[0]?.name,
    openNow: p.currentOpeningHours?.openNow,
    openingHours: p.regularOpeningHours?.weekdayDescriptions,
  }));
}

async function legacyCachePhoto(photoName: string, placeId: string): Promise<string | null> {
  const res = await fetch(`${PLACES}/${photoName}/media?maxWidthPx=600&key=${LEGACY_GOOGLE_KEY}`);
  if (!res.ok) return null;
  const filename = `place_${placeId}_${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("place_photos")
    .upload(filename, await res.blob(), { contentType: "image/jpeg" });
  if (error) return null;
  return supabase.storage.from("place_photos").getPublicUrl(filename).data.publicUrl;
}

async function legacyDetails(placeId: string) {
  const res = await fetch(`${PLACES}/places/${placeId}?fields=regularOpeningHours,photos`, {
    headers: { "X-Goog-Api-Key": LEGACY_GOOGLE_KEY },
  });
  if (!res.ok) throw new PlacesError(`google_${res.status}`);
  const place: GooglePlace = await res.json();
  return {
    openingHours: place.regularOpeningHours?.weekdayDescriptions ?? null,
    photoName: place.photos?.[0]?.name ?? null,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function searchPlaces(
  query: string,
  { coords = null, signal }: { coords?: Coords | null; signal?: AbortSignal } = {},
): Promise<PlaceResult[]> {
  try {
    const { places } = await callPlaces<{ places: PlaceResult[] }>(
      { action: "search", query, lat: coords?.lat, lng: coords?.lng },
      signal,
    );
    return places;
  } catch (err) {
    if (err instanceof NotConfigured && LEGACY_GOOGLE_KEY) return legacySearch(query, coords, signal);
    throw err;
  }
}

/** Copies a place's Google photo into Storage and returns its public URL (null if unavailable). */
export async function cachePlacePhoto(photoName: string, placeId: string): Promise<string | null> {
  try {
    const { url } = await callPlaces<{ url: string }>({ action: "photo", photoName, placeId });
    return url;
  } catch (err) {
    if (err instanceof NotConfigured && LEGACY_GOOGLE_KEY) return legacyCachePhoto(photoName, placeId);
    console.warn("Photo caching failed, saving without photo:", err);
    return null;
  }
}

async function placeDetails(placeId: string) {
  try {
    return await callPlaces<{ openingHours: string[] | null; photoName: string | null }>({ action: "details", placeId });
  } catch (err) {
    if (err instanceof NotConfigured && LEGACY_GOOGLE_KEY) return legacyDetails(placeId);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────────
// TTL Live Cloud Sync Helper
// ──────────────────────────────────────────────────────────────────
export async function syncRestaurantData(placeId: string, supabaseId: number) {
  try {
    const details = await placeDetails(placeId);
    const photoUrl = details.photoName ? await cachePlacePhoto(details.photoName, placeId) : null;

    const { error } = await supabase
      .from("restaurants")
      .update({
        last_synced_at: new Date().toISOString(),
        ...(details.openingHours ? { opening_hours: details.openingHours } : {}),
        ...(photoUrl ? { photo_url: photoUrl } : {}),
      })
      .eq("id", supabaseId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn("Failed TTL sync:", error);
    return false;
  }
}
