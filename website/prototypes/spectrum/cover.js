/* Teachometry · cover — a real kaleidoscope, rendered in Blender (Cycles).
   Two mirrors at 30° over a chamber of cathedral and dichroic glass, millefiori slices, cut
   crystal and air bubbles in oil. The page opens on a still rosette; scrolling turns the chamber
   by 15°, so the pattern slowly re-forms. The picture itself never spins, and nothing moves unless
   the reader scrolls; with reduced motion the still rosette stays.
   Frames: assets/cover/K_000–K_119.webp (1400×1400, transparent outside the eyepiece; a 1000px copy
   in assets/cover-m/ for small screens), rendered by
   render/render_k.sh (mandala.py, one wedge per frame, folded by render/fold.py). */
/* global window, document, requestAnimationFrame, Image, setTimeout, URL */
(function () {
  "use strict";

  var hero = document.querySelector("[data-hero]");
  var canvas = document.querySelector("[data-seq]");
  if (!hero || !canvas || !canvas.getContext) return;
  var stage = canvas.parentElement;
  var ctx = canvas.getContext("2d");
  var readF = hero.querySelector("[data-seq-frame]");
  var root = document.documentElement;
  // the eyepiece is at most ~520 CSS px wide on phones and small tablets: there a 1000px set
  // looks the same and weighs about half as much
  var small = Math.min(window.innerWidth, window.innerHeight * 1.25) <= 700;
  // frames sit next to this script, wherever the page itself lives (/ or /zh-cn/)
  var BASE = (document.currentScript && document.currentScript.src || "").replace(/[^/]*$/, "");
  var DIR = BASE + (small ? "assets/cover-m/" : "assets/cover/");

  function reduced() {
    return root.getAttribute("data-motion") === "reduce" ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function pad(n) { return ("00" + n).slice(-3); }
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  var N = 120, SEQ = "K_";
  // Each frame is fetched once and kept compressed (about 15 MB for the phone set, 29 MB for the
  // large one). Decoding all 120 would take half a gigabyte or more, so the browser used to drop
  // decoded frames and decode them again in the middle of a scroll, which made the cover stutter.
  // Instead frames are decoded off the main thread, at the size they are drawn, into two sets:
  // - every STEP-th frame across the whole turn, kept for good: a fast scroll (a mouse wheel moves
  //   about ten frames a notch, faster than frames can be decoded) always has a frame close by,
  //   and the frames in between are blended;
  // - every frame near the reader's place, decoded as the scroll arrives there.
  var blobs = new Array(N), bmps = new Array(N), bmpSize = new Array(N), pending = new Array(N);
  var SRC = small ? 1000 : 1400;  // the frames' own pixel size
  var size = 0;                   // the pixel size frames are decoded at: the eyepiece on screen
  var R = 8;                      // frames kept decoded on each side of the reader's place
  var STEP = 4;                   // the spacing of the frames kept for good
  var at = [0, 0];                // the frame shown, and the frame the scroll is heading to
  var decoding = 0;
  var WORKERS = Math.max(2, Math.min(4, ((window.navigator && window.navigator.hardwareConcurrency) || 4) - 1));
  function ready(k) { return !!bmps[k]; }
  function kept(k) { return k % STEP === 0 || k === N - 1; }
  function near(k) { return kept(k) || Math.abs(k - at[0]) <= R || Math.abs(k - at[1]) <= R; }
  function drop(bm) { if (bm && bm.close) bm.close(); }
  function toBitmap(blob, px) {
    if (window.createImageBitmap) {
      var opts = px && px < SRC ? { resizeWidth: px, resizeHeight: px, resizeQuality: "high" } : undefined;
      return window.createImageBitmap(blob, opts).catch(function () { return window.createImageBitmap(blob); });
    }
    return new Promise(function (resolve, reject) {
      var i = new Image();
      i.onload = function () { resolve(i); };
      i.onerror = reject;
      i.src = URL.createObjectURL(blob);
    });
  }
  function start(k) {
    var px = size;
    pending[k] = true; decoding++;
    toBitmap(blobs[k], px).then(function (bm) {
      pending[k] = false; decoding--;
      if (!near(k)) drop(bm);
      else {
        if (bmps[k] !== bm) drop(bmps[k]);
        bmps[k] = bm; bmpSize[k] = px;
        if (k === 0) hero.setAttribute("data-cover", "on");
        kick();
      }
      settle();
    }, function () {
      pending[k] = false; decoding--;
      if (k === 0) hero.setAttribute("data-cover", "off");
      settle();
    });
  }
  // free the frames out of reach, then decode: the frames near the reader closest first, then the
  // frames kept for good, closest first
  function settle() {
    if (!size) return;
    for (var k = 1; k < N; k++) if (bmps[k] && !near(k)) { drop(bmps[k]); bmps[k] = null; }
    var order = [0], d, j;
    function add(n) { if (n > 0 && n < N && order.indexOf(n) < 0) order.push(n); }
    for (d = 0; d <= R; d++) { add(at[1] + d); add(at[1] - d); add(at[0] + d); add(at[0] - d); }
    for (d = 0; d < N; d++) { if (kept(at[1] + d)) add(at[1] + d); if (kept(at[1] - d)) add(at[1] - d); }
    for (var i = 0; i < order.length && decoding < WORKERS; i++) {
      j = order[i];
      if (blobs[j] && !pending[j] && (!bmps[j] || bmpSize[j] !== size)) start(j);
    }
  }
  function load(k) {
    return window.fetch(DIR + SEQ + pad(k) + ".webp", { priority: "low" })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
      .then(function (b) { blobs[k] = b; settle(); });
  }

  load(0).catch(function () { hero.setAttribute("data-cover", "off"); });
  // Only the still frame loads with the page. The rest of the sequence waits until the reader shows
  // they will scroll: a light warm-up of the first few frames after the page settles, then every
  // 4th frame so the whole scroll is covered early, then the frames in between. With reduced motion
  // or Save-Data nothing more is fetched.
  var queue = [];
  [4, 2, 1].forEach(function (step) {
    for (var j = 0; j < N; j += step) if (queue.indexOf(j) < 0 && j !== 0) queue.push(j);
  });
  var conn = window.navigator && window.navigator.connection;
  var saveData = !!(conn && conn.saveData);
  var limit = 0, inflight = 0;
  function pump() {
    while (queue.length && inflight < 4 && limit > 0) {
      var k = queue.shift(); inflight++; limit--;
      var next = function () { inflight--; setTimeout(pump, 0); };
      load(k).then(next, next);
    }
  }
  function allow(n) { if (reduced() || saveData) return; limit = Math.max(limit, n); pump(); }
  var INTENT = ["wheel", "touchmove", "keydown", "scroll"];
  function intent() {
    if (reduced() || saveData) return;
    INTENT.forEach(function (t) { window.removeEventListener(t, intent); });
    allow(Infinity);
  }
  INTENT.forEach(function (t) { window.addEventListener(t, intent, { passive: true }); });
  window.addEventListener("load", function () { setTimeout(function () { allow(6); }, 1200); });

  // the nearest decoded frames on each side of a float index, looking no further than the spacing
  // of the frames kept for good: a frame from elsewhere in the turn is never shown in its place
  // (null: nothing close is decoded yet, so the picture already drawn stays)
  function around(x) {
    var lo = Math.floor(x), hi = Math.ceil(x), a = lo, b = hi;
    while (a >= 0 && lo - a <= STEP && !ready(a)) a--;
    while (b < N && b - hi <= STEP && !ready(b)) b++;
    var okA = a >= 0 && lo - a <= STEP && ready(a), okB = b < N && b - hi <= STEP && ready(b);
    if (!okA && !okB) return null;
    if (!okA) a = b;
    if (!okB) b = a;
    return { a: bmps[a], b: bmps[b], f: b === a ? 0 : (x - a) / (b - a) };
  }

  var dpr = 1, narrow = false, CX = 0, CY = 0, D = 0;
  var copy = hero.querySelector(".hero-copy");
  // Place the eyepiece: right of the cover copy on wide screens, above it on narrow ones.
  function layout() {
    var w = stage.clientWidth, h = stage.clientHeight, bar = 60, g = Math.max(16, Math.min(56, w * 0.04));
    narrow = w / h < 0.9;
    if (narrow) {
      D = Math.min(w - 2 * g, h * 0.5); CX = w / 2; CY = bar + 12 + D / 2;
    } else {
      var cr = copy ? copy.getBoundingClientRect().right - stage.getBoundingClientRect().left : w * 0.38;
      D = Math.min(h * 0.8, w * 0.6);
      CX = Math.max(w * 0.62, cr + D * 0.36);
      if (CX + D / 2 > w - g) { D = Math.max(h * 0.5, 2 * (w - g - Math.max(w * 0.6, cr + 24)) / 1.36); CX = Math.min(w - g - D / 2, Math.max(w * 0.6, cr + D * 0.36)); }
      CY = bar / 2 + h / 2 + 8;
    }
    stage.style.setProperty("--cx", CX.toFixed(1) + "px");
    stage.style.setProperty("--cy", CY.toFixed(1) + "px");
    stage.style.setProperty("--d", D.toFixed(1) + "px");
  }
  // the canvas covers only the eyepiece (placed by CSS from --cx, --cy and --d, like its rim)
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    hero.toggleAttribute("data-narrow", stage.clientWidth / stage.clientHeight < 0.9);   // sets the copy's width first
    layout();
    var px = Math.max(1, Math.round(D * dpr));
    if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
    var want = Math.min(SRC, px);
    if (want !== size) {
      size = want;
      var mb = size * size * 4;
      // the frames near the reader: about 64 MB, 6–12 on each side
      R = Math.max(6, Math.min(12, Math.floor(64e6 / (mb * 2))));
      // the frames kept for good: about 100 MB on phones, 150 MB on larger screens
      // (every 3rd frame for a phone eyepiece, every 4th for a laptop, every 7th at the full 1400px)
      var budget = small ? 100e6 : 150e6;
      STEP = 2;
      while (STEP < 8 && Math.ceil(N / STEP) * mb > budget) STEP++;
      settle();
    }
    kick();
  }

  // the frames are square, transparent outside the eyepiece circle
  function draw1(im, alpha) {
    if (!im || alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
  }

  // the shown position eases towards the scroll position, and neighbouring frames are blended,
  // so a fast flick still plays through the frames instead of jumping. The easing is slow on
  // purpose: when the reader stops, the chamber keeps turning for about a second, like a real one
  // let go of.
  var p = 0, shown = 0, last = 0, raf = 0;
  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    var target = smooth(0, 0.86, p) * (N - 1);
    shown = reduced() ? target : shown + (target - shown) * Math.min(1, dt * 3.2);
    if (Math.abs(target - shown) < 0.002) shown = target;
    var to = Math.round(target), from = Math.round(shown);
    if (to !== at[1] || from !== at[0]) { at = [from, to]; settle(); }
    var s = around(shown);
    if (s) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      draw1(s.a, 1);
      if (s.f > 0.02) draw1(s.b, s.f);
    }
    if (readF) readF.textContent = pad(Math.round(shown) + 1);
    if (shown !== target) raf = requestAnimationFrame(frame); else last = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  function onScroll() {
    var r = hero.getBoundingClientRect();
    var span = Math.max(1, r.height - stage.clientHeight);
    p = reduced() ? 0 : Math.min(1, Math.max(0, -r.top / span));
    hero.style.setProperty("--p", p.toFixed(3));
    kick();
  }
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", onScroll, { passive: true });
  resize();
  onScroll();
})();
