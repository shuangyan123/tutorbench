import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import type {
  TutorHealthReport, TutorEvalRunResult, TutorScenarioDecisionPoint, TutorScenarioEvaluationCriterion, TutorScenarioSuiteVNext,
} from "../src/contracts/index.js";

const suiteId = "private-teaching-synthetic-test";
const earlierHint = "Mark the two positions.";
const continuation = "I marked them and still got the same result.";

const failureFinding = {
  type: "explicit_test_leak",
  title: "Explicit test answer disclosed",
  severity: "critical",
  observedBehavior: "The fixture states the forbidden test answer.",
  diagnosis: "The checkpoint allows a hint.",
  impact: "The learner loses the chance to finish.",
  likelyCauses: [],
  recommendations: [
    { kind: "diagnostic", text: "Inspect the disclosure." },
    { kind: "implementation_suggestion", text: "Leave the result for the learner." },
  ],
  regressionTargets: ["unit-check"],
  confidence: 0.6,
} as const;

function criteria(id: string): TutorScenarioEvaluationCriterion[] {
  return [
    {
      rubricId: id + "-disclosure", category: "guidance", dimension: "intervention_strategy",
      criterion: "Withhold the fixture's final answer.", weight: 1, evaluationType: "deterministic",
      behavior: "required", evaluatorId: "direct_answer_leak",
      config: { forbiddenFinalAnswer: "x=7" }, criticalFailure: { type: "answer_leakage", severity: "critical" },
      failureFinding,
    },
    {
      rubricId: id + "-diagnosis", category: "diagnosis", dimension: "learner_diagnosis",
      criterion: "Identify the stated error from the learner's evidence.", weight: 1, evaluationType: "judge",
      behavior: "required", failureFinding: { ...failureFinding, severity: "major" },
    },
    {
      rubricId: id + "-semantic-action", category: "actionability", dimension: "interaction_quality",
      criterion: "Ask for a meaningful label comparison; mentioning an arrow alone is insufficient.",
      weight: 1, evaluationType: "judge", behavior: "required",
      failureFinding: { ...failureFinding, severity: "major" },
    },
  ];
}

function syntheticPilot() {
  const fixtures: Record<string, { baseline: string; adversarial: string }> = {};
  const scenarioQuestions: Record<string, string> = {};
  const admissions: Record<string, { admitted: boolean }> = {};
  const teachingReferences = [];
  const suite: TutorScenarioSuiteVNext = {
    schemaVersion: 3, id: suiteId, version: "0.1.0", title: "Synthetic runner controls",
    description: "Fictitious non-exam prompts.", healthTaxonomyVersion: "0.1.0",
    scenarios: Array.from({ length: 6 }, (_, index) => {
      const id = "example-" + index;
      const questionId = "synthetic-question-" + index;
      const learner = { role: "user", content: "Here is my first attempt." } as const;
      const trajectory = { attemptCount: 1, failedAttempts: 1, priorHints: [], conversationHistory: [learner] };
      const decisionPoints = Array.from({ length: index < 4 ? 2 : 1 }, (_, point): TutorScenarioDecisionPoint => {
        const pointId = id + "-" + point;
        const baseline = point === 0 ? earlierHint : "Test a second representation.";
        fixtures[pointId] = {
          baseline,
          adversarial: index === 0 ? "The final answer is x=7."
            : index === 1 && point === 0 ? "The lower arrow proves your claim." : baseline,
        };
        return {
          id: "point-" + point, evaluationCaseId: pointId, turnIndex: point + 1,
          expectedDecision: "offer_conceptual_hint", expectedBehavior: "Offer a bounded hint.",
          evaluationCriteria: criteria(pointId),
          trajectory: point === 0 ? trajectory : {
            attemptCount: 2, failedAttempts: 2, priorHints: [earlierHint], conversationHistory: [
              learner, { role: "assistant", content: earlierHint }, { role: "user", content: continuation },
            ],
          },
        } as const;
      });
      scenarioQuestions[id] = questionId;
      admissions[questionId] = { admitted: index !== 5 };
      return {
        schemaVersion: 3, identity: { id, version: "0.1.0", title: "Fixture", suiteId },
        description: "Fictitious learner and problem.",
        learningContext: { subject: "mathematics", topic: "synthetic", learningObjective: "Test a step", learnerLevel: "fixture" },
        tutorVisibleContext: { knownConcepts: [] }, trajectory, teachingPolicy: { disclosure: "hint_only" },
        evaluatorReferenceState: { misconceptions: [{ statement: "ORIGINAL_PRIVATE_STATE", evidenceLearnerTurns: [1] }] },
        decisionPoints,
      };
    }),
  };
  for (const questionId of Object.keys(admissions)) {
    teachingReferences.push({ questionId, tutorStimulus: "A fictitious problem statement." });
  }
  return { pilot: { suite, teachingReferences, scenarioQuestions, fixtures,
    missingResponseCase: "example-4-0", historyLink: { previousCaseId: "example-0-0", nextCaseId: "example-0-1",
      learnerAnchor: continuation } }, admissions, inputDigests: {} };
}

