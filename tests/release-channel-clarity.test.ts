import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { TUTOR_EVAL_DATASET_ID } from "../src/contracts/index.js";
import { buildPublicBenchmarkArtifacts, loadTutorEvalDataset } from "../src/datasets/index.js";
import { renderPage } from "../src/site/html.js";
import { renderDocsPage, renderRunPage } from "../src/site/pages/developer.js";

test("Run and Docs distinguish released Node 22 CLI from current Node 24 workflows", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID));
  for (const render of [renderRunPage, renderDocsPage]) {
    const html = renderPage(render(artifacts));
    assert.match(html, /data-release-channel-boundary/);
    assert.match(html, /Published npm 0\.1\.0 requires Node 22 and includes Quickstart, but has no Tutor Health CLI or API/);
    assert.match(html, /npm install tutor-benchmark@0\.1\.0/);
    assert.match(html, /npx --no-install tutorbench quickstart/);
    assert.doesNotMatch(html, /Install the released CLI, then run the same deterministic demo/);
  }
  const run = renderRunPage(artifacts).content;
  assert.match(run, /node dist\/src\/cli\/tutorbench\.js health/);
  assert.match(run, /generic Chat Completions/);
});

test("Chinese installation entry preserves the same release distinction", async () => {
  const artifacts = buildPublicBenchmarkArtifacts(await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID));
  for (const render of [renderRunPage, renderDocsPage]) {
    const html = renderPage(render(artifacts, "zh-CN"), { locale: "zh-CN" });
    assert.match(html, /已发布 npm 0\.1\.0 要求 Node 22，包含 Quickstart，但没有 Tutor Health CLI 或 API/);
    assert.match(html, /已发布 0\.1\.0 · Node 22/);
    assert.match(html, /仓库 main · Node 24/);
    assert.doesNotMatch(html, /Historical CLI with Quickstart|Check release channels and API boundaries/);
    assert.match(html, /npm install tutor-benchmark@0\.1\.0/);
  }
});

test("current stress documentation tracks the authored suite without replacing historical budgets", async () => {
  const suite = JSON.parse(await readFile(join(process.cwd(), "scenarios/case-system-vnext/evaluator-stress-fixtures.json"), "utf8")) as {
    id: string;
    version: string;
    fixtures: unknown[];
  };
  const doc = await readFile(join(process.cwd(), "docs/case-system-vnext-evaluator-stress.md"), "utf8");
  assert.ok(doc.includes(`${suite.id}@${suite.version}`));
  assert.ok(doc.includes(`**${suite.fixtures.length} fixtures**`));
  assert.ok(doc.includes(`${suite.fixtures.length * 2} judgments at \`--runs 1\``));
  assert.match(doc, /historical fifteen-fixture plan/);
  assert.match(doc, /30 Judge calls; `--runs 3` planned 90 calls/);
  assert.doesNotMatch(doc, /The current eight fixtures|The default live smoke.*15 fixtures/);
});
