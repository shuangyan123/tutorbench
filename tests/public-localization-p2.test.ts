import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { buildWebsite } from "../src/cli/website-build.js";
import { TUTOR_EVAL_DATASET_ID } from "../src/contracts/index.js";
import { buildPublicBenchmarkArtifacts, loadTutorEvalDataset, type PublicBenchmarkArtifacts } from "../src/datasets/index.js";
import { escapeHtml, renderPage, type SitePage } from "../src/site/html.js";
import type { SiteLocale } from "../src/site/i18n.js";
import { renderHomePage } from "../src/site/pages/home.js";
import { renderDataIndexPage } from "../src/site/pages/benchmark.js";
import { renderCasesPage, renderHeatmapPage, renderTrialsPage, renderTrialDetailPage } from "../src/site/pages/data.js";
import { renderModelsPage } from "../src/site/pages/overview.js";
import { renderAboutPage, renderRunPage } from "../src/site/pages/developer.js";
import { BLOG_POSTS } from "../src/site/pages/blog.js";
import { formatPublicationDate } from "../src/site/public-localization-formatters.js";

let output: string;
let artifacts: PublicBenchmarkArtifacts;
before(async () => {
  artifacts = buildPublicBenchmarkArtifacts(await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID));
  output = await mkdtemp(join(tmpdir(), "tutorbench-localization-p2-"));
  await buildWebsite({ outputDirectory: output, siteUrl: "https://teachometry.com" });
});
after(async () => { if (output !== undefined) await rm(output, { recursive: true, force: true }); });

function html(route: string, locale: SiteLocale = "zh-CN"): Promise<string> {
  return readFile(join(output, locale === "zh-CN" ? "zh-cn" : "", route.slice(1), "index.html"), "utf8");
}
function text(markup: string): string {
  // 仅提取已生成 HTML 的文本片段供断言比较，不生成或过滤可再次渲染的 HTML。
  return [...markup.matchAll(/(?:^|>)([^<]*)/gu)]
    .map(match => match[1] ?? "").join("").replace(/\s+/gu, " ").trim();
}
function final(page: SitePage, locale: SiteLocale = "zh-CN"): string { return renderPage(page, { locale }); }

const ROUTES = ["/", "/about/", "/data/", "/data/cases/", "/methodology/", "/leaderboard/", "/models/", "/models/[modelId]/", "/run/", "/docs/", "/data/heatmap/", "/data/trials/", "/data/trials/[trialId]/", "/blog/"];

test("LC-08: final CTA nodes use Chinese throughout the requested routes", async () => {
  const ctas = [
    ["View all posts", "查看全部文章"], ["Read our approach", "了解我们的方法"], ["Inspect the repository", "查看仓库"],
    ["View current release notes", "查看当前版本说明"], ["Browse Cases", "浏览案例"], ["View all coverage", "查看全部覆盖情况"],
    ["Explore all cases", "探索全部案例"], ["Read the data documentation", "阅读数据文档"], ["About our cases", "关于案例"],
    ["Browse documentation", "浏览文档"], ["Browse the documentation", "浏览文档"], ["View on GitHub", "在 GitHub 查看"],
    ["View the documentation", "查看文档"], ["Read our methodology", "阅读方法论"], ["Learn more about our methodology", "了解方法论"],
    ["Follow our progress", "关注进展"], ["See the profile contract", "查看档案契约"], ["Back to Models", "返回模型列表"],
    ["View the profile contract", "查看档案契约"], ["See the trial contract", "查看评测记录契约"], ["Learn how the matrix works", "了解矩阵的工作方式"],
    ["Explore the data", "探索数据"], ["Back to model trials", "返回模型评测记录"],
  ];
  const caseId = artifacts.cases.cases[0]?.id;
  assert.ok(caseId);
  const observed = new Set<string>();
  for (const route of [...ROUTES, `/data/cases/${caseId}/`, ...BLOG_POSTS.map(post => post.route)]) {
    const en = await html(route, "en");
    const zh = await html(route);
    const enLinks = [...en.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gu)].map(match => text(match[1] ?? ""));
    const zhLinks = [...zh.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gu)].map(match => text(match[1] ?? ""));
    for (const [source, translated] of ctas) {
      assert.ok(source && translated);
      if (enLinks.includes(source)) {
        observed.add(source);
        assert.ok(zhLinks.includes(translated), `${route}: ${source}`);
        assert.ok(!zhLinks.includes(source), `${route}: leaked ${source}`);
      }
    }
  }
  // 最新基线使用 Browse the documentation；不要求已不存在的旧 CTA 节点。
  assert.deepEqual(ctas.filter(([source]) => !observed.has(source ?? "")).map(([source]) => source), ["Browse documentation"]);
});

