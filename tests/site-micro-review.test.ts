import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { buildWebsite } from "../src/cli/website-build.js";
import { buildPublicBenchmarkArtifacts, loadTutorEvalDataset } from "../src/datasets/index.js";
import { renderPage } from "../src/site/html.js";
import { renderMicroReviewPage } from "../src/site/pages/micro-review.js";

async function artifacts() {
  return buildPublicBenchmarkArtifacts(await loadTutorEvalDataset());
}

test("Micro-Review labels its single constructed conversation and keeps analysis behind a choice", async () => {
  const data = await artifacts();
  const before = JSON.stringify(data);
  const page = renderMicroReviewPage(data);
  assert.equal(page.route, "/micro-review/");
  assert.match(page.content, /Constructed example · not a real model output/u);
  assert.match(page.content, /AI tutor · constructed reply/u);
  assert.match(page.content, /1\/3 \+ 1\/4 = 2\/7/u);
  assert.match(page.content, /Yes, that's right!/u);
  assert.match(page.content, /1\/3 \+ 1\/4 = 4\/12 \+ 3\/12 = 7\/12/u);
  assert.equal((page.content.match(/type="radio"/gu) ?? []).length, 3);
  assert.deepEqual([...page.content.matchAll(/value="([^"]+)" required/gu)].map((match) => match[1]), ["suitable", "problem", "unsure"]);
  assert.match(page.content, /<fieldset>[\s\S]*<legend>How suitable is the AI reply for teaching\?<\/legend>/u);
  assert.match(page.content, /data-micro-review-result[^>]* hidden>/u);
  assert.match(page.content, /tabindex="-1"/u);
  assert.match(page.content, /role="status"/u);
  assert.match(page.content, /Reviewer applications are not open yet/u);
  assert.doesNotMatch(page.content, /type="(?:email|text|password)"|<textarea|scoreValue|rubricId|modelId/u);
  assert.equal(JSON.stringify(data), before);
});

test("Micro-Review reuses bilingual chrome, localizes visible and accessible text, and honors base paths", async () => {
  const page = renderMicroReviewPage(await artifacts());
  for (const locale of ["en", "zh-CN"] as const) {
    const html = renderPage(page, { locale, basePath: "/preview", siteUrl: "https://example.test/preview" });
    const prefix = locale === "zh-CN" ? "/preview/zh-cn" : "/preview";
    assert.match(html, /class="home-page micro-review-page"/u);
    assert.match(html, /href="\/preview\/assets\/teachometry\.css"/u);
    assert.match(html, /src="\/preview\/assets\/micro-review\.js"/u);
    assert.match(html, /href="\/preview\/assets\/micro-review\.css"/u);
    assert.ok(html.includes(`href="${prefix}/community/#community-process"`));
    assert.match(html, /data-locale-en-url="\/preview\/micro-review\/" data-locale-zh-cn-url="\/preview\/zh-cn\/micro-review\/"/u);
    assert.equal((html.match(/<footer /gu) ?? []).length, 1);
    assert.doesNotMatch(html, /assets\/(?:home|cases|methodology)\.css|<footer class="site-footer">/u);
    if (locale === "zh-CN") {
      for (const text of ["微评审体验", "基本合适", "存在教学问题", "不确定", "构造示例", "并非真实模型输出", "我觉得", "我把分子相加", "对，完全正确", "你的判断已在上方展示", "了解独立 Reviewer 计划", "评审员申请尚未开放", "效度研究"]) assert.ok(html.includes(text), text);
      assert.match(html, /aria-label="三分之一加四分之一等于七分之二"/u);
      assert.match(html, /aria-label="你的教学判断"/u);
      assert.doesNotMatch(html, /Your judgment is shown|Basically suitable|Has a teaching problem|Not sure|I think|I added the top|Yes, that's right|not a real model output/u);
      assert.match(html, /<title>微评审体验 — Teachometry<\/title>/u);
    } else {
      assert.match(html, /<title>Micro-Review — Teachometry<\/title>/u);
    }
  }
});

async function createBrowserFixture() {
  class Element {
    hidden = true;
    textContent = "";
    focusCount = 0;
    children = new Map<string, Element>();
    handlers = new Map<string, (event: { preventDefault(): void }) => void>();
    querySelector(selector: string): Element | null { return this.children.get(selector) ?? null; }
    addEventListener(name: string, handler: (event: { preventDefault(): void }) => void) { this.handlers.set(name, handler); }
    focus() { this.focusCount += 1; }
  }
  class Form extends Element {
    valid = true;
    reportValidity() { return this.valid; }
  }
  class Fieldset extends Element { disabled = false; }
  class Input extends Element { value = ""; }
  class Button extends Element {}
  const form = new Form();
  const result = new Element();
  const status = new Element();
  const heading = new Element();
  const unavailable = new Element();
  const message = new Element();
  message.textContent = "Localized completion message";
  const fieldset = new Fieldset();
  const submit = new Button();
  submit.hidden = false;
  const selected = new Input();
  const nodes = new Map<string, Element>([
    ["[data-micro-review-form]", form],
    ["[data-micro-review-result]", result],
    ["[data-micro-review-status]", status],
    ["[data-micro-review-unavailable]", unavailable],
    ["[data-micro-review-complete-message]", message],
  ]);
  result.children.set("h2", heading);
  form.children.set("fieldset", fieldset);
  form.children.set('button[type="submit"]', submit);
  let prevented = 0;
  const source = await readFile("website/src/micro-review.js", "utf8");
  const document = { querySelector: (selector: string) => nodes.get(selector) ?? null };
  function run() {
    runInNewContext(source, {
      HTMLElement: Element, HTMLFormElement: Form, HTMLFieldSetElement: Fieldset,
      HTMLInputElement: Input, HTMLButtonElement: Button, document,
      // 任何答案采集副作用都应让行为测试失败。
      fetch: () => { throw new Error("Unexpected network request"); },
      navigator: { sendBeacon: () => { throw new Error("Unexpected beacon"); } },
      window: { localStorage: { setItem: () => { throw new Error("Unexpected persistent answer"); } } },
    });
  }
  function choose(value: string) {
    selected.value = value;
    form.children.set('input[name="judgment"]:checked', selected);
  }
  function send() { form.handlers.get("submit")?.({ preventDefault() { prevented += 1; } }); }
  return { form, result, status, heading, unavailable, fieldset, submit, nodes, run, choose, send, prevented: () => prevented };
}

for (const choice of ["suitable", "problem", "unsure"]) {
  test(`Micro-Review completes ${choice} locally, moves focus, and prevents duplicate submission`, async () => {
    const browser = await createBrowserFixture();
    browser.run();
    assert.equal(browser.form.hidden, false);
    assert.equal(browser.unavailable.hidden, true);
    assert.equal(browser.result.hidden, true);
    browser.choose(choice);
    browser.send();
    assert.equal(browser.result.hidden, false);
    assert.equal(browser.fieldset.disabled, true);
    assert.equal(browser.submit.hidden, true);
    assert.equal(browser.status.textContent, "Localized completion message");
    assert.equal(browser.heading.focusCount, 1);
    browser.send();
    assert.equal(browser.prevented(), 2);
    assert.equal(browser.heading.focusCount, 1);
  });
}

test("Micro-Review rejects missing, unknown, or invalid selections before showing analysis", async () => {
  const browser = await createBrowserFixture();
  browser.run();
  browser.send();
  browser.choose("tampered-value");
  browser.send();
  browser.choose("problem");
  browser.form.valid = false;
  browser.send();
  assert.equal(browser.prevented(), 3);
  assert.equal(browser.result.hidden, true);
  assert.equal(browser.fieldset.disabled, false);
  assert.equal(browser.heading.focusCount, 0);
});

test("Micro-Review keeps the unavailable notice if its markup is incomplete and resets on a new page", async () => {
  const broken = await createBrowserFixture();
  broken.nodes.delete("[data-micro-review-complete-message]");
  broken.run();
  assert.equal(broken.form.hidden, true);
  assert.equal(broken.form.handlers.size, 0);
  const first = await createBrowserFixture();
  first.run();
  first.choose("unsure");
  first.send();
  const reloaded = await createBrowserFixture();
  reloaded.run();
  assert.equal(reloaded.result.hidden, true);
  assert.equal(reloaded.status.textContent, "");
});

test("website build emits the Micro-Review route in both locales without changing public benchmark data", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "tutorbench-micro-review-"));
  try {
    const data = await artifacts();
    await buildWebsite({ outputDirectory });
    for (const prefix of ["", "zh-cn/"]) {
      const html = await readFile(join(outputDirectory, prefix, "micro-review/index.html"), "utf8");
      assert.match(html, /data-micro-review-form/u);
      assert.match(html, /data-micro-review-result[^>]* hidden>/u);
    }
    for (const file of ["micro-review.js", "micro-review.css"]) assert.ok((await readFile(join(outputDirectory, "assets", file), "utf8")).length > 0);
    for (const name of ["benchmark", "cases", "models", "trials"] as const) {
      assert.equal(await readFile(join(outputDirectory, "public-data", `${name}.json`), "utf8"), `${JSON.stringify(data[name], null, 2)}\n`);
    }
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
