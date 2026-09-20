import test from "node:test";
import assert from "node:assert/strict";
import { buildPublicBenchmarkArtifacts, loadTutorEvalDataset } from "../src/datasets/index.js";
import { TUTOR_EVAL_DATASET_ID } from "../src/contracts/index.js";
import { renderDataIndexPage } from "../src/site/pages/benchmark.js";
import { renderPage, escapeHtml, humanize } from "../src/site/html.js";

const load = async () => buildPublicBenchmarkArtifacts(await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID));

test("benchmark derives counts, distributions and subject-locale cells from public artifacts", async () => {
  const a = await load();
  const html = renderPage(renderDataIndexPage(a), { basePath: "/preview", locale: "zh-CN" });
  assert.match(html, /Benchmark — Teachometry/);
  assert.match(html, /href="\/preview\/assets\/benchmark.css"/);
  assert.match(html, /href="\/preview\/data\/" aria-current="page"/);
  assert.match(html, /lang="zh-CN"/);
  assert.ok(html.includes(`${a.benchmark.coverage.rubricCount} rubrics`));
  assert.ok(html.includes(`View all ${Object.keys(a.benchmark.coverage.casesByCapabilityTag).length} capabilities`));
  assert.match(html, /Cases with each category; categories overlap/);
  assert.match(html, /No public model trials available yet/);
  assert.doesNotMatch(html, /evaluatorOnly|groundTruth/);
  const subject = Object.keys(a.benchmark.coverage.casesBySubject)[0]!;
  const locale = Object.keys(a.benchmark.coverage.casesByLocale)[0]!;
  const count = a.cases.cases.filter(c => c.metadata.subject === subject && (c.locale ?? "en") === locale).length;
  const row = html.split(`<th scope="row">${escapeHtml(humanize(subject))}</th>`)[1]?.split("</tr>")[0];
  assert.ok(row?.includes(`aria-hidden="true"></span>${count}</td>`));
  const subjectCount = a.benchmark.coverage.casesBySubject[subject]!;
  assert.ok(html.includes(`${subjectCount} <small>(${Math.round(subjectCount / a.benchmark.coverage.caseCount * 100)}%)</small>`));
});

test("dataset growth updates counts, bounds hero taxonomies and escapes authored labels", async () => {
  const a = await load();
  const counts = Object.fromEntries(Array.from({ length: 20 }, (_, n) => [`subject-${n}`, 1]));
  const changed = { ...a, benchmark: { ...a.benchmark, coverage: { ...a.benchmark.coverage, caseCount: 77, rubricCount: 333, casesBySubject: counts, casesByStudentState: { '<script>alert(1)</script>': 77 } } } };
  const html = renderDataIndexPage(changed).content;
  assert.match(html, /Browse 77 authored/);
  assert.match(html, /333 rubrics/);
  assert.match(html, /View all 20 subjects/);
  assert.match(html, /&lt;script&gt;/i);
  assert.doesNotMatch(html, /<script>alert/);
  const hero = html.split('class="benchmark-explore"')[0]!;
  assert.equal((hero.match(/<th scope="row">/g) ?? []).length, 6);
});

test("empty coverage avoids invalid ratios; schema changes require explicit review", async () => {
  const a = await load();
  const empty = { ...a, cases: { ...a.cases, cases: [] }, benchmark: { ...a.benchmark, coverage: { ...a.benchmark.coverage, caseCount: 0, casesBySubject: {}, casesByLocale: {}, casesByCapabilityTag: {} } } };
  const html = renderDataIndexPage(empty).content;
  assert.match(html, /No public cases available/);
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.throws(() => renderDataIndexPage({ ...a, benchmark: { ...a.benchmark, dimensions: { ...a.benchmark.dimensions, score: [...a.benchmark.dimensions.score].reverse() } } }), /explicitly version/);
  const other = renderPage({ title: "Cases", description: "", route: "/data/cases/", content: "" });
  assert.doesNotMatch(other, /benchmark.css|benchmark-page/);
});
