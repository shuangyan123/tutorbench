import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
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
import {
  PUBLIC_SITE_BOTANICAL_ASSETS,
  PUBLIC_SITE_RASTER_ASSETS,
} from "../src/site/assets.js";
import { renderPage, TUTORBENCH_BRAND_ASSET_PATHS } from "../src/site/html.js";
import { renderEditorialBotanical } from "../src/site/illustrations.js";
import { renderHomePage } from "../src/site/pages/home.js";
import { renderHeatmapPage, renderTrialDetailPage, renderTrialsPage } from "../src/site/pages/data.js";
import { renderLeaderboardPage, renderModelDetailPage, renderModelsPage } from "../src/site/pages/overview.js";
import { renderAboutPage, renderDocsPage, renderRunPage } from "../src/site/pages/developer.js";
import { renderCommunityPage } from "../src/site/pages/community.js";
import { renderNotFoundPage } from "../src/site/pages/not-found.js";

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
  assert.match(content, /Test how AI tutors/);
  assert.match(content, /Run an Evaluation/);
  assert.match(content, /diagnose concrete failures/);
});

test("run page exposes Tutor Health as the product-facing external Tutor workflow", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadDataset());
  const page = renderRunPage(artifacts);
  assert.match(page.description, /diagnose real-world tutoring behavior/);
  assert.match(page.content, /data-run-tab="health"/);
  assert.match(page.content, /tutorbench health/);
  assert.match(page.content, /productive-struggle-intervention-v0\.1/);
  assert.match(page.content, /health-report\.json/);
  assert.match(page.content, /No-Judge runs stay UNRESOLVED/);
  assert.match(page.content, /not a validated general tutor-quality or learner-outcome measure/);
});

test("locale selector reserves text and chevron space consistently", async () => {
  const styles = await readFile(join(process.cwd(), "website", "src", "teachometry.css"), "utf8");
  assert.match(styles, /--teach-locale-control-width: 112px;/);
  assert.match(styles, /\.locale-switcher::after \{/);
  assert.match(styles, /appearance: none;/);
  assert.match(styles, /padding: 0 38px 0 12px;/);
  assert.match(styles, /font: 12px\/1\.4 var\(--teach-sans\);/);
});

test("shared public header keeps one canonical language-control geometry", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadDataset());
  const pages = [
    renderPage(renderHomePage(artifacts)),
    renderPage(renderRunPage(artifacts)),
    renderPage(renderDocsPage(artifacts)),
  ];
  for (const html of pages) {
    assert.equal((html.match(/class="locale-switcher"/g) ?? []).length, 1);
  }
  const styles = await readFile(join(process.cwd(), "website", "src", "teachometry.css"), "utf8");
  assert.match(styles, /\.locale-switcher select \{[\s\S]*?width: var\(--teach-locale-control-width\);[\s\S]*?height: var\(--teach-button-height\);/);
  for (const file of ["benchmark.css", "methodology.css", "results.css", "cases.css", "case-detail.css"]) {
    const pageStyles = await readFile(join(process.cwd(), "website", "src", file), "utf8");
    assert.doesNotMatch(pageStyles, /locale-switcher select/u);
  }
});

test("public navigation avoids an artificial page-entry delay and warms likely targets", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadDataset());
  const html = renderPage(renderHomePage(artifacts));
  assert.match(html, /<script type="speculationrules">/);
  assert.match(html, /#primary-navigation a\[href\]/);
  const chromeStyles = await readFile(join(process.cwd(), "website", "src", "teachometry.css"), "utf8");
  assert.doesNotMatch(chromeStyles, /teach-page-enter/);
  const siteScript = await readFile(join(process.cwd(), "website", "src", "site.js"), "utf8");
  assert.match(siteScript, /prefetchRoute/);
  assert.match(siteScript, /prefetch\.rel = "prefetch"/);
});

