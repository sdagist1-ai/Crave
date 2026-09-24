const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || "";

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
  photoUrl?: string;
  openNow?: boolean;
  openingHours?: string[];
};


export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.primaryType,places.photos,places.currentOpeningHours,places.regularOpeningHours",
    },
    body: JSON.stringify({ textQuery: `${query} restaurant` }),
  });

  if (!res.ok) return [];
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

// ──────────────────────────────────────────────────────────────────
// TTL Live Cloud Sync Helper
// ──────────────────────────────────────────────────────────────────
export async function syncRestaurantData(placeId: string, supabaseId: number, supabase: any) {
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?fields=regularOpeningHours,photos`, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": GOOGLE_API_KEY,
      },
    });

    if (!res.ok) return false;
    const place: GooglePlace = await res.json();

    // Re-proxy the photo strictly if we need a new cache!
    let newPhotoUrl = undefined;
    if (place.photos?.[0]?.name) {
      const googleUrl = `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxWidthPx=600&key=${GOOGLE_API_KEY}`;
      const imgRes = await fetch(googleUrl);
      if (imgRes.ok) {
        const blob = await imgRes.blob();
        const filename = `place_${placeId}_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("place_photos")
          .upload(filename, blob, { upsert: true, contentType: "image/jpeg" });
        if (!uploadError && uploadData) {
          const { data } = supabase.storage.from("place_photos").getPublicUrl(filename);
          newPhotoUrl = data.publicUrl;
        }
      }
    }

    const payload: any = {
      last_synced_at: new Date().toISOString(),
    };
    if (place.regularOpeningHours?.weekdayDescriptions) {
      payload.opening_hours = place.regularOpeningHours.weekdayDescriptions;
    }
    if (newPhotoUrl) {
      payload.photo_url = newPhotoUrl;
    }

    await supabase.from("restaurants").update(payload).eq("id", supabaseId);
    return true;
  } catch (error) {
    console.warn("Failed TTL sync:", error);
    return false;
  }
}