import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildWebsite } from "../src/cli/website-build.js";

// Brand architecture: Teachometry is the parent brand with no approved logo yet,
// so it is set as text. The TutorBench T1 mark identifies the TutorBench product
// and may only appear beside the TutorBench name.
// Entry points: the homepage separates a constructed Micro-Review demo from
// running a TutorBench evaluation and from the formal Methodology.

const PAGES = ["", "methodology/", "micro-review/", "run/", "about/"] as const;
const LOCALES = [
  { prefix: "", home: "/" },
  { prefix: "zh-cn/", home: "/zh-cn/" },
] as const;

let outputDirectory = "";
const html = new Map<string, string>();

test.before(async () => {
  outputDirectory = await mkdtemp(join(tmpdir(), "tutorbench-brand-entry-"));
  // siteUrl as in the production build, so canonical URLs and JSON-LD are emitted.
  await buildWebsite({ outputDirectory, siteUrl: "https://teachometry.com" });
  for (const { prefix } of LOCALES) {
    for (const page of PAGES) html.set(prefix + page, await readFile(join(outputDirectory, prefix, page, "index.html"), "utf8"));
  }
});

test.after(async () => {
  await rm(outputDirectory, { recursive: true, force: true });
});

/** The markup from `open` up to (excluding) the first `close` after it. */
const element = (markup: string, open: RegExp, close: string): string => {
  const start = markup.search(open);
  assert.ok(start >= 0, `missing ${open}`);
  const end = markup.indexOf(close, start);
  assert.ok(end > start, `missing ${close} after ${open}`);
  return markup.slice(start, end);
};

test("Teachometry is a text wordmark and the TutorBench mark only sits beside the TutorBench name", () => {
  for (const [route, page] of html) {
    const wordmark = element(page, /<a class="wordmark"/u, "</a>");
    // The Teachometry name comes first and has no image of its own.
    assert.match(wordmark, /^<a class="wordmark"[^>]*><span class="wordmark-copy"><span class="wordmark-name">Teachometry<\/span>/u, route);
    assert.match(wordmark, /aria-label="Teachometry TutorBench (home|首页)"/u, route);

    const footerBrand = page.match(/<a class="home-footer-brand" href="[^"]*">([\s\S]*?)<\/a>/u)?.[1];
    assert.equal(footerBrand, "Teachometry", `${route}: footer Teachometry name is text only`);

    // Every T1 mark on the page is immediately followed by the TutorBench name.
    const marks = [...page.matchAll(/<img[^>]*tutorbench-mark[^>]*>/gu)];
    assert.equal(marks.length, 2, `${route}: header and footer product marks`);
    for (const mark of marks) {
      const after = page.slice((mark.index ?? 0) + mark[0].length, (mark.index ?? 0) + mark[0].length + 80);
      assert.match(after, /^<(span class="wordmark-product-name"|span><strong)>TutorBench</u, `${route}: mark must label TutorBench`);
      assert.match(mark[0], /width="16" height="16"/u, `${route}: small optical mark stays in its 16-32 px range`);
      assert.match(mark[0], /alt=""/u);
    }
    // No other image (botanical illustrations included) is used as a brand mark.
    assert.doesNotMatch(wordmark, /<img(?![^>]*tutorbench-mark-small)/u, route);
    // Structured data never assigns a logo to the Teachometry organization.
    assert.doesNotMatch(page, /"logo"\s*:/u, route);
  }
});

test("header and footer say that TutorBench is Teachometry's AI tutor evaluation product, in both locales", () => {
  const en = html.get("") ?? "";
  const zh = html.get("zh-cn/") ?? "";
  assert.match(en, /<span class="wordmark-product-note"><span data-ui-text="productDescriptor"[^>]*>AI tutor evaluation<\/span>/u);
  assert.match(zh, /<span class="wordmark-product-note"><span data-ui-text="productDescriptor"[^>]*>AI 教学质量评测<\/span>/u);
  assert.match(en, /<strong>TutorBench<\/strong> <span>An AI tutoring quality evaluation product by Teachometry\.<\/span>/u);
  assert.match(zh, /<strong>TutorBench<\/strong> <span>Teachometry 旗下的 AI 教学质量评测产品。<\/span>/u);
  assert.match(en, /<span>Teachometry · TutorBench · <span>Developer Preview<\/span><\/span>/u);
  assert.match(en, /With TutorBench, Teachometry turns authored learning situations/u);
  assert.match(zh, /Teachometry 通过 TutorBench 将人工编写的学习情境/u);
});

