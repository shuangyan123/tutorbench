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
  await buildWebsite({ outputDirectory });
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

test("header and footer say that TutorBench is Teachometry's AI teaching evaluation product, in both locales", () => {
  const en = html.get("") ?? "";
  const zh = html.get("zh-cn/") ?? "";
  assert.match(en, /<span class="wordmark-product-note"><span data-ui-text="productDescriptor"[^>]*>AI teaching evaluation<\/span>/u);
  assert.match(zh, /<span class="wordmark-product-note"><span data-ui-text="productDescriptor"[^>]*>AI 教学质量评测<\/span>/u);
  assert.match(en, /<strong>TutorBench<\/strong> <span>An AI teaching quality evaluation product by Teachometry\.<\/span>/u);
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
