import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateCohenKappa,
  calculateWeightedCohenKappa,
  compareReviewerAnnotations,
  calculateCriticalFailureAgreementForPairs,
} from "../src/calibration/index.js";
import {
  assertValidTutorEvalRunResult,
  parseTutorEvalCase,
  type CalibrationConfusionMatrix,
  type HumanCriticalFailureAnnotation,
  type HumanRubricAnnotation,
  type TutorEvalRunResult,
  type TutorEvalFailureSignalMetrics,
} from "../src/contracts/index.js";
import { runTutorEval } from "../src/runner/index.js";
import { buildTutorEvalLocaleBreakdowns, formatTutorEvalSummary } from "../src/reporting/index.js";

function annotation(reviewerId: string, responseId: string, label: HumanRubricAnnotation["label"]): HumanRubricAnnotation {
  return {
    schemaVersion: 1, annotationId: `${reviewerId}-${responseId}`, datasetId: "synthetic",
    datasetVersion: "1", caseId: "case", caseVersion: "1", responseId, rubricId: "rubric",
    reviewerId, label, createdAt: "2026-10-14T00:00:00Z",
  };
}

test("single-label perfect agreement leaves Cohen and weighted kappa undefined", () => {
  for (const label of ["PASS", "PARTIAL", "FAIL"] as const) {
    const agreement = compareReviewerAnnotations("a", "b", [annotation("a", "1", label)], [annotation("b", "1", label)]);
    assert.equal(agreement.exactAgreement, 1);
    assert.equal(agreement.scoredExactAgreement, 1);
    assert.equal(agreement.confusionMatrix[label][label], 1);
    assert.equal(agreement.cohenKappa, null);
    assert.equal(agreement.weightedCohenKappa, null);
    assert.equal(JSON.parse(JSON.stringify(agreement)).cohenKappa, null);
  }
});

test("empty and unsure-only matrices remain undefined while nondegenerate estimates are unchanged", () => {
  const empty: CalibrationConfusionMatrix = {
    PASS: { PASS: 0, PARTIAL: 0, FAIL: 0 }, PARTIAL: { PASS: 0, PARTIAL: 0, FAIL: 0 }, FAIL: { PASS: 0, PARTIAL: 0, FAIL: 0 },
  };
  assert.equal(calculateCohenKappa(empty), null);
  assert.equal(calculateWeightedCohenKappa(empty), null);
  const varied: CalibrationConfusionMatrix = {
    PASS: { PASS: 1, PARTIAL: 1, FAIL: 0 }, PARTIAL: { PASS: 0, PARTIAL: 1, FAIL: 0 }, FAIL: { PASS: 0, PARTIAL: 0, FAIL: 1 },
  };
  assert.ok(Math.abs(calculateCohenKappa(varied)! - 7 / 11) < 1e-9);
  assert.ok(Math.abs(calculateWeightedCohenKappa(varied)! - 5 / 7) < 1e-9);
  const mixed = compareReviewerAnnotations("a", "b", [annotation("a", "1", "PASS"), annotation("a", "2", "UNSURE")], [annotation("b", "1", "PASS"), annotation("b", "2", "FAIL")]);
  assert.equal(mixed.pairedJudgmentCount, 2);
  assert.equal(mixed.scoredJudgmentCount, 1);
  assert.equal(mixed.exactAgreement, 0.5);
  assert.equal(mixed.scoredExactAgreement, 1);
  assert.equal(mixed.cohenKappa, null);
});

function critical(reviewerId: string, decision: "PRESENT" | "ABSENT"): HumanCriticalFailureAnnotation {
  return {
    schemaVersion: 1, annotationId: `${reviewerId}-critical`, targetId: "target", datasetId: "synthetic",
    datasetVersion: "1", caseId: "case", caseVersion: "1", responseId: "response", reviewerId,
    decision, ...(decision === "PRESENT" ? { failureType: "answer_leakage" as const, severity: "major" as const } : {}),
    createdAt: "2026-10-14T00:00:00Z",
  };
}

