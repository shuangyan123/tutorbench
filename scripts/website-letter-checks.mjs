// Real-browser checks for the Home opening letter, run by website-hit-test.mjs.
//
// They drive the built site through the same CDP page object as the hit test
// and fail on what a visitor would meet, not on source text:
//   - geometry and real hits for the top bar, Skip, envelope, paper, letter
//     text and Continue at 320/390/768/1024/1440 px, English and zh-CN, with
//     normal and doubled text, plus the Home entry beside the hero foot;
//   - WCAG contrast of every visible letter text, light and dark, before and
//     after the reader reaches it;
//   - first visit, repeat visit, Skip, Escape, keyboard, full read, reopen;
//   - Back/Forward over #letter and a back/forward-cache restore;
//   - a letter.js that fails to load and storage that refuses writes;
//   - reduced motion.

const LETTER_KEY = "teachometry-letter-v1";
const WIDTHS = [320, 390, 768, 1024, 1440];
const HOMES = ["/", "/zh-cn/"];

// --- Functions below run inside the page (serialised with Function#toString). ---
/* global document, getComputedStyle, innerHeight, innerWidth, localStorage, location */

function scaleText(factor) {
  const all = [...document.querySelectorAll("body, body *")];
  const sizes = all.map((el) => parseFloat(getComputedStyle(el).fontSize));
  all.forEach((el, i) => el.style.setProperty("font-size", `${sizes[i] * factor}px`, "important"));
  return true;
}

function letterState() {
  const dialog = document.getElementById("home-letter");
  let stored;
  try { stored = localStorage.getItem("teachometry-letter-v1"); } catch { stored = "unavailable"; }
  const entry = document.querySelector(".home-letter-entry");
  return {
    open: Boolean(dialog?.open),
    state: dialog?.dataset.letterState ?? null,
    stored,
    url: `${location.pathname}${location.hash}`,
    focus: document.activeElement?.getAttribute("class") ?? null,
    ready: document.documentElement.hasAttribute("data-letter-ready"),
    entryVisible: entry ? getComputedStyle(entry).visibility === "visible" && entry.getBoundingClientRect().width > 0 : false,
    inked: dialog ? dialog.querySelectorAll(".is-inked").length : 0,
    mode: dialog?.querySelector("[data-letter-next]")?.dataset.mode ?? null,
  };
}

// While the letter is open every visible header control is covered by it.
function letterCoversHeader() {
  const dialog = document.getElementById("home-letter");
  const controls = [...document.querySelectorAll("header.site-header a, header.site-header button, header.site-header select")]
    .filter((el) => el.getBoundingClientRect().width > 0);
  const exposed = controls.filter((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !dialog || !dialog.contains(hit);
  });
  return { count: controls.length, exposed: exposed.map((el) => el.outerHTML.slice(0, 60)) };
}

// A control is inside the viewport and owns its centre and the points just inside each edge.
function controlProbe(selector, scroll) {
  const el = document.querySelector(selector);
  if (!el) return { count: 0, problems: [`${selector} missing`] };
  if (scroll) el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return { count: 0, problems: [`${selector} not rendered`] };
  const problems = [];
  if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) {
    problems.push(`${selector} leaves the ${innerWidth}x${innerHeight} viewport: ${[r.left, r.top, r.right, r.bottom].map(Math.round).join(",")}`);
  }
  const points = [["center", r.left + r.width / 2, r.top + r.height / 2], ["left", r.left + 4, r.top + r.height / 2], ["right", r.right - 4, r.top + r.height / 2], ["top", r.left + r.width / 2, r.top + 3], ["bottom", r.left + r.width / 2, r.bottom - 3]];
  for (const [name, x, y] of points) {
    const hit = document.elementFromPoint(x, y);
    if (!(hit === el || el.contains(hit))) problems.push(`${selector} @${name} -> ${hit?.outerHTML.slice(0, 60) ?? "nothing"}`);
  }
  return { count: points.length + 1, problems };
}

