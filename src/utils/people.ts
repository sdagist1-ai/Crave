import type { Profile } from "../types";

export function initials(p: Pick<Profile, "first_name" | "last_name"> | null | undefined) {
  const first = p?.first_name?.trim()?.[0] ?? "";
  const last = p?.last_name?.trim()?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

export function displayName(p: Pick<Profile, "first_name" | "last_name"> | null | undefined, fallback = "Someone") {
  return p?.first_name?.trim() || fallback;
}