test("shared public header is consistent, localized, and exposes language controls", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadDataset());
  const chromeStyles = await readFile(join(process.cwd(), "website", "src", "teachometry.css"), "utf8");
  const compactHeaderStart = chromeStyles.indexOf("@media (max-width: 1023px)");
  const pageResponsiveStart = chromeStyles.indexOf("@media (max-width: 900px)");
  assert.ok(compactHeaderStart >= 0);
  assert.ok(pageResponsiveStart > compactHeaderStart);
  const compactHeaderStyles = chromeStyles
    .slice(compactHeaderStart, pageResponsiveStart)
    .replace(/\s+/g, " ");
  const pageResponsiveStyles = chromeStyles
    .slice(pageResponsiveStart, chromeStyles.indexOf("@media (max-width: 640px)"))
    .replace(/\s+/g, " ");
  const pages = [
    renderPage(renderHomePage(artifacts), { locale: "zh-CN" }),
    renderPage(renderRunPage(artifacts), { locale: "zh-CN" }),
    renderPage(renderDocsPage(artifacts), { locale: "zh-CN" }),
  ];

  for (const html of pages) {
    assert.match(html, /<header class="site-header home-header">/);
    assert.equal((html.match(/class="nav-toggle"/g) ?? []).length, 1);
    assert.equal((html.match(/id="primary-navigation"/g) ?? []).length, 1);
    assert.match(html, /aria-expanded="false" aria-controls="primary-navigation"/);
    assert.equal((html.match(/data-locale-switcher/g) ?? []).length, 1);
    assert.match(html, /data-ui-text="homeNav"/);
    assert.match(html, /data-ui-text="benchmarkNav"/);
    assert.match(html, /data-ui-text="methodNav"/);
    assert.match(html, /data-ui-text="resultsNav"/);
    assert.match(html, /data-ui-text="casesNav"/);
    assert.match(html, /data-ui-text="aboutNav"/);
    assert.match(html, /data-ui-text="blogNav"/);
    assert.match(html, /data-ui-text="brandDescriptor"/);
    assert.match(html, /data-ui-text="getStarted"/);
    assert.match(html, /data-ui-aria-en="Primary navigation"/);
    assert.match(html, /data-ui-aria-zh-cn="主导航"/);
    assert.match(html, /data-ui-title-zh-cn="GitHub 仓库"/);
    assert.match(html, /<html lang="zh-CN" data-ui-locale="zh-CN">/);
    assert.match(html, />首页</);
    assert.match(html, />开始使用</);
  }

  assert.ok(compactHeaderStyles.includes(".home-header-tools { display: none;"));
  assert.ok(compactHeaderStyles.includes('.home-header .nav-links[data-open="true"] ~ .home-header-tools { display: flex;'));
  assert.ok(compactHeaderStyles.includes("grid-template-columns: repeat(2, minmax(0, 1fr));"));
  assert.match(chromeStyles, /@media \(max-width: 1100px\) and \(min-width: 1024px\) \{[\s\S]*?\.home-header \.header-inner/);
  assert.doesNotMatch(pageResponsiveStyles, /\.home-header(?:\s|[.#:{,]|$)/);
  assert.match(pageResponsiveStyles, /main \.shell/);
  assert.match(pageResponsiveStyles, /\.home-footer/);
  assert.match(chromeStyles, /@media \(max-width: 640px\) \{[\s\S]*?\.home-header-tools > \.button-primary \{[\s\S]*?grid-column: 1 \/ -1;/);
});

test("home reconstruction uses real blog routes and cases reuse the Teachometry shell", async () => {
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
  for (const image of PUBLIC_SITE_RASTER_ASSETS.filter((asset) => asset !== "foliage.png" && asset !== "foliage-right-mid.webp" && asset !== "home-hero-bg.webp" && asset !== "home-open-data-bg.webp").map((asset) => asset.replace(/\.webp$/, ""))) {
    assert.ok(home.includes(`src="/preview/assets/${image}.webp"`));
  }
  assert.ok(home.indexOf('class="home-data"') < home.indexOf('class="home-blog"'));
  assert.ok(home.indexOf('class="home-blog"') < home.indexOf('class="home-footer"'));
  const other = renderPage({ title: "Cases", description: "Cases", route: "/data/cases/", content: "Cases" });
  assert.match(other, /href="\/assets\/home\.css"/);
  assert.match(other, /href="\/assets\/cases\.css"/);
  assert.match(other, /<body class="cases-page">/);
  assert.doesNotMatch(other, /home-blog|site-footer|home-page/);
});

test("decorative site illustrations use explicit non-semantic SVG attributes", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadDataset());
  const resultsHtml = renderPage(renderLeaderboardPage(artifacts));
  const resultsHeroSvg = resultsHtml.match(/<svg class="results-hero-svg"[^>]*>/u)?.[0];
  assert.ok(resultsHeroSvg);
  assert.match(resultsHeroSvg, /aria-hidden="true"/u);
  assert.match(resultsHeroSvg, /focusable="false"/u);
  assert.match(resultsHeroSvg, /shape-rendering="geometricPrecision"/u);
  assert.doesNotMatch(resultsHeroSvg, /role="img"|aria-label=/u);

  const editorialSvg = renderEditorialBotanical("test-editorial");
  assert.match(editorialSvg, /class="test-editorial"/u);
  assert.match(editorialSvg, /aria-hidden="true"/u);
  assert.match(editorialSvg, /focusable="false"/u);
  assert.match(editorialSvg, /shape-rendering="geometricPrecision"/u);
  assert.match(editorialSvg, /M34 294 24 271/u);

  const communityHtml = renderPage(renderCommunityPage(artifacts, "en"));
  const ecosystemSvg = communityHtml.match(/<svg class="community-ecosystem-lines"[^>]*>/u)?.[0];
  assert.ok(ecosystemSvg);
  assert.match(ecosystemSvg, /aria-hidden="true"/u);
  assert.match(ecosystemSvg, /focusable="false"/u);
  assert.match(ecosystemSvg, /shape-rendering="geometricPrecision"/u);
});

test("page botanical artwork stays external, vector-only, and page-specific", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadDataset());
  const pages = {
    about: renderPage(renderAboutPage(artifacts, "0.1.0")),
    community: renderPage(renderCommunityPage(artifacts, "en")),
    models: renderPage(renderModelsPage(artifacts)),
  } as const;

  for (const pageKey of ["about", "community", "models"] as const) {
    const asset = PUBLIC_SITE_BOTANICAL_ASSETS[pageKey];
    const svg = await readFile(join(process.cwd(), "website", "src", "assets", asset.svg), "utf8");
    const image = await stat(join(process.cwd(), "website", "src", "assets", asset.image));
    assert.match(svg, new RegExp(`<g id="${asset.svgId}"`));
    assert.doesNotMatch(svg, /<image\b|data:image|<metadata\b/u);
    assert.ok(image.size > 100_000, `${pageKey} botanical photo should retain useful resolution`);
    assert.match(pages[pageKey], new RegExp(`href="/assets/${asset.svg}#${asset.svgId}"`));
    assert.match(pages[pageKey], new RegExp(`src="/assets/${asset.image}"`));
  }

  assert.doesNotMatch(pages.about, /community-botanical|models-botanical/u);
  assert.doesNotMatch(pages.community, /about-botanical|models-botanical/u);
  assert.doesNotMatch(pages.models, /about-botanical|community-botanical/u);
});

