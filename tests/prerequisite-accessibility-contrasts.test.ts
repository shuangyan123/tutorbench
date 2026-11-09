import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { resolve } from "node:path";

import { parseTutorScenarioSuiteVNext } from "../src/contracts/tutor-scenario-vnext-validation.js";
import { toTutorTurnInput, type TutorEvalJudgeInput } from "../src/contracts/index.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../src/datasets/real-world.js";
import { parseTutorHealthCliOptions } from "../src/cli/tutorbench-health.js";
import { runTutorEval } from "../src/runner/tutor-eval-runner.js";
import { runTutorHealthEvaluation } from "../src/runner/tutor-health-runner.js";
import { buildTutorHealthReport } from "../src/reporting/tutor-health-reporters.js";
import { UNSCOPED_TUTOR_HEALTH_SCORING_PROFILE } from "../src/contracts/tutor-health.js";

const suiteUrl = new URL(
  "../../scenarios/experimental/prerequisite-accessibility-contrasts-v0.1/suite.json",
  import.meta.url,
);
const suiteFile = resolve("scenarios/experimental/prerequisite-accessibility-contrasts-v0.1/suite.json");

async function loadSuite() {
  return parseTutorScenarioSuiteVNext(JSON.parse(await readFile(suiteUrl, "utf8")) as unknown);
}

test("eight non-canonical H1 cases compile through existing vNext → TutorEval contracts", async () => {
  const suite = await loadSuite();
  assert.equal(suite.id, "prerequisite-accessibility-contrasts-v0.1");
  assert.equal(suite.version, "0.1.0");
  assert.equal(suite.scenarios.length, 8);
  const dataset = tutorScenarioSuiteToTutorEvalDataset(suite);
  assert.equal(dataset.cases.length, 8);
  assert.deepEqual(
    suite.scenarios.map((scenario) => scenario.identity.id),
    ["pac-m-a", "pac-m-b", "pac-p-a", "pac-p-b", "pac-c-a", "pac-c-b", "pac-b-a", "pac-b-b"],
  );
  assert.deepEqual(
    suite.scenarios.map((scenario) => scenario.learningContext.subject),
    ["mathematics", "mathematics", "physics", "physics", "chemistry", "chemistry", "biology", "biology"],
  );
  const rubricIds = suite.scenarios.flatMap((scenario) =>
    scenario.decisionPoints.flatMap((point) => point.evaluationCriteria.map((r) => r.rubricId)),
  );
  assert.equal(rubricIds.length, 16);
  assert.equal(new Set(rubricIds).size, 16);
  for (const scenario of suite.scenarios) {
    assert.equal(scenario.decisionPoints.length, 1);
    assert.equal(scenario.decisionPoints[0]?.turnIndex, 1);
    assert.equal(scenario.decisionPoints[0]?.evaluationCriteria.length, 2);
    assert.ok(scenario.decisionPoints[0]?.evaluationCriteria.every((r) =>
      r.evaluationType === "judge" && r.behavior === "required" && r.weight === 1));
    assert.equal(scenario.trajectory.conversationHistory.length, 1);
    assert.equal(scenario.trajectory.conversationHistory[0]?.role, "user");
    assert.equal(scenario.tutorVisibleContext.knownConcepts.length, 0);
  }
});

test("each evidence pair preserves the goal and disclosure and changes only the learner-evidence suffix", async () => {
  const suite = await loadSuite();
  const expectedDisclosure = { m: "hint_only", p: "hint_only", c: "full_solution_allowed", b: "full_solution_allowed" } as const;
  const aSuffix = { m: "", p: "", c: "I don't know what a number in front of a formula counts.", b: "" } as const;
  const bSuffix = {
    m: "My reason was that any rule that works in one direction must work in the other direction.",
    p: "There is only one path for charge, so both resistors carry the same steady current.",
    c: "A number in front counts the specified entities: molecules for O₂, formula units for MgO, and atoms for Mg.",
    b: "If the membrane lets water through, couldn't some water molecules also cross from right to left?",
  } as const;
  for (const subject of ["m", "p", "c", "b"] as const) {
    const a = suite.scenarios.find((s) => s.identity.id === `pac-${subject}-a`);
    const b = suite.scenarios.find((s) => s.identity.id === `pac-${subject}-b`);
    assert.ok(a);
    assert.ok(b);
    assert.deepEqual(a.learningContext, b.learningContext);
    assert.deepEqual(a.tutorVisibleContext, b.tutorVisibleContext);
    assert.equal(a.teachingPolicy.disclosure, expectedDisclosure[subject]);
    assert.equal(b.teachingPolicy.disclosure, expectedDisclosure[subject]);
    assert.equal(a.trajectory.attemptCount, b.trajectory.attemptCount);
    assert.equal(a.trajectory.failedAttempts, b.trajectory.failedAttempts);
    const textA = a.trajectory.conversationHistory[0]!.content;
    const textB = b.trajectory.conversationHistory[0]!.content;
    assert.ok(textA.endsWith(aSuffix[subject]));
    assert.ok(textB.endsWith(bSuffix[subject]));
    const shared = subject === "c" ? textA.slice(0, -aSuffix.c.length) : textA;
    assert.equal(textA, shared + aSuffix[subject]);
    assert.equal(textB, shared + (subject === "c" ? bSuffix.c : ` ${bSuffix[subject]}`));
  }
});

