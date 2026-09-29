import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compareTutorHealthRuns,
  formatTutorHealthComparison,
  parseTutorHealthComparison,
  isTutorHealthComparison,
  runTutorHealthEvaluation,
  type TutorHealthComparisonInput,
  type TutorEvalRunResult,
} from "../src/index.js";
import { buildTutorHealthReport } from "../src/reporting/tutor-health-reporters.js";
import { syntheticDesignPartnerPilot } from "./helpers/design-partner-pilot.js";

function rebuild(input: TutorHealthComparisonInput, overrides: Partial<TutorEvalRunResult> = {}): TutorHealthComparisonInput {
  const evaluation = { ...input.evaluation, ...overrides };
  return { ...input, evaluation, report: buildTutorHealthReport({ suite: input.suite, evaluation, scoringProfile: input.report.scoringProfile }) };
}

test("comparison rejects incompatible suite, profile, evaluator, Judge, and execution identities", async (t) => {
  const { baseline, candidate } = await syntheticDesignPartnerPilot();
  const incompatible: Record<string, TutorHealthComparisonInput> = {
    "missing evaluator": rebuild(candidate, { evaluatorVersion: undefined } as unknown as Partial<TutorEvalRunResult>),
    "changed evaluator": rebuild(candidate, { evaluatorVersion: "future-evaluator" }),
    "reused run ID": rebuild(candidate, { runId: baseline.evaluation.runId }),
    "missing Judge": rebuild(candidate, { judge: null }),
  };
  for (const [key, value] of Object.entries({
    provider: "other", model: "other", modelVersion: "new", promptId: "other", promptVersion: "new",
    temperature: 0.5, reasoningEffort: "high", thinkingMode: "enabled", maxOutputTokens: 100,
    timeoutMs: 500, maxAttempts: 2, seed: 123,
  })) {
    incompatible[`Judge ${key}`] = rebuild(candidate, { judge: { ...candidate.evaluation.judge!, [key]: value } });
  }
  for (const [key, value] of Object.entries({ id: "different", version: "9.0.0" })) {
    const suite = { ...candidate.suite, [key]: value,
      scenarios: candidate.suite.scenarios.map((scenario) => ({ ...scenario, identity: {
        ...scenario.identity, suiteId: key === "id" ? value : scenario.identity.suiteId,
      } })) };
    incompatible[`suite ${key}`] = rebuild({ ...candidate, suite }, { datasetId: suite.id, datasetVersion: suite.version });
    incompatible[`profile ${key}`] = rebuild({ ...candidate, report: {
      ...candidate.report, scoringProfile: { ...candidate.report.scoringProfile, [key]: value },
    } });
  }
  incompatible["same suite identity changed authored content"] = rebuild({ ...candidate,
    suite: { ...candidate.suite, scenarios: candidate.suite.scenarios.map((scenario, index) => index === 0 ? {
      ...scenario, decisionPoints: scenario.decisionPoints.map((point) => ({ ...point, expectedBehavior: "Changed policy boundary." })),
    } : scenario) },
  });
  incompatible["same profile identity changed weights"] = rebuild({ ...candidate, report: {
    ...candidate.report, scoringProfile: { ...candidate.report.scoringProfile, dimensionWeights: {
      ...candidate.report.scoringProfile.dimensionWeights, interaction_quality: 2,
    } },
  } });
  incompatible["repetition count"] = (await syntheticDesignPartnerPilot(2)).candidate;
  for (const [name, changed] of Object.entries(incompatible)) {
    await t.test(name, () => assert.throws(() => compareTutorHealthRuns({ baseline, candidate: changed }), /not comparable/));
  }
});

test("comparison rejects detached reports and altered execution metadata without echoing private data", async (t) => {
  const { baseline, candidate } = await syntheticDesignPartnerPilot();
  const first = candidate.evaluation.caseResults[0]!;
  const cases: Record<string, TutorHealthComparisonInput> = {
    "detached report": { ...candidate, report: baseline.report },
    "forged source run": { ...candidate, report: { ...candidate.report, sourceEvaluation: {
      ...candidate.report.sourceEvaluation, runId: "private-sentinel",
    } } },
    "missing decision identity": { ...candidate, report: { ...candidate.report, findings: candidate.report.findings.map((finding) => ({
      ...finding, location: { startTurn: finding.location.startTurn, endTurn: finding.location.endTurn },
    })) } },
    "unrecorded descriptor fields": { ...candidate, evaluation: { ...candidate.evaluation, judge: {
      ...candidate.evaluation.judge!, ...{ hiddenReasoning: "private-sentinel" },
    } } },
  };
  for (const [name, change] of Object.entries({
    "changed locale": { locale: "zh-CN" }, "missing locale": { locale: undefined },
    "changed case version": { caseVersion: "other" }, "out of range repetition": { runIndex: 2 },
    "changed rubric weight": { rubricResults: first.rubricResults.map((item) => ({ ...item, weight: item.weight + 1 })) },
  })) {
    cases[name] = { ...candidate, evaluation: { ...candidate.evaluation,
      caseResults: [{ ...first, ...change }, ...candidate.evaluation.caseResults.slice(1)] } } as TutorHealthComparisonInput;
  }
  for (const [name, changed] of Object.entries(cases)) await t.test(name, () => {
    assert.throws(() => compareTutorHealthRuns({ baseline, candidate: changed }), (error: Error) => {
      assert.doesNotMatch(error.message, /private-sentinel/);
      return true;
    });
  });
});

