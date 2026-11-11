import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { RecordedTutor } from "../src/adapters/recorded-tutor.js";
import { runTutorEval } from "../src/runner/tutor-eval-runner.js";
import { buildTutorVisibleCasePacketFile } from "../src/contracts/index.js";
import { loadTutorEvalDataset } from "../src/datasets/synthetic.js";
import { runTutorResponseCorpus } from "../src/runner/tutor-response-corpus-runner.js";
import { DEFAULT_TUTOR_EVAL_SCORING_CONFIG } from "../src/scoring/index.js";
import { measurementFixture } from "./fixtures/measurement-reliability.js";
import { buildMeasurementReliabilityReport } from "../src/research/measurement-reliability.js";
import { freezeMeasurementSource, parseFrozenMeasurementSource, measurementFingerprint } from "../src/research/measurement-reliability-source.js";

test("paired frozen responses preserve both disagreement directions, PARTIAL and abstention", async () => {
  const source = await measurementFixture();
  const before = JSON.stringify(source);
  const report = await buildMeasurementReliabilityReport(source);
  assert.equal(report.calibrationStatus, "not_calibrated");
  assert.equal(report.coverage.plannedSamples, 6);
  assert.equal(report.coverage.judge, 5);
  assert.equal(report.coverage.humanReference, 0);
  assert.equal(report.strictVsJudge.validSamples, 5);
  assert.equal(report.strictVsJudge.disagreements, 4);
  assert.equal(report.strictVsJudge.rightMinusLeftPassRatePoints, 20);
  assert.deepEqual(report.strictVsJudge.matrix, { FAIL__FAIL: 1, FAIL__PARTIAL: 1, FAIL__PASS: 2, PASS__FAIL: 1 });
  assert.equal(report.judgeVsHuman.disagreementRate, null);
  assert.equal(report.rows[5]!.judge, null);
  assert.deepEqual(report.evidenceIssues, { judge_insufficient_information: 1 });
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(await buildMeasurementReliabilityReport(JSON.parse(before)), report);
});

test("custom score provenance is preserved and tampered score identities are rejected", async () => {
  const source = await measurementFixture();
  const replay = await runTutorResponseCorpus({ dataset: source.dataset, corpus: source.corpus,
    scoring: { ...DEFAULT_TUTOR_EVAL_SCORING_CONFIG, criterionScores: { PASS: 10, PARTIAL: 3, FAIL: -2 }, casePassThreshold: 6 },
    judge: { provider: "synthetic", model: "control", promptVersion: "1", async evaluate(input) {
      return { schemaVersion: 1, caseId: input.caseId, rubricResults: [{ rubricId: "correctness-control", result: "PASS" }],
        criticalFailures: [], factualErrors: [], insufficientInformation: false };
    } },
  });
  const frozen = freezeMeasurementSource(source.dataset, source.corpus, replay, source.targets);
  const report = await buildMeasurementReliabilityReport(frozen);
  assert.equal(report.source.scoringIdentity, replay.evaluation.scoringProvenance!.identity);
  assert.notEqual(report.source.scoringIdentity, source.evaluation.scoringProvenance!.identity);
  assert.equal(report.rows[0]!.judge, "PASS");
  const altered = JSON.parse(JSON.stringify(replay));
  altered.evaluation.scoringProvenance.config.criterionScores.PASS = 100;
  assert.throws(() => freezeMeasurementSource(source.dataset, source.corpus, altered, source.targets));
});

test("freeze binds response, case, rubric, score configuration and selected target bytes", async () => {
  const source = await measurementFixture();
  for (const copy of [
    { ...source, corpus: { ...source.corpus, responses: source.corpus.responses.map(r => ({ ...r, responseText: "changed" })) } },
    { ...source, dataset: { ...source.dataset, cases: source.dataset.cases.map(c => ({ ...c,
      tutorInput: { ...c.tutorInput, studentMessage: "changed" } })) } },
  ]) {
    assert.throws(() => parseFrozenMeasurementSource(copy));
  }
  const altered = { ...source, dataset: { ...source.dataset, version: "other" } };
  assert.throws(() => parseFrozenMeasurementSource(altered));
  const raw = JSON.parse(JSON.stringify(source));
  raw.dataset.cases[0].evaluatorOnly.rubrics[0].criterion = "different criterion same ID";
  assert.throws(() => parseFrozenMeasurementSource(raw), /fingerprint/);
  raw.dataset.cases[0].evaluatorOnly.rubrics[0].weight = 2;
  assert.throws(() => freezeMeasurementSource(raw.dataset, source.corpus, source.evaluation, source.targets), /source_mismatch/);
  assert.throws(() => freezeMeasurementSource(source.dataset, source.corpus, source.evaluation, []), /targets_invalid/);
});