test("reference diagnosis remains evaluator-only; local correct reasoning is preserved in Tutor input", async () => {
  const suite = await loadSuite();
  const dataset = tutorScenarioSuiteToTutorEvalDataset(suite);
  const mA = dataset.cases.find((item) => item.id === "pac-m-a");
  const mB = dataset.cases.find((item) => item.id === "pac-m-b");
  const pB = dataset.cases.find((item) => item.id === "pac-p-b");
  const cB = dataset.cases.find((item) => item.id === "pac-c-b");
  const bB = dataset.cases.find((item) => item.id === "pac-b-b");
  assert.ok(mA && mB && pB && cB && bB);
  assert.equal(mA.evaluatorOnly.knownMisconception, undefined);
  assert.match(mB.evaluatorOnly.knownMisconception ?? "", /supported by authored learner turn 1/);
  for (const item of dataset.cases) {
    const input = toTutorTurnInput(item);
    assert.deepEqual(input.studentState.misconceptions, []);
    assert.doesNotMatch(JSON.stringify(input), /supported by authored learner turn/);
    assert.doesNotMatch(JSON.stringify(input), /evaluationCriteria|expectedBehavior|failureFinding/);
    assert.ok(input.currentStudentMessage.length > 0);
  }
  assert.match(toTutorTurnInput(mB).currentStudentMessage, /must work in the other direction/);
  assert.match(toTutorTurnInput(pB).currentStudentMessage, /same steady current/);
  assert.match(toTutorTurnInput(cB).currentStudentMessage, /formula units for MgO/);
  assert.match(toTutorTurnInput(bB).currentStudentMessage, /cross from right to left/);
});

test("invalid evidence reference or duplicated case identity fails the existing parser", async () => {
  const suite = await loadSuite();
  const invalid = structuredClone(suite) as unknown as {
    scenarios: Array<{
      identity: { id: string };
      evaluatorReferenceState: { misconceptions: Array<{ statement: string; evidenceLearnerTurns: number[] }> };
    }>;
  };
  const mA = invalid.scenarios.find((s) => s.identity.id === "pac-m-a");
  assert.ok(mA);
  mA.evaluatorReferenceState.misconceptions.push({
    statement: "Unsupported assertion about an unobserved learner state",
    evidenceLearnerTurns: [2],
  });
  assert.throws(() => parseTutorScenarioSuiteVNext(invalid), (error: unknown) =>
    error instanceof Error && "code" in error && error.code === "tutor_scenario_vnext_invalid");
  const duplicates = structuredClone(suite) as unknown as {
    scenarios: Array<{ identity: { id: string } }>;
  };
  const last = duplicates.scenarios[7]!;
  last.identity.id = duplicates.scenarios[0]!.identity.id;
  assert.throws(() => parseTutorScenarioSuiteVNext(duplicates), (error: unknown) =>
    error instanceof Error && "code" in error && error.code === "tutor_scenario_vnext_invalid");
});

test("existing --suite-file CLI entry accepts the research suite without extending canonical suite registration", () => {
  const parsed = parseTutorHealthCliOptions([
    "--http", "https://example.test/respond",
    "--tutor-provider", "synthetic",
    "--tutor-model", "fixture",
    "--prompt-version", "test-1",
    "--suite-file", suiteFile,
  ]);
  assert.equal(parsed.help, false);
  if (parsed.help) return;
  assert.equal(parsed.suiteFile, suiteFile);
  assert.equal(parsed.suiteId, undefined);
  assert.throws(() => parseTutorHealthCliOptions([
    "--http", "https://example.test/respond",
    "--tutor-provider", "synthetic", "--tutor-model", "fixture", "--prompt-version", "test-1",
    "--suite", "productive-struggle-intervention-v0.1", "--suite-file", suiteFile,
  ]));
});

