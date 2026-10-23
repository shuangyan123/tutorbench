/* Teachometry · cover — a real kaleidoscope, rendered in Blender (Cycles).
   Two pre-rendered sequences:
     L — looking into the eyepiece while the object cell turns (plays back and forth on its own;
         the pointer turns it a little further)
     P — the camera backs out of the eyepiece and away, until the kaleidoscope lies on the desk
         beside the learner's notebook (scroll drives it)
   Frames are drawn to a 2D canvas, cross-faded so the motion stays smooth. */
/* global window, document, requestAnimationFrame, IntersectionObserver, Image, setTimeout */
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
  var NL = 30, NP = 48;

  function reduced() {
    return root.getAttribute("data-motion") === "reduce" ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function pad(n) { return ("00" + n).slice(-3); }
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  // L_000 is the same picture as P_000, so the loop hands over to the pull-out without a cut
  var L = new Array(NL), P = new Array(NP);
  function img(src) { var i = new Image(); i.decoding = "async"; i.src = src; return i; }
  function ready(i) { return i && i.complete && i.naturalWidth > 0; }

  var first = img(DIR + "P_000.webp");
  P[0] = first; L[0] = first;
  first.onload = function () { hero.setAttribute("data-cover", "on"); kick(); };
  first.onerror = function () { hero.setAttribute("data-cover", "off"); };
  // the still for reduced motion comes first, then the loop, then the pull-out
  var STILL = 14;
  P[STILL] = img(DIR + "P_" + pad(STILL) + ".webp");
  var queue = [];
  for (var i = 1; i < NL; i++) queue.push(["L", i]);
  for (var j = 1; j < NP; j++) if (j !== STILL) queue.push(["P", j]);
  (function pump() {
    var n = 0;
    while (queue.length && n < 4) {
      var q = queue.shift(); n++;
      var im = img(DIR + q[0] + "_" + pad(q[1]) + ".webp");
      (q[0] === "L" ? L : P)[q[1]] = im;
      im.onload = im.onerror = function () { setTimeout(pump, 0); kick(); };
    }
  })();

  // nearest loaded frames around a float index, so a half-loaded sequence still plays
  function pick(arr, x) {
    var a = Math.floor(x), b = a + 1;
    while (a > 0 && !ready(arr[a])) a--;
    while (b < arr.length && !ready(arr[b])) b++;
    if (b >= arr.length || b - a > 4) return { a: arr[a], b: null, f: 0 };
    return { a: arr[a], b: arr[b], f: Math.min(1, Math.max(0, (x - a) / (b - a))) };
  }

  var W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(stage.clientWidth * dpr); H = Math.round(stage.clientHeight * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    hero.toggleAttribute("data-narrow", stage.clientWidth / stage.clientHeight < 0.9);
    kick();
  }

  // object-fit: cover, with the focus slightly right of centre on wide screens
  function draw1(im, alpha) {
    if (!ready(im) || alpha <= 0) return;
    var iw = im.naturalWidth, ih = im.naturalHeight, k = Math.max(W / iw, H / ih);
    var dw = iw * k, dh = ih * k;
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
  function draw(set) {
    draw1(set.a, 1);
    if (set.b && set.f > 0.01) draw1(set.b, set.f);
  }

  var p = 0, t = 0, last = 0, raf = 0, visible = true, pointer = 0, pointerS = 0;
  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    var still = reduced();
    if (!still) t += dt;
    pointerS += (pointer - pointerS) * Math.min(1, dt * 4);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);

    var label;
    if (still) {
      draw({ a: ready(P[STILL]) ? P[STILL] : first, b: null, f: 0 });
      label = STILL;
    } else {
      // loop: back and forth over L at ~7 fps, nudged by the pointer
      var span = NL - 1;
      var x = (t * 7 + pointerS * 8) % (2 * span); if (x < 0) x += 2 * span;
      var li = x > span ? 2 * span - x : x;
      var hand = smooth(0, 0.05, p);            // first bit of scroll: loop hands over to the pull-out
      var pi = smooth(0.02, 0.86, p) * (NP - 1);
      if (hand < 1) draw(pick(L, li));
      if (hand > 0) {
        var s = pick(P, pi);
        ctx.globalAlpha = 1;
        draw1(s.a, hand);
        if (s.b && s.f > 0.01) draw1(s.b, hand * s.f);
      }
      label = hand < 0.5 ? Math.round(li) : NL + Math.round(pi);
    }
    if (readF) readF.textContent = pad(label);
    if (visible && !still) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  function onScroll() {
    var r = hero.getBoundingClientRect();
    var span = Math.max(1, r.height - stage.clientHeight);
    p = reduced() ? 0 : Math.min(1, Math.max(0, -r.top / span));
    hero.style.setProperty("--p", p.toFixed(3));
    kick();
  }
  stage.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    pointer = e.clientX / Math.max(1, stage.clientWidth) - 0.5;
    kick();
  });
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", onScroll, { passive: true });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (ents) { visible = ents[0].isIntersecting; if (visible) kick(); }).observe(hero);
  }
  resize();
  onScroll();
})();
