#!/usr/bin/env node
// Real-browser hit test for the public website's header and homepage paths.
//
// It serves the built site, drives a local Chrome/Chromium through the DevTools
// protocol (Node's built-in WebSocket, no dependencies) and checks that:
//   - every visible header control owns the points inside its own box
//     (document.elementFromPoint at the centre and near each edge), and
//   - real mouse clicks on the homepage paths (Run an Evaluation, Read the
//     Methodology, Try one teaching case) at the centre and near each edge, and
//     on header links, open the link's own destination.
//   - the homepage case card keeps its five dimensions, their status badges
//     ("N/A" / "不适用", one line each), caption, footer and controls inside
//     their own boxes without overlapping, across widths, text sizes, case
//     switching and keyboard tab changes.
// Scenarios cover 1024/1100/1440 px, English and zh-CN, and a 200% text
// simulation (every element's computed font size doubled), where the homepage
// buttons used to overlap and the 1024 px header placed About/Blog under the
// language selector.
//
// Usage: node scripts/website-hit-test.mjs [--dir website/dist]
// Browser: $CHROME_PATH, or google-chrome / chromium on PATH.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { findBrowser, launchBrowser, openPage } from "./website-browser.mjs";

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".json": "application/json", ".woff2": "font/woff2" };

export function serve(root) {
  const server = createServer(async (request, response) => {
    let path;
    try { path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname); }
    catch { response.writeHead(400).end(); return; }
    const candidate = resolve(root, normalize(`.${path}`));
    if (candidate !== root && !candidate.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    for (const file of path.endsWith("/") ? [join(candidate, "index.html")] : [candidate, join(candidate, "index.html")]) {
      try {
        if (!(await stat(file)).isFile()) continue;
        response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
        response.end(await readFile(file));
        return;
      } catch { /* try the next candidate */ }
    }
    response.writeHead(404).end();
  });
  return new Promise((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", () => done(server)); });
}

// --- Functions below run inside the page (serialised with Function#toString). ---
/* global document, getComputedStyle, innerWidth, innerHeight, requestAnimationFrame */

function scaleText(factor) {
  const all = [...document.querySelectorAll("body, body *")];
  const sizes = all.map((el) => parseFloat(getComputedStyle(el).fontSize));
  all.forEach((el, i) => el.style.setProperty("font-size", `${sizes[i] * factor}px`, "important"));
  return true;
}

// Points inside a control: centre and 4px inside each edge (corners are left out
// because hit testing follows border-radius on round controls).
export function headerProbe() {
  const pointsOf = (r) => [["center", r.left + r.width / 2, r.top + r.height / 2], ["left", r.left + 4, r.top + r.height / 2], ["right", r.right - 4, r.top + r.height / 2], ["top", r.left + r.width / 2, r.top + 3], ["bottom", r.left + r.width / 2, r.bottom - 3]];
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === "none" || s.visibility === "hidden") return false;
    }
    return true;
  };
  const header = document.querySelector("header.site-header");
  if (!header) return { count: 0, problems: ["header missing"], diagnostics: [] };
  const controls = [...header.querySelectorAll(".wordmark, .nav-links a, .nav-toggle, .home-header-tools select, .home-header-tools button, .home-header-tools > a")].filter(visible);
  const problems = [];
  for (const el of controls) {
    for (const [name, x, y] of pointsOf(el.getBoundingClientRect())) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) problems.push(`${el.getAttribute("href") || el.tagName} @${name} -> ${hit ? (hit.closest("a, button, select") || hit).outerHTML.slice(0, 60) : "nothing"}`);
    }
  }
  // 仅 Header 的边界和控件越界阻断；正文或 Hero 的既有溢出单独诊断。
  const viewport = document.documentElement.clientWidth;
  for (const el of [header, ...header.querySelectorAll(".header-inner, .nav-links, .nav-group, .home-header-tools"), ...controls].filter(visible)) {
    const r = el.getBoundingClientRect();
    // 原生 select 的 scrollWidth 可包含被控件内部裁剪的选项文字；它的
    // 可见边界与命中仍必须通过，不能把选项固有宽度当成 Header 越界。
    const contentOverflows = el.tagName !== "SELECT" && el.scrollWidth > el.clientWidth + 1;
    if (r.left < -1 || r.right > viewport + 1 || contentOverflows) {
      problems.push(`header overflow: ${el.className || el.tagName}`);
    }
  }
  if (controls.length === 0) problems.push("header has no visible controls");
  const nav = controls.filter((el) => el.matches(".nav-links a"));
  for (let i = 1; i < nav.length; i += 1) {
    if (nav[i].getBoundingClientRect().top < nav[i - 1].getBoundingClientRect().top - 1) {
      problems.push(`navigation visual order moves upward: ${nav[i].getAttribute("href")}`);
    }
  }
  const diagnostics = document.documentElement.scrollWidth > innerWidth + 1
    ? [`document content overflow: ${document.documentElement.scrollWidth - innerWidth}px (not a header assertion)`] : [];
  return { count: controls.length, problems, diagnostics };
}

