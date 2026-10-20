// Real-browser checks for the Home opening letter, run by website-hit-test.mjs.
//
// They drive the built site through the same CDP page object as the hit test
// and fail on what a visitor would meet, not on source text:
//   - geometry and real hits for the top bar, Skip, envelope, paper and
//     Continue at 320/390/768/1024/1440 px, English and zh-CN, light and dark,
//     with normal and doubled text, plus the Home entry beside the hero foot;
//   - every line of letter text measured as a text Range (not its element's
//     box): inside the visible scroll area, clear of the fade mask once
//     scrolled to, and not covered; the third hope, the signature and the
//     postscript are scrolled to for real. Doubled text with WCAG 1.4.12 text
//     spacing stands in for serif faces wider than the ones installed here;
//   - WCAG contrast of every visible letter text, light and dark, before and
//     after the reader reaches it;
//   - first visit, repeat visit, Skip, Escape, keyboard, full read, reopen;
//   - Back/Forward over #letter; a back/forward-cache restore, reported as
//     verified only when the browser really restored the page; and fast
//     Back/Forward, including a forced order where the closed letter's close
//     event arrives after Forward has opened the letter again;
//   - a letter.js that fails to load and storage that refuses writes;
//   - reduced motion.
//
// runLetterChecks returns a tally rather than one number: assertions (state,
// geometry, contrast and history comparisons), hit points (elementFromPoint
// probes), real mouse clicks and key presses sent through CDP, fast
// Back/Forward runs, and what happened to the back/forward-cache check.

const LETTER_KEY = "teachometry-letter-v1";
const WIDTHS = [320, 390, 768, 1024, 1440];
const HOMES = ["/", "/zh-cn/"];
const RACE_RUNS = Math.max(1, Number.parseInt(process.env.LETTER_RACE_RUNS ?? "30", 10) || 30);

// --- Functions below run inside the page (serialised with Function#toString). ---
/* global NodeFilter, document, getComputedStyle, history, innerHeight, innerWidth, localStorage, location, navigation */

function scaleText(factor) {
  const all = [...document.querySelectorAll("body, body *")];
  const sizes = all.map((el) => parseFloat(getComputedStyle(el).fontSize));
  all.forEach((el, i) => el.style.setProperty("font-size", `${sizes[i] * factor}px`, "important"));
  return true;
}

// WCAG 1.4.12 text spacing inside the letter.
function textSpacing() {
  const style = document.createElement("style");
  style.textContent = "#home-letter * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } #home-letter p { margin-bottom: 2em !important; }";
  document.head.append(style);
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

// URL, dialog, focus and session history, for the fast Back/Forward checks.
function raceState() {
  const dialog = document.getElementById("home-letter");
  const entries = typeof navigation === "object" && navigation !== null ? navigation.entries().map((entry) => entry.url) : null;
  return {
    hash: location.hash,
    open: dialog.open,
    modal: dialog.matches(":modal"),
    focusInDialog: dialog.contains(document.activeElement),
    state: dialog.dataset.letterState ?? null,
    length: history.length,
    entries,
    index: entries === null ? null : navigation.currentEntry.index,
  };
}

// While the letter is open every visible header control is covered by it.
function letterCoversHeader() {
  const dialog = document.getElementById("home-letter");
  const controls = [...document.querySelectorAll("header.site-header a, header.site-header button, header.site-header select")]
    .filter((el) => el.getBoundingClientRect().width > 0);
  const problems = [];
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!dialog || !dialog.contains(hit)) problems.push(`header control not covered: ${el.outerHTML.slice(0, 60)}`);
  }
  return { assertions: 0, hitPoints: controls.length, problems };
}

// A control is inside the viewport and owns its centre and the points just inside each edge.
function controlProbe(selector, scroll) {
  const el = document.querySelector(selector);
  if (!el) return { assertions: 1, hitPoints: 0, problems: [`${selector} missing`] };
  if (scroll) el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return { assertions: 1, hitPoints: 0, problems: [`${selector} not rendered`] };
  const problems = [];
  if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) {
    problems.push(`${selector} leaves the ${innerWidth}x${innerHeight} viewport: ${[r.left, r.top, r.right, r.bottom].map(Math.round).join(",")}`);
  }
  const points = [["center", r.left + r.width / 2, r.top + r.height / 2], ["left", r.left + 4, r.top + r.height / 2], ["right", r.right - 4, r.top + r.height / 2], ["top", r.left + r.width / 2, r.top + 3], ["bottom", r.left + r.width / 2, r.bottom - 3]];
  for (const [name, x, y] of points) {
    const hit = document.elementFromPoint(x, y);
    if (!(hit === el || el.contains(hit))) problems.push(`${selector} @${name} -> ${hit?.outerHTML.slice(0, 60) ?? "nothing"}`);
  }
  return { assertions: 1, hitPoints: points.length, problems };
}

