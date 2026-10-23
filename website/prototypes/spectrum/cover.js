/* Teachometry · cover — a real kaleidoscope, rendered in Blender (Cycles).
   The page opens on a still frame (the machined end cap, the pattern small in its window).
   Scrolling moves the camera back until the kaleidoscope lies on the desk beside the learner's
   notebook. Nothing moves unless the reader scrolls; with reduced motion the still frame stays.
   Frames: assets/cover/R_000–R_119.webp, rendered by render/render_r.sh (scene.py, sequence Q, NQ=120). */
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
  var DIR = "assets/cover/";
  
  function reduced() {
    return root.getAttribute("data-motion") === "reduce" ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function pad(n) { return ("00" + n).slice(-3); }
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  // The page opens on a still (the engraved end cap, the pattern small in its window); scrolling
  // only moves the camera back to the desk. Nothing turns on its own.
  // R_000–R_119: 120 frames at 1920×1200, framed for wide screens (kaleidoscope right of centre).
  var N = 120, SEQ = "R_";
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
  // load every 4th frame first so the whole scroll is covered early, then fill in between
  var queue = [];
  [4, 2, 1].forEach(function (step) {
    for (var j = 0; j < N; j += step) if (queue.indexOf(j) < 0 && j !== 0) queue.push(j);
  });
  (function pump() {
    var n = 0;
    while (queue.length && n < 4) {
      var k = queue.shift(); n++;
      var im = img(DIR + SEQ + pad(k) + ".webp");
      F[k] = im;
      im.addEventListener("load", function () { setTimeout(pump, 0); });
      im.addEventListener("error", function () { setTimeout(pump, 0); });
    }
  })();

  // nearest decoded frames around a float index
  function around(x) {
    var a = Math.floor(x), b = Math.ceil(x);
    while (a > 0 && !ready(F[a])) a--;
    while (b < N - 1 && !ready(F[b])) b++;
    if (!ready(F[b])) b = a;
    return { a: F[a], b: F[b], f: b === a ? 0 : (x - a) / (b - a), gap: b - a };
  }

  var W = 0, H = 0, dpr = 1, narrow = false;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(stage.clientWidth * dpr); H = Math.round(stage.clientHeight * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    narrow = stage.clientWidth / stage.clientHeight < 0.9;
    hero.toggleAttribute("data-narrow", narrow);
    kick();
  }

  // object-fit: cover. The frames already place the kaleidoscope right of centre for wide screens;
  // on narrow screens the crop is centred on it (60% across the frame) instead.
  function draw1(im, alpha) {
    if (!ready(im) || alpha <= 0) return;
    var iw = im.naturalWidth, ih = im.naturalHeight, k = Math.max(W / iw, H / ih);
    var dw = iw * k, dh = ih * k;
    var x = narrow ? Math.min(0, Math.max(W - dw, W / 2 - dw * 0.6)) : (W - dw) / 2;
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, x, (H - dh) / 2, dw, dh);
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
