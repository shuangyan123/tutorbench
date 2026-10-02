import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildWebsite } from "../src/cli/website-build.js";
import { TUTOR_EVAL_DATASET_ID } from "../src/contracts/index.js";
import { buildPublicBenchmarkArtifacts, loadTutorEvalDataset, type PublicBenchmarkArtifacts } from "../src/datasets/index.js";
import { escapeHtml, humanize, renderPage } from "../src/site/html.js";
import type { SiteLocale } from "../src/site/i18n.js";
import { BLOG_POSTS } from "../src/site/pages/blog.js";
import { renderCaseDetailPage, renderCasesPage } from "../src/site/pages/data.js";
import { renderHomePage } from "../src/site/pages/home.js";

let output: string;
let artifacts: PublicBenchmarkArtifacts;
const deployments = [
  { name: "root", url: "https://teachometry.com", basePath: "" },
  { name: "project", url: "https://example.test/tutorbench", basePath: "/tutorbench" },
] as const;
const routes = ["/", "/blog/", ...BLOG_POSTS.map(post => post.route), "/models/", "/models/[modelId]/", "/leaderboard/", "/run/", "/community/", "/methodology/", "/docs/", "/data/cases/", "/data/heatmap/", "/data/trials/", "/data/trials/[trialId]/"];

before(async () => {
  artifacts = buildPublicBenchmarkArtifacts(await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID));
  output = await mkdtemp(join(tmpdir(), "tutorbench-localization-final-"));
  for (const deployment of deployments) {
    await buildWebsite({ outputDirectory: join(output, deployment.name), siteUrl: deployment.url, basePath: deployment.basePath });
  }
});
after(async () => { if (output !== undefined) await rm(output, { recursive: true, force: true }); });

function html(route: string, locale: SiteLocale = "zh-CN", deployment = "root"): Promise<string> {
  return readFile(join(output, deployment, locale === "zh-CN" ? "zh-cn" : "", route.slice(1), "index.html"), "utf8");
}
function text(markup: string): string { return markup.replace(/<[^>]*>/gu, "").replace(/\s+/gu, " ").trim(); }
function code(markup: string): string[] { return [...markup.matchAll(/<code\b[^>]*>([\s\S]*?)<\/code>/gu)].map(match => match[1] ?? ""); }

test("LC-36: article title is consistent in headings, references, navigation and metadata; English stays original", async () => {
  const title = "当学习开始让人感到失败";
  const route = "/blog/when-learning-starts-to-feel-like-failure/";
  for (const deployment of deployments) {
    const zhArticle = await html(route, "zh-CN", deployment.name);
    assert.ok(zhArticle.includes(`<h1 id="article-title">${title}</h1>`));
    assert.ok(zhArticle.includes(`"headline":"${title}"`));
    assert.ok(zhArticle.includes(`<title>${title} — Teachometry 博客</title>`));
    let references = 0;
    let navigationNames = 0;
    for (const surface of ["/", "/blog/", ...BLOG_POSTS.map(post => post.route)]) {
      const en = await html(surface, "en", deployment.name);
      const zh = await html(surface, "zh-CN", deployment.name);
      assert.doesNotMatch(zh, /当学习开始像失败一样/u);
      if (en.includes("When Learning Starts to Feel Like Failure")) {
        references += 1;
        assert.ok(zh.includes(title), surface);
      }
      const direction = en.match(/aria-label="(Previous|Next) article: When Learning Starts to Feel Like Failure"/u)?.[1];
      if (direction !== undefined) {
        navigationNames += 1;
        assert.ok(zh.includes(`aria-label="${direction === "Previous" ? "上一篇文章" : "下一篇文章"}：${title}"`));
      }
    }
    assert.ok(references >= 4);
    assert.equal(navigationNames, 1);
    assert.ok((await html(route, "en", deployment.name)).includes('<h1 id="article-title">When Learning Starts to Feel Like Failure</h1>'));
  }
});

test("LC-37–41: complete natural copy preserves fail-closed, human availability and modal evidence boundaries", async () => {
  for (const deployment of deployments) {
    const read = (route: string, locale: SiteLocale = "zh-CN"): Promise<string> => html(route, locale, deployment.name);
    assert.ok(text(await read("/models/")).includes("面向 AI 教学的透明模型证据目录。"));
    assert.ok(text(await read("/leaderboard/")).includes("让 AI 教学拥有更透明的未来。"));
    assert.ok((await read("/models/", "en")).includes("A transparent catalog<br>of <em>model evidence</em><br>for AI tutoring."));
    assert.ok((await read("/leaderboard/", "en")).includes("A more<br>transparent future<br>for AI tutoring."));
    const run = await read("/run/");
    assert.ok(run.includes("证据不可用时，系统应停止评分并明确报告证据缺失（fail closed），而不是静默生成一个看似有效的分数。"));
    assert.ok((await read("/run/", "en")).includes("When evidence is unavailable, the system should fail closed rather than silently invent a valid score."));
    assert.ok(run.includes("所需证据不可用时不报告分数"));
    const community = await read("/community/");
    assert.ok(community.includes("以及大致可参与的时间范围。"));
    assert.ok(community.includes(">可参与时间档位</span>"));
    assert.ok(community.includes("当前尚未开放申请。本节说明未来的申请数据约定，不是申请表。"));
    assert.doesNotMatch(community, /<(?:form|input|textarea)\b/u);
    const methodology = await read("/methodology/");
    assert.ok(methodology.includes("结构清晰，便于复现。"));
    assert.ok((await read("/methodology/", "en")).includes("Structured enough to reproduce."));
    const blog = await read("/blog/why-teaching-does-not-scale/");
    assert.ok(blog.includes("教学或许可以通过增加计算资源来扩展。"));
    assert.ok((await read("/blog/why-teaching-does-not-scale/", "en")).includes("Teaching could become computationally scalable."));
    assert.doesNotMatch(run + community + methodology + blog + await read("/models/") + await read("/leaderboard/"), /属于 AI 教学|关闭式失败|粗粒度的可用程度|结构化到足以被复现|可计算地扩展/u);
  }
});

