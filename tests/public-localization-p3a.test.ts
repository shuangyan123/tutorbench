import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { buildWebsite } from "../src/cli/website-build.js";
import { TUTOR_EVAL_DATASET_ID } from "../src/contracts/index.js";
import { buildPublicBenchmarkArtifacts, loadTutorEvalDataset, type PublicBenchmarkArtifacts } from "../src/datasets/index.js";
import { escapeHtml, renderPage } from "../src/site/html.js";
import type { SiteLocale } from "../src/site/i18n.js";
import { renderCasesPage } from "../src/site/pages/data.js";
import { renderHomePage } from "../src/site/pages/home.js";
import { BLOG_POSTS } from "../src/site/pages/blog.js";
import { publicUiCopy } from "../src/site/public-localization.js";
import {
  formatCaseCount, formatDocCount, formatCasePositionAriaLabel, formatExampleCaseAriaLabel,
} from "../src/site/public-localization-formatters.js";

let output: string;
let artifacts: PublicBenchmarkArtifacts;
const deployments = [
  { directory: "root", url: "https://teachometry.com", basePath: "" },
  { directory: "project", url: "https://example.test/tutorbench", basePath: "/tutorbench" },
] as const;
before(async () => {
  artifacts = buildPublicBenchmarkArtifacts(await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID));
  output = await mkdtemp(join(tmpdir(), "tutorbench-localization-p3a-"));
  for (const deployment of deployments) {
    await buildWebsite({ outputDirectory: join(output, deployment.directory), siteUrl: deployment.url, basePath: deployment.basePath });
  }
});
after(async () => { if (output !== undefined) await rm(output, { recursive: true, force: true }); });

function html(route: string, locale: SiteLocale = "zh-CN", deployment = "root"): Promise<string> {
  return readFile(join(output, deployment, locale === "zh-CN" ? "zh-cn" : "", route.slice(1), "index.html"), "utf8");
}
function decode(value: string): string {
  return value.replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}
