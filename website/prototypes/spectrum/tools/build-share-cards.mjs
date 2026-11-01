// Renders the link preview cards (Open Graph / Twitter, 1200x630) listed in tools/share-cards.json
// into assets/share/<id>-en.jpg and <id>-zh.jpg. Each card is a small cover for its section: the
// page's own headline set in the site's type on the page light, beside that section's Blender cover.
// The headline is read from the page itself, so a card never disagrees with its page.
// usage (from the repo root): node website/prototypes/spectrum/tools/build-share-cards.mjs [id ...]
/* global document, NodeFilter */
import { mkdirSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROTO = join(dirname(fileURLToPath(import.meta.url)), "..");
const { cards } = JSON.parse(readFileSync(join(PROTO, "tools/share-cards.json"), "utf8"));
const OUT = join(PROTO, "assets/share");
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require(require.resolve("playwright", { paths: [process.cwd(), "/usr/lib/node_modules", "/usr/local/lib/node_modules"] }))); }

const url = (path) => pathToFileURL(join(PROTO, path)).href;
const LEAD = { ink: "#0e0f14", ink3: "#4a5062", c0: "#9a3218", c1: "#6e4a00", c2: "#0a6040", c3: "#1d47b8", c4: "#5a2fc0" };

/** the page's headline markup (both languages; CSS shows one) */
function headline(source) {
  const html = readFileSync(join(PROTO, source), "utf8");
  const match = /<h1\b[^>]*>([\s\S]*?)<\/h1>/u.exec(html);
  if (!match) throw new Error(`${source} has no <h1>`);
  return match[1].replace(/<mark>/g, "<em>").replace(/<\/mark>/g, "</em>").replace(/\s+/g, " ").trim();
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function art(card) {
  const a = card.art;
  if (a.kind === "disc") return `<div class="disc"><img src="${url(a.file)}" alt=""></div>`;
  if (a.kind === "grid") return `<div class="grid">${a.files.map((f) => `<img src="${url(f)}" alt="">`).join("")}</div>`;
  return `<figure class="plate${a.wide ? " wide" : ""}"><img src="${url(a.file)}" alt="" style="object-position:${a.position ?? "50% 50%"}"></figure>`;
}

function cardHtml(card, lang) {
  const k = lang === "zh" ? 1 : 0;
  const gems = card.gems.map((g) => `<img src="${url(`assets/gems/gem-${g}.webp`)}" alt="">`).join("");
  return `<!doctype html><html lang="${lang === "zh" ? "zh-CN" : "en"}" data-lang="${lang}"><head><meta charset="utf-8">
<link rel="stylesheet" href="${url("fonts.css")}">
<style>
:root { --ink: #0e0f14; --ink-2: #2f3340; --ink-3: #4a5062; --hair: rgba(14,15,20,.16); --lead: ${LEAD[card.lead]}; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1200px; height: 630px; overflow: hidden; }
body { position: relative; background: url(${url("assets/atmos.webp")}) 30% 40% / 1500px auto no-repeat, #ccd6ec; color: var(--ink); -webkit-font-smoothing: antialiased; }
.copy { position: absolute; left: 72px; top: 64px; bottom: 56px; width: 600px; display: flex; flex-direction: column; }
.home .copy { width: 560px; }
.kicker { font-family: "Geist Mono", "Noto Sans SC", monospace; font-weight: 500; font-size: 15px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); display: flex; align-items: center; gap: 16px; white-space: nowrap; }
[data-lang="zh"] .kicker { letter-spacing: .1em; font-size: 16px; }
.kicker .lead { color: var(--lead); }
.kicker .rule { width: 44px; height: 1px; background: var(--lead); opacity: .8; }
.gems { display: flex; gap: 7px; margin: -4px 0; }
.gems img { width: 26px; height: 26px; }
.title-box { flex: 1; display: flex; align-items: center; min-height: 0; }
h1 { font-family: "Cormorant Garamond", "Noto Serif SC", serif; font-weight: 500; letter-spacing: -.015em; line-height: .98; text-wrap: balance; font-size: 88px; }
h1 em { font-style: italic; }
[data-lang="zh"] h1 { font-family: "Noto Serif SC", serif; font-weight: 600; letter-spacing: .01em; line-height: 1.22; }
[data-lang="zh"] h1 em { font-style: normal; }
.w { white-space: nowrap; }
[data-lang="zh"] .home h1 em, [data-lang="zh"] h1 em { font-weight: 600; }
[data-lang="en"] .zh, [data-lang="zh"] .en { display: none; }
.foot { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--ink); padding-top: 18px; }
.foot .mark { font-family: "Instrument Serif", serif; font-style: italic; font-size: 30px; line-height: 1; letter-spacing: -.01em; }
.foot .mark img { height: 34px; display: block; }
.foot .url { font-family: "Geist Mono", monospace; font-size: 15px; letter-spacing: .12em; color: var(--ink-3); }
.plate { position: absolute; right: 72px; top: 56px; width: 400px; height: 518px; }
.plate.wide { width: 520px; }
body:has(.plate.wide) .copy { width: 520px; }
.kicker { overflow: hidden; }
.plate img { width: 100%; height: 100%; object-fit: cover; border-radius: 3px; box-shadow: 0 40px 70px -36px rgba(14,15,20,.62), 0 2px 6px rgba(14,15,20,.08); display: block; }
.grid { position: absolute; right: 72px; top: 56px; width: 420px; height: 518px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.grid img { width: 100%; height: 252px; object-fit: cover; border-radius: 3px; box-shadow: 0 30px 50px -30px rgba(14,15,20,.6); display: block; }
.disc { position: absolute; right: -40px; top: 50%; width: 600px; height: 600px; transform: translateY(-50%); border-radius: 50%; box-shadow: 0 50px 90px -40px rgba(40,30,90,.55), inset 0 0 0 1px rgba(255,255,255,.5); }
.disc::after { content: ""; position: absolute; inset: 0; border-radius: 50%; box-shadow: inset 0 0 0 7px rgba(255,255,255,.28), inset 0 0 26px rgba(255,255,255,.35); }
.disc img { width: 100%; height: 100%; border-radius: 50%; display: block; }
</style></head><body class="${card.id === "home" ? "home" : ""}">
<div class="copy">
  <p class="kicker">${gems ? `<span class="gems">${gems}</span>` : ""}<span class="lead">${esc(card.kicker[0][k])}</span><span class="rule"></span><span>${esc(card.kicker[1][k])}</span></p>
  <div class="title-box"><h1>${headline(card.source)}</h1></div>
  <div class="foot"><span class="mark">${card.id === "home" ? `<img src="${url("assets/logo/teachometry-masthead-bead.svg")}" alt="Teachometry">` : "Teachometry"}</span><span class="url">teachometry.com</span></div>
</div>
${art(card)}
</body></html>`;
}

const only = new Set(process.argv.slice(2));
const work = mkdtempSync(join(tmpdir(), "share-cards-"));
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
try {
  for (const card of cards) {
    if (only.size > 0 && !only.has(card.id)) continue;
    for (const lang of ["en", "zh"]) {
      const file = join(work, `${card.id}-${lang}.html`);
      writeFileSync(file, cardHtml(card, lang));
      await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      // Chinese lines may only break between words, never inside one
      if (lang === "zh") await page.evaluate(() => {
        const seg = new Intl.Segmenter("zh", { granularity: "word" });
        const walker = document.createTreeWalker(document.querySelector("h1"), NodeFilter.SHOW_TEXT);
        const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
        for (const node of nodes) {
          if (node.parentElement.closest(".en")) continue;
          if (!node.data.trim()) { node.remove(); continue; }
          const frag = document.createDocumentFragment();
          for (const { segment } of seg.segment(node.data)) {
            const span = document.createElement("span"); span.className = "w"; span.textContent = segment; frag.append(span);
          }
          node.replaceWith(frag);
        }
      });
      // largest headline size that fits its box (and never wider than the column)
      const size = await page.evaluate((zh) => {
        const h1 = document.querySelector("h1");
        const box = document.querySelector(".title-box");
        for (let px = zh ? 72 : 92; px >= 40; px -= 2) {
          h1.style.fontSize = `${px}px`;
          if (h1.scrollHeight <= box.clientHeight - 24 && h1.scrollWidth <= box.clientWidth) return px;
        }
        return 40;
      }, lang === "zh");
      await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => {}))));
      const target = join(OUT, `${card.id}-${lang}.jpg`);
      await page.screenshot({ path: target, type: "jpeg", quality: 86 });
      process.stdout.write(`${card.id}-${lang}.jpg  ${size}px\n`);
    }
  }
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