test("LC-42: public terminology is normalized while formal names, CLI and raw field identities remain", async () => {
  const checks: Readonly<Record<string, readonly string[]>> = {
    "/models/": ["数据集案例组", "模型登记目录", "服务提供方", "校准后的公开模型运行记录"],
    "/models/[modelId]/": ["证据档案", "模型评测记录", "案例组", "目前尚无校准后的公开模型运行记录。"],
    "/run/": ["以发现项为先", "Release Gate、发现项与回归目标", "服务提供方", "透明评测", "Tutor Health", "TutorTurnInput"],
    "/community/": ["Community Review", "参考真值", "评分标准", "Human Reference"],
    "/methodology/": ["Semantic Judge", "评分标准", "参考真值"],
    "/data/cases/": ["案例"],
    "/data/trials/": ["评测记录", "id、modelId、caseId 和 runIndex"],
    "/data/trials/[trialId]/": ["证据档案", "评测记录", "评分标准、Judge 与指标"],
  };
  for (const [route, terms] of Object.entries(checks)) {
    const zh = await html(route);
    for (const term of terms) assert.ok(zh.includes(term), `${route}: ${term}`);
    assert.deepEqual(code(zh), code(await html(route, "en")), route);
  }
  const contract = await readFile("src/contracts/tutor-health.ts", "utf8");
  assert.match(contract, /export interface TutorFinding \{/u);
  assert.match(contract, /readonly findings: readonly TutorFinding\[\]/u);
  assert.ok(artifacts.trials.fields.includes("rubricResults"));
  assert.ok(artifacts.models.fields.includes("provider"));
  assert.ok(artifacts.trials.fields.includes("runIndex"));
  assert.ok((await html("/run/")).includes("--tutor-provider"));
  assert.ok((await html("/run/")).includes("--tutor-model"));
});

test("LC-43: all 48 final case pages retain source content, versions and case locale in both deployments", async () => {
  const original = JSON.stringify(artifacts);
  assert.equal(artifacts.cases.cases.length, 48);
  assert.equal(artifacts.cases.cases.filter(item => item.locale === "en").length, 24);
  assert.equal(artifacts.cases.cases.filter(item => item.locale === "zh-CN").length, 24);
  for (const deployment of deployments) {
    for (const item of artifacts.cases.cases) {
      for (const locale of ["en", "zh-CN"] as const) {
        const markup = await html(`/data/cases/${item.id}/`, locale, deployment.name);
        for (const value of [item.id, item.version, humanize(item.metadata.topic), item.tutorInput.learningObjective, item.tutorInput.studentMessage, item.tutorInput.problemContext, ...(item.tutorInput.conversationHistory ?? []).map(message => message.text)]) {
          if (value !== undefined) assert.ok(markup.includes(escapeHtml(value)), `${locale}: ${item.id}: ${value}`);
        }
        assert.ok(markup.includes(`<p data-source-content lang="${item.locale ?? "en"}">${escapeHtml(item.tutorInput.studentMessage)}</p>`));
        assert.ok(markup.includes(`data-ui-locale="${locale}"`));
      }
    }
  }
  assert.equal(JSON.stringify(artifacts), original);
});

test("LC-43: dictionary collisions never translate authored messages, objectives, topic, profile or history", () => {
  const first = artifacts.cases.cases[0];
  assert.ok(first);
  const item = { ...first, id: "Evidence", version: "Provider", locale: "en" as const,
    metadata: { ...first.metadata, topic: "Benchmark" },
    tutorInput: { learningObjective: "Structured enough to reproduce.", studentMessage: "When Learning Starts to Feel Like Failure", problemContext: "Teaching could become computationally scalable.",
      studentProfile: { goal: "Evidence", knownConcepts: ["Provider"] },
      conversationHistory: [{ role: "student" as const, text: "Provider" }, { role: "tutor" as const, text: "Judge ≠ ground truth" }] },
  };
  const changed = { ...artifacts, cases: { ...artifacts.cases, cases: [item] } };
  const original = JSON.stringify(changed);
  const detail = renderPage(renderCaseDetailPage(changed, item, "zh-CN"), { locale: "zh-CN" });
  assert.ok(detail.includes('<title>Benchmark — Teachometry</title>'));
  assert.ok(detail.includes('<h1 id="case-detail-title" data-source-content>Benchmark</h1>'));
  for (const value of [item.id, item.version, item.tutorInput.learningObjective, item.tutorInput.studentMessage, item.tutorInput.problemContext, ...item.tutorInput.conversationHistory.map(message => message.text)]) {
    assert.ok(detail.includes(escapeHtml(value)), value);
  }
  assert.ok(detail.includes('<dd data-source-content>Provider</dd>'));
  const missingProfile = { ...item, tutorInput: { ...item.tutorInput, studentProfile: {} } };
  const missingMarkup = renderPage(renderCaseDetailPage(changed, missingProfile, "zh-CN"), { locale: "zh-CN" });
  assert.ok(missingMarkup.includes('<dd data-source-content>未指定</dd>'));
  for (const page of [renderHomePage(changed, "zh-CN"), renderCasesPage(changed, "zh-CN")]) {
    const markup = renderPage(page, { locale: "zh-CN" });
    for (const value of ["Benchmark", item.tutorInput.studentMessage, item.tutorInput.learningObjective]) assert.ok(markup.includes(value), value);
  }
  assert.equal(JSON.stringify(changed), original);
});

test("LC-43: localized documentation labels keep original links and filename provenance", async () => {
  for (const deployment of deployments) {
    const en = await html("/docs/", "en", deployment.name);
    const zh = await html("/docs/", "zh-CN", deployment.name);
    const sourceLinks = (markup: string): string[] => [...markup.matchAll(/href="(https:\/\/github.com\/shuangyan123\/tutorbench\/blob\/main\/[^"]+)"/gu)].map(match => match[1] ?? "");
    assert.deepEqual(sourceLinks(zh), sourceLinks(en));
    assert.ok(sourceLinks(zh).length >= 10);
    const paths = (markup: string): string[] => [...markup.matchAll(/<span data-source-content>([^<]+)<\/span>/gu)].map(match => match[1] ?? "");
    assert.deepEqual(paths(zh), paths(en));
    assert.ok(paths(zh).includes("docs/quickstart.md"));
    assert.ok(paths(zh).includes("CONTRIBUTING.md"));
    assert.ok(zh.includes(">贡献指南</strong>"));
  }
});

test("Final deployment integrity: canonical, hreflang, sitemap, route destinations and baseline public JSON bytes", async () => {
  // PR #252 的指定基线 b399d3a 上生成的原始 UTF-8 文件（包括最后换行）。
  const baselineHashes = {
    benchmark: "73cf93f238ab1bca53c4c4bceaaf54ce832bd50bd0560f33fc433721ef727c8e",
    cases: "8b5b74728ed93b19de3cfda2dc468ce826b0b709fc08cb81d1eb9a85ea0a0e44",
    models: "25e5aadd4150dd607decc14877dd0fd475082398a0b8c6e0d39f49aabc97d8f4",
    trials: "76e5f24f3432b7ba257e3e6e05a87ed848cef457129ae81f8cbbaaa64c091155",
  } as const;
  for (const deployment of deployments) {
    const sitemap = await readFile(join(output, deployment.name, "sitemap.xml"), "utf8");
    for (const route of [...routes, ...artifacts.cases.cases.map(item => `/data/cases/${item.id}/`)]) {
      for (const locale of ["en", "zh-CN"] as const) {
        const markup = await html(route, locale, deployment.name);
        const localRoute = `${locale === "zh-CN" ? "/zh-cn" : ""}${route}`;
        assert.ok(markup.includes(`<link rel="canonical" href="${deployment.url}${localRoute}">`));
        // 未解析的占位详情保持 noindex，不要求进入 sitemap。
        if (!route.includes("[")) assert.ok(sitemap.includes(`<loc>${deployment.url}${localRoute}</loc>`));
        if (!route.includes("[")) for (const language of ["en", "zh-CN", "x-default"]) {
          assert.ok(markup.includes(`<link rel="alternate" hreflang="${language}" href="${deployment.url}${language === "zh-CN" ? "/zh-cn" : ""}${route}">`));
        }
        assert.ok(markup.includes(`data-locale-en-url="${deployment.basePath}${route}"`));
        assert.ok(markup.includes(`data-locale-zh-cn-url="${deployment.basePath}/zh-cn${route}"`));
        assert.doesNotMatch(markup, /locale-bundle|applyLocale|MutationObserver/u);
      }
    }
    for (const key of ["benchmark", "cases", "models", "trials"] as const) {
      const bytes = await readFile(join(output, deployment.name, "public-data", `${key}.json`));
      assert.deepEqual(bytes, Buffer.from(JSON.stringify(artifacts[key], null, 2) + "\n"));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), baselineHashes[key]);
    }
    const assets = await readdir(join(output, deployment.name, "assets"));
    assert.ok(!assets.some(asset => /locale|i18n/u.test(asset)));
  }
});
