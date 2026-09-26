// Publish a live update: npm run ota -- 1.4.5 [--notes "Fix the Spin button"] [--dry-run]
//
// One command, no git steps: it publishes exactly what's on GitHub's main.
// 1. Checks your Mac matches GitHub's main exactly (Xcode's own edits under ios/ are ignored).
// 2. Sets WEB_VERSION in src/config/version.ts and builds the app.
// 3. Zips dist/, uploads it to the public `app-releases` bucket and adds a row to
//    `app_updates` (min_build = MIN_NATIVE_BUILD from src/config/version.ts).
// 4. Commits and pushes the version bump to main.
// Apps on that build or newer download it and switch over the next time they're
// backgrounded. See docs/LIVE_UPDATES.md.
//
// Needs SUPABASE_SERVICE_ROLE_KEY (the "ota_publish" secret key) in .env.local.
// --skip-git-check publishes whatever is on disk (emergencies only).
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
const version = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--notes");
const dryRun = args.includes("--dry-run");
const skipGitCheck = args.includes("--skip-git-check");
const notesAt = args.indexOf("--notes");
const notes = notesAt >= 0 ? args[notesAt + 1] : null;

const versionFile = path.resolve("src/config/version.ts");
const source = fs.readFileSync(versionFile, "utf8");
let versionWritten = false;

const fail = (msg) => {
  if (versionWritten) fs.writeFileSync(versionFile, source); // leave nothing half-done
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};
const git = (cmd) => execSync(`git ${cmd}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trimEnd();
const compare = (a, b) => {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
};

/** Why this checkout isn't exactly GitHub's main, or null if it is. */
function gitProblem() {
  const branch = git("rev-parse --abbrev-ref HEAD");
  if (branch !== "main") return `You're on "${branch}". Run: git checkout main && git pull`;
  try { git("fetch --quiet origin main"); } catch { return "Couldn't reach GitHub to check you're up to date. Check your connection."; }
  const behind = Number(git("rev-list --count HEAD..origin/main"));
  if (behind) return `Your Mac is ${behind} commit(s) behind GitHub. Run: git pull --no-edit`;
  const ahead = Number(git("rev-list --count origin/main..HEAD"));
  if (ahead) return `You have ${ahead} commit(s) that aren't on GitHub. Run: git push (or undo them), so the release matches main.`;
  // Changes that would end up in the bundle. Xcode edits files under ios/ on its own.
  // Edited files anywhere (they could change the build), and new files where the build
  // picks them up. Stray new files elsewhere (a screenshot) don't ship, so they're fine.
  const dirty = git("status --porcelain").split("\n").filter((line) => {
    const file = line.slice(3);
    if (!line || file.startsWith("ios/")) return false;
    return line.startsWith("??") ? /^(src|public)\//.test(file) : true;
  });
  if (dirty.length) {
    return `These changes aren't on GitHub, so they'd ship without review:\n  ${dirty.join("\n  ")}\n` +
      "Merge them through a PR first, or undo them (git checkout -- <file>, or delete a new file).";
  }
  return null;
}

if (!version || !/^\d+(\.\d+){1,3}$/.test(version)) fail("Give a version: npm run ota -- 1.4.5");

if (!skipGitCheck) {
  const problem = gitProblem();
  if (problem && !dryRun) fail(problem);
  if (problem) console.warn(`⚠ ${problem}`);
} else {
  console.warn("⚠ --skip-git-check: publishing whatever is on disk.");
}

const current = source.match(/WEB_VERSION = "([^"]+)"/)?.[1];
const minBuild = Number(source.match(/MIN_NATIVE_BUILD = (\d+)/)?.[1]);
if (!current || !minBuild) fail("Couldn't read WEB_VERSION / MIN_NATIVE_BUILD from src/config/version.ts");
if (compare(version, current) <= 0) fail(`${version} must be higher than the current version (${current}). Apps only move forward.`);

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) fail("VITE_SUPABASE_URL is missing (.env)");
if (!serviceKey && !dryRun) fail("SUPABASE_SERVICE_ROLE_KEY is missing. Add the ota_publish key to .env.local.");

console.log(`\n🚀 Live update ${current} → ${version} (for build ${minBuild} and newer)${dryRun ? " [dry run]" : ""}`);

fs.writeFileSync(versionFile, source.replace(/WEB_VERSION = "[^"]+"/, `WEB_VERSION = "${version}"`));
versionWritten = true;
try {
  console.log("📦 Building…");
  execSync("npm run build", { stdio: "inherit" });
} catch {
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
if (insertError) {
  await supabase.storage.from("app-releases").remove([objectName]);
  fail(`Couldn't record the release (nothing was published): ${insertError.message}`);
}
fs.unlinkSync(zipPath);

console.log(`\n✓ ${version} is live. Apps on build ${minBuild}+ pick it up the next time they open,
  and switch to it the time after they're backgrounded.
  To pull it: set is_active = false on its app_updates row (Supabase table editor).`);

// Save the new version on GitHub, so main (and the next App Store build) match what's live.
try {
  git(`commit -m "Live update ${version}" -- src/config/version.ts`);
  try {
    git("push origin main");
  } catch {
    git("pull --no-rebase --no-edit origin main"); // someone merged meanwhile
    git("push origin main");
  }
  console.log(`📝 Saved WEB_VERSION = "${version}" to GitHub (main).\n`);
} catch (err) {
  console.warn(`\n⚠ It's live, but saving the version to GitHub failed:\n${String(err.stderr || err.message).trim()}\n` +
    `Run: git add src/config/version.ts && git commit -m "Live update ${version}" && git pull --no-edit && git push\n`);
}