// Geometry of the visible homepage case card. Every assertion is about rendered
// boxes: a status badge on one line and inside its row, rows inside the preview
// panel, the panel clear of the card footer, footer parts apart and inside the
// card, and each card control owning its own points.
export async function caseCardProbe() {
  const card = document.querySelector("[data-case-walkthrough]");
  if (!card) return { count: 0, problems: ["case card missing"] };
  card.scrollIntoView({ block: "center", behavior: "instant" });
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const article = [...card.querySelectorAll("[data-home-case]")].find((item) => !item.hidden);
  const box = (el) => el.getBoundingClientRect();
  const inside = (a, b) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;
  const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
  const textRects = (el) => { const range = document.createRange(); range.selectNodeContents(el); return [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0); };
  const textBox = (el) => textRects(el).reduce((a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  const problems = [];
  const cardBox = box(card);
  const preview = article.querySelector(".rubric-preview");
  const previewBox = box(preview);
  const rows = [...preview.querySelectorAll(".rubric-row")];
  if (rows.length !== 5) problems.push(`expected 5 dimensions, found ${rows.length}`);
  for (const row of rows) {
    const [name, track, status] = row.children;
    const label = name.textContent.trim();
    const lines = new Set(textRects(status).map((r) => Math.round(r.top))).size;
    if (lines !== 1) problems.push(`status of ${label} on ${lines} lines`);
    if (!inside(textBox(status), box(status))) problems.push(`status text of ${label} outside its badge`);
    if (!inside(box(status), box(row)) || !inside(textBox(name), box(row))) problems.push(`${label} row content outside its row`);
    if (!inside(box(row), previewBox)) problems.push(`${label} row outside the preview by ${Math.round(box(row).bottom - previewBox.bottom)}px`);
    if (overlap(box(name), box(status)) || overlap(box(name), box(track)) || overlap(box(track), box(status))) problems.push(`${label} row parts overlap`);
  }
  const caption = preview.querySelector(".score-caption");
  if (!caption || !inside(textBox(caption), previewBox)) problems.push("score caption outside the preview");
  if (!inside(previewBox, cardBox)) problems.push("preview outside the card");
  const bottom = article.querySelector(".walkthrough-bottom");
  if (overlap(previewBox, box(bottom))) problems.push(`preview overlaps the card footer by ${Math.round(previewBox.bottom - box(bottom).top)}px`);
  const parts = [...bottom.children];
  parts.forEach((part, index) => {
    if (!inside(box(part), cardBox)) problems.push(`footer part outside the card: ${part.className}`);
    if (!inside(textBox(part), box(part))) problems.push(`footer text outside its box: ${part.className}`);
    parts.slice(index + 1).forEach((other) => { if (overlap(box(part), box(other))) problems.push("footer parts overlap"); });
  });
  for (const el of card.querySelectorAll("*")) {
    const r = box(el);
    if (r.width > 0 && (r.left < -0.5 || r.right > document.documentElement.clientWidth + 0.5)) { problems.push(`card content past the viewport: ${el.className || el.tagName}`); break; }
  }
  // Card controls own their points (ignoring points under the sticky header or off screen).
  const headerBottom = document.querySelector("header.site-header")?.getBoundingClientRect().bottom ?? 0;
  const controls = [...card.querySelectorAll("[data-case-prev], [data-case-next]"), ...article.querySelectorAll("[role=tab], .case-open")];
  for (const el of controls) {
    const r = box(el);
    for (const [name, x, y] of [["center", r.left + r.width / 2, r.top + r.height / 2], ["left", r.left + 3, r.top + r.height / 2], ["right", r.right - 3, r.top + r.height / 2]]) {
      if (y <= headerBottom || y >= innerHeight || x < 0 || x >= innerWidth) continue;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) problems.push(`${el.getAttribute("aria-label") || el.textContent.trim()} @${name} -> ${hit ? (hit.closest("a, button") || hit).textContent.trim().slice(0, 20) : "nothing"}`);
    }
  }
  return { count: rows.length + controls.length + parts.length, problems };
}

function caseCardState() {
  const card = document.querySelector("[data-case-walkthrough]");
  const cases = [...card.querySelectorAll("[data-home-case]")];
  const article = cases.find((item) => !item.hidden);
  const tabs = [...article.querySelectorAll("[role=tab]")];
  const selected = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
  const panel = selected >= 0 ? article.querySelector(`#${tabs[selected].getAttribute("aria-controls")}`) : null;
  return { caseIndex: cases.indexOf(article), selected, panelShown: Boolean(panel && !panel.hidden), focused: document.activeElement === tabs[selected] };
}

function focusFirstTab() {
  const article = [...document.querySelectorAll("[data-home-case]")].find((item) => !item.hidden);
  article.querySelector("[role=tab]").focus();
  return true;
}

async function locateTarget(selector, index) {
  const pointsOf = (r) => [["center", r.left + r.width / 2, r.top + r.height / 2], ["left", r.left + 4, r.top + r.height / 2], ["right", r.right - 4, r.top + r.height / 2], ["top", r.left + r.width / 2, r.top + 3], ["bottom", r.left + r.width / 2, r.bottom - 3]];
  const el = [...document.querySelectorAll(selector)].filter((x) => x.getBoundingClientRect().width > 0)[index];
  if (!el) return null;
  el.scrollIntoView({ block: "center", behavior: "instant" });
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  return { href: el.href, points: pointsOf(el.getBoundingClientRect()) };
}

async function clickCheck(page, url, zoom, selector, index, failures, label) {
  await visit(page, url, zoom);
  const first = await page.call(locateTarget, selector, index);
  if (!first) { failures.push(`${label}: ${selector}[${index}] not found`); return 0; }
  let clicks = 0;
  for (let point = 0; point < first.points.length; point += 1) {
    if (point > 0) await visit(page, url, zoom);
    const { href, points } = await page.call(locateTarget, selector, index);
    const [name, x, y] = points[point];
    const landed = await page.navigation(() => page.click(x, y));
    clicks += 1;
    if (landed !== href) failures.push(`${label}: click ${href} @${name} opened ${landed}`);
  }
  return clicks;
}

async function visit(page, url, zoom) {
  await page.goto(url);
  if (zoom !== 1) await page.call(scaleText, zoom);
  await page.settled();
}

export async function runHitTest(directory, executable = findBrowser()) {
  let browser, server;
  const failures = [];
  const errors = [];
  const diagnostics = new Set();
  let checks = 0;
  try {
    server = await serve(directory);
    browser = await launchBrowser(executable);
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await openPage(browser);
    // Header: every visible control owns its own points, on several pages.
    for (const width of [1023, 1024, 1100, 1440]) {
      await page.viewport(width, 900);
      for (const path of ["/", "/methodology/", "/docs/", "/blog/", "/zh-cn/", "/zh-cn/blog/"]) {
        for (const zoom of width === 1023 ? [1] : width === 1024 ? [1, 2, 3] : [1, 2]) {
          await visit(page, origin + path, zoom);
          const { count, problems, diagnostics: notes } = await page.call(headerProbe);
          checks += count;
          notes.forEach((note) => diagnostics.add(`${width}px ${path} x${zoom}: ${note}`));
          problems.forEach((problem) => failures.push(`header ${width}px ${path} x${zoom}: ${problem}`));
        }
      }
    }
    // Real clicks: the three homepage paths and the header links that used to be covered.
    for (const [width, zoom] of [[1024, 1], [1024, 2], [1440, 2], [390, 1]]) {
      await page.viewport(width, 900);
      for (const home of ["/", "/zh-cn/"]) {
        for (const selector of [".home-actions a.button-primary", ".home-actions a.button-secondary", "a.home-try"]) {
          checks += await clickCheck(page, origin + home, zoom, selector, 0, failures, `${width}px ${home} x${zoom}`);
        }
      }
    }
    await page.viewport(1024, 900);
    for (const home of ["/", "/zh-cn/"]) {
      const links = await (async () => { await visit(page, origin + home, 1); return page.evaluate("document.querySelectorAll('header .nav-links a').length"); })();
      for (let index = 0; index < links; index += 1) {
        checks += await clickCheck(page, origin + home, 1, "header .nav-links a", index, failures, `header 1024px ${home}`);
      }
    }
    // Homepage case card: dimensions, status badges, caption and footer stay inside
    // their boxes. 901-1200 px is the band whose fixed 160px panel used to push the
    // zh-CN "不适用" rows over the footer; 1201/390/1440 cover the other layouts.
    for (const width of [390, 901, 1024, 1200, 1201, 1440]) {
      await page.viewport(width, 900);
      for (const home of ["/", "/zh-cn/"]) {
        for (const zoom of width === 390 || width === 1440 ? [1] : [1, 2]) {
          await visit(page, origin + home, zoom);
          const { count, problems } = await page.call(caseCardProbe);
          checks += count;
          problems.forEach((problem) => failures.push(`case card ${width}px ${home} x${zoom}: ${problem}`));
        }
      }
    }
    // Case switching by a real click and tab changes by keyboard keep the layout intact.
    await page.viewport(1024, 900);
    for (const home of ["/", "/zh-cn/"]) {
      const label = `case card 1024px ${home}`;
      await visit(page, origin + home, 1);
      const before = await page.call(caseCardState);
      const next = await page.call(locateTarget, "[data-case-next]", 0);
      await page.click(next.points[0][1], next.points[0][2]);
      await page.settled();
      const switched = await page.call(caseCardState);
      if (switched.caseIndex === before.caseIndex) failures.push(`${label}: next case did not switch`);
      (await page.call(caseCardProbe)).problems.forEach((problem) => failures.push(`${label} after next case: ${problem}`));
      await page.call(focusFirstTab);
      for (let step = 1; step <= 3; step += 1) {
        for (const type of ["keyDown", "keyUp"]) await page.send("Input.dispatchKeyEvent", { type, key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
        await page.settled();
        const state = await page.call(caseCardState);
        if (state.selected !== step || !state.panelShown || !state.focused) failures.push(`${label}: ArrowRight ${step} selected tab ${state.selected}, panel shown ${state.panelShown}, focused ${state.focused}`);
        (await page.call(caseCardProbe)).problems.forEach((problem) => failures.push(`${label} on tab ${step}: ${problem}`));
        checks += 1;
      }
    }
    // 无脚本时必须使用可完整阅读的静态布局，而非猜测多行 Header 的高度。
    await page.setJavaScriptEnabled(false);
    for (const width of [1100, 1101, 1200]) {
      await page.viewport(width, 700);
      for (const path of ["/methodology/", "/zh-cn/methodology/"]) {
        await page.goto(origin + path);
        const position = await page.evaluate("getComputedStyle(document.querySelector('[data-method-story-stage]')).position");
        if (position === "sticky") failures.push(`no-JS ${width}px ${path}: stage must be static`);
      }
    }
    await page.setJavaScriptEnabled(true);
    if (browser.failure) throw browser.failure;
  } catch (error) { errors.push(error); }
  finally {
    try { await browser?.close(); } catch (error) { errors.push(error); }
    if (server) {
      server.closeAllConnections();
      try {
        await new Promise((done, fail) => {
          const timer = setTimeout(() => fail(new Error("Preview server cleanup timed out")), 2000);
          server.close((error) => { clearTimeout(timer); if (error) fail(error); else done(); });
        });
      } catch (error) { errors.push(error); }
    }
  }
  if (errors.length) throw new AggregateError(errors, "Website hit test or cleanup failed");
  for (const note of diagnostics) console.warn(`Diagnostic: ${note}`);

  if (failures.length > 0) {
    console.error(`Website hit test failed (${failures.length}):`);
    failures.forEach((failure) => console.error(`  - ${failure}`));
    throw new Error(`Website hit test failed (${failures.length})`);
  }
  console.log(`Website hit test passed: ${checks} controls and clicks checked.`);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dirFlag = args.indexOf("--dir");
  try {
    if (dirFlag >= 0 && (!args[dirFlag + 1] || args[dirFlag + 1].startsWith("--"))) throw new Error("--dir requires a directory");
    await runHitTest(resolve(dirFlag >= 0 ? args[dirFlag + 1] : "website/dist"));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
    // 有界清理已执行；失效的系统句柄不能继续拖住失败的 CLI。
    setTimeout(() => process.exit(1), 1000).unref();
  }
}
