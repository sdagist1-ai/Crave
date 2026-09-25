import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

/**
 * Storage shared with Crave's share extension through an iOS App Group
 * (native plugin: ios/App/App/SharedStorePlugin.swift). The Supabase session
 * lives here so "Share → Crave" in Apple Maps / Google Maps can save a place
 * while signed in. Both sides read the session from this one place, so a token
 * refreshed by either is picked up by the other.
 */
interface SharedStorePlugin {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

const SharedStore = registerPlugin<SharedStorePlugin>("SharedStore");

/** Keys the share extension reads (see ios/App/CraveShare/SharedStore.swift). */
export const SHARED_KEYS = {
  config: "crave.config",
  activeGroupId: "crave.activeGroupId",
} as const;

// Web (and a native shell without the plugin) keeps using Preferences.
let sharedAvailable = Capacitor.isNativePlatform();

function isUnimplemented(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "UNIMPLEMENTED";
}

async function sharedCall<T>(call: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  if (!sharedAvailable) return { ok: false };
  try {
    return { ok: true, value: await call() };
  } catch (err) {
    if (isUnimplemented(err)) sharedAvailable = false;
    else console.error("Shared storage error", err);
    return { ok: false };
  }
}

/**
 * Storage adapter for supabase-js. Reads the shared store first; sessions saved
 * before the share extension existed are in Preferences and move over on first read.
 */
export const sessionStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const shared = await sharedCall(() => SharedStore.get({ key }));
    if (shared.ok && shared.value.value != null) return shared.value.value;

    const legacy = await Preferences.get({ key }).then((r) => r.value).catch(() => null);
    if (legacy != null && shared.ok) {
      const moved = await sharedCall(() => SharedStore.set({ key, value: legacy }));
      if (moved.ok) await Preferences.remove({ key }).catch(() => {});
    }
    return legacy;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const shared = await sharedCall(() => SharedStore.set({ key, value }));
    // Keep a single copy: the shared one when it worked, Preferences otherwise.
    if (shared.ok) await Preferences.remove({ key }).catch(() => {});
    else await Preferences.set({ key, value }).catch((err) => console.error("Preferences set error", err));
  },
  removeItem: async (key: string): Promise<void> => {
    await sharedCall(() => SharedStore.remove({ key }));
    await Preferences.remove({ key }).catch(() => {});
  },
};

/** Writes a value only the share extension uses (no-op on web). */
export async function publishForShareExtension(key: string, value: string) {
  await sharedCall(() => SharedStore.set({ key, value }));
}
