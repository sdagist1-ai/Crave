// Get the Mac ready for an App Store build, in one go: npm run ios
//
// 1. Throws away Xcode's own edits to the project file (they block the pull).
// 2. Pulls main, installs packages, builds the web app and copies it into ios/.
// 3. Shows the version and build number, then opens Xcode.
// From there: check App + CraveShare show that build under General, then Product → Archive
// and upload. See CLAUDE.md → "Native change".
import { execSync } from "node:child_process";
import fs from "node:fs";

const run = (cmd) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};
const fail = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
if (branch !== "main") fail(`You're on "${branch}". Run: git checkout main`);

run("git checkout -- ios/App/App.xcodeproj");
run("git pull --no-edit origin main");
run("npm install");
run("npm run build");
run("npx cap sync ios");

const project = fs.readFileSync("ios/App/App.xcodeproj/project.pbxproj", "utf8");
const builds = [...new Set([...project.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((m) => m[1]))];
const marketing = project.match(/MARKETING_VERSION = ([\d.]+);/)?.[1];
if (builds.length !== 1) fail(`The project file has mixed build numbers (${builds.join(", ")}). Fix that before archiving.`);
console.log(`\n✓ Ready to archive ${marketing} (${builds[0]}).`);
console.log("  In Xcode: App and CraveShare should both show that build under General,");
console.log("  then Product → Archive, and upload.\n");

run("npx cap open ios");
