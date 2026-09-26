// Renders App Store screenshots from device screenshots and the copy in slides.json.
//   node render.mjs            iPhone 6.9" (1290×2796) from screens/*        → app-store-assets/v2/
//   node render.mjs --ipad     iPad 13"    (2064×2752) from screens/ipad/*   → app-store-assets/v2/ipad/
//   node render.mjs --6.5      iPhone 6.5" (1284×2778) from screens/*        → app-store-assets/v2/iphone-6.5/
//   node render.mjs --phones   just the framed iPhone, 720px wide WebP        → site/img/<screen>.webp
// Add screen names (e.g. 3-spin) to render only those slides.
// Needs Playwright with a Chromium: `npm i -D playwright && npx playwright install chromium`.
import { chromium } from "playwright";
import { readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const args = process.argv.slice(2);
const ipad = args.includes("--ipad");
const small = !ipad && args.includes("--6.5");
const phones = !ipad && args.includes("--phones");
const out = resolve(root, "app-store-assets/v2", ipad ? "ipad" : small ? "iphone-6.5" : "");
const shots = resolve(here, "screens", ipad ? "ipad" : "");
mkdirSync(out, { recursive: true });
const font = (pkg, file) => pathToFileURL(resolve(root, "node_modules/@fontsource-variable", pkg, "files", file)).href;
const slides = JSON.parse(readFileSync(resolve(here, "slides.json"), "utf8"));
const screens = readdirSync(shots);
const only = args.filter((a) => !a.startsWith("--"));

// Everything below is laid out for the iPhone canvas; the iPad one scales it by `k`
// and swaps the phone frame for a tablet frame.
const W = ipad ? 2064 : small ? 1284 : 1290, H = ipad ? 2752 : small ? 2778 : 2796, k = ipad ? 1.35 : 1;
const device = ipad
  ? { width: 1560, pad: 30, radius: 90, inner: 62, island: false }
  : { width: 980, pad: 26, radius: 150, inner: 124, island: true };
const html = (s, src) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Bricolage; src: url(${font("bricolage-grotesque", "bricolage-grotesque-latin-wght-normal.woff2")}); font-weight: 200 800; }
@font-face { font-family: Geist; src: url(${font("geist", "geist-latin-wght-normal.woff2")}); font-weight: 100 900; }
@font-face { font-family: GeistMono; src: url(${font("geist-mono", "geist-mono-latin-wght-normal.woff2")}); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; }
html { zoom: 1; } .k { zoom: ${k}; }
body { width: ${W}px; height: ${H}px; overflow: hidden; position: relative; background: #F8FAFC; font-family: Geist; color: #0F172A; }
.glow { position: absolute; inset: -400px -300px auto; height: 1500px; background: radial-gradient(closest-side, rgba(255,69,58,.16), rgba(255,69,58,0)); }
.ring { position: absolute; border: 3px dashed #CBD5E1; border-radius: 50%; }
.copy { position: absolute; top: 150px; left: 0; right: 0; text-align: center; padding: 0 90px; }
.eyebrow { display: inline-block; font-family: GeistMono; font-size: 34px; letter-spacing: .16em; color: #C2261C; background: #FFE4E1; padding: 14px 30px; border-radius: 999px; }
h1 { text-wrap: balance; font-family: Bricolage; font-weight: 800; font-size: 142px; line-height: .98; letter-spacing: -.035em; margin-top: 44px; }
p { text-wrap: balance; font-size: 50px; line-height: 1.3; color: #64748B; margin: 36px auto 0; max-width: 1000px; }
.phone { position: absolute; left: 50%; top: 720px; width: ${device.width}px; transform: translateX(-50%); padding: ${device.pad}px; border-radius: ${device.radius}px; background: #0F172A;
  box-shadow: 0 80px 160px rgba(15,23,42,.28), inset 0 0 0 6px #334155; }
.screen { position: relative; border-radius: ${device.inner}px; overflow: hidden; background: #fff; }
.screen img { height: auto !important; }
.screen img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
.status { position: absolute; inset: 0 0 auto; height: ${ipad ? "2.2%" : "5.2%"}; display: flex; align-items: center; justify-content: space-between; padding: ${ipad ? "0.6% 4% 0 5%" : "1.4% 9% 0 11%"}; font: 600 ${ipad ? 34 : 46}px Geist; }
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
<div class="copy k"><span class="eyebrow">${s.eyebrow}</span><h1>${s.title}</h1><p>${s.sub}</p></div>
<div class="phone"><div class="screen">
  <img id="shot" src="${src}">
  ${(s.patches ?? []).map((p, i) => `<div class="patch" data-i="${i}">${p.text}</div>`).join("")}
  <div class="status ${s.status ?? ""}" id="status"><span>9:41</span>
    <svg width="150" height="40" viewBox="0 0 150 40"><g fill="#0F172A"><rect x="0" y="26" width="9" height="12" rx="2"/><rect x="13" y="19" width="9" height="19" rx="2"/><rect x="26" y="11" width="9" height="27" rx="2"/><rect x="39" y="3" width="9" height="35" rx="2"/>
    <path d="M75 36l-6-7a9 9 0 0112 0zM63 22a17 17 0 0124 0l-4 4a11 11 0 00-16 0zM57 15a26 26 0 0136 0l-4 4a20 20 0 00-28 0z"/>
    <rect x="102" y="6" width="40" height="28" rx="8" fill="none" stroke="#0F172A" stroke-width="3" opacity=".45"/><rect x="106" y="10" width="32" height="20" rx="5"/><rect x="144" y="15" width="4" height="10" rx="2" opacity=".45"/></g></svg></div>
  ${device.island ? '<div class="island"></div>' : ""}
</div></div>
<div class="chip k ${s.chipAt}">${s.chip}</div>
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
  if (!file) { console.log(`skip ${s.file}: no ${ipad ? "screens/ipad" : "screens"}/${s.screen}.*`); continue; }
  // Patches, chip positions and status style are measured per device; iPad ones go under "ipad".
  const slide = ipad ? { ...s, patches: undefined, chipY: undefined, status: undefined, ...(s.ipad ?? {}) } : s;
  writeFileSync(tmp, html(slide, pathToFileURL(resolve(shots, file)).href));
  await page.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  // Sit the phone just below the copy (headlines can run to two lines); chips follow it.
  // chipY (optional, per slide) is the chip's offset from the top of the phone.
  await page.evaluate((chipY) => {
    const top = document.querySelector(".copy").getBoundingClientRect().bottom + 80;
    document.querySelector(".phone").style.top = `${top}px`;
    const chip = document.querySelector(".chip");
    chip.style.top = `${top + (chipY ?? (chip.classList.contains("left") ? 700 : 240))}px`;
  }, slide.chipY);
  // Cover the real status bar with a clean 9:41 one in the screenshot's own background colour.
  // Patches replace text in the screenshot (e.g. a name): each covers a box, in the
  // screenshot's own pixels, with the colour just inside its top-left corner (or blurs it).
  await page.evaluate(async (patches) => {
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
      if (p.blur) el.style.background = "transparent";
    });
    // "blur" patches smudge the screenshot itself instead of painting over it (text on a photo).
    const blurs = patches.filter((p) => p.blur);
    if (blurs.length) {
      for (const p of blurs) {
        ctx.save();
        ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
        ctx.fillStyle = at(p.x + p.w / 2, p.y + p.h + 4); // the blur fades out at the edges
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.filter = `blur(${p.blur}px)`;
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      }
      img.src = c.toDataURL();
      await img.decode();
    }
  }, slide.patches ?? []);
  if (phones) {
    // Transparent PNG of the frame only, shrunk and re-encoded as WebP in the page.
    await page.evaluate(() => {
      document.body.style.background = "transparent";
      document.querySelectorAll(".glow,.ring,.copy,.chip").forEach((el) => el.remove());
      document.querySelector(".phone").style.boxShadow = "inset 0 0 0 6px #334155";
    });
    const png = await page.locator(".phone").screenshot({ omitBackground: true });
    const webp = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
      const c = document.createElement("canvas"); c.width = 720; c.height = Math.round(img.height * 720 / img.width);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/webp", 0.86).split(",")[1];
    }, png.toString("base64"));
    mkdirSync(resolve(root, "site/img"), { recursive: true });
    writeFileSync(resolve(root, "site/img", `${s.screen}.webp`), Buffer.from(webp, "base64"));
  } else {
    await page.screenshot({ path: resolve(out, `${s.file}_${W}x${H}.png`) });
  }
  console.log("wrote", s.file);
}
rmSync(tmp, { force: true });
await browser.close();
