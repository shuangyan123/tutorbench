import { createHash } from "node:crypto";

import { BenchmarkConfigurationError } from "../contracts/errors.js";
import { assertValidTutorEvalRunResult } from "../contracts/tutor-eval-result-validation.js";
import { tutorHealthComparisonJson } from "../contracts/tutor-health-comparison-validation.js";
import { parseTutorHealthReport } from "../contracts/tutor-health-validation.js";
import { parseTutorHealthRunManifest } from "../contracts/tutor-health-run-manifest-validation.js";
import {
  TUTOR_HEALTH_RUN_MANIFEST_KIND,
  TUTOR_HEALTH_RUN_MANIFEST_SCHEMA_VERSION,
  type TutorHealthRunManifest,
} from "../contracts/tutor-health-run-manifest.js";
import { parseTutorScenarioSuiteVNext } from "../contracts/tutor-scenario-vnext-validation.js";
import type { TutorScenarioSuiteVNext } from "../contracts/tutor-scenario-vnext.js";

export interface TutorHealthRunManifestInput {
  readonly suite: TutorScenarioSuiteVNext;
  readonly evaluationJson: string;
  readonly reportJson: string;
}

function sha256(bytes: string): string {
  return createHash("sha256").update(bytes, "utf8").digest("hex");
}

/** Hash the same serialized sources that the writer persists or the reader loaded. */
export function buildTutorHealthRunManifest(input: TutorHealthRunManifestInput): TutorHealthRunManifest {
  try {
    const suite = parseTutorScenarioSuiteVNext(input.suite);
    const evaluation: unknown = JSON.parse(input.evaluationJson);
    assertValidTutorEvalRunResult(evaluation);
    const report = parseTutorHealthReport(JSON.parse(input.reportJson));
    if (evaluation.datasetId !== suite.id || evaluation.datasetVersion !== suite.version ||
        report.sourceScenarioSuite.id !== suite.id || report.sourceScenarioSuite.version !== suite.version ||
        report.sourceScenarioSuite.healthTaxonomyVersion !== suite.healthTaxonomyVersion ||
        report.sourceEvaluation.runId !== evaluation.runId ||
        report.sourceEvaluation.datasetId !== evaluation.datasetId ||
        report.sourceEvaluation.datasetVersion !== evaluation.datasetVersion ||
        report.sourceEvaluation.evaluatorVersion !== evaluation.evaluatorVersion) {
      throw new BenchmarkConfigurationError("tutor_health_run_manifest_invalid");
    }
    // 仅复制通过严格白名单校验的 provenance；不复制响应、对话或隐藏判据。
    return structuredClone(parseTutorHealthRunManifest({
      kind: TUTOR_HEALTH_RUN_MANIFEST_KIND,
      schemaVersion: TUTOR_HEALTH_RUN_MANIFEST_SCHEMA_VERSION,
      provenance: "local_execution_only",
      suite: { id: suite.id, version: suite.version, sha256: sha256(tutorHealthComparisonJson(suite)) },
      evaluation: { runId: evaluation.runId, evaluatorVersion: evaluation.evaluatorVersion, sha256: sha256(input.evaluationJson) },
      report: { schemaVersion: report.schemaVersion, sha256: sha256(input.reportJson) },
      tutor: evaluation.tutor,
      judge: evaluation.judge,
      runsPerCase: evaluation.runsPerCase,
    }));
  } catch {
    // JSON.parse 的错误可能含私有片段；对外只返回稳定错误。
    throw new BenchmarkConfigurationError("tutor_health_run_manifest_invalid");
  }
}

export function formatTutorHealthRunManifest(manifest: TutorHealthRunManifest): string {
  return `${JSON.stringify(JSON.parse(tutorHealthComparisonJson(parseTutorHealthRunManifest(manifest))), null, 2)}\n`;
}

export function verifyTutorHealthRunManifest(value: unknown, input: TutorHealthRunManifestInput): void {
  const manifest = parseTutorHealthRunManifest(value);
  if (tutorHealthComparisonJson(manifest) !== tutorHealthComparisonJson(buildTutorHealthRunManifest(input))) {
    throw new BenchmarkConfigurationError("tutor_health_run_manifest_mismatch");
  }
}
