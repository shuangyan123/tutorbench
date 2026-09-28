import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { BenchmarkConfigurationError } from "../contracts/errors.js";
import { parseTutorEvalDataset } from "../contracts/tutor-eval-validation.js";
import {
  parseTutorScenarioSuiteVNext,
} from "../contracts/tutor-scenario-vnext-validation.js";
import {
  parseCaseSystemVNextPilot,
  parseCaseSystemVNextStrategyProfileRegistry,
} from "../contracts/index.js";
import type { TutorEvalDataset } from "../contracts/tutor-eval.js";
import type {
  TutorScenarioDecisionPoint,
  TutorScenarioSuiteVNext,
  TutorScenarioVNext,
} from "../contracts/tutor-scenario-vnext.js";

export const PRODUCTIVE_STRUGGLE_INTERVENTION_SUITE_ID =
  "productive-struggle-intervention-v0.1" as const;
export const PRODUCTIVE_STRUGGLE_INTERVENTION_SUITE_VERSION = "0.2.0" as const;
export const CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID =
  "case-system-vnext-executable-pilot-v0.1" as const;
export const CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_VERSION = "0.2.0" as const;

export type RegisteredTutorScenarioSuiteId =
  | typeof PRODUCTIVE_STRUGGLE_INTERVENTION_SUITE_ID
  | typeof CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID;

const scenarioSuitePath = new URL(
  "../../../scenarios/real-world/productive-struggle-intervention-v0.1/suite.json",
  import.meta.url,
);
const caseSystemExecutablePilotSuitePath = new URL(
  "../../../scenarios/real-world/case-system-vnext-executable-pilot-v0.1/suite.json",
  import.meta.url,
);
const caseSystemPilotPath = new URL(
  "../../../scenarios/case-system-vnext/pilot-archetypes.json",
  import.meta.url,
);
const caseSystemStrategyRegistryPath = new URL(
  "../../../scenarios/case-system-vnext/task-strategy-profiles.json",
  import.meta.url,
);

async function validateRegisteredCaseSystemProvenance(
  suite: TutorScenarioSuiteVNext,
): Promise<void> {
  const sourced = suite.scenarios.filter(
    (scenario) => scenario.caseSystemSource !== undefined,
  );
  if (sourced.length === 0) return;

  const [pilotJson, registryJson] = await Promise.all([
    readFile(fileURLToPath(caseSystemPilotPath), "utf8"),
    readFile(fileURLToPath(caseSystemStrategyRegistryPath), "utf8"),
  ]);
  const pilot = parseCaseSystemVNextPilot(JSON.parse(pilotJson) as unknown);
  const registry = parseCaseSystemVNextStrategyProfileRegistry(
    JSON.parse(registryJson) as unknown,
  );

  for (const scenario of sourced) {
    const source = scenario.caseSystemSource;
    if (source === undefined) continue;
    const archetype = pilot.archetypes.find(
      (candidate) => candidate.id === source.archetypeId,
    );
    const profile = registry.profiles.find(
      (candidate) => candidate.id === source.strategyProfileId,
    );
    if (
      source.pilotId !== pilot.id ||
      source.pilotVersion !== pilot.version ||
      archetype === undefined ||
      archetype.version !== source.archetypeVersion ||
      profile === undefined ||
      profile.version !== source.strategyProfileVersion ||
      profile.archetypeId !== archetype.id
    ) {
      throw new BenchmarkConfigurationError("tutor_scenario_vnext_invalid");
    }
  }
}

export async function loadTutorScenarioSuiteVNext(
  suiteId: RegisteredTutorScenarioSuiteId =
    PRODUCTIVE_STRUGGLE_INTERVENTION_SUITE_ID,
): Promise<TutorScenarioSuiteVNext> {
  const path = suiteId === PRODUCTIVE_STRUGGLE_INTERVENTION_SUITE_ID
    ? scenarioSuitePath
    : suiteId === CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID
      ? caseSystemExecutablePilotSuitePath
      : null;
  if (path === null) {
    throw new BenchmarkConfigurationError("tutor_scenario_suite_not_found");
  }
  try {
    const json = await readFile(fileURLToPath(path), "utf8");
    const suite = parseTutorScenarioSuiteVNext(JSON.parse(json) as unknown);
    if (suiteId === CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID) {
      await validateRegisteredCaseSystemProvenance(suite);
    }
    return suite;
  } catch (error) {
    if (error instanceof BenchmarkConfigurationError) {
      throw error;
    }
    throw new BenchmarkConfigurationError("tutor_scenario_vnext_invalid");
  }
}

