/* global window, document, performance, requestAnimationFrame, IntersectionObserver */
/* Teachometry · Spectrum — cover scene.
   一本打开的期刊放在白天的木桌上。百叶窗的阳光斜照进来，书页上立着一块玻璃棱镜，
   五条色光落在右页印好的标尺上（λ1–λ5）。左页是封面文章的标题。
   滚动时镜头推近书页；移动指针时阳光微微偏转。 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const root = document.documentElement;
const hero = document.querySelector("[data-hero]");
const canvas = document.querySelector("[data-hero-canvas]");
const stage = canvas ? canvas.parentElement : null;
const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const reduced = () => reduceQuery.matches || root.getAttribute("data-motion") === "reduce";
const lang = () => (root.getAttribute("data-lang") === "zh" ? "zh" : "en");

/* ------------------------------------------------------------ book dimensions (world units ≈ decimetres) */
const PW = 1.42;      // page width
const PD = 1.92;      // page depth (top to bottom of the page)
const BLOCK = 0.07;   // page-block thickness at the spine
const LIFT = 0.045;   // how far pages rise away from the gutter
const COVER = 0.016;
const TEX_W = 1792, TEX_H = Math.round(TEX_W * PD / PW);
const PX = TEX_W / PW;   // canvas pixels per world unit

// prism and the light it throws on the right page (page-local x from the spine, z from page centre)
const PRISM = { x: 0.36, z: -0.08, side: 0.3, len: 0.86 };
const BANDS = [0.80, 0.90, 1.0, 1.1, 1.2];        // x of λ1…λ5 on the right page
const BAND_Z = [PRISM.z - PRISM.len * 0.42, PRISM.z + PRISM.len * 0.42];
const INK_COLORS = ["#b8441c", "#8a6200", "#0f7a51", "#2557d0", "#6a3fd0"];

function pageY(ax) {
  // height of the page surface at distance ax from the gutter
  const s = Math.min(1, ax / 0.32);
  const rise = s * s * (3 - 2 * s);
  const edge = Math.max(0, (ax - PW * 0.82) / (PW * 0.18));
  return BLOCK + LIFT * rise - 0.014 * edge * edge;
}

