import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { toTutorTurnInput } from "../src/contracts/tutor-eval.js";
import { loadTutorEvalDataset } from "../src/datasets/index.js";
import { evaluateHintFit } from "../src/research/learner-evidence-hint-rubric.js";
import { summarizeHintMeasurement, type HintMeasurementRow } from "../src/research/learner-evidence-hint-measurement.js";
import {
  createHintPilot, hintPilotId, hintSource, resolveHintEvidence,
} from "../src/research/learner-evidence-hint-scenarios.js";

const dataset = await loadTutorEvalDataset(hintSource.datasetId, hintSource.datasetVersion);
const baseline = structuredClone(dataset);
const cases = createHintPilot(dataset);
const [a, b, c] = cases;
assert.ok(a && b && c);

test("vNext replay keeps the original goal, prompt and historical scoring identity", async () => {
  const review = JSON.parse(await readFile("docs/research/learner-evidence-hint-maintainer-review-v0.1.json", "utf8"));
  const source = dataset.cases.find((item) => item.id === hintSource.caseId);
  assert.ok(source);
  assert.equal(source.version, "1.1.0");
  assert.equal(source.tutorInput.studentMessage, review.case.learnerQuote);
  assert.deepEqual(source.tutorInput.studentProfile?.knownConcepts, ["逆运算"]);
  assert.deepEqual(source.evaluatorOnly.rubrics.map((item) => item.id), [
    "equation-hint-no-leak-001-zh-CN",
    "equation-hint-next-step-001-zh-CN",
    "equation-hint-agency-001-zh-CN",
  ]);
  assert.deepEqual(dataset, baseline);
  assert.ok(!dataset.cases.some((item) => item.id.startsWith(hintPilotId)));
  const inputs = cases.map(({ tutorCase }) => toTutorTurnInput(tutorCase));
  for (const input of inputs) {
    assert.equal(input.currentStudentMessage, source.tutorInput.studentMessage);
    assert.equal(input.learningObjective, source.tutorInput.learningObjective);
    assert.equal(input.locale, "zh-CN");
    assert.deepEqual(input.studentState.knownConcepts, []);
    assert.deepEqual(input.studentState.misconceptions, []);
    assert.equal(input.studentState.learnerModel, undefined);
    assert.doesNotMatch(JSON.stringify(input), /explicit_gap|demonstrated_local|unknown|local-understanding|unresolved-gap|expectedMoves|evaluationCriteria|x=4/u);
  }
  assert.deepEqual(inputs.map((item) => item.conversation.map((message) => message.role)), [
    [], ["student"], ["student", "tutor", "student"],
  ]);
  assert.deepEqual(cases.map((item) => item.sourcePointer.tutorResponseTurnIndex), [1, 1, 2]);
  assert.deepEqual(cases.map((item) => item.sourcePointer.learnerTurnCount), [1, 2, 3]);
});

test("concept claims preserve unknown, local evidence and the exact failed-hint sequence", () => {
  assert.deepEqual(a.claims.map((item) => [item.status, item.observationIds]), [["unknown", []], ["unknown", []]]);
  assert.deepEqual(b.claims.map((item) => item.status), ["demonstrated_local", "unknown"]);
  assert.deepEqual(c.claims.map((item) => item.status), ["unknown", "explicit_gap"]);
  const input = toTutorTurnInput(c.tutorCase);
  assert.equal(c.priorHelp?.messageIndex, 2);
  assert.equal(c.priorHelp?.quote, input.conversation[1]?.text);
  const observed = c.observations.find((item) => item.id === c.priorHelp?.outcomeObservationId);
  assert.equal(observed?.learnerTurnIndex, 2);
  assert.equal(observed?.messageIndex, 3);
  assert.equal(observed?.quote, input.conversation[2]?.text);
});

test("reject stale quote, incompatible status and help attributed to a learner turn", () => {
  const input = toTutorTurnInput(c.tutorCase);
  const trajectory = {
    attemptCount: 2, failedAttempts: 1, priorHints: [c.priorHelp?.quote ?? ""],
    conversationHistory: [
      ...input.conversation.map((message) => ({
        role: message.role === "student" ? "user" as const : "assistant" as const,
        content: message.text,
      })),
      { role: "user" as const, content: input.currentStudentMessage },
    ],
  };
  assert.throws(() => resolveHintEvidence({
    observations: c.observations.map((item) => ({ ...item, quote: "fabricated quote" })), claims: c.claims,
  }, trajectory), /hint_evidence_quote_not_in_learner_turn/u);
  assert.throws(() => resolveHintEvidence({
    observations: c.observations,
    claims: [{ conceptId: "inverse-operations", status: "unknown", observationIds: ["equality-gap"] }],
  }, trajectory), /hint_evidence_status_mismatch/u);
  assert.throws(() => resolveHintEvidence({
    observations: c.observations,
    claims: [{ conceptId: "inverse-operations", status: "demonstrated_local", observationIds: ["equality-gap"] }],
  }, trajectory), /hint_evidence_status_mismatch/u);
  assert.throws(() => resolveHintEvidence({
    observations: c.observations, claims: c.claims,
    failedHint: { messageIndex: 1, observationId: "equality-gap" },
  }, trajectory), /hint_evidence_prior_help_mismatch/u);
  assert.throws(() => resolveHintEvidence({
    observations: c.observations.map((item) => item.id === "equality-gap"
      ? { ...item, kind: "local_reasoning" } : item),
    claims: [],
  }, trajectory), /hint_local_work_not_before_help/u);
});