test("LC-09/10/11/12/16/17/18/19: requested final UI labels and explanatory copy", async () => {
  const checks: Readonly<Record<string, readonly string[]>> = {
    "/about/": ["网站", "软件包", "48 个合成案例", "公开模型运行", "校准", "tutor-benchmark@0.1.0", "贡献指南", "安全"],
    "/data/cases/": ["语言", "卡片", "紧凑列表", "水平 1 / 5", "48 个公开案例"],
    "/data/": ["圆点越深", "这里展示数量，不是模型分数", "各类别案例数，类别可重叠；n = 48", "占全部案例的比例；n = 48", "维度覆盖统计", "基准 0.1 · 产物 schema 1", "128 项评分标准 · 开发者预览", "查看全部 8 种学生状态", "查看全部 27 项能力", "学习任务（8）、语言（2）"],
    "/models/": ["可追踪", "可追踪性", "身份", "可用", "无", "0 个公开模型", "0 份公开档案", "有公开模型档案后开放筛选"],
    "/models/[modelId]/": ["身份"],
    "/leaderboard/": ["效率", "成本", "延迟"],
    "/run/": ["高级", "安装", "检查", "无需服务提供方", "HTTP Tutor 适配器（POST /respond）", "输入 TutorTurnInput JSON；输出 { text, metrics? } JSON", "例如，", "当前数据集：tutor-eval-v0.2a@0.2a.6", "标准产物中的 48 个公开案例"],
    "/docs/": ["路线图", "许可", "贡献指南", "安全", "公开基准", "模型登记目录", "结果状态", "社区状态", "阅读内容许可", "阅读品牌政策", "Community Review 协议", "CONTRIBUTING.md", "SECURITY.md", "LICENSE"],
    "/data/trials/": ["字段"],
    "/data/trials/[trialId]/": ["配置", "产物", "可复现性", "模型", "案例", "延迟", "成本", "token 数", "契约字段：", "此语境不是模型运行、结果或评测记录。"],
  };
  for (const [route, strings] of Object.entries(checks)) {
    const markup = text(await html(route));
    for (const value of strings) assert.ok(markup.includes(value), `${route}: ${value}`);
  }
  const first = artifacts.cases.cases[0];
  assert.ok(first);
  const detail = text(await html(`/data/cases/${first.id}/`));
  for (const label of ["版本", "主题", "语言"]) assert.ok(detail.includes(label));
  assert.ok(detail.includes(first.locale ?? "en"));
});

test("LC-13/14/15: visual lines, companion text, and empty matrix remain localized", async () => {
  const method = await html("/methodology/");
  assert.match(method, /class="visually-hidden">从案例走向洞见。<\/span>/u);
  assert.match(method, /class="method-hero-lettering method-hero-lettering-copy">从案例<br>走向洞见。/u);
  assert.match(method, /透明评测<br>AI 教学的<br>方法。/u);
  assert.match(method, /aria-label="5 个基准评分维度"/u);
  for (let index = 1; index <= 5; index += 1) assert.ok(method.includes(`维度 0${index}`));
  assert.doesNotMatch(method, /DIMENSION 0|From<br>cases to insights|A transparent<br>approach/u);
  const expected = {
    "/data/heatmap/": ["一眼看清整体图景。", "多种视角，更充分的证据。", "目前尚无公开模型评测记录。", "矩阵布局、维度和案例结构已定义并准备就绪。", "尚无公开运行", "产物中还有 43 个公开案例标识", "矩阵", "维度", "预留", "数据"],
    "/data/trials/": ["透明的审计轨迹。", "共享证据，改进教学。"],
    "/data/trials/[trialId]/": ["完整的证据记录。", "可追踪的证据，切实的进展。"],
  };
  for (const [route, values] of Object.entries(expected)) {
    const markup = text(await html(route));
    for (const value of values) assert.ok(markup.includes(value), `${route}: ${value}`);
  }
});