test("public raster inventory is explicit and CSS image references stay self-contained", async () => {
  const imageDirectory = join(process.cwd(), "website", "src", "images");
  const sourceRasterAssets = (await readdir(imageDirectory))
    .filter((name) => /\.(?:png|webp)$/u.test(name))
    .sort();
  assert.deepEqual(sourceRasterAssets, [...PUBLIC_SITE_RASTER_ASSETS].sort());

  const stylesheetNames = (await readdir(join(process.cwd(), "website", "src")))
    .filter((name) => name.endsWith(".css"));
  for (const stylesheetName of stylesheetNames) {
    const stylesheet = await readFile(join(process.cwd(), "website", "src", stylesheetName), "utf8");
    for (const match of stylesheet.matchAll(/url\(["']?\.\/([^)'"\s]+)["']?\)/gu)) {
      assert.ok(
        PUBLIC_SITE_RASTER_ASSETS.includes(match[1] as (typeof PUBLIC_SITE_RASTER_ASSETS)[number]),
        `${stylesheetName} references an unlisted raster asset: ${match[1]}`,
      );
    }
  }
});

test("route photo reuse stays scoped to compatible visual subjects", async () => {
  const communityStyles = await readFile(join(process.cwd(), "website", "src", "community.css"), "utf8");
  const modelStyles = await readFile(join(process.cwd(), "website", "src", "models.css"), "utf8");
  assert.match(communityStyles, /community-task-media[\s\S]*community-botanical-photo/u);
  assert.doesNotMatch(communityStyles, /community-task-media[\s\S]*home-blog-03\.webp/u);
  assert.match(communityStyles, /community-closing-image[\s\S]*home-blog-01\.webp/u);
  assert.match(modelStyles, /models-botanical-photo/u);
  assert.doesNotMatch(modelStyles, /models-hero[\s\S]*foliage-(?:right|left)-near\.webp/u);
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

test("models registry and reserved detail route remain evidence-bound", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadDataset());
  const modelsHtml = renderPage(renderModelsPage(artifacts));
  const detailHtml = renderPage(renderModelDetailPage(artifacts));
  const inventedReferenceModels = /GPT-4o|GPT-4o mini|Claude 3\.5 Sonnet|Gemini 1\.5 Pro|Llama 3\.1 70B|2 runs|OpenAI|Anthropic|Google|Meta/;

  assert.match(modelsHtml, /<body class="models-page">/);
  assert.match(modelsHtml, /models\.css/);
  assert.match(modelsHtml, /No calibrated public model runs yet\./);
  assert.match(modelsHtml, /0 public profiles/);
  assert.match(modelsHtml, /Future profile contract/);
  assert.match(modelsHtml, /Filters become available when public model profiles exist/);
  assert.match(modelsHtml, /<select disabled/);
  assert.match(modelsHtml, /<input type="search" disabled/);
  assert.match(modelsHtml, /href="\/methodology\//);
  assert.match(modelsHtml, /href="\/leaderboard\//);
  assert.doesNotMatch(modelsHtml, inventedReferenceModels);
  assert.doesNotMatch(modelsHtml, /Not a leaderboard yet/);

  assert.match(detailHtml, /<body class="model-detail-page">/);
  assert.match(detailHtml, /No model selected/);
  assert.match(detailHtml, /Future result contract/);
  assert.match(detailHtml, /No public model trials available yet\./);
  assert.match(detailHtml, /tutor-eval-v0\.2a@0\.2a\.6/);
  assert.match(detailHtml, /No model identity, score, strength, weakness, or trial is inferred/);
  assert.doesNotMatch(detailHtml, inventedReferenceModels);
});

test("Teachometry benchmark explorer pages stay evidence-bound and use the public artifact contract", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadDataset());
  const heatmapHtml = renderPage(renderHeatmapPage(artifacts), { basePath: "/preview" });
  const trialsHtml = renderPage(renderTrialsPage(artifacts), { basePath: "/preview" });
  const detailHtml = renderPage(renderTrialDetailPage(artifacts), { basePath: "/preview" });

  assert.match(heatmapHtml, /<body class="home-page explorer-page heatmap-page">/);
  assert.match(heatmapHtml, /Evidence Matrix/);
  assert.match(heatmapHtml, /href="\/preview\/assets\/explorers\.css"/);
  assert.match(heatmapHtml, /No public model trials available yet\./);
  assert.match(heatmapHtml, /<dd>48<\/dd>/);
  assert.match(heatmapHtml, /Correctness/);
  assert.match(heatmapHtml, /Versioned public model runs/);
  assert.doesNotMatch(heatmapHtml, /Model run A|Model run B|score \/ pass \/ failure|Higher evidence/);
  assert.match(heatmapHtml, /class="home-footer"/);
  assert.doesNotMatch(heatmapHtml, /class="site-footer"/);
  assert.match(heatmapHtml, /href="\/preview\/data\/trials\/"/);
  assert.match(heatmapHtml, /href="\/preview\/methodology\/"/);

  assert.match(trialsHtml, /<body class="home-page explorer-page trials-page">/);
  assert.match(trialsHtml, /Model Trials/);
  assert.match(trialsHtml, /No public trials yet\./);
  assert.match(trialsHtml, /generationSpecId/);
  assert.match(trialsHtml, /promptSha256/);
  assert.match(trialsHtml, /tutorResponse/);
  assert.match(trialsHtml, /criticalFailures/);
  assert.match(trialsHtml, /From benchmark to evidence/);
  assert.doesNotMatch(trialsHtml, /<tbody>\s*<tr>\s*<th[^>]*>trial-/i);
  assert.match(trialsHtml, /href="\/preview\/models\/"/);
  assert.match(trialsHtml, /href="\/preview\/leaderboard\/"/);

  assert.match(detailHtml, /<body class="home-page explorer-page trial-detail-page">/);
  assert.match(detailHtml, /No public trial is selected\./);
  assert.match(detailHtml, /Current benchmark context only/);
  assert.match(detailHtml, /tutor-eval-v0\.2a@0\.2a\.6/);
  assert.match(detailHtml, /Not available/);
  assert.match(detailHtml, /No results yet/);
  assert.doesNotMatch(detailHtml, /Trial TBD|fake|GPT-4o|Claude|Gemini|Model A|Model B|\b\d+%/i);
  assert.match(detailHtml, /href="\/preview\/data\/trials\/"/);
  assert.match(detailHtml, /class="home-footer"/);
});

test("Docs uses the Teachometry shell and a real repository reference center", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadDataset());
  const docsHtml = renderPage(renderDocsPage(artifacts), { basePath: "/preview" });

  assert.match(docsHtml, /<title>Docs — Teachometry<\/title>/);
  assert.match(docsHtml, /<body class="docs-page">/);
  assert.match(docsHtml, /<header class="site-header home-header">/);
  assert.match(docsHtml, /<footer class="home-footer">/);
  assert.doesNotMatch(docsHtml, /<footer class="site-footer">/);
  assert.match(docsHtml, /href="\/preview\/assets\/styles\.css"/);
  assert.match(docsHtml, /href="\/preview\/assets\/teachometry\.css"/);
  assert.match(docsHtml, /href="\/preview\/assets\/docs\.css"/);
  assert.doesNotMatch(docsHtml, /href="\/preview\/assets\/home\.css"/);
  assert.match(docsHtml, /data-doc-search/);
  assert.match(docsHtml, /data-doc-category="getting-started"/);
  assert.match(docsHtml, /id="overview"/);
  assert.match(docsHtml, /id="quickstart"/);
  assert.match(docsHtml, /id="documentation-index"/);
  assert.match(docsHtml, /id="evidence-boundaries"/);
  assert.match(docsHtml, /id="governance"/);
  assert.match(docsHtml, /id="next-steps"/);
  assert.match(docsHtml, /git clone https:\/\/github\.com\/shuangyan123\/tutorbench\.git/);
  assert.match(docsHtml, /npm install tutor-benchmark/);
  assert.match(docsHtml, /tutorbench quickstart/);
  assert.match(docsHtml, /Node 24/);
  assert.match(docsHtml, /no official benchmark score/);
  for (const path of [
    "README.md",
    "docs/quickstart.md",
    "docs/tutor-eval-v0.2a.md",
    "docs/tutor-eval-v0.4a.md",
    "docs/real-model-baselines.md",
    "docs/community-review-protocol.md",
    "docs/community-review-application-gate.md",
    "docs/roadmap.md",
    "docs/licensing.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
  ]) {
    assert.match(docsHtml, new RegExp(`github\\.com/shuangyan123/tutorbench/blob/main/${path.replaceAll(".", "\\.")}`));
  }
  for (const route of ["/run/", "/methodology/", "/data/", "/models/", "/leaderboard/", "/community/"]) {
    assert.match(docsHtml, new RegExp(`href="/preview${route.replaceAll("/", "\\/")}`));
  }
  assert.match(docsHtml, /Apache-2\.0/);
  assert.match(docsHtml, /CC BY 4\.0/);
  assert.match(docsHtml, /TutorBench Brand Policy/);
  assert.match(docsHtml, /public applications, reviewer intake, and a real Community Review campaign have not started/);
  assert.doesNotMatch(docsHtml, /pip install teachometry|GPT-4o|Claude|Webhooks|Community forum/);
  assert.ok((docsHtml.match(/data-doc-entry/g) ?? []).length >= 11);
});