test("legacy score provenance is unknown; absent references and results never become failures", async () => {
  const source = await measurementFixture();
  const legacy = { ...source.evaluation, scoringProvenance: undefined, evaluatorVersion: undefined };
  const result = await buildMeasurementReliabilityReport(freezeMeasurementSource(source.dataset, source.corpus, legacy, source.targets));
  assert.equal(result.coverage.judge, 0);
  assert.equal(result.evidenceIssues.missing_score_provenance, 6);
  const dataset = { ...source.dataset, cases: source.dataset.cases.map(c => ({ ...c,
    evaluatorOnly: { disclosurePolicy: c.evaluatorOnly.disclosurePolicy, rubrics: c.evaluatorOnly.rubrics },
  })) };
  const missing = await buildMeasurementReliabilityReport(freezeMeasurementSource(dataset, source.corpus, source.evaluation, source.targets));
  assert.equal(missing.coverage.strict, 0);
  assert.equal(missing.strictVsJudge.validSamples, 0);
  assert.equal(missing.strictVsJudge.leftPassRate, null);
  assert.equal(missing.evidenceIssues.missing_exact_answer_reference, 6);
});

test("contradictory raw Judge versus recorded rubric labels are rejected", async () => {
  const source = await measurementFixture();
  const evaluation = JSON.parse(JSON.stringify(source.evaluation));
  evaluation.caseResults[0].rawJudgeResult.rubricResults[0].result = "PASS";
  assert.throws(() => freezeMeasurementSource(source.dataset, source.corpus, evaluation, source.targets));
  evaluation.caseResults[0].rawJudgeResult = null;
  assert.throws(() => freezeMeasurementSource(source.dataset, source.corpus, evaluation, source.targets));
});

function annotation(source: Awaited<ReturnType<typeof measurementFixture>>, reviewerId: string, label: string, synthetic = false) {
  return { schemaVersion: 1, dataKind: synthetic ? "synthetic-fixture" : "human-annotation",
    ...(synthetic ? { fixture: { synthetic: true, notHumanCalibrationData: true } } : {}),
    datasetId: source.dataset.id, datasetVersion: source.dataset.version, reviewerId,
    annotations: [{ schemaVersion: 1, annotationId: `${reviewerId}-1`,
      datasetId: source.dataset.id, datasetVersion: source.dataset.version,
      caseId: "addition-control", caseVersion: "1", responseId: "control-1", rubricId: "correctness-control",
      reviewerId, label, createdAt: source.corpus.createdAt }],
  };
}

test("human references require existing two-reviewer resolution; synthetic labels never calibrate", async () => {
  const source = await measurementFixture();
  const synthetic = await buildMeasurementReliabilityReport(source,
    [annotation(source, "r1", "PASS", true), annotation(source, "r2", "PASS", true)], undefined, source.fingerprints);
  assert.equal(synthetic.coverage.syntheticReferencesExcluded, 1);
  assert.equal(synthetic.coverage.humanReference, 0);
  const unresolved = await buildMeasurementReliabilityReport(source,
    [annotation(source, "r1", "PASS"), annotation(source, "r2", "FAIL")], undefined, source.fingerprints);
  assert.equal(unresolved.coverage.humanUnresolved, 1);
  assert.equal(unresolved.coverage.humanReference, 0);
  const single = await buildMeasurementReliabilityReport(source, [annotation(source, "r1", "PASS")], undefined, source.fingerprints);
  assert.equal(single.coverage.humanUnresolved, 1);
  // 测试仅验证 human-annotation 分支，不能作为真实人工标注导出。
  const paired = await buildMeasurementReliabilityReport(source,
    [annotation(source, "r1", "PASS"), annotation(source, "r2", "PASS")], undefined, source.fingerprints);
  assert.equal(paired.coverage.humanReference, 1);
  assert.equal(paired.judgeVsHuman.disagreements, 1);
  assert.equal(paired.calibrationStatus, "not_calibrated");
  const mismatch = annotation(source, "r1", "PASS");
  mismatch.annotations[0]!.responseId = "foreign-response";
  await assert.rejects(buildMeasurementReliabilityReport(source, [mismatch], undefined, source.fingerprints));
  await assert.rejects(buildMeasurementReliabilityReport(source, [annotation(source, "r1", "PASS")]), /human_source_mismatch/);
  await assert.rejects(buildMeasurementReliabilityReport(source, [annotation(source, "r1", "PASS")], undefined,
    { ...source.fingerprints, corpus: "stale" }), /human_source_mismatch/);
});

