// Publish a live update: npm run ota -- 1.4.1 [--notes "Fix the Spin button"] [--dry-run]
//
// 1. Sets WEB_VERSION in src/config/version.ts and builds the app.
// 2. Zips dist/, uploads it to the public `app-releases` bucket and adds a row to
//    `app_updates` (min_build = MIN_NATIVE_BUILD from src/config/version.ts).
// 3. Apps on that build or newer download it and switch over the next time they're
//    backgrounded. See docs/LIVE_UPDATES.md.
//
// Needs SUPABASE_SERVICE_ROLE_KEY in .env.local (never commit it; *.local is ignored).
import { createClient } from "@supabase/supabase-js";
import archiver from "archiver";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

for (const file of [".env.local", ".env"]) {
  try { process.loadEnvFile(file); } catch { /* optional */ }
}

const args = process.argv.slice(2);
const version = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const notesAt = args.indexOf("--notes");
const notes = notesAt >= 0 ? args[notesAt + 1] : null;

const fail = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };
const compare = (a, b) => {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
};

if (!version || !/^\d+(\.\d+){1,3}$/.test(version)) fail("Give a version: npm run ota -- 1.4.1");

const versionFile = path.resolve("src/config/version.ts");
const source = fs.readFileSync(versionFile, "utf8");
const current = source.match(/WEB_VERSION = "([^"]+)"/)?.[1];
const minBuild = Number(source.match(/MIN_NATIVE_BUILD = (\d+)/)?.[1]);
if (!current || !minBuild) fail("Couldn't read WEB_VERSION / MIN_NATIVE_BUILD from src/config/version.ts");
if (compare(version, current) <= 0) fail(`${version} must be higher than the current version (${current}). Apps only move forward.`);

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) fail("VITE_SUPABASE_URL is missing (.env)");
if (!serviceKey && !dryRun) fail("SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local (Supabase → Project Settings → API keys).");

if (execSync("git status --porcelain", { encoding: "utf8" }).trim()) {
  console.warn("⚠ You have uncommitted changes; they'll be in this update.");
}

console.log(`\n🚀 Live update ${current} → ${version} (for build ${minBuild} and newer)${dryRun ? " [dry run]" : ""}`);

fs.writeFileSync(versionFile, source.replace(/WEB_VERSION = "[^"]+"/, `WEB_VERSION = "${version}"`));
try {
  console.log("📦 Building…");
  execSync("npm run build", { stdio: "inherit" });
} catch {
  fs.writeFileSync(versionFile, source); // put the old version back
  fail("Build failed; nothing was published.");
}

const zipPath = path.join(os.tmpdir(), `crave-${version}.zip`);
await new Promise((resolve, reject) => {
  const out = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });
  out.on("close", resolve);
  archive.on("error", reject);
  archive.pipe(out);
  archive.directory(path.resolve("dist"), false); // index.html at the zip's root
  archive.finalize();
});
const zip = fs.readFileSync(zipPath);
const checksum = createHash("sha256").update(zip).digest("hex");
console.log(`🗜  ${(zip.length / 1024 / 1024).toFixed(1)} MB, sha256 ${checksum.slice(0, 12)}…`);

if (dryRun) {
  fs.writeFileSync(versionFile, source);
  console.log(`\n✓ Dry run: built and zipped (${zipPath}). Nothing uploaded; version.ts left at ${current}.\n`);
  process.exit(0);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const objectName = `crave-${version}.zip`;
const { error: uploadError } = await supabase.storage
  .from("app-releases")
  .upload(objectName, zip, { contentType: "application/zip", upsert: false });
if (uploadError) fail(`Upload failed: ${uploadError.message}`);
const zipUrl = supabase.storage.from("app-releases").getPublicUrl(objectName).data.publicUrl;

const { error: insertError } = await supabase.from("app_updates").insert({
  version, min_build: minBuild, zip_url: zipUrl, checksum, notes,
});
if (insertError) fail(`Uploaded, but couldn't record the release: ${insertError.message}`);

fs.unlinkSync(zipPath);
console.log(`
✓ ${version} is live. Apps on build ${minBuild}+ pick it up the next time they open,
  and switch to it the time after they're backgrounded.

Next: commit src/config/version.ts (WEB_VERSION = "${version}") so the next App Store
build starts from this version.
To pull it: set is_active = false on its app_updates row (Supabase table editor).
`);