// Layout of the open letter: nothing wider than the viewport, the bar's parts
// apart, and the whole letter reachable inside the paper.
function letterLayoutProbe() {
  const problems = [];
  const vw = innerWidth;
  const vh = innerHeight;
  const dialog = document.getElementById("home-letter");
  const box = (el) => el.getBoundingClientRect();
  const outside = (r) => r.left < -0.5 || r.right > vw + 0.5;
  const fmt = (r) => [r.left, r.top, r.right, r.bottom].map(Math.round).join(",");
  for (const selector of [".letter-bar", ".letter-brand-name", ".letter-language", "[data-letter-skip]"]) {
    const r = box(dialog.querySelector(selector));
    if (outside(r) || r.top < -0.5 || r.bottom > vh + 0.5) problems.push(`${selector} outside viewport: ${fmt(r)}`);
  }
  const parts = [".letter-brand-name", ".letter-language", "[data-letter-skip]"].map((s) => [s, box(dialog.querySelector(s))]);
  for (let i = 0; i < parts.length; i += 1) {
    for (let j = i + 1; j < parts.length; j += 1) {
      const [a, ra] = parts[i];
      const [b, rb] = parts[j];
      if (!(ra.right <= rb.left + 0.5 || rb.right <= ra.left + 0.5 || ra.bottom <= rb.top + 0.5 || rb.bottom <= ra.top + 0.5)) problems.push(`${a} overlaps ${b}`);
    }
  }
  const state = dialog.dataset.letterState;
  if (state === "sealed") {
    for (const selector of ["[data-letter-envelope]", ".envelope-address", ".letter-hint"]) {
      const r = box(dialog.querySelector(selector));
      if (outside(r)) problems.push(`${selector} wider than viewport: ${fmt(r)}`);
    }
    // The address has its own space below the seal.
    const seal = box(dialog.querySelector(".envelope-seal"));
    const address = box(dialog.querySelector(".envelope-address"));
    if (address.top < seal.bottom - 0.5) problems.push(`address ${fmt(address)} runs into the seal ${fmt(seal)}`);
    const envelope = box(dialog.querySelector("[data-letter-envelope]"));
    if (address.bottom > envelope.bottom + 0.5) problems.push(`address ${fmt(address)} spills out of the envelope ${fmt(envelope)}`);
  }
  if (state === "reading") {
    const paper = box(dialog.querySelector("[data-letter-paper]"));
    const scroller = dialog.querySelector("[data-letter-scroll]");
    const view = box(scroller);
    if (outside(paper) || paper.top < -0.5 || paper.bottom > vh + 0.5) problems.push(`paper outside viewport: ${fmt(paper)}`);
    if (paper.height < 120) problems.push(`paper too short to read: ${Math.round(paper.height)}px`);
    if (scroller.scrollWidth > scroller.clientWidth + 1) problems.push(`letter text scrolls sideways: ${scroller.scrollWidth} > ${scroller.clientWidth}`);
    for (const el of dialog.querySelectorAll(".letter-text p, .letter-text h3")) {
      const r = box(el);
      if (r.left < view.left - 0.5 || r.right > view.right + 0.5) problems.push(`text leaves the paper: ${el.textContent.slice(0, 30)} ${fmt(r)}`);
    }
    // The last line can be scrolled into view.
    scroller.scrollTop = scroller.scrollHeight;
    const last = box(dialog.querySelector(".letter-postscript"));
    const shown = box(scroller);
    if (last.bottom > shown.bottom + 0.5 || last.top < shown.top - 0.5) problems.push(`postscript not reachable: ${fmt(last)} in ${fmt(shown)}`);
    scroller.scrollTop = 0;
  }
  return { count: 12, problems };
}

