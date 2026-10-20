import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { buildPublicBenchmarkArtifacts, loadTutorEvalDataset } from "../src/datasets/index.js";
import { renderPage } from "../src/site/html.js";
import { renderCommunityPage } from "../src/site/pages/community.js";
import { renderHomePage } from "../src/site/pages/home.js";
import {
  HOME_LETTER_COPY,
  HOME_LETTER_GATE_SCRIPT,
  HOME_LETTER_STORAGE_KEY,
} from "../src/site/pages/home-letter.js";

// The Home opening is brand writing shown once, before Home, for a first visit.
// These tests pin its honesty about what TutorBench can show today, keep it from
// becoming a barrier (no JavaScript, reduced motion, no storage, repeat visits),
// and keep it out of every route except Home.

async function artifacts() {
  return buildPublicBenchmarkArtifacts(await loadTutorEvalDataset());
}

function letterText(locale: "en" | "zh-CN"): string {
  const copy = HOME_LETTER_COPY[locale];
  return [
    copy.salutation,
    ...copy.belief,
    copy.bridge,
    ...copy.hopes.flatMap((hope) => [hope.title, ...hope.paragraphs]),
    copy.honesty,
    ...copy.beginning,
    ...copy.closing,
  ].join("\n");
}

test("the letter states hopes as hopes and does not claim learning outcomes", () => {
  const english = letterText("en");
  assert.match(english, /We have not reached them, and we will not pretend that we have\./u);
  assert.match(english, /It cannot yet show that anyone learns more because of it\./u);
  assert.match(english, /TutorBench is that start\./u);
  assert.doesNotMatch(english, /\b(?:proven|proves|guarantee[sd]?|solves?|solved|transforms?|revolutioni[sz]e)\b/iu);

  const chinese = letterText("zh-CN");
  assert.match(chinese, /我们还没有抵达，也不会假装已经抵达。/u);
  assert.match(chinese, /它还不能证明有人因此学得更好/u);
  assert.match(chinese, /TutorBench 就是这一步。/u);
  assert.doesNotMatch(chinese, /已经实现|已经解决|已证明|证明了|保证|颠覆/u);

  // Three long-term hopes in both languages, written separately rather than word for word.
  for (const locale of ["en", "zh-CN"] as const) {
    assert.deepEqual(HOME_LETTER_COPY[locale].hopes.map((hope) => hope.mark), ["ask", "explore", "make"]);
  }
  assert.deepEqual(HOME_LETTER_COPY["zh-CN"].hopes.map((hope) => hope.title), ["自由地提问", "主动地探索", "大胆地创造"]);
});

test("Home renders the letter as a closed dialog before the header, in the page language", async () => {
  const data = await artifacts();
  for (const locale of ["en", "zh-CN"] as const) {
    const copy = HOME_LETTER_COPY[locale];
    const html = renderPage(renderHomePage(data, locale), { locale });
    const body = html.slice(html.indexOf("<body"));
    const dialogAt = body.indexOf('<dialog id="home-letter"');
    assert.ok(dialogAt > 0, locale);
    assert.ok(dialogAt < body.indexOf('class="skip-link"'), `${locale}: dialog precedes the header`);
    assert.ok(body.indexOf("</dialog>\n<script>") > dialogAt, `${locale}: gate script follows the dialog`);
    assert.doesNotMatch(html, /<dialog[^>]*\sopen[\s>=]/u, `${locale}: the static page never ships an open dialog`);

    const dialog = body.slice(dialogAt, body.indexOf("</dialog>") + "</dialog>".length);
    for (const text of [copy.address, copy.salutation, copy.honesty, copy.skip, copy.open, ...copy.hopes.map((hope) => hope.title)]) {
      assert.ok(dialog.includes(text), `${locale}: ${text}`);
    }
    // Skipping must work even if letter.js never loads.
    assert.match(dialog, /<form method="dialog"><button class="letter-skip" type="submit" value="skip" data-letter-skip>/u);
    assert.match(dialog, /<button class="letter-envelope" type="button" autofocus data-letter-envelope/u);
    assert.match(dialog, /class="letter-paper" data-letter-paper hidden/u);
    assert.match(dialog, /class="letter-controls" data-letter-controls hidden/u);
    assert.equal((dialog.match(/data-letter-stanza/gu) ?? []).length, 8);
    // The signature reads "Teachometry"; its only break point is a soft hyphen,
    // used when large text leaves no room for it on one line.
    assert.match(dialog, /<p class="letter-signature"><span>Teach&shy;ometry<\/span>/u);
    assert.equal(copy.signature, "Teachometry");

    // Home content is unchanged and still the main landmark.
    assert.match(html, /<main id="main-content"><section class="home-hero">/u);
    assert.match(html, /<a class="home-letter-entry" href="#letter" data-letter-open aria-label="[^"]+">/u);
    assert.match(html, /<link rel="stylesheet" href="\/assets\/letter\.css">/u);
    assert.match(html, /<script src="\/assets\/letter\.js" defer><\/script>/u);
  }

  const english = renderPage(renderHomePage(data, "en"), { locale: "en" });
  const chinese = renderPage(renderHomePage(data, "zh-CN"), { locale: "zh-CN" });
  assert.match(english, /<dialog id="home-letter" class="home-letter" aria-label="A letter from Teachometry"/u);
  assert.match(chinese, /<dialog id="home-letter" class="home-letter" aria-label="Teachometry 的一封信"/u);
  assert.doesNotMatch(chinese, /Dear learner|Skip to Home|Open the letter/u);
  assert.doesNotMatch(english, /亲爱的学习者|直接进入首页|拆开这封信/u);
});

