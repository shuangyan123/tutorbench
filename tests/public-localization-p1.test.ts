import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildWebsite } from "../src/cli/website-build.js";
import { TUTOR_EVAL_DATASET_ID } from "../src/contracts/index.js";
import { buildPublicBenchmarkArtifacts, loadTutorEvalDataset, type PublicBenchmarkArtifacts } from "../src/datasets/index.js";
import { escapeHtml, humanize, renderPage } from "../src/site/html.js";
import { displayTaxonomyLabel, formatTeachingSituations } from "../src/site/public-localization.js";
import { renderDataIndexPage } from "../src/site/pages/benchmark.js";
import { renderCasesPage, renderCaseDetailPage } from "../src/site/pages/data.js";
import { renderHomePage } from "../src/site/pages/home.js";
import { renderLeaderboardPage, renderModelsPage, renderModelDetailPage } from "../src/site/pages/overview.js";
import { renderRunPage } from "../src/site/pages/developer.js";

let outputDirectory: string;
let artifacts: PublicBenchmarkArtifacts;
let serializedArtifacts: string;

before(async () => {
  artifacts = buildPublicBenchmarkArtifacts(await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID));
  serializedArtifacts = JSON.stringify(artifacts);
  outputDirectory = await mkdtemp(join(tmpdir(), "tutorbench-localization-p1-"));
  await buildWebsite({ outputDirectory, siteUrl: "https://teachometry.com" });
});

after(async () => {
  if (outputDirectory !== undefined) await rm(outputDirectory, { recursive: true, force: true });
});

function html(route: string): Promise<string> {
  return readFile(join(outputDirectory, route === "/" ? "index.html" : route.slice(1) + "index.html"), "utf8");
}

function main(markup: string): string {
  const result = markup.match(/<main\b[^>]*>([\s\S]*?)<\/main>/u)?.[1];
  assert.ok(result);
  return result;
}

function h1(markup: string): string {
  const result = markup.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/u)?.[1];
  assert.ok(result);
  return result;
}

function advanced(markup: string): string {
  const result = markup.match(/<section\b[^>]*data-run-panel="advanced"[^>]*>([\s\S]*?)<\/section>/u)?.[1];
  assert.ok(result);
  return result;
}

function codeBlocks(markup: string): readonly string[] {
  return [...markup.matchAll(/<code\b[^>]*>([\s\S]*?)<\/code>/gu)].map((match) => match[1] ?? "");
}

test("LC-01: realistic scenarios remain authored/synthetic rather than real-world evidence", async () => {
  const en = main(await html("/data/"));
  const zh = main(await html("/zh-cn/data/"));
  assert.match(en, /support learners in realistic scenarios/u);
  assert.match(en, /realistic scenarios\./u);
  assert.match(zh, /在贴近真实教学的情境中/u);
  assert.match(zh, /仿真教学情境/u);
  assert.doesNotMatch(zh, /真实情境|真实课堂情境|真实学生情境/u);
  assert.match(zh, /人工编写的数据集，而不是教学效果或学习结果/u);
});

test("LC-02: first static HTML has a Chinese heading and arbitrary counts stay dynamic", async () => {
  const en = await html("/data/cases/");
  const zh = await html("/zh-cn/data/cases/");
  assert.match(h1(en), /48 teaching<br>situations\./u);
  assert.match(h1(zh), /48 个教学情境。<br><em>一套基准。/u);
  assert.doesNotMatch(h1(zh), /teaching|benchmark/u);
  const first = artifacts.cases.cases[0];
  assert.ok(first);
  for (const count of [0, 1, 7, 71]) {
    assert.equal(formatTeachingSituations(count, "zh-CN"), count + " 个教学情境。");
    const cases = Array.from({ length: count }, (_, index) => ({ ...first, id: "count-fixture-" + index }));
    const changed = { ...artifacts, cases: { ...artifacts.cases, cases } };
    const zhHeading = h1(renderPage(renderCasesPage(changed, "zh-CN"), { locale: "zh-CN" }));
    const enHeading = h1(renderPage(renderCasesPage(changed, "en"), { locale: "en" }));
    assert.ok(zhHeading.includes(count + " 个教学情境。"));
    assert.ok(enHeading.includes(count + " teaching"));
    assert.doesNotMatch(zhHeading, /teaching情境/u);
  }
});