// Layout of the open letter: nothing wider than the viewport, the bar's parts
// apart, and the paper inside the viewport.
function letterLayoutProbe() {
  const problems = [];
  let assertions = 0;
  const expect = (ok, message) => { assertions += 1; if (!ok) problems.push(message); };
  const vw = innerWidth;
  const vh = innerHeight;
  const dialog = document.getElementById("home-letter");
  const box = (el) => el.getBoundingClientRect();
  const outside = (r) => r.left < -0.5 || r.right > vw + 0.5;
  const fmt = (r) => [r.left, r.top, r.right, r.bottom].map(Math.round).join(",");
  for (const selector of [".letter-bar", ".letter-brand-name", ".letter-language", "[data-letter-skip]"]) {
    const r = box(dialog.querySelector(selector));
    expect(!outside(r) && r.top >= -0.5 && r.bottom <= vh + 0.5, `${selector} outside viewport: ${fmt(r)}`);
  }
  const parts = [".letter-brand-name", ".letter-language", "[data-letter-skip]"].map((s) => [s, box(dialog.querySelector(s))]);
  for (let i = 0; i < parts.length; i += 1) {
    for (let j = i + 1; j < parts.length; j += 1) {
      const [a, ra] = parts[i];
      const [b, rb] = parts[j];
      expect(ra.right <= rb.left + 0.5 || rb.right <= ra.left + 0.5 || ra.bottom <= rb.top + 0.5 || rb.bottom <= ra.top + 0.5, `${a} overlaps ${b}`);
    }
  }
  const state = dialog.dataset.letterState;
  if (state === "sealed") {
    for (const selector of ["[data-letter-envelope]", ".envelope-address", ".letter-hint"]) {
      const r = box(dialog.querySelector(selector));
      expect(!outside(r), `${selector} wider than viewport: ${fmt(r)}`);
    }
    // The address has its own space below the seal.
    const seal = box(dialog.querySelector(".envelope-seal"));
    const address = box(dialog.querySelector(".envelope-address"));
    expect(address.top >= seal.bottom - 0.5, `address ${fmt(address)} runs into the seal ${fmt(seal)}`);
    const envelope = box(dialog.querySelector("[data-letter-envelope]"));
    expect(address.bottom <= envelope.bottom + 0.5, `address ${fmt(address)} spills out of the envelope ${fmt(envelope)}`);
  }
  if (state === "reading") {
    const paper = box(dialog.querySelector("[data-letter-paper]"));
    const scroller = dialog.querySelector("[data-letter-scroll]");
    expect(!outside(paper) && paper.top >= -0.5 && paper.bottom <= vh + 0.5, `paper outside viewport: ${fmt(paper)}`);
    expect(paper.height >= 120, `paper too short to read: ${Math.round(paper.height)}px`);
    expect(scroller.scrollWidth <= scroller.clientWidth + 1, `letter text scrolls sideways: ${scroller.scrollWidth} > ${scroller.clientWidth}`);
  }
  return { assertions, hitPoints: 0, problems };
}

