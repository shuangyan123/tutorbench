import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPublicBenchmarkArtifacts,
  loadTutorEvalDataset,
} from "../src/datasets/index.js";
import { TUTOR_EVAL_DATASET_ID } from "../src/contracts/index.js";
import { renderPage } from "../src/site/html.js";
import { renderCasesPage } from "../src/site/pages/data.js";

test("cases index is generated from public case data and uses the Teachometry shell", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(
    await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID),
  );
  const page = renderCasesPage(artifacts);
  const html = renderPage(page);

  assert.match(html, /<body class="cases-page">/);
  assert.match(html, /Cases — Teachometry/);
  assert.match(html, /href="\/assets\/home\.css"/);
  assert.match(html, /href="\/assets\/cases\.css"/);
  assert.match(html, /class="home-footer"/);
  assert.doesNotMatch(html, /class="site-footer"/);
  assert.equal((html.match(/data-case-item/g) ?? []).length, 48);
  assert.match(html, /data-case-filter="subject" value="mathematics"/);
  assert.match(html, /data-case-filter="subject" value="mathematics"><span>Mathematics<\/span><small>18<\/small>/);
  assert.match(html, /data-case-filter="locale" value="zh-CN"/);
  assert.match(html, /data-case-search-text=/);
  assert.doesNotMatch(html, /groundTruth|knownMisconception|evaluatorOnly|rubrics/);
});

test("cases index escapes public messages without exposing evaluator annotations", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(
    await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID),
  );
  const firstCase = artifacts.cases.cases[0];
  assert.ok(firstCase);
  const html = renderCasesPage({
    ...artifacts,
    cases: {
      ...artifacts.cases,
      cases: [
        {
          ...firstCase,
          tutorInput: {
            ...firstCase.tutorInput,
            studentMessage: '<img src=x onerror="alert(1)">',
          },
        },
      ],
    },
  }).content;

  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /groundTruth|knownMisconception|evaluatorOnly|rubrics/);
});
