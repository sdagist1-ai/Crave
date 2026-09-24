import type { SortOption } from "../types";

/** Category chips. `id` is what get_group_feed matches on (private.matches_category). */
export const CATEGORIES = [
  { id: "Restaurants", label: "Restaurants" },
  { id: "Breakfast & Brunch", label: "Breakfast" },
  { id: "Coffee & Tea", label: "Coffee" },
  { id: "Bars", label: "Bars" },
  { id: "Bakeries", label: "Bakeries" },
  { id: "Ice Cream & Dessert", label: "Dessert" },
] as const;

export const VIBE_OPTIONS = ["Casual", "Elegant"] as const;

export const SORT_LABELS: Record<SortOption, string> = {
  newest: "Recently added",
  rating: "Google rating",
  score: "My rating",
  visited: "Recently tried",
};
