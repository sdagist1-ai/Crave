import { infiniteQueryOptions } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Profile, Restaurant, Review, SortOption } from "../types";

/** One row of `get_group_feed` (see supabase/migrations/*_group_feed_rpc.sql). */
type FeedRow = {
  id: number;
  place_id: string;
  group_id: string;
  name: string;
  address: string;
  city: string | null;
  area: string | null;
  country_code: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  user_rating_count: number | null;
  price_level: string | null;
  primary_type: string | null;
  cuisine: string | null;
  cuisine_detail: string | null;
  occasions: string[] | null;
  photo_url: string | null;
  website_url: string | null;
  booking_platform: string | null;
  booking_url: string | null;
  vibes: string[];
  notes: string | null;
  opening_hours: string[] | null;
  last_synced_at: string | null;
  visited: boolean;
  created_at: string;
  added_by: Profile | null;
  reviews: (Review & { authorName: string })[];
  avg_score: number | null;
  rated_count: number;
};

/** Fallback for places saved before location columns existed: "1 Main St, Brooklyn, NY 11211, USA" -> "Brooklyn". */
function areaFromAddress(address: string): string | null {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return parts.length === 2 ? parts[0] : null;
  const region = parts[parts.length - 2];
  return /\d/.test(region) ? parts[parts.length - 3] : region;
}

function toRestaurant(row: FeedRow, uid: string): Restaurant {
  const reviews = row.reviews ?? [];
  const myReview = reviews.find((rev) => rev.user_id === uid);

  // Every photo anyone in the list uploaded with their review.
  const allVisitPhotos = reviews.flatMap((rev) => {
    const urls = rev.photo_urls?.length ? rev.photo_urls : rev.photo_url ? [rev.photo_url] : [];
    return urls.map((url) => ({ url, authorId: rev.user_id, authorName: rev.authorName }));
  });

  return {
    id: row.id,
    placeId: row.place_id,
    groupId: row.group_id,
    name: row.name,
    address: row.address,
    city: row.city,
    area: row.area ?? areaFromAddress(row.address),
    countryCode: row.country_code,
    latitude: row.latitude,
    longitude: row.longitude,
    rating: row.rating,
    userRatingCount: row.user_rating_count,
    priceLevel: row.price_level,
    primaryType: row.primary_type,
    cuisine: row.cuisine ?? null,
    cuisineDetail: row.cuisine_detail ?? null,
    occasions: Array.isArray(row.occasions) ? row.occasions : [],
    photoUrl: row.photo_url,
    websiteUrl: row.website_url,
    bookingPlatform: row.booking_platform,
    bookingUrl: row.booking_url,
    vibes: Array.isArray(row.vibes) ? row.vibes : [],
    openingHours: Array.isArray(row.opening_hours) ? row.opening_hours : null,
    lastSyncedAt: row.last_synced_at,

    visited: row.visited,
    userScore: myReview?.score ?? null,
    notes: myReview?.notes ?? null,
    visitPhotoUrl: myReview?.photo_url ?? null,
    visitPhotoUrls: myReview?.photo_urls ?? [],
    visitedAt: myReview?.created_at ?? null,

    reviews,
    allVisitPhotos,
    addedBy: row.added_by,
    avgScore: row.avg_score,
    ratedCount: row.rated_count,

    createdAt: row.created_at,
  };
}

export type FetchRestaurantsOptions = {
  uid: string;
  groupId: string;
  /** Offset of the page to fetch, as returned in `nextCursor`. */
  pageParam?: string | null;
  filterTab?: "cravelist" | "tried";
  /** Any of these cuisines; "" matches places that don't have one yet. */
  filterCuisines?: string[];
  filterOccasion?: string | null;
  filterVibes?: string[];
  sortBy?: SortOption;
  search?: string;
  restaurantId?: number;
  /** Fetch the whole list (up to 1000) in one page, e.g. for the map. */
  all?: boolean;
};

/** A page of a Cravelist, fully assembled by the database in a single call. */
export async function fetchRestaurants({
  uid, groupId, pageParam, filterTab, filterCuisines, filterOccasion, filterVibes, sortBy, search, restaurantId, all,
}: FetchRestaurantsOptions): Promise<{ restaurants: Restaurant[]; nextCursor: string | null }> {
  if (!uid || !groupId) return { restaurants: [], nextCursor: null };

  const pageSize = all ? 1000 : 20;
  const offset = pageParam ? parseInt(pageParam, 10) : 0;

  const { data, error } = await supabase.rpc("get_group_feed", {
    p_group_id: groupId,
    p_tab: filterTab,
    p_vibes: filterVibes?.length ? filterVibes : undefined,
    p_sort: sortBy ?? "newest",
    p_limit: pageSize,
    p_offset: offset,
    p_restaurant_id: restaurantId,
    p_search: search?.trim() || undefined,
    p_cuisines: filterCuisines?.length ? filterCuisines : undefined,
    p_occasion: filterOccasion ?? undefined,
  });
  if (error) throw error;

  const rows = (data ?? []) as unknown as FeedRow[];
  return {
    restaurants: rows.map((row) => toRestaurant(row, uid)),
    nextCursor: rows.length === pageSize ? String(offset + pageSize) : null,
  };
}

/** The list tab's feed query. Shared so launch can start it before the lists load. */
export function feedQuery(uid: string, groupId: string | undefined, filters: {
  tab: "cravelist" | "tried"; cuisines: string[]; occasion: string | null; vibes: string[]; sort: SortOption;
}) {
  return infiniteQueryOptions({
    queryKey: ["restaurants", "feed", uid, groupId, filters.tab, filters.cuisines, filters.occasion, filters.vibes, filters.sort],
    queryFn: ({ pageParam }) => fetchRestaurants({
      uid, groupId: groupId ?? "", pageParam, filterTab: filters.tab, filterCuisines: filters.cuisines,
      filterOccasion: filters.occasion, filterVibes: filters.vibes, sortBy: filters.sort,
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** What the list tab shows first. */
export const DEFAULT_FEED: Parameters<typeof feedQuery>[2] = { tab: "cravelist", cuisines: [], occasion: null, vibes: [], sort: "newest" };