// Every line of text in the open letter, measured as a text Range: a flex
// item or a right-aligned line can run past the paper while its parent box
// stays inside. Each line must lie inside every box that clips it sideways
// (its ancestors up to the dialog, and the viewport), must not overlap a
// line of another text, and must be reachable by scrolling into the band the
// fade mask leaves fully visible. Then the third hope, the signature and the
// last paragraph are scrolled to for real, measured again and hit-tested,
// and the letter is scrolled to its very end. Drawn marks must not be cut off.
function letterTextFitProbe() {
  const dialog = document.getElementById("home-letter");
  const scroller = dialog.querySelector("[data-letter-scroll]");
  const problems = [];
  let assertions = 0;
  let hitPoints = 0;
  const expect = (ok, message) => { assertions += 1; if (!ok) problems.push(message); return ok; };
  const round = (value) => Math.round(value);
  const client = (el) => {
    const r = el.getBoundingClientRect();
    const left = r.left + el.clientLeft;
    const top = r.top + el.clientTop;
    return { left, top, right: left + el.clientWidth, bottom: top + el.clientHeight };
  };
  const clipOf = (start) => {
    let left = 0;
    let right = innerWidth;
    for (let n = start; n; n = n.parentElement) {
      if (getComputedStyle(n).overflowX !== "visible") {
        const c = client(n);
        left = Math.max(left, c.left);
        right = Math.min(right, c.right);
      }
      if (n === dialog) break;
    }
    return { left, right };
  };
  const linesIn = (root) => {
    const lines = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim() || node.parentElement.closest("[hidden], .visually-hidden")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) if (r.width >= 0.5 && r.height >= 0.5) lines.push({ node, r });
    }
    return lines;
  };
  const quote = (node) => `"${node.textContent.replace(/­/gu, "").trim().slice(0, 26)}"`;

  // The band the fade mask leaves fully visible.
  const style = getComputedStyle(scroller);
  const mask = style.maskImage && style.maskImage !== "none" ? style.maskImage : style.webkitMaskImage;
  let fadeTop = 0;
  let fadeBottom = 0;
  if (mask && mask !== "none") {
    const match = mask.match(/([\d.]+)px[^]*?calc\(100% - ([\d.]+)px\)/u);
    if (!expect(match !== null, `the letter's fade mask is not understood: ${mask}`)) return { assertions, hitPoints, problems };
    fadeTop = Number(match[1]);
    fadeBottom = Number(match[2]);
  }
  const band = scroller.clientHeight - fadeTop - fadeBottom;
  const maxScroll = scroller.scrollHeight - scroller.clientHeight;
  scroller.scrollTo({ top: 0, behavior: "instant" });
  const view = client(scroller);

  const lines = linesIn(scroller);
  expect(lines.length >= 20, `only ${lines.length} lines of letter text found`);
  for (const { node, r } of lines) {
    const clip = clipOf(node.parentElement);
    expect(r.left >= clip.left - 0.5 && r.right <= clip.right + 0.5, `${quote(node)} runs out of the visible paper: ${round(r.left)}..${round(r.right)} outside ${round(clip.left)}..${round(clip.right)}`);
    const y = r.top - view.top;
    const lowest = Math.max(0, y + r.height - (scroller.clientHeight - fadeBottom));
    const highest = Math.min(maxScroll, y - fadeTop);
    expect(lowest <= highest + 0.5, `${quote(node)} can never be scrolled clear of the fade: line ${round(y)}..${round(y + r.height)} of ${scroller.scrollHeight}px, clear band ${round(band)}px`);
  }
  const overlaps = [];
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const a = lines[i];
      const b = lines[j];
      if (a.node === b.node) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 1 && h > 1) overlaps.push(`${quote(a.node)} overlaps ${quote(b.node)}`);
    }
  }
  expect(overlaps.length === 0, overlaps.slice(0, 3).join("; "));

  for (const el of dialog.querySelectorAll(".letter-mark, .letter-flourish, .letter-rule")) {
    const r = el.getBoundingClientRect();
    if (r.width < 0.5) continue;
    const clip = clipOf(el.parentElement);
    expect(r.left >= clip.left - 0.5 && r.right <= clip.right + 0.5, `${el.getAttribute("class")} cut off at the paper's edge: ${round(r.left)}..${round(r.right)} outside ${round(clip.left)}..${round(clip.right)}`);
  }

  // Scrolled to for real: every given line fully inside the clear band, and the text owns its centre.
  const seen = (label, lines) => {
    const now = client(scroller);
    const top = now.top + fadeTop;
    const bottom = now.bottom - fadeBottom;
    for (const { node, r } of lines) {
      const clip = clipOf(node.parentElement);
      expect(r.top >= top - 0.5 && r.bottom <= bottom + 0.5 && r.left >= clip.left - 0.5 && r.right <= clip.right + 0.5, `${label}: ${quote(node)} not fully visible: ${[r.left, r.top, r.right, r.bottom].map(round).join(",")} in ${round(clip.left)},${round(top)},${round(clip.right)},${round(bottom)}`);
      hitPoints += 1;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!(hit && (hit === node.parentElement || node.parentElement.contains(hit)))) problems.push(`${label}: ${quote(node)} is covered by ${hit?.outerHTML.slice(0, 60) ?? "nothing"}`);
    }
  };
  const targets = [
    ["third hope", dialog.querySelectorAll(".letter-hope h3")[2]],
    ["signature", dialog.querySelector(".letter-signature")],
    ["postscript", dialog.querySelector(".letter-postscript")],
  ];
  for (const [label, el] of targets) {
    if (!expect(Boolean(el), `${label} missing`)) continue;
    // Glyphs can stand a little above or below their element's box (line-height 1).
    const extent = (all) => all.reduce((acc, { r }) => [Math.min(acc[0], r.top), Math.max(acc[1], r.bottom)], [Infinity, -Infinity]);
    const [first, last] = extent(linesIn(el));
    if (!expect(last - first <= band + 0.5, `${label} is taller (${round(last - first)}px) than the clear band (${round(band)}px)`)) continue;
    scroller.scrollTo({ top: scroller.scrollTop + first - (client(scroller).top + fadeTop), behavior: "instant" });
    seen(label, linesIn(el));
  }
  // At the very end, the letter's last line is fully clear.
  scroller.scrollTo({ top: scroller.scrollHeight, behavior: "instant" });
  const ending = linesIn(scroller);
  const lastTop = Math.max(...ending.map(({ r }) => r.top));
  seen("end of the letter", ending.filter(({ r }) => r.bottom > lastTop + 1));
  scroller.scrollTo({ top: 0, behavior: "instant" });
  return { assertions, hitPoints, problems };
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
  let assertions = 0;
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
    for (const surface of surfaces(el)) {
      assertions += 1;
      const value = ratio(over(color, surface), surface);
      if (value < minimum) problems.push(`${value.toFixed(2)}:1 "${node.textContent.trim().slice(0, 28)}" (${el.className || el.tagName})`);
    }
  }
  return { assertions, hitPoints: 0, problems };
}

// The Home entry has its own space: no shared pixels with the scroll cue or the handwritten note.
function entryLayoutProbe() {
  const entry = document.querySelector(".home-letter-entry");
  if (!entry) return { assertions: 1, hitPoints: 0, problems: ["entry missing"] };
  const problems = [];
  let assertions = 0;
  const expect = (ok, message) => { assertions += 1; if (!ok) problems.push(message); };
  entry.scrollIntoView({ block: "center", behavior: "instant" });
  const r = entry.getBoundingClientRect();
  expect(getComputedStyle(entry).visibility === "visible" && r.width >= 1, "entry not visible");
  expect(r.left >= -0.5 && r.right <= innerWidth + 0.5, `entry wider than viewport: ${Math.round(r.left)}..${Math.round(r.right)}`);
  for (const selector of [".hero-note", ".scroll-cue", ".case-walkthrough"]) {
    const other = document.querySelector(selector)?.getBoundingClientRect();
    if (other) expect(r.right <= other.left || other.right <= r.left || r.bottom <= other.top || other.bottom <= r.top, `entry overlaps ${selector}`);
  }
  return { assertions, hitPoints: 0, problems };
}