function contextForDecisionPoint(
  scenario: TutorScenarioVNext,
  decisionPoint: TutorScenarioDecisionPoint,
) {
  return {
    tutorVisibleContext:
      decisionPoint.tutorVisibleContext ?? scenario.tutorVisibleContext,
    evaluatorReferenceState:
      decisionPoint.evaluatorReferenceState ?? scenario.evaluatorReferenceState,
    trajectory: decisionPoint.trajectory ?? scenario.trajectory,
  };
}

/**
 * Compiles authored vNext checkpoints to the existing TutorEval case
 * contract. Judge/deterministic routing and the hidden-data firewall remain
 * owned by the current parser, adapter, and runner.
 */
export function tutorScenarioSuiteToTutorEvalDataset(
  suiteValue: TutorScenarioSuiteVNext,
): TutorEvalDataset {
  const suite = parseTutorScenarioSuiteVNext(suiteValue);
  const cases = suite.scenarios.flatMap((scenario) =>
    scenario.decisionPoints.map((decisionPoint) => {
      const { tutorVisibleContext, evaluatorReferenceState, trajectory } = contextForDecisionPoint(
        scenario,
        decisionPoint,
      );
      const latestLearnerMessage = trajectory.conversationHistory.at(-1);
      if (latestLearnerMessage?.role !== "user") {
        throw new BenchmarkConfigurationError("tutor_scenario_vnext_invalid");
      }
      const rubrics = decisionPoint.evaluationCriteria.map((criterion) => ({
        id: criterion.rubricId,
        category: criterion.category,
        criterion: criterion.criterion,
        weight: criterion.weight,
        evaluationType: criterion.evaluationType,
        behavior: criterion.behavior,
        ...(criterion.evaluatorId === undefined
          ? {}
          : { evaluatorId: criterion.evaluatorId }),
        ...(criterion.config === undefined ? {} : { config: criterion.config }),
        ...(criterion.criticalFailure === undefined
          ? {}
          : { criticalFailure: criterion.criticalFailure }),
      }));
      const knownMisconception = evaluatorReferenceState.misconceptions
        .map(
          (reference) =>
            `${reference.statement} (supported by authored learner turn${reference.evidenceLearnerTurns.length === 1 ? "" : "s"} ${reference.evidenceLearnerTurns.join(", ")})`,
        )
        .join("; ");
      const caseValue = {
        schemaVersion: 1,
        id: decisionPoint.evaluationCaseId,
        version: `${scenario.identity.version}:${decisionPoint.id}`,
        metadata: {
          subject: scenario.learningContext.subject,
          topic: scenario.learningContext.topic,
          tags: [suite.id, scenario.identity.id],
        },
        tutorInput: {
          learningObjective: scenario.learningContext.learningObjective,
          studentProfile: {
            knownConcepts: tutorVisibleContext.knownConcepts,
            ...(tutorVisibleContext.learnerModel === undefined
              ? {}
              : { learnerModel: tutorVisibleContext.learnerModel }),
            level: scenario.learningContext.learnerLevel,
            goal: scenario.learningContext.learningObjective,
          },
          conversationHistory: trajectory.conversationHistory
            .slice(0, -1)
            .map((message) => ({
              role: message.role === "user" ? "student" : "tutor",
              text: message.content,
            })),
          studentMessage: latestLearnerMessage.content,
          problemContext: `${scenario.learningContext.subject}: ${scenario.learningContext.topic}`,
        },
        evaluatorOnly: {
          ...(knownMisconception.length === 0 ? {} : { knownMisconception }),
          disclosurePolicy: scenario.teachingPolicy.disclosure,
          rubrics,
        },
      };
      return caseValue;
    }),
  );
  return parseTutorEvalDataset({ id: suite.id, version: suite.version, cases });
}
