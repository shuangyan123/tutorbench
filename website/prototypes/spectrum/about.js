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
