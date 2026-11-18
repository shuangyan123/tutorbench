import { isDeepStrictEqual } from "node:util";
import { RecordedTutor } from "../adapters/recorded-tutor.js";
import { toTutorTurnInput } from "../contracts/tutor-eval.js";
import {
  assertValidCalibrationData, findCalibrationReferenceReadinessIssues,
  parseCalibrationAnnotationFile, parseCalibrationAdjudicationFile,
  type CalibrationValidationInput,
} from "../contracts/calibration-validation.js";
import { toCalibrationCandidateResponseFile } from "../calibration/corpus.js";
import { buildCalibrationReferenceSet } from "../calibration/reference.js";
import type { ScoredCalibrationLabel } from "../contracts/calibration.js";
import { measurementFingerprint, parseFrozenMeasurementSource } from "./measurement-reliability-source.js";
import { summarizeMeasurementPairs } from "./paired-measurement.js";

interface MeasurementRow {
  caseId: string; caseVersion: string; rubricId: string; runIndex: number;
  responseId: string | null; responseFingerprint: string | null;
  strict: "PASS" | "FAIL" | null;
  judge: ScoredCalibrationLabel | null;
  humanReference: ScoredCalibrationLabel | null;
  humanStatus: "missing" | "unresolved" | "synthetic_fixture" | "human_reference";
  humanReviewerCount: number;
  disagreement: string | null;
  evidenceIssues: string[];
}

function humanForUnit(input: CalibrationValidationInput, responseId: string, rubricId: string) {
  const unit = {
    ...input,
    annotationFiles: input.annotationFiles.map(file => ({ ...file,
      annotations: file.annotations.filter(a => a.responseId === responseId && a.rubricId === rubricId),
    })),
    ...(input.adjudicationFile === undefined ? {} : { adjudicationFile: {
      ...input.adjudicationFile,
      adjudications: input.adjudicationFile.adjudications.filter(a => a.responseId === responseId && a.rubricId === rubricId),
    } }),
  };
  const annotations = unit.annotationFiles.flatMap(f => f.annotations);
  if (annotations.length === 0) return { label: null, status: "missing" as const, reviewers: 0 };
  const reviewers = new Set(annotations.map(a => a.reviewerId)).size;
  if (findCalibrationReferenceReadinessIssues(unit).length > 0)
    return { label: null, status: "unresolved" as const, reviewers };
  const reference = buildCalibrationReferenceSet(unit);
  if (reference.dataKind !== "human-reference")
    return { label: null, status: "synthetic_fixture" as const, reviewers };
  return { label: reference.labels[0]!.finalLabel, status: "human_reference" as const, reviewers };
}

