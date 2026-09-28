import {
  CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SCORING_PROFILE,
  type TutorHealthReport,
  type TutorHealthScoringProfile,
  type TutorScenarioSuiteVNext,
} from "../contracts/index.js";
import {
  CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID,
  loadTutorScenarioSuiteVNext,
  tutorScenarioSuiteToTutorEvalDataset,
} from "../datasets/real-world.js";
import { buildTutorHealthReport } from "../reporting/tutor-health-reporters.js";
import { runTutorEval, type RunTutorEvalOptions } from "./tutor-eval-runner.js";

export interface RunTutorHealthEvaluationOptions
  extends Omit<RunTutorEvalOptions, "dataset"> {
  readonly suite?: TutorScenarioSuiteVNext;
  readonly scoringProfile?: TutorHealthScoringProfile;
}

export interface TutorHealthEvaluationRun {
  readonly evaluation: Awaited<ReturnType<typeof runTutorEval>>;
  readonly report: TutorHealthReport;
}

/** Executes the authored vNext suite through the existing TutorEval runner. */
export async function runTutorHealthEvaluation(
  options: RunTutorHealthEvaluationOptions,
): Promise<TutorHealthEvaluationRun> {
  const { suite: suppliedSuite, scoringProfile, ...runnerOptions } = options;
  const suite = suppliedSuite ?? (await loadTutorScenarioSuiteVNext());
  const evaluation = await runTutorEval({
    ...runnerOptions,
    dataset: tutorScenarioSuiteToTutorEvalDataset(suite),
  });
  const effectiveScoringProfile = scoringProfile ??
    (suite.id === CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SUITE_ID
      ? CASE_SYSTEM_VNEXT_EXECUTABLE_PILOT_SCORING_PROFILE
      : undefined);
  const report = buildTutorHealthReport({
    suite,
    evaluation,
    ...(effectiveScoringProfile === undefined
      ? {}
      : { scoringProfile: effectiveScoringProfile }),
  });
  return { evaluation, report };
}
