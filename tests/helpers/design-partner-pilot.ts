import {
  parseTutorScenarioSuiteVNext,
  type TutorEvalJudgeInput,
} from "../../src/contracts/index.js";
import { loadTutorScenarioSuiteVNext } from "../../src/datasets/real-world.js";
import { runTutorHealthEvaluation } from "../../src/runner/tutor-health-runner.js";

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

export async function syntheticDesignPartnerPilot(runsPerCase = 1) {
  const publicSuite = await loadTutorScenarioSuiteVNext();
  const selectedScenarioIds = new Set([
    "ps-first-mistake",
    "ps-repeated-mistake",
    "ps-partial-progress",
    "ps-false-confidence",
  ]);

  const privatePilot = {
    ...structuredClone(publicSuite),
    id: "synthetic-design-partner-pilot-001",
    version: "0.1.0",
    title: "Synthetic Design Partner Pilot",
    description:
      "Synthetic four-scenario pilot used only to exercise the private design-partner delivery loop.",
    scenarios: publicSuite.scenarios
      .filter((scenario) => selectedScenarioIds.has(scenario.identity.id))
      .map((scenario) => ({
        ...structuredClone(scenario),
        identity: {
          ...structuredClone(scenario.identity),
          suiteId: "synthetic-design-partner-pilot-001",
        },
      })),
  };

  const suite = parseTutorScenarioSuiteVNext(privatePilot);

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
    runsPerCase,
    now: () => new Date("2026-09-29T00:00:00.000Z"),
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
    runsPerCase,
    now: () => new Date("2026-09-29T00:00:00.000Z"),
    runId: "synthetic-partner-candidate-001",
  });

  return { suite, baseline: { suite, ...baseline }, candidate: { suite, ...candidate } };
}
