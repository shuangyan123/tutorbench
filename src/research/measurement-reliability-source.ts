import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  parseTutorEvalDataset,
  parseAndValidateTutorResponseCorpus, partitionTutorEvalRubrics,
  parseTutorEvalJudgeResult,
} from "../contracts/index.js";
import { canonicalScoringJson } from "../scoring/config.js";
import { hasMatchingTutorEvalAuthoredScoring } from "../scoring/provenance.js";
import { parseTutorEvaluationAuditArtifact } from "../reporting/tutor-evaluation-audit.js";

/** Internal research capture, never a new benchmark result or Tutor packet. */
export interface MeasurementTarget {
  readonly caseId: string;
  readonly rubricId: string;
}

export function measurementFingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalScoringJson(value)).digest("hex");
}

export function freezeMeasurementSource(
  datasetValue: unknown, corpusValue: unknown, evaluationValue: unknown,
  targets: readonly MeasurementTarget[],
) {
  // JSON 快照切断调用方可变对象；既有解析器继续拥有契约验证。
  const dataset = parseTutorEvalDataset(structuredClone(datasetValue));
  const corpus = parseAndValidateTutorResponseCorpus(structuredClone(corpusValue), dataset);
  const artifact = parseTutorEvaluationAuditArtifact(structuredClone(evaluationValue));
  const evaluation = artifact.evaluation;
  if ((artifact.corpusId !== undefined && artifact.corpusId !== corpus.corpusId) ||
      (artifact.corpusVersion !== undefined && artifact.corpusVersion !== corpus.corpusVersion) ||
      (artifact.generationSpec !== undefined && !isDeepStrictEqual(artifact.generationSpec, corpus.generationSpec)))
    throw new Error("measurement_source_mismatch");
  if (evaluation.datasetId !== dataset.id || evaluation.datasetVersion !== dataset.version ||
      evaluation.runsPerCase !== corpus.runsPerCase ||
      !isDeepStrictEqual(evaluation.tutor, corpus.tutor) ||
      !hasMatchingTutorEvalAuthoredScoring(evaluation, dataset))
    throw new Error("measurement_source_mismatch");
  if (!Array.isArray(targets) || targets.length === 0 ||
      new Set(targets.map(t => t?.caseId)).size !== targets.length)
    throw new Error("measurement_targets_invalid");
  for (const target of targets) {
    const source = dataset.cases.find(c => c.id === target.caseId);
    const rubric = source && partitionTutorEvalRubrics(source).judgeRubrics.find(r => r.id === target.rubricId);
    // 只比较已授权给答案的 correctness rubric；不把诊断/提示质量混成答案匹配。
    if (!source || !rubric || rubric.category !== "correctness" ||
        (rubric.behavior ?? "required") !== "required" ||
        !["full_solution_allowed", "full_solution_required"].includes(source.evaluatorOnly.disclosurePolicy))
      throw new Error("measurement_target_not_comparable");
  }
  for (const result of evaluation.caseResults) {
    const source = dataset.cases.find(c => c.id === result.caseId && c.version === result.caseVersion);
    const response = corpus.responses.find(r => r.caseId === result.caseId &&
      r.caseVersion === result.caseVersion && r.runIndex === result.runIndex);
    if (!source || !response || result.rawTutorResponse !== response.responseText)
      throw new Error("measurement_response_mismatch");
    const { judgeRubrics } = partitionTutorEvalRubrics(source);
    if (result.rawJudgeResult !== null) {
      if (evaluation.judge === null) throw new Error("measurement_judge_provenance_missing");
      const judge = parseTutorEvalJudgeResult(result.rawJudgeResult);
      if (judge.caseId !== source.id || judge.rubricResults.length !== judgeRubrics.length ||
          judge.rubricResults.some(r => !judgeRubrics.some(s => s.id === r.rubricId)))
        throw new Error("measurement_judge_rubric_mismatch");
      for (const raw of judge.rubricResults) {
        const stored = result.rubricResults.find(r => r.rubricId === raw.rubricId);
        if (!stored || stored.result !== (judge.insufficientInformation ? "ERROR" : raw.result))
          throw new Error("measurement_contradictory_scoring");
      }
    } else if (result.rubricResults.some(r => r.result !== "ERROR" && judgeRubrics.some(j => j.id === r.rubricId))) {
      throw new Error("measurement_judge_evidence_missing");
    }
  }
  const selection = targets.map(t => ({ caseId: t.caseId, rubricId: t.rubricId }))
    .sort((a, b) => a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : 0);
  return {
    schemaVersion: 1 as const,
    kind: "measurement-reliability-frozen-source" as const,
    fingerprints: {
      dataset: measurementFingerprint(dataset), corpus: measurementFingerprint(corpus),
      evaluation: measurementFingerprint(evaluation), targets: measurementFingerprint(selection),
    },
    dataset, corpus, evaluation, targets: selection,
  };
}

export type FrozenMeasurementSource = ReturnType<typeof freezeMeasurementSource>;

export function parseFrozenMeasurementSource(value: unknown): FrozenMeasurementSource {
  if (!value || typeof value !== "object") throw new Error("measurement_frozen_source_invalid");
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== 1 || raw.kind !== "measurement-reliability-frozen-source")
    throw new Error("measurement_frozen_source_invalid");
  const source = freezeMeasurementSource(raw.dataset, raw.corpus, raw.evaluation,
    raw.targets as readonly MeasurementTarget[]);
  if (!isDeepStrictEqual(source.fingerprints, raw.fingerprints))
    throw new Error("measurement_fingerprint_mismatch");
  return source;
}
