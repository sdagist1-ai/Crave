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