test("LC-12/15/16/17: multiple non-production fixtures keep counts and identities dynamic", () => {
  const first = artifacts.cases.cases[0];
  assert.ok(first);
  for (const [count, rubrics, categories] of [[2, 17, 6], [9, 33, 9], [73, 211, 12]] as const) {
    const counts = Object.fromEntries(Array.from({ length: categories }, (_, index) => [`fixture-${index}`, 1]));
    const identity = `fixture-dataset@v${count}`;
    const cases = Array.from({ length: count }, (_, index) => ({ ...first, id: `fixture-case-${index}` }));
    const models = Array.from({ length: count }, (_, index) => ({ id: `fixture-model-${index}`, model: "fixture", provider: "fixture", modelVersion: `v${index}` }));
    const changed: PublicBenchmarkArtifacts = {
      ...artifacts,
      cases: { ...artifacts.cases, cases },
      models: { ...artifacts.models, entries: models },
      benchmark: { ...artifacts.benchmark, dataset: { ...artifacts.benchmark.dataset, id: "fixture-dataset", version: `v${count}`, caseCount: count },
        coverage: { ...artifacts.benchmark.coverage, caseCount: count, rubricCount: rubrics, casesByStudentState: counts, casesByCapabilityTag: counts, casesByLearningTask: counts, casesByLocale: counts } },
    };
    const data = text(final(renderDataIndexPage(changed, "zh-CN")));
    for (const value of [`浏览 ${count} 个人工编写的教学情境`, `${rubrics} 项评分标准 · 开发者预览`, `n = ${count}`, `查看全部 ${categories} 种学生状态`, `查看全部 ${categories} 项能力`, `学习任务（${categories}）、语言（${categories}）`]) assert.ok(data.includes(value), value);
    assert.ok(final(renderCasesPage(changed, "zh-CN")).includes(`${count} 个公开案例`));
    assert.ok(final(renderAboutPage(changed, "9.8.7", "zh-CN")).includes(`${count} 个合成案例`));
    assert.ok(final(renderAboutPage(changed, "9.8.7", "zh-CN")).includes("tutor-benchmark@9.8.7"));
    const run = final(renderRunPage(changed, "zh-CN"));
    assert.ok(run.includes(`当前数据集：${identity}`));
    assert.ok(run.includes(`标准产物中的 ${count} 个公开案例`));
    const registry = final(renderModelsPage(changed, "zh-CN"));
    assert.ok(registry.includes(`${count} 个公开模型`));
    assert.ok(registry.includes(`${count} 份公开档案`));
    const heatmap = final(renderHeatmapPage(changed, "zh-CN"));
    if (count > 5) assert.ok(heatmap.includes(`产物中还有 ${count - 5} 个公开案例标识`));
    else assert.doesNotMatch(heatmap, /产物中还有/u);
    assert.ok(final(renderTrialsPage(changed, "zh-CN")).includes(identity.split("@")[0] ?? ""));
    // 未来 schema 仅作为显示层 fixture；Data 页的版本审查守卫仍须拒绝它。
    const future = { ...changed, benchmark: { ...changed.benchmark, schemaVersion: count } } as unknown as PublicBenchmarkArtifacts;
    const dossier = final(renderTrialDetailPage(future, "zh-CN"));
    assert.ok(dossier.includes(`${identity} · ${count} 个公开案例 · 产物 schema ${count}。`));
    assert.throws(() => renderDataIndexPage(future, "zh-CN"), /explicitly version and review/u);
  }
});