function locateCenter(selector) {
  const el = [...document.querySelectorAll(selector)].find((x) => x.getBoundingClientRect().width > 0);
  if (!el) return null;
  el.scrollIntoView({ block: "center", behavior: "instant" });
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

// Installed before the page's scripts, for the fast Back/Forward checks only:
// while window.__letterHold is true, the letter dialog's close listeners are
// queued instead of run, so a close event can be delivered after Forward has
// already opened the letter again. The browser dispatches a close event a
// task or two after close(), so the script also counts closes and dispatched
// close events; the checks wait until they match before holding or releasing.
const HOLD_CLOSE_EVENTS = `(() => {
  const add = EventTarget.prototype.addEventListener;
  const close = HTMLDialogElement.prototype.close;
  const counted = new WeakSet();
  window.__letterHold = false;
  window.__letterHeld = [];
  window.__letterCloses = 0;
  window.__letterCloseEvents = 0;
  HTMLDialogElement.prototype.close = function (...args) {
    if (this.id === "home-letter" && this.open) window.__letterCloses += 1;
    return close.apply(this, args);
  };
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (type === "close" && this instanceof HTMLDialogElement && this.id === "home-letter" && typeof listener === "function") {
      const target = this;
      return add.call(this, type, function (event) {
        if (!counted.has(event)) { counted.add(event); window.__letterCloseEvents += 1; }
        if (window.__letterHold) { window.__letterHeld.push(() => listener.call(target, event)); return undefined; }
        return listener.call(this, event);
      }, options);
    }
    return add.call(this, type, listener, options);
  };
})();`;
const QUIET = "window.__letterCloses === window.__letterCloseEvents";
const HOLD = "window.__letterHold = true";
const RELEASE = "(() => { window.__letterHold = false; const held = window.__letterHeld.splice(0); for (const run of held) { try { run(); } catch (error) { setTimeout(() => { throw error; }); } } return held.length; })()";
// Back, and Forward the moment Back has landed (and the other way round).
const BACK_THEN_FORWARD = "new Promise((done) => { addEventListener('popstate', () => { history.forward(); done(true); }, { once: true }); history.back(); })";
const FORWARD_THEN_BACK = "new Promise((done) => { addEventListener('popstate', () => { history.back(); done(true); }, { once: true }); history.forward(); })";
const OPEN = "location.hash === '#letter' && document.getElementById('home-letter').open";
const CLOSED = "location.hash === '' && !document.getElementById('home-letter').open";

// Waits inside the page until the letter is open at #letter (open true) or
// closed without it (open false; null skips the wait), then samples it every
// few milliseconds for holdMs: a late close callback would undo the state
// within a few milliseconds. Returns what is wrong, if anything: the URL, the
// dialog, :modal and focus must agree, and the session history must be the
// one right after opening (base), at its last entry when open and the one
// before it when closed.
function raceSettle(open, holdMs, timeoutMs, base) {
  const dialog = document.getElementById("home-letter");
  if (!dialog) return Promise.resolve([`the page left Home: ${location.href}`]);
  const read = () => {
    const entries = typeof navigation === "object" && navigation !== null ? navigation.entries().map((entry) => entry.url) : null;
    return {
      hash: location.hash,
      open: dialog.open,
      modal: dialog.matches(":modal"),
      focusInDialog: dialog.contains(document.activeElement),
      length: history.length,
      entries,
      index: entries === null ? null : navigation.currentEntry.index,
    };
  };
  const wrong = (state) => {
    const problems = [];
    if ((state.hash === "#letter") !== state.open) problems.push(`URL ${state.hash || "without a hash"} but the letter is ${state.open ? "open" : "closed"}`);
    if (open !== null && state.open !== open) problems.push(`letter ${state.open ? "open" : "closed"}, expected ${open ? "open" : "closed"}`);
    if (state.modal !== state.open) problems.push(`:modal is ${state.modal} while open is ${state.open}`);
    if (state.focusInDialog !== state.open) problems.push(`focus is ${state.focusInDialog ? "inside" : "outside"} the ${state.open ? "open" : "closed"} letter`);
    if (state.length !== base.length) problems.push(`history.length ${state.length}, was ${base.length}`);
    if (base.entries !== null) {
      if (JSON.stringify(state.entries) !== JSON.stringify(base.entries)) problems.push(`history entries changed: ${state.entries.slice(-3).join(" | ")}`);
      const expected = state.open ? base.index : base.index - 1;
      if (state.index !== expected) problems.push(`history index ${state.index}, expected ${expected}`);
    }
    return problems;
  };
  return new Promise((done) => {
    const started = performance.now();
    let reached = open === null ? started : null;
    const tick = () => {
      const state = read();
      const now = performance.now();
      if (reached === null && state.open === open && (state.hash === "#letter") === open) reached = now;
      if (reached === null) {
        if (now - started > timeoutMs) {
          done([`did not become ${open ? "open at #letter" : "closed without #letter"} within ${timeoutMs} ms (URL ${state.hash || "without a hash"}, letter ${state.open ? "open" : "closed"})`]);
          return;
        }
      } else {
        const problems = wrong(state);
        if (problems.length > 0 || now - reached >= holdMs) { done(problems); return; }
      }
      setTimeout(tick, 4);
    };
    tick();
  });
}

// --- Driver ---------------------------------------------------------------------

const pause = (ms) => new Promise((done) => setTimeout(done, ms));
let visitNumber = 0;
// A query string makes every visit a new document, even to the same #letter URL.
const fresh = (origin, home, hash = "") => `${origin}${home}?letter-check=${(visitNumber += 1)}${hash}`;

async function waitFor(page, expression, timeoutMs) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    try { if (await page.evaluate(expression)) return true; } catch { /* the document may be changing */ }
    if (Date.now() > end) return false;
    await pause(25);
  }
}