test("LC-03/04: leaderboard boundaries and dynamic comparison context are statically Chinese", async () => {
  const en = main(await html("/leaderboard/"));
  const zh = main(await html("/zh-cn/leaderboard/"));
  for (const source of [
    "No public model rankings are available in the current public artifact.",
    "Synthetic demonstrations and preliminary model artifacts are not public rankings.",
    "Compare models only within the same benchmark version and evaluation configuration.",
    "not general classroom teaching effectiveness.",
    "Look beyond the overall score.",
  ]) {
    assert.ok(en.includes(source));
    assert.ok(!zh.includes(source));
  }
  for (const translated of [
    "当前公开产物尚未提供模型排名。",
    "目前尚无校准后的公开模型运行记录。",
    "校准与验证证据仍不完整。",
    "合成演示和初步模型产物不构成公开排名。",
    "仅在相同基准版本和评测配置下比较模型。",
    "不代表一般课堂教学有效性。",
    "不要只看总分。",
    "正确性、诊断能力、引导能力、适应能力、可执行性",
  ]) assert.ok(zh.includes(translated), translated);
  const changed = { ...artifacts, benchmark: { ...artifacts.benchmark, dataset: { ...artifacts.benchmark.dataset, version: "future-version" } } };
  const dynamic = renderLeaderboardPage(changed, "zh-CN").content;
  assert.match(dynamic, /数据集 future-version/u);
  assert.match(dynamic, /数据集案例组、生成规格 ID、生成规格版本、Prompt 版本/u);
});

test("LC-05: model profiles and placeholder trials retain matched-context and non-ranking boundaries", async () => {
  const en = main(await html("/models/"));
  const zh = main(await html("/zh-cn/models/"));
  const enDetail = main(await html("/models/[modelId]/"));
  const zhDetail = main(await html("/zh-cn/models/[modelId]/"));
  assert.match(en, /Future model profiles should be interpreted only within matched benchmark versions/u);
  assert.match(en, /Profiles are evidence records, not rankings/u);
  assert.match(enDetail, /Trial records are the audit path/u);
  assert.match(zh, /基准版本、数据集案例组、生成条件和评测程序相匹配/u);
  assert.match(zh, /档案是证据记录，不是排名/u);
  assert.match(zh, /不衡量长期学习增益、知识留存、迁移、学生满意度或一般课堂教学有效性/u);
  assert.match(zhDetail, /目前尚无公开模型评测记录/u);
  assert.match(zhDetail, /未来结果追溯到案例、Tutor 回复、评估器证据和已脱敏指标的审计路径/u);
  assert.doesNotMatch(zh + zhDetail, /Future model profiles should|Profiles are evidence records|Trial records are the audit path/u);
  assert.ok(zhDetail.includes(artifacts.benchmark.dataset.id + "@" + artifacts.benchmark.dataset.version));
});

test("LC-06: Advanced evidence boundaries are Chinese while controls and commands remain identical", async () => {
  const en = advanced(await html("/run/"));
  const zh = advanced(await html("/zh-cn/run/"));
  assert.match(en, /Collection is not publication, calibration, or leaderboard eligibility/u);
  assert.match(zh, /采集不等于发布、校准或取得排行榜资格/u);
  assert.match(zh, /冻结证据可以离线检查和重放/u);
  assert.match(zh, /不约束可选的 temperature、reasoning 和 seed 控制项/u);
  assert.match(zh, /Tutor 可见的语义适配器数据包/u);
  assert.match(zh, /两者均不包含仅供评估器使用的注释/u);
  assert.match(zh, /不意味着每个服务提供方都提供相同的推理控制项/u);
  assert.doesNotMatch(zh, /Collection is not publication|Neither packet includes evaluator-only/u);
  for (const identity of ["baseline-native-default", "temperature", "reasoning", "seed", "tutor:export-cases", "tutor:export-execution"]) {
    assert.ok(en.includes(identity));
    assert.ok(zh.includes(identity));
  }
  assert.deepEqual(codeBlocks(zh), codeBlocks(en));
});

