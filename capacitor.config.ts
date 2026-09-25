import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.carldagist.crave",
  appName: "Crave",
  webDir: "dist",
  plugins: {
    // Live updates, self-hosted: src/lib/liveUpdate.ts checks Supabase for a newer web
    // bundle and applies it the next time the app is backgrounded. Nothing talks to
    // Capgo's cloud: automatic updates and stats are off.
    CapacitorUpdater: {
      autoUpdate: false,
      statsUrl: "",
      // A new bundle must call notifyAppReady within this time or it's rolled back.
      appReadyTimeout: 10000,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      // A new App Store build starts from its own bundle, not an older live update.
      resetWhenUpdate: true,
    },
  },
};

export default config;
