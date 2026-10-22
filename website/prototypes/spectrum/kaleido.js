/* Teachometry · cover — a kaleidoscope made of one photograph.
   The material in the tube is a single scene: a learner's notebook with
   1/3 + 1/4 = 2/7, a glass prism, and the light it throws. You look at it through
   a round eyepiece folded by 12 mirrors. Scrolling takes the mirrors out
   (12 → 6 → 3 → 1) and opens the eyepiece until the plain photograph is left.
   Pointer and scrolling turn the tube. Plain WebGL 1, no libraries. */
/* global window, document, requestAnimationFrame, cancelAnimationFrame, IntersectionObserver, Image */
(function () {
  "use strict";

  var hero = document.querySelector("[data-hero]");
  var canvas = document.querySelector("[data-scope-gl]");
  if (!hero || !canvas) return;
  var stage = canvas.parentElement;
  var dial = hero.querySelector("[data-scope-dial]");
  var readN = hero.querySelectorAll("[data-scope-steps] i");
  var readT = hero.querySelector("[data-scope-theta]");
  var root = document.documentElement;

  function reduced() {
    return root.getAttribute("data-motion") === "reduce" ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // Two crops of the same scene. focus = where the tube looks (photo uv, y down).
  var PHOTOS = {
    wide: { src: "assets/mistake-wide.webp", w: 1916, h: 821, focus: [0.72, 0.62], pos: [1, 0.5], dir: -0.25, swing: 0.95 },
    tall: { src: "assets/mistake-tall.webp", w: 941, h: 1672, focus: [0.5, 0.31], pos: [0.5, 0.2], dir: 2.5, swing: 0.4 }
  };
  var STEPS = [12, 6, 3, 1];
  var TURNS = [0.17, 0.33, 0.49]; // scroll progress where 12→6, 6→3, 3→1 happen
  var HALF = 0.055;

  var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  var FRAG = [
    "precision highp float;",
    "uniform sampler2D uPhoto;",
    "uniform vec2 uRes, uImg, uOrigin, uCenter, uFocus;",
    "uniform float uScale, uRadius, uZoom, uTheta, uLift, uNa, uNb, uMix, uSeam, uRim;",
    "const float PI = 3.14159265;",
    "vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c*v.x - s*v.y, s*v.x + c*v.y); }",
    "vec2 fold(vec2 d, float n){",
    "  if (n < 1.5) return d;",
    "  float seg = 2.0*PI/n;",
    "  float a = mod(atan(d.y, d.x) + PI*0.5, seg);",
    "  a = min(a, seg - a);",
    "  return vec2(cos(a), sin(a))*length(d);",
    "}",
    // device px (y up) → photo uv; the photo covers the stage like object-fit: cover
    "vec3 photo(vec2 s){",
    "  vec2 uv = (vec2(s.x, uRes.y - s.y) - uOrigin)/(uImg*uScale);",
    "  return texture2D(uPhoto, clamp(uv, 0.001, 0.999)).rgb;",
    "}",
    "vec3 view(vec2 d, float n){",
    "  vec2 f = fold(d, n);",
    "  vec3 c = photo(uFocus + rot(f, uTheta)*uZoom);",
    "  if (n > 1.5) {",
    "    float a = atan(f.y, f.x);",
    "    float e = min(a, PI/n - a)*length(d);",
    "    c = mix(c, c*0.82 + 0.16, uSeam*(1.0 - smoothstep(0.0, 1.4, e))*smoothstep(4.0, 30.0, length(d)));",
    "  }",
    "  return c;",
    "}",
    "void main(){",
    "  vec2 d = gl_FragCoord.xy - uCenter;",
    "  float r = length(d);",
    "  vec3 c = mix(view(d, uNa), view(d, uNb), uMix);",
    // the glass tube: a soft inner shadow and a thin lit rim, gone once the eyepiece opens
    "  c = 1.0 - (1.0 - c)*(1.0 - uLift);",
    "  float t = r/uRadius;",
    "  c *= 1.0 - uRim*0.22*smoothstep(0.72, 1.0, t);",
    "  c += uRim*0.10*smoothstep(0.965, 0.995, t);",
    "  float alpha = 1.0 - smoothstep(uRadius - 1.0, uRadius + 0.5, r);",
    "  gl_FragColor = vec4(c*alpha, alpha);",
    "}"
  ].join("\n");

  var gl = null;
  try {
    gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false }) ||
      canvas.getContext("experimental-webgl");
  } catch { gl = null; }
  if (!gl) { hero.setAttribute("data-k", "off"); return; }

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
  } catch { hero.setAttribute("data-k", "off"); return; }
  gl.useProgram(prog);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {};
  ["uPhoto", "uRes", "uImg", "uOrigin", "uScale", "uCenter", "uFocus", "uRadius", "uZoom", "uTheta", "uLift", "uNa", "uNb", "uMix", "uSeam", "uRim"].forEach(function (n) {
    U[n] = gl.getUniformLocation(prog, n);
  });
  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(U.uPhoto, 0);

  // ---------------------------------------------------------------- state
  var W = 0, H = 0, dpr = 1, narrow = false;
  var photo = null, photoKey = "";
  var theta = 0.6, target = 0.6, pointerT = 0, lastScroll = window.scrollY;
  var p = 0, raf = 0, visible = true, last = 0, shownN = -1;

  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function mix(a, b, t) { return a + (b - a) * t; }

  function mirrors(x) {
    for (var i = 0; i < TURNS.length; i++) {
      if (x < TURNS[i] - HALF) return { a: STEPS[i], b: STEPS[i], m: 0 };
      if (x <= TURNS[i] + HALF) return { a: STEPS[i], b: STEPS[i + 1], m: smooth(TURNS[i] - HALF, TURNS[i] + HALF, x) };
    }
    return { a: 1, b: 1, m: 0 };
  }

  function load(key) {
    if (key === photoKey) return;
    photoKey = key;
    var img = new Image();
    img.decoding = "async";
    img.onload = function () {
      if (photoKey !== key) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      photo = PHOTOS[key];
      hero.setAttribute("data-k", "on");
      kick();
    };
    img.onerror = function () { hero.setAttribute("data-k", "off"); };
    img.src = PHOTOS[key].src;
  }

  // the dial around the eyepiece: 5° ticks, 30° majors, mirror marks redrawn when N changes
  function drawDial(n) {
    if (!dial) return;
    var g = "";
    for (var i = 0; i < 72; i++) {
      var a = i * 5 * Math.PI / 180, major = i % 6 === 0;
      var r1 = 101.5, r2 = major ? 105 : 103.2;
      g += '<line x1="' + (Math.sin(a) * r1).toFixed(2) + '" y1="' + (-Math.cos(a) * r1).toFixed(2) +
        '" x2="' + (Math.sin(a) * r2).toFixed(2) + '" y2="' + (-Math.cos(a) * r2).toFixed(2) + '"' + (major ? ' class="mj"' : "") + "/>";
    }
    for (var k = 0; k < n && n > 1; k++) {
      var b = k * 2 * Math.PI / n;
      g += '<line class="mir" x1="' + (Math.sin(b) * 99).toFixed(2) + '" y1="' + (-Math.cos(b) * 99).toFixed(2) +
        '" x2="' + (Math.sin(b) * 107).toFixed(2) + '" y2="' + (-Math.cos(b) * 107).toFixed(2) + '"/>';
    }
    dial.setAttributeNS(null, "viewBox", "-110 -110 220 220");
    dial.innerHTML = g;
  }

  function resize() {
    var w = stage.clientWidth, h = stage.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    W = Math.round(w * dpr); H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    narrow = w / h < 0.9;
    hero.toggleAttribute("data-narrow", narrow);
    load(narrow ? "tall" : "wide");
    kick();
  }

  // eyepiece geometry in CSS px for a given scroll progress
  // where the photo sits on the stage (CSS px), and where its focus lands
  function place(w, h) {
    var k = Math.max(w / photo.w, h / photo.h);
    var ox = (w - photo.w * k) * photo.pos[0], oy = (h - photo.h * k) * photo.pos[1];
    return { k: k, ox: ox, oy: oy, fx: ox + photo.focus[0] * photo.w * k, fy: oy + photo.focus[1] * photo.h * k };
  }

  function scope(x) {
    var w = stage.clientWidth, h = stage.clientHeight;
    var bar = 60, gut = Math.max(16, Math.min(w * 0.04, 56));
    var r0, cx0, cy0;
    if (narrow) {
      r0 = Math.min(w * 0.4, (h - bar) * 0.27);
      cx0 = w / 2; cy0 = bar + 30 + r0 * 1.1;
    } else {
      r0 = Math.min((h - bar - 220) / 2, w * 0.25);
      cx0 = w - gut - r0 - Math.min(60, w * 0.03); cy0 = bar + (h - bar) / 2 + 6;
    }
    var mv = smooth(0.30, 0.66, x), op = smooth(0.50, 0.76, x);
    var pl = photo ? place(w, h) : { fx: w / 2, fy: h / 2 };
    var cx = mix(cx0, Math.min(w - r0 * 0.6, Math.max(r0 * 0.6, pl.fx)), mv);
    var cy = mix(cy0, Math.min(h - r0 * 0.4, Math.max(bar + r0 * 0.4, pl.fy)), mv);
    var far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) + 2;
    return { cx: cx, cy: cy, r: mix(r0, far, op * op), r0: r0, open: op, w: w, h: h };
  }

  function draw(now) {
    raf = 0;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    var still = reduced();
    var x = still ? 0.26 : p;
    var res = smooth(0.42, 0.66, x);
    if (res === 0) theta = Math.atan2(Math.sin(theta), Math.cos(theta)); // invisible: rotation by 2πk
    if (!still) {
      target += dt * 0.07 * (1 - res);
      theta += (target + pointerT - theta) * Math.min(1, dt * 3.2);
    }
    var s = scope(x);
    var m = mirrors(x);
    var shown = m.m < 0.5 ? m.a : m.b;

    hero.style.setProperty("--ax", s.cx.toFixed(1) + "px");
    hero.style.setProperty("--ay", s.cy.toFixed(1) + "px");
    hero.style.setProperty("--ar", s.r.toFixed(1) + "px");
    hero.style.setProperty("--open", s.open.toFixed(3));
    if (shown !== shownN) {
      shownN = shown; drawDial(shown);
      for (var i = 0; i < readN.length; i++) readN[i].classList.toggle("on", +readN[i].textContent === shown);
    }
    // the tube turns freely, but the view swings across the bright part of the scene (glass, light, the sum)
    var look = photo ? photo.dir + photo.swing * Math.sin(theta) : 0;
    if (readT) {
      var deg = Math.round(((look * (1 - res)) * 180 / Math.PI % 360 + 360) % 360);
      readT.textContent = ("00" + deg).slice(-3) + "°";
    }

    if (photo) {
      var pl = place(s.w, s.h), fx = pl.fx, fy = pl.fy;
      var wob = still ? 0 : (1 - res);
      fx += Math.sin(now / 5200) * 70 * wob; fy += Math.cos(now / 6900) * 46 * wob;
      var tfx = mix(fx, s.cx, res), tfy = mix(fy, s.cy, res);
      var zoom = mix((narrow ? 1.6 : 0.88) + 0.3 * smooth(0.1, 0.38, x), 1, res);
      gl.viewport(0, 0, W, H);
      gl.uniform2f(U.uRes, W, H);
      gl.uniform2f(U.uImg, photo.w, photo.h);
      gl.uniform2f(U.uOrigin, pl.ox * dpr, pl.oy * dpr);
      gl.uniform1f(U.uScale, pl.k * dpr);
      gl.uniform2f(U.uCenter, s.cx * dpr, H - s.cy * dpr);
      gl.uniform2f(U.uFocus, tfx * dpr, H - tfy * dpr);
      gl.uniform1f(U.uRadius, s.r * dpr);
      gl.uniform1f(U.uZoom, zoom);
      gl.uniform1f(U.uTheta, look * (1 - res));
      gl.uniform1f(U.uLift, 0.2 * (1 - res));
      gl.uniform1f(U.uNa, m.a);
      gl.uniform1f(U.uNb, m.b);
      gl.uniform1f(U.uMix, m.m);
      gl.uniform1f(U.uSeam, 1 - smooth(0.45, 0.6, x));
      gl.uniform1f(U.uRim, 1 - s.open);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (visible && !still) raf = requestAnimationFrame(draw);
  }

  function kick() { if (!raf) raf = requestAnimationFrame(draw); }

  function onScroll() {
    var r = hero.getBoundingClientRect();
    var span = Math.max(1, r.height - stage.clientHeight);
    p = reduced() ? 0 : Math.min(1, Math.max(0, -r.top / span));
    hero.style.setProperty("--p", p.toFixed(3));
    var y = window.scrollY;
    if (!reduced()) target += (y - lastScroll) * 0.0016; // scrolling also turns the tube
    lastScroll = y;
    kick();
  }

  stage.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    pointerT = (e.clientX / Math.max(1, stage.clientWidth) - 0.5) * 1.6;
    kick();
  });
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", onScroll, { passive: true });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (ents) { visible = ents[0].isIntersecting; if (visible) kick(); }).observe(hero);
  }
  canvas.addEventListener("webglcontextlost", function (ev) { ev.preventDefault(); hero.setAttribute("data-k", "off"); if (raf) cancelAnimationFrame(raf); });

  resize();
  onScroll();
})();
