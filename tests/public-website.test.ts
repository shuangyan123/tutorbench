import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildWebsite } from "../src/cli/website-build.js";
import {
  buildPublicBenchmarkArtifacts,
  loadTutorEvalDataset,
  parsePublicBenchmarkArtifacts,
  PUBLIC_BENCHMARK_GENERATION_TRACEABILITY_FIELDS,
  toPublicTutorEvalCase,
  type PublicBenchmarkArtifacts,
} from "../src/datasets/index.js";
import { TUTOR_EVAL_DATASET_ID, TUTOR_EVAL_EVALUATOR_VERSION } from "../src/contracts/index.js";
import { renderPage, TUTORBENCH_BRAND_ASSET_PATHS } from "../src/site/html.js";
import { renderHomePage } from "../src/site/pages/home.js";

test("homepage derives facts and escapes case content without inventing model results", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadDataset());
  const firstCase = artifacts.cases.cases[0];
  assert.ok(firstCase);
  const content = renderHomePage({
    ...artifacts,
    benchmark: { ...artifacts.benchmark, dataset: { ...artifacts.benchmark.dataset, version: "test-version", caseCount: 71, rubricCount: 233 } },
    cases: { ...artifacts.cases, cases: [{ ...firstCase, tutorInput: { ...firstCase.tutorInput, studentMessage: '<img src=x onerror="alert(1)">' } }] },
  }).content;
  assert.match(content, /<dd>71<\/dd>/);
  assert.match(content, /<dd>233<\/dd>/);
  assert.match(content, /<dd>test-version<\/dd>/);
  assert.ok(content.includes(`<dd>${TUTOR_EVAL_EVALUATOR_VERSION}</dd>`));
  assert.match(content, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.doesNotMatch(content, /<img src=x/);
  assert.match(content, /Not scored · no model run/);
  assert.match(content, /No model response or model score is published here/);
});

test("home reconstruction uses real blog routes and isolates its assets from other pages", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadDataset());
  const page = renderHomePage(artifacts);
  const home = renderPage(page, { basePath: "/preview" });
  assert.match(home, /Teachometry/);
  assert.match(home, /href="\/preview\/assets\/home\.css"/);
  assert.match(home, /href="\/preview\/blog\/why-teaching-does-not-scale\/"/);
  assert.match(home, /href="\/preview\/blog\/teaching-and-supervision-are-different-jobs\/"/);
  assert.match(home, /Explore the journal · Blog index/);
  assert.equal((home.match(/<article class="home-blog-card">/g) ?? []).length, 2);
  assert.match(home, /September 17, 2026/);
  assert.doesNotMatch(home, /Sep 10, 2024|Why Observable Behavior Matters in AI Tutoring/);
  for (const image of ["home-blog-01", "home-blog-02", "home-blog-03", "foliage-left-near", "foliage-left-mid", "foliage-right-mid", "foliage-right-near"]) {
    assert.ok(home.includes(`src="/preview/assets/${image}.webp"`));
  }
  assert.ok(home.indexOf('class="home-data"') < home.indexOf('class="home-blog"'));
  assert.ok(home.indexOf('class="home-blog"') < home.indexOf('class="home-footer"'));
  const other = renderPage({ title: "Cases", description: "Cases", route: "/data/cases/", content: "Cases" });
  assert.doesNotMatch(other, /home\.css|home-blog|home-footer|home-page/);
});

async function loadDataset() {
  return loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID);
}

test("public case serialization omits evaluator-only fields by default", async () => {
  const dataset = await loadDataset();
  const tutorEvalCase = dataset.cases[0];
  assert.ok(tutorEvalCase);

  const publicCase = toPublicTutorEvalCase(tutorEvalCase);
  const serialized = JSON.stringify(publicCase);

  assert.equal(publicCase.disclosurePolicy, undefined);
  assert.equal(publicCase.adaptationPairId, undefined);
  assert.equal("misconceptions" in (publicCase.tutorInput.studentProfile ?? {}), false);
  assert.doesNotMatch(serialized, /evaluatorOnly|groundTruth|knownMisconception|rubrics|misconceptions/);
  assert.equal(publicCase.id, tutorEvalCase.id);
  assert.equal(publicCase.locale, "en");
  assert.equal(publicCase.crossLocaleGroupId, tutorEvalCase.crossLocaleGroupId);
  assert.equal(publicCase.tutorInput.studentMessage, tutorEvalCase.tutorInput.studentMessage);
});

