/* global document, window, navigator, IntersectionObserver */
// Run and Docs pages of the Spectrum prototype. A port of the live site.js handlers (run console tabs
// and copy buttons; docs search, category filters and the reference count), made bilingual: labels
// and status lines carry both languages, and attributes swap with the language toggle.
(function () {
  "use strict";
  var root = document.documentElement;
  function zh() { return root.getAttribute("data-lang") === "zh"; }

  // attributes that come in two languages: data-<name>-en / data-<name>-zh
  function applyAttrs() {
    ["aria-label", "placeholder"].forEach(function (name) {
      Array.prototype.forEach.call(document.querySelectorAll("[data-" + name + "-en]"), function (el) {
        el.setAttribute(name, el.getAttribute("data-" + name + (zh() ? "-zh" : "-en")));
      });
    });
  }
  applyAttrs();
  document.addEventListener("langchange", applyAttrs);

  /* ---- run console: tabs (arrow keys, Home, End) and copy */
  var consoleEl = document.querySelector(".run-console");
  if (consoleEl) {
    var tabs = Array.prototype.slice.call(consoleEl.querySelectorAll("[data-run-tab]"));
    var panels = Array.prototype.slice.call(consoleEl.querySelectorAll("[data-run-panel]"));
    var select = function (id, focus) {
      tabs.forEach(function (tab) {
        var on = tab.getAttribute("data-run-tab") === id;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        if (on && focus) tab.focus();
      });
      panels.forEach(function (p) { p.hidden = p.getAttribute("data-run-panel") !== id; });
    };
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab.getAttribute("data-run-tab"), false); });
      tab.addEventListener("keydown", function (e) {
        var n = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % tabs.length
          : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i + tabs.length - 1) % tabs.length
            : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
        if (n !== null) { e.preventDefault(); select(tabs[n].getAttribute("data-run-tab"), true); }
      });
    });

    var setLabels = function (button, en, zhText, ariaEn, ariaZh) {
      var labels = button.querySelectorAll("[data-copy-label]");
      if (labels[0]) labels[0].textContent = en;
      if (labels[1]) labels[1].textContent = zhText;
      button.setAttribute("data-aria-label-en", ariaEn);
      button.setAttribute("data-aria-label-zh", ariaZh);
      button.setAttribute("aria-label", zh() ? ariaZh : ariaEn);
    };
    var copy = function (button) {
      var panel = button.closest("[data-run-panel]");
      var code = panel && panel.querySelector("pre code");
      if (!code) return;
      var value = code.textContent || "";
      var done = function (ok) {
        setLabels(button, ok ? "Copied" : "Copy failed", ok ? "已复制" : "复制失败", ok ? "Command copied" : "Copy failed", ok ? "命令已复制" : "复制失败");
        window.setTimeout(function () { setLabels(button, "Copy", "复制", "Copy active command", "复制当前命令"); }, 1800);
      };
      var fallback = function () {
        var sel = window.getSelection(), range = document.createRange(), ok;
        range.selectNodeContents(code); sel.removeAllRanges(); sel.addRange(range);
        try { ok = document.execCommand("copy"); } catch { ok = false; }
        sel.removeAllRanges(); done(ok);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(function () { done(true); }, fallback);
      } else fallback();
    };
    Array.prototype.forEach.call(consoleEl.querySelectorAll("[data-copy-run]"), function (b) {
      b.addEventListener("click", function () { copy(b); });
    });
  }

  /* ---- docs: search, category filters, count */
  var docs = document.querySelector(".docs-page");
  var field = docs && docs.querySelector("input[data-doc-search]");
  if (field) {
    var clear = docs.querySelector("[data-doc-search-clear]");
    var filters = Array.prototype.slice.call(docs.querySelectorAll("button[data-doc-category]"));
    var entries = Array.prototype.slice.call(docs.querySelectorAll("[data-doc-entry]"));
    var status = docs.querySelector("[data-doc-status]");
    var empty = docs.querySelector("[data-doc-empty]");
    var active = "all";
    var fill = function (tpl, visible) { return tpl.split("{visible}").join(String(visible)).split("{count}").join(String(entries.length)); };
    var update = function () {
      var q = field.value.trim().toLowerCase(), visible = 0;
      entries.forEach(function (entry) {
        var show = (active === "all" || entry.getAttribute("data-doc-category") === active)
          && (!q || (entry.getAttribute("data-doc-search") || "").toLowerCase().indexOf(q) !== -1);
        entry.hidden = !show; if (show) visible += 1;
      });
      if (status) {
        var all = visible === entries.length && active === "all" && !q;
        var k = all ? "all" : "f";
        var spans = status.querySelectorAll(".en, .zh");
        if (spans[0]) spans[0].textContent = fill(status.getAttribute("data-tpl-" + k + "-en"), visible);
        if (spans[1]) spans[1].textContent = fill(status.getAttribute("data-tpl-" + k + "-zh"), visible);
      }
      if (empty) empty.hidden = visible !== 0;
      if (clear) clear.hidden = q.length === 0;
    };
    filters.forEach(function (b) {
      b.addEventListener("click", function () {
        active = b.getAttribute("data-doc-category") || "all";
        filters.forEach(function (c) { c.setAttribute("aria-pressed", String(c === b)); });
        update();
      });
    });
    field.addEventListener("input", update);
    if (clear) clear.addEventListener("click", function () { field.value = ""; update(); field.focus(); });
    if (field.form) field.form.addEventListener("submit", function (e) { e.preventDefault(); });
    update();

    // on this page: mark the section being read
    var links = Array.prototype.slice.call(docs.querySelectorAll(".dc-toc nav a"));
    if (links.length && "IntersectionObserver" in window) {
      var mark = function (id) { links.forEach(function (a) { if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); }); };
      var io = new IntersectionObserver(function (items) {
        items.forEach(function (it) { if (it.isIntersecting) mark(it.target.id); });
      }, { rootMargin: "-30% 0px -60% 0px" });
      links.forEach(function (a) { var s = document.getElementById(a.getAttribute("href").slice(1)); if (s) io.observe(s); });
    }
  }
})();