async function key(page, name, code, keyCode) {
  // Enter needs its text so the focused button is activated as a real key press would.
  const text = name === "Enter" ? { text: "\r", unmodifiedText: "\r" } : {};
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: name, code, windowsVirtualKeyCode: keyCode, ...text });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: name, code, windowsVirtualKeyCode: keyCode });
}

const media = (page, features) => page.send("Emulation.setEmulatedMedia", { features });
const REDUCED = { name: "prefers-reduced-motion", value: "reduce" };

export async function runLetterChecks(page, origin, failures, diagnostics) {
  const tally = { assertions: 0, hitPoints: 0, clicks: 0, keys: 0, raceRuns: 0, heldCloseEvents: 0, bfcache: "not run", seconds: {} };
  let lapStarted = Date.now();
  const lap = (name) => { tally.seconds[name] = Math.round((Date.now() - lapStarted) / 100) / 10; lapStarted = Date.now(); };
  const check = (ok, message) => { tally.assertions += 1; if (!ok) failures.push(message); return ok; };
  const report = (label, result) => {
    tally.assertions += result.assertions;
    tally.hitPoints += result.hitPoints;
    result.problems.forEach((problem) => failures.push(`${label}: ${problem}`));
  };
  const snapshot = async () => {
    try { return JSON.stringify(await page.call(letterState)); } catch (error) { return `unavailable (${error.message})`; }
  };
  // A wait that must succeed: a timeout is reported with the page state, never passed over.
  const until = async (label, expression, timeoutMs = 4000) => {
    tally.assertions += 1;
    if (await waitFor(page, expression, timeoutMs)) return true;
    failures.push(`${label}: timed out after ${timeoutMs} ms waiting for ${expression}; state ${await snapshot()}`);
    return false;
  };
  const press = async (name, code, keyCode) => { tally.keys += 1; await key(page, name, code, keyCode); };
  // A real mouse click at the centre of the first visible match.
  const click = async (label, selector) => {
    const point = await page.call(locateCenter, selector);
    if (!check(point !== null, `${label}: nothing to click for ${selector}`)) return false;
    tally.clicks += 1;
    await page.click(point[0], point[1]);
    return true;
  };
  // Storage is cleared on a page nothing links to: a link the pointer rests on
  // may already be prerendered (speculation rules), and navigating to it then
  // activates that prerender instead of loading a document.
  const firstVisit = async (url) => {
    await page.goto(`${origin}/404.html`);
    await page.evaluate("localStorage.clear()");
    await page.goto(url);
  };

  // 1. Layout matrix: every width, both languages, light and dark, normal and
  //    doubled text. Reduced motion makes the envelope open at once; #letter
  //    opens it on any visit.
  for (const width of WIDTHS) {
    await page.viewport(width, width < 700 ? 844 : 900);
    for (const scheme of width === 1440 ? ["light"] : ["light", "dark"]) {
      await media(page, [REDUCED, { name: "prefers-color-scheme", value: scheme }]);
      for (const home of HOMES) {
        for (const zoom of [1, 2]) {
          const label = `letter layout ${width}px ${home} ${scheme} x${zoom}`;
          await page.goto(fresh(origin, home, "#letter"));
          if (zoom !== 1) await page.call(scaleText, zoom);
          await page.settled();
          if (!check((await page.call(letterState)).open, `${label}: #letter did not open the letter`)) continue;
          report(`${label} sealed`, await page.call(letterLayoutProbe));
          report(`${label} sealed`, await page.call(controlProbe, "[data-letter-skip]", false));
          report(`${label} sealed`, await page.call(controlProbe, "[data-letter-envelope]", true));
          await click(label, "[data-letter-envelope]");
          await page.settled();
          const state = await page.call(letterState);
          if (!check(state.state === "reading", `${label}: a real click on the envelope did not open the letter (${JSON.stringify(state)})`)) continue;
          report(`${label} reading`, await page.call(letterLayoutProbe));
          report(`${label} reading text`, await page.call(letterTextFitProbe));
          report(`${label} reading`, await page.call(controlProbe, "[data-letter-skip]", false));
          report(`${label} reading`, await page.call(controlProbe, "[data-letter-next]", false));
          report(`${label} reading`, await page.call(controlProbe, ".letter-language", false));
        }
      }
    }
  }

  lap("layout");

  // Wider type. This machine's serif fallback is narrower than Georgia, with
  // which the third hope's title once ran past the paper at 320 px. WCAG 1.4.12
  // text spacing on doubled text widens every line the same way on any machine.
  await media(page, [REDUCED]);
  for (const width of [320, 390]) {
    await page.viewport(width, 844);
    for (const home of HOMES) {
      const label = `letter text ${width}px ${home} x2 with WCAG text spacing`;
      await page.goto(fresh(origin, home, "#letter"));
      await page.call(scaleText, 2);
      await page.call(textSpacing);
      await page.settled();
      if (!check((await page.call(letterState)).open, `${label}: #letter did not open the letter`)) continue;
      await click(label, "[data-letter-envelope]");
      await page.settled();
      if (!check((await page.call(letterState)).state === "reading", `${label}: the letter did not open for reading`)) continue;
      report(label, await page.call(letterTextFitProbe));
    }
  }

  lap("wider type");

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

  lap("entry");

  // Reduced motion: no automatic letter; the entry opens it fully inked.
  await page.viewport(1024, 900);
  for (const home of HOMES) {
    const label = `letter reduced motion ${home}`;
    await firstVisit(fresh(origin, home));
    let state = await page.call(letterState);
    check(!state.open && state.entryVisible, `${label}: expected Home with the entry (${JSON.stringify(state)})`);
    await click(label, ".home-letter-entry");
    if (await until(`${label}: entry opens the letter`, "document.getElementById('home-letter').open")) {
      state = await page.call(letterState);
      check(state.state === "reading" && state.inked === 8 && state.mode === "enter", `${label}: entry did not open a fully inked letter (${JSON.stringify(state)})`);
    }
    await press("Escape", "Escape", 27);
    // Closing steps back over the entry's #letter history entry; that traversal
    // is asynchronous, so wait for it before the next navigation.
    await until(`${label}: Escape returns to Home`, CLOSED);
    state = await page.call(letterState);
    check(!state.open && state.url === home, `${label}: Escape did not return to Home (${JSON.stringify(state)})`);
  }
  await media(page, []);

  lap("reduced motion");

  // 3. Contrast before and after the reader reaches a passage, light and dark.
  for (const scheme of ["light", "dark"]) {
    await media(page, [{ name: "prefers-color-scheme", value: scheme }]);
    for (const home of HOMES) {
      const label = `letter contrast ${scheme} ${home}`;
      await page.goto(fresh(origin, home, "#letter"));
      await page.settled();
      report(`${label} sealed`, await page.call(letterContrastProbe, 4.5));
      await click(label, "[data-letter-envelope]");
      await until(`${label}: the envelope opens`, "document.getElementById('home-letter').dataset.letterState === 'reading'");
      await pause(1600);
      const unread = await page.call(letterState);
      if (unread.inked >= 8) diagnostics.add(`${label}: every passage was already inked, so the unread state was not measured`);
      report(`${label} reading`, await page.call(letterContrastProbe, 4.5));
    }
  }
  await media(page, []);

  lap("contrast");

  // 4. First visit, Skip, repeat visit, and Home right after.
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.viewport(width, height);
    for (const home of HOMES) {
      const label = `letter first visit ${width}px ${home}`;
      await firstVisit(fresh(origin, home));
      const state = await page.call(letterState);
      check(state.open && state.state === "sealed", `${label}: first visit did not open the sealed letter (${JSON.stringify(state)})`);
      check(state.stored === "1", `${label}: first visit was not remembered`);
      check(state.focus === "letter-envelope", `${label}: focus starts on ${state.focus}, not the envelope`);
      check(state.ready, `${label}: letter.js did not mark itself ready`);
      report(label, await page.call(letterCoversHeader));
      report(label, await page.call(controlProbe, "[data-letter-skip]", false));
      await click(label, "[data-letter-skip]");
      await until(`${label}: Skip closes the letter`, "!document.getElementById('home-letter').open");
      report(`${label} after skip`, await page.call(controlProbe, ".home-actions a.button-primary", true));
      await page.goto(fresh(origin, home));
      check(!(await page.call(letterState)).open, `${label}: letter reopened on a repeat visit`);
    }
  }

  lap("first visit");

  // 5. Keyboard: Escape, Enter on the envelope, reading, and the entry with focus return.
  await page.viewport(1440, 900);
  for (const home of HOMES) {
    const label = `letter keyboard ${home}`;
    await firstVisit(fresh(origin, home));
    await press("Escape", "Escape", 27);
    await until(`${label}: Escape closes the first-visit letter`, "!document.getElementById('home-letter').open");
    await page.evaluate("location.hash = '#letter'");
    await until(`${label}: #letter opens the letter`, "document.getElementById('home-letter').open");
    await press("Enter", "Enter", 13);
    await until(`${label}: Enter on the envelope opens it`, "document.getElementById('home-letter').dataset.letterState === 'reading'");
    let state = await page.call(letterState);
    check(state.state === "reading" && state.focus === "letter-scroll", `${label}: Enter did not open the letter for reading (${JSON.stringify(state)})`);
    await press("Escape", "Escape", 27);
    await until(`${label}: Escape closes the letter`, CLOSED);
    state = await page.call(letterState);
    check(!state.open && !state.url.includes("#"), `${label}: Escape left ${JSON.stringify(state)}`);
    await click(label, ".home-letter-entry");
    await until(`${label}: the entry opens the letter`, OPEN);
    state = await page.call(letterState);
    check(state.state === "reading" && state.url === `${home}#letter`, `${label}: Home entry did not open the letter at #letter (${JSON.stringify(state)})`);
    await press("Escape", "Escape", 27);
    await until(`${label}: Escape returns to Home`, CLOSED);
    state = await page.call(letterState);
    check(!state.open && state.focus === "home-letter-entry" && state.url === home, `${label}: closing did not return to Home with focus on the entry (${JSON.stringify(state)})`);
  }

  lap("keyboard");

  // 6. A full read: Continue until the end, then Enter Teachometry.
  {
    const label = "letter full read";
    await firstVisit(fresh(origin, "/"));
    await click(label, "[data-letter-envelope]");
    await until(`${label}: the envelope opens`, "document.getElementById('home-letter').dataset.letterState === 'reading'");
    for (let step = 0; step < 12 && (await page.call(letterState)).mode !== "enter"; step += 1) {
      await click(label, "[data-letter-next]");
      await pause(250);
    }
    let state = await page.call(letterState);
    check(state.mode === "enter" && state.inked === 8, `${label}: Continue did not reach the end (${JSON.stringify(state)})`);
    await click(label, "[data-letter-next]");
    await until(`${label}: Enter Teachometry closes the letter`, "!document.getElementById('home-letter').open", 3000);
    state = await page.call(letterState);
    check(!state.open && state.url === "/", `${label}: Enter Teachometry did not lead into Home (${JSON.stringify(state)})`);
    report(label, await page.call(controlProbe, ".home-actions a.button-primary", true));
  }

  lap("full read");

  // 7. History: Back and Forward over #letter follow the URL; closing adds no
  //    entry, so one more Back leaves Home for the page before it.
  {
    const label = "letter history";
    const before = fresh(origin, "/");
    await page.goto(before);
    await page.goto(fresh(origin, "/"));
    await click(label, ".home-letter-entry");
    await until(`${label}: the entry opens the letter`, OPEN);
    await page.evaluate("history.back()");
    await until(`${label}: Back closes the letter`, CLOSED);
    await page.evaluate("history.forward()");
    await until(`${label}: Forward shows the letter`, OPEN);
    await click(label, "[data-letter-skip]");
    await until(`${label}: Skip closes the letter and drops #letter`, CLOSED);
    const state = await page.call(letterState);
    check(!state.open && state.url === "/", `${label}: Skip after Forward left ${JSON.stringify(state)}`);
    // The previous page may come back from the back/forward cache (no load event).
    await page.evaluate("history.back()");
    await until(`${label}: one more Back reaches the page before Home (closing added no entry)`, `location.href === ${JSON.stringify(before)} && document.readyState === "complete"`, 6000);
  }

  lap("history");

  // 8. Back/forward cache: a delivered letter is not shown again on restore.
  //    Only a page that really comes back from the cache verifies this; a
  //    browser that reloads it instead checks the reload path, and says so.
  {
    const label = "letter bfcache";
    await firstVisit(fresh(origin, "/"));
    await page.evaluate("window.__letterCheck = 'kept'");
    const point = await page.call(locateCenter, ".letter-language");
    if (check(point !== null, `${label}: no language link to click`)) {
      tally.clicks += 1;
      await page.navigation(() => page.click(point[0], point[1]));
    }
    let state = await page.call(letterState);
    check(state.open && state.url === "/zh-cn/#letter", `${label}: language link did not open the Chinese letter (${JSON.stringify(state)})`);
    await page.evaluate("history.back()");
    await until(`${label}: Back returns to the English Home`, "location.pathname === '/' && document.readyState === 'complete'", 6000);
    await page.settled();
    const restored = await page.evaluate("window.__letterCheck === 'kept'");
    state = await page.call(letterState);
    if (restored) {
      tally.bfcache = "restored from the cache and verified";
      check(!state.open, `${label}: the restored page showed the already delivered letter again (${JSON.stringify(state)})`);
    } else {
      const reasons = await page.evaluate("JSON.stringify(performance.getEntriesByType('navigation')[0]?.notRestoredReasons ?? null)");
      tally.bfcache = "NOT verified (this browser reloaded the page; the reload path was checked instead)";
      diagnostics.add(`${label}: not verified. This browser reloaded the page instead of restoring it from the back/forward cache (not-restored reasons: ${reasons}); only the reload path was checked.`);
      check(!state.open, `${label} (reload path): going back showed the already delivered letter again (${JSON.stringify(state)})`);
    }
    report(label, await page.call(controlProbe, ".home-actions a.button-primary", true));
  }

  lap("bfcache");

  // 9. letter.js unavailable: Home directly, no dead envelope, no dead entry.
  await page.send("Network.setBlockedURLs", { urls: ["*/assets/letter.js"] });
  for (const hash of ["", "#letter"]) {
    const label = `letter without letter.js ${hash || "first visit"}`;
    await firstVisit(fresh(origin, "/", hash));
    await page.settled();
    const state = await page.call(letterState);
    check(!state.open && !state.ready && !state.entryVisible, `${label}: expected plain Home (${JSON.stringify(state)})`);
    report(label, await page.call(controlProbe, ".home-actions a.button-primary", true));
  }
  await page.send("Network.setBlockedURLs", { urls: [] });

  lap("no letter.js");

  // 10. Storage that refuses writes: the visit cannot be remembered, so Home directly, every time.
  {
    const { identifier } = await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: "Storage.prototype.setItem = function () { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); };",
    });
    for (const round of [1, 2]) {
      const label = `letter storage full visit ${round}`;
      if (round === 1) await firstVisit(fresh(origin, "/"));
      else await page.goto(fresh(origin, "/"));
      check(!(await page.call(letterState)).open, `${label}: the letter opened although the visit cannot be remembered`);
      report(label, await page.call(controlProbe, ".home-actions a.button-primary", true));
    }
    await page.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  }

  lap("storage");

  // 11. Fast Back/Forward. Closing a dialog queues its close event as a
  //     separate task, so Forward can open the letter again before the close
  //     event of the letter Back just closed arrives. Each case first forces
  //     that order (the page holds close events back until Forward has opened
  //     the letter), then runs real back-to-back traversals RACE_RUNS times.
  //     After every step the URL, the dialog, :modal, focus and the session
  //     history must agree, and stay that way. A case stops at its first
  //     failure, so one defect is reported once rather than as a cascade.
  {
    const { identifier } = await page.send("Page.addScriptToEvaluateOnNewDocument", { source: HOLD_CLOSE_EVENTS });
    await page.viewport(1024, 900);
    for (const motion of ["normal", "reduced"]) {
      await media(page, motion === "reduced" ? [REDUCED] : []);
      for (const source of ["entry", "link"]) {
        const label = `letter fast history, ${motion} motion, opened by ${source === "entry" ? "the Home entry" : "a #letter link"}`;
        const stop = new Error("stop");
        const need = (ok) => { if (!ok) throw stop; };
        try {
          const before = `${origin}/404.html?letter-race=${(visitNumber += 1)}`;
          await page.goto(before);
          await page.evaluate(`localStorage.setItem(${JSON.stringify(LETTER_KEY)}, "1")`);
          await page.goto(fresh(origin, "/"));
          if (source === "entry") need(await click(label, ".home-letter-entry"));
          else await page.evaluate("location.hash = '#letter'");
          need(await until(`${label}: the letter opens`, OPEN));
          const base = await page.call(raceState);
          const settle = async (step, open, holdMs) => {
            const problems = await page.call(raceSettle, open, holdMs, 3000, base);
            need(check(problems.length === 0, `${label}: ${step}: ${problems.join("; ")}`));
          };
          // Every close so far has had its close event dispatched (held or not).
          const quiet = async (step) => need(await until(`${label}: ${step}: close event dispatched`, QUIET, 2000));
          const hold = async (step) => { await quiet(step); await page.evaluate(HOLD); };
          const release = async (step, expected) => {
            const held = await page.evaluate(RELEASE);
            tally.heldCloseEvents += held;
            need(check(held === expected, `${label}: ${step}: ${held} close events were held, expected ${expected}; the late delivery was not exercised as intended`));
          };

          // a. Back, then Forward; the close event of the letter Back closed arrives last.
          if (motion === "normal" && source === "link") {
            // The envelope is opening, its timer running, when Back closes it.
            need(await click(label, "[data-letter-envelope]"));
          }
          await hold("before Back");
          await page.evaluate("history.back()");
          await settle("held: Back", false, 0);
          await quiet("held Back");
          await page.evaluate("history.forward()");
          await settle("held: Forward", true, 0);
          await release("held Back then Forward", 1);
          await settle("Back then Forward, old close event delivered after the new letter opened", true, motion === "normal" && source === "link" ? 2300 : 400);
          need(check((await page.call(raceState)).state === "sealed", `${label}: the letter Forward opened did not stay sealed; a timer of the closed letter ran into it`));

          // b. Forward, then Back; the close event arrives last.
          await page.evaluate("history.back()");
          await settle("Back", false, 0);
          await hold("before Forward");
          await page.evaluate("history.forward()");
          await settle("held: Forward", true, 0);
          await page.evaluate("history.back()");
          await settle("held: Back", false, 0);
          await quiet("held Back");
          await release("held Forward then Back", 1);
          await settle("Forward then Back, close event delivered last", false, 400);

          // c. Forward, Back, Forward, Back, Forward; every close event held to the end.
          await hold("before the burst");
          for (const [step, open] of [["Forward", true], ["Back", false], ["Forward", true], ["Back", false], ["Forward", true]]) {
            await page.evaluate(open ? "history.forward()" : "history.back()");
            await settle(`held burst: ${step}`, open, 0);
            if (!open) await quiet(`held burst: ${step}`);
          }
          await release("held burst", 2);
          await settle("burst ending on Forward, close events delivered last", true, 400);

          // d. Real traversals, each started the moment the previous one landed.
          for (let run = 1; run <= RACE_RUNS; run += 1) {
            await page.evaluate(BACK_THEN_FORWARD);
            tally.raceRuns += 1;
            await settle(`run ${run}: Back then Forward at once`, true, 40);
          }
          for (let run = 1; run <= RACE_RUNS; run += 1) {
            await page.evaluate("history.back()");
            await settle(`run ${run}: Back`, false, 0);
            await page.evaluate(FORWARD_THEN_BACK);
            tally.raceRuns += 1;
            await settle(`run ${run}: Forward then Back at once`, false, 40);
            await page.evaluate("history.forward()");
            await settle(`run ${run}: Forward`, true, 0);
          }
          // Both calls in one task: the browser may act on either; the letter must follow the URL it lands on.
          for (let run = 1; run <= 5; run += 1) {
            await page.evaluate("history.back(); history.forward()");
            tally.raceRuns += 1;
            await pause(60);
            await settle(`run ${run}: Back and Forward in one task`, null, 150);
            if (!(await page.call(raceState)).open) {
              await page.evaluate("history.forward()");
              await settle(`run ${run}: Forward again`, true, 0);
            }
          }

          // e. Skip closes the letter without adding an entry: one Back leaves Home.
          need(await click(label, "[data-letter-skip]"));
          need(await until(`${label}: Skip closes the letter and drops #letter`, CLOSED));
          await page.evaluate("history.back()");
          await until(`${label}: one Back after Skip reaches the page before Home`, `location.href === ${JSON.stringify(before)}`, 6000);
        } catch (error) {
          // A page that left Home under the check is a failure of the case, not of the harness.
          if (error !== stop) failures.push(`${label}: stopped: ${error.message.split("\n")[0]} (now at ${await page.evaluate("location.href").catch(() => "unknown")})`);
        }
      }
    }
    await media(page, []);
    await page.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  }

  lap("fast history");
  return tally;
}

export { LETTER_KEY };
