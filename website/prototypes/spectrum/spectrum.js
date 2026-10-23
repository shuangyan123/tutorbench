/* global window, document, navigator, history, location, requestAnimationFrame, setTimeout, IntersectionObserver, URL, CustomEvent */
/* Teachometry · Spectrum — prototype interactions.
   1) 语言切换  2) 顶栏状态  3) 封面见 cover.js  4) 分光滚动叙事  5) 图版架  6) 进场与复制 */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  function reduced() { return reduceQuery.matches || root.getAttribute("data-motion") === "reduce"; }
  function lang() { return root.getAttribute("data-lang") === "zh" ? "zh" : "en"; }

  /* ------------------------------------------------------------ 1 language */
  var langListeners = [];
  function setLang(next) {
    root.setAttribute("data-lang", next);
    root.lang = next === "zh" ? "zh-CN" : "en";
    try {
      var url = new URL(location.href);
      url.searchParams.set("lang", next);
      history.replaceState(null, "", url);
    } catch { /* 预览环境可能不允许改地址，忽略 */ }
    langListeners.forEach(function (fn) { fn(next); });
    document.dispatchEvent(new CustomEvent("langchange", { detail: next }));
  }
  var toggle = document.querySelector("[data-lang-toggle]");
  if (toggle) toggle.addEventListener("click", function () { setLang(lang() === "zh" ? "en" : "zh"); });

  /* ------------------------------------------------------------ 2 bar */
  var bar = document.querySelector("[data-bar]");
  function updateBar() {
    if (!bar) return;
    if (window.scrollY > 24) bar.setAttribute("data-scrolled", ""); else bar.removeAttribute("data-scrolled");
  }

  /* ------------------------------------------------------------ 3 cover: see cover.js (Blender frames) */

  /* ------------------------------------------------------------ 4 dispersion (figure stays, readings scroll) */
  var disp = document.querySelector("[data-disp]");
  var dispWide = window.matchMedia("(min-width: 961px) and (min-height: 600px)");
  var fig2 = disp ? disp.querySelector("[data-fig2]") : null;
  var labels = disp ? disp.querySelectorAll(".proof-scale li") : [];
  var readings = disp ? disp.querySelectorAll(".reading") : [];
  function dispMode() {
    if (!disp) return;
    disp.setAttribute("data-mode", dispWide.matches ? "scrolly" : "static");
    updateDisp();
  }
  function mark(list, idx) {
    Array.prototype.forEach.call(list, function (el, i) {
      if (i === idx) el.setAttribute("data-active", ""); else el.removeAttribute("data-active");
      if (i < idx) el.setAttribute("data-lit", ""); else el.removeAttribute("data-lit");
    });
  }
  function updateDisp() {
    if (!disp) return;
    if (disp.getAttribute("data-mode") !== "scrolly") { mark(labels, -1); mark(readings, -1); if (fig2) fig2.removeAttribute("data-active"); return; }
    var line = window.innerHeight * .58, idx = 0;
    Array.prototype.forEach.call(readings, function (el, i) { if (el.getBoundingClientRect().top < line) idx = i; });
    mark(labels, idx); mark(readings, idx);
    if (fig2) fig2.setAttribute("data-active", String(idx));
  }

  /* ------------------------------------------------------------ 5 specimen shelf */
  var SUBJ = {
    mathematics: ["Mathematics", "数学"], programming: ["Programming", "编程"], science: ["Science", "科学"],
    history_or_social_studies: ["History & social studies", "历史与社会"], language: ["Language", "语言"]
  };
  var LEVEL = {
    beginner: ["Beginner", "入门"], elementary: ["Elementary", "小学低年级"], "upper-elementary": ["Upper elementary", "小学高年级"],
    "middle-school": ["Middle school", "初中"], secondary: ["Secondary", "高中"]
  };
  var STATE = {
    conceptual_misconception: ["Conceptual misconception", "概念误解"], procedural_error: ["Procedural error", "步骤错误"],
    overconfident_incorrect: ["Overconfident, incorrect", "自信但有错"], partial_understanding: ["Partial understanding", "部分理解"],
    novice: ["Novice", "初学"], stuck_without_attempt: ["Stuck, no attempt yet", "卡住，尚未尝试"],
    uncertain_but_correct: ["Correct but unsure", "做对了但不确定"], correct_answer_wrong_reasoning: ["Right answer, wrong reasoning", "答案对，推理错"]
  };
  var T = {
    all: ["All", "全部"], state: ["Learner state", "学生状态"], no: ["Plate", "图版"],
    count: function (n, total) { return lang() === "zh" ? ("显示 " + n + " / " + total + " 个情境 · 每个都有中英两版，共 48 个案例") : ("Showing " + n + " of " + total + " situations · each in English and 简体中文, 48 cases"); }
  };
  function L(pair) { return pair ? pair[lang() === "zh" ? 1 : 0] : ""; }
  var shelf = document.querySelector("[data-shelf]");
  var filters = document.querySelector("[data-filters]");
  var countEl = document.querySelector("[data-shelf-count]");
  var current = "all";
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  function renderShelf() {
    if (!shelf || !window.SPECIMENS) return;
    var all = window.SPECIMENS;
    var counts = {}; all.forEach(function (s) { counts[s.subject] = (counts[s.subject] || 0) + 1; });
    var keys = Object.keys(SUBJ).filter(function (k) { return counts[k]; });
    filters.setAttribute("aria-label", lang() === "zh" ? "按学科筛选" : "Filter by subject");
    filters.innerHTML = ["all"].concat(keys).map(function (k) {
      var label = k === "all" ? L(T.all) : L(SUBJ[k]);
      var n = k === "all" ? all.length : counts[k];
      return '<button type="button" class="chip" data-subj="' + k + '" aria-pressed="' + (k === current) + '">' + esc(label) + "<b>" + n + "</b></button>";
    }).join("");
    var list = all.filter(function (s) { return current === "all" || s.subject === current; });
    var lk = lang() === "zh" ? "zh" : "en";
    var colors = ["var(--c0)", "var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)"];
    shelf.setAttribute("aria-label", lang() === "zh" ? "公开案例" : "Public cases");
    shelf.innerHTML = list.map(function (s) {
      var v = s[lk] || s.en;
      var idx = all.indexOf(s) + 1;
      return '<li class="spec">' +
        '<p class="spec-meta"><span class="no">' + L(T.no) + " " + String(idx).padStart(2, "0") + "</span><span>" + esc(L(SUBJ[s.subject])) + " · " + esc(L(LEVEL[s.level]) || s.level) + "</span></p>" +
        "<h3>" + esc(v.topic) + "</h3>" +
        '<blockquote lang="' + (lk === "zh" ? "zh-CN" : "en") + '">' + esc(v.msg) + "</blockquote>" +
        '<p class="spec-state">' + esc(L(T.state)) + " · <b>" + esc(L(STATE[s.state]) || s.state) + "</b></p>" +
        '<span class="slots5" role="img" aria-label="' + (lang() === "zh" ? "五个维度均未评分" : "Five dimensions, not scored") + '">' + colors.map(function (c) { return '<i style="--c:' + c + '"></i>'; }).join("") + '<em aria-hidden="true">' + (lang() === "zh" ? "未评分" : "not scored") + "</em></span>" +
        "</li>";
    }).join("");
    if (countEl) countEl.textContent = T.count(list.length, all.length);
  }
  if (filters) filters.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-subj]"); if (!b) return;
    current = b.getAttribute("data-subj"); renderShelf(); shelf.scrollTo({ left: 0, behavior: reduced() ? "auto" : "smooth" });
  });
  function shelfStep(dir) {
    if (!shelf) return;
    var card = shelf.querySelector(".spec"); var w = card ? card.getBoundingClientRect().width + 22 : 400;
    shelf.scrollBy({ left: dir * w * (window.innerWidth > 900 ? 2 : 1), behavior: reduced() ? "auto" : "smooth" });
  }
  var prev = document.querySelector("[data-shelf-prev]"), next = document.querySelector("[data-shelf-next]");
  if (prev) prev.addEventListener("click", function () { shelfStep(-1); });
  if (next) next.addEventListener("click", function () { shelfStep(1); });
  function navLabels() {
    if (prev) prev.setAttribute("aria-label", lang() === "zh" ? "上一组" : "Previous");
    if (next) next.setAttribute("aria-label", lang() === "zh" ? "下一组" : "Next");
  }

  /* ------------------------------------------------------------ 6 reveal + copy */
  var reveals = document.querySelectorAll("[data-reveal], .rail");
  if ("IntersectionObserver" in window && !reduced()) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { en.target.setAttribute("data-in", ""); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -12% 0px" });
    Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });
  } else {
    Array.prototype.forEach.call(reveals, function (el) { el.setAttribute("data-in", ""); });
  }
  var copyBtn = document.querySelector("[data-copy]");
  if (copyBtn) copyBtn.addEventListener("click", function () {
    var code = document.querySelector("[data-term] code");
    var text = code ? code.textContent.split("\n").filter(function (l) { return l.trim().indexOf("#") !== 0; }).join("\n") : "";
    var done = function () {
      var en = copyBtn.querySelector(".en"), zh = copyBtn.querySelector(".zh");
      if (en) en.textContent = "Copied"; if (zh) zh.textContent = "已复制";
      setTimeout(function () { if (en) en.textContent = "Copy"; if (zh) zh.textContent = "复制"; }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done); else done();
  });

  /* ------------------------------------------------------------ wiring */
  langListeners.push(renderShelf, navLabels);
  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { ticking = false; updateBar(); updateDisp(); });
  }, { passive: true });
  window.addEventListener("resize", function () { dispMode(); updateBar(); });
  if (dispWide.addEventListener) dispWide.addEventListener("change", dispMode);
  if (reduceQuery.addEventListener) reduceQuery.addEventListener("change", dispMode);

  renderShelf(); navLabels(); dispMode(); updateBar();
})();
