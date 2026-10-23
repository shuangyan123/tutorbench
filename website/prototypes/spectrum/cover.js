/* Teachometry · cover — a real kaleidoscope, rendered in Blender (Cycles).
   The page opens on a still frame (the end cap, the pattern small in its window). Scrolling moves
   the camera back until the kaleidoscope lies on the desk beside the learner's notebook.
   Nothing moves unless the reader scrolls; with reduced motion the still frame stays.
   (The eyepiece frames P_000–P_018 and the L loop are kept in assets but no longer shown.) */
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
  var NP = 48;

  function reduced() {
    return root.getAttribute("data-motion") === "reduce" ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function pad(n) { return ("00" + n).slice(-3); }
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  // The opening used to sit inside the eyepiece with the pattern turning full-screen, which made
  // people dizzy. Now the page opens on a still: the end cap, with the pattern small in its window.
  // Scrolling only moves the camera back to the desk. Nothing turns on its own.
  var START = 19, N = NP - START;
  var P = new Array(NP);
  function img(src) { var i = new Image(); i.decoding = "async"; i.src = src; return i; }
  function ready(i) { return i && i.complete && i.naturalWidth > 0; }

  var first = img(DIR + "P_" + pad(START) + ".webp");
  P[START] = first;
  first.onload = function () { hero.setAttribute("data-cover", "on"); kick(); };
  first.onerror = function () { hero.setAttribute("data-cover", "off"); };
  var queue = [];
  for (var j = START + 1; j < NP; j++) queue.push(j);
  (function pump() {
    var n = 0;
    while (queue.length && n < 4) {
      var k = queue.shift(); n++;
      var im = img(DIR + "P_" + pad(k) + ".webp");
      P[k] = im;
      im.onload = im.onerror = function () { setTimeout(pump, 0); kick(); };
    }
  })();

  // nearest loaded frame at or before x, so a half-loaded sequence still shows something close
  function near(x) {
    var a = x;
    while (a > START && !ready(P[a])) a--;
    return P[a];
  }

  var W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(stage.clientWidth * dpr); H = Math.round(stage.clientHeight * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    hero.toggleAttribute("data-narrow", stage.clientWidth / stage.clientHeight < 0.9);
    kick();
  }

  // object-fit: cover; on wide screens the frame is drawn a little larger and anchored left, so the
  // kaleidoscope sits right of centre and the title panel on the left does not cover its window
  function draw1(im, alpha) {
    if (!ready(im) || alpha <= 0) return;
    var wide = stage.clientWidth / stage.clientHeight >= 0.9;
    var iw = im.naturalWidth, ih = im.naturalHeight, k = Math.max(W / iw, H / ih) * (wide ? 1.2 : 1);
    var dw = iw * k, dh = ih * k;
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, wide ? 0 : (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  var p = 0, raf = 0;
  function frame() {
    raf = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    // the camera moves a lot between frames, so snap to the nearest one (no ghosting)
    var k = START + Math.round(smooth(0, 0.86, p) * (N - 1));
    draw1(near(k), 1);
    if (readF) readF.textContent = pad(k - START + 1);
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