test("candidate rubric yields one explained, repeatable verdict per case and response", async () => {
  const fixtures: readonly { id: string; text: string; expected: readonly string[] }[] =
    JSON.parse(await readFile("scenarios/experimental/learner-evidence-hint-v0.1/responses.json", "utf8"));
  assert.ok(fixtures.length >= 12);
  assert.equal(new Set(fixtures.map((fixture) => fixture.id)).size, fixtures.length);
  for (const fixture of fixtures) {
    const results = cases.map((pilotCase) => evaluateHintFit(pilotCase, fixture.text));
    assert.deepEqual(results.map((result) => result.verdict), fixture.expected, fixture.id);
    for (const [index, result] of results.entries()) {
      const pilotCase = cases[index]!;
      assert.deepEqual(result, evaluateHintFit(pilotCase, fixture.text));
      assert.ok(result.reason);
      assert.ok(result.expectedMoves.length >= 2);
      assert.ok(result.responseExcerpts.length);
      assert.ok(result.responseExcerpts.every((excerpt) => fixture.text.includes(excerpt)));
      assert.equal(new Set(result.responseExcerpts).size, result.responseExcerpts.length);
      assert.ok(!("score" in result));
    }
  }
  assert.equal(evaluateHintFit(c, "").verdict, "ABSTAIN");
});

test("before/after statistics compare the same referenced pairs and retain zero denominators", () => {
  const rows = [
    { condition: "unknown", baselineStatus: "eligible", baseline: "PASS", candidate: "FAIL", reference: "FAIL" },
    { condition: "unknown", baselineStatus: "eligible", baseline: "PASS", candidate: "FAIL", reference: "PASS" },
    { condition: "unknown", baselineStatus: "eligible", baseline: "FAIL", candidate: "ABSTAIN", reference: "PASS" },
    { condition: "unknown", baselineStatus: "unavailable", baseline: null, candidate: "PASS", reference: null },
    { condition: "local-understanding", baselineStatus: "not_comparable", baseline: null, candidate: "PASS", reference: "PASS" },
    { condition: "unresolved-gap", baselineStatus: "not_comparable", baseline: null, candidate: "FAIL", reference: "FAIL" },
  ] satisfies HintMeasurementRow[];
  const { overall, byCondition } = summarizeHintMeasurement(rows);
  assert.deepEqual(overall.comparableCoverage, { count: 2, denominator: 6, rate: 2 / 6 });
  assert.deepEqual(overall.unresolvedComparison, { count: 4, denominator: 6, rate: 4 / 6 });
  assert.deepEqual(overall.baselineCoverage, { count: 3, denominator: 6, rate: 0.5 });
  assert.deepEqual(overall.candidateAbstentions, { count: 1, denominator: 6, rate: 1 / 6 });
  assert.deepEqual(overall.agreement.baseline.agreement, { count: 1, denominator: 2, rate: 0.5 });
  assert.deepEqual(overall.agreement.candidate.agreement, { count: 1, denominator: 2, rate: 0.5 });
  assert.deepEqual(overall.agreement.baseline.falseAcceptance, { count: 1, denominator: 1, rate: 1 });
  assert.deepEqual(overall.agreement.candidate.falseRejection, { count: 1, denominator: 1, rate: 1 });
  assert.deepEqual(overall.fixes, { count: 1, denominator: 2, rate: 0.5 });
  assert.deepEqual(overall.regressions, { count: 1, denominator: 2, rate: 0.5 });
  for (const condition of [byCondition.B, byCondition.C]) {
    assert.deepEqual(condition.notComparable, { count: 1, denominator: 1, rate: 1 });
    assert.deepEqual(condition.agreement.candidate.agreement, { count: 0, denominator: 0, rate: null });
    assert.deepEqual(condition.regressions, { count: 0, denominator: 0, rate: null });
  }
  assert.deepEqual(summarizeHintMeasurement([]).overall.referenceCoverage, { count: 0, denominator: 0, rate: null });
});
