// Google Places proxy.
//
// The app never holds the Google key: it calls this function (signed in — the
// gateway verifies the JWT) and the function calls Places API (New) with the
// GOOGLE_PLACES_API_KEY secret. A key restricted to "iOS apps" or "HTTP
// referrers" cannot work from the Capacitor WebView, so this is also what makes
// search reliable on device.
//
// POST { action: "search", query, lat?, lng? }  -> { places: PlaceResult[] }
// POST { action: "details", placeId }           -> { openingHours, photoName }
// POST { action: "photo", photoName, placeId }  -> { url }  (cached in Storage)
import { createClient } from "npm:@supabase/supabase-js@2";

const GOOGLE_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
const PLACES = "https://places.googleapis.com/v1";

const SEARCH_FIELDS = [
  "id", "displayName", "formattedAddress", "location", "rating", "userRatingCount",
  "priceLevel", "primaryType", "photos", "currentOpeningHours", "regularOpeningHours",
].map((f) => `places.${f}`).join(",");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,300}$/;
const PHOTO_NAME_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  primaryType?: string;
  photos?: { name: string }[];
  currentOpeningHours?: { openNow?: boolean };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function toPlaceResult(p: GooglePlace) {
  return {
    id: p.id,
    name: p.displayName?.text ?? "",
    address: p.formattedAddress ?? "",
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
    rating: p.rating,
    userRatingCount: p.userRatingCount,
    priceLevel: p.priceLevel,
    primaryType: p.primaryType,
    photoUrl: p.photos?.[0]?.name,
    openNow: p.currentOpeningHours?.openNow,
    openingHours: p.regularOpeningHours?.weekdayDescriptions,
  };
}

async function search(query: unknown, lat: unknown, lng: unknown) {
  if (typeof query !== "string" || query.trim().length < 2 || query.length > 120) {
    return json({ error: "invalid_query" }, 400);
  }

  const body: Record<string, unknown> = { textQuery: query.trim(), pageSize: 15 };
  if (typeof lat === "number" && typeof lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 30000 } };
  }

  const res = await fetch(`${PLACES}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_KEY!,
      "X-Goog-FieldMask": SEARCH_FIELDS,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("searchText failed", res.status, await res.text());
    return json({ error: "upstream_error", status: res.status }, 502);
  }

  const data = await res.json() as { places?: GooglePlace[] };
  return json({ places: (data.places ?? []).map(toPlaceResult) });
}

async function details(placeId: unknown) {
  if (typeof placeId !== "string" || !PLACE_ID_RE.test(placeId)) {
    return json({ error: "invalid_place_id" }, 400);
  }

  const res = await fetch(`${PLACES}/places/${placeId}`, {
    headers: { "X-Goog-Api-Key": GOOGLE_KEY!, "X-Goog-FieldMask": "regularOpeningHours,photos" },
  });
  if (!res.ok) {
    console.error("place details failed", res.status, await res.text());
    return json({ error: "upstream_error", status: res.status }, 502);
  }

  const place = await res.json() as GooglePlace;
  return json({
    openingHours: place.regularOpeningHours?.weekdayDescriptions ?? null,
    photoName: place.photos?.[0]?.name ?? null,
  });
}

async function photo(photoName: unknown, placeId: unknown) {
  if (typeof photoName !== "string" || !PHOTO_NAME_RE.test(photoName)) {
    return json({ error: "invalid_photo_name" }, 400);
  }
  if (typeof placeId !== "string" || !PLACE_ID_RE.test(placeId)) {
    return json({ error: "invalid_place_id" }, 400);
  }

  const res = await fetch(`${PLACES}/${photoName}/media?maxWidthPx=600&key=${GOOGLE_KEY}`);
  if (!res.ok) {
    console.error("photo media failed", res.status);
    return json({ error: "upstream_error", status: res.status }, 502);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/jpeg";

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const path = `place_${placeId}_${Date.now()}.jpg`;
  const { error } = await admin.storage.from("place_photos").upload(path, bytes, { contentType });
  if (error) {
    console.error("photo upload failed", error.message);
    return json({ error: "storage_error" }, 500);
  }

  return json({ url: admin.storage.from("place_photos").getPublicUrl(path).data.publicUrl });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!GOOGLE_KEY) return json({ error: "not_configured" }, 503);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  try {
    switch (payload.action) {
      case "search": return await search(payload.query, payload.lat, payload.lng);
      case "details": return await details(payload.placeId);
      case "photo": return await photo(payload.photoName, payload.placeId);
      default: return json({ error: "unknown_action" }, 400);
    }
  } catch (err) {
    console.error("places function error", err);
    return json({ error: "internal_error" }, 500);
  }
});
