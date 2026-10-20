import { escapeHtml as e } from "../html.js";
import type { SiteLocale } from "../i18n.js";

/**
 * Teachometry's letter to learners: the Home opening.
 *
 * The letter is brand writing, not benchmark evidence. It states long-term
 * hopes and says plainly that they have not been reached; TutorBench is named
 * only as a starting point for observing and improving AI teaching.
 *
 * It is a native modal <dialog> rendered at the start of <body>. A small inline
 * script opens it once, before first paint, for a first Home visit; without
 * JavaScript, with reduced motion, or without writable storage the dialog
 * stays closed and Home is unchanged. Skipping works through
 * `<form method="dialog">`, and if letter.js never takes over, the inline
 * script closes the letter at DOMContentLoaded.
 */

/** Storage key for "this browser has already been handed the letter". */
export const HOME_LETTER_STORAGE_KEY = "teachometry-letter-v1";

type LetterMark = "ask" | "explore" | "make";

interface HomeLetterHope {
  readonly mark: LetterMark;
  readonly numeral: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
}

export interface HomeLetterCopy {
  readonly dialogLabel: string;
  readonly brandNote: string;
  readonly optionsLabel: string;
  readonly skip: string;
  readonly otherLanguage: { readonly label: string; readonly name: string; readonly lang: string; readonly href: string };
  readonly address: string;
  readonly open: string;
  readonly openHint: string;
  readonly salutation: string;
  readonly belief: readonly string[];
  readonly bridge: string;
  readonly hopes: readonly [HomeLetterHope, HomeLetterHope, HomeLetterHope];
  readonly honesty: string;
  readonly beginning: readonly string[];
  readonly closing: readonly string[];
  readonly signature: string;
  readonly postscript: { readonly before: string; readonly link: string; readonly after: string };
  readonly next: string;
  readonly enter: string;
  readonly entry: string;
  readonly entryLabel: string;
}