test("evaluator-only evidence stays out of Tutor input and sanitized research reports", async () => {
  const source = await measurementFixture();
  const replay = new RecordedTutor(source.corpus);
  let seen = 0;
  await runTutorEval({ dataset: source.dataset, runsPerCase: 6,
    tutor: { id: replay.id, async respond(input) {
      seen++;
      assert.doesNotMatch(JSON.stringify(input), /evaluatorOnly|hidden-.*canary|rubric|groundTruth/);
      return replay.respond(input);
    } },
  });
  assert.equal(seen, 6);
  assert.doesNotMatch(JSON.stringify(buildTutorVisibleCasePacketFile(source.dataset)), /hidden-.*canary|evaluatorOnly/);
  assert.doesNotMatch(JSON.stringify(await buildMeasurementReliabilityReport(source)),
    /hidden-.*canary|groundTruth|rawJudgeResult|rawTutorResponse|responseText|criterion/);
});

test("partial corpus and unevaluated cases remain in planned denominator", async () => {
  const source = await measurementFixture();
  const dataset = { ...source.dataset, cases: [...source.dataset.cases,
    { ...source.dataset.cases[0]!, id: "missing-case" }] };
  const corpus = { ...source.corpus, coverage: "partial" as const };
  const report = await buildMeasurementReliabilityReport(freezeMeasurementSource(dataset, corpus, source.evaluation,
    [...source.targets, { caseId: "missing-case", rubricId: "correctness-control" }]));
  assert.equal(report.coverage.plannedSamples, 12);
  assert.equal(report.coverage.responses, 6);
  assert.equal(report.strictVsJudge.validSamples, 5);
  assert.equal(report.evidenceIssues.missing_response, 6);
  assert.equal(report.evidenceIssues.missing_evaluation, 6);
});

test("hint-only or non-correctness targets cannot be repurposed as answer success", async () => {
  const source = await measurementFixture();
  const dataset = JSON.parse(JSON.stringify(source.dataset));
  dataset.cases[0].evaluatorOnly.disclosurePolicy = "hint_only";
  assert.throws(() => freezeMeasurementSource(dataset, source.corpus, source.evaluation, source.targets), /not_comparable/);
});

test("existing canonical cases, corpus runner and wrapped results work unchanged without a Judge", async () => {
  const canonical = await loadTutorEvalDataset();
  const c = canonical.cases.find(c => c.id === "language-verb-check-001")!;
  const dataset = { ...canonical, cases: [c] };
  const fixture = await measurementFixture();
  const corpus = { ...fixture.corpus, datasetId: dataset.id, datasetVersion: dataset.version,
    runsPerCase: 1, responses: [{ ...fixture.corpus.responses[0]!, caseId: c.id, caseVersion: c.version }] };
  const evaluation = await runTutorResponseCorpus({ dataset, corpus });
  const frozen = freezeMeasurementSource(dataset, corpus, evaluation,
    [{ caseId: c.id, rubricId: "language-verb-solution-001" }]);
  const report = await buildMeasurementReliabilityReport(frozen);
  assert.equal(report.evidenceIssues.missing_judge_evidence, 1);
  assert.equal(report.coverage.judge, 0);
  assert.equal(report.strictVsJudge.validSamples, 0);
  assert.deepEqual(frozen.dataset, dataset);
  assert.throws(() => freezeMeasurementSource(dataset, corpus,
    { ...evaluation, corpusId: "another-corpus" }, frozen.targets), /source_mismatch/);
});

test("CLI replay is byte deterministic and refuses overwriting inputs or prior reports", async () => {
  const dir = await mkdtemp(join(tmpdir(), "measurement-pilot-"));
  try {
    const source = await measurementFixture();
    const file = join(dir, "frozen.json");
    await writeFile(file, JSON.stringify(source));
    const cli = resolve("dist/src/cli/measurement-reliability.js");
    for (const name of ["a.json", "b.json"]) {
      const result = spawnSync(process.execPath, [cli, "report", "--source", file, "--output", join(dir, name)], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    }
    assert.equal(await readFile(join(dir, "a.json"), "utf8"), await readFile(join(dir, "b.json"), "utf8"));
    const result = spawnSync(process.execPath, [cli, "report", "--source", file, "--output", file]);
    assert.equal(result.status, 1);
    assert.equal(measurementFingerprint(JSON.parse(await readFile(file, "utf8"))), measurementFingerprint(source));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
