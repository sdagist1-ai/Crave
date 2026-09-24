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
  score: number | null;
  notes: string | null;
  photo_url: string | null;
  photo_urls?: string[] | null;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  share_code: string | null;
  created_by: string | null;
  created_at: string;
  avatar_url?: string | null;
  group_members?: { profiles: Profile }[];
};

export type Restaurant = {
  id: number;
  placeId: string;
  groupId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;
  primaryType: string | null;
  photoUrl: string | null;
  websiteUrl: string | null;
  bookingPlatform: string | null;
  bookingUrl: string | null;
  vibes: string[];
  openingHours: string[] | null;
  lastSyncedAt: string | null;

  // Asynchronous Dual-Rating Data
  visited: boolean;
  notes: string | null;
  userScore: number | null;
  visitPhotoUrl: string | null;
  visitPhotoUrls: string[];
  visitedAt: string | null;

  reviews: Review[];
  allVisitPhotos?: { url: string; authorId: string; authorName?: string }[];
  addedBy?: Profile | null;
  
  createdAt: string;
};

export type TabId = "list" | "profile" | "calendar" | "spin" | "passport";

export type SortOption = "newest" | "rating" | "score" | "visited";
