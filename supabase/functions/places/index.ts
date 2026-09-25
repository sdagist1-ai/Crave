// Google Places proxy.
//
// The app never holds the Google key: it calls this function (signed in — the
// gateway verifies the JWT) and the function calls Places API (New) with the
// GOOGLE_PLACES_API_KEY secret. A key restricted to "iOS apps" or "HTTP
// referrers" cannot work from the Capacitor WebView, so this is also what makes
// search reliable on device.
//
// POST { action: "search", query, lat?, lng? }  -> { places: PlaceResult[] }
// POST { action: "details", placeId }           -> { openingHours, photoName, rating, userRatingCount, priceLevel, city, area, countryCode }
// POST { action: "photo", photoName, placeId }  -> { url }  (cached in Storage)
// POST { action: "resolve_share", url?, text? } -> { query, name, lat, lng }
//      Turns what Apple Maps / Google Maps share (a link and/or text) into a
//      search query and coordinates for the share-to-Crave flow.
// POST { action: "backfill_locations" }         -> { updated, remaining }
//      Fills city/area/country_code for places saved before those columns
//      existed. Runs as the caller, so RLS limits it to their own lists.
import { createClient } from "npm:@supabase/supabase-js@2";

const GOOGLE_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
const PLACES = "https://places.googleapis.com/v1";

// Search asks only for Pro-tier fields. Rating, price and opening hours would bill
// every keystroke-search at the Enterprise rate; they're fetched once, with the
// place's details, when someone picks a result.
const SEARCH_FIELDS = [
  "id", "displayName", "formattedAddress", "location", "primaryType", "types", "photos", "addressComponents",
].map((f) => `places.${f}`).join(",");

// Search is for places to eat and drink: drop shops, parks, offices and the like.
// Google tags these with a food & drink type (restaurant, cafe, bar, bakery…) or
// a specific cuisine ending in "_restaurant".
const FOOD_TYPES = new Set([
  "restaurant", "food", "cafe", "coffee_shop", "tea_house", "bar", "pub", "wine_bar", "bar_and_grill",
  "bakery", "bagel_shop", "donut_shop", "dessert_shop", "ice_cream_shop", "juice_shop", "acai_shop",
  "chocolate_shop", "confectionery", "candy_store", "cafeteria", "deli", "diner", "food_court",
  "meal_takeaway", "meal_delivery", "brewery", "winery", "brewpub", "beer_hall", "cat_cafe", "dog_cafe",
]);
const isFoodPlace = (p: GooglePlace) =>
  [p.primaryType, ...(p.types ?? [])].some((t) => !!t && (FOOD_TYPES.has(t) || t.endsWith("_restaurant")));

// Opening hours already make Details an Enterprise request, so rating and price come free with it.
const DETAILS_FIELDS = "regularOpeningHours,photos,addressComponents,rating,userRatingCount,priceLevel";

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
  types?: string[];
  photos?: { name: string }[];
  currentOpeningHours?: { openNow?: boolean };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
};

// City for Passport counts, a neighbourhood-level `area` for cards, country code.
// Google omits `types` on some address components, so never assume it's there.
function locationOf(p: GooglePlace) {
  const find = (...types: string[]) => {
    for (const type of types) {
      const c = p.addressComponents?.find((c) => c.types?.includes(type));
      if (c) return c;
    }
    return undefined;
  };
  const city = find("locality", "postal_town", "administrative_area_level_2")?.longText ?? null;
  const area = find("neighborhood", "sublocality_level_1", "sublocality")?.longText ?? city;
  const countryCode = find("country")?.shortText ?? null;
  return { city, area, countryCode };
}

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
    ...locationOf(p),
  };
}

async function search(query: unknown, lat: unknown, lng: unknown) {
  if (typeof query !== "string" || query.trim().length < 2 || query.length > 120) {
    return json({ error: "invalid_query" }, 400);
  }

  // Ask for a few extra, since non-food places are filtered out below.
  const body: Record<string, unknown> = { textQuery: query.trim(), pageSize: 20 };
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
  return json({ places: (data.places ?? []).filter(isFoodPlace).slice(0, 15).map(toPlaceResult) });
}

