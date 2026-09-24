import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// All Google Places calls go through the `places` Edge Function
// (supabase/functions/places), which holds the API key server-side as the
// GOOGLE_PLACES_API_KEY secret. No Google key ships in the app.

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
  city: string | null;
  area: string | null;
  countryCode: string | null;
};

export type Coords = { lat: number; lng: number };

export class PlacesError extends Error {}


async function callPlaces<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("places", { body, signal });
  if (!error) return data as T;

  if (error instanceof FunctionsHttpError) {
    const detail = await error.context.json().catch(() => null);
    throw new PlacesError(detail?.error ?? `places_${error.context.status}`);
  }
  throw new PlacesError(error.message);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function searchPlaces(
  query: string,
  { coords = null, signal }: { coords?: Coords | null; signal?: AbortSignal } = {},
): Promise<PlaceResult[]> {
  const { places } = await callPlaces<{ places: PlaceResult[] }>(
    { action: "search", query, lat: coords?.lat, lng: coords?.lng },
    signal,
  );
  return places;
}

/** Copies a place's Google photo into Storage and returns its public URL (null if unavailable). */
export async function cachePlacePhoto(photoName: string, placeId: string): Promise<string | null> {
  try {
    const { url } = await callPlaces<{ url: string }>({ action: "photo", photoName, placeId });
    return url;
  } catch (err) {
    console.warn("Photo caching failed, saving without photo:", err);
    return null;
  }
}

async function placeDetails(placeId: string) {
  return callPlaces<{
    openingHours: string[] | null;
    photoName: string | null;
    city: string | null;
    area: string | null;
    countryCode: string | null;
  }>({ action: "details", placeId });
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
        ...(details.countryCode
          ? { city: details.city, area: details.area, country_code: details.countryCode }
          : {}),
      })
      .eq("id", supabaseId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn("Failed TTL sync:", error);
    return false;
  }
}

/**
 * Fill in city / area / country for the caller's places saved before those
 * columns existed (up to 40 per call; RLS limits it to their own lists).
 */
export async function backfillLocations() {
  return callPlaces<{ updated: number; remaining: number | null }>({ action: "backfill_locations" });
}