export const HOME_LETTER_COPY: Readonly<Record<SiteLocale, HomeLetterCopy>> = {
  en: {
    dialogLabel: "A letter from Teachometry",
    brandNote: "A letter to learners",
    optionsLabel: "Letter options",
    skip: "Skip to Home",
    // Relative on purpose: it resolves under any base path and is not rewritten
    // by the zh-CN route localizer.
    otherLanguage: { label: "中文", name: "阅读中文版", lang: "zh-CN", href: "zh-cn/#letter" },
    address: "To whoever is learning something today",
    open: "Open the letter",
    openHint: "Click, tap, or press Enter",
    salutation: "Dear learner,",
    belief: [
      "We believe everyone deserves a chance at the best education.",
      "Not the most expensive. Not the most exclusive.",
      "The kind that begins where you are, and stays with you until you understand.",
    ],
    bridge: "This is a letter about the future we hope to help build. It holds three hopes.",
    hopes: [
      {
        mark: "ask",
        numeral: "I",
        title: "Ask freely.",
        paragraphs: [
          "Think of a question you kept to yourself — because it seemed too simple, because everyone else seemed to get it already, because the way you saw it was different.",
          "We hope for a future where that question is welcome. Asked as many times as you need, at your own pace, in your own words.",
        ],
      },
      {
        mark: "explore",
        numeral: "II",
        title: "Explore because you want to.",
        paragraphs: [
          "So much learning still runs on pressure: the next exam, the next deadline, someone watching over your shoulder.",
          "We hope for learning that runs on something quieter, and stronger: the wish to understand. Curiosity that is noticed, fed, and followed wherever it leads.",
        ],
      },
      {
        mark: "make",
        numeral: "III",
        title: "Dare to make something new.",
        paragraphs: [
          "Education should not end at remembering what is already known, finding the expected answer, finishing the standard task.",
          "We hope everyone gets the chance to form a view of their own, to ask the question no one has asked yet, and to try making something that does not exist.",
        ],
      },
    ],
    honesty: "These are long hopes. We have not reached them, and we will not pretend that we have.",
    beginning: [
      "So we are starting somewhere smaller, and more careful: learning to see clearly what good teaching looks like.",
      "TutorBench is that start. It studies how to observe, evaluate, and improve the way AI teaches, one authored case at a time. It cannot yet show that anyone learns more because of it. It can help us look closely, and honestly.",
    ],
    closing: ["We will keep writing as we learn.", "Until then — keep asking."],
    signature: "Teachometry",
    postscript: { before: "P.S. If this letter leaves you with a question, ", link: "ask us", after: ". That is rather the point." },
    next: "Continue",
    enter: "Enter Teachometry",
    entry: "A letter to learners",
    entryLabel: "Read our letter to learners",
  },
  "zh-CN": {
    dialogLabel: "Teachometry 的一封信",
    brandNote: "写给学习者的信",
    optionsLabel: "信件选项",
    skip: "直接进入首页",
    otherLanguage: { label: "English", name: "Read in English", lang: "en", href: "../#letter" },
    address: "致　每一个正在学习的人",
    open: "拆开这封信",
    openHint: "点击、轻触或按 Enter 键",
    salutation: "亲爱的学习者：",
    belief: [
      "我们相信，每个人都应该有机会，享有最好的教育。",
      "不是最昂贵的，也不是最难进入的。",
      "而是从你所在的地方出发，一直陪你走到真正明白的那一种。",
    ],
    bridge: "这封信，关于我们希望一起去往的未来。信里装着三个愿望。",
    hopes: [
      {
        mark: "ask",
        numeral: "一",
        title: "自由地提问",
        paragraphs: [
          "也许你曾把一个问题咽了回去：怕它太简单，怕别人早就懂了，怕自己想得和大家不一样。",
          "我们希望有这样一个未来：那个问题会被认真接住。你可以问很多遍，按自己的节奏，用自己的话。",
        ],
      },
      {
        mark: "explore",
        numeral: "二",
        title: "主动地探索",
        paragraphs: [
          "太多学习仍然靠压力推动：下一场考试，下一个截止日期，一双盯着你的眼睛。",
          "我们期待另一种力量，更安静，也更持久——想要弄明白的那份好奇。它被看见，被呵护，被认真回应，并带你走向更远的地方。",
        ],
      },
      {
        mark: "make",
        numeral: "三",
        title: "大胆地创造",
        paragraphs: [
          "教育不该止步于记住已知、找到标准答案、完成规定动作。",
          "我们希望每个人都有机会形成自己的看法，提出还没有人问过的问题，去尝试做出世界上还没有的东西。",
        ],
      },
    ],
    honesty: "这些是很长远的愿望。我们还没有抵达，也不会假装已经抵达。",
    beginning: [
      "所以，我们从更小、也更需要严谨的一步开始：先学会看清，什么是好的教学。",
      "TutorBench 就是这一步。它研究如何观察、评估并改进 AI 的教学，从一个个精心编写的案例做起。它还不能证明有人因此学得更好；但它能帮我们看得更仔细，也更诚实。",
    ],
    closing: ["我们会一边学，一边继续写下去。", "在那之前——请继续提问。"],
    signature: "Teachometry",
    postscript: { before: "附言：如果这封信让你想问点什么，", link: "欢迎来问我们", after: "。毕竟，这正是重点。" },
    next: "继续阅读",
    enter: "进入 Teachometry",
    entry: "写给学习者的信",
    entryLabel: "阅读写给学习者的信",
  },
};

// Hand-drawn margin marks: a question, a wandering path, a sprout.
const MARKS: Readonly<Record<LetterMark, string>> = {
  ask: '<path d="M13.5 14.5c-.4-5.4 3.6-8.6 8-8.4 4.5.2 7.9 3.3 7.4 7.6-.6 5-7.9 5.6-8.3 11.3l-.1 3"/><path d="M20.4 33.2v.4"/>',
  explore: '<path d="M5.5 31.5c3.8-7.2 9.6-.6 13.4-6.4 3.4-5.2-2.6-9.4 2.2-13.6 3.4-3 7.8-1.4 11.2-4.6"/><path d="m27.6 5.8 4.9 1.1-1.3 4.8"/><path d="M5.5 31.5h.1"/>',
  make: '<path d="M20 35.5V19"/><path d="M20 23.5c-7.6.4-11-4.4-11.2-10.6 7 .1 10.9 4 11.2 10.6Z"/><path d="M20 19.4c.2-6.6 4.2-10.4 11.2-10.6-.1 6.6-4.1 10.6-11.2 10.6Z"/>',
};

function renderMark(mark: LetterMark): string {
  // pathLength lets one CSS dash rule draw every stroke regardless of its length.
  return `<svg class="letter-mark letter-mark-${mark}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">${MARKS[mark].replaceAll("<path ", '<path pathLength="1" ')}</svg>`;
}

function renderLines(lines: readonly string[]): string {
  return lines.map((line) => e(line)).join("<br>");
}

// A soft hyphen gives the large signature one good place to break
// (Teach-ometry) when large text leaves no room for it on one line. It is
// invisible otherwise, and find-in-page still matches "Teachometry".
function renderSignature(signature: string): string {
  return e(signature).replace("Teachometry", "Teach&shy;ometry");
}

