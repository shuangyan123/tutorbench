/* global document, history, location, URLSearchParams, setTimeout */
// Case library: search, eight filter groups, sort, cards or compact rows, twelve to a page, all
// mirrored in the query string. Ported from the live site's case explorer (src/site.js) so the
// prototype keeps every function; text follows the language toggle.
(function () {
  "use strict";
  var form = document.getElementById("case-filters");
  if (!form) return;
  var root = document.documentElement;
  var fields = Array.prototype.slice.call(form.querySelectorAll("input[data-case-filter]"));
  var cards = Array.prototype.slice.call(document.querySelectorAll("[data-case-item]"));
  var search = document.querySelector("[data-case-search]");
  var sort = document.querySelector("[data-case-sort]");
  var results = document.querySelector("[data-case-results]");
  var grid = results && results.querySelector(".cx-grid");
  var pager = document.querySelector("[data-case-pagination]");
  var views = Array.prototype.slice.call(document.querySelectorAll("[data-case-view]"));
  var toggle = document.querySelector("[data-case-filter-toggle]");
  var panel = document.querySelector("[data-case-filter-panel]");
  var activeCount = document.querySelector("[data-case-active-filter-count]");
  var summary = document.querySelector("[data-case-filter-summary]");
  var count = document.getElementById("case-result-count");
  var empty = document.getElementById("case-filter-empty");
  var size = Number(results && results.getAttribute("data-page-size")) || 12;
  var KEYS = ["subject", "learnerLevel", "taskDifficulty", "pedagogicalDifficulty", "capability", "studentState", "locale", "disclosurePolicy"];
  var page = 1;
  var zh = function () { return root.getAttribute("data-lang") === "zh"; };

  function values() {
    var v = {};
    KEYS.forEach(function (k) { v[k] = []; });
    fields.forEach(function (f) { var k = f.getAttribute("data-case-filter"); if (k && f.checked && f.value) v[k].push(f.value); });
    return v;
  }
  function query() { return search ? search.value.trim().toLowerCase() : ""; }
  function has(list, x) { return list.indexOf(x) !== -1; }
  function matches(c, v, q) {
    var d = c.dataset, caps = (d.caseCapabilities || "").split(" ");
    return (!q || (d.caseSearchText || "").toLowerCase().indexOf(q) !== -1) &&
      (!v.locale.length || has(v.locale, d.caseLocale || "")) &&
      (!v.subject.length || has(v.subject, d.caseSubject || "")) &&
      (!v.learnerLevel.length || has(v.learnerLevel, d.caseLearnerLevel || "")) &&
      (!v.taskDifficulty.length || has(v.taskDifficulty, d.caseTaskDifficulty || "")) &&
      (!v.pedagogicalDifficulty.length || has(v.pedagogicalDifficulty, d.casePedagogicalDifficulty || "")) &&
      (!v.capability.length || v.capability.some(function (x) { return has(caps, x); })) &&
      (!v.studentState.length || has(v.studentState, d.caseStudentState || "")) &&
      (!v.disclosurePolicy.length || has(v.disclosurePolicy, d.caseDisclosurePolicy || ""));
  }
  function currentView() {
    var on = views.filter(function (b) { return b.getAttribute("aria-pressed") === "true"; })[0];
    return on && on.getAttribute("data-case-view") === "compact" ? "compact" : "cards";
  }
  function syncUrl(v, q) {
    var p = new URLSearchParams(location.search);
    KEYS.concat(["q", "sort", "view", "page"]).forEach(function (k) { p.delete(k); });
    KEYS.forEach(function (k) { v[k].forEach(function (x) { p.append(k, x); }); });
    if (q) p.set("q", q);
    if (sort && sort.value !== "case-id-asc") p.set("sort", sort.value);
    if (currentView() === "compact") p.set("view", "compact");
    if (page > 1) p.set("page", String(page));
    var s = p.toString();
    try { history.replaceState(history.state, "", location.pathname + (s ? "?" + s : "") + location.hash); } catch { /* sandboxed viewers */ }
  }
  var last = { start: 0, end: 0, total: 0, active: 0 };
  function words() {
    if (count) {
      var t = count.getAttribute(zh() ? "data-tpl-zh" : "data-tpl-en") || "{count}";
      count.textContent = t.split("{start}").join(last.start).split("{end}").join(last.end).split("{count}").join(last.total);
    }
    if (summary) summary.textContent = last.active === 0 ? (zh() ? "全部案例" : "All cases") : zh() ? last.active + " 个已启用筛选条件" : last.active + " active " + (last.active === 1 ? "filter" : "filters");
    if (search) search.placeholder = search.getAttribute(zh() ? "data-ph-zh" : "data-ph-en") || "";
    if (sort) Array.prototype.forEach.call(sort.options, function (o) { o.textContent = o.getAttribute(zh() ? "data-zh" : "data-en"); });
  }
  function pages(total) {
    if (!pager) return;
    pager.textContent = "";
    var n = Math.ceil(total / size);
    if (n <= 1) return;
    function add(label, target, disabled, current) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "cx-page"; b.textContent = label; b.disabled = disabled;
      if (current) b.setAttribute("aria-current", "page");
      b.addEventListener("click", function () { page = target; update(); var top = document.getElementById("case-library"); if (top) top.scrollIntoView({ block: "start" }); });
      pager.appendChild(b);
    }
    add(zh() ? "上一页" : "Previous", Math.max(1, page - 1), page === 1, false);
    var nums = [1, n, page - 1, page, page + 1].filter(function (x, i, a) { return x >= 1 && x <= n && a.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
    var prev = 0;
    nums.forEach(function (x) {
      if (prev && x - prev > 1) { var s = document.createElement("span"); s.className = "cx-gap"; s.textContent = "…"; pager.appendChild(s); }
      add(String(x), x, false, x === page); prev = x;
    });
    add(zh() ? "下一页" : "Next", Math.min(n, page + 1), page === n, false);
  }
  function order() {
    if (!grid) return;
    var s = sort ? sort.value : "case-id-asc";
    var id = function (c) { return c.dataset.caseId || ""; };
    // keep the array in display order too, so pages are cut from the sorted list
    cards = cards.slice().sort(function (a, b) {
      var r = id(a).localeCompare(id(b), "en", { numeric: true });
      if (s === "case-id-desc") r *= -1;
      if (s === "subject") r = (a.dataset.caseSubject || "").localeCompare(b.dataset.caseSubject || "", "en");
      if (s === "learner-level") r = (a.dataset.caseLearnerLevel || "").localeCompare(b.dataset.caseLearnerLevel || "", "en");
      if (s === "task-difficulty") r = Number(a.dataset.caseTaskDifficulty || 0) - Number(b.dataset.caseTaskDifficulty || 0);
      return r || id(a).localeCompare(id(b), "en", { numeric: true });
    });
    cards.forEach(function (c) { grid.appendChild(c); });
  }
  function update(noUrl) {
    var v = values(), q = query();
    var hit = cards.filter(function (c) { return matches(c, v, q); });
    var n = Math.max(1, Math.ceil(hit.length / size));
    page = Math.min(page, n);
    var first = (page - 1) * size, shown = hit.slice(first, first + size);
    cards.forEach(function (c) { c.hidden = shown.indexOf(c) === -1; });
    last.total = hit.length; last.start = hit.length ? first + 1 : 0; last.end = hit.length ? Math.min(first + size, hit.length) : 0;
    last.active = KEYS.reduce(function (t, k) { return t + v[k].length; }, 0) + (q ? 1 : 0);
    if (activeCount) activeCount.textContent = String(last.active);
    if (empty) empty.hidden = hit.length !== 0;
    if (grid) grid.hidden = hit.length === 0;
    words(); pages(hit.length);
    if (!noUrl) syncUrl(v, q);
  }
  function clear(k) { fields.forEach(function (f) { if (f.getAttribute("data-case-filter") === k) f.checked = f.hasAttribute("data-case-filter-all"); }); }
  function groupOf(f, all) { return fields.filter(function (x) { return x.getAttribute("data-case-filter") === f.getAttribute("data-case-filter") && x.hasAttribute("data-case-filter-all") === all; }); }

  // restore from the query string
  var p = new URLSearchParams(location.search);
  KEYS.forEach(function (k) {
    var vs = p.getAll(k); if (!vs.length) return;
    fields.forEach(function (f) { if (f.getAttribute("data-case-filter") === k) f.checked = !f.hasAttribute("data-case-filter-all") && vs.indexOf(f.value) !== -1; });
  });
  if (search) search.value = p.get("q") || "";
  if (sort && p.get("sort") && Array.prototype.some.call(sort.options, function (o) { return o.value === p.get("sort"); })) sort.value = p.get("sort");
  if (p.get("view") === "compact") { views.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-case-view") === "compact")); }); if (results) results.setAttribute("data-view", "compact"); }
  page = Math.max(1, Number(p.get("page")) || 1);

  fields.forEach(function (f) {
    f.addEventListener("change", function () {
      var all = f.hasAttribute("data-case-filter-all");
      if (all && f.checked) clear(f.getAttribute("data-case-filter"));
      if (!all && f.checked) groupOf(f, true).forEach(function (x) { x.checked = false; });
      if (!all && !f.checked && !groupOf(f, false).some(function (x) { return x.checked; })) groupOf(f, true).forEach(function (x) { x.checked = true; });
      if (all && !f.checked && !groupOf(f, false).some(function (x) { return x.checked; })) f.checked = true;
      page = 1; update();
    });
  });
  Array.prototype.forEach.call(form.querySelectorAll("[data-case-filter-clear]"), function (b) {
    b.addEventListener("click", function () { clear(b.getAttribute("data-case-filter-clear")); page = 1; update(); });
  });
  if (search) search.addEventListener("input", function () { page = 1; update(); });
  if (sort) sort.addEventListener("change", function () { order(); page = 1; update(); });
  form.addEventListener("submit", function (e) { e.preventDefault(); });
  form.addEventListener("reset", function () {
    setTimeout(function () { if (search) search.value = ""; if (sort) sort.value = "case-id-asc"; page = 1; order(); update(); }, 0);
  });
  views.forEach(function (b) {
    b.addEventListener("click", function () {
      views.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      if (results) results.setAttribute("data-view", b.getAttribute("data-case-view") === "compact" ? "compact" : "cards");
      update();
    });
  });
  if (toggle && panel) toggle.addEventListener("click", function () {
    var open = panel.getAttribute("data-open") === "true";
    panel.setAttribute("data-open", String(!open)); toggle.setAttribute("aria-expanded", String(!open));
  });
  document.addEventListener("langchange", function () { words(); pages(last.total); });

  order();
  update(true);
})();
