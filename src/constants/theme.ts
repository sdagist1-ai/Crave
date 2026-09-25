import type { SortOption } from "../types";

/** Occasion chips, in display order. The database fills these in from Google's types
 *  and the name (private.occasions_for); members can change them. */
export const OCCASIONS = ["Brunch", "Coffee", "Drinks", "Date night", "Sweets", "Quick bites"] as const;

export const SORT_LABELS: Record<SortOption, string> = {
  newest: "Recently added",
  rating: "Google rating",
  score: "My rating",
  visited: "Recently tried",
};
