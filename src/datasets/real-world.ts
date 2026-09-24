import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { BenchmarkConfigurationError } from "../contracts/errors.js";
import { parseTutorEvalDataset } from "../contracts/tutor-eval-validation.js";
import {
  parseTutorScenarioSuiteVNext,
} from "../contracts/tutor-scenario-vnext-validation.js";
import type { TutorEvalDataset } from "../contracts/tutor-eval.js";
import type {
  TutorScenarioDecisionPoint,
  TutorScenarioSuiteVNext,
  TutorScenarioVNext,
} from "../contracts/tutor-scenario-vnext.js";

export const PRODUCTIVE_STRUGGLE_INTERVENTION_SUITE_ID =
  "productive-struggle-intervention-v0.1" as const;
export const PRODUCTIVE_STRUGGLE_INTERVENTION_SUITE_VERSION = "0.1.0" as const;

const scenarioSuitePath = new URL(
  "../../../scenarios/real-world/productive-struggle-intervention-v0.1/suite.json",
  import.meta.url,
);

export async function loadTutorScenarioSuiteVNext(
  suiteId = PRODUCTIVE_STRUGGLE_INTERVENTION_SUITE_ID,
): Promise<TutorScenarioSuiteVNext> {
  if (suiteId !== PRODUCTIVE_STRUGGLE_INTERVENTION_SUITE_ID) {
    throw new BenchmarkConfigurationError("tutor_scenario_suite_not_found");
  }
  try {
    const json = await readFile(fileURLToPath(scenarioSuitePath), "utf8");
    return parseTutorScenarioSuiteVNext(JSON.parse(json) as unknown);
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
    learnerState: decisionPoint.learnerState ?? scenario.learnerState,
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
      const { learnerState, trajectory } = contextForDecisionPoint(
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
      const knownMisconception = learnerState.misconceptions.join("; ");
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
            knownConcepts: learnerState.knownConcepts,
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