test("404 uses the Teachometry shell, helpful public routes, and isolated page CSS", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadDataset());
  const html = renderPage(renderNotFoundPage(artifacts), { basePath: "/preview" });

  assert.match(html, /<title>Page not found — Teachometry<\/title>/);
  assert.match(html, /<meta name="description" content="The requested page is not part of the public Teachometry site\."/);
  assert.match(html, /<body class="home-page not-found-page">/);
  assert.match(html, /<header class="site-header home-header">/);
  assert.match(html, /<footer class="home-footer">/);
  assert.match(html, /href="\/preview\/assets\/styles\.css"/);
  assert.match(html, /href="\/preview\/assets\/teachometry\.css"/);
  assert.match(html, /href="\/preview\/assets\/not-found\.css"/);
  assert.doesNotMatch(html, /href="\/preview\/assets\/(?:home|docs|explorers)\.css"/);
  assert.match(html, /<span class="not-found-number">404<\/span>/);
  assert.match(html, /This trail doesn’t lead to a public artifact\./);
  assert.match(html, /href="\/preview\/">Return home/);
  assert.match(html, /href="\/preview\/data\/">Explore the benchmark/);
  assert.match(html, /href="\/preview\/docs\/">Read the documentation/);
  assert.doesNotMatch(html, /Page not found — Tutor Benchmark|This route is not part of the public Developer Preview|audit\/runs|evaluatorOnly|groundTruth|knownMisconception/);
  assert.match(html, /aria-hidden="true"[\s\S]*not-found-signpost/);
  assert.doesNotMatch(html, /<footer class="site-footer">/);
});