test("letter links resolve under a project base path without the zh-CN route rewriter", async () => {
  const data = await artifacts();
  const english = renderPage(renderHomePage(data, "en"), { locale: "en", basePath: "/preview" });
  const chinese = renderPage(renderHomePage(data, "zh-CN"), { locale: "zh-CN", basePath: "/preview" });
  // Relative language links resolve from /preview/ and /preview/zh-cn/ to each other's letter.
  assert.match(english, /<a class="letter-language" data-source-content href="zh-cn\/#letter" hreflang="zh-CN" lang="zh-CN"/u);
  assert.match(chinese, /<a class="letter-language" data-source-content href="\.\.\/#letter" hreflang="en" lang="en"/u);
  assert.equal(new URL("zh-cn/#letter", "https://example.test/preview/").href, "https://example.test/preview/zh-cn/#letter");
  assert.equal(new URL("../#letter", "https://example.test/preview/zh-cn/").href, "https://example.test/preview/#letter");
  // The postscript's contact link follows the page locale and base path.
  assert.match(english, /<a href="\/preview\/contact\/">ask us<\/a>/u);
  assert.match(chinese, /<a href="\/preview\/zh-cn\/contact\/">欢迎来问我们<\/a>/u);
  assert.match(english, /href="\/preview\/assets\/letter\.css"/u);
  assert.match(english, /src="\/preview\/assets\/letter\.js"/u);
  // The inline gate is not touched by path rewriting.
  assert.ok(english.includes(`<script>${HOME_LETTER_GATE_SCRIPT}</script>`));
  assert.doesNotMatch(HOME_LETTER_GATE_SCRIPT, /(?:href|src)=|<\/|</u);
});

test("only Home carries the letter", async () => {
  const data = await artifacts();
  for (const locale of ["en", "zh-CN"] as const) {
    const html = renderPage(renderCommunityPage(data, locale), { locale });
    assert.doesNotMatch(html, /home-letter|letter\.css|letter\.js|data-letter/u, locale);
  }
});

interface GateRun {
  readonly opened: boolean;
  /** The Home entry's place is reserved (JavaScript is running). */
  readonly reserved: boolean;
  readonly theme: string | null;
  readonly stored: string | null;
  readonly closedWith: string | null;
  readonly activate: () => void;
  /** Fires DOMContentLoaded, after letter.js has (or has not) marked itself ready. */
  readonly contentLoaded: (letterReady: boolean) => void;
}

function runGate({
  stored = null,
  hash = "",
  reducedMotion = false,
  darkScheme = false,
  theme = null,
  storageThrows = false,
  writeThrows = false,
  prerendering = false,
  showModal = true,
}: {
  stored?: string | null;
  hash?: string;
  reducedMotion?: boolean;
  darkScheme?: boolean;
  theme?: string | null;
  storageThrows?: boolean;
  writeThrows?: boolean;
  prerendering?: boolean;
  showModal?: boolean;
} = {}): GateRun {
  const values = new Map<string, string>();
  if (stored !== null) values.set(HOME_LETTER_STORAGE_KEY, stored);
  if (theme !== null) values.set("tutorbench-home-theme", theme);
  const attributes = new Map<string, string>();
  const rootAttributes = new Map<string, string>();
  const listeners = new Map<string, () => void>();
  let opened = false;
  let open = false;
  let closedWith: string | null = null;
  const dialog = {
    get open() { return open; },
    setAttribute: (name: string, value: string) => { attributes.set(name, value); },
    close: (value: string) => { open = false; closedWith = value; },
    ...(showModal ? { showModal: () => { opened = true; open = true; } } : {}),
  };
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (writeThrows) throw Object.assign(new Error("The quota has been exceeded."), { name: "QuotaExceededError" });
      values.set(key, value);
    },
    removeItem: (key: string) => { values.delete(key); },
  };
  const window = {
    location: { hash },
    matchMedia: (query: string) => ({
      matches: query.includes("reduced-motion") ? reducedMotion : query.includes("color-scheme: dark") ? darkScheme : false,
    }),
    get localStorage() {
      if (storageThrows) throw new Error("SecurityError");
      return storage;
    },
  };
  const document = {
    prerendering,
    documentElement: {
      setAttribute: (name: string, value: string) => { rootAttributes.set(name, value); },
      hasAttribute: (name: string) => rootAttributes.has(name),
    },
    getElementById: (id: string) => (id === "home-letter" ? dialog : null),
    addEventListener: (name: string, listener: () => void) => { listeners.set(name, listener); },
  };
  runInNewContext(HOME_LETTER_GATE_SCRIPT, { window, document });
  return {
    opened,
    reserved: rootAttributes.has("data-letter-js"),
    theme: attributes.get("data-theme") ?? null,
    get stored() { return values.get(HOME_LETTER_STORAGE_KEY) ?? null; },
    get closedWith() { return closedWith; },
    activate: () => listeners.get("prerenderingchange")?.(),
    contentLoaded: (letterReady: boolean) => {
      if (letterReady) rootAttributes.set("data-letter-ready", "");
      listeners.get("DOMContentLoaded")?.();
    },
  };
}