test("missing cases, rubric evidence, partial results, and execution errors cannot imply a resolved/new Finding", async (t) => {
  const { baseline, candidate } = await syntheticDesignPartnerPilot();
  const targetCase = "ps-first-mistake";
  for (const mode of ["missing_case", "missing_rubric", "duplicate_rubric", "partial", "error"] as const) {
    await t.test(mode, () => {
      const caseResults = candidate.evaluation.caseResults.flatMap((item) => {
        if (item.caseId !== targetCase) return [item];
        if (mode === "missing_case") return [];
        if (mode === "missing_rubric") return [{ ...item, rubricResults: [] }];
        if (mode === "duplicate_rubric") return [{ ...item, rubricResults: [...item.rubricResults, ...item.rubricResults] }];
        return [{ ...item, ...(mode === "error" ? { status: "error" as const, rawTutorResponse: null } : {}),
          rubricResults: item.rubricResults.map((rubric) => ({ ...rubric,
            result: mode === "partial" ? "PARTIAL" as const : "ERROR" as const,
            score: mode === "partial" ? 0.5 : null,
          })) }];
      });
      const changed = rebuild(candidate, { caseResults, caseRunCount: caseResults.length,
        passedCount: caseResults.filter((item) => item.status === "passed").length,
        failedCount: caseResults.filter((item) => item.status === "failed").length,
        errorCount: caseResults.filter((item) => item.status === "error").length,
      });
      for (const [left, right] of [[baseline, changed], [changed, baseline]] as const) {
        const comparison = compareTutorHealthRuns({ baseline: left, candidate: right });
        assert.equal(comparison.status, "partially_comparable");
        const row = comparison.findings.find((item) => item.identity.scenarioId === targetCase)!;
        assert.equal(row.classification, "unresolved");
        assert.ok([...row.baseline.assessments, ...row.candidate.assessments].some((item) => item.unresolvedReasons.length > 0));
      }
    });
  }
});

test("no-Judge evidence remains unresolved even with no Findings in either run", async () => {
  const { suite } = await syntheticDesignPartnerPilot();
  const options = { suite, tutor: { id: "fixture", respond: async () => ({ text: "Try checking the equation." }) } };
  const baseline = { suite, ...await runTutorHealthEvaluation({ ...options, runId: "no-judge-baseline" }) };
  const candidate = { suite, ...await runTutorHealthEvaluation({ ...options, runId: "no-judge-candidate" }) };
  const comparison = compareTutorHealthRuns({ baseline, candidate });
  assert.equal(baseline.report.findings.length, 0);
  assert.equal(candidate.report.findings.length, 0);
  assert.deepEqual(comparison.counts, { resolved: 0, persistent: 0, new: 0, unresolved: 4 });
});

test("multiple runs aggregate by authored identity and retain every source occurrence", async () => {
  const { baseline, candidate } = await syntheticDesignPartnerPilot(2);
  const comparison = compareTutorHealthRuns({ baseline, candidate });
  assert.deepEqual(comparison.counts, { resolved: 1, persistent: 1, new: 1, unresolved: 0 });
  const persistent = comparison.findings.find((item) => item.classification === "persistent")!;
  assert.equal(persistent.baseline.findings.length, 2);
  assert.equal(persistent.candidate.findings.length, 2);
  assert.deepEqual(persistent.baseline.findings.map((item) => item.runIndex), [1, 2]);
  assert.deepEqual(compareTutorHealthRuns({ baseline, candidate }), comparison);
  const partial = rebuild(candidate, { caseResults: candidate.evaluation.caseResults.map((item) =>
    item.caseId === "ps-first-mistake" && item.runIndex === 2 ? { ...item,
      rubricResults: item.rubricResults.map((rubric) => ({ ...rubric, result: "PARTIAL" as const, score: 0.5 })),
    } : item) });
  assert.equal(compareTutorHealthRuns({ baseline, candidate: partial }).findings
    .find((item) => item.identity.scenarioId === "ps-first-mistake")!.classification, "unresolved");
});

