/* global document, navigator, window, location */
// Teachometry · Journal: "Share" at the end of an essay's byline strip. It opens a short list: copy
// the link, post it on X, or hand it to the device's own share sheet where the browser has one (most
// phones, Safari, Chrome and Edge on desktop). Nothing loads from another site and nothing is
// counted: the X link is a plain web intent that opens only when the reader presses it. Without
// script none of this can work, so the control stays hidden; the address is still in the browser bar.
(function () {
  "use strict";
  var box = document.querySelector("[data-share]");
  if (!box) return;
  var root = document.documentElement;
  var toggle = box.querySelector("[data-share-toggle]");
  var list = box.querySelector("[data-share-list]");
  var copy = box.querySelector("[data-share-copy]");
  var field = box.querySelector("[data-share-field]");
  var x = box.querySelector("[data-share-x]");
  var more = box.querySelector("[data-share-native]");
  var said = box.querySelector("[data-share-said]");
  if (!toggle || !list || !copy) return;

  var zh = function () { return root.getAttribute("data-lang") === "zh"; };
  // a published page holds one language; the prototype holds both, paired as .en / .zh
  var shown = function (el) { return el ? el.querySelector(zh() ? ".zh" : ".en") || el : null; };
  var words = function (el) { var t = shown(el); return t ? t.textContent.replace(/\s+/g, " ").trim() : ""; };

  // the address to share: the page's canonical one (no #section, no ?lang=), in this page's language
  function address() {
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && canonical.href) return canonical.href;
    return location.href.split("#")[0];
  }
  function title() { return words(document.querySelector(".essay-title")) || document.title; }

  function labels() {
    Array.prototype.forEach.call(box.querySelectorAll("[data-aria-label-en]"), function (el) {
      el.setAttribute("aria-label", el.getAttribute(zh() ? "data-aria-label-zh" : "data-aria-label-en"));
    });
  }
  function intent() {
    if (x) x.href = "https://x.com/intent/tweet?text=" + encodeURIComponent(title()) + "&url=" + encodeURIComponent(address());
  }

  /* ---- open and close: a disclosure; Escape, a click elsewhere or leaving it by Tab closes it */
  function items() {
    return Array.prototype.filter.call(list.querySelectorAll(".share-item, .share-field"), function (el) { return !el.hidden; });
  }
  function setOpen(open, focusBack) {
    list.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      copy.setAttribute("data-state", "idle");
      if (field) field.hidden = true;
      intent();
      var first = items()[0];
      if (first) first.focus({ preventScroll: true });
    } else if (focusBack) toggle.focus({ preventScroll: true });
  }
  toggle.addEventListener("click", function () { setOpen(list.hidden); });
  box.addEventListener("keydown", function (e) {
    if (list.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); setOpen(false, true); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      var all = items(), at = all.indexOf(document.activeElement);
      if (at < 0) return;
      e.preventDefault();
      all[(at + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length].focus();
    }
  });
  document.addEventListener("click", function (e) { if (!list.hidden && !box.contains(e.target)) setOpen(false); });
  box.addEventListener("focusout", function (e) {
    if (!list.hidden && e.relatedTarget && !box.contains(e.relatedTarget)) setOpen(false);
  });

  /* ---- copy link: the clipboard, then the older copy command, then the address selected to copy by hand */
  var reset = null;
  function announce(el) { if (said) said.textContent = el ? words(el) : ""; }
  function copied() {
    setOpen(false, true);
    toggle.setAttribute("data-state", "done");
    announce(toggle.querySelector(".share-done"));
    window.clearTimeout(reset);
    reset = window.setTimeout(function () { toggle.removeAttribute("data-state"); announce(null); }, 2400);
  }
  function oldCopy(value) {
    var area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px";
    box.appendChild(area);   // inside the control, so taking focus for the copy does not close the list
    area.select();
    area.setSelectionRange(0, value.length);
    var ok;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    box.removeChild(area);
    return ok;
  }
  function byHand(value) {
    copy.setAttribute("data-state", "fail");
    announce(copy.querySelector(".share-fail"));
    if (!field) return;
    field.value = value;
    field.hidden = false;
    field.focus();
    field.select();
  }
  copy.addEventListener("click", function () {
    var value = address();
    var done = function (ok) { if (ok) copied(); else byHand(value); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function () { done(true); }, function () { done(oldCopy(value)); });
    } else done(oldCopy(value));
  });

  // the intent opens in a new tab; the list closes behind it
  if (x) x.addEventListener("click", function () { intent(); window.setTimeout(function () { setOpen(false); }, 0); });

  /* ---- the device's own share sheet (messages, mail, chat apps), only where the browser has one */
  if (more && typeof navigator.share === "function") {
    more.hidden = false;
    more.addEventListener("click", function () {
      setOpen(false, true);
      var p = navigator.share({ title: title(), url: address() });
      if (p && p.catch) p.catch(function () { /* closed without sharing */ });
    });
  }

  labels(); intent();
  document.addEventListener("langchange", function () { labels(); intent(); setOpen(false); });
  box.hidden = false;
})();