test("development metadata is explicitly opt-in without exposing rubric annotations", async () => {
  const dataset = await loadDataset();
  const tutorEvalCase = dataset.cases[0];
  assert.ok(tutorEvalCase);

  const publicCase = toPublicTutorEvalCase(tutorEvalCase, {
    includeDevelopmentMetadata: true,
  });
  const serialized = JSON.stringify(publicCase);

  assert.equal(publicCase.disclosurePolicy, tutorEvalCase.evaluatorOnly.disclosurePolicy);
  assert.doesNotMatch(serialized, /evaluatorOnly|groundTruth|knownMisconception|rubrics|misconceptions/);
});

test("public artifacts contain the real dataset and no model or trial rankings", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadDataset());
  const serializedCases = JSON.stringify(artifacts.cases);

  assert.equal(artifacts.benchmark.status, "developer-preview");
  assert.equal(artifacts.benchmark.dataset.caseCount, 48);
  assert.equal(artifacts.benchmark.dataset.crossLocaleGroupCount, 24);
  assert.equal(artifacts.cases.cases.length, 48);
  assert.deepEqual(artifacts.benchmark.coverage.casesByLocale, { en: 24, "zh-CN": 24 });
  assert.equal(artifacts.models.available, false);
  assert.equal(artifacts.models.entries.length, 0);
  assert.equal(artifacts.trials.available, false);
  assert.equal(artifacts.trials.entries.length, 0);
  assert.equal(new Set(artifacts.models.fields).size, artifacts.models.fields.length);
  assert.equal(new Set(artifacts.trials.fields).size, artifacts.trials.fields.length);
  for (const field of PUBLIC_BENCHMARK_GENERATION_TRACEABILITY_FIELDS) {
    assert.ok(artifacts.models.fields.includes(field));
    assert.ok(artifacts.trials.fields.includes(field));
  }
  assert.doesNotMatch(serializedCases, /evaluatorOnly|groundTruth|knownMisconception|rubrics|misconceptions/);
  assert.deepEqual(
    artifacts.cases.cases.map((item) => item.id),
    [...artifacts.cases.cases].map((item) => item.id).sort(),
  );
});

test("generated public artifacts pass the runtime read-layer parser", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadDataset());
  const parsed = parsePublicBenchmarkArtifacts(artifacts);
  assert.equal(parsed.cases.datasetId, TUTOR_EVAL_DATASET_ID);
  assert.equal(parsed.benchmark.calibration.independentHumanCalibration, "not_completed");

  const legacyPublicArtifact = JSON.parse(JSON.stringify(artifacts)) as {
    cases: { cases: Array<Record<string, unknown>> };
  };
  delete legacyPublicArtifact.cases.cases[0]?.locale;
  delete legacyPublicArtifact.cases.cases[0]?.crossLocaleGroupId;
  assert.doesNotThrow(() => parsePublicBenchmarkArtifacts(legacyPublicArtifact));

  const tampered = JSON.parse(JSON.stringify(artifacts)) as PublicBenchmarkArtifacts & {
    cases: { cases: Array<Record<string, unknown>> };
  };
  const firstCase = tampered.cases.cases[0];
  assert.ok(firstCase);
  firstCase.groundTruth = { finalAnswer: "secret" };
  assert.throws(() => parsePublicBenchmarkArtifacts(tampered), {
    name: "PublicBenchmarkArtifactError",
  });
});

