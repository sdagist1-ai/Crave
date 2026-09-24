import type { Restaurant } from "../types";

export function formatPriceLevel(level: string | null | undefined): string {
  if (!level) return "";
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: "Free",
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  };
  return map[level] || "";
}

export function formatPrimaryType(type: string | null | undefined): string {
  if (!type) return "";
  const words = type.replace(/_restaurant$/, "").split("_");
  const label = words.join(" ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "Ice cream · Brooklyn" */
export function placeSubtitle(r: Pick<Restaurant, "primaryType" | "area">): string {
  return [formatPrimaryType(r.primaryType), r.area].filter(Boolean).join(" · ");
}

/** Today's line from Google's weekday descriptions, e.g. "9 AM – 5 PM" or "Closed". */
export function todaysHours(openingHours: string[] | null | undefined): string | null {
  if (!openingHours?.length) return null;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const row = openingHours.find((d) => d.startsWith(today));
  if (!row) return null;
  return row.slice(row.indexOf(":") + 1).trim().replace(/:00/g, "").replace(/\u202f/g, " ") || null;
}

export function mapsLinks(r: Pick<Restaurant, "name" | "address">) {
  const q = encodeURIComponent(`${r.name}, ${r.address}`);
  return {
    apple: `https://maps.apple.com/?daddr=${q}`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
  };
}

/** 8.5 → "8.5", 10 → "10" (a perfect score doesn't fit as "10.0"). */
export function formatScore(n: number) {
  return n >= 10 ? "10" : n.toFixed(1);
}
