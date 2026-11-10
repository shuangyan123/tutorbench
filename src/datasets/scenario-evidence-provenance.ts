import type {
  TutorScenarioCaseSystemSource,
  TutorScenarioSuiteVNext,
} from "../contracts/tutor-scenario-vnext.js";
import { parseTutorScenarioSuiteVNext } from "../contracts/tutor-scenario-vnext-validation.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "./real-world.js";

/**
 * A source locator, not a learner-state observation or semantic diagnosis.
 * The turn indexes count USER messages only; decision-point turnIndex counts
 * Tutor responses. Keep the referenced statement in evaluator-only source.
 */
export interface AuthoredMisconceptionEvidencePointer {
  readonly sourceScope: "scenario" | "decision_point";
  /** One-based position in the effective evaluator-only misconceptions list. */
  readonly referenceOrdinal: number;
  /** One-based USER-turn positions in the selected authored trajectory. */
  readonly learnerTurnIndexes: readonly number[];
}

/**
 * Read-only joins between the original authored scenario and a compiled
 * TutorEval case. These are provenance pointers, not evaluated learner traits.
 */
export interface ScenarioLearnerEvidenceProvenance {
  readonly suiteId: string;
  readonly suiteVersion: string;
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly decisionPointId: string;
  readonly caseId: string;
  readonly caseVersion: string;
  readonly tutorResponseTurnIndex: number;
  readonly learnerTurnCount: number;
  readonly evaluatorOnlyMisconceptionReferences: readonly AuthoredMisconceptionEvidencePointer[];
  /** Declared authoring IDs/versions only; this function does not resolve the registry. */
  readonly caseSystemSource?: TutorScenarioCaseSystemSource;
}

/**
 * Index existing, validated source identities without inventing knowledge,
 * mastery, misconception, or learner-outcome claims. This internal helper is
 * not a Tutor adapter input, evaluator score, or new learner-state registry.
 *
 * The existing vNext parser verifies source turn positions; the existing
 * compiler owns the canonical TutorEval case IDs and versions. An absent
 * evaluator reference means "not authored", NOT "learner has no misconception".
 */
export function indexScenarioLearnerEvidence(
  sourceSuite: TutorScenarioSuiteVNext,
): readonly ScenarioLearnerEvidenceProvenance[] {
  const suite = parseTutorScenarioSuiteVNext(sourceSuite);
  const dataset = tutorScenarioSuiteToTutorEvalDataset(suite);
  const cases = new Map(dataset.cases.map((caseValue) => [caseValue.id, caseValue]));

  return suite.scenarios.flatMap((scenario) =>
    scenario.decisionPoints.map((point) => {
      const trajectory = point.trajectory ?? scenario.trajectory;
      const reference = point.evaluatorReferenceState ?? scenario.evaluatorReferenceState;
      const sourceScope = point.evaluatorReferenceState === undefined
        ? "scenario" as const
        : "decision_point" as const;
      const compiledCase = cases.get(point.evaluationCaseId);
      if (compiledCase === undefined) {
        // This is unreachable for a successfully parsed and compiled suite.
        throw new Error("scenario_evidence_compiled_case_missing");
      }

      return {
        suiteId: suite.id,
        suiteVersion: suite.version,
        scenarioId: scenario.identity.id,
        scenarioVersion: scenario.identity.version,
        decisionPointId: point.id,
        caseId: compiledCase.id,
        caseVersion: compiledCase.version,
        tutorResponseTurnIndex: point.turnIndex,
        learnerTurnCount: trajectory.conversationHistory.filter((turn) => turn.role === "user").length,
        evaluatorOnlyMisconceptionReferences: reference.misconceptions.map((item, index) => ({
          sourceScope,
          referenceOrdinal: index + 1,
          learnerTurnIndexes: [...item.evidenceLearnerTurns],
        })),
        ...(scenario.caseSystemSource === undefined
          ? {}
          : { caseSystemSource: { ...scenario.caseSystemSource } }),
      };
    }),
  );
}
