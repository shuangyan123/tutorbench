import { parseTutorScenarioSuiteVNext, TutorEvalJudgeExecutionError } from "../../src/contracts/index.js";
import { loadTutorScenarioSuiteVNext } from "../../src/datasets/real-world.js";
import type { TutorEvalJudgeRunOptions } from "../../src/runner/tutor-eval-runner.js";

export async function insufficientInformationSuite(options: { mixed?: boolean; criticalDeterministic?: boolean; twoJudgeRubrics?: boolean } = {}) {
  const source = await loadTutorScenarioSuiteVNext();
  const scenario = structuredClone(source.scenarios[0]!);
  const point = scenario.decisionPoints[0]!;
  const criterion = point.evaluationCriteria[0]!;
  return parseTutorScenarioSuiteVNext({ ...source, id: "synthetic-insufficient-information", version: "1",
    title: "Controlled insufficient-information fixture", scenarios: [{ ...scenario,
      identity: { ...scenario.identity, suiteId: "synthetic-insufficient-information" },
      decisionPoints: [{ ...point, evaluationCriteria: [criterion,
        ...(options.twoJudgeRubrics ? [{ ...criterion, rubricId: `${criterion.rubricId}-second` }] : []),
        ...(options.mixed ? [{ ...criterion, rubricId: "controlled-nonempty",
          criterion: "Emit a nonempty synthetic response.", category: "correctness", dimension: "content_correctness",
          evaluationType: "deterministic", evaluatorId: "empty_response",
          ...(options.criticalDeterministic ? { criticalFailure: { type: "instruction_violation", severity: "major" } } : {}),
        }] : []),
      ] }],
    }],
  });
}

export function insufficientInformationJudge(options: {
  insufficientInformation?: boolean;
  result?: "PASS" | "PARTIAL" | "FAIL";
  alternateResults?: boolean;
  transportError?: boolean;
  criticalFailure?: boolean;
} = {}): TutorEvalJudgeRunOptions {
  return { provider: "synthetic", model: "controlled-judge", promptVersion: "1", evaluate: async (input) => {
    if (options.transportError) throw new TutorEvalJudgeExecutionError("judge_transport_error");
    return { schemaVersion: 1, caseId: input.caseId,
      rubricResults: input.rubrics.map((rubric, index) => ({ rubricId: rubric.id,
        result: options.alternateResults && index > 0 ? "FAIL" : options.result ?? "PASS",
        evidence: "Controlled synthetic rubric judgment.",
      })),
      criticalFailures: options.criticalFailure ? [{ type: "answer_leakage", severity: "major", evidence: "Controlled independent failure signal." }] : [],
      factualErrors: [], insufficientInformation: options.insufficientInformation ?? false,
    };
  } };
}