test("LC-07: all current taxonomy values have Chinese display labels without changing machine values", async () => {
  const coverage = artifacts.benchmark.coverage;
  const groups = [
    coverage.casesBySubject, coverage.casesByLearnerLevel, coverage.casesByStudentState,
    coverage.casesByCapabilityTag, coverage.casesByLearningTask, coverage.casesByDisclosurePolicy,
  ];
  for (const value of new Set(groups.flatMap((group) => Object.keys(group)))) {
    assert.equal(displayTaxonomyLabel(value, "en"), humanize(value));
    assert.match(displayTaxonomyLabel(value, "zh-CN"), /\p{Script=Han}/u, value);
  }
  const enCases = main(await html("/data/cases/"));
  const zhCases = main(await html("/zh-cn/data/cases/"));
  for (const translated of ["数学", "初中", "小学高年级", "初学者", "概念误解", "识别概念误解", "仅提供提示"]) {
    assert.ok(zhCases.includes(translated), translated);
  }
  const zhData = main(await html("/zh-cn/data/"));
  assert.match(zhData, /引导式解题/u);
  for (const group of groups) {
    for (const value of Object.keys(group)) assert.ok(zhData.includes(displayTaxonomyLabel(value, "zh-CN")), value);
  }
  assert.match(main(await html("/zh-cn/")), /初中 · 数学/u);
  assert.match(main(await html("/zh-cn/leaderboard/")), /历史或社会研究/u);
  assert.match(main(await html("/data/")), />Mathematics</u);
  const filters = (markup: string): readonly string[] => [...markup.matchAll(/<input\b[^>]*data-case-filter="[^"]+"[^>]*value="[^"]*"[^>]*>/gu)]
    .map((match) => match[0]).sort();
  const machineAttributes = (markup: string): readonly string[] => [...markup.matchAll(/\bdata-case-(?:id|locale|subject|learner-level|task-difficulty|pedagogical-difficulty|capabilities|student-state|disclosure-policy|search-text)="[^"]*"/gu)]
    .map((match) => match[0]);
  assert.deepEqual(filters(zhCases), filters(enCases));
  assert.deepEqual(machineAttributes(zhCases), machineAttributes(enCases));
  for (const caseArtifact of artifacts.cases.cases) {
    const detail = main(await html("/zh-cn/data/cases/" + encodeURIComponent(caseArtifact.id) + "/"));
    assert.ok(detail.includes(displayTaxonomyLabel(caseArtifact.metadata.subject, "zh-CN")));
    const difficulty = caseArtifact.metadata.difficulty;
    const labels = [
      ...(typeof difficulty === "object" && difficulty !== null ? [difficulty.learnerLevel] : []),
      ...(caseArtifact.metadata.studentState === undefined ? [] : [caseArtifact.metadata.studentState]),
      ...(caseArtifact.disclosurePolicy === undefined ? [] : [caseArtifact.disclosurePolicy]),
      ...(caseArtifact.metadata.capabilityTags ?? []),
    ];
    for (const value of labels) assert.ok(detail.includes(displayTaxonomyLabel(value, "zh-CN")), caseArtifact.id + ": " + value);
    assert.ok(detail.includes(escapeHtml(caseArtifact.id)));
    assert.ok(detail.includes(escapeHtml(caseArtifact.tutorInput.studentMessage)));
    assert.ok(detail.includes(escapeHtml(caseArtifact.tutorInput.learningObjective)));
    for (const message of caseArtifact.tutorInput.conversationHistory ?? []) assert.ok(detail.includes(escapeHtml(message.text)));
    assert.ok(detail.includes('lang="' + (caseArtifact.locale ?? "en") + '"'));
  }
});

test("LC-07: locale rendering preserves public JSON bytes and never mutates source artifacts", async () => {
  for (const key of ["benchmark", "cases", "models", "trials"] as const) {
    const bytes = await readFile(join(outputDirectory, "public-data", key + ".json"), "utf8");
    assert.equal(bytes, JSON.stringify(artifacts[key], null, 2) + "\n");
  }
  for (const locale of ["en", "zh-CN"] as const) {
    for (const renderer of [renderHomePage, renderDataIndexPage, renderCasesPage, renderLeaderboardPage, renderModelsPage, renderModelDetailPage, renderRunPage]) {
      renderPage(renderer(artifacts, locale), { locale });
    }
    for (const item of artifacts.cases.cases) renderPage(renderCaseDetailPage(artifacts, item, locale), { locale });
    assert.equal(JSON.stringify(artifacts), serializedArtifacts);
  }
  const first = artifacts.cases.cases[0];
  assert.ok(first);
  const injected = { ...first, metadata: { ...first.metadata, subject: '<img src=x onerror="alert(1)">' } };
  const safe = renderCaseDetailPage(artifacts, injected, "zh-CN").content;
  assert.match(safe, /&lt;Img/u);
  assert.doesNotMatch(safe, /<img src=x/iu);
});

test("English and zh-CN routes keep static locale navigation and shared resources", async () => {
  const routes = ["/", "/data/", "/data/cases/", "/leaderboard/", "/models/", "/models/[modelId]/", "/run/",
    ...artifacts.cases.cases.map((item) => "/data/cases/" + encodeURIComponent(item.id) + "/")];
  for (const route of routes) {
    const en = await html(route);
    const zh = await html("/zh-cn" + route);
    assert.match(en, /<html lang="en" data-ui-locale="en">/u);
    assert.match(zh, /<html lang="zh-CN" data-ui-locale="zh-CN">/u);
    for (const link of [...main(zh).matchAll(/<a\b[^>]*href="(\/[^"]*)"/gu)].map((match) => match[1] ?? "")) {
      assert.ok(link.startsWith("/zh-cn/") || link.startsWith("/assets/") || link.startsWith("/public-data/"), link);
    }
    assert.doesNotMatch(main(en), /<a\b[^>]*href="\/zh-cn\//u);
    assert.doesNotMatch(zh, /(?:href|src)="\/zh-cn\/(?:assets|public-data)\//u);
    assert.ok(zh.includes('data-locale-en-url="' + route + '"'));
    assert.ok(zh.includes('data-locale-zh-cn-url="/zh-cn' + route + '"'));
    assert.doesNotMatch(zh, /locale-zh-cn\.js/u);
  }
});