test("static website build emits the public artifact files and route shell", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "tutor-benchmark-website-"));
  try {
    const routeCount = await buildWebsite({ outputDirectory });
    const casesJson = await readFile(join(outputDirectory, "public-data", "cases.json"), "utf8");
    const homeHtml = await readFile(join(outputDirectory, "index.html"), "utf8");
    const runHtml = await readFile(join(outputDirectory, "run", "index.html"), "utf8");
    const methodologyHtml = await readFile(
      join(outputDirectory, "methodology", "index.html"),
      "utf8",
    );
    const leaderboardHtml = await readFile(
      join(outputDirectory, "leaderboard", "index.html"),
      "utf8",
    );
    const docsHtml = await readFile(join(outputDirectory, "docs", "index.html"), "utf8");
    const communityHtml = await readFile(
      join(outputDirectory, "community", "index.html"),
      "utf8",
    );

    assert.equal(routeCount, 62);
    assert.match(homeHtml, /Developer Preview/);
    assert.match(homeHtml, /No calibrated public model runs yet\./);
    assert.match(homeHtml, /href="\/leaderboard\//);
    assert.match(homeHtml, /href="\/community\//);
    assert.match(homeHtml, /Before we trust<br>AI tutors, <em>measure<\/em>/);
    assert.match(homeHtml, /href="\/data\/cases\/">Explore the Benchmark/);
    assert.match(homeHtml, /href="\/methodology\/">[\s\S]*Read the Methodology/);
    assert.match(homeHtml, /data-case-walkthrough/);
    assert.match(homeHtml, /Illustrative case walkthrough/);
    assert.match(homeHtml, /Not scored · no model run/);
    assert.match(homeHtml, /No model response or model score is published here/);
    assert.equal((homeHtml.match(/data-home-case[ >]/g) ?? []).length, 48);
    assert.equal((homeHtml.match(/data-dimension="[0-4]"/g) ?? []).length, 5);
    assert.ok(homeHtml.indexOf('class="home-hero"') < homeHtml.indexOf('class="home-dimensions"'));
    assert.ok(homeHtml.indexOf('class="home-dimensions"') < homeHtml.indexOf('class="home-data"'));
    assert.match(homeHtml, /Synthetic cases/);
    assert.match(homeHtml, /Authored rubrics/);
    assert.doesNotMatch(homeHtml, /Real tutoring cases|Real educational impact|Community-reviewed|4\.6 \/ 5|>PASS<|>PARTIAL</);
    assert.match(homeHtml, /Human calibration \(P5\) has not started/);
    assert.match(homeHtml, /Judge-vs-human and statistical validation are not completed/);
    assert.match(homeHtml, /real Community Review and human calibration have not started/);
    assert.match(homeHtml, /Judge-vs-human validation and statistical validation are not completed/);
    assert.match(homeHtml, /href="\/assets\/styles\.css"/);
    assert.match(homeHtml, /src="\/assets\/site\.js"/);
    assert.match(homeHtml, /src="\/assets\/brand\/tutorbench\/web\/tutorbench-mark-small\.svg"/);
    assert.match(homeHtml, /TutorBench/);
    assert.match(homeHtml, /Measurement infrastructure/);
    assert.match(homeHtml, /rel="icon" href="\/assets\/brand\/tutorbench\/raster\/favicon\.ico"/);
    assert.match(homeHtml, /rel="icon" type="image\/png" sizes="32x32" href="\/assets\/brand\/tutorbench\/raster\/favicon-32\.png"/);
    assert.deepEqual(
      await readFile(join(outputDirectory, "assets", "foliage.png")),
      await readFile(join(process.cwd(), "website", "src", "images", "foliage.png")),
    );
    for (const name of ["home-hero-bg", "home-open-data-bg", "home-blog-01", "home-blog-02", "home-blog-03", "foliage-left-near", "foliage-left-mid", "foliage-right-mid", "foliage-right-near"]) {
      assert.deepEqual(
        await readFile(join(outputDirectory, "assets", `${name}.webp`)),
        await readFile(join(process.cwd(), "website", "src", "images", `${name}.webp`)),
        `Home build must preserve the supplied asset bytes: ${name}`,
      );
    }
    for (const assetPath of TUTORBENCH_BRAND_ASSET_PATHS) {
      assert.deepEqual(
        await readFile(join(outputDirectory, "assets", "brand", "tutorbench", assetPath)),
        await readFile(join(process.cwd(), "assets", "brand", "tutorbench", assetPath)),
        `Generated brand asset differs from its repository source: ${assetPath}`,
      );
    }
    assert.match(leaderboardHtml, /Results — Teachometry/);
    assert.match(leaderboardHtml, /Not yet published/);
    assert.match(leaderboardHtml, /No public model rows are available yet/);
    assert.match(leaderboardHtml, /results\.css/);
    assert.match(leaderboardHtml, /Readiness and evidence status/);
    assert.match(leaderboardHtml, /No ranking without evidence/);
    assert.match(runHtml, /tutor:export-execution/);
    assert.match(runHtml, /TutorExecutionPacket/);
    assert.match(runHtml, /baseline-native-default/);
    assert.match(runHtml, /Run the provider-free demo/);
    assert.match(runHtml, /npm run quickstart/);
    assert.match(runHtml, /tutor-eval-v0\.1@0\.1/);
    assert.match(runHtml, /Full benchmark/);
    assert.match(runHtml, /Leaderboard.*Not eligible/s);
    assert.match(runHtml, /Controlled optional generation parameters: none/);
    assert.match(runHtml, /Use any language/);
    assert.match(runHtml, /tutorbench run/);
    assert.match(runHtml, /Real-model evidence/);
    assert.match(runHtml, /preliminary, uncalibrated/);
    assert.match(methodologyHtml, /How do you<br>measure <em>teaching/);
    assert.match(methodologyHtml, /methodology\.css/);
    assert.match(methodologyHtml, /Structured case/);
    assert.match(methodologyHtml, /Tutor response/);
    assert.match(methodologyHtml, /Evaluator evidence/);
    assert.match(methodologyHtml, /Atomic rubrics/);
    assert.match(methodologyHtml, /Benchmark result/);
    assert.match(methodologyHtml, /Observable tutoring behavior/);
    for (const dimension of ["Correctness", "Diagnosis", "Guidance", "Adaptation", "Actionability"]) {
      assert.match(methodologyHtml, new RegExp(dimension));
    }
    assert.match(methodologyHtml, /Judge is an evaluator boundary, not ground truth/);
    assert.match(methodologyHtml, /unresolved Judge-required evidence remains unresolved/);
    assert.match(methodologyHtml, /Tutor-visible input ends at the response boundary/);
    assert.match(methodologyHtml, /Evaluator-only annotations stay on the evaluator side/);
    assert.match(methodologyHtml, /Community Review infrastructure/);
    assert.match(methodologyHtml, /Deployment-ready/);
    assert.match(methodologyHtml, /Public reviewer intake remains closed/);
    assert.match(methodologyHtml, /real Community Review campaign has not started/);
    assert.match(methodologyHtml, /Human calibration \(P5\)/);
    assert.match(methodologyHtml, /Judge-vs-human validation/);
    assert.match(methodologyHtml, /Statistical validation/);
    assert.match(methodologyHtml, /Not completed/);
    assert.doesNotMatch(methodologyHtml, /P4 COMMUNITY REVIEW SERVICE.*PASS/);
    assert.doesNotMatch(methodologyHtml, /L1 PRIVATE STAGING.*PASS/);
    assert.doesNotMatch(methodologyHtml, /L2-B PRIVATE STAGING.*PASS/);
    assert.match(docsHtml, /Participation application gate/);
    assert.match(docsHtml, /closed-to-open launch checklist/);
    assert.match(methodologyHtml, /human calibration have not started/);
    assert.match(methodologyHtml, /Judge-vs-human validation and statistical validation are not completed/);
    assert.match(docsHtml, /Community Review protocol/);
    assert.doesNotMatch(docsHtml, /not-yet-deployed P4 service/);
    assert.match(docsHtml, /P4 deployment-readiness status/);
    assert.match(leaderboardHtml, /GenerationSpecId/);
    assert.match(docsHtml, /Software.*Apache-2\.0/s);
    assert.match(docsHtml, /Benchmark content.*CC BY 4\.0/s);
    assert.match(docsHtml, /TutorBench Brand Policy/);
    assert.match(docsHtml, /CONTRIBUTING\.md/);
    assert.doesNotMatch(casesJson, /evaluatorOnly|groundTruth|knownMisconception|rubrics|misconceptions/);
    assert.match(communityHtml, /Help improve TutorBench/);
    assert.match(communityHtml, /Applications not open yet/);
    assert.match(communityHtml, /Public reviewer intake is not open/);
    assert.match(communityHtml, /real Community Review campaign has not started/);
    assert.match(communityHtml, /P5 human calibration has not started/);
    assert.match(communityHtml, /What we expect to ask when applications open/);
    assert.match(communityHtml, /One contact email for a future invitation/);
    assert.match(communityHtml, /Preferred review language/);
    assert.match(communityHtml, /Optional relevant experience summary/);
    assert.match(communityHtml, /Approximate availability category/);
    assert.match(communityHtml, /Application.*Manual review.*Invitation.*Consent.*Qualification.*Blind review/s);
    assert.match(communityHtml, /href="\/community\/" aria-current="page"/);
    assert.match(communityHtml, /href="\/data\/cases\/"/);
    assert.match(communityHtml, /href="\/methodology\/"/);
    assert.doesNotMatch(communityHtml, /<form\b|<input\b|<a[^>]*>[^<]*(?:Apply now|Join now|Register|Start reviewing|Sign in as reviewer)/i);
    assert.doesNotMatch(communityHtml, /https?:\/\/[^"<\s]*(?:railway|auth0|oidc|community-review)/i);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

test("community page renders meaningful Chinese content and runtime locale data", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "tutor-benchmark-community-zh-"));
  try {
    await buildWebsite({ outputDirectory, locale: "zh-CN" });
    const communityHtml = await readFile(
      join(outputDirectory, "community", "index.html"),
      "utf8",
    );

    assert.match(communityHtml, /<html lang="zh-CN" data-ui-locale="zh-CN">/);
    assert.match(communityHtml, /参与 TutorBench/);
    assert.match(communityHtml, /当前暂未开放参与申请/);
    assert.match(communityHtml, /公开 reviewer intake 尚未开放/);
    assert.match(communityHtml, /真实 Community Review 尚未启动/);
    assert.match(communityHtml, /P5 人工校准尚未开始/);
    assert.match(communityHtml, /开放申请后预计会询问什么/);
    assert.match(communityHtml, /用于未来邀请的一个联系邮箱/);
    assert.match(communityHtml, /可选的相关经验概述/);
    assert.match(communityHtml, /没有申请表、候补名单或 reviewer 登录入口/);
    assert.match(communityHtml, /data-ui-text="communityHeroTitle"/);
    assert.match(communityHtml, /data-ui-text-en="Help improve TutorBench"/);
    assert.match(communityHtml, /data-ui-text-zh-cn="参与 TutorBench"/);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

test("static website build prefixes project-site paths without changing local defaults", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "tutor-benchmark-pages-"));
  try {
    await buildWebsite({
      outputDirectory,
      basePath: "/tutorbench/",
      siteUrl: "https://shuangyan123.github.io/tutorbench",
    });
    const homeHtml = await readFile(join(outputDirectory, "index.html"), "utf8");
    const casesHtml = await readFile(
      join(outputDirectory, "data", "cases", "index.html"),
      "utf8",
    );

    assert.match(homeHtml, /href="\/tutorbench\/leaderboard\//);
    assert.match(homeHtml, /href="\/tutorbench\/assets\/styles\.css"/);
    assert.match(homeHtml, /src="\/tutorbench\/assets\/site\.js"/);
    assert.match(homeHtml, /src="\/tutorbench\/assets\/brand\/tutorbench\/web\/tutorbench-mark-small\.svg"/);
    assert.match(homeHtml, /href="\/tutorbench\/assets\/brand\/tutorbench\/raster\/favicon\.ico"/);
    assert.match(homeHtml, /<link rel="canonical" href="https:\/\/shuangyan123\.github\.io\/tutorbench\//);
    assert.match(casesHtml, /href="\/tutorbench\/data\/cases\/fraction-misconception-001\//);
    assert.match(casesHtml, /data-case-filter="locale"/);
    assert.match(casesHtml, /data-case-locale="zh-CN"/);
    assert.match(casesHtml, /English/);
    assert.match(casesHtml, /Chinese/);
    assert.doesNotMatch(homeHtml, /(?:href|src)="\/(?:leaderboard|assets)\//);
    assert.doesNotMatch(homeHtml, /(?:href|src)="\/assets\/brand\/tutorbench\//);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

test("evaluation artifacts cannot be routed into the public website output", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "tutor-benchmark-private-guard-"));
  try {
    await assert.rejects(
      () => buildWebsite({ outputDirectory, evaluationPath: "artifacts/evaluation.json" }),
      /private-dist/,
    );
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
