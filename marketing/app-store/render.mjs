// Renders App Store screenshots (1290×2796, accepted for the 6.9" iPhone slot)
// from phone screenshots in ./screens and the copy in slides.json.
//   node render.mjs            → ../../app-store-assets/v2/*.png
// Needs Playwright with a Chromium: `npm i -D playwright && npx playwright install chromium`.
import { chromium } from "playwright";
import { readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const out = resolve(root, "app-store-assets/v2");
mkdirSync(out, { recursive: true });
const font = (pkg, file) => pathToFileURL(resolve(root, "node_modules/@fontsource-variable", pkg, "files", file)).href;
const slides = JSON.parse(readFileSync(resolve(here, "slides.json"), "utf8"));
const screens = readdirSync(resolve(here, "screens"));
const only = process.argv.slice(2);

const W = 1290, H = 2796;
const html = (s, src) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Bricolage; src: url(${font("bricolage-grotesque", "bricolage-grotesque-latin-wght-normal.woff2")}); font-weight: 200 800; }
@font-face { font-family: Geist; src: url(${font("geist", "geist-latin-wght-normal.woff2")}); font-weight: 100 900; }
@font-face { font-family: GeistMono; src: url(${font("geist-mono", "geist-mono-latin-wght-normal.woff2")}); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; }
body { width: ${W}px; height: ${H}px; overflow: hidden; position: relative; background: #F8FAFC; font-family: Geist; color: #0F172A; }
.glow { position: absolute; inset: -400px -300px auto; height: 1500px; background: radial-gradient(closest-side, rgba(255,69,58,.16), rgba(255,69,58,0)); }
.ring { position: absolute; border: 3px dashed #CBD5E1; border-radius: 50%; }
.copy { position: absolute; top: 150px; left: 0; right: 0; text-align: center; padding: 0 90px; }
.eyebrow { display: inline-block; font-family: GeistMono; font-size: 34px; letter-spacing: .16em; color: #C2261C; background: #FFE4E1; padding: 14px 30px; border-radius: 999px; }
h1 { text-wrap: balance; font-family: Bricolage; font-weight: 800; font-size: 142px; line-height: .98; letter-spacing: -.035em; margin-top: 44px; }
p { text-wrap: balance; font-size: 50px; line-height: 1.3; color: #64748B; margin: 36px auto 0; max-width: 1000px; }
.phone { position: absolute; left: 50%; top: 720px; width: 980px; transform: translateX(-50%); padding: 26px; border-radius: 150px; background: #0F172A;
  box-shadow: 0 80px 160px rgba(15,23,42,.28), inset 0 0 0 6px #334155; }
.screen { position: relative; border-radius: 124px; overflow: hidden; aspect-ratio: 924 / 2000; background: #fff; }
.screen img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
.status { position: absolute; inset: 0 0 auto; height: 5.2%; display: flex; align-items: center; justify-content: space-between; padding: 1.4% 9% 0 11%; font: 600 46px Geist; }
.status.photo { color: #fff; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); background: rgba(0,0,0,.08) !important; }
.status.photo g { fill: #fff; } .status.photo rect[fill=none] { stroke: #fff; }
.patch { position: absolute; display: flex; align-items: center; font-family: Geist; white-space: nowrap; }
.island { position: absolute; top: 2.1%; left: 50%; transform: translateX(-50%); width: 31%; height: 3.3%; border-radius: 999px; background: #000; }
.chip { position: absolute; top: 960px; display: flex; align-items: center; gap: 16px; background: #fff; border-radius: 999px; padding: 30px 44px; font: 700 46px Geist;
  box-shadow: 0 30px 70px rgba(15,23,42,.18); border: 2px solid #E2E8F0; white-space: nowrap; }
.chip.right { right: 70px; transform: rotate(3deg); } .chip.left { left: 70px; top: 1420px; transform: rotate(-3deg); }
</style></head><body>
<div class="glow"></div>
<div class="ring" style="width:1500px;height:1500px;left:-105px;top:1320px"></div>
<div class="copy"><span class="eyebrow">${s.eyebrow}</span><h1>${s.title}</h1><p>${s.sub}</p></div>
<div class="phone"><div class="screen">
  <img id="shot" src="${src}">
  ${(s.patches ?? []).map((p, i) => `<div class="patch" data-i="${i}">${p.text}</div>`).join("")}
  <div class="status ${s.status ?? ""}" id="status"><span>9:41</span>
    <svg width="150" height="40" viewBox="0 0 150 40"><g fill="#0F172A"><rect x="0" y="26" width="9" height="12" rx="2"/><rect x="13" y="19" width="9" height="19" rx="2"/><rect x="26" y="11" width="9" height="27" rx="2"/><rect x="39" y="3" width="9" height="35" rx="2"/>
    <path d="M75 36l-6-7a9 9 0 0112 0zM63 22a17 17 0 0124 0l-4 4a11 11 0 00-16 0zM57 15a26 26 0 0136 0l-4 4a20 20 0 00-28 0z"/>
    <rect x="102" y="6" width="40" height="28" rx="8" fill="none" stroke="#0F172A" stroke-width="3" opacity=".45"/><rect x="106" y="10" width="32" height="20" rx="5"/><rect x="144" y="15" width="4" height="10" rx="2" opacity=".45"/></g></svg></div>
  <div class="island"></div>
</div></div>
<div class="chip ${s.chipAt}">${s.chip}</div>
</body></html>`;

// Loaded from a file next to the screenshots so fonts and images resolve, and
// file access lets the canvas read the screenshot's background colour.
const browser = await chromium.launch({
  args: ["--allow-file-access-from-files"],
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
});
const tmp = resolve(here, ".slide.html");
const page = await browser.newPage({ viewport: { width: W, height: H } });
for (const s of slides) {
  if (only.length && !only.includes(s.screen)) continue;
  const file = screens.find((f) => f.startsWith(s.screen + "."));
  if (!file) { console.log(`skip ${s.file}: no screens/${s.screen}.*`); continue; }
  writeFileSync(tmp, html(s, pathToFileURL(resolve(here, "screens", file)).href));
  await page.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  // Sit the phone just below the copy (headlines can run to two lines); chips follow it.
  // chipY (optional, per slide) is the chip's offset from the top of the phone.
  await page.evaluate((chipY) => {
    const top = document.querySelector(".copy").getBoundingClientRect().bottom + 80;
    document.querySelector(".phone").style.top = `${top}px`;
    const chip = document.querySelector(".chip");
    chip.style.top = `${top + (chipY ?? (chip.classList.contains("left") ? 700 : 240))}px`;
  }, s.chipY);
  // Cover the real status bar with a clean 9:41 one in the screenshot's own background colour.
  // Patches replace text in the screenshot (e.g. a name): each covers a box, in the
  // screenshot's own pixels, with the colour just inside its top-left corner.
  await page.evaluate((patches) => {
    const img = document.getElementById("shot"), c = document.createElement("canvas");
    const W = img.naturalWidth, H = img.naturalHeight, k = img.clientWidth / W;
    c.width = W; c.height = H;
    const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0);
    const at = (x, y) => { const [r, g, b] = ctx.getImageData(x, y, 1, 1).data; return `rgb(${r},${g},${b})`; };
    document.getElementById("status").style.background = at(8, 8);
    document.querySelectorAll(".patch").forEach((el) => {
      const p = patches[+el.dataset.i];
      Object.assign(el.style, {
        left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`, width: `${(p.w / W) * 100}%`, height: `${(p.h / H) * 100}%`,
        background: at(p.x + 1, p.y + 1), color: p.color, fontSize: `${p.size * k}px`, fontWeight: p.weight ?? 400,
        paddingLeft: `${(p.pad ?? 5) * k}px`,
      });
    });
  }, s.patches ?? []);
  await page.screenshot({ path: resolve(out, `${s.file}_1290x2796.png`) });
  console.log("wrote", s.file);
}
rmSync(tmp, { force: true });
await browser.close();