test("critical-failure Findings retain source evidence without exporting Judge rationale", async () => {
  const fixture = await syntheticDesignPartnerPilot();
  const suite = { ...fixture.suite, scenarios: [fixture.suite.scenarios[0]!] };
  const run = async (runId: string, critical: boolean) => ({ suite, ...await runTutorHealthEvaluation({
    suite, runId, tutor: { id: "fixture", respond: async () => ({ text: "Check your equation." }) },
    judge: { provider: "fixture", model: "fixture", promptVersion: "1", evaluate: async (input) => ({
      schemaVersion: 1, caseId: input.caseId,
      rubricResults: input.rubrics.map((rubric) => ({ rubricId: rubric.id, result: "PASS" })),
      criticalFailures: critical ? [{ type: "answer_leakage", severity: "critical", evidence: "private-judge-evidence" }] : [],
      factualErrors: [], insufficientInformation: false,
    }) },
  }) });
  const baseline = await run("critical-baseline", true);
  const candidate = await run("critical-candidate", false);
  const before = JSON.stringify({ baseline, candidate });
  const comparison = compareTutorHealthRuns({ baseline, candidate });
  assert.deepEqual(comparison.counts, { resolved: 1, persistent: 0, new: 0, unresolved: 0 });
  assert.ok(comparison.findings[0]!.baseline.findings[0]!.evidence.some((ref) => ref.kind === "critical_failure"));
  assert.doesNotMatch(JSON.stringify(comparison), /private-judge-evidence/);
  assert.equal(JSON.stringify({ baseline, candidate }), before);
});

test("JSON object-key order does not change source digests and historical comparison parsing remains additive", async () => {
  const { baseline, candidate } = await syntheticDesignPartnerPilot();
  function reverseKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(reverseKeys);
    if (typeof value !== "object" || value === null) return value;
    return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)]));
  }
  const comparison = compareTutorHealthRuns({ baseline, candidate });
  assert.deepEqual(compareTutorHealthRuns(reverseKeys({ baseline, candidate }) as { baseline: TutorHealthComparisonInput; candidate: TutorHealthComparisonInput }), comparison);
  const historical = { ...comparison,
    baseline: { ...comparison.baseline, evaluation: { ...comparison.baseline.evaluation, evaluatorVersion: "historical-1" } },
    candidate: { ...comparison.candidate, evaluation: { ...comparison.candidate.evaluation, evaluatorVersion: "historical-1" } },
  };
  assert.equal(parseTutorHealthComparison(historical), historical);
});

test("same Finding type at distinct decisions in one scenario is never matched together", async () => {
  const fixture = await syntheticDesignPartnerPilot();
  const scenario = fixture.suite.scenarios[0]!;
  const point = scenario.decisionPoints[0]!;
  const suite = { ...fixture.suite, scenarios: [{ ...scenario, decisionPoints: [point, {
    ...point, id: "second-decision", evaluationCaseId: "second-case",
    evaluationCriteria: point.evaluationCriteria.map((item) => ({ ...item, rubricId: `${item.rubricId}-second` })),
  }] }] };
  const run = async (runId: string, failingCase: string) => ({ suite, ...await runTutorHealthEvaluation({
    suite, runId, tutor: { id: "fixture", respond: async () => ({ text: "Check your step." }) },
    judge: { provider: "fixture", model: "fixture", promptVersion: "1", evaluate: async (input) => ({
      schemaVersion: 1, caseId: input.caseId, rubricResults: input.rubrics.map((rubric) => ({
        rubricId: rubric.id, result: input.caseId === failingCase ? "FAIL" : "PASS",
      })), criticalFailures: [], factualErrors: [], insufficientInformation: false,
    }) },
  }) });
  const comparison = compareTutorHealthRuns({ baseline: await run("baseline", point.evaluationCaseId), candidate: await run("candidate", "second-case") });
  assert.deepEqual(comparison.counts, { resolved: 1, persistent: 0, new: 1, unresolved: 0 });
  assert.equal(new Set(comparison.findings.map((item) => item.identity.type)).size, 1);
});

test("comparison validation rejects tampering and keeps only bounded evidence, with detached output", async () => {
  const { baseline, candidate } = await syntheticDesignPartnerPilot();
  const comparison = compareTutorHealthRuns({ baseline, candidate });
  for (const invalid of [
    null, {}, { ...comparison, schemaVersion: 999 }, { ...comparison, privatePayload: "private-sentinel" },
    { ...comparison, counts: { ...comparison.counts, resolved: 10 } },
    { ...comparison, status: "partially_comparable" },
    { ...comparison, findings: [...comparison.findings, comparison.findings[0]] },
    { ...comparison, findings: comparison.findings.map((item) => ({ ...item, classification: "new" })) },
    { ...comparison, baseline: { ...comparison.baseline, judge: { ...comparison.baseline.judge, hiddenReasoning: "private-sentinel" } } },
    { ...comparison, findings: comparison.findings.map((item) => ({ ...item, baseline: { ...item.baseline, assessments: [] } })) },
  ]) {
    assert.equal(isTutorHealthComparison(invalid), false);
    assert.throws(() => parseTutorHealthComparison(invalid), /comparison is invalid/);
  }
  const serialized = JSON.stringify(comparison);
  assert.doesNotMatch(serialized, /"(?:rawTutorResponse|rawJudgeResult|diagnosis|conversationHistory|criterion)"|private-sentinel/);
  assert.ok(!serialized.includes(baseline.evaluation.caseResults[0]!.rawTutorResponse!));
  assert.notEqual(comparison.baseline.tutor, baseline.evaluation.tutor);
  assert.notEqual(comparison.baseline.scoringProfile, baseline.report.scoringProfile);
  assert.match(formatTutorHealthComparison(comparison), /not a score delta/);
});