test("the homepage separates the Micro-Review demo from running an evaluation and from the Methodology", () => {
  for (const { prefix, home } of LOCALES) {
    const page = html.get(prefix) ?? "";
    const actions = element(page, /<div class="home-actions">/u, '<a class="home-try"');
    const run = actions.indexOf(`href="${home}run/"`);
    const methodology = actions.indexOf(`href="${home}methodology/"`);
    const tryLink = page.indexOf(`<a class="home-try" href="${home}micro-review/"`);
    assert.ok(run >= 0 && methodology > run, `${prefix}: run, then methodology`);
    assert.ok(tryLink > page.indexOf('<div class="home-actions">'), `${prefix}: demo entry follows the two formal paths`);

    // Each formal path is described by visible text that assistive tech also reads.
    for (const id of ["home-action-run-note", "home-action-method-note"]) {
      assert.match(actions, new RegExp(`aria-describedby="${id}"`, "u"));
      assert.match(actions, new RegExp(`<span class="home-action-note" id="${id}">[^<]+</span>`, "u"));
    }

    const demo = element(page, /<a class="home-try"/u, "</a>");
    const demoText = demo.replace(/<[^>]+>/gu, " ");
    if (prefix === "") {
      assert.match(actions, /Uses TutorBench on your own machine/u);
      assert.match(actions, /How formal evaluations work/u);
      assert.match(demo, /Try one teaching case/u);
      assert.match(demo, /A constructed example\. About 60 seconds, nothing to install, not a model evaluation\./u);
    } else {
      assert.match(actions, /在你自己的环境中运行 TutorBench/u);
      assert.match(actions, /了解正式评测如何进行/u);
      assert.match(demo, /体验一个教学案例/u);
      assert.match(demo, /人工编写的示例，约 60 秒，无需安装，也不是模型评测。/u);
      assert.doesNotMatch(demoText, /[A-Za-z]{4,}/u, "zh-CN demo entry has no leaked English copy");
    }
    // The demo entry must not read as a Reviewer application, enrollment or data collection.
    assert.doesNotMatch(demoText, /review(er)?s? (application|program)|apply|sign ?up|join|enrol|register|survey|collect|participat|评审员|申请|报名|招募|收集|参与/iu);
  }
});

test("Micro-Review ends with the two formal paths, localized, without changing its own boundaries", () => {
  for (const { prefix, home } of LOCALES) {
    const page = html.get(prefix + "micro-review/") ?? "";
    const next = element(page, /<nav class="micro-review-next"/u, "</nav>");
    assert.match(next, new RegExp(`href="${home}run/" data-micro-review-run-link`, "u"));
    assert.match(next, new RegExp(`href="${home}methodology/" data-micro-review-methodology-link`, "u"));
    assert.match(next, prefix === "" ? /Run a real evaluation with TutorBench/u : /使用 TutorBench 运行真实评测/u);
    // The next steps come after the privacy boundary, which still says nothing is sent or saved.
    assert.ok(page.indexOf('class="micro-review-boundary"') < page.indexOf('class="micro-review-next"'));
    assert.match(page, prefix === "" ? /It is not sent to a server or saved\./u : /不发送到服务器、不保存/u);
  }
});

test("home JSON-LD names the Teachometry site without declaring TutorBench as its alias", () => {
  for (const { prefix } of LOCALES) {
    const page = html.get(prefix) ?? "";
    const blocks = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)].map((match) => JSON.parse(match[1] ?? "null"));
    const nodes = blocks.flatMap((block) => (Array.isArray(block) ? block : Array.isArray(block?.["@graph"]) ? block["@graph"] : [block]));
    const site = nodes.find((node) => node?.["@type"] === "WebSite");
    assert.ok(site, `${prefix}: WebSite node`);
    assert.equal(site.name, "Teachometry");
    assert.equal(site.alternateName, undefined, "TutorBench is a product, not another name for the site");
    for (const node of nodes) {
      assert.equal(node?.logo, undefined, "no unconfirmed logo");
      assert.notEqual(node?.alternateName, "TutorBench");
    }
  }
});