function renderLetterText(copy: HomeLetterCopy): string {
  const stanza = (className: string, body: string, extra = ""): string =>
    `<section class="letter-stanza ${className}" data-letter-stanza${extra}>${body}</section>`;
  return `<article class="letter-text">
      ${stanza("letter-opening", `<p class="letter-salutation">${e(copy.salutation)}</p><p class="letter-belief">${renderLines(copy.belief)}</p>`)}
      ${stanza("letter-bridge", `<p>${e(copy.bridge)}</p>`)}
      ${copy.hopes.map((hope) => stanza("letter-hope", `${renderMark(hope.mark)}<h3><span class="letter-numeral">${e(hope.numeral)}</span><span class="letter-hope-title">${e(hope.title)}</span></h3>${hope.paragraphs.map((paragraph) => `<p>${e(paragraph)}</p>`).join("")}`, ` data-letter-mark="${hope.mark}"`)).join("\n      ")}
      ${stanza("letter-honesty", `<span class="letter-rule" aria-hidden="true"></span><p>${e(copy.honesty)}</p>`)}
      ${stanza("letter-beginning", copy.beginning.map((paragraph) => `<p>${e(paragraph)}</p>`).join(""))}
      ${stanza("letter-sign", `<p class="letter-closing">${renderLines(copy.closing)}</p><p class="letter-signature"><span>${renderSignature(copy.signature)}</span><svg class="letter-flourish" viewBox="0 0 220 24" aria-hidden="true" focusable="false"><path pathLength="1" d="M3 15.5c31-6.4 76-10.6 128-8.6 31 1.2 56 4.6 70 8.4 6 1.6 9.4 1.2 15-1.6"/></svg></p><p class="letter-postscript">${e(copy.postscript.before)}<a href="/contact/">${e(copy.postscript.link)}</a>${e(copy.postscript.after)}</p>`)}
    </article>`;
}

/**
 * Runs synchronously right after the closed dialog is parsed, before the
 * header and Home content exist, so a first visit never flashes Home first.
 * Kept ES5-simple and free of `href=`/`src=` text so the HTML path rewriters
 * leave it untouched.
 *
 * - The letter opens on its own only when the visit can be remembered: storage
 *   must accept a write, or every reload would open it again.
 * - letter.js marks <html data-letter-ready> when it has taken over. Deferred
 *   scripts always run before DOMContentLoaded, so if that mark is missing by
 *   then (blocked, failed or broken script) the letter steps aside and Home is
 *   usable: nobody is left in front of an envelope that cannot open.
 */
export const HOME_LETTER_GATE_SCRIPT = `(function () {
  var dialog = document.getElementById("home-letter");
  if (!dialog || typeof dialog.showModal !== "function") return;
  var root = document.documentElement;
  // Reserves the Home entry's place from first paint; letter.js reveals it.
  root.setAttribute("data-letter-js", "");
  var key = "${HOME_LETTER_STORAGE_KEY}";
  var requested = window.location.hash === "#letter";
  var storage = null;
  try {
    storage = window.localStorage;
    storage.setItem("${HOME_LETTER_STORAGE_KEY}-probe", "1");
    storage.removeItem("${HOME_LETTER_STORAGE_KEY}-probe");
  } catch (error) { storage = null; }
  var media = function (query) { return typeof window.matchMedia === "function" && window.matchMedia(query).matches; };
  if (!requested && (storage === null || storage.getItem(key) !== null || media("(prefers-reduced-motion: reduce)"))) return;
  var theme = null;
  try { theme = storage === null ? null : storage.getItem("tutorbench-home-theme"); } catch (error) { theme = null; }
  dialog.setAttribute("data-theme", theme === "light" || theme === "dark" ? theme : media("(prefers-color-scheme: dark)") ? "dark" : "light");
  dialog.setAttribute("data-letter-auto", "");
  try { dialog.showModal(); } catch (error) { return; }
  var remember = function () { try { if (storage !== null) storage.setItem(key, "1"); } catch (error) { /* The letter simply may appear again. */ } };
  // A speculative prerender has not been seen yet; remember only once it is shown.
  if (document.prerendering) document.addEventListener("prerenderingchange", remember, { once: true });
  else remember();
  document.addEventListener("DOMContentLoaded", function () {
    if (!root.hasAttribute("data-letter-ready") && dialog.open) dialog.close("unavailable");
  }, { once: true });
})();`;

