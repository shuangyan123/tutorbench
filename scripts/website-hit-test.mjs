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

function serve(root) {
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
/* global document, getComputedStyle, innerWidth, requestAnimationFrame */

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
