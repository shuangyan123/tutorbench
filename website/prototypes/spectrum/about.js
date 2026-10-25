/* global document, navigator, window */
// Teachometry · Contact: the copy button beside the email address. The address is always shown as
// selectable text, because a mailto: link may do nothing in some viewers; the button only adds a copy.
(function () {
  "use strict";
  var zh = function () { return document.documentElement.getAttribute("data-lang") === "zh"; };
  Array.prototype.forEach.call(document.querySelectorAll("[data-copy-text]"), function (button) {
    var label = button.querySelector("[data-copy-label]");
    var text = button.getAttribute("data-copy-text");
    var reset = null;
    var say = function (state) {
      var key = "data-" + state + "-" + (zh() ? "zh" : "en");
      if (label) label.textContent = button.getAttribute(key);
    };
    var selectFallback = function () {
      var target = document.getElementById(button.getAttribute("aria-controls"));
      if (!target) return false;
      var range = document.createRange(); range.selectNodeContents(target);
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      return true;
    };
    button.addEventListener("click", function () {
      var done = function (ok) {
        say(ok ? "done" : "select");
        window.clearTimeout(reset);
        reset = window.setTimeout(function () { say("idle"); }, 2200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { selectFallback(); done(false); });
      } else {
        selectFallback(); done(false);
      }
    });
    document.addEventListener("langchange", function () { say("idle"); });
  });
})();

// Teachometry · About: the vision film. It never plays on its own: the poster and a play button sit in
// place, and nothing but the poster loads until the visitor presses play. Subtitles are page text in the
// site language (they follow the language toggle); in fullscreen the matching WebVTT track takes over,
// because page text cannot follow the video there.
(function () {
  "use strict";
  var fig = document.querySelector("[data-film]");
  if (!fig) return;
  var video = fig.querySelector("video"), sub = fig.querySelector(".ab-sub"), play = fig.querySelector("[data-play]");
  var cues = [];
  try { cues = JSON.parse(fig.getAttribute("data-cues") || "[]"); } catch (e) { cues = []; }
  var zh = function () { return document.documentElement.getAttribute("data-lang") === "zh"; };
  var small = window.matchMedia && window.matchMedia("(max-width: 700px)").matches;
  if (small && video.getAttribute("data-poster-m")) video.setAttribute("poster", video.getAttribute("data-poster-m"));
  var shown = -1;
  var full = function () {
    return document.fullscreenElement === video || document.webkitFullscreenElement === video || video.webkitDisplayingFullscreen === true;
  };
  function tracks() {
    var want = zh() ? "zh-CN" : "en";
    for (var i = 0; i < video.textTracks.length; i += 1) {
      var t = video.textTracks[i];
      t.mode = full() && t.language === want ? "showing" : "hidden";
    }
  }
  function draw(force) {
    var t = video.currentTime, at = -1;
    for (var i = 0; i < cues.length; i += 1) if (t >= cues[i][0] && t < cues[i][1]) { at = i; break; }
    if (at === shown && !force) return;
    shown = at;
    if (at < 0) { sub.classList.remove("on"); return; }
    sub.textContent = zh() ? cues[at][2] : cues[at][3];
    sub.lang = zh() ? "zh-CN" : "en";
    sub.classList.add("on");
  }
  play.addEventListener("click", function () {
    video.controls = true;
    var p = video.play();
    if (p && p.catch) p.catch(function () { /* the native controls are there to retry */ });
  });
  video.addEventListener("play", function () { fig.classList.add("is-playing"); play.hidden = true; });
  video.addEventListener("ended", function () { fig.classList.remove("is-playing"); });
  video.addEventListener("timeupdate", function () { draw(false); });
  video.addEventListener("seeked", function () { draw(true); });
  ["fullscreenchange", "webkitfullscreenchange"].forEach(function (ev) { document.addEventListener(ev, tracks); });
  video.addEventListener("webkitbeginfullscreen", function () { setTimeout(tracks, 0); });
  video.addEventListener("webkitendfullscreen", function () { setTimeout(tracks, 0); });
  document.addEventListener("langchange", function () { draw(true); tracks(); });
  tracks();
})();
