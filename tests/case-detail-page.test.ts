import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPublicBenchmarkArtifacts,
  loadTutorEvalDataset,
} from "../src/datasets/index.js";
import { TUTOR_EVAL_DATASET_ID } from "../src/contracts/index.js";
import { renderPage } from "../src/site/html.js";
import { renderCaseDetailPage } from "../src/site/pages/data.js";

test("public case detail pages use canonical case data and the Teachometry shell", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(
    await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID),
  );
  const englishCase = artifacts.cases.cases.find((item) => item.locale === "en");
  const chineseCase = artifacts.cases.cases.find((item) => item.locale === "zh-CN");
  assert.ok(englishCase);
  assert.ok(chineseCase);

  const englishHtml = renderPage(renderCaseDetailPage(artifacts, englishCase), {
    basePath: "/preview",
  });
  assert.match(englishHtml, /<title>[^<]+ — Teachometry<\/title>/);
  assert.match(englishHtml, /<body class="case-detail-page">/);
  assert.match(englishHtml, /href="\/preview\/assets\/home\.css"/);
  assert.match(englishHtml, /href="\/preview\/assets\/case-detail\.css"/);
  assert.match(englishHtml, /<footer class="home-footer">/);
  assert.doesNotMatch(englishHtml, /<footer class="site-footer">/);
  assert.match(englishHtml, new RegExp(englishCase.id));
  assert.match(englishHtml, new RegExp(englishCase.tutorInput.studentMessage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(englishHtml, /There is no prior conversation\. This case starts with the current student message\./);
  assert.match(englishHtml, /Not included in the public case file:/);
  assert.match(englishHtml, /Ground truth answers/);
  assert.match(englishHtml, /Full evaluation rubrics/);
  assert.match(englishHtml, /Known-misconception annotations/);
  assert.match(englishHtml, /Evaluator-only evidence/);
  assert.match(englishHtml, /Hidden challenge details/);
  assert.match(englishHtml, /Any private or non-public data/);
  assert.doesNotMatch(englishHtml, /evaluatorOnly|groundTruth|knownMisconception|hiddenChallenge/);
  assert.doesNotMatch(englishHtml, /10:14|10:15|10:16/);

  const chineseHtml = renderPage(renderCaseDetailPage(artifacts, chineseCase), {
    locale: "zh-CN",
  });
  assert.match(chineseHtml, /<html lang="zh-CN" data-ui-locale="zh-CN">/);
  assert.ok(chineseHtml.includes(chineseCase.metadata.topic));
  assert.ok(chineseHtml.includes(chineseCase.tutorInput.studentMessage));
  assert.match(chineseHtml, /lang="zh-CN"/);

  for (const publicCase of artifacts.cases.cases) {
    const detailPage = renderCaseDetailPage(artifacts, publicCase);
    assert.equal(detailPage.route, `/data/cases/${encodeURIComponent(publicCase.id)}/`);
    assert.match(detailPage.content, /case-detail-layout/);
    assert.match(detailPage.content, /class="case-boundary"/);
  }
});
