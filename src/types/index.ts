export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export type Review = {
  id: number;
  place_id: string;
  user_id: string;
  authorName?: string;
  authorAvatar?: string | null;
  score: number | null;
  notes: string | null;
  photo_url: string | null;
  photo_urls?: string[] | null;
  created_at: string;
};

/** A Cravelist the user belongs to, with members and counts (from get_my_groups). */
export type Group = {
  id: string;
  name: string;
  share_code: string | null;
  created_by: string | null;
  created_at: string;
  avatar_url?: string | null;
  members: Profile[];
  place_count: number;
  tried_count: number;
  must_count: number;
  city_count: number;
  country_count: number;
};

export type MyStats = {
  tried: number;
  saved: number;
  avg_score: number | null;
  member_since: string | null;
};

export type Restaurant = {
  id: number;
  placeId: string;
  groupId: string;
  name: string;
  address: string;
  city: string | null;
  /** Neighbourhood-level name shown on cards, e.g. "Williamsburg" */
  area: string | null;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;
  primaryType: string | null;
  /** Cuisine group ("Asian", "African"…). Guessed on save; any member can change it. */
  cuisine: string | null;
  /** The specific cuisine within the group, when known ("Thai", "Nigerian"). */
  cuisineDetail: string | null;
  /** Brunch, Coffee, Drinks, Sweets, Quick bites (a place can have several). */
  occasions: string[];
  photoUrl: string | null;
  websiteUrl: string | null;
  bookingPlatform: string | null;
  bookingUrl: string | null;
  vibes: string[];
  openingHours: string[] | null;
  lastSyncedAt: string | null;

  // The signed-in user's own review
  visited: boolean;
  notes: string | null;
  userScore: number | null;
  visitPhotoUrl: string | null;
  visitPhotoUrls: string[];
  visitedAt: string | null;

  /** Reviews by members of this list */
  reviews: Review[];
  allVisitPhotos?: { url: string; authorId: string; authorName?: string }[];
  addedBy?: Profile | null;
  /** Average score from the list's members, and how many have scored it */
  avgScore: number | null;
  ratedCount: number;

  createdAt: string;
};

export type TabId = "list" | "passport" | "spin" | "profile";

export type SortOption = "newest" | "rating" | "score" | "visited";

/** A group average at or above this earns the MUST badge. */
export const MUST_SCORE = 9;
