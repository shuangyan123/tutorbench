#!/usr/bin/env node
/**
 * Diagnostic mathematics rubric counterexamples. Never a canonical benchmark.
 *
 * --dry-run checks the fixture and frozen-corpus contract without network calls.
 * --judge-deepseek explicitly opts in to paid/live Judge calls using local env.
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";

import { parseTutorScenarioSuiteVNext } from "../dist/src/contracts/tutor-scenario-vnext-validation.js";
import { parseTutorResponseCorpus, findTutorResponseCorpusValidationIssues } from "../dist/src/contracts/tutor-response-corpus-validation.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../dist/src/datasets/real-world.js";
import { deriveTutorResponseId } from "../dist/src/corpus/identity.js";
import { runTutorResponseCorpus } from "../dist/src/runner/tutor-response-corpus-runner.js";
import { createJudgeIfRequested } from "../dist/src/cli/tutorbench-evaluate.js";

function help() {
  console.log(`Usage: node scripts/math-rubric-counterexample-probe.mjs [--dry-run | --judge-deepseek] [--variant <id> ...] [--output <path>]

Defaults to --dry-run, with zero model calls.
--judge-deepseek requires DEEPSEEK_API_KEY and DEEPSEEK_JUDGE_MODEL in the local process.\n--variant <id> may repeat; select fixture response variants by stable ID.
Runs the existing TutorEval Pedagogy Judge on fixed synthetic responses, not a Tutor model.
Expected labels are author hypotheses, not human gold. A mismatch is a diagnostic result,
not a calibrated Judge accuracy estimate. No canonical dataset/rubric is changed.`);
}

function parseArgs(args) {
  let live = false;
  let output;
  const variantIds = [];
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (x === "--help" || x === "-h") return { help: true };
    if (x === "--judge-deepseek") { live = true; continue; }
    if (x === "--dry-run") { live = false; continue; }
    if (x === "--variant") {
      const id = args[++i];
      if (!id || id.startsWith("--") || variantIds.includes(id)) throw new Error("--variant must specify a distinct fixture variant ID");
      variantIds.push(id);
      continue;
    }
    if (x === "--output") {
      if (!args[i + 1]) throw new Error("--output needs a file path");
      output = resolve(args[++i]);
      continue;
    }
    throw new Error("Unknown option: " + x);
  }
  return { help: false, live, output, variantIds };
}

function assertFixture(fixture, dataset) {
  if (fixture.schemaVersion !== 1 || fixture.id !== "math-rubric-counterexamples-v0.1" ||
      fixture.calibrationStatus !== "uncalibrated" ||
      fixture.provenance !== "developer-authored-diagnostic-expectations" ||
      !Array.isArray(fixture.cases) || fixture.cases.length !== 3)
    throw new Error("Invalid probe fixture metadata");
  const seen = new Set();
  for (const group of fixture.cases) {
    const testCase = dataset.cases.find(x => x.id === group.caseId);
    if (!testCase || seen.has(group.caseId) || testCase.evaluatorOnly.disclosurePolicy !== "hint_only")
      throw new Error("Unknown, duplicate, or non-hint-only probe case: " + group.caseId);
    seen.add(group.caseId);
    if (!Array.isArray(group.variants) || group.variants.length < 4)
      throw new Error("At least four variants required per case");
    const ids = testCase.evaluatorOnly.rubrics.map(r => r.id);
    if (JSON.stringify(ids) !== JSON.stringify(group.rubricIds))
      throw new Error("Rubric identity changed for " + group.caseId);
    const names = new Set();
    for (const variant of group.variants) {
      if (!variant.id || names.has(variant.id) || !variant.responseText?.trim())
        throw new Error("Missing/duplicate/empty variant in " + group.caseId);
      names.add(variant.id);
      if (Object.keys(variant.expectedRubricResults).sort().join("|") !== [...ids].sort().join("|") ||
          Object.values(variant.expectedRubricResults).some(x => !["PASS","PARTIAL","FAIL"].includes(x)))
        throw new Error("Expected rubric status missing or invalid for " + variant.id);
    }
  }
}

function caseCorpus(dataset, group, date) {
  const testCase = dataset.cases.find(c => c.id === group.caseId);
  const tutor = { provider: "review_workspace", model: "developer-authored-counterexample",
    promptVersion: "0.1.0" };
  const identity = { corpusId: "math-rubric-probe-" + group.caseId, corpusVersion: "0.1.0",
    datasetId: dataset.id, datasetVersion: dataset.version };
  const responses = group.variants.map((variant, index) => {
    const runIndex = index + 1;
    return { schemaVersion: 1,
      responseId: deriveTutorResponseId({ ...identity, tutor, caseId: testCase.id,
        caseVersion: testCase.version, runIndex }),
      caseId: testCase.id, caseVersion: testCase.version, runIndex,
      responseText: variant.responseText, provenance: "review_workspace" };
  });
  const corpus = parseTutorResponseCorpus({ schemaVersion: 1, ...identity, createdAt: date,
    coverage: "partial", runsPerCase: group.variants.length, provenance: "review_workspace",
    tutor, responses });
  const subset = { id: dataset.id, version: dataset.version, cases: [testCase] };
  const issues = findTutorResponseCorpusValidationIssues({ corpus, dataset: subset });
  if (issues.length) throw new Error("Corpus validation failed: " + JSON.stringify(issues));
  return { corpus, subset };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { help(); return; }
  const [suiteText, fixtureText] = await Promise.all([
    readFile(resolve("scenarios/experimental/mathematics-challenge-v0.1/suite.json"), "utf8"),
    readFile(resolve("fixtures/judge/math-rubric-counterexamples-v0.1.json"), "utf8"),
  ]);
  const suite = parseTutorScenarioSuiteVNext(JSON.parse(suiteText));
  const dataset = tutorScenarioSuiteToTutorEvalDataset(suite);
  const fixture = JSON.parse(fixtureText);
  assertFixture(fixture, dataset);
  const date = "2026-10-28T00:00:00.000Z";
  const allVariantIds = new Set(fixture.cases.flatMap(group => group.variants.map(v => v.id)));
  if (opts.variantIds.some(id => !allVariantIds.has(id)))
    throw new Error("Unknown fixture variant: " + opts.variantIds.filter(id => !allVariantIds.has(id)).join(", "));
  const selectedGroups = fixture.cases.map(group => ({ ...group,
    variants: opts.variantIds.length ? group.variants.filter(v => opts.variantIds.includes(v.id)) : group.variants,
  })).filter(group => group.variants.length);
  const prepared = selectedGroups.map(group => ({ group, ...caseCorpus(dataset, group, date) }));
  const count = prepared.reduce((sum, p) => sum + p.group.variants.length, 0);
  if (!opts.live) {
    console.log(`VALIDATED: ${prepared.length} cases, ${count} synthetic responses, 0 Judge calls.`);
    if (opts.output) {
      const data = { schemaVersion: 1, status: "fixture_validated_only", fixtureId: fixture.id,
        calibrationStatus: "uncalibrated", numberOfCases: prepared.length,
        plannedJudgeCalls: count, actualJudgeCalls: 0,
        observedJudgeResults: [], limitations: ["No Judge was called: no semantic agreement is measurable."] };
      await mkdir(dirname(opts.output), { recursive: true });
      await writeFile(opts.output, JSON.stringify(data, null, 2) + "\n");
    }
    return;
  }
  if (!process.env.DEEPSEEK_API_KEY?.trim() || !process.env.DEEPSEEK_JUDGE_MODEL?.trim())
    throw new Error("--judge-deepseek requires locally configured DEEPSEEK_API_KEY and DEEPSEEK_JUDGE_MODEL");
  const judge = await createJudgeIfRequested(false, true, false);
  const observations = [];
  let actualJudgeCalls = 0;
  for (const p of prepared) {
    const result = await runTutorResponseCorpus({ corpus: p.corpus, dataset: p.subset, judge,
      runId: "math-rubric-probe-" + p.group.caseId,
      onJudgeCall: () => { actualJudgeCalls++; } });
    for (let i = 0; i < p.group.variants.length; i++) {
      const variant = p.group.variants[i];
      const run = result.evaluation.caseResults.find(r => r.caseId === p.group.caseId && r.runIndex === i + 1);
      const observed = Object.fromEntries((run?.rubricResults ?? []).map(r => [
        r.rubricId, r.result === "ERROR" ? null : r.result]));
      const availability = run?.status === "error" ? "unavailable" : "observed";
      const agrees = availability === "observed"
        ? p.group.rubricIds.every(id => observed[id] === variant.expectedRubricResults[id]) : null;
      observations.push({ caseId: p.group.caseId, variantId: variant.id, runIndex: i + 1,
        expected: variant.expectedRubricResults, observed, status: run?.status ?? "missing",
        availability, agreementWithAuthoredExpectation: agrees,
        criticalFailures: run?.criticalFailures ?? [],
        insufficientInformation: run?.rawJudgeResult?.insufficientInformation ?? null,
        diagnostics: run?.diagnostics ?? [] });
    }
  }
  const available = observations.filter(o => o.availability === "observed");
  const disagreements = available.filter(o => !o.agreementWithAuthoredExpectation);
  const unavailable = observations.filter(o => o.availability === "unavailable");
  const report = { schemaVersion: 1, fixtureId: fixture.id, fixtureVersion: fixture.version,
    provenance: fixture.provenance, calibrationStatus: "uncalibrated",
    judge: { provider: judge.provider, model: judge.model, promptId: judge.promptId,
      promptVersion: judge.promptVersion },
    selectedVariantIds: opts.variantIds,
    plannedJudgeCalls: count, actualJudgeCalls,
    availableCount: available.length, unavailableCount: unavailable.length,
    disagreementCount: disagreements.length,
    observations,
    limitations: ["Expectations are developer-authored, not independent human gold.",
      "Agreement is a diagnostic descriptive statistic, not Judge accuracy.",
      "No Tutor model was called. No learner outcomes were measured."] };
  const path = opts.output ?? resolve("artifacts/math-rubric-counterexample-probe.json");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(report, null, 2) + "\n");
  console.log(`Judge calls: ${actualJudgeCalls}/${count}; available ${available.length}; unavailable ${unavailable.length}; disagreements ${disagreements.length}.`);
  console.log("Diagnostic report: " + path);
  // Execution availability failures should be visible as errors, not counted as rubric FAIL.
  if (unavailable.length) process.exitCode = 1;
}

main().catch(error => {
  console.error("Math rubric probe failed: " + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
