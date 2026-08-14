import dayjs from "../lib/dayjs";
import { Restaurant, SortOption } from "../types";
import { VIBE_COLOR_MAP, C } from "../constants/theme";

export function getUserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getVibeColor(vibe: string): string {
  return VIBE_COLOR_MAP[vibe] || C.slate400;
}

export function formatPriceLevel(level: string | null): string {
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
  if (type === "restaurant") return "Restaurant";
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function sortRestaurants(list: Restaurant[], sort: SortOption): Restaurant[] {
  const copy = [...list];
  switch (sort) {
    case "rating":
      return copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "score":
      return copy.sort((a, b) => (b.userScore ?? 0) - (a.userScore ?? 0));
    case "visited":
      return copy.sort((a, b) => {
        if (!a.visitedAt && !b.visitedAt) return 0;
        if (!a.visitedAt) return 1;
        if (!b.visitedAt) return -1;
        return dayjs(b.visitedAt).tz(getUserTimeZone()).valueOf() - dayjs(a.visitedAt).tz(getUserTimeZone()).valueOf();
      });
    case "newest":
    default:
      return copy; // already sorted newest first from server
  }
}