/* ------------------------------------------------------------ canvas helpers */
function makeCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function wrap(ctx, text, maxW) {
  const cjk = /[㐀-鿿]/.test(text);
  const tokens = cjk ? Array.from(text) : text.split(" ");
  const lines = []; let line = "";
  for (const t of tokens) {
    const next = line ? (cjk ? line + t : line + " " + t) : t;
    if (ctx.measureText(next).width > maxW && line) {
      if (cjk && /^[，。、；：！？」』）]$/.test(t)) { lines.push(line + t); line = ""; continue; }
      lines.push(line); line = t;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
function spaced(ctx, text, x, y, spacing, align) {
  // letter-spaced uppercase label
  const chars = Array.from(text);
  let w = 0; chars.forEach((c) => { w += ctx.measureText(c).width + spacing; }); w -= spacing;
  let cx = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
  chars.forEach((c) => { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + spacing; });
}
function paperGround(ctx, w, h, gutterSide) {
  ctx.fillStyle = "#f5f1e8"; ctx.fillRect(0, 0, w, h);
  // fibres and speckle
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 7;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9;
  }
  ctx.putImageData(img, 0, 0);
  // baked gutter shade and a soft outer-edge falloff
  const gx = gutterSide === "right" ? w : 0;
  const g = ctx.createLinearGradient(gx, 0, gutterSide === "right" ? w - 260 : 260, 0);
  g.addColorStop(0, "rgba(70,55,35,.30)"); g.addColorStop(0.35, "rgba(70,55,35,.08)"); g.addColorStop(1, "rgba(70,55,35,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

const COPY = {
  en: {
    head: "TEACHOMETRY · VOL. 0, NO. 1", date: "OCTOBER 2026", kicker: "LEAD ARTICLE",
    title: [["Knowing the", false], ["answer is not", false], ["teaching.", true]],
    stand: "An AI reply can sound right, fluent and kind, and still leave a learner further from understanding. We built an instrument that splits that light apart.",
    absL: "ABSTRACT",
    abs: "A tutoring reply can be fluent, warm and wrong in ways a tone check never sees. We treat each reply as white light and pass it through an instrument that separates five qualities. Its 48 authored cases are public; its results table is, for now, deliberately empty.",
    figHead: "FIG. 1", figRun: "ONE REPLY, DISPERSED",
    names: ["Correctness", "Diagnosis", "Guidance", "Adaptation", "Actionability"],
    cap: "Fig. 1  A tutoring reply passed through TutorBench. Each band lands on the scale as one dimension. The light on this page is rendered live; an illustration, not data.",
    legendA: "Incident light · one reply", legendB: "Prism · TutorBench",
  },
  zh: {
    head: "TEACHOMETRY · 第 0 卷第 1 期", date: "2026 年 10 月", kicker: "封面文章",
    title: [["会答题，", false], ["不等于会教。", false]],
    stand: "一段 AI 回复可以听起来正确、流畅、友善，却仍然让学生离理解更远。我们造了一台仪器，把这束光拆开来看。",
    absL: "摘要",
    abs: "教学回复可以流畅、温暖，同时以语气检查看不见的方式出错。我们把每段回复当作白光，让它穿过一台仪器，分离出五种品质。48 个编写案例全部公开，成绩表目前刻意留空。",
    figHead: "图 1", figRun: "一段回复的分光",
    names: ["正确性", "诊断能力", "引导能力", "适应能力", "可执行性"],
    cap: "图 1　一段教学回复穿过 TutorBench。每条色带落在标尺上，对应一个维度。本页上的光为实时渲染，是示意图，不是数据。",
    legendA: "入射光 · 一段回复", legendB: "棱镜 · TutorBench",
  },
};

function drawLeft(ctx) {
  const c = COPY[lang()], zh = lang() === "zh";
  paperGround(ctx, TEX_W, TEX_H, "right");
  const L = 170, R = TEX_W - 190;
  ctx.fillStyle = "#1b1a16";
  ctx.font = '500 25px "Geist Mono", monospace'; spaced(ctx, c.head, L, 150, 5);
  spaced(ctx, c.date, R, 150, 5, "right");
  ctx.fillRect(L, 176, R - L, 2);
  ctx.fillStyle = "#5d574c";
  ctx.font = (zh ? '500 30px "Noto Sans SC", sans-serif' : '500 27px "Geist Mono", monospace'); spaced(ctx, c.kicker, L, 360, zh ? 8 : 6);
  ctx.fillStyle = "#16150f";
  let y = 600;
  if (zh) {
    ctx.font = '700 172px "Noto Serif SC", serif';
    c.title.forEach(([t]) => { ctx.fillText(t, L - 8, y); y += 220; });
  } else {
    c.title.forEach(([t, it]) => { ctx.font = (it ? "italic " : "") + '400 222px "Instrument Serif", serif'; ctx.fillText(t, L - 10, y); y += 196; });
  }
  y += 40;
  ctx.fillRect(L, y, 260, 3);
  y += 92;
  ctx.fillStyle = "#2a2722";
  ctx.font = zh ? '400 50px "Noto Serif SC", serif' : '400 57px "Newsreader", serif';
  wrap(ctx, c.stand, R - L).forEach((ln) => { ctx.fillText(ln, L, y); y += zh ? 88 : 78; });
  // abstract box
  y = Math.max(y + 70, TEX_H - 640);
  ctx.fillStyle = "#16150f"; ctx.fillRect(L, y, R - L, 2);
  ctx.font = zh ? '500 30px "Noto Sans SC", sans-serif' : '500 25px "Geist Mono", monospace';
  spaced(ctx, c.absL, L, y + 60, zh ? 6 : 6);
  ctx.fillStyle = "#45413a";
  ctx.font = zh ? '400 35px "Noto Serif SC", serif' : '400 39px "Newsreader", serif';
  let ay = y + 130;
  wrap(ctx, c.abs, R - L).forEach((ln) => { ctx.fillText(ln, L, ay); ay += zh ? 64 : 56; });
  ctx.fillStyle = "#6d675d"; ctx.font = '400 30px "Newsreader", serif';
  ctx.textAlign = "center"; ctx.fillText("1", TEX_W / 2, TEX_H - 110); ctx.textAlign = "left";
}

function drawRight(ctx) {
  const c = COPY[lang()], zh = lang() === "zh";
  paperGround(ctx, TEX_W, TEX_H, "left");
  const L = 190, R = TEX_W - 170;
  const X = (x) => x * PX, Z = (z) => (z + PD / 2) * PX;
  ctx.fillStyle = "#1b1a16";
  ctx.font = (zh ? '500 28px "Noto Sans SC", sans-serif' : '500 25px "Geist Mono", monospace');
  spaced(ctx, c.figHead, L, 150, 5); spaced(ctx, c.figRun, R, 150, zh ? 6 : 5, "right");
  ctx.fillRect(L, 176, R - L, 2);
  // faint measuring grid under the figure
  ctx.strokeStyle = "rgba(40,35,25,.07)"; ctx.lineWidth = 2;
  for (let gx = L; gx <= R; gx += 64) { ctx.beginPath(); ctx.moveTo(gx, 260); ctx.lineTo(gx, Z(BAND_Z[1]) + 120); ctx.stroke(); }
  for (let gy = 260; gy <= Z(BAND_Z[1]) + 120; gy += 64) { ctx.beginPath(); ctx.moveTo(L, gy); ctx.lineTo(R, gy); ctx.stroke(); }
  // printed scale under the five bands
  const sy = Z(BAND_Z[1]) + 150;
  const x0 = X(BANDS[0] - 0.08), x1 = X(BANDS[4] + 0.08);
  ctx.fillStyle = "#16150f"; ctx.fillRect(x0, sy, x1 - x0, 4);
  for (let t = 0; t <= 40; t++) {
    const tx = x0 + (x1 - x0) * t / 40, major = t % 5 === 0;
    ctx.fillRect(tx - 1, sy, 2, major ? 34 : 18);
  }
  // labels: λn and the dimension name, set vertically like a spine label
  BANDS.forEach((bx, i) => {
    ctx.save();
    ctx.translate(X(bx), sy + 70);
    ctx.fillStyle = "#3c3830"; ctx.font = '400 42px "Newsreader", serif'; ctx.textAlign = "center";
    ctx.fillText("λ" + (i + 1), 0, 0);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = INK_COLORS[i];
    ctx.textAlign = "left";
    if (zh) { ctx.font = '500 44px "Noto Sans SC", sans-serif'; spaced(ctx, c.names[i], 34, 15, 6); }
    else { ctx.font = '500 36px "Geist Mono", monospace'; spaced(ctx, c.names[i].toUpperCase(), 34, 13, 4); }
    ctx.restore();
  });
  // small legend near the prism
  ctx.fillStyle = "#45413a"; ctx.font = zh ? '400 30px "Noto Sans SC", sans-serif' : '400 27px "Geist Mono", monospace';
  const ly = Z(BAND_Z[0]) - 90;
  [["A", c.legendA], ["B", c.legendB]].forEach(([k, t], i) => {
    const yy = ly - (1 - i) * 52;
    ctx.beginPath(); ctx.strokeStyle = "#16150f"; ctx.lineWidth = 2; ctx.arc(L + 16, yy - 9, 18, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#16150f"; ctx.font = '500 22px "Geist Mono", monospace'; ctx.textAlign = "center"; ctx.fillText(k, L + 16, yy - 1); ctx.textAlign = "left";
    ctx.fillStyle = "#45413a"; ctx.font = zh ? '400 30px "Noto Sans SC", sans-serif' : '400 27px "Geist Mono", monospace';
    ctx.fillText(t, L + 52, yy);
  });
  // caption
  ctx.fillStyle = "#16150f"; ctx.fillRect(L, TEX_H - 400, R - L, 2);
  ctx.fillStyle = "#3c3830"; ctx.font = zh ? '400 34px "Noto Serif SC", serif' : 'italic 400 38px "Newsreader", serif';
  let cy = TEX_H - 330;
  wrap(ctx, c.cap, R - L).forEach((ln) => { ctx.fillText(ln, L, cy); cy += zh ? 60 : 54; });
  ctx.fillStyle = "#6d675d"; ctx.font = '400 30px "Newsreader", serif';
  ctx.textAlign = "center"; ctx.fillText("2", TEX_W / 2, TEX_H - 110); ctx.textAlign = "left";
}

function drawLight(ctx, w, h, phase) {
  // the dispersed light that falls on the right page: drawn on black and added to the page
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  const X = (x) => x * PX, Z = (z) => (z + PD / 2) * PX;
  const z0 = Z(BAND_Z[0]), z1 = Z(BAND_Z[1]);
  // warm wash between prism and scale
  const wash = ctx.createLinearGradient(X(PRISM.x + 0.15), 0, X(BANDS[4] + 0.1), 0);
  wash.addColorStop(0, "rgba(255,240,210,.0)"); wash.addColorStop(0.35, "rgba(255,235,200,.18)"); wash.addColorStop(1, "rgba(255,235,200,0)");
  ctx.fillStyle = wash; ctx.fillRect(X(PRISM.x + 0.15), z0, X(BANDS[4] + 0.1) - X(PRISM.x + 0.15), z1 - z0);
  const sx0 = X(BANDS[0] - 0.07 + phase * 0.01), sx1 = X(BANDS[4] + 0.07 + phase * 0.02);
  const sp = ctx.createLinearGradient(sx0, 0, sx1, 0);
  [[0, "rgba(0,0,0,0)"], [0.05, "#c62a12"], [0.14, "#ff4a1c"], [0.3, "#ffa21a"], [0.42, "#ffe23a"], [0.52, "#40d070"], [0.66, "#1fb0c8"], [0.78, "#2f5cff"], [0.9, "#7a3cff"], [1, "rgba(0,0,0,0)"]].forEach(([o, col]) => sp.addColorStop(o, col));
  ctx.fillStyle = sp; ctx.fillRect(sx0, z0, sx1 - sx0, z1 - z0);
  // soften both ends of the bands
  ctx.globalCompositeOperation = "destination-in";
  const fade = ctx.createLinearGradient(0, z0, 0, z1);
  fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(0.12, "#000"); fade.addColorStop(0.88, "#000"); fade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fade; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
}

function woodTexture() {
  const c = makeCanvas(1024, 1024), ctx = c.getContext("2d");
  ctx.fillStyle = "#cdbda3"; ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * 1024, a = 0.03 + Math.random() * 0.07, wv = 4 + Math.random() * 14;
    ctx.strokeStyle = Math.random() < 0.5 ? `rgba(110,80,45,${a})` : `rgba(240,225,200,${a})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    for (let x = 0; x <= 1024; x += 16) ctx.lineTo(x, y + Math.sin(x / 140 + i) * wv + Math.sin(x / 37 + i * 3) * 1.5);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.2, 2.2); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function blindsCookie() {
  const c = makeCanvas(512, 512), ctx = c.getContext("2d");
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 512, 512);
  const g = ctx.createRadialGradient(256, 256, 40, 256, 256, 256);
  g.addColorStop(0, "#fff"); g.addColorStop(0.75, "#fff"); g.addColorStop(1, "#000");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < 9; i++) {
    const y = 20 + i * 56;
    const s = ctx.createLinearGradient(0, y, 0, y + 22);
    s.addColorStop(0, "#fff"); s.addColorStop(0.5, "#4a4a4a"); s.addColorStop(1, "#fff");
    ctx.fillStyle = s; ctx.fillRect(0, y, 512, 22);
  }
  ctx.fillStyle = "#555"; ctx.fillRect(252, 0, 8, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function softShadowTexture() {
  const c = makeCanvas(256, 256), ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(0.6, "rgba(0,0,0,.2)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function longShadowTexture() {
  // the glass's shadow: darkest next to the prism, fading out past the scale, soft at the ends
  const c = makeCanvas(512, 256), ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 512, 0);
  g.addColorStop(0, "rgba(40,30,20,.0)"); g.addColorStop(0.06, "rgba(40,30,20,.75)"); g.addColorStop(0.55, "rgba(40,30,20,.6)"); g.addColorStop(1, "rgba(40,30,20,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 256);
  ctx.globalCompositeOperation = "destination-in";
  const v = ctx.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(0.16, "#000"); v.addColorStop(0.84, "#000"); v.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, 512, 256);
  return new THREE.CanvasTexture(c);
}

/* ------------------------------------------------------------ geometry */
function pageSurfacePatch(x0, x1, z0, z1, lift) {
  // a piece of the right page surface (follows its curve)
  const nx = 24, pos = [], uv = [], idx = [];
  for (let j = 0; j <= 1; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j;
    pos.push(x, pageY(x) + lift, z); uv.push(i / nx, 1 - j);
  }
  for (let i = 0; i < nx; i++) { const a = i, b = i + 1, c = i + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function pageSurface(side, lift) {
  // side = -1 (left page) or 1 (right page); spine at x = 0
  const nx = 48, nz = 2, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx, ax = side < 0 ? (1 - u) * PW : u * PW;
      const x = side * ax, z = -PD / 2 + (j / nz) * PD;
      pos.push(x, pageY(ax) + lift, z);
      uv.push(u, 1 - j / nz);
    }
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function pageEdges(side) {
  // the visible stack of page edges: front, back and outer side
  const nx = 48, pos = [], uv = [], idx = [];
  function quad(a, b, c, d, ua, ub) {
    const n = pos.length / 3;
    pos.push(...a, ...b, ...c, ...d);
    uv.push(ua, 0, ub, 0, ub, 1, ua, 1);
    idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  for (const zf of [PD / 2, -PD / 2]) {
    for (let i = 0; i < nx; i++) {
      const a0 = i / nx * PW, a1 = (i + 1) / nx * PW;
      const x0 = side * a0, x1 = side * a1;
      const y0 = pageY(a0), y1 = pageY(a1);
      if ((zf > 0) === (side > 0)) quad([x0, COVER, zf], [x1, COVER, zf], [x1, y1, zf], [x0, y0, zf], a0, a1);
      else quad([x1, COVER, zf], [x0, COVER, zf], [x0, y0, zf], [x1, y1, zf], a1, a0);
    }
  }
  const xo = side * PW, yo = pageY(PW);
  if (side > 0) quad([xo, COVER, PD / 2], [xo, COVER, -PD / 2], [xo, yo, -PD / 2], [xo, yo, PD / 2], 0, 1);
  else quad([xo, COVER, -PD / 2], [xo, COVER, PD / 2], [xo, yo, PD / 2], [xo, yo, -PD / 2], 0, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function edgeTexture() {
  const c = makeCanvas(64, 256), ctx = c.getContext("2d");
  ctx.fillStyle = "#efe8da"; ctx.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 3) { ctx.fillStyle = `rgba(120,100,70,${0.08 + Math.random() * 0.12})`; ctx.fillRect(0, y, 64, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(8, 1);
  return t;
}
function prismGeometry() {
  const s = PRISM.side, h = s * Math.sqrt(3) / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-s / 2, 0); shape.lineTo(s / 2, 0); shape.lineTo(0, h); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: PRISM.len, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 1 });
  g.translate(0, 0, -PRISM.len / 2);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------ scene */
async function start() {
  if (!hero || !canvas) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    hero.setAttribute("data-gl", "off"); return;
  }
  try { await Promise.all(['400 100px "Instrument Serif"', 'italic 400 100px "Instrument Serif"', '400 40px "Newsreader"', 'italic 400 40px "Newsreader"', '500 20px "Geist Mono"', '700 100px "Noto Serif SC"', '400 40px "Noto Serif SC"', '500 30px "Noto Sans SC"'].map((f) => document.fonts.load(f, "Aa会答题λ"))); } catch { /* 字体失败时用后备字体 */ }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e6dfd2");
  scene.fog = new THREE.Fog("#e6dfd2", 9, 22);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);

  // desk
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.62, metalness: 0 }));
  desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; scene.add(desk);

  // soft contact shadow under the book
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(PW * 2 + 0.7, PD + 0.6), new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false, opacity: 0.9 }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = 0.002; scene.add(contact);

  const book = new THREE.Group(); scene.add(book);
  // cloth covers
  const clothMat = new THREE.MeshStandardMaterial({ color: "#26314a", roughness: 0.85 });
  [-1, 1].forEach((side) => {
    const cv = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.04, COVER, PD + 0.07), clothMat);
    cv.position.set(side * (PW + 0.04) / 2, COVER / 2, 0); cv.castShadow = true; cv.receiveShadow = true; book.add(cv);
  });
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, PD + 0.07, 12, 1, false, 0, Math.PI), clothMat);
  spine.rotation.x = Math.PI / 2; spine.rotation.z = Math.PI; spine.position.set(0, 0.012, 0); book.add(spine);

  // pages
  const leftCanvas = makeCanvas(TEX_W, TEX_H), rightCanvas = makeCanvas(TEX_W, TEX_H);
  const leftTex = new THREE.CanvasTexture(leftCanvas), rightTex = new THREE.CanvasTexture(rightCanvas);
  [leftTex, rightTex].forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); });
  function paintPages() {
    drawLeft(leftCanvas.getContext("2d")); drawRight(rightCanvas.getContext("2d"));
    leftTex.needsUpdate = true; rightTex.needsUpdate = true;
  }
  paintPages();
  const pageMat = (map) => new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 });
  const left = new THREE.Mesh(pageSurface(-1, 0), pageMat(leftTex));
  const right = new THREE.Mesh(pageSurface(1, 0), pageMat(rightTex));
  [left, right].forEach((m) => { m.receiveShadow = true; m.castShadow = true; book.add(m); });
  const edgeMat = new THREE.MeshStandardMaterial({ map: edgeTexture(), roughness: 0.95 });
  [-1, 1].forEach((side) => { const e = new THREE.Mesh(pageEdges(side), edgeMat); e.receiveShadow = true; e.castShadow = true; book.add(e); });

  // ribbon bookmark: lies in the gutter, runs off the bottom edge and onto the desk
  {
    const pts = [], n = 30, wdt = 0.028;
    for (let i = 0; i <= n; i++) {
      const t = i / n, z = PD / 2 - 0.42 + t * 0.62, x = 0.03 + t * 0.05;
      const over = z - PD / 2;
      const y = over < 0 ? pageY(Math.abs(x)) + 0.003 : Math.max(0.003, pageY(Math.abs(x)) + 0.003 - over * 1.6 - over * over * 3);
      pts.push([x, y, z]);
    }
    const pos = [], idx = [];
    pts.forEach(([x, y, z]) => { pos.push(x - wdt / 2, y, z, x + wdt / 2, y, z); });
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const ribbon = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: "#7e2418", roughness: 0.6, side: THREE.DoubleSide }));
    ribbon.castShadow = true; ribbon.receiveShadow = true; book.add(ribbon);
  }

  // the light the prism throws, added onto the right page
  const lightCanvas = makeCanvas(TEX_W / 2, TEX_H / 2);
  const lightTex = new THREE.CanvasTexture(lightCanvas); lightTex.colorSpace = THREE.SRGBColorSpace;
  function paintLight(phase) {
    const ctx = lightCanvas.getContext("2d");
    ctx.save(); ctx.scale(0.5, 0.5); drawLight(ctx, TEX_W, TEX_H, phase); ctx.restore();
    lightTex.needsUpdate = true;
  }
  paintLight(0);
  const glowMat = new THREE.MeshBasicMaterial({ map: lightTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 });
  const glow = new THREE.Mesh(pageSurface(1, 0.0015), glowMat); book.add(glow);

  // prism lying on the right page, its long axis running down the page
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#ffffff", metalness: 0, roughness: 0.0, transmission: 1, thickness: 0.9, ior: 1.6,
    dispersion: 8, attenuationColor: new THREE.Color("#e2f1ec"), attenuationDistance: 1.2,
    specularIntensity: 1, clearcoat: 0.4, clearcoatRoughness: 0.05, envMapIntensity: 1.4,
  });
  const prism = new THREE.Mesh(prismGeometry(), glass);
  prism.position.set(PRISM.x, pageY(PRISM.x) + 0.006, PRISM.z);
  prism.castShadow = false; book.add(prism);
  const ridges = new THREE.LineSegments(new THREE.EdgesGeometry(prism.geometry, 25), new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55 }));
  ridges.position.copy(prism.position); book.add(ridges);
  const pShadow = new THREE.Mesh(pageSurfacePatch(PRISM.x - 0.1, BANDS[4] + 0.12, PRISM.z - PRISM.len * 0.5, PRISM.z + PRISM.len * 0.5, 0.001), new THREE.MeshBasicMaterial({ map: longShadowTexture(), transparent: true, depthWrite: false, opacity: 0.66 }));
  book.add(pShadow);

  // light: soft sky fill + warm sun through blinds
  scene.add(new THREE.HemisphereLight("#f4f1ec", "#8d8170", 1.35));
  const sun = new THREE.SpotLight("#ffe9c8", 190, 30, 0.38, 0.6, 1.6);
  sun.position.set(-6.2, 3.4, 1.2); sun.target.position.set(0.3, 0, -0.1);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.radius = 6; sun.shadow.camera.near = 2; sun.shadow.camera.far = 14;
  sun.map = blindsCookie();
  scene.add(sun, sun.target);

  /* ------------------------------------------------------------ framing, input, loop */
  let W = 1, H = 1, narrow = false;
  const look = new THREE.Vector3(), from = new THREE.Vector3();
  const dir = new THREE.Vector3(0.02, 1.6, 0.98).normalize();
  function resize() {
    W = stage.clientWidth; H = stage.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.5 : 1.25);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    narrow = W / H < 0.9;
    hero.toggleAttribute("data-narrow", narrow);
    kick();
  }
  function frame(p, px, py) {
    // p: 0 overview → 1 close over the left page. On phones the book fits the width.
    const a = W / H;
    const vf = THREE.MathUtils.degToRad(camera.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * a);
    const fitW = narrow ? 3.2 : 3.9;
    const dist0 = Math.max(fitW / 2 / Math.tan(hf / 2), narrow ? 0 : 6.1);
    const dist1 = narrow ? dist0 * 0.62 : 2.6;
    const d = THREE.MathUtils.lerp(dist0, dist1, p);
    const lx = THREE.MathUtils.lerp(narrow ? 0.05 : 0.04, -0.7, p);
    const lz = THREE.MathUtils.lerp(narrow ? 0.7 : 0.5, -0.2, p);
    look.set(lx + px * 0.05, 0, lz);
    from.copy(dir).multiplyScalar(d).add(look);
    from.x += px * 0.18; from.y += py * -0.08;
    camera.position.copy(from); camera.lookAt(look);
  }

  const ptr = { x: 0, y: 0 }, ptrT = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => { ptrT.x = (e.clientX / window.innerWidth - 0.5) * 2; ptrT.y = (e.clientY / window.innerHeight - 0.5) * 2; }, { passive: true });
  window.addEventListener("resize", resize);
  document.addEventListener("langchange", () => { paintPages(); kick(); });

  let visible = true, raf = 0, shown = false, lastPhase = 0;
  const t0 = performance.now();
  function render(now) {
    const t = (now - t0) / 1000, rm = reduced();
    ptr.x += (ptrT.x - ptr.x) * 0.05; ptr.y += (ptrT.y - ptr.y) * 0.05;
    const px = rm ? 0 : ptr.x, py = rm ? 0 : ptr.y;
    const r = hero.getBoundingClientRect();
    const span = Math.max(1, r.height - window.innerHeight);
    const p = rm ? 0 : Math.max(0, Math.min(1, -r.top / span));
    const e = p * p * (3 - 2 * p);
    frame(e, px, py);
    // sun drifts with the pointer; the blinds sway a little
    sun.position.set(-6.2 + px * 0.5, 3.4 - py * 0.2, 1.2 + Math.sin(t * 0.3) * (rm ? 0 : 0.05));
    const intro = rm ? 1 : Math.min(1, Math.max(0, (t - 0.5) / 1.8));
    glowMat.opacity = intro * (0.5 + (rm ? 0 : Math.sin(t * 1.3) * 0.025));
    const phase = rm ? 0 : px;
    if (Math.abs(phase - lastPhase) > 0.08) { lastPhase = phase; paintLight(phase); }
    hero.style.setProperty("--p", e.toFixed(3));
    renderer.render(scene, camera);
    if (!shown) { shown = true; hero.setAttribute("data-gl", "on"); }
  }
  function loop(now) { raf = 0; if (!visible || document.hidden) return; render(now); if (!reduced()) raf = requestAnimationFrame(loop); }
  function kick() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop); }
  window.addEventListener("scroll", kick, { passive: true });
  document.addEventListener("visibilitychange", kick);
  if ("IntersectionObserver" in window) new IntersectionObserver((ents) => { visible = ents[0].isIntersecting; kick(); }).observe(hero);
  canvas.addEventListener("webglcontextlost", (ev) => { ev.preventDefault(); hero.setAttribute("data-gl", "off"); });
  resize();
}

start().catch(() => { if (hero) hero.setAttribute("data-gl", "off"); });
