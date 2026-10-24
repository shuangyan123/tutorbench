/* Teachometry · cover — a real kaleidoscope, rendered in Blender (Cycles).
   Two mirrors at 30° over a chamber of cathedral and dichroic glass, millefiori slices, cut
   crystal and air bubbles in oil. The page opens on a still rosette; scrolling turns the chamber
   by 15°, so the pattern slowly re-forms. The picture itself never spins, and nothing moves unless
   the reader scrolls; with reduced motion the still rosette stays.
   Frames: assets/cover/K_000–K_119.webp (1400×1400, transparent outside the eyepiece; a 1000px copy
   in assets/cover-m/ for small screens), rendered by
   render/render_k.sh (mandala.py, one wedge per frame, folded by render/fold.py). */
/* global window, document, requestAnimationFrame, Image, setTimeout */
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
  var DIR = small ? "assets/cover-m/" : "assets/cover/";

  function reduced() {
    return root.getAttribute("data-motion") === "reduce" ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function pad(n) { return ("00" + n).slice(-3); }
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  var N = 120, SEQ = "K_";
  var F = new Array(N);
  // a frame counts as ready only once it is decoded, so drawing it never stalls a scroll
  function img(src) {
    var i = new Image(); i.decoding = "async"; i.src = src;
    var done = function () { i._ok = i.naturalWidth > 0; kick(); };
    if (i.decode) i.decode().then(done, function () { i._ok = false; }); else i.onload = done;
    return i;
  }
  function ready(i) { return !!(i && i._ok); }

  var first = img(DIR + SEQ + pad(0) + ".webp");
  F[0] = first;
  first.addEventListener("load", function () { hero.setAttribute("data-cover", "on"); });
  first.addEventListener("error", function () { hero.setAttribute("data-cover", "off"); });
  // Only the still frame loads with the page. The rest of the sequence (about 29 MB on large
  // screens, 15 MB on phones) waits until the reader shows they will scroll: a light warm-up of the
  // first few frames after the page settles, then every 4th frame so the whole scroll is covered
  // early, then the frames in between. With reduced motion or Save-Data nothing more is fetched.
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
      var im = img(DIR + SEQ + pad(k) + ".webp");
      F[k] = im;
      var next = function () { inflight--; setTimeout(pump, 0); };
      im.addEventListener("load", next);
      im.addEventListener("error", next);
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

  // nearest decoded frames around a float index
  function around(x) {
    var a = Math.floor(x), b = Math.ceil(x);
    while (a > 0 && !ready(F[a])) a--;
    while (b < N - 1 && !ready(F[b])) b++;
    if (!ready(F[b])) b = a;
    return { a: F[a], b: F[b], f: b === a ? 0 : (x - a) / (b - a), gap: b - a };
  }

  var W = 0, H = 0, dpr = 1, narrow = false, CX = 0, CY = 0, D = 0;
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
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(stage.clientWidth * dpr); H = Math.round(stage.clientHeight * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    hero.toggleAttribute("data-narrow", stage.clientWidth / stage.clientHeight < 0.9);   // sets the copy's width first
    layout();
    kick();
  }

  // the frames are square, transparent outside the eyepiece circle
  function draw1(im, alpha) {
    if (!ready(im) || alpha <= 0) return;
    var d = D * dpr;
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, CX * dpr - d / 2, CY * dpr - d / 2, d, d);
  }

  // the shown position eases towards the scroll position, and neighbouring frames are blended,
  // so a fast flick still plays through the frames instead of jumping
  var p = 0, shown = 0, last = 0, raf = 0;
  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    var target = smooth(0, 0.86, p) * (N - 1);
    shown = reduced() ? target : shown + (target - shown) * Math.min(1, dt * 12);
    if (Math.abs(target - shown) < 0.002) shown = target;
    var s = around(shown);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    draw1(s.a, 1);
    if (s.gap <= 2 && s.f > 0.02) draw1(s.b, s.f);
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
