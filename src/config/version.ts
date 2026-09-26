// The web bundle's version. The App Store build ships with this, and each live update
// (npm run ota -- <version>) bumps it. Live updates only ever move to a higher version.
export const WEB_VERSION = "1.4.4";

// The oldest App Store build (CFBundleVersion) this code runs on. Bump it when you add
// or change a native plugin, so older installs don't receive code that needs it.
// Build 9 is the first where the live-update plugin actually loads (7 and 8 had it
// linked but not registered; see ios/App/App/MainViewController.swift).
export const MIN_NATIVE_BUILD = 9;
