// ─── Color tokens (warm rose/slate palette) ──────────────────
export const C = {
  white: "#FFFFFF",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  rose: "#FF453A",
  roseDark: "#D7392E",
  roseLight: "#FFE0DE",
  roseFaded: "#FFE0DE",
  slate900: "#0F172A",
  slate800: "#1E293B",
  slate700: "#334155",
  slate600: "#475569",
  slate500: "#64748B",
  slate400: "#94A3B8",
  slate300: "#CBD5E1",
  slate200: "#E2E8F0",
  slate100: "#F1F5F9",
  slate50: "#F8FAFC",
  amber: "#F59E0B",
  amberLight: "#FEF3C7",
  emerald: "#10B981",
  emeraldLight: "#D1FAE5",
  blue: "#3B82F6",
  blueLight: "#DBEAFE",
  purple: "#8B5CF6",
  purpleLight: "#EDE9FE",
};

export const VIBE_OPTIONS = [
  { label: "Elegant", color: "#8B5CF6", bg: "bg-purple-100 text-purple-700", activeBg: "#8B5CF6" },
  { label: "Casual", color: "#3B82F6", bg: "bg-blue-100 text-blue-700", activeBg: "#3B82F6" },
] as const;

export const VIBE_COLOR_MAP: Record<string, string> = {
  Elegant: "#8B5CF6",
  Casual: "#3B82F6",
};

export const SORT_LABELS: Record<import("../types").SortOption, string> = {
  newest: "Date Added",
  rating: "Google Rating",
  score: "My Rating",
  visited: "Date Visited",
};
