import type { SortOption } from "../types";

/** Cuisine groups, in display order (private.cuisine_groups() in the database). The
 *  specific cuisine a place was guessed as (Thai, Nigerian…) is kept as cuisineDetail. */
export const CUISINES = [
  "Caribbean", "Latin American", "African", "Asian", "South Asian",
  "Mediterranean & Middle Eastern", "European", "American",
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
