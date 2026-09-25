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

/** `code` is shown in the UI so a failing search can be diagnosed from a screenshot. */
export class PlacesError extends Error {
  constructor(public code: string, message = code) {
    super(message);
  }
}

async function callPlaces<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("places", { body, signal });
  if (!error) return data as T;

  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    // Our function answers { error }, the Supabase gateway { message } / { msg }.
    const detail = await error.context.json().catch(() => null);
    const reason = detail?.error ?? detail?.message ?? detail?.msg ?? "unknown";
    console.error("places function failed", status, JSON.stringify(detail));
    throw new PlacesError(`${status} ${reason}`);
  }
  if (signal?.aborted) throw error;
  console.error("places function unreachable", error);
  throw new PlacesError(`network ${error.name}`, error.message);
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

export type PlaceDetails = {
  openingHours: string[] | null;
  photoName: string | null;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;
  city: string | null;
  area: string | null;
  countryCode: string | null;
};

/** Hours, rating, price and location for one place (one Enterprise-tier request). */
export async function placeDetails(placeId: string) {
  return callPlaces<PlaceDetails>({ action: "details", placeId });
}

// ──────────────────────────────────────────────────────────────────
// TTL Live Cloud Sync Helper
// ──────────────────────────────────────────────────────────────────
export async function syncRestaurantData(placeId: string, supabaseId: number, hasPhoto: boolean) {
  try {
    const details = await placeDetails(placeId);
    // Photos are copied into Storage once; re-copying on every refresh just costs a Photo request.
    const photoUrl = !hasPhoto && details.photoName ? await cachePlacePhoto(details.photoName, placeId) : null;

    const { error } = await supabase
      .from("restaurants")
      .update({
        last_synced_at: new Date().toISOString(),
        ...(details.openingHours ? { opening_hours: details.openingHours } : {}),
        ...(photoUrl ? { photo_url: photoUrl } : {}),
        ...(details.rating != null
          ? { rating: details.rating, user_rating_count: details.userRatingCount, price_level: details.priceLevel }
          : {}),
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

/** What a Maps share points at: a search query, the place's name and (usually) its pin. */
export async function resolveShare(shared: { url?: string; text?: string }) {
  return callPlaces<{ query: string; name: string; lat: number | null; lng: number | null }>({
    action: "resolve_share", url: shared.url, text: shared.text,
  });
}

/**
 * Fill in city / area / country for the caller's places saved before those
 * columns existed (up to 40 per call; RLS limits it to their own lists).
 */
export async function backfillLocations() {
  return callPlaces<{ updated: number; remaining: number | null }>({ action: "backfill_locations" });
}