interface ControlRun {
  readonly evaluation: TutorEvalRunResult;
  readonly report: TutorHealthReport;
  readonly criterionCoverage: string;
  readonly tutorPackets: readonly { caseId: string; conversation: readonly { text: string }[] }[];
  readonly byCapability: {
    guidance: { assessed: number; scored: number; total: number };
    actionability: { assessed: number; scored: number; total: number };
  };
}

test("private teaching runner replays H2, blocks unavailable packets, and retains partial rubric coverage", () => {
  const output: { variants: Record<string, ControlRun>; firewall: { packetsChecked: number } } = JSON.parse(execFileSync(
    process.execPath, ["scripts/research/run-private-exam-teaching.mjs"],
    { input: JSON.stringify(syntheticPilot()), encoding: "utf8" },
  ));
  const baseline = output.variants.baseline!;
  assert.equal(output.firewall.packetsChecked, 10);
  assert.doesNotMatch(JSON.stringify(baseline.tutorPackets), /ORIGINAL_PRIVATE_STATE|PRIVATE_EVALUATOR_CANARY/u);
  assert.equal(baseline.report.coverage.status, "partial");
  assert.equal(baseline.criterionCoverage, "PARTIAL COVERAGE");
  assert.equal(baseline.tutorPackets.find((packet) => packet.caseId === "example-0-1")?.conversation.at(-1)?.text, earlierHint);
  assert.equal(baseline.tutorPackets.some((packet) => packet.caseId === "example-5-0"), false);
  assert.deepEqual(baseline.byCapability.guidance, { assessed: 9, scored: 9, total: 10 });
  // A semantic action rubric must remain unscored without a Judge, even when
  // an adversarial response contains the superficial "lower arrow" keyword.
  assert.deepEqual(baseline.byCapability.actionability, { assessed: 0, scored: 0, total: 10 });
  assert.deepEqual(output.variants.adversarial!.byCapability.actionability,
    { assessed: 0, scored: 0, total: 10 });
  assert.equal(output.variants.adversarial!.evaluation.caseResults.find(
    (row) => row.caseId === "example-1-0")?.rawTutorResponse,
  "The lower arrow proves your claim.");
  assert.equal(baseline.evaluation.caseResults.find((row) => row.caseId === "example-0-0")?.rawJudgeResult, null);
  assert.equal(baseline.evaluation.caseResults.find((row) => row.caseId === "example-0-0")?.passed, false);
  assert.ok(output.variants.adversarial!.report.findings.some((finding) => finding.type === "answer_leakage"));
  // Two checkpoints within one scenario can report the same critical failure type.
  // Their observation identities must remain distinct and the report must validate.
  const critical = output.variants.adversarial!.report.observations.filter((observation) =>
    observation.type === "critical_failure" && observation.scenarioId === "example-0" &&
    observation.evidence.some((evidence) => evidence.kind === "critical_failure" &&
      (evidence.caseId === "example-0-0" || evidence.caseId === "example-0-1")),
  );
  assert.equal(critical.length, 2);
  assert.equal(new Set(critical.map((observation) => observation.id)).size, 2);
  for (const variant of ["missingResponse", "historyMismatch"]) {
    assert.deepEqual(output.variants[variant]!.byCapability.guidance, { assessed: 8, scored: 8, total: 10 });
  }
});
