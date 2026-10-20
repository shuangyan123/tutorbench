/* global HTMLAnchorElement, HTMLButtonElement, HTMLDialogElement, HTMLElement, IntersectionObserver, MutationObserver, document, history, requestAnimationFrame, window */

// Home opening letter.
//
// An inline script in the page may already have opened the dialog before first
// paint (first Home visit only). This file adds the opening ceremony, the
// reader-paced ink, the way into Home, and the quiet way back to the letter.
// Nothing here runs on its own clock except the opening the visitor started:
// the letter only moves forward when the reader asks it to.
//
// URL rule: apart from the one automatic first-visit opening, the letter is
// open exactly when the URL ends in #letter. Back, Forward and a page restored
// from the back/forward cache are brought in line with the URL; closing the
// letter never adds a history entry.
(() => {
  const dialog = document.getElementById("home-letter");
  if (!(dialog instanceof HTMLDialogElement) || typeof dialog.showModal !== "function") return;

  const envelopeWrap = dialog.querySelector("[data-letter-envelope-wrap]");
  const envelope = dialog.querySelector("[data-letter-envelope]");
  const paper = dialog.querySelector("[data-letter-paper]");
  const scroller = dialog.querySelector("[data-letter-scroll]");
  const controls = dialog.querySelector("[data-letter-controls]");
  const next = dialog.querySelector("[data-letter-next]");
  const nextLabel = dialog.querySelector("[data-letter-next-label]");
  const skip = dialog.querySelector("[data-letter-skip]");
  const stanzas = Array.from(dialog.querySelectorAll("[data-letter-stanza]"));
  const entry = document.querySelector("[data-letter-open]");
  const hero = document.querySelector(".home-hero");
  if (
    !(envelopeWrap instanceof HTMLElement) ||
    !(envelope instanceof HTMLButtonElement) ||
    !(paper instanceof HTMLElement) ||
    !(scroller instanceof HTMLElement) ||
    !(controls instanceof HTMLElement) ||
    !(next instanceof HTMLButtonElement) ||
    stanzas.length === 0
  ) return;

  // Keep in step with letter.css: the last fold ends at 1.44s + .56s.
  const OPENING_MS = 2040;
  const LEAVE_MS = 240;
  const ENTER_FADE_MS = 560;
  const ENTER_CLOSE_MS = 1000;
  const INK_STEP_MS = 320;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let timers = [];
  let inkQueue = [];
  let inkTimer = 0;
  let observer = null;
  let opener = null;
  let tiltFrame = 0;
  // True when this document pushed the #letter entry being shown, so closing
  // can step back over it instead of leaving a duplicate entry behind.
  let ownsHistoryEntry = false;
  let pendingFrom = null;

  const still = () => reducedMotion.matches;
  const state = () => dialog.dataset.letterState;
  const setState = (value) => { dialog.dataset.letterState = value; };
  const later = (callback, delay) => { timers.push(window.setTimeout(callback, delay)); };
  const clearTimers = () => { timers.forEach((timer) => window.clearTimeout(timer)); timers = []; };

  // site.js applies the page theme first; the letter follows it from then on.
  function syncTheme() {
    const theme = document.body.dataset.theme;
    if (theme === "light" || theme === "dark") dialog.dataset.theme = theme;
  }
  syncTheme();
  new MutationObserver(syncTheme).observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });

  // --- Ink follows the reader ------------------------------------------------

  const isInked = (stanza) => stanza.classList.contains("is-inked");

  function updateNext() {
    const done = isInked(stanzas[stanzas.length - 1]);
    next.dataset.mode = done ? "enter" : "continue";
    if (nextLabel instanceof HTMLElement) {
      nextLabel.textContent = (done ? next.dataset.labelEnter : next.dataset.labelContinue) ?? "";
    }
  }

  function applyInk(stanza) {
    stanza.classList.add("is-inked");
    updateNext();
  }

  function stopInk() {
    window.clearTimeout(inkTimer);
    inkTimer = 0;
    inkQueue = [];
  }

  function pumpInk() {
    inkTimer = 0;
    const stanza = inkQueue.shift();
    if (stanza === undefined) return;
    applyInk(stanza);
    if (inkQueue.length > 0) inkTimer = window.setTimeout(pumpInk, INK_STEP_MS);
  }

  // Ink every stanza up to the target, one after another unless motion is reduced.
  function inkThrough(target, immediately = false) {
    stanzas.slice(0, stanzas.indexOf(target) + 1).forEach((stanza) => {
      if (!isInked(stanza) && !inkQueue.includes(stanza)) inkQueue.push(stanza);
    });
    if (immediately || still()) {
      window.clearTimeout(inkTimer);
      inkTimer = 0;
      inkQueue.splice(0).forEach(applyInk);
    } else if (inkTimer === 0) {
      pumpInk();
    }
  }

  function watchReading() {
    if (observer !== null) return;
    observer = new IntersectionObserver((entries) => {
      entries.forEach((item) => { if (item.isIntersecting) inkThrough(item.target); });
    }, { root: scroller, rootMargin: "0px 0px -38% 0px" });
    stanzas.forEach((stanza) => observer.observe(stanza));
  }

  // --- States ----------------------------------------------------------------

  function reset() {
    clearTimers();
    stopInk();
    observer?.disconnect();
    observer = null;
    delete dialog.dataset.letterFade;
    delete dialog.dataset.letterFrom;
    dialog.removeAttribute("data-letter-auto");
    setState("sealed");
    envelopeWrap.hidden = false;
    paper.hidden = true;
    controls.hidden = true;
    stanzas.forEach((stanza) => stanza.classList.remove("is-inked"));
    ["--enter-x", "--enter-y", "--enter-sx", "--enter-sy"].forEach((name) => paper.style.removeProperty(name));
    envelope.style.removeProperty("--tilt-x");
    envelope.style.removeProperty("--tilt-y");
    scroller.scrollTop = 0;
    updateNext();
  }

  function startReading() {
    clearTimers();
    envelopeWrap.hidden = true;
    paper.hidden = false;
    controls.hidden = false;
    setState("reading");
    if (still() || !("IntersectionObserver" in window)) {
      stanzas.forEach(applyInk);
    } else {
      inkThrough(stanzas[0]);
      watchReading();
    }
    scroller.focus({ preventScroll: true });
  }

  function beginOpening() {
    if (!dialog.open || state() !== "sealed") return;
    if (still()) { startReading(); return; }
    envelope.style.removeProperty("--tilt-x");
    envelope.style.removeProperty("--tilt-y");
    paper.hidden = false;
    setState("opening");
    later(startReading, OPENING_MS);
  }

  function close(reason) {
    clearTimers();
    if (dialog.open) dialog.close(reason);
  }

  // The URL left #letter (Back) or a cached page came back: follow the URL
  // at once, without touching history again.
  function closeForUrl() {
    if (dialog.open) close("url");
  }

  // Skip or Escape: step aside quickly.
  function leave() {
    if (!dialog.open || state() === "leaving" || state() === "entering") return;
    if (still()) { close("skip"); return; }
    clearTimers();
    setState("leaving");
    later(() => close("skip"), LEAVE_MS);
  }

  function welcomeHome() {
    if (!(hero instanceof HTMLElement) || still()) return;
    hero.dataset.letterArrival = "";
    window.setTimeout(() => { delete hero.dataset.letterArrival; }, 1500);
  }

  // The end of the letter: the paper widens into the page underneath.
  function enter() {
    if (state() !== "reading") return;
    if (still()) { close("enter"); return; }
    const box = paper.getBoundingClientRect();
    const width = window.innerWidth;
    const height = window.innerHeight;
    paper.style.setProperty("--enter-x", `${(width / 2 - (box.left + box.width / 2)).toFixed(1)}px`);
    paper.style.setProperty("--enter-y", `${(height / 2 - (box.top + box.height / 2)).toFixed(1)}px`);
    paper.style.setProperty("--enter-sx", (width / box.width + 0.04).toFixed(3));
    paper.style.setProperty("--enter-sy", (height / box.height + 0.04).toFixed(3));
    delete dialog.dataset.letterFrom;
    setState("entering");
    later(() => { dialog.dataset.letterFade = ""; welcomeHome(); }, ENTER_FADE_MS);
    later(() => close("enter"), ENTER_CLOSE_MS);
  }

  function advance() {
    if (state() !== "reading") return;
    const target = stanzas.find((stanza) => !isInked(stanza));
    if (target === undefined) { enter(); return; }
    inkThrough(target, true);
    scroller.scrollTo({ top: Math.max(0, target.offsetTop - scroller.clientHeight * 0.16), behavior: still() ? "auto" : "smooth" });
  }

  function open(from) {
    if (dialog.open) return;
    reset();
    syncTheme();
    dialog.returnValue = "";
    if (from === "entry") dialog.dataset.letterFrom = "entry";
    dialog.showModal();
    // Someone who kept the letter goes straight back to reading it.
    if (from === "entry") {
      startReading();
      window.setTimeout(() => { if (state() === "reading") delete dialog.dataset.letterFrom; }, 600);
    }
  }

  function syncWithUrl() {
    const wanted = window.location.hash === "#letter";
    if (wanted && !dialog.open) {
      const from = pendingFrom ?? "link";
      pendingFrom = null;
      ownsHistoryEntry = true;
      open(from);
    } else if (!wanted && dialog.open && !dialog.hasAttribute("data-letter-auto")) {
      closeForUrl();
    }
  }

  // --- Wiring ----------------------------------------------------------------

  envelope.addEventListener("click", beginOpening);
  next.addEventListener("click", advance);
  if (skip instanceof HTMLButtonElement) {
    skip.addEventListener("click", (event) => { event.preventDefault(); leave(); });
  }
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); leave(); });
  scroller.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target === scroller) { event.preventDefault(); advance(); }
  });

  dialog.addEventListener("close", () => {
    const returnTo = opener;
    const reason = dialog.returnValue;
    const stepBack = ownsHistoryEntry;
    opener = null;
    ownsHistoryEntry = false;
    reset();
    // Closed by the reader while the URL still asks for the letter: undo our
    // own #letter entry, or drop the hash a link arrived with. Never push.
    if (reason !== "url" && window.location.hash === "#letter") {
      if (stepBack) history.back();
      else history.replaceState(history.state, "", `${window.location.pathname}${window.location.search}`);
    }
    if (returnTo instanceof HTMLElement && returnTo.isConnected) returnTo.focus();
  });

  // A gentle, physical response to a fine pointer; nothing on touch or reduced motion.
  envelope.addEventListener("pointermove", (event) => {
    if (!finePointer.matches || still() || state() !== "sealed" || tiltFrame !== 0) return;
    tiltFrame = requestAnimationFrame(() => {
      tiltFrame = 0;
      if (state() !== "sealed") return;
      const box = envelope.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      envelope.style.setProperty("--tilt-x", `${(-y * 6).toFixed(2)}deg`);
      envelope.style.setProperty("--tilt-y", `${(x * 7).toFixed(2)}deg`);
    });
  });
  envelope.addEventListener("pointerleave", () => {
    envelope.style.removeProperty("--tilt-x");
    envelope.style.removeProperty("--tilt-y");
  });

  // The entry is a real #letter link: following it adds one history entry,
  // which Back (or closing the letter) removes again.
  if (entry instanceof HTMLAnchorElement) {
    entry.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      opener = entry;
      if (window.location.hash === "#letter") {
        event.preventDefault();
        ownsHistoryEntry = false;
        open("entry");
      } else {
        pendingFrom = "entry";
      }
    });
  }

  window.addEventListener("hashchange", syncWithUrl);
  window.addEventListener("popstate", syncWithUrl);
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    // A restored page shows the letter only if its URL asks for it.
    dialog.removeAttribute("data-letter-auto");
    syncWithUrl();
  });

  updateNext();
  // Tells the first-visit script and the Home entry that the letter works.
  document.documentElement.setAttribute("data-letter-ready", "");
})();
