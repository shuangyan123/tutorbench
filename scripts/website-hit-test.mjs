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

import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";

const args = process.argv.slice(2);
const dirFlag = args.indexOf("--dir");
const directory = resolve(dirFlag >= 0 && args[dirFlag + 1] ? args[dirFlag + 1] : "website/dist");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const found = spawnSync("which", [name], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error("No Chrome/Chromium found. Set CHROME_PATH to a Chromium-based browser.");
}

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".json": "application/json", ".woff2": "font/woff2" };

function serve(root) {
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const candidate = resolve(root, normalize(`.${path}`));
    if (!candidate.startsWith(root)) { response.writeHead(403).end(); return; }
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
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server)));
}

async function launch(executable) {
  const profile = await mkdtemp(join(tmpdir(), "website-hit-test-"));
  const child = spawn(executable, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const endpoint = await new Promise((done, fail) => {
    let buffer = "";
    const timer = setTimeout(() => fail(new Error("Browser did not start")), 20000);
    child.stderr.on("data", (chunk) => {
      buffer += chunk;
      const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/u);
      if (match) { clearTimeout(timer); done(match[1]); }
    });
    child.on("exit", (code) => fail(new Error(`Browser exited (${code})`)));
  });
  const socket = new globalThis.WebSocket(endpoint);
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(String(data));
    if (message.id !== undefined && pending.has(message.id)) {
      const { done, fail } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) fail(new Error(`${message.error.message}`)); else done(message.result);
    } else listeners.forEach((listener) => listener(message));
  };
  const send = (method, params = {}, sessionId) => new Promise((done, fail) => {
    const id = ++nextId;
    pending.set(id, { done, fail });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const close = async () => {
    const exited = child.exitCode !== null ? Promise.resolve() : new Promise((done) => child.once("exit", done));
    try { await send("Browser.close"); } catch { /* already closing */ }
    // Wait for the browser to release its profile before removing it.
    const force = setTimeout(() => child.kill("SIGKILL"), 5000);
    await exited;
    clearTimeout(force);
    socket.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => { /* temporary profile only */ });
  };
  return { send, listeners, close };
}

async function openPage(browser) {
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => browser.send(method, params, sessionId);
  await send("Page.enable");
  await send("Runtime.enable");
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  const loaded = () => new Promise((done) => {
    const listener = (message) => {
      if (message.sessionId === sessionId && message.method === "Page.loadEventFired") { browser.listeners.delete(listener); done(); }
    };
    browser.listeners.add(listener);
  });
  return {
    evaluate,
    async viewport(width, height) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    },
    async goto(url, zoom) {
      const ready = loaded();
      await send("Page.navigate", { url });
      await ready;
      await evaluate("document.fonts.ready.then(() => true)");
      if (zoom !== 1) {
        // Text-size simulation: double every element's computed font size
        // (collected first so nothing compounds), as browser text zoom would.
        await evaluate(`(() => { const all = [...document.querySelectorAll('body, body *')]; const sizes = all.map((el) => parseFloat(getComputedStyle(el).fontSize)); all.forEach((el, i) => el.style.setProperty('font-size', (sizes[i] * ${zoom}) + 'px', 'important')); return true; })()`);
      }
      await sleep(250);
    },
    async click(x, y) {
      const base = { x, y, button: "left", clickCount: 1 };
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", ...base });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...base });
    },
  };
}

// Points inside a control: centre and 4px inside each edge (corners are left out
// because hit testing follows border-radius on round controls).
const POINTS = `(r) => [['center', r.left + r.width / 2, r.top + r.height / 2], ['left', r.left + 4, r.top + r.height / 2], ['right', r.right - 4, r.top + r.height / 2], ['top', r.left + r.width / 2, r.top + 3], ['bottom', r.left + r.width / 2, r.bottom - 3]]`;

const HEADER_PROBE = `(() => {
  const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let n = el; n; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return false; } return true; };
  const header = document.querySelector('header.site-header');
  const controls = [...header.querySelectorAll('.wordmark, .nav-links a, .nav-toggle, .home-header-tools select, .home-header-tools button, .home-header-tools > a')].filter(visible);
  const problems = [];
  for (const el of controls) {
    for (const [name, x, y] of (${POINTS})(el.getBoundingClientRect())) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) problems.push((el.getAttribute('href') || el.tagName) + ' @' + name + ' -> ' + (hit ? (hit.closest('a, button, select') || hit).outerHTML.slice(0, 60) : 'nothing'));
    }
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) problems.push('horizontal overflow');
  return { count: controls.length, problems };
})()`;

const target = (selector, index = 0) => `(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((x) => x.getBoundingClientRect().width > 0)[${index}]; if (!el) return null; el.scrollIntoView({ block: 'center', behavior: 'instant' }); return { href: new URL(el.href).pathname, points: (${POINTS})(el.getBoundingClientRect()) }; })()`;

async function clickCheck(page, url, zoom, selector, index, failures, label) {
  await page.goto(url, zoom);
  const first = await page.evaluate(target(selector, index));
  if (!first) { failures.push(`${label}: ${selector}[${index}] not found`); return 0; }
  let clicks = 0;
  for (let point = 0; point < first.points.length; point += 1) {
    if (point > 0) await page.goto(url, zoom);
    const { href, points } = await page.evaluate(target(selector, index));
    const [name, x, y] = points[point];
    await page.click(x, y);
    let landed = "";
    for (let wait = 0; wait < 30; wait += 1) {
      await sleep(100);
      try { landed = await page.evaluate("location.pathname"); } catch { landed = ""; }
      if (landed && landed !== new URL(url).pathname) break;
    }
    clicks += 1;
    if (landed !== href) failures.push(`${label}: click ${href} @${name} opened ${landed}`);
  }
  return clicks;
}

const browser = await launch(findBrowser());
const server = await serve(directory);
const origin = `http://127.0.0.1:${server.address().port}`;
const failures = [];
let checks = 0;
try {
  const page = await openPage(browser);
  // Header: every visible control owns its own points, on several pages.
  for (const width of [1023, 1024, 1100, 1440]) {
    await page.viewport(width, 900);
    for (const path of ["/", "/methodology/", "/docs/", "/blog/", "/zh-cn/", "/zh-cn/blog/"]) {
      for (const zoom of width === 1023 ? [1] : [1, 2]) {
        await page.goto(origin + path, zoom);
        const { count, problems } = await page.evaluate(HEADER_PROBE);
        checks += count;
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
    const links = await (async () => { await page.goto(origin + home, 1); return page.evaluate("document.querySelectorAll('header .nav-links a').length"); })();
    for (let index = 0; index < links; index += 1) {
      checks += await clickCheck(page, origin + home, 1, "header .nav-links a", index, failures, `header 1024px ${home}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error(`Website hit test failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}
console.log(`Website hit test passed: ${checks} controls and clicks checked.`);