function attributes(source: string): Record<string, string> {
  return Object.fromEntries([...source.matchAll(/([\w:-]+)="([^"]*)"/gu)].map(match => [match[1], decode(match[2] ?? "")]));
}
// 只提取已生成 HTML 的完整 attribute；不使用源码字符串作为可访问名称证据。
function tags(markup: string): Array<{ tag: string; attrs: Record<string, string>; source: string }> {
  return [...markup.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gu)].map(match => ({
    tag: match[1] ?? "", attrs: attributes(match[2] ?? ""), source: match[0],
  }));
}
function status(markup: string, selector: "cases" | "docs"): { text: string; attrs: Record<string, string> } {
  const pattern = selector === "cases"
    ? /<span\b([^>]*\bid="case-result-count"[^>]*)>([^<]*)<\/span>/u
    : /<p\b([^>]*\bdata-doc-status[^>]*)>([^<]*)<\/p>/u;
  const match = markup.match(pattern);
  assert.ok(match, selector);
  return { text: decode(match[2] ?? ""), attrs: attributes(match[1] ?? "") };
}
function record(value: unknown): Record<string, unknown> {
  assert.ok(typeof value === "object" && value !== null && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function schema(markup: string, type: string): Record<string, unknown> {
  const scripts = [...markup.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)];
  assert.ok(scripts.length > 0);
  const parsed = scripts.flatMap(script => {
    const value: unknown = JSON.parse(script[1] ?? "");
    return Array.isArray(value) ? value.map(record) : [record(value)];
  });
  const found = parsed.find(item => item["@type"] === type);
  assert.ok(found, type);
  return found;
}

test("LC-24: built HTML without site.js has locale counts and shared client templates", async () => {
  for (const deployment of deployments) {
    for (const locale of ["en", "zh-CN"] as const) {
      const cases = await html("/data/cases/", locale, deployment.directory);
      const count = artifacts.cases.cases.length;
      const pageSize = Number(tags(cases).find(tag => tag.source.includes("data-case-results"))?.attrs["data-page-size"]);
      assert.ok(pageSize > 0);
      const initial = status(cases, "cases");
      assert.equal(initial.text, formatCaseCount(1, Math.min(pageSize, count), count, locale));
      const template = initial.attrs[locale === "en" ? "data-case-count-template-en" : "data-case-count-template-zh-cn"];
      assert.ok(template);
      assert.equal(initial.text, template.replaceAll("{start}", "1").replaceAll("{end}", String(Math.min(pageSize, count))).replaceAll("{count}", String(count)));
      const docs = await html("/docs/", locale, deployment.directory);
      const entries = tags(docs).filter(tag => tag.tag === "article" && tag.source.includes("data-doc-entry")).length;
      const references = status(docs, "docs");
      assert.equal(references.text, formatDocCount(entries, locale));
      assert.equal(references.text, references.attrs["data-doc-count-template"]?.replaceAll("{count}", String(entries)));
    }
  }
  const first = artifacts.cases.cases[0];
  assert.ok(first);
  for (const count of [0, 1, 7, 71]) {
    const changed = { ...artifacts, cases: { ...artifacts.cases, cases: Array.from({ length: count }, (_, index) => ({ ...first, id: `fixture-${index}` })) } };
    for (const locale of ["en", "zh-CN"] as const) {
      const markup = renderPage(renderCasesPage(changed, locale), { locale });
      const pageSize = Number(tags(markup).find(tag => tag.source.includes("data-case-results"))?.attrs["data-page-size"]);
      assert.equal(status(markup, "cases").text, formatCaseCount(count === 0 ? 0 : 1, Math.min(pageSize, count), count, locale));
      assert.equal(formatDocCount(count, locale), locale === "en" ? `Showing ${count} references` : `显示 ${count} 条参考资料`);
    }
  }
});

class DomElement {
  hidden = false;
  textContent = "";
  readonly attrs: Record<string, string>;
  readonly listeners = new Map<string, () => void>();
  constructor(attrs: Record<string, string> = {}) { this.attrs = { ...attrs }; }
  getAttribute(name: string): string | null { return this.attrs[name] ?? null; }
  setAttribute(name: string, value: string): void { this.attrs[name] = value; }
  addEventListener(name: string, callback: () => void): void { this.listeners.set(name, callback); }
  focus(): void { /* Search focus has no effect on count text. */ }
}
class DomInput extends DomElement { value = ""; }
class DomButton extends DomElement {}

test("LC-24: actual client updates agree with initial HTML, filtering and clear", async () => {
  const script = await readFile(join(output, "root", "assets", "site.js"), "utf8");
  const casesScript = script.match(/ {2}function renderCount\(start, end, count\) \{[\s\S]*?\n {2}\}/u)?.[0];
  const docsScript = script.match(/\(\(\) => \{\s+const docsPage = document.querySelector\('\.docs-page'\);[\s\S]*?\n\}\)\(\);/u)?.[0];
  assert.ok(casesScript && docsScript);
  for (const locale of ["en", "zh-CN"] as const) {
    const initial = status(await html("/data/cases/", locale), "cases");
    const resultCount = new DomElement(initial.attrs);
    resultCount.textContent = initial.text;
    const context = { resultCount, HTMLElement: DomElement, document: { documentElement: { dataset: { uiLocale: locale } } } };
    for (const [start, end, count] of [[1, 12, 48], [0, 0, 0], [1, 1, 1], [2, 7, 7], [61, 71, 71]]) {
      runInNewContext(`${casesScript}\nrenderCount(${start}, ${end}, ${count});`, context);
      assert.equal(resultCount.textContent, formatCaseCount(start ?? 0, end ?? 0, count ?? 0, locale));
    }
    assert.equal(initial.text, formatCaseCount(1, 12, 48, locale));
    const markup = await html("/docs/", locale);
    const initialDocs = status(markup, "docs");
    const entries = tags(markup).filter(tag => tag.tag === "article" && tag.source.includes("data-doc-entry")).map(tag => new DomElement(tag.attrs));
    const input = new DomInput();
    const clear = new DomButton();
    const result = new DomElement(initialDocs.attrs);
    const empty = new DomElement();
    const nodes = new Map<string, DomElement>([["[data-doc-search]", input], ["[data-doc-search-clear]", clear], ["[data-doc-status]", result], ["[data-doc-empty]", empty]]);
    class DocsPage extends DomElement {
      querySelector(selector: string): DomElement | null { return nodes.get(selector) ?? null; }
      querySelectorAll(selector: string): readonly DomElement[] { return selector === "[data-doc-entry]" ? entries : []; }
    }
    runInNewContext(docsScript, { document: { querySelector: () => new DocsPage() }, HTMLElement: DomElement, HTMLInputElement: DomInput, HTMLButtonElement: DomButton });
    assert.equal(result.textContent, initialDocs.text);
    input.value = locale === "zh-CN" ? "冻结" : "frozen";
    input.listeners.get("input")?.();
    const visible = entries.filter(entry => !entry.hidden).length;
    assert.ok(visible > 0 && visible < entries.length);
    assert.equal(result.textContent, locale === "zh-CN" ? `显示 ${visible} / ${entries.length} 条参考资料` : `Showing ${visible} of ${entries.length} references`);
    clear.listeners.get("click")?.();
    assert.equal(result.textContent, initialDocs.text);
    assert.ok(entries.every(entry => !entry.hidden));
  }
});

test("LC-25/31: all four Blog articles have locale neighbor names and semantic JSON-LD headlines", async () => {
  for (const deployment of deployments) {
    for (const locale of ["en", "zh-CN"] as const) {
      let neighbors = 0;
      for (const [index, post] of BLOG_POSTS.entries()) {
        const markup = await html(post.route, locale, deployment.directory);
        const displayTitle = publicUiCopy(post.title, locale);
        const h1 = markup.match(/<h1 id="article-title">([^<]*)<\/h1>/u)?.[1];
        assert.equal(decode(h1 ?? ""), displayTitle);
        const article = schema(markup, "BlogPosting");
        assert.equal(article.headline, displayTitle);
        assert.doesNotMatch(String(article.headline), /Teachometry Blog|Teachometry 博客/u);
        assert.equal(article.url, `${deployment.url}${locale === "zh-CN" ? "/zh-cn" : ""}${post.route}`);
        for (const [direction, offset] of [["previous", -1], ["next", 1]] as const) {
          const target = BLOG_POSTS[index + offset];
          const link = tags(markup).find(tag => tag.attrs.class?.split(" ").includes(`article-nav-${direction}`));
          if (target === undefined) { assert.equal(link, undefined); continue; }
          assert.ok(link);
          neighbors += 1;
          const label = locale === "en" ? `${direction === "previous" ? "Previous article" : "Next article"}: ` : `${direction === "previous" ? "上一篇文章" : "下一篇文章"}：`;
          assert.equal(link.attrs["aria-label"], label + publicUiCopy(target.title, locale));
          assert.equal(link.attrs.href, `${deployment.basePath}${locale === "zh-CN" ? "/zh-cn" : ""}${target.route}`);
        }
      }
      assert.equal(neighbors, 6);
    }
  }
});

test("LC-26: region and navigation names on every affected final route preserve English and localized names", async () => {
  const routes = [...artifacts.cases.cases.map(item => `/data/cases/${item.id}/`), "/data/heatmap/", "/data/trials/", "/data/trials/[trialId]/", "/about/", "/methodology/", "/leaderboard/"];
  const translated: Readonly<Record<string, string>> = {
    Breadcrumb: "面包屑导航",
    "Canonical benchmark score dimensions": "标准基准评分维度",
    "5 benchmark score dimensions": "5 个基准评分维度",
    Efficiency: "效率",
  };
  const sharedNames: Readonly<Record<string, string>> = {
    "Primary navigation": "主导航", "Color theme": "颜色主题", Product: "产品", Resources: "资源", Connect: "联系",
  };
  const observed = new Set<string>();
  for (const route of routes) {
    const regionNames = (markup: string): readonly string[] => tags(markup)
      .filter(tag => ["nav", "section", "ol", "ul", "figure", "svg"].includes(tag.tag) || ["region", "group"].includes(tag.attrs.role ?? ""))
      .flatMap(tag => tag.attrs["aria-label"] === undefined ? [] : [tag.attrs["aria-label"]]);
    const en = regionNames(await html(route, "en"));
    const zh = regionNames(await html(route));
    assert.equal(zh.length, en.length, route);
    for (const [index, name] of en.entries()) {
      if (translated[name] !== undefined) observed.add(name);
      assert.equal(zh[index], translated[name] ?? sharedNames[name] ?? publicUiCopy(name, "zh-CN"), `${route}: ${name}`);
    }
    for (const name of Object.keys(translated)) assert.ok(!zh.includes(name), `${route}: ${name}`);
  }
  assert.deepEqual([...observed].sort(), Object.keys(translated).sort());
});

test("LC-27/28: Home positions, Cases specimen and five Run copy names retain dynamic identities", async () => {
  const specimen = artifacts.cases.cases.find(item => item.id === "correct-answer-wrong-reasoning-001") ?? artifacts.cases.cases[0];
  assert.ok(specimen);
  for (const locale of ["en", "zh-CN"] as const) {
    const cases = tags(await html("/", locale)).filter(tag => tag.source.includes("data-home-case"));
    assert.equal(cases.length, artifacts.cases.cases.length);
    for (const [index, item] of cases.entries()) assert.equal(item.attrs["aria-label"], formatCasePositionAriaLabel(index + 1, cases.length, locale));
    const example = tags(await html("/data/cases/", locale)).find(tag => tag.attrs.class === "cases-hero-specimen");
    assert.equal(example?.attrs["aria-label"], formatExampleCaseAriaLabel(specimen.id, locale));
    const buttons = tags(await html("/run/", locale)).filter(tag => tag.tag === "button" && tag.source.includes("data-copy-run"));
    assert.deepEqual(buttons.map(button => button.attrs["aria-label"]), locale === "zh-CN"
      ? ["复制 Quickstart 命令", "复制 Tutor Health 命令", "复制基准命令", "复制 HTTP 适配器命令", "复制高级命令"]
      : ["Copy Quickstart command", "Copy Tutor Health command", "Copy Benchmark command", "Copy External Tutor command", "Copy Advanced command"]);
  }
  const first = artifacts.cases.cases[0];
  assert.ok(first);
  for (const [current, total] of [[1, 1], [2, 7], [71, 71]] as const) {
    const changed = { ...artifacts, cases: { ...artifacts.cases, cases: Array.from({ length: total }, (_, index) => ({ ...first, id: `fixture-${index}` })) } };
    for (const locale of ["en", "zh-CN"] as const) {
      const markup = renderPage(renderHomePage(changed, locale), { locale });
      const cases = tags(markup).filter(tag => tag.source.includes("data-home-case"));
      const expected = locale === "zh-CN" ? `第 ${current} 个案例，共 ${total} 个` : `Case ${current} of ${total}`;
      assert.equal(cases[current - 1]?.attrs["aria-label"], expected);
      assert.equal(formatExampleCaseAriaLabel("fixture<&-007", locale), `${locale === "zh-CN" ? "公开示例案例" : "Example public case"} fixture<&-007`);
    }
  }
});

test("LC-29: all 48 case metadata wrappers preserve every original objective and payload", async () => {
  for (const item of artifacts.cases.cases) {
    for (const locale of ["en", "zh-CN"] as const) {
      const markup = await html(`/data/cases/${item.id}/`, locale);
      const expected = locale === "zh-CN" ? `公开 TutorEval 案例 ${item.id}：${item.tutorInput.learningObjective}` : `Public TutorEval case ${item.id}: ${item.tutorInput.learningObjective}`;
      const descriptions = tags(markup).filter(tag => tag.tag === "meta" && (tag.attrs.name === "description" || tag.attrs.property === "og:description" || tag.attrs.name === "twitter:description"));
      assert.equal(descriptions.length, 3);
      for (const meta of descriptions) assert.equal(meta.attrs.content, expected, item.id);
      for (const value of [item.id, item.version, item.tutorInput.learningObjective, item.tutorInput.studentMessage, ...(item.tutorInput.conversationHistory ?? []).map(message => message.text)]) {
        assert.ok(markup.includes(escapeHtml(value)), item.id);
      }
    }
  }
});

test("LC-30: parsed home Organization and ContactPoint fields are locale aware with stable identities", async () => {
  for (const deployment of deployments) {
    const en = schema(await html("/", "en", deployment.directory), "Organization");
    const zh = schema(await html("/", "zh-CN", deployment.directory), "Organization");
    assert.equal(en.description, "Open measurement infrastructure for observable AI tutoring behavior.");
    assert.equal(zh.description, "用于测量 AI 可观察教学行为的开放基础设施。");
    assert.equal(record(en.contactPoint).contactType, "project inquiries");
    assert.equal(record(zh.contactPoint).contactType, "项目咨询");
    for (const field of ["name", "email", "sameAs"]) assert.deepEqual(zh[field], en[field]);
    assert.equal(record(zh.contactPoint).email, record(en.contactPoint).email);
    assert.equal(en.url, `${deployment.url}/`);
    assert.equal(zh.url, `${deployment.url}/zh-cn/`);
  }
});

test("P3A preserves canonical, hreflang, bilingual sitemap, basePath assets and raw public JSON", async () => {
  const routes = ["/", "/data/cases/", "/docs/", "/run/", ...BLOG_POSTS.map(post => post.route), ...artifacts.cases.cases.map(item => `/data/cases/${item.id}/`)];
  for (const deployment of deployments) {
    const sitemap = await readFile(join(output, deployment.directory, "sitemap.xml"), "utf8");
    for (const route of routes) {
      for (const locale of ["en", "zh-CN"] as const) {
        const markup = await html(route, locale, deployment.directory);
        const links = tags(markup).filter(tag => tag.tag === "link");
        const localizedRoute = `${locale === "zh-CN" ? "/zh-cn" : ""}${route}`;
        const canonical = `${deployment.url}${localizedRoute}`;
        assert.equal(links.find(link => link.attrs.rel === "canonical")?.attrs.href, canonical);
        assert.ok(sitemap.includes(`<loc>${canonical}</loc>`));
        for (const language of ["en", "zh-CN", "x-default"]) {
          assert.equal(links.find(link => link.attrs.hreflang === language)?.attrs.href, `${deployment.url}${language === "zh-CN" ? "/zh-cn" : ""}${route}`);
        }
        const internalAssets = tags(markup).flatMap(tag => [tag.attrs.src, tag.tag === "link" && tag.attrs.rel === "stylesheet" ? tag.attrs.href : undefined]).filter((value): value is string => value?.startsWith("/") === true);
        assert.ok(internalAssets.length > 0);
        assert.ok(internalAssets.every(value => value.startsWith(`${deployment.basePath}/assets/`)));
        if (route.startsWith("/data/cases/") && route !== "/data/cases/") {
          assert.equal(schema(markup, "BreadcrumbList").itemListElement !== undefined, true);
          assert.ok(markup.includes(`href="${deployment.basePath}${locale === "zh-CN" ? "/zh-cn" : ""}/data/cases/#case-library"`));
        }
      }
    }
    for (const key of ["benchmark", "cases", "models", "trials"] as const) {
      const bytes = await readFile(join(output, deployment.directory, "public-data", `${key}.json`));
      assert.deepEqual(bytes, Buffer.from(JSON.stringify(artifacts[key], null, 2) + "\n"));
    }
  }
  const code = (markup: string): string[] => [...markup.matchAll(/<code\b[^>]*>([\s\S]*?)<\/code>/gu)].map(match => match[1] ?? "");
  assert.deepEqual(code(await html("/run/")), code(await html("/run/", "en")));
});