/** The opening scene. Rendered before the header; see HOME_LETTER_GATE_SCRIPT. */
export function renderHomeLetter(locale: SiteLocale): string {
  const copy = HOME_LETTER_COPY[locale];
  const other = copy.otherLanguage;
  return `<dialog id="home-letter" class="home-letter" aria-label="${e(copy.dialogLabel)}" data-letter-state="sealed">
  <div class="letter-scene" aria-hidden="true"><span class="letter-light"></span><svg class="letter-leaves" viewBox="0 0 600 420" focusable="false"><filter id="home-letter-leaf-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="13"/></filter><g filter="url(#home-letter-leaf-blur)"><path d="M600 40C520 70 470 120 430 190"/><ellipse cx="520" cy="72" rx="46" ry="17" transform="rotate(-28 520 72)"/><ellipse cx="478" cy="128" rx="40" ry="15" transform="rotate(32 478 128)"/><ellipse cx="560" cy="130" rx="44" ry="16" transform="rotate(-62 560 130)"/><ellipse cx="452" cy="182" rx="36" ry="13" transform="rotate(-18 452 182)"/><ellipse cx="575" cy="214" rx="42" ry="15" transform="rotate(48 575 214)"/><ellipse cx="505" cy="250" rx="34" ry="12" transform="rotate(-40 505 250)"/></g></svg></div>
  <header class="letter-bar">
    <p class="letter-brand"><span class="letter-brand-name">Teachometry</span><span class="letter-brand-note">${e(copy.brandNote)}</span></p>
    <div class="letter-bar-actions" role="group" aria-label="${e(copy.optionsLabel)}">
      <a class="letter-language" data-source-content href="${e(other.href)}" hreflang="${e(other.lang)}" lang="${e(other.lang)}" aria-label="${e(other.name)}">${e(other.label)}</a>
      <form method="dialog"><button class="letter-skip" type="submit" value="skip" data-letter-skip>${e(copy.skip)}<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 12h14.5"/><path d="m14 6.5 5.5 5.5-5.5 5.5"/></svg></button></form>
    </div>
  </header>
  <div class="letter-stage">
    <div class="letter-envelope-wrap" data-letter-envelope-wrap>
      <button class="letter-envelope" type="button" autofocus data-letter-envelope aria-describedby="home-letter-address">
        <span class="envelope-back" aria-hidden="true"></span>
        <span class="envelope-letter" aria-hidden="true"></span>
        <span class="envelope-pocket" aria-hidden="true"></span>
        <svg class="envelope-seams" viewBox="0 0 520 336" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M1 335 236 186M519 335 284 186"/></svg>
        <span class="envelope-address" id="home-letter-address">${e(copy.address)}</span>
        <span class="envelope-flap" aria-hidden="true"></span>
        <span class="envelope-seal" aria-hidden="true">?</span>
        <span class="visually-hidden">${e(copy.open)}</span>
      </button>
      <p class="letter-hint" aria-hidden="true"><span class="letter-hint-action">${e(copy.open)}</span><span class="letter-hint-how">${e(copy.openHint)}</span></p>
    </div>
    <div class="letter-paper" data-letter-paper hidden>
      <div class="letter-folds" aria-hidden="true"><span class="letter-fold letter-fold-top"></span><span class="letter-fold letter-fold-middle"></span><span class="letter-fold letter-fold-bottom"></span></div>
      <div class="letter-sheet">
        <div class="letter-scroll" data-letter-scroll tabindex="-1">
          ${renderLetterText(copy)}
        </div>
      </div>
    </div>
    <div class="letter-controls" data-letter-controls hidden>
      <button class="letter-next" type="button" data-letter-next data-label-continue="${e(copy.next)}" data-label-enter="${e(copy.enter)}"><span data-letter-next-label>${e(copy.next)}</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 12h14.5"/><path d="m14 6.5 5.5 5.5-5.5 5.5"/></svg></button>
    </div>
  </div>
</dialog>
<script>${HOME_LETTER_GATE_SCRIPT}</script>`;
}

/**
 * Quiet way back to the letter. It is absent without JavaScript, its place is
 * reserved before first paint, and it becomes visible only when letter.js is
 * ready to open the letter. Following it adds `#letter` to the URL, so Back
 * closes the letter again.
 */
export function renderHomeLetterEntry(locale: SiteLocale): string {
  const copy = HOME_LETTER_COPY[locale];
  return `<a class="home-letter-entry" href="#letter" data-letter-open aria-label="${e(copy.entryLabel)}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.5 6.5h17v11h-17z"/><path d="m3.8 6.8 8.2 6.4 8.2-6.4"/></svg><span>${e(copy.entry)}</span></a>`;
}