// Source-level guards for the layout rules behind the real-browser hit test
// (scripts/website-hit-test.mjs, run in CI), so a regression is also caught here.
const css = async (file: string) => readFile(join("website", "src", file), "utf8");
const rule = (source: string, selector: RegExp): string => {
  const match = source.match(new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`, selector.flags));
  assert.ok(match, `missing rule ${selector}`);
  return match[1] ?? "";
};

test("homepage path units wrap instead of shrinking under their buttons", async () => {
  const home = await css("home.css");
  assert.match(rule(home, /^\.home-actions/mu), /flex-wrap: wrap;/u);
  const unit = rule(home, /^\.home-action/mu);
  assert.doesNotMatch(unit, /min-width:\s*0/u, "a unit narrower than its button lets the button overlap the next unit");
  assert.match(unit, /max-width: 100%;/u);
  const button = rule(home, /^\.home-page \.home-action \.button/mu);
  assert.match(button, /white-space: normal;/u);
  assert.match(button, /max-width: 100%;/u);
});

test("desktop header keeps navigation in flow and lets rows wrap instead of overlapping the tools", async () => {
  const chrome = await css("teachometry.css");
  const desktop = chrome.slice(chrome.indexOf("@media (min-width: 1024px) {"), chrome.indexOf("/* Enlarged text uses one reading order"));
  assert.ok(desktop.length > 0);
  assert.match(rule(desktop, /\) \.home-header \.header-inner/u), /flex-wrap: wrap;[\s\S]*height: auto;/u);
  const nav = rule(desktop, /\) \.home-header \.nav-links/u);
  assert.match(nav, /position: static;/u);
  assert.match(nav, /grid-template-columns: minmax\(min-content, 1fr\) auto minmax\(min-content, 1fr\);/u, "columns never shrink below their links");
  assert.doesNotMatch(nav, /position: absolute|left: 50%/u, "an absolutely centred nav can sit under the tools");
  assert.match(rule(desktop, /\) \.home-header \.nav-group/u), /flex-wrap: wrap;/u);
  for (const side of [/\) \.home-header \.wordmark/u, /\) \.home-header-tools/u]) {
    assert.match(rule(desktop, side), /min-width: fit-content;/u, "header sides never shrink under their content");
  }
  assert.match(rule(desktop, /\) \.home-header-tools/u), /flex-wrap: wrap;/u);
  assert.doesNotMatch(chrome, /\.home-header \.nav-links \{[^}]*font-size: 11px/u, "no further font shrinking for the narrow desktop range");
});

test("sticky content follows the real header height, which site.js publishes on desktop", async () => {
  const site = await readFile(join("website", "src", "site.js"), "utf8");
  assert.match(site, /root\.style\.setProperty\('--teach-header-offset'/u);
  assert.match(site, /new ResizeObserver\(sync\)\.observe\(header\)/u);
  assert.match(site, /window\.addEventListener\('teach:header-offset', scheduleLayout\)/u);
  for (const file of ["home.css", "methodology.css"]) {
    const source = await css(file);
    assert.doesNotMatch(source, /calc\(var\(--teach-header-height(?:, 72px)?\) [+-]/u, `${file}: offsets use --teach-header-offset`);
    assert.match(source, /var\(--teach-header-offset, var\(--teach-header-height/u);
  }
});

test("the header product line is set at a readable size", async () => {
  const chrome = await css("teachometry.css");
  for (const selector of [/^\.home-header \.wordmark-product-name/mu, /^\.home-header \.wordmark-product-note/mu]) {
    const size = Number(rule(chrome, selector).match(/font: \d+ (\d+)px/u)?.[1]);
    assert.ok(size >= 12, `${selector} is ${size}px`);
  }
  assert.doesNotMatch(chrome, /\.wordmark-product-note \{\s*font-size: [67]px/u);
});

test("CI runs the real-browser hit test after building the website", async () => {
  const workflow = await readFile(join(".github", "workflows", "ci.yml"), "utf8");
  assert.ok(workflow.indexOf("run: npm run website:build") < workflow.indexOf("run: node scripts/website-hit-test.mjs"));
});