test("static website build emits the public artifact files and route shell", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "tutor-benchmark-website-"));
  try {
    const artifacts = buildPublicBenchmarkArtifacts(await loadDataset());
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
    const modelsHtml = await readFile(join(outputDirectory, "models", "index.html"), "utf8");
    const modelDetailHtml = await readFile(
      join(outputDirectory, "models", "[modelId]", "index.html"),
      "utf8",
    );
    const docsHtml = await readFile(join(outputDirectory, "docs", "index.html"), "utf8");
    const notFoundHtml = await readFile(join(outputDirectory, "404.html"), "utf8");
    const aboutHtml = await readFile(join(outputDirectory, "about", "index.html"), "utf8");
    const communityHtml = await readFile(
      join(outputDirectory, "community", "index.html"),
      "utf8",
    );

    assert.equal(routeCount, 62);
    assert.match(notFoundHtml, /<title>Page not found — Teachometry<\/title>/);
    assert.match(notFoundHtml, /<body class="home-page not-found-page">/);
    assert.match(notFoundHtml, /<header class="site-header home-header">/);
    assert.match(notFoundHtml, /<footer class="home-footer">/);
    assert.match(notFoundHtml, /href="\/assets\/teachometry\.css"/);
    assert.match(notFoundHtml, /href="\/assets\/not-found\.css"/);
    assert.match(notFoundHtml, /This trail doesn’t lead to a public artifact\./);
    assert.doesNotMatch(notFoundHtml, /Page not found — Tutor Benchmark|class="site-footer"/);
    assert.match(homeHtml, /Developer Preview/);
    assert.match(homeHtml, /No calibrated public model runs yet\./);
    assert.match(homeHtml, /href="\/leaderboard\//);
    assert.match(homeHtml, /href="\/community\//);
    assert.match(homeHtml, /Test how AI tutors<br><em>behave<\/em>/);
    assert.match(homeHtml, /href="\/run\/">Run an Evaluation/);
    assert.match(homeHtml, /href="\/methodology\/">[\s\S]*Read the Methodology/);
    assert.match(homeHtml, /data-case-walkthrough/);
    assert.match(homeHtml, /Illustrative case walkthrough/);
    assert.match(homeHtml, /Not scored · no model run/);
    assert.match(homeHtml, /No model response or model score is published here/);
    assert.equal((homeHtml.match(/data-home-case[ >]/g) ?? []).length, 48);
    assert.equal((homeHtml.match(/data-home-story-chapter="[0-4]"/g) ?? []).length, 5);
    assert.doesNotMatch(homeHtml, /data-dimension-explorer|data-dimension-detail|data-dimension-prev|data-dimension-next/);
    assert.match(homeHtml, /Five dimensions of tutoring/);
    assert.match(homeHtml, /More than<br><em>right or wrong\.<\/em>/);
    assert.match(homeHtml, /Teachometry examines observable tutoring behavior with structured rubrics and transparent evaluation\. Each dimension captures a distinct aspect of a response in an authored scenario\./);
    const homeStorySection = homeHtml.match(/<section class="home-dimensions"[\s\S]*?<\/section>/u)?.[0];
    assert.ok(homeStorySection);
    assert.doesNotMatch(homeStorySection, /foliage-layer/iu);
    const homeStoryQuestions = [
      "Did it understand the learner?",
      "Did it help the learner move forward?",
      "Does the learner know what to do next?",
      "Is the help actually correct?",
      "Did it respond to this learner, not just any learner?",
    ];
    let previousHomeQuestion = -1;
    for (const question of homeStoryQuestions) {
      const questionPosition = homeHtml.indexOf(question);
      assert.ok(questionPosition > previousHomeQuestion, `Home story question order: ${question}`);
      previousHomeQuestion = questionPosition;
    }
    const homeStorySvg = homeHtml.match(/<svg class="home-story-response"[\s\S]*?<\/svg>/u)?.[0];
    assert.ok(homeStorySvg);
    assert.match(homeStorySvg, /aria-hidden="true"/u);
    assert.match(homeStorySvg, /focusable="false"/u);
    assert.doesNotMatch(homeStorySvg, /<text|Diagnosis|Guidance|learner|benchmark/iu);
    const responseParagraphs = homeStorySvg.match(/<g class="home-response-paragraph">[\s\S]*?<\/g>/gu) ?? [];
    assert.equal(responseParagraphs.length, 4);
    for (const paragraph of responseParagraphs) {
      const lineCount = (paragraph.match(/M\d+\s+\d+h\d+/gu) ?? []).length;
      assert.ok(lineCount >= 2 && lineCount <= 4, `Editorial response paragraph line count: ${lineCount}`);
    }
    const homeStoryChapters = homeHtml.match(/<article class="home-story-chapter"[\s\S]*?<\/article>/gu) ?? [];
    assert.equal(homeStoryChapters.length, 5);
    for (const chapter of homeStoryChapters) {
      assert.doesNotMatch(chapter, /<(?:a|button|input|select|textarea)\b/iu);
    }
    for (const state of ["0", "1", "2", "3", "4"]) {
      assert.match(homeStorySvg, new RegExp(`data-home-story-state="${state}"`));
    }
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
    for (const asset of PUBLIC_SITE_RASTER_ASSETS) {
      assert.deepEqual(
        await readFile(join(outputDirectory, "assets", asset)),
        await readFile(join(process.cwd(), "website", "src", "images", asset)),
        `Website build must preserve the reviewed asset bytes: ${asset}`,
      );
    }
    const generatedHtmlFiles = (await readdir(outputDirectory, { recursive: true }))
      .filter((name): name is string => typeof name === "string" && name.endsWith(".html"));
    for (const htmlFile of generatedHtmlFiles) {
      const html = await readFile(join(outputDirectory, htmlFile), "utf8");
      for (const match of html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gu)) {
        const source = match[1];
        assert.ok(source !== undefined);
        if (source === undefined) continue;
        assert.doesNotMatch(source, /^(?:https?:)?\/\//u, `Generated HTML hotlinks an image: ${source}`);
        const rasterMatch = source.match(/\/assets\/([^/]+\.(?:png|webp))$/u);
        if (rasterMatch !== null) {
          assert.ok(
            PUBLIC_SITE_RASTER_ASSETS.includes(rasterMatch[1] as (typeof PUBLIC_SITE_RASTER_ASSETS)[number]),
            `Generated HTML references an unlisted raster asset: ${rasterMatch[1]}`,
          );
        }
      }
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
    assert.match(modelsHtml, /<title>Models — Teachometry<\/title>/);
    assert.match(modelsHtml, /<body class="models-page">/);
    assert.match(modelsHtml, /href="\/assets\/models\.css"/);
    assert.match(modelsHtml, /No public model profiles yet\./);
    assert.match(modelsHtml, /No calibrated public model runs yet\./);
    assert.match(modelsHtml, /Comparable evidence,<br><em>not claims\.<\/em>/);
    assert.doesNotMatch(modelsHtml, /GPT-4o|GPT-4o mini|Claude 3\.5 Sonnet|Gemini 1\.5 Pro|Llama 3\.1 70B|2 runs/);
    assert.match(modelDetailHtml, /<title>Model Detail — Teachometry<\/title>/);
    assert.match(modelDetailHtml, /<body class="model-detail-page">/);
    assert.match(modelDetailHtml, /No model selected/);
    assert.match(modelDetailHtml, /No public model trials available yet\./);
    assert.doesNotMatch(modelDetailHtml, /GPT-4o|GPT-4o mini|Claude 3\.5 Sonnet|Gemini 1\.5 Pro|Llama 3\.1 70B/);
    assert.match(runHtml, /tutor:export-execution/);
    assert.match(runHtml, /TutorExecutionPacket/);
    assert.match(runHtml, /baseline-native-default/);
    assert.match(runHtml, /Get started \(provider-free\)/);
    assert.match(runHtml, /<body class="run-page">/);
    assert.match(runHtml, /<header class="site-header home-header">/);
    assert.match(runHtml, /<footer class="home-footer">/);
    assert.doesNotMatch(runHtml, /href="\/assets\/home\.css"/);
    assert.match(runHtml, /href="\/assets\/teachometry\.css"/);
    assert.match(runHtml, /href="\/assets\/run\.css"/);
    assert.match(runHtml, /From research<br>questions to<br><em>reproducible runs\.<\/em>/);
    assert.match(runHtml, /Run TutorBench locally, then connect an external Tutor to the Tutor Health workflow/);
    assert.equal((runHtml.match(/data-run-tab="/g) ?? []).length, 5);
    assert.equal((runHtml.match(/data-copy-run/g) ?? []).length, 5);
    for (const tab of ["quickstart", "health", "benchmark", "external-tutor", "advanced"]) {
      assert.match(runHtml, new RegExp(`data-run-tab="${tab}"`));
      assert.match(runHtml, new RegExp(`data-run-panel="${tab}"`));
    }
    assert.match(runHtml, /git clone https:\/\/github\.com\/shuangyan123\/tutorbench\.git/);
    assert.match(runHtml, /npm ci/);
    assert.match(runHtml, /npm run quickstart/);
    assert.match(runHtml, /npm install tutor-benchmark/);
    assert.match(runHtml, /tutorbench quickstart/);
    assert.match(runHtml, /tutor-eval-v0\.1@0\.1/);
    assert.match(runHtml, /No Judge, no network connection/);
    assert.match(runHtml, /no official score/);
    assert.match(runHtml, /python examples\/http-python-tutor\/server\.py/);
    assert.match(runHtml, /tutorbench run --http http:\/\/127\.0\.0\.1:8000\/respond --limit 3/);
    assert.match(runHtml, /Default request timeout is 30 seconds/);
    assert.match(runHtml, /Product Tutor and canonical model collection are different paths/);
    assert.match(runHtml, /OpenAI Responses and DeepSeek Chat Completions are explicit Judge paths/);
    assert.match(runHtml, /npm run tutor:export-execution -- -- --case fraction-misconception-001/);
    assert.match(runHtml, /npm run tutor:export-cases/);
    assert.match(runHtml, /npm run tutor:corpus:validate -- -- --corpus path\/to\/corpus\.json/);
    assert.match(runHtml, /npm run benchmark:corpus -- -- --corpus path\/to\/corpus\.json/);
    assert.match(runHtml, /npm run judge:openai -- -- --dry-run/);
    assert.match(runHtml, /--judge-deepseek/);
    assert.match(runHtml, /baseline-native-default/);
    assert.match(runHtml, /Controlled optional generation parameters: none/);
    assert.match(runHtml, /provider-native behavior is not misrepresented as identical across vendors/);
    assert.match(runHtml, /Calibrated public model results/);
    assert.match(runHtml, /Official leaderboard rankings/);
    assert.doesNotMatch(runHtml, /Large-scale batch evaluation/);
    assert.match(runHtml, /Reproducibility checklist/);
    assert.match(runHtml, /Dataset version/);
    assert.match(runHtml, /Same cases\.<br>Different Tutors\.<br><em>Comparable evidence\.<\/em>/);
    for (const route of ["/docs/", "/methodology/", "/leaderboard/", "/data/cases/"]) {
      assert.match(runHtml, new RegExp(`href="${route.replaceAll("/", "\\/")}"`));
    }
    assert.doesNotMatch(runHtml, /4\.6 \/ 5|official score:|model leaderboard row/i);
    const previewRun = renderPage(renderRunPage(artifacts), { basePath: "/preview" });
    assert.match(previewRun, /href="\/preview\/assets\/run\.css"/);
    assert.match(previewRun, /href="\/preview\/docs\/"/);
    assert.match(methodologyHtml, /How do you<br>measure <em>teaching/);
    assert.match(methodologyHtml, /methodology\.css/);
    assert.match(methodologyHtml, /Structured case/);
    assert.match(methodologyHtml, /Tutor response/);
    assert.match(methodologyHtml, /Evaluator evidence/);
    assert.match(methodologyHtml, /Atomic rubrics/);
    assert.match(methodologyHtml, /Benchmark result/);
    assert.match(methodologyHtml, /Observable tutoring behavior/);
    const scoreDimensionCount = artifacts.benchmark.dimensions.score.length;
    assert.equal((methodologyHtml.match(/class="method-story-chapter"/g) ?? []).length, scoreDimensionCount);
    assert.equal((methodologyHtml.match(/class="method-story-visual" data-method-story-visual=/g) ?? []).length, scoreDimensionCount);
    assert.equal((methodologyHtml.match(/class="method-story-node"/g) ?? []).length, scoreDimensionCount);
    assert.equal((methodologyHtml.match(/class="method-story-spoke"/g) ?? []).length, scoreDimensionCount);
    const methodologyStorySvg = methodologyHtml.match(/<svg class="method-story-map"[\s\S]*?<\/svg>/u)?.[0];
    assert.ok(methodologyStorySvg);
    assert.match(methodologyStorySvg, /aria-hidden="true"/u);
    assert.match(methodologyStorySvg, /focusable="false"/u);
    assert.doesNotMatch(methodologyStorySvg, /Observable|tutoring|behavior/u);
    for (const visualState of ["correctness", "diagnosis", "guidance", "adaptation", "actionability"]) {
      assert.match(methodologyStorySvg, new RegExp(`data-method-visual-state="${visualState}"`));
    }
    assert.match(methodologyHtml, /<figcaption class="method-story-center">Observable<br>tutoring<br>behavior<\/figcaption>/u);
    assert.match(methodologyHtml, /data-method-story-current>01/);
    assert.match(methodologyHtml, /Whether the Tutor stays factually and conceptually correct/);
    assert.match(methodologyHtml, /What we look for/);
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
    assert.match(docsHtml, /<title>Docs — Teachometry<\/title>/);
    assert.match(docsHtml, /<body class="docs-page">/);
    assert.match(docsHtml, /href="\/assets\/teachometry\.css"/);
    assert.match(docsHtml, /href="\/assets\/docs\.css"/);
    assert.match(docsHtml, /<footer class="home-footer">/);
    assert.doesNotMatch(docsHtml, /<footer class="site-footer">/);
    assert.match(docsHtml, /Documentation index/);
    assert.match(docsHtml, /Quickstart ≠ official benchmark score/);
    assert.match(methodologyHtml, /human calibration have not started/);
    assert.match(methodologyHtml, /Judge-vs-human validation and statistical validation are not completed/);
    const methodologyStyles = await readFile(join(process.cwd(), "website", "src", "methodology.css"), "utf8");
    const homeStyles = await readFile(join(process.cwd(), "website", "src", "home.css"), "utf8");
    const siteScript = await readFile(join(process.cwd(), "website", "src", "site.js"), "utf8");
    const homeStoryScriptStart = siteScript.indexOf("const story = document.querySelector('[data-home-story]')");
    const homeStoryScriptEnd = siteScript.indexOf("\n  const nav = document.querySelector('#primary-navigation')", homeStoryScriptStart);
    assert.ok(homeStoryScriptStart >= 0 && homeStoryScriptEnd > homeStoryScriptStart);
    const homeStoryScript = siteScript.slice(homeStoryScriptStart, homeStoryScriptEnd);
    assert.match(homeStoryScript, /requestAnimationFrame\(updateActiveChapter\)/);
    assert.match(homeStoryScript, /let nextIndex = -1/);
    assert.match(homeStoryScript, /addEventListener\('scroll', scheduleUpdate, \{ passive: true \}\)/);
    assert.match(homeStoryScript, /min-width: 1024px/);
    assert.match(homeStoryScript, /!desktop\.matches \|\| reducedMotion\.matches/);
    assert.match(homeStoryScript, /homeStoryActive/);
    assert.match(homeStoryScript, /story\.dataset\.homeStoryEnhanced = 'true'/);
    assert.match(homeStoryScript, /delete story\.dataset\.homeStoryEnhanced/);
    assert.match(homeStoryScript, /homeStoryChapterEntered/);
    assert.match(homeStoryScript, /prefers-reduced-motion: reduce/);
    assert.doesNotMatch(homeStoryScript, /wheel|touchmove|preventDefault/);
    assert.match(homeStyles, /\.home-story-stage \{ position: sticky;/);
    assert.match(homeStyles, /@media \(min-width: 1024px\) and \(prefers-reduced-motion: no-preference\)[\s\S]*?\[data-home-story-enhanced="true"\] \.home-story-chapter:not\(\[aria-current="step"\]\)[\s\S]*?opacity: 0;/);
    assert.match(homeStyles, /\.home-story-chapter\[aria-current="step"\][\s\S]*?opacity: 1;[\s\S]*?translateY\(0\)/);
    assert.match(homeStyles, /transition: opacity 260ms ease, transform 260ms ease/);
    assert.match(homeStyles, /data-home-story-chapter-entered="true"\] \.home-story-intro/);
    assert.match(homeStyles, /@media \(width < 1024px\)[\s\S]*?\.home-story-stage \{ position: relative;/);
    assert.match(homeStyles, /@media \(max-width: 640px\)[\s\S]*?\.home-story-stage \{ display: none;/);
    assert.match(homeStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.home-story-stage \{ position: relative;/);
    const storyScriptStart = siteScript.indexOf("const story = document.querySelector('[data-method-story]')");
    const storyScriptEnd = siteScript.indexOf("\n})();", storyScriptStart);
    assert.ok(storyScriptStart >= 0 && storyScriptEnd > storyScriptStart);
    const storyScript = siteScript.slice(storyScriptStart, storyScriptEnd);
    assert.match(storyScript, /requestAnimationFrame\(updateActiveChapter\)/);
    assert.match(storyScript, /addEventListener\('scroll', scheduleUpdate, \{ passive: true \}\)/);
    assert.match(storyScript, /min-width: 901px/);
    assert.match(storyScript, /!desktop\.matches \|\| reducedMotion\.matches/);
    assert.match(storyScript, /data-method-story-visual/);
    assert.match(storyScript, /prefers-reduced-motion: reduce/);
    assert.doesNotMatch(storyScript, /wheel|touchmove|preventDefault/);
    assert.match(methodologyStyles, /\.method-story-stage \{\s*position: sticky;/);
    assert.match(methodologyStyles, /@media \(max-width: 900px\) \{[\s\S]*?\.method-story-stage \{\s*position: relative;/);
    assert.match(methodologyStyles, /\.method-story-chapter \{\s*display: flex;\s*min-height: clamp\(450px, 66svh, 660px\);/);
    assert.match(methodologyStyles, /@media \(max-width: 640px\) \{[\s\S]*?\.method-story-stage \{\s*display: none;/);
    assert.match(methodologyStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.method-story-overview \{\s*display: block;/);
    assert.match(methodologyStyles, /transition: opacity 320ms ease, transform 320ms ease;/);
    assert.match(aboutHtml, /<title>About — Teachometry<\/title>/);
    assert.match(aboutHtml, /<body class="about-page">/);
    assert.match(aboutHtml, /href="\/assets\/home\.css"/);
    assert.match(aboutHtml, /href="\/assets\/about\.css"/);
    assert.match(aboutHtml, /<footer class="home-footer">/);
    assert.doesNotMatch(aboutHtml, /<footer class="site-footer">/);
    assert.match(aboutHtml, /A model can know\s*<br>the answer\s*<br><em>without being\s*<br>a good tutor\.<\/em>/);
    assert.match(aboutHtml, /Answers <span>≠<\/span> Teaching\./);
    assert.match(aboutHtml, /We measure tutors\.<br>We don’t build the tutor\./);
    assert.match(aboutHtml, /TutorUnderTest/);
    assert.match(aboutHtml, /tutor-benchmark@0\.1\.0 published/);
    assert.match(aboutHtml, /tutor-eval-v0\.2a@0\.2a\.6/);
    assert.match(aboutHtml, /48 synthetic cases/);
    assert.match(aboutHtml, /No calibrated public model runs yet\./);
    assert.match(aboutHtml, /Apache-2\.0/);
    assert.match(aboutHtml, /CC BY 4\.0/);
    assert.match(aboutHtml, /TutorBench Brand Policy/);
    assert.doesNotMatch(aboutHtml, /MIT License/);
    assert.doesNotMatch(aboutHtml, /Conceptual understanding|Communication and clarity/);
    assert.match(docsHtml, /Community Review protocol/);
    assert.doesNotMatch(docsHtml, /not-yet-deployed P4 service/);
    assert.match(docsHtml, /P4 deployment-readiness status/);
    assert.match(leaderboardHtml, /GenerationSpecId/);
    assert.match(docsHtml, /Software.*Apache-2\.0/s);
    assert.match(docsHtml, /Benchmark content.*CC BY 4\.0/s);
    assert.match(docsHtml, /TutorBench Brand Policy/);
    assert.match(docsHtml, /CONTRIBUTING\.md/);
    assert.doesNotMatch(casesJson, /evaluatorOnly|groundTruth|knownMisconception|rubrics|misconceptions/);
    assert.match(communityHtml, /<title>Community — Teachometry<\/title>/);
    assert.match(communityHtml, /<body class="about-page community-page">/);
    assert.match(communityHtml, /href="\/assets\/teachometry\.css"/);
    assert.match(communityHtml, /href="\/assets\/community\.css"/);
    assert.match(communityHtml, /A stronger evaluation system/);
    assert.match(communityHtml, /is a shared effort\./);
    assert.match(communityHtml, /Applications not open yet/);
    assert.match(communityHtml, /Public intake is not open/);
    assert.match(communityHtml, /Real Community Review campaign/);
    assert.match(communityHtml, /P5 human calibration/);
    assert.match(communityHtml, /What we expect to ask when applications open/);
    assert.match(communityHtml, /One contact email for a future invitation/);
    assert.match(communityHtml, /Preferred review language/);
    assert.match(communityHtml, /Optional relevant experience summary/);
    assert.match(communityHtml, /Approximate availability category/);
    assert.match(communityHtml, /Application.*Manual review.*Invitation.*Consent.*Qualification.*Blind review/s);
    assert.match(communityHtml, /Agreement ≠ correctness/);
    assert.match(communityHtml, /Qualification ≠ calibration/);
    assert.match(communityHtml, /Human review ≠ gold standard/);
    assert.match(communityHtml, /Human review is a future evidence source/);
    assert.match(communityHtml, /<ol class="community-process-list">/);
    assert.equal((communityHtml.match(/class="community-process-step"/g) ?? []).length, 6);
    assert.match(communityHtml, /<footer class="home-footer">/);
    assert.doesNotMatch(communityHtml, /href="\/community\/" aria-current="page"/);
    assert.match(communityHtml, /href="\/data\/cases\/"/);
    assert.match(communityHtml, /href="\/methodology\/"/);
    assert.match(communityHtml, /href="\/data\/"/);
    assert.doesNotMatch(communityHtml, /<form\b|<input\b|<a[^>]*>[^<]*(?:Apply now|Join now|Register|Start reviewing|Sign in as reviewer)/i);
    assert.doesNotMatch(communityHtml, /120\+|80\+|200\+|25\+ countries/i);
    assert.doesNotMatch(communityHtml, /Discussion Forum|Case review|Working group|TutorEval v0\.2a dataset/i);
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
    assert.match(communityHtml, /更强的评测系统/);
    assert.match(communityHtml, /需要共同完成/);
    assert.match(communityHtml, /参与申请暂未开放/);
    assert.match(communityHtml, /公开 intake 尚未开放/);
    assert.match(communityHtml, /真实 Community Review/);
    assert.match(communityHtml, /P5 人工校准/);
    assert.match(communityHtml, /开放申请后预计会询问什么/);
    assert.match(communityHtml, /用于未来邀请的一个联系邮箱/);
    assert.match(communityHtml, /可选的相关经验概述/);
    assert.match(communityHtml, /没有申请表、候补名单或 reviewer 登录入口/);
    assert.match(communityHtml, /Agreement|一致性/);
    assert.match(communityHtml, /data-ui-text="communityHeroTitle"/);
    assert.match(communityHtml, /data-ui-text-en="A stronger evaluation system"/);
    assert.match(communityHtml, /data-ui-text-zh-cn="更强的评测系统"/);
    assert.match(communityHtml, /href="\/assets\/community\.css"/);
    assert.doesNotMatch(communityHtml, /120\+|80\+|200\+|25\+ countries/i);
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
    const communityHtml = await readFile(
      join(outputDirectory, "community", "index.html"),
      "utf8",
    );
    const docsHtml = await readFile(join(outputDirectory, "docs", "index.html"), "utf8");
    const notFoundHtml = await readFile(join(outputDirectory, "404.html"), "utf8");

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
    assert.match(communityHtml, /href="\/tutorbench\/assets\/teachometry\.css"/);
    assert.match(communityHtml, /href="\/tutorbench\/assets\/community\.css"/);
    assert.match(docsHtml, /href="\/tutorbench\/assets\/docs\.css"/);
    assert.match(docsHtml, /href="\/tutorbench\/run\//);
    assert.match(docsHtml, /href="\/tutorbench\/methodology\//);
    assert.match(docsHtml, /href="\/tutorbench\/data\//);
    assert.match(docsHtml, /href="\/tutorbench\/models\//);
    assert.match(notFoundHtml, /href="\/tutorbench\/assets\/not-found\.css"/);
    assert.match(notFoundHtml, /href="\/tutorbench\/data\/">Explore the benchmark/);
    assert.match(notFoundHtml, /href="\/tutorbench\/docs\/">Read the documentation/);
    assert.doesNotMatch(docsHtml, /href="\/assets\/docs\.css"/);
    assert.doesNotMatch(communityHtml, /href="\/assets\/community\.css"/);
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
