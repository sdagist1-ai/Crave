import type { SortOption } from "../types";

/** Cuisine groups, alphabetical (private.cuisine_groups() in the database). The
 *  specific cuisine a place was guessed as (Thai, Nigerian…) is kept as cuisineDetail. */
export const CUISINES = [
  "African", "American", "Asian", "Caribbean", "European", "Latin American",
  "Mediterranean & Middle Eastern", "South Asian",
] as const;

/** Occasion chips, in display order. The database fills these in from Google's types
 *  and the name (private.occasions_for); members can change them. */
export const OCCASIONS = ["Brunch", "Coffee", "Drinks", "Date night", "Sweets", "Quick bites"] as const;

export const SORT_LABELS: Record<SortOption, string> = {
  newest: "Recently added",
  rating: "Google rating",
  score: "My rating",
  visited: "Recently tried",
};

/** The sorts each tab offers, default first. A Cravelist has no ratings of yours yet;
 *  Tried places are about how and when you went. */
export const TAB_SORTS: Record<"cravelist" | "tried", SortOption[]> = {
  cravelist: ["newest", "rating"],
  tried: ["visited", "score"],
};
