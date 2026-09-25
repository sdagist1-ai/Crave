import { useEffect, useState } from "react";

/**
 * Invite links: https://www.cravelist.us/join/ABC123 (a Universal Link, so iOS opens
 * the app when it's installed) or craveapp://join/ABC123 (the join page's fallback
 * button). An invite that arrives before sign-in, or before the app is ready, is
 * kept here and joined as soon as someone is signed in.
 */
export const INVITE_BASE = "https://www.cravelist.us/join/";

const KEY = "crave.pendingInvite";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CODE = /^[A-Z0-9]{6}$/;
const listeners = new Set<() => void>();

export function inviteLink(code: string) {
  return INVITE_BASE + code;
}

/** The invite code in a Crave invite link, or null. */
export function parseInviteLink(link: string): string | null {
  try {
    const url = new URL(link);
    const web = /^(www\.)?cravelist\.us$/i.test(url.hostname) && url.protocol === "https:";
    const app = url.protocol === "craveapp:" && url.hostname === "join";
    if (!web && !app) return null;
    // https://…/join/CODE → "/join/CODE"; craveapp://join/CODE → "/CODE"
    const last = url.pathname.split("/").filter(Boolean);
    if (web && last[0] !== "join") return null;
    return normalize(last[last.length - 1] ?? url.searchParams.get("code") ?? "");
  } catch {
    return null;
  }
}

/** Finds an invite code in pasted text: a link, "Crave invite: …", "code: ABC123", or just the code. */
export function findInviteCode(text: string): string | null {
  for (const word of text.split(/\s+/)) {
    const fromLink = parseInviteLink(word);
    if (fromLink) return fromLink;
  }
  // Codes can be all letters, so only trust a bare code when it's the whole text or
  // labelled as one ("Join with code: ABC123") — never any 6-letter word.
  const labelled = text.match(/\b(?:code|invite)\b[:\s]+([A-Za-z0-9]{6})\b/i)?.[1];
  return normalize(labelled ?? text);
}

function normalize(code: string) {
  const c = code.trim().toUpperCase();
  return CODE.test(c) ? c : null;
}

export function receiveInvite(code: string) {
  try { localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() })); } catch { /* storage unavailable */ }
  listeners.forEach((notify) => notify());
}

export function pendingInvite(): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { code?: string; at?: number } | null;
    if (!saved?.code || !saved.at || Date.now() - saved.at > MAX_AGE_MS) return null;
    return normalize(saved.code);
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  listeners.forEach((notify) => notify());
}

/** The invite waiting to be joined, updated as invites arrive or are used. */
export function usePendingInvite() {
  const [code, setCode] = useState(pendingInvite);
  useEffect(() => {
    const update = () => setCode(pendingInvite());
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);
  return code;
}