async function details(placeId: unknown) {
  if (typeof placeId !== "string" || !PLACE_ID_RE.test(placeId)) {
    return json({ error: "invalid_place_id" }, 400);
  }

  const res = await fetch(`${PLACES}/places/${placeId}`, {
    headers: { "X-Goog-Api-Key": GOOGLE_KEY!, "X-Goog-FieldMask": DETAILS_FIELDS },
  });
  if (!res.ok) {
    console.error("place details failed", res.status, await res.text());
    return json({ error: "upstream_error", status: res.status }, 502);
  }

  const place = await res.json() as GooglePlace;
  return json({
    openingHours: place.regularOpeningHours?.weekdayDescriptions ?? null,
    photoName: place.photos?.[0]?.name ?? null,
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    priceLevel: place.priceLevel ?? null,
    ...locationOf(place),
  });
}

async function backfillLocations(req: Request) {
  // The caller's client: RLS limits reads and updates to lists they belong to.
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: rows, error } = await db
    .from("restaurants")
    .select("place_id")
    .is("country_code", null)
    .limit(1000);
  if (error) return json({ error: error.message }, 500);

  const placeIds = [...new Set((rows ?? []).map((r) => r.place_id))].slice(0, 40);
  let updated = 0;
  for (const placeId of placeIds) {
    if (!PLACE_ID_RE.test(placeId)) continue;
    const res = await fetch(`${PLACES}/places/${placeId}`, {
      headers: { "X-Goog-Api-Key": GOOGLE_KEY!, "X-Goog-FieldMask": "addressComponents" },
    });
    if (!res.ok) {
      console.error("backfill details failed", placeId, res.status);
      continue;
    }
    const { city, area, countryCode } = locationOf(await res.json() as GooglePlace);
    const { error: updateError } = await db
      .from("restaurants")
      .update({ city, area, country_code: countryCode })
      .eq("place_id", placeId);
    if (!updateError) updated++;
  }

  const { count } = await db
    .from("restaurants")
    .select("id", { count: "exact", head: true })
    .is("country_code", null);
  return json({ updated, remaining: count ?? null });
}

// Only map links are ever fetched (to expand Google's short links), never arbitrary URLs.
const MAP_HOST = /^(maps\.app\.goo\.gl|goo\.gl|(www\.)?google\.[a-z.]+|maps\.google\.[a-z.]+|consent\.google\.[a-z.]+|maps\.apple\.com|maps\.apple)$/i;

function coord(lat: unknown, lng: unknown) {
  const a = Number(lat), b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 && (a || b)
    ? { lat: a, lng: b } : null;
}

const isShortLink = (u: URL) => /(^|\.)goo\.gl$/i.test(u.hostname) || /^maps\.apple$/i.test(u.hostname) ||
  (/^maps\.apple\.com$/i.test(u.hostname) && u.pathname.startsWith("/p/"));

