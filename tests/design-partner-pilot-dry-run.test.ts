import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseTutorScenarioSuiteVNext,
  type TutorEvalJudgeInput,
} from "../src/contracts/index.js";
import { loadTutorScenarioSuiteVNext } from "../src/datasets/real-world.js";
import { runTutorHealthEvaluation } from "../src/runner/tutor-health-runner.js";

function fixtureTutor(id: string, text: string) {
  return {
    id,
    respond: async () => ({ text }),
  };
}

function fixtureJudge(failingCaseIds: ReadonlySet<string>) {
  return {
    provider: "synthetic-pilot",
    model: "authored-fixture",
    promptVersion: "dry-run-1",
    evaluate: async (input: TutorEvalJudgeInput) => ({
      schemaVersion: 1 as const,
      caseId: input.caseId,
      rubricResults: input.rubrics.map((rubric) => ({
        rubricId: rubric.id,
        result: failingCaseIds.has(input.caseId) ? ("FAIL" as const) : ("PASS" as const),
      })),
      criticalFailures: [],
      factualErrors: [],
      insufficientInformation: false,
    }),
  };
}

function findingKey(finding: {
  readonly scenarioId: string;
  readonly type: string;
}): string {
  return `${finding.scenarioId}::${finding.type}`;
}

test("synthetic design-partner pilot exercises baseline -> change -> rerun with resolved, persistent, and new Findings", async () => {
  const publicSuite = await loadTutorScenarioSuiteVNext();
  const selectedScenarioIds = new Set([
    "ps-first-mistake",
    "ps-repeated-mistake",
    "ps-partial-progress",
    "ps-false-confidence",
  ]);

  const privatePilot = structuredClone(publicSuite) as typeof publicSuite;
  privatePilot.id = "synthetic-design-partner-pilot-001";
  privatePilot.version = "0.1.0";
  privatePilot.title = "Synthetic Design Partner Pilot";
  privatePilot.description =
    "Synthetic four-scenario pilot used only to exercise the private design-partner delivery loop.";
  privatePilot.scenarios = privatePilot.scenarios
    .filter((scenario) => selectedScenarioIds.has(scenario.identity.id))
    .map((scenario) => ({
      ...scenario,
      identity: {
        ...scenario.identity,
        suiteId: "synthetic-design-partner-pilot-001",
      },
    }));

  const suite = parseTutorScenarioSuiteVNext(privatePilot);
  assert.equal(suite.scenarios.length, 4);

  const baseline = await runTutorHealthEvaluation({
    suite,
    tutor: fixtureTutor(
      "synthetic-partner-baseline",
      "Try the same approach again and tell me what you notice.",
    ),
    tutorDescriptor: {
      provider: "synthetic-partner",
      model: "pilot-tutor",
      promptVersion: "baseline-v1",
    },
    judge: fixtureJudge(new Set(["ps-first-mistake", "ps-repeated-mistake"])),
    runId: "synthetic-partner-baseline-001",
  });

  const candidate = await runTutorHealthEvaluation({
    suite,
    tutor: fixtureTutor(
      "synthetic-partner-candidate",
      "Use what you have already established, and check the next decision carefully.",
    ),
    tutorDescriptor: {
      provider: "synthetic-partner",
      model: "pilot-tutor",
      promptVersion: "candidate-v2",
    },
    judge: fixtureJudge(new Set(["ps-repeated-mistake", "ps-partial-progress"])),
    runId: "synthetic-partner-candidate-001",
  });

  assert.deepEqual(baseline.report.sourceScenarioSuite, candidate.report.sourceScenarioSuite);
  assert.equal(baseline.report.sourceScenarioSuite.id, "synthetic-design-partner-pilot-001");
  assert.equal(baseline.report.sourceScenarioSuite.version, "0.1.0");
  assert.equal(baseline.evaluation.tutor.provider, "synthetic-partner");
  assert.equal(candidate.evaluation.tutor.provider, "synthetic-partner");
  assert.equal(baseline.evaluation.tutor.promptVersion, "baseline-v1");
  assert.equal(candidate.evaluation.tutor.promptVersion, "candidate-v2");

  const baselineKeys = new Set(baseline.report.findings.map(findingKey));
  const candidateKeys = new Set(candidate.report.findings.map(findingKey));

  const resolved = [...baselineKeys].filter((key) => !candidateKeys.has(key)).sort();
  const persistent = [...baselineKeys].filter((key) => candidateKeys.has(key)).sort();
  const newlyObserved = [...candidateKeys].filter((key) => !baselineKeys.has(key)).sort();

  assert.deepEqual(resolved, ["ps-first-mistake::premature_intervention"]);
  assert.deepEqual(persistent, ["ps-repeated-mistake::missed_repeated_misconception"]);
  assert.deepEqual(newlyObserved, ["ps-partial-progress::partial_progress_not_used"]);

  assert.ok(
    baseline.report.findings
      .find((finding) => findingKey(finding) === resolved[0])
      ?.regressionTargets.includes("ps-first-mistake/preserve-first-attempt"),
  );
  assert.ok(
    candidate.report.findings
      .find((finding) => findingKey(finding) === newlyObserved[0])
      ?.regressionTargets.includes("ps-partial-progress/reinforce-correct-step"),
  );

  assert.equal(
    baseline.report.coverage.evaluationScope.presentCaseRunCount,
    suite.scenarios.length,
  );
  assert.equal(
    candidate.report.coverage.evaluationScope.presentCaseRunCount,
    suite.scenarios.length,
  );
});