test("the letter opens on its own once, for a first Home visit only", () => {
  const first = runGate();
  assert.equal(first.opened, true);
  assert.equal(first.reserved, true);
  assert.equal(first.stored, "1");
  assert.equal(first.theme, "light");
  first.contentLoaded(true);
  assert.equal(first.closedWith, null, "a working letter.js keeps the letter open");

  const again = runGate({ stored: "1" });
  assert.equal(again.opened, false, "a returning visitor goes straight to Home");
  assert.equal(again.reserved, true, "the place of the Home entry back to the letter is kept");

  assert.equal(runGate({ darkScheme: true }).theme, "dark");
  assert.equal(runGate({ darkScheme: true, theme: "light" }).theme, "light", "a chosen site theme wins");
});

test("reduced motion, unusable storage, and old browsers go straight to Home", () => {
  const reduced = runGate({ reducedMotion: true });
  assert.equal(reduced.opened, false);
  assert.equal(reduced.stored, null);
  assert.equal(reduced.reserved, true);

  // Without storage the visit cannot be remembered, so it never opens on its own.
  assert.equal(runGate({ storageThrows: true }).opened, false);

  // Readable storage that refuses writes (QuotaExceededError) would reopen the
  // letter on every reload, so it is treated like no storage.
  const full = runGate({ writeThrows: true });
  assert.equal(full.opened, false);
  assert.equal(full.stored, null);
  assert.equal(runGate({ writeThrows: true, stored: "1" }).opened, false);

  const noDialog = runGate({ showModal: false });
  assert.equal(noDialog.opened, false);
  assert.equal(noDialog.reserved, false, "no entry is reserved when the dialog cannot open");
});

test("if letter.js never takes over, the letter steps aside at DOMContentLoaded", () => {
  const broken = runGate();
  assert.equal(broken.opened, true);
  broken.contentLoaded(false);
  assert.equal(broken.closedWith, "unavailable", "nobody is left in front of an envelope that cannot open");

  const linked = runGate({ stored: "1", hash: "#letter" });
  linked.contentLoaded(false);
  assert.equal(linked.closedWith, "unavailable");
});

test("a #letter link always opens the letter, and a prerender is not counted as a visit", () => {
  assert.equal(runGate({ stored: "1", hash: "#letter" }).opened, true);
  assert.equal(runGate({ reducedMotion: true, hash: "#letter" }).opened, true);
  assert.equal(runGate({ storageThrows: true, hash: "#letter" }).opened, true);
  assert.equal(runGate({ writeThrows: true, hash: "#letter" }).opened, true);

  const prerender = runGate({ prerendering: true });
  assert.equal(prerender.opened, true);
  assert.equal(prerender.stored, null, "nothing is remembered before the page is shown");
  prerender.activate();
  assert.equal(prerender.stored, "1");
});

// Source files may be checked out with CRLF line endings (Windows autocrlf).
const normalizeLineEndings = (text: string): string => text.replace(/\r\n?/gu, "\n");

function assertLetterAssets(stylesSource: string, scriptSource: string): void {
  const styles = normalizeLineEndings(stylesSource);
  const script = normalizeLineEndings(scriptSource);
  // No external animation library, sound, or autoplay.
  assert.doesNotMatch(script, /import\s|require\(|AudioContext|new Audio|\.play\(/u);
  assert.match(script, /prefers-reduced-motion: reduce/u);
  // letter.js announces itself only after wiring every control.
  assert.match(script, /setAttribute\("data-letter-ready", ""\);\n\}\)\(\);\n$/u);
  // The entry is absent without JavaScript and visible only once letter.js is ready.
  assert.match(styles, /\.home-letter-entry \{\n {2}display: none;\n\}/u);
  assert.match(styles, /html\[data-letter-js\] \.home-letter-entry \{[^}]*visibility: hidden;/u);
  assert.match(styles, /html\[data-letter-ready\] \.home-letter-entry \{\n {2}visibility: visible;\n\}/u);
}

test("letter assets add no dependency or sound and only reveal working controls", async () => {
  assertLetterAssets(await readFile("website/src/letter.css", "utf8"), await readFile("website/src/letter.js", "utf8"));
});

test("the asset checks pass unchanged on a CRLF checkout", async () => {
  const toCrlf = (text: string): string => normalizeLineEndings(text).replace(/\n/gu, "\r\n");
  const styles = toCrlf(await readFile("website/src/letter.css", "utf8"));
  const script = toCrlf(await readFile("website/src/letter.js", "utf8"));
  assert.ok(styles.includes("\r\n") && script.includes("\r\n"));
  assertLetterAssets(styles, script);
});
