import { useEffect } from "react";

/**
 * A place shared into Crave from another app (Apple Maps, Google Maps…).
 * The share extension opens craveapp://share?url=…&text=…; the deep-link
 * handler parks it here until the signed-in app is ready to show it.
 */
export type SharedPlace = { url?: string; text?: string };

let pending: SharedPlace | null = null;
const listeners = new Set<() => void>();

export function parseShareLink(link: string): SharedPlace | null {
  try {
    const url = new URL(link);
    if (url.protocol !== "craveapp:" || url.hostname !== "share") return null;
    const shared = { url: url.searchParams.get("url") ?? undefined, text: url.searchParams.get("text") ?? undefined };
    return shared.url || shared.text ? shared : null;
  } catch {
    return null;
  }
}

export function receiveShare(shared: SharedPlace) {
  pending = shared;
  listeners.forEach((notify) => notify());
}

/** Calls `onShare` with each shared place (including one that arrived before mounting). */
export function useIncomingShare(onShare: (shared: SharedPlace) => void) {
  useEffect(() => {
    const deliver = () => {
      if (!pending) return;
      const shared = pending;
      pending = null;
      onShare(shared);
    };
    deliver();
    listeners.add(deliver);
    return () => { listeners.delete(deliver); };
  }, [onShare]);
}

// End-to-end tests can't fire the native "app opened from link" event.
if (import.meta.env.VITE_E2E_HOOKS) (window as unknown as { __receiveShare: typeof receiveShare }).__receiveShare = receiveShare;