// WCAG 2 contrast of every visible text in the letter against its surface.
function letterContrastProbe(minimum) {
  const dialog = document.getElementById("home-letter");
  const vars = getComputedStyle(dialog);
  const parse = (value) => {
    const v = value.trim();
    if (v.startsWith("#")) {
      const h = v.slice(1);
      const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
      return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).concat(1);
    }
    const m = v.match(/rgba?\(([^)]+)\)/u);
    if (!m) return null;
    const parts = m[1].split(/[\s,/]+/u).filter(Boolean).map(Number);
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  };
  const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const lum = (c) => {
    const [r, g, b] = c.slice(0, 3).map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const token = (name) => parse(vars.getPropertyValue(name));
  const scene = token("--lt-scene");
  const surfaces = (el) => {
    if (el.closest(".letter-sheet")) return [token("--lt-paper-hi"), token("--lt-paper-lo")];
    if (el.closest(".letter-next")) return [token("--lt-button")];
    if (el.closest(".envelope-address")) return [over(token("--lt-glass-1"), token("--lt-paper-hi")), over(token("--lt-glass-2"), token("--lt-glass-back"))];
    if (el.closest(".letter-skip")) return [over(token("--lt-chip"), scene)];
    return [scene];
  };
  const problems = [];
  let count = 0;
  const walker = document.createTreeWalker(dialog, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    const el = node.parentElement;
    if (el.closest(".envelope-seal, .visually-hidden, [hidden], script")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || getComputedStyle(el).visibility !== "visible") continue;
    let alpha = 1;
    for (let n = el; n && n !== dialog.parentElement; n = n.parentElement) alpha *= Number(getComputedStyle(n).opacity);
    const color = parse(getComputedStyle(el).color);
    color[3] *= alpha;
    count += 1;
    for (const surface of surfaces(el)) {
      const value = ratio(over(color, surface), surface);
      if (value < minimum) problems.push(`${value.toFixed(2)}:1 "${node.textContent.trim().slice(0, 28)}" (${el.className || el.tagName})`);
    }
  }
  return { count, problems };
}

// The Home entry has its own space: no shared pixels with the scroll cue or the handwritten note.
function entryLayoutProbe() {
  const entry = document.querySelector(".home-letter-entry");
  const problems = [];
  if (!entry) return { count: 0, problems: ["entry missing"] };
  entry.scrollIntoView({ block: "center", behavior: "instant" });
  const r = entry.getBoundingClientRect();
  if (getComputedStyle(entry).visibility !== "visible" || r.width < 1) problems.push("entry not visible");
  if (r.left < -0.5 || r.right > innerWidth + 0.5) problems.push(`entry wider than viewport: ${Math.round(r.left)}..${Math.round(r.right)}`);
  for (const selector of [".hero-note", ".scroll-cue", ".case-walkthrough"]) {
    const other = document.querySelector(selector)?.getBoundingClientRect();
    if (other && !(r.right <= other.left || other.right <= r.left || r.bottom <= other.top || other.bottom <= r.top)) problems.push(`entry overlaps ${selector}`);
  }
  return { count: 4, problems };
}

function locateCenter(selector) {
  const el = [...document.querySelectorAll(selector)].find((x) => x.getBoundingClientRect().width > 0);
  if (!el) return null;
  el.scrollIntoView({ block: "center", behavior: "instant" });
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

// --- Driver ---------------------------------------------------------------------

const pause = (ms) => new Promise((done) => setTimeout(done, ms));
let visitNumber = 0;
// A query string makes every visit a new document, even to the same #letter URL.
const fresh = (origin, home, hash = "") => `${origin}${home}?letter-check=${(visitNumber += 1)}${hash}`;

async function waitFor(page, expression, timeoutMs = 4000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    try { if (await page.evaluate(expression)) return true; } catch { /* the document may be changing */ }
    if (Date.now() > end) return false;
    await pause(100);
  }
}

async function key(page, name, code, keyCode) {
  // Enter needs its text so the focused button is activated as a real key press would.
  const text = name === "Enter" ? { text: "\r", unmodifiedText: "\r" } : {};
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: name, code, windowsVirtualKeyCode: keyCode, ...text });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: name, code, windowsVirtualKeyCode: keyCode });
}

async function clickAt(page, selector) {
  const point = await page.call(locateCenter, selector);
  if (!point) return false;
  await page.click(point[0], point[1]);
  return true;
}

const media = (page, features) => page.send("Emulation.setEmulatedMedia", { features });