test("existing TutorEval runner executes all eight cases with synthetic adapters and zero provider calls", async () => {
  const dataset = tutorScenarioSuiteToTutorEvalDataset(await loadSuite());
  const seenTutor: string[] = [];
  const seenJudge: string[] = [];
  const result = await runTutorEval({
    dataset,
    tutor: {
      id: "synthetic-accessibility-fixture",
      respond: async (input) => {
        seenTutor.push(input.caseId ?? input.scenarioId);
        assert.deepEqual(input.studentState.misconceptions, []);
        return { text: "Synthetic runner plumbing reply; not a reviewed teaching response." };
      },
    },
    tutorDescriptor: { provider: "synthetic", model: "fixture", promptVersion: "test-1" },
    judge: {
      provider: "synthetic-test",
      model: "all-pass-fixture",
      promptVersion: "test-1",
      evaluate: async (input: TutorEvalJudgeInput) => {
        seenJudge.push(input.caseId);
        return {
          schemaVersion: 1 as const,
          caseId: input.caseId,
          rubricResults: input.rubrics.map((rubric) => ({ rubricId: rubric.id, result: "PASS" as const })),
          criticalFailures: [],
          factualErrors: [],
          insufficientInformation: false,
        };
      },
    },
    runId: "accessibility-contract-plumbing-no-api",
  });
  assert.equal(result.caseCount, 8);
  assert.equal(result.caseRunCount, 8);
  assert.equal(result.errorCount, 0);
  assert.equal(seenTutor.length, 8);
  assert.equal(seenJudge.length, 8);
  assert.deepEqual(seenTutor, [...seenTutor].sort());
  assert.deepEqual(seenJudge, seenTutor);
  // All-pass Judge is deliberately synthetic: these assertions test wiring,
  // NOT pedagogy validity, human agreement, or actual learning outcomes.
});

test("eight H1 cases retain source identities through TutorEval, Tutor Health, and finding evidence", async () => {
  const suite = await loadSuite();
  const { evaluation, report } = await runTutorHealthEvaluation({
    suite,
    tutor: {
      id: "synthetic-evidence-traceability",
      respond: async (input) => {
        assert.deepEqual(input.studentState.misconceptions, []);
        return { text: "A synthetic response. No pedagogical quality is claimed." };
      },
    },
    tutorDescriptor: { provider: "synthetic", model: "fixture", promptVersion: "traceability-1" },
    judge: {
      provider: "synthetic-test",
      model: "forced-fail-fixture",
      promptVersion: "traceability-1",
      evaluate: async (input: TutorEvalJudgeInput) => ({
        schemaVersion: 1 as const,
        caseId: input.caseId,
        rubricResults: input.rubrics.map((rubric) => ({
          rubricId: rubric.id,
          result: "FAIL" as const,
        })),
        criticalFailures: [],
        factualErrors: [],
        insufficientInformation: false,
      }),
    },
    runId: "eight-case-source-traceability-no-api",
  });

  assert.equal(evaluation.caseCount, 8);
  assert.equal(evaluation.caseRunCount, 8);
  assert.equal(evaluation.errorCount, 0);
  assert.equal(report.sourceScenarioSuite.id, suite.id);
  assert.equal(report.sourceScenarioSuite.version, suite.version);
  assert.equal(report.sourceEvaluation.runId, evaluation.runId);
  assert.equal(report.sourceEvaluation.datasetId, evaluation.datasetId);
  assert.deepEqual(report.scoringProfile, UNSCOPED_TUTOR_HEALTH_SCORING_PROFILE);
  assert.equal(report.coverage.evaluationScope.scenarioCount, 8);
  assert.equal(report.coverage.evaluationScope.decisionPointCount, 8);
  assert.equal(report.coverage.evaluationScope.presentCaseRunCount, 8);
  assert.equal(report.coverage.evaluationScope.expectedCaseRunCount, 8);
  assert.equal(report.unresolved.length, 0);

  const sources = new Map(suite.scenarios.map((scenario) => [scenario.identity.id, scenario]));
  const cases = new Map(tutorScenarioSuiteToTutorEvalDataset(suite).cases.map((item) => [item.id, item]));
  assert.equal(report.findings.length, 16);
  for (const finding of report.findings) {
    const scenario = sources.get(finding.scenarioId);
    assert.ok(scenario);
    const point = scenario.decisionPoints.find((item) => item.id === finding.location.decisionPointId);
    assert.ok(point);
    assert.equal(finding.expectedBehavior, point.expectedBehavior);
    assert.equal(finding.location.startTurn, point.turnIndex);
    assert.ok(finding.regressionTargets.includes(`${scenario.identity.id}/${point.id}`));
    const criterionRefs = finding.evidence.filter((e) => e.kind === "rubric_result");
    assert.equal(criterionRefs.length, 1);
    const ref = criterionRefs[0]!;
    assert.equal(ref.kind, "rubric_result");
    assert.equal(ref.scenarioId, scenario.identity.id);
    assert.equal(ref.caseId, point.evaluationCaseId);
    assert.equal(ref.result, "FAIL");
    assert.ok(point.evaluationCriteria.some((criterion) =>
      criterion.rubricId === ref.rubricId && criterion.dimension === finding.dimension));
    assert.ok(cases.get(ref.caseId)?.evaluatorOnly.rubrics.some((rubric) => rubric.id === ref.rubricId));
    const execution = evaluation.caseResults.find((item) =>
      item.caseId === ref.caseId && item.runIndex === ref.runIndex);
    assert.ok(execution);
    assert.ok(execution.rubricResults.some((item) => item.rubricId === ref.rubricId && item.result === "FAIL"));
  }
  const recreated = buildTutorHealthReport({ suite, evaluation });
  assert.deepEqual(recreated.scoringProfile, report.scoringProfile);
  assert.deepEqual(recreated.findings, report.findings);
});