test("LC-20/21: all 19 strong labels and all four quotes use existing translations before punctuation", async () => {
  let labelCount = 0;
  for (const post of BLOG_POSTS) {
    const zh = await html(post.route);
    const en = await html(post.route, "en");
    const labels = post.sections.flatMap(section => section.progression?.map(item => item.label) ?? []);
    for (const label of labels) {
      labelCount += 1;
      assert.ok(en.includes(`<strong>${escapeHtml(label)}:</strong>`));
      assert.ok(!zh.includes(`<strong>${escapeHtml(label)}:</strong>`));
    }
    const progression = [...zh.matchAll(/<ul class="article-progression">([\s\S]*?)<\/ul>/gu)].map(match => match[1] ?? "").join("");
    const translated = [...progression.matchAll(/<strong>([^<]+)<\/strong>/gu)].map(match => match[1] ?? "");
    assert.equal(translated.length, labels.length);
    for (const label of translated) assert.match(label, /\p{Script=Han}.*：$/u);
    const quote = zh.match(/class="article-pull-quote"><p>(.*?)<\/p>/u)?.[1];
    assert.ok(quote);
    assert.match(quote, /^“.*\p{Script=Han}.*”$/u);
    assert.ok(!quote.includes(escapeHtml(post.pullQuote)));
    assert.ok(en.includes(`“${escapeHtml(post.pullQuote)}”`));
    if (post.pullQuote.includes("may")) assert.match(quote, /可能|也许/u);
  }
  assert.equal(labelCount, 19);
});

test("LC-22: home dates are formatted by locale with stable UTC calendar dates", async () => {
  const zh = await html("/");
  const en = await html("/", "en");
  for (const post of BLOG_POSTS.slice(0, 2)) {
    assert.ok(zh.includes(`观点 · ${formatPublicationDate(post.publishedDate, "zh-CN")}`));
    assert.ok(en.includes(`Perspective · ${post.publishedDate}`));
  }
  for (const [source, enDate, zhDate] of [["2031-01-01", "January 1, 2031", "2031年1月1日"], ["2040-02-29", "February 29, 2040", "2040年2月29日"], ["December 31, 2029", "December 31, 2029", "2029年12月31日"]]) {
    assert.ok(source && enDate && zhDate);
    for (const zone of ["Pacific/Kiritimati", "America/Los_Angeles", "UTC"]) {
      const previous = process.env.TZ;
      try {
        process.env.TZ = zone;
        assert.equal(formatPublicationDate(source, "en"), enDate);
        const first = BLOG_POSTS[0];
        assert.ok(first);
        const posts = [{ ...first, publishedDate: source }];
        assert.ok(final(renderHomePage(artifacts, "zh-CN", posts)).includes(`观点 · ${zhDate}`));
        assert.ok(final(renderHomePage(artifacts, "en", posts), "en").includes(`Perspective · ${enDate}`));
      } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
    }
  }
  for (const value of ["2041-02-29", "2026-13-01", "2026-01-00", "invalid"]) assert.throws(() => formatPublicationDate(value, "zh-CN"), /Invalid publication date/u);
});

test("LC-23: shared footer is Chinese in every final static route", async () => {
  async function visit(directory: string): Promise<void> {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, item.name);
      if (item.isDirectory()) await visit(path);
      else if (item.name.endsWith(".html")) {
        const markup = await readFile(path, "utf8");
        assert.match(markup, /home-footer-bottom"><span>Teachometry · <span>开发者预览<\/span>/u);
        assert.doesNotMatch(markup, /Teachometry · Developer Preview<\/span>/u);
      }
    }
  }
  await visit(join(output, "zh-cn"));
});

class DomElement {
  hidden = false;
  textContent = "";
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, () => void>();
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  addEventListener(name: string, callback: () => void): void { this.listeners.set(name, callback); }
  focus(): void { /* No layout engine needed for the search state transition. */ }
}
class DomInput extends DomElement { value = ""; }
class DomButton extends DomElement {}