test("critical presence and single-severity perfect agreement retain matrices without fabricated kappa", () => {
  for (const decision of ["PRESENT", "ABSENT"] as const) {
    const metrics = calculateCriticalFailureAgreementForPairs([{ left: critical("a", decision), right: critical("b", decision) }]);
    assert.equal(metrics.exactAgreement, 1);
    assert.equal(metrics.presenceConfusionMatrix[decision][decision], 1);
    assert.equal(metrics.cohenKappa, null);
    assert.equal(metrics.severity.weightedCohenKappa, null);
    if (decision === "PRESENT") {
      assert.equal(metrics.severity.exactAgreement, 1);
      assert.equal(metrics.severity.confusionMatrix.major.major, 1);
    }
  }
});

test("critical presence agreement over both labels keeps defined perfect kappa", () => {
  const metrics = calculateCriticalFailureAgreementForPairs([
    { left: critical("a", "PRESENT"), right: critical("b", "PRESENT") },
    { left: { ...critical("a", "ABSENT"), targetId: "other", responseId: "other" }, right: { ...critical("b", "ABSENT"), targetId: "other", responseId: "other" } },
  ]);
  assert.equal(metrics.cohenKappa, 1);
  assert.equal(metrics.scoredExactAgreement, 1);
  assert.deepEqual(metrics.presenceConfusionMatrix, { PRESENT: { PRESENT: 1, ABSENT: 0 }, ABSENT: { PRESENT: 0, ABSENT: 1 } });
});

async function evaluation(modes: readonly ("pass" | "failure" | "transport" | "abstention" | "positive-abstention")[]): Promise<TutorEvalRunResult> {
  const cases = modes.map((_, index) => parseTutorEvalCase({
    schemaVersion: 1, id: `case-${index}`, version: "1.0.0", locale: "en",
    metadata: { subject: "synthetic", topic: "signal evidence" },
    tutorInput: { learningObjective: "Give a hint.", studentMessage: "Help?" },
    evaluatorOnly: { disclosurePolicy: "hint_only", rubrics: [{ id: `rubric-${index}`, category: "guidance", criterion: "Give a useful hint.", weight: 1, evaluationType: "judge" }] },
  }));
  return runTutorEval({
    dataset: { id: "synthetic-signal-evidence", version: "1", cases },
    tutor: { id: "synthetic", respond: async () => ({ text: "A controlled hint." }) },
    judge: { provider: "synthetic", model: "controlled", promptVersion: "test", evaluate: async (input) => {
      const mode = modes[Number(input.caseId.split("-")[1])];
      if (mode === "transport") throw new Error("controlled transport failure");
      return { schemaVersion: 1, caseId: input.caseId, rubricResults: input.rubrics.map((rubric) => ({ rubricId: rubric.id, result: "PASS" })),
        criticalFailures: mode === "failure" || mode === "positive-abstention" ? [{ type: "answer_leakage", severity: "major", evidence: "Synthetic confirmed leakage." }] : [], factualErrors: [], insufficientInformation: mode === "abstention" || mode === "positive-abstention" };
    } },
  });
}

test("no valid Judge evidence is unknown in both global and locale reports", async () => {
  const result = await evaluation(["transport"]);
  const summary = formatTutorEvalSummary(result);
  assert.match(summary, /Critical failure rate: n\/a/);
  assert.match(summary, /Answer leakage rate: n\/a/);
  assert.doesNotMatch(summary, /(?:Critical failure rate|Answer leakage rate): 0\.00%/);
  const locale = buildTutorEvalLocaleBreakdowns(result)[0]!;
  assert.equal(locale.criticalFailureRate, null);
  assert.equal(locale.answerLeakageRate, null);
});