/** A Google Maps link found inside an interstitial page (HTML, maybe with JSON escapes). */
function mapsLinkIn(html: string): URL | null {
  const found = html
    .replace(/\\u0026/gi, "&").replace(/\\u003d/gi, "=").replace(/\\\//g, "/").replace(/&amp;/g, "&")
    .match(/https:\/\/(?:www\.google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)[^"'<>\s\\]*/i);
  try { return found ? new URL(found[0]) : null; } catch { return null; }
}

/**
 * Follows a map short link to the full place link. Google sometimes answers servers with
 * a consent or "unusual traffic" page that carries the real link in ?continue=, or with
 * a page that links to it instead of redirecting; both are unwrapped here.
 */
async function expandShortLink(start: URL): Promise<URL | null> {
  let url: URL | null = start;
  const hops: string[] = [];
  for (let i = 0; url && i < 6; i++) {
    const wrapped = /^(consent|www)\.google\./i.test(url.hostname) && /^\/(sorry|ml|$)/.test(url.pathname)
      ? url.searchParams.get("continue") : null;
    if (wrapped) {
      try { url = new URL(wrapped); } catch { return null; }
      hops.push("continue");
      if (!MAP_HOST.test(url.hostname)) return null;
      continue;
    }
    if (!isShortLink(url)) return url;

    // Google Maps mints a new short link when Share is tapped, and it 404s for the
    // first second or two; retry a new-looking 404 for up to ~4s before giving up.
    let res = await fetch(url, { redirect: "manual", headers: { "User-Agent": "curl/8.7.1", Accept: "*/*" } });
    for (const wait of /goo\.gl$/i.test(url.hostname) ? [700, 1300, 2000] : []) {
      if (res.status !== 404) break;
      await res.body?.cancel();
      hops.push(`404 ${url.hostname}, retry`);
      await new Promise((r) => setTimeout(r, wait));
      res = await fetch(url, { redirect: "manual", headers: { "User-Agent": "curl/8.7.1", Accept: "*/*" } });
    }
    hops.push(`${res.status} ${url.hostname}`);
    const next = res.headers.get("location");
    if (next) {
      await res.body?.cancel();
      url = new URL(next, url);
    } else {
      url = res.ok ? mapsLinkIn((await res.text()).slice(0, 300_000)) : null;
    }
    if (url && !MAP_HOST.test(url.hostname)) {
      hops.push(`off-map ${url.hostname}`);
      url = null;
    }
  }
  if (!url || isShortLink(url)) console.warn("resolve_share: short link didn't expand", { hops });
  return url && !isShortLink(url) ? url : null;
}

async function resolveShare(rawUrl: unknown, rawText: unknown) {
  const text = typeof rawText === "string" ? rawText.slice(0, 2000) : "";
  const link = (typeof rawUrl === "string" && rawUrl) || text.match(/https?:\/\/\S+/)?.[0] || "";

  // Google Maps shares "Name\nAddress\nlink"; Apple Maps usually just the link.
  const lines = text.split(/\n+/).map((l) => l.trim()).filter((l) => l && !/https?:\/\//.test(l));
  let name: string | null = lines[0] ?? null;
  let address: string | null = lines[1] ?? null;
  let at: { lat: number; lng: number } | null = null;
  let expanded = "";

  try {
    let url: URL | null = link ? new URL(link) : null;
    if (url && !MAP_HOST.test(url.hostname)) url = null;

    // Short links redirect to the full URL: maps.app.goo.gl/… → google.com/maps/place/…,
    // maps.apple/p/… → maps.apple.com/place?name=…&coordinate=…
    url = url && await expandShortLink(url);
    if (url) expanded = url.hostname + url.pathname.slice(0, 20) + (url.search ? "?" + [...url.searchParams.keys()].join(",") : "");
    if (url) {
      const q = url.searchParams;
      if (/apple/i.test(url.hostname)) {
        name = q.get("name") ?? q.get("q") ?? name;
        address = q.get("address") ?? address;
        const ll = (q.get("coordinate") ?? q.get("ll") ?? q.get("sll") ?? "").split(",");
        at = coord(ll[0], ll[1]);
      } else {
        const place = url.pathname.match(/\/maps\/(?:place|search)\/([^/@]+)/);
        const asked = q.get("q") ?? q.get("query") ?? q.get("destination");
        const askedAt = asked?.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
        if (place) name = decodeURIComponent(place[1].replace(/\+/g, " "));
        else if (askedAt) at = coord(askedAt[1], askedAt[2]);
        else if (asked) name = asked;
        const pin = url.href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? url.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (pin) at = coord(pin[1], pin[2]) ?? at;
      }
    }
  } catch (err) {
    console.warn("resolve_share: couldn't read link", err);
  }

  if (!name) {
    // Which kind of link couldn't be read (no query string or text: nothing personal).
    let shape = "none";
    try { if (link) { const u = new URL(link); shape = u.hostname + u.pathname.slice(0, 20); } } catch { shape = "unparseable"; }
    console.warn("resolve_share: no place in share", { shape, expanded, hasText: text.length > 0 });
    return json({ error: "no_place" }, 422);
  }
  // "Lucali, 575 Henry St, Brooklyn" style names already carry the street.
  const street = address && !name.includes(",") ? address.split(",")[0] : "";
  const query = [name, street].filter(Boolean).join(" ").slice(0, 120);
  return json({ query, name: name.split(",")[0].trim(), lat: at?.lat ?? null, lng: at?.lng ?? null });
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
      case "resolve_share": return await resolveShare(payload.url, payload.text);
      case "backfill_locations": return await backfillLocations(req);
      default: return json({ error: "unknown_action" }, 400);
    }
  } catch (err) {
    console.error("places function error", err);
    return json({ error: "internal_error" }, 500);
  }
});