test("LC-35: actual Docs script searches the final localized index, aliases and original filenames", async () => {
  const script = await readFile(join(output, "assets", "site.js"), "utf8");
  const docsScript = script.match(/\(\(\) => \{\s+const docsPage = document.querySelector\('\.docs-page'\);[\s\S]*?\n\}\)\(\);/u)?.[0];
  assert.ok(docsScript);
  for (const locale of ["en", "zh-CN"] as const) {
    const markup = await html("/docs/", locale);
    const entries = [...markup.matchAll(/<article class="docs-index-entry"[^>]*data-doc-search="([^"]*)"[^>]*>([\s\S]*?)<\/article>/gu)].map(match => {
      const element = new DomElement();
      element.setAttribute("data-doc-search", match[1] ?? "");
      element.setAttribute("href", match[2]?.match(/href="([^"]*)"/u)?.[1] ?? "");
      if (locale === "zh-CN") {
        const visible = match[2]?.match(/<strong>(.*?)<\/strong><span>(.*?)<\/span>/u);
        assert.ok(visible);
        for (const value of visible.slice(1)) assert.ok((match[1] ?? "").includes(value));
        const group = match[2]?.match(/class="docs-index-category">(.*?)<\/span>/u)?.[1];
        assert.ok(group && (match[1] ?? "").includes(group));
      }
      return element;
    });
    const input = new DomInput();
    const clear = new DomButton();
    const status = new DomElement();
    const empty = new DomElement();
    const nodes = new Map([["[data-doc-search]", input], ["[data-doc-search-clear]", clear], ["[data-doc-status]", status], ["[data-doc-empty]", empty]]);
    class DocsPage extends DomElement {
      querySelector(selector: string): DomElement | null { return nodes.get(selector) ?? null; }
      querySelectorAll(selector: string): readonly DomElement[] { return selector === "[data-doc-entry]" ? entries : []; }
    }
    runInNewContext(docsScript, { document: { querySelector: () => new DocsPage() }, HTMLElement: DomElement, HTMLInputElement: DomInput, HTMLButtonElement: DomButton, activeSiteLocale: locale });
    const search = (query: string): readonly string[] => {
      input.value = query;
      input.listeners.get("input")?.();
      return entries.filter(entry => !entry.hidden).map(entry => entry.getAttribute("href") ?? "");
    };
    const frozen = search("frozen");
    assert.ok(frozen.some(href => href.endsWith("docs/frozen-corpus-semantic-replay.md")));
    if (locale === "zh-CN") {
      const chinese = search("冻结");
      for (const href of frozen) assert.ok(chinese.includes(href));
    }
    assert.deepEqual(search("frozen-corpus-semantic-replay"), frozen);
    assert.deepEqual(search("no-such-reference-93817"), []);
    assert.equal(empty.hidden, false);
    clear.listeners.get("click")?.();
    assert.equal(entries.filter(entry => !entry.hidden).length, entries.length);
    assert.equal(empty.hidden, true);
  }
});

test("Phase 2 preserves JSON bytes, source case content, machine IDs and CLI code", async () => {
  for (const key of ["benchmark", "cases", "models", "trials"] as const) {
    assert.equal(await readFile(join(output, "public-data", key + ".json"), "utf8"), JSON.stringify(artifacts[key], null, 2) + "\n");
  }
  for (const item of artifacts.cases.cases) {
    const zh = await html(`/data/cases/${item.id}/`);
    const en = await html(`/data/cases/${item.id}/`, "en");
    for (const value of [item.id, item.version, item.tutorInput.studentMessage, item.tutorInput.learningObjective, ...(item.tutorInput.conversationHistory ?? []).map(message => message.text)]) {
      assert.ok(zh.includes(escapeHtml(value)), item.id);
      assert.ok(en.includes(escapeHtml(value)), item.id);
    }
  }
  const codes = (markup: string): readonly string[] => [...markup.matchAll(/<code\b[^>]*>([\s\S]*?)<\/code>/gu)].map(match => match[1] ?? "");
  for (const route of ["/run/", "/docs/", "/data/trials/", "/data/trials/[trialId]/"]) assert.deepEqual(codes(await html(route)), codes(await html(route, "en")), route);
  const script = await readFile(join(output, "assets", "site.js"), "utf8");
  assert.doesNotMatch(script, /applyLocale\(|MutationObserver|locale-zh-cn\.js/u);
});