test("partial evidence preserves confirmed signals and identifies the unavailable denominator", async () => {
  const result = await evaluation(["pass", "failure", "transport"]);
  const summary = formatTutorEvalSummary(result);
  assert.match(summary, /Critical failure rate: n\/a/);
  assert.match(summary, /Answer leakage rate: n\/a/);
  const metadata = (result as unknown as { failureSignalMetrics?: TutorEvalFailureSignalMetrics }).failureSignalMetrics;
  assert.deepEqual(metadata, {
    schemaVersion: 1,
    criticalFailures: { confirmedCount: 1, knownAbsentCount: 1, unavailableCount: 1, rate: null },
    answerLeakage: { confirmedCount: 1, knownAbsentCount: 1, unavailableCount: 1, rate: null },
  });
});

test("structured abstention retains confirmed positives while unknown negatives stay unavailable", async () => {
  const result = await evaluation(["positive-abstention", "abstention"]);
  assert.equal(result.caseResults[0]?.answerLeakage, true);
  const metric = (result as { failureSignalMetrics?: TutorEvalFailureSignalMetrics }).failureSignalMetrics;
  assert.deepEqual(metric?.criticalFailures, { confirmedCount: 1, knownAbsentCount: 0, unavailableCount: 1, rate: null });
  assert.deepEqual(metric?.answerLeakage, { confirmedCount: 1, knownAbsentCount: 0, unavailableCount: 1, rate: null });
  assert.match(formatTutorEvalSummary(result), /Answer leakage rate: n\/a \(confirmed 1; observed absent 0; unavailable 1\)/);
});

test("deterministic-only negative evaluation does not establish absence of all semantic failures", async () => {
  const tutorEvalCase = parseTutorEvalCase({ schemaVersion: 1, id: "deterministic", version: "1", metadata: { subject: "synthetic", topic: "proxy" },
    tutorInput: { learningObjective: "Give a useful hint.", studentMessage: "Help?" }, evaluatorOnly: { disclosurePolicy: "hint_only", rubrics: [{ id: "proxy", category: "guidance", criterion: "Contains a next step.", weight: 1, evaluationType: "deterministic", evaluatorId: "contains_required_concept", config: { requiredConcepts: ["next step"] } }] } });
  const result = await runTutorEval({ dataset: { id: "synthetic", version: "1", cases: [tutorEvalCase] }, tutor: { id: "synthetic", respond: async () => ({ text: "A next step." }) } });
  assert.equal(result.overallScore, 1);
  assert.match(formatTutorEvalSummary(result), /Critical failure rate: n\/a/);
});

test("complete evidence retains real zero and nonzero rates while empty samples are unknown", async () => {
  const complete = await evaluation(["pass", "failure"]);
  assertValidTutorEvalRunResult(JSON.parse(JSON.stringify(complete)));
  assert.match(formatTutorEvalSummary(complete), /Critical failure rate: 50\.00%/);
  const zero = await evaluation(["pass"]);
  assert.match(formatTutorEvalSummary(zero), /Answer leakage rate: 0\.00%/);
  const empty = await runTutorEval({ dataset: { id: "synthetic-empty-statistics", version: "1", cases: [] },
    tutor: { id: "synthetic-empty", respond: async () => { throw new Error("Empty scope must not execute a Tutor."); } } });
  assert.match(formatTutorEvalSummary(empty), /Critical failure rate: n\/a/);
});

test("historical v1 stays readable but supplied signal coverage cannot forge absence", async () => {
  const historical = await evaluation(["transport"]);
  delete (historical as unknown as { failureSignalMetrics?: unknown }).failureSignalMetrics;
  assertValidTutorEvalRunResult(historical);
  assert.match(formatTutorEvalSummary(historical), /Answer leakage rate: n\/a/);
  const contradiction = { ...historical, failureSignalMetrics: { schemaVersion: 1,
    criticalFailures: { confirmedCount: 0, knownAbsentCount: 1, unavailableCount: 0, rate: 0 },
    answerLeakage: { confirmedCount: 0, knownAbsentCount: 1, unavailableCount: 0, rate: 0 } } };
  assert.throws(() => assertValidTutorEvalRunResult(contradiction), /TutorEval result is invalid/);
});