export async function runLetterChecks(page, origin, failures, diagnostics) {
  let checks = 0;
  const report = (label, result) => {
    checks += result.count;
    result.problems.forEach((problem) => failures.push(`${label}: ${problem}`));
  };
  // Storage is cleared on a page nothing links to: a link the pointer rests on
  // may already be prerendered (speculation rules), and navigating to it then
  // activates that prerender instead of loading a document.
  const firstVisit = async (url) => {
    await page.goto(`${origin}/404.html`);
    await page.evaluate("localStorage.clear()");
    await page.goto(url);
  };

  // 1. Layout matrix: every width, both languages, normal and doubled text.
  //    Reduced motion makes the envelope open at once; #letter opens it on any visit.
  await media(page, [{ name: "prefers-reduced-motion", value: "reduce" }]);
  for (const width of WIDTHS) {
    await page.viewport(width, width < 700 ? 844 : 900);
    for (const home of HOMES) {
      for (const zoom of [1, 2]) {
        const label = `letter layout ${width}px ${home} x${zoom}`;
        await page.goto(fresh(origin, home, "#letter"));
        if (zoom !== 1) await page.call(scaleText, zoom);
        await page.settled();
        if (!(await page.call(letterState)).open) { failures.push(`${label}: #letter did not open the letter`); continue; }
        report(`${label} sealed`, await page.call(letterLayoutProbe));
        report(`${label} sealed`, await page.call(controlProbe, "[data-letter-skip]", false));
        report(`${label} sealed`, await page.call(controlProbe, "[data-letter-envelope]", true));
        await clickAt(page, "[data-letter-envelope]");
        await page.settled();
        const state = await page.call(letterState);
        if (state.state !== "reading") { failures.push(`${label}: a real click on the envelope did not open the letter (${JSON.stringify(state)})`); continue; }
        report(`${label} reading`, await page.call(letterLayoutProbe));
        report(`${label} reading`, await page.call(controlProbe, "[data-letter-skip]", false));
        report(`${label} reading`, await page.call(controlProbe, "[data-letter-next]", false));
        report(`${label} reading`, await page.call(controlProbe, ".letter-language", false));
      }
    }
  }

  // 2. Home entry: its own space and a real hit at every width and text size.
  for (const width of WIDTHS) {
    await page.viewport(width, width < 700 ? 844 : 900);
    for (const home of HOMES) {
      for (const zoom of [1, 2]) {
        const label = `letter entry ${width}px ${home} x${zoom}`;
        await page.goto(fresh(origin, home));
        if (zoom !== 1) await page.call(scaleText, zoom);
        await page.settled();
        report(label, await page.call(entryLayoutProbe));
        report(label, await page.call(controlProbe, ".home-letter-entry", true));
      }
    }
  }

  // Reduced motion: no automatic letter; the entry opens it fully inked.
  await page.viewport(1024, 900);
  for (const home of HOMES) {
    const label = `letter reduced motion ${home}`;
    await firstVisit(fresh(origin, home));
    let state = await page.call(letterState);
    if (state.open || !state.entryVisible) failures.push(`${label}: expected Home with the entry (${JSON.stringify(state)})`);
    await clickAt(page, ".home-letter-entry");
    await waitFor(page, "document.getElementById('home-letter').open");
    state = await page.call(letterState);
    if (state.state !== "reading" || state.inked !== 8 || state.mode !== "enter") failures.push(`${label}: entry did not open a fully inked letter (${JSON.stringify(state)})`);
    await key(page, "Escape", "Escape", 27);
    // Closing steps back over the entry's #letter history entry; that traversal
    // is asynchronous, so wait for it before the next navigation.
    await waitFor(page, "!document.getElementById('home-letter').open && location.hash === ''");
    state = await page.call(letterState);
    if (state.open || state.url !== home) failures.push(`${label}: Escape did not return to Home (${JSON.stringify(state)})`);
    checks += 3;
  }
  await media(page, []);

  // 3. Contrast before and after the reader reaches a passage, light and dark.
  for (const scheme of ["light", "dark"]) {
    await media(page, [{ name: "prefers-color-scheme", value: scheme }]);
    for (const home of HOMES) {
      const label = `letter contrast ${scheme} ${home}`;
      await page.goto(fresh(origin, home, "#letter"));
      await page.settled();
      report(`${label} sealed`, await page.call(letterContrastProbe, 4.5));
      await clickAt(page, "[data-letter-envelope]");
      await waitFor(page, "document.getElementById('home-letter').dataset.letterState === 'reading'");
      await pause(1600);
      const unread = await page.call(letterState);
      if (unread.inked >= 8) diagnostics.add(`${label}: every passage was already inked, so the unread state was not measured`);
      report(`${label} reading`, await page.call(letterContrastProbe, 4.5));
    }
  }
  await media(page, []);

  // 4. First visit, Skip, repeat visit, and Home right after.
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.viewport(width, height);
    for (const home of HOMES) {
      const label = `letter first visit ${width}px ${home}`;
      await firstVisit(fresh(origin, home));
      let state = await page.call(letterState);
      if (!state.open || state.state !== "sealed") failures.push(`${label}: first visit did not open the sealed letter (${JSON.stringify(state)})`);
      if (state.stored !== "1") failures.push(`${label}: first visit was not remembered`);
      if (state.focus !== "letter-envelope") failures.push(`${label}: focus starts on ${state.focus}, not the envelope`);
      if (!state.ready) failures.push(`${label}: letter.js did not mark itself ready`);
      report(label, await page.call(letterCoversHeader).then(({ count, exposed }) => ({ count, problems: exposed.map((c) => `header control not covered: ${c}`) })));
      report(label, await page.call(controlProbe, "[data-letter-skip]", false));
      await clickAt(page, "[data-letter-skip]");
      await pause(500);
      state = await page.call(letterState);
      if (state.open) failures.push(`${label}: Skip did not close the letter`);
      report(`${label} after skip`, await page.call(controlProbe, ".home-actions a.button-primary", true));
      await page.goto(fresh(origin, home));
      if ((await page.call(letterState)).open) failures.push(`${label}: letter reopened on a repeat visit`);
      checks += 3;
    }
  }

  // 5. Keyboard: Escape, Enter on the envelope, reading, and the entry with focus return.
  await page.viewport(1440, 900);
  for (const home of HOMES) {
    const label = `letter keyboard ${home}`;
    await firstVisit(fresh(origin, home));
    await key(page, "Escape", "Escape", 27);
    await pause(500);
    if ((await page.call(letterState)).open) failures.push(`${label}: Escape did not close the letter`);
    await page.evaluate("location.hash = '#letter'");
    await waitFor(page, "document.getElementById('home-letter').open");
    await key(page, "Enter", "Enter", 13);
    await waitFor(page, "document.getElementById('home-letter').dataset.letterState === 'reading'");
    let state = await page.call(letterState);
    if (state.state !== "reading" || state.focus !== "letter-scroll") failures.push(`${label}: Enter did not open the letter for reading (${JSON.stringify(state)})`);
    await key(page, "Escape", "Escape", 27);
    await waitFor(page, "!document.getElementById('home-letter').open && location.hash === ''");
    state = await page.call(letterState);
    if (state.open || state.url.includes("#")) failures.push(`${label}: Escape left ${JSON.stringify(state)}`);
    await clickAt(page, ".home-letter-entry");
    await waitFor(page, "document.getElementById('home-letter').open");
    state = await page.call(letterState);
    if (state.state !== "reading" || state.url !== `${home}#letter`) failures.push(`${label}: Home entry did not open the letter at #letter (${JSON.stringify(state)})`);
    await key(page, "Escape", "Escape", 27);
    await waitFor(page, "!document.getElementById('home-letter').open && location.hash === ''");
    state = await page.call(letterState);
    if (state.open || state.focus !== "home-letter-entry" || state.url !== home) failures.push(`${label}: closing did not return to Home with focus on the entry (${JSON.stringify(state)})`);
    checks += 5;
  }

  // 6. A full read: Continue until the end, then Enter Teachometry.
  {
    const label = "letter full read";
    await firstVisit(fresh(origin, "/"));
    await clickAt(page, "[data-letter-envelope]");
    await waitFor(page, "document.getElementById('home-letter').dataset.letterState === 'reading'");
    for (let step = 0; step < 12 && (await page.call(letterState)).mode !== "enter"; step += 1) {
      await clickAt(page, "[data-letter-next]");
      await pause(250);
    }
    let state = await page.call(letterState);
    if (state.mode !== "enter" || state.inked !== 8) failures.push(`${label}: Continue did not reach the end (${JSON.stringify(state)})`);
    await clickAt(page, "[data-letter-next]");
    await waitFor(page, "!document.getElementById('home-letter').open", 3000);
    state = await page.call(letterState);
    if (state.open || state.url !== "/") failures.push(`${label}: Enter Teachometry did not lead into Home (${JSON.stringify(state)})`);
    report(label, await page.call(controlProbe, ".home-actions a.button-primary", true));
    checks += 2;
  }

  // 7. History: Back and Forward over #letter follow the URL; closing adds no
  //    entry, so one more Back leaves Home for the page before it.
  {
    const label = "letter history";
    const before = fresh(origin, "/");
    await page.goto(before);
    await page.goto(fresh(origin, "/"));
    await clickAt(page, ".home-letter-entry");
    await waitFor(page, "document.getElementById('home-letter').open");
    await page.evaluate("history.back()");
    await waitFor(page, "location.hash === '' && !document.getElementById('home-letter').open");
    let state = await page.call(letterState);
    if (state.open) failures.push(`${label}: Back left the letter open at ${state.url}`);
    await page.evaluate("history.forward()");
    await waitFor(page, "location.hash === '#letter' && document.getElementById('home-letter').open");
    state = await page.call(letterState);
    if (!state.open) failures.push(`${label}: Forward to #letter did not show the letter (${JSON.stringify(state)})`);
    await clickAt(page, "[data-letter-skip]");
    await waitFor(page, "location.hash === '' && !document.getElementById('home-letter').open");
    state = await page.call(letterState);
    if (state.open || state.url !== "/") failures.push(`${label}: Skip after Forward left ${JSON.stringify(state)}`);
    // The previous page may come back from the back/forward cache (no load event).
    await page.evaluate("history.back()");
    await waitFor(page, `location.href === ${JSON.stringify(before)} && document.readyState === "complete"`, 6000);
    const landed = await page.evaluate("location.href");
    if (landed !== before) failures.push(`${label}: Back after closing went to ${landed}, not the previous page ${before}; closing added a history entry`);
    checks += 4;
  }

  // 8. Back/forward cache: a delivered letter is not shown again on restore.
  {
    const label = "letter bfcache";
    await firstVisit(fresh(origin, "/"));
    await page.evaluate("window.__letterCheck = 'kept'");
    await page.navigation(() => clickAt(page, ".letter-language"));
    let state = await page.call(letterState);
    if (!state.open || state.url !== "/zh-cn/#letter") failures.push(`${label}: language link did not open the Chinese letter (${JSON.stringify(state)})`);
    await page.evaluate("history.back()");
    await waitFor(page, "location.pathname === '/' && document.readyState === 'complete'", 6000);
    await page.settled();
    const restored = await page.evaluate("window.__letterCheck === 'kept'");
    if (!restored) diagnostics.add(`${label}: the page was reloaded rather than restored from the back/forward cache`);
    state = await page.call(letterState);
    if (state.open) failures.push(`${label}: going back showed the already delivered letter again (${JSON.stringify(state)}, restored ${restored})`);
    report(label, await page.call(controlProbe, ".home-actions a.button-primary", true));
    checks += 1;
  }

  // 9. letter.js unavailable: Home directly, no dead envelope, no dead entry.
  await page.send("Network.setBlockedURLs", { urls: ["*/assets/letter.js"] });
  for (const hash of ["", "#letter"]) {
    const label = `letter without letter.js ${hash || "first visit"}`;
    await firstVisit(fresh(origin, "/", hash));
    await page.settled();
    const state = await page.call(letterState);
    if (state.open || state.ready || state.entryVisible) failures.push(`${label}: expected plain Home (${JSON.stringify(state)})`);
    report(label, await page.call(controlProbe, ".home-actions a.button-primary", true));
    checks += 1;
  }
  await page.send("Network.setBlockedURLs", { urls: [] });

  // 10. Storage that refuses writes: the visit cannot be remembered, so Home directly, every time.
  {
    const { identifier } = await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: "Storage.prototype.setItem = function () { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); };",
    });
    for (const round of [1, 2]) {
      const label = `letter storage full visit ${round}`;
      if (round === 1) await firstVisit(fresh(origin, "/"));
      else await page.goto(fresh(origin, "/"));
      const state = await page.call(letterState);
      if (state.open) failures.push(`${label}: the letter opened although the visit cannot be remembered`);
      report(label, await page.call(controlProbe, ".home-actions a.button-primary", true));
      checks += 1;
    }
    await page.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  }

  return checks;
}

export { LETTER_KEY };
