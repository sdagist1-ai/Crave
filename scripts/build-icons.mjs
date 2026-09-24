// Bundles every Iconify icon referenced in src/ into src/lib/iconData.json so the
// app never fetches icons from api.iconify.design at runtime.
// Runs automatically before `npm run build` / `npm run dev`.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getIcons } from "@iconify/utils";

const SRC = "src";
const OUT = "src/lib/iconData.json";
const PREFIXES = ["solar", "ph", "mdi", "fluent-emoji"];
const ICON_RE = new RegExp(`["'\`](${PREFIXES.join("|")}):([a-z0-9-]+)["'\`]`, "g");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(tsx?|jsx?)$/.test(name) ? [path] : [];
  });
}

const wanted = new Map(PREFIXES.map((p) => [p, new Set()]));
for (const file of walk(SRC)) {
  for (const [, prefix, name] of readFileSync(file, "utf8").matchAll(ICON_RE)) {
    wanted.get(prefix).add(name);
  }
}

const collections = [];
let missing = 0;
for (const [prefix, names] of wanted) {
  if (names.size === 0) continue;
  const set = JSON.parse(readFileSync(`node_modules/@iconify-json/${prefix}/icons.json`, "utf8"));
  const subset = getIcons(set, [...names]);
  const found = new Set([...Object.keys(subset?.icons ?? {}), ...Object.keys(subset?.aliases ?? {})]);
  for (const name of names) {
    if (!found.has(name)) {
      console.warn(`[icons] ${prefix}:${name} not found in @iconify-json/${prefix}`);
      missing++;
    }
  }
  if (subset) collections.push(subset);
}

writeFileSync(OUT, JSON.stringify(collections));
const total = [...wanted.values()].reduce((n, s) => n + s.size, 0);
console.log(`[icons] bundled ${total - missing} icons into ${OUT}`);
if (missing) process.exitCode = 1;