/** Read-only paired observation. No providers, aggregate scores, or production result writes. */
export async function buildMeasurementReliabilityReport(
  frozenValue: unknown,
  annotationValues: readonly unknown[] = [],
  adjudicationValue?: unknown,
  humanSourceFingerprints?: unknown,
) {
  const source = parseFrozenMeasurementSource(frozenValue);
  if ((annotationValues.length > 0 || adjudicationValue !== undefined) &&
      !isDeepStrictEqual(humanSourceFingerprints, source.fingerprints))
    throw new Error("measurement_human_source_mismatch");
  const { dataset, corpus, evaluation, targets } = source;
  const humanInput: CalibrationValidationInput = {
    dataset, candidates: toCalibrationCandidateResponseFile(corpus),
    annotationFiles: annotationValues.map(parseCalibrationAnnotationFile),
    ...(adjudicationValue === undefined ? {} : { adjudicationFile: parseCalibrationAdjudicationFile(adjudicationValue) }),
  };
  assertValidCalibrationData(humanInput);
  const replay = new RecordedTutor(corpus);
  const rows: MeasurementRow[] = [];
  for (const target of targets) {
    const c = dataset.cases.find(c => c.id === target.caseId)!;
    for (let runIndex = 1; runIndex <= corpus.runsPerCase; runIndex++) {
      const response = corpus.responses.find(r => r.caseId === c.id && r.runIndex === runIndex);
      const result = evaluation.caseResults.find(r => r.caseId === c.id && r.runIndex === runIndex);
      const row: MeasurementRow = {
        caseId: c.id, caseVersion: c.version, rubricId: target.rubricId, runIndex,
        responseId: response?.responseId ?? null,
        responseFingerprint: response ? measurementFingerprint(response.responseText) : null,
        strict: null, judge: null, humanReference: null, humanStatus: "missing",
        humanReviewerCount: 0, disagreement: null, evidenceIssues: [],
      };
      if (!response) row.evidenceIssues.push("missing_response");
      else {
        const output = await replay.respond(toTutorTurnInput(c, runIndex));
        const truth = c.evaluatorOnly.groundTruth;
        const answers = truth?.acceptedAnswers ?? (truth?.finalAnswer === undefined ? [] : [truth.finalAnswer]);
        // 整段回复逐字符相等，故意不提取/修复答案；只是下界压力观察，不是正式 evaluator。
        if (answers.length === 0) row.evidenceIssues.push("missing_exact_answer_reference");
        else row.strict = answers.includes(output.text) ? "PASS" : "FAIL";
        const human = humanForUnit(humanInput, response.responseId, target.rubricId);
        row.humanReference = human.label;
        row.humanStatus = human.status;
        row.humanReviewerCount = human.reviewers;
      }
      if (!result) row.evidenceIssues.push("missing_evaluation");
      else if (evaluation.scoringProvenance === undefined || evaluation.evaluatorVersion === undefined)
        row.evidenceIssues.push("missing_score_provenance");
      else if (result.rawJudgeResult?.insufficientInformation)
        row.evidenceIssues.push("judge_insufficient_information");
      else if (result.rawJudgeResult === null) row.evidenceIssues.push("missing_judge_evidence");
      else {
        row.judge = result.rawJudgeResult.rubricResults.find(r => r.rubricId === target.rubricId)?.result ?? null;
        if (row.judge === null) row.evidenceIssues.push("missing_judge_rubric");
      }
      if (row.strict !== null && row.judge !== null && row.strict !== row.judge)
        row.disagreement = `strict_${row.strict.toLowerCase()}__judge_${row.judge.toLowerCase()}`;
      rows.push(row);
    }
  }
  const issues: Record<string, number> = {};
  for (const row of rows) for (const code of row.evidenceIssues) issues[code] = (issues[code] ?? 0) + 1;
  const count = (predicate: (r: MeasurementRow) => boolean) => rows.filter(predicate).length;
  return {
    schemaVersion: 1, kind: "measurement-reliability-report", protocol: "whole-response-exact-v1",
    visibility: "internal-research-only", calibrationStatus: "not_calibrated",
    learnerOutcomesMeasured: false, productionScoringChanged: false,
    source: {
      fingerprints: source.fingerprints, datasetId: dataset.id, datasetVersion: dataset.version,
      corpusId: corpus.corpusId, corpusVersion: corpus.corpusVersion, responseProvenance: corpus.provenance,
      runId: evaluation.runId, evaluatorVersion: evaluation.evaluatorVersion ?? null,
      scoringIdentity: evaluation.scoringProvenance?.identity ?? null,
      judge: evaluation.judge === null ? null : {
        provider: evaluation.judge.provider, model: evaluation.judge.model,
        modelVersion: evaluation.judge.modelVersion ?? null,
        promptId: evaluation.judge.promptId ?? null, promptVersion: evaluation.judge.promptVersion,
      },
      humanEvidenceFingerprint: measurementFingerprint({ annotations: humanInput.annotationFiles,
        adjudication: humanInput.adjudicationFile ?? null }),
    },
    coverage: {
      plannedSamples: rows.length, distinctCases: targets.length,
      responses: count(r => r.responseId !== null), strict: count(r => r.strict !== null),
      judge: count(r => r.judge !== null), humanReference: count(r => r.humanReference !== null),
      humanUnresolved: count(r => r.humanStatus === "unresolved"),
      syntheticReferencesExcluded: count(r => r.humanStatus === "synthetic_fixture"),
      pairedStrictJudge: count(r => r.strict !== null && r.judge !== null),
      completeThreeWay: count(r => r.strict !== null && r.judge !== null && r.humanReference !== null),
    },
    strictVsJudge: summarizeMeasurementPairs(rows, r => r.strict, r => r.judge),
    strictVsHuman: summarizeMeasurementPairs(rows, r => r.strict, r => r.humanReference),
    judgeVsHuman: summarizeMeasurementPairs(rows, r => r.judge, r => r.humanReference),
    evidenceIssues: Object.fromEntries(Object.entries(issues).sort()), rows,
    limitations: [
      "Strict is whole-response exact equality against authored acceptedAnswers (or finalAnswer), not semantic correctness.",
      "Judge labels retain the selected existing correctness rubric; disagreement is not proof either method is wrong.",
      "Repeated runs are response-level samples, not independent learners. No confidence interval or learning claim is made.",
      "Human references are separately validated observations; even complete coverage does not establish calibration.",
      "Capture hashes detect later drift, not authorship or the original historical Judge input. Capture requires source-owner verification.",
    ],
  };
}
