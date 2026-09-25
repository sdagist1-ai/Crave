import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { supabase } from "./supabase";
import { WEB_VERSION } from "../config/version";

// Live updates: new web code without an App Store review.
//
// On launch and when the app comes back to the foreground, ask Supabase for the newest
// active release this App Store build can run (min_build <= our build). If it's newer
// than the running code, download it in the background and queue it with `next()`: it
// takes over the next time the app is backgrounded, so nobody is interrupted mid-tap.
//
// Safety nets:
// - The plugin rolls back a bundle that doesn't call notifyAppReady within 10 s.
// - A bundle that crashes on screen is blacklisted on this device and dropped
//   (see reportCrashAndRollBack, used by the error boundary).
// - A new App Store build starts from its own code (resetWhenUpdate).
//
// Publishing: `npm run ota -- 1.4.1` (scripts/deploy-ota.mjs). See docs/LIVE_UPDATES.md.

const BLACKLIST_KEY = "crave_ota_blacklist";

/** "1.4.10" > "1.4.9" */
export function compareVersions(a: string, b: string) {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

function blacklist(): string[] {
  try { return JSON.parse(localStorage.getItem(BLACKLIST_KEY) ?? "[]"); } catch { return []; }
}

let checking = false;
let reported = false;

const describe = (err: unknown) =>
  err instanceof Error ? `${err.name}: ${err.message}`
  : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message)
  : String(err);

/** A failed check, recorded once per launch so a broken updater shows up in Supabase. */
async function reportCheckFailure(stage: string, err: unknown) {
  if (reported) return;
  reported = true;
  try {
    await supabase.from("ota_crash_logs").insert({
      version: WEB_VERSION,
      build: parseInt((await App.getInfo()).build, 10) || null,
      error_message: `update check failed at ${stage}: ${describe(err)}`.slice(0, 1000),
    });
  } catch { /* offline */ }
}

async function checkForUpdate() {
  if (checking) return;
  checking = true;
  let stage = "lookup";
  try {
    const build = parseInt((await App.getInfo()).build, 10) || 0;
    const { data: release, error } = await supabase
      .from("app_updates")
      .select("version, zip_url, checksum")
      .eq("is_active", true)
      .lte("min_build", build)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !release) return;
    if (compareVersions(release.version, WEB_VERSION) <= 0) return;
    if (blacklist().includes(release.version)) return;

    // Already downloaded (e.g. queued last time)? Otherwise fetch it.
    stage = "list";
    const { bundles } = await CapacitorUpdater.list();
    stage = "download";
    const bundle = bundles.find((b) => b.version === release.version && b.status !== "error")
      ?? await CapacitorUpdater.download({
        url: release.zip_url,
        version: release.version,
        ...(release.checksum ? { checksum: release.checksum } : {}),
      });
    stage = "next";
    await CapacitorUpdater.next({ id: bundle.id });
  } catch (err) {
    console.warn(`Live update check failed at ${stage}`, err);
    void reportCheckFailure(stage, err);
  } finally {
    checking = false;
  }
}

let started = false;

/** Call once the app has rendered: confirms this bundle works, then looks for a newer one. */
export function startLiveUpdates() {
  if (started || !Capacitor.isNativePlatform()) return;
  started = true;
  CapacitorUpdater.notifyAppReady().catch(() => {});
  void checkForUpdate();
  App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) void checkForUpdate();
  });
}

/**
 * The app crashed on screen. If it's running a live update, remember that version as
 * bad on this device, report it, and go back to the last version that worked.
 * Returns true if it rolled back (the web view reloads).
 */
export async function reportCrashAndRollBack(error: unknown) {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { bundle } = await CapacitorUpdater.current();
    const onLiveUpdate = bundle.id !== "builtin";
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    await supabase.from("ota_crash_logs").insert({
      version: WEB_VERSION,
      build: parseInt((await App.getInfo()).build, 10) || null,
      error_message: message.slice(0, 1000),
    });
    if (!onLiveUpdate) return false;
    localStorage.setItem(BLACKLIST_KEY, JSON.stringify([...new Set([...blacklist(), WEB_VERSION])]));
    await CapacitorUpdater.reset({ toLastSuccessful: true });
    return true;
  } catch {
    return false;
  }
}
