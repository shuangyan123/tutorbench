import { BenchmarkConfigurationError } from "./errors.js";
import { isTutorHealthComparisonDescriptor } from "./tutor-health-comparison-validation.js";
import {
  TUTOR_HEALTH_RUN_MANIFEST_KIND,
  TUTOR_HEALTH_RUN_MANIFEST_SCHEMA_VERSION,
  type TutorHealthRunManifest,
} from "./tutor-health-run-manifest.js";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}
function hash(value: unknown): boolean {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

export function isTutorHealthRunManifest(value: unknown): value is TutorHealthRunManifest {
  if (!record(value) || !keys(value, ["kind", "schemaVersion", "provenance", "suite", "evaluation", "report", "tutor", "judge", "runsPerCase"])) return false;
  const { suite, evaluation, report } = value;
  return value.kind === TUTOR_HEALTH_RUN_MANIFEST_KIND &&
    value.schemaVersion === TUTOR_HEALTH_RUN_MANIFEST_SCHEMA_VERSION &&
    value.provenance === "local_execution_only" &&
    record(suite) && keys(suite, ["id", "version", "sha256"]) &&
    text(suite.id, 120) && /^[a-z0-9][a-z0-9._-]*$/u.test(suite.id) && text(suite.version, 80) && hash(suite.sha256) &&
    record(evaluation) && keys(evaluation, ["runId", "evaluatorVersion", "sha256"]) &&
    text(evaluation.runId, 160) && text(evaluation.evaluatorVersion, 80) && hash(evaluation.sha256) &&
    record(report) && keys(report, ["schemaVersion", "sha256"]) && report.schemaVersion === 2 && hash(report.sha256) &&
    isTutorHealthComparisonDescriptor(value.tutor, false) &&
    (value.judge === null || isTutorHealthComparisonDescriptor(value.judge, true)) &&
    typeof value.runsPerCase === "number" && Number.isSafeInteger(value.runsPerCase) && value.runsPerCase > 0;
}

export function parseTutorHealthRunManifest(value: unknown): TutorHealthRunManifest {
  if (!isTutorHealthRunManifest(value)) throw new BenchmarkConfigurationError("tutor_health_run_manifest_invalid");
  return value;
}

export function assertValidTutorHealthRunManifest(value: unknown): asserts value is TutorHealthRunManifest {
  parseTutorHealthRunManifest(value);
}
