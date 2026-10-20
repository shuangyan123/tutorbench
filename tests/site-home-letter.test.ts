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
  readonly ready: boolean;
  readonly theme: string | null;
  readonly stored: string | null;
  readonly activate: () => void;
}

function runGate({
  stored = null,
  hash = "",
  reducedMotion = false,
  darkScheme = false,
  theme = null,
  storageThrows = false,
  prerendering = false,
  showModal = true,
}: {
  stored?: string | null;
  hash?: string;
  reducedMotion?: boolean;
  darkScheme?: boolean;
  theme?: string | null;
  storageThrows?: boolean;
  prerendering?: boolean;
  showModal?: boolean;
} = {}): GateRun {
  const values = new Map<string, string>();
  if (stored !== null) values.set(HOME_LETTER_STORAGE_KEY, stored);
  if (theme !== null) values.set("tutorbench-home-theme", theme);
  const attributes = new Map<string, string>();
  const rootAttributes = new Map<string, string>();
  let opened = false;
  let activation: (() => void) | undefined;
  const dialog = {
    setAttribute: (name: string, value: string) => { attributes.set(name, value); },
    ...(showModal ? { showModal: () => { opened = true; } } : {}),
  };
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
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
    documentElement: { setAttribute: (name: string, value: string) => { rootAttributes.set(name, value); } },
    getElementById: (id: string) => (id === "home-letter" ? dialog : null),
    addEventListener: (name: string, listener: () => void) => { if (name === "prerenderingchange") activation = listener; },
  };
  runInNewContext(HOME_LETTER_GATE_SCRIPT, { window, document });
  return {
    opened,
    ready: rootAttributes.has("data-letter-ready"),
    theme: attributes.get("data-theme") ?? null,
    get stored() { return values.get(HOME_LETTER_STORAGE_KEY) ?? null; },
    activate: () => activation?.(),
  };
}

test("the letter opens on its own once, for a first Home visit only", () => {
  const first = runGate();
  assert.equal(first.opened, true);
  assert.equal(first.ready, true);
  assert.equal(first.stored, "1");
  assert.equal(first.theme, "light");

  const again = runGate({ stored: "1" });
  assert.equal(again.opened, false, "a returning visitor goes straight to Home");
  assert.equal(again.ready, true, "the Home entry back to the letter stays available");

  assert.equal(runGate({ darkScheme: true }).theme, "dark");
  assert.equal(runGate({ darkScheme: true, theme: "light" }).theme, "light", "a chosen site theme wins");
});

test("reduced motion, unavailable storage, and old browsers go straight to Home", () => {
  const reduced = runGate({ reducedMotion: true });
  assert.equal(reduced.opened, false);
  assert.equal(reduced.stored, null);
  assert.equal(reduced.ready, true);

  // Without storage the visit cannot be remembered, so it never opens on its own.
  const noStorage = runGate({ storageThrows: true });
  assert.equal(noStorage.opened, false);

  const noDialog = runGate({ showModal: false });
  assert.equal(noDialog.opened, false);
  assert.equal(noDialog.ready, false, "no entry is shown when the dialog cannot open");
});

test("a #letter link always opens the letter, and a prerender is not counted as a visit", () => {
  assert.equal(runGate({ stored: "1", hash: "#letter" }).opened, true);
  assert.equal(runGate({ reducedMotion: true, hash: "#letter" }).opened, true);
  assert.equal(runGate({ storageThrows: true, hash: "#letter" }).opened, true);

  const prerender = runGate({ prerendering: true });
  assert.equal(prerender.opened, true);
  assert.equal(prerender.stored, null, "nothing is remembered before the page is shown");
  prerender.activate();
  assert.equal(prerender.stored, "1");
});

test("letter assets keep motion optional and reveal nothing without the gate", async () => {
  const styles = await readFile("website/src/letter.css", "utf8");
  const script = await readFile("website/src/letter.js", "utf8");
  // No external animation library, sound, or autoplay.
  assert.doesNotMatch(script, /import\s|require\(|AudioContext|new Audio|\.play\(/u);
  assert.match(script, /prefers-reduced-motion: reduce/u);
  // The entry is hidden unless the gate marked the document as able to open the letter.
  assert.match(styles, /\.home-letter-entry \{\n {2}display: none;\n\}/u);
  assert.match(styles, /html\[data-letter-ready\] \.home-letter-entry \{/u);
  // The page behind the modal keeps its width, so closing the letter shifts nothing.
  assert.match(styles, /html:has\(#home-letter\[open\]\) \{\n {2}overflow: hidden;\n {2}scrollbar-gutter: stable;/u);
});
