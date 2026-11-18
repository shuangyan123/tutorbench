import type { TutorEvalCaseRunResult, TutorEvalRunResult } from "../contracts/result.js";
import { summarizeMeasurementPairs } from "./paired-measurement.js";
import type { evaluateHintFit } from "./learner-evidence-hint-rubric.js";
import type { HintPilotCase } from "./learner-evidence-hint-scenarios.js";

type Judgment = "PASS" | "FAIL";
export type HintMeasurementRow = {
  readonly condition: HintPilotCase["condition"];
  readonly baselineStatus: "eligible" | "unavailable" | "not_comparable";
  readonly baseline: Judgment | null;
  readonly candidate: ReturnType<typeof evaluateHintFit>["verdict"];
  readonly reference: Judgment | null;
};

export function describeHintBaseline(run: TutorEvalRunResult, result: TutorEvalCaseRunResult) {
  return {
    runId: run.runId,
    evaluatorVersion: run.evaluatorVersion ?? null,
    scoringIdentity: run.scoringProvenance?.identity ?? null,
    caseId: result.caseId,
    caseVersion: result.caseVersion,
    runIndex: result.runIndex,
    criteria: result.rubricResults.map(({ rubricId, result, diagnostics }) => ({
      rubricId, result, diagnostics: diagnostics.map(({ code }) => code),
    })),
  };
}

function summarize(rows: readonly HintMeasurementRow[]) {
  const counts = (test: (row: HintMeasurementRow) => boolean) => rows.filter(test).length;
  const measure = (count: number, denominator: number) => ({
    count, denominator, rate: denominator === 0 ? null : count / denominator,
  });
  const total = rows.length;
  const paired = rows.flatMap((row) => {
    const { baseline, candidate, reference } = row;
    return row.baselineStatus !== "eligible" || baseline === null || candidate === "ABSTAIN" || reference === null
      ? [] : [{ baseline, candidate, reference }];
  });
  const accuracy = (side: "baseline" | "candidate") => {
    const { validSamples, disagreements, matrix } = summarizeMeasurementPairs(
      paired, (row) => row[side], (row) => row.reference);
    return {
      agreement: measure(validSamples - disagreements, validSamples),
      falseAcceptance: measure(matrix.PASS__FAIL ?? 0, paired.filter((row) => row.reference === "FAIL").length),
      falseRejection: measure(matrix.FAIL__PASS ?? 0, paired.filter((row) => row.reference === "PASS").length),
      matrix,
    };
  };
  return {
    planned: total,
    baselineCoverage: measure(counts((row) => row.baseline !== null && row.baselineStatus === "eligible"), total),
    candidateCoverage: measure(counts((row) => row.candidate !== "ABSTAIN"), total),
    referenceCoverage: measure(counts((row) => row.reference !== null), total),
    comparableCoverage: measure(paired.length, total),
    unresolvedComparison: measure(total - paired.length, total),
    baselineUnavailable: measure(counts((row) => row.baselineStatus === "unavailable"), total),
    notComparable: measure(counts((row) => row.baselineStatus === "not_comparable"), total),
    candidateAbstentions: measure(counts((row) => row.candidate === "ABSTAIN"), total),
    missingReference: measure(counts((row) => row.reference === null), total),
    agreement: { baseline: accuracy("baseline"), candidate: accuracy("candidate") },
    fixes: measure(paired.filter((row) => row.baseline !== row.reference && row.candidate === row.reference).length, paired.length),
    regressions: measure(paired.filter((row) => row.baseline === row.reference && row.candidate !== row.reference).length, paired.length),
  };
}

export function summarizeHintMeasurement(rows: readonly HintMeasurementRow[]) {
  return {
    overall: summarize(rows),
    byCondition: {
      A: summarize(rows.filter((row) => row.condition === "unknown")),
      B: summarize(rows.filter((row) => row.condition === "local-understanding")),
      C: summarize(rows.filter((row) => row.condition === "unresolved-gap")),
    },
  };
}
