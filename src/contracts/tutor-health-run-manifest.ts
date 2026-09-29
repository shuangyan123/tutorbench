import type { TutorEvalJudgeDescriptor, TutorEvalTutorDescriptor } from "./result.js";
import type { TutorHealthReport } from "./tutor-health.js";

export const TUTOR_HEALTH_RUN_MANIFEST_KIND = "tutor-health-run-manifest" as const;
export const TUTOR_HEALTH_RUN_MANIFEST_SCHEMA_VERSION = 1 as const;

/** Local source identity only; never attests the external provider's configuration. */
export interface TutorHealthRunManifest {
  readonly kind: typeof TUTOR_HEALTH_RUN_MANIFEST_KIND;
  readonly schemaVersion: typeof TUTOR_HEALTH_RUN_MANIFEST_SCHEMA_VERSION;
  readonly provenance: "local_execution_only";
  /** SHA-256 of canonical validated suite JSON, including evaluator-only content. */
  readonly suite: { readonly id: string; readonly version: string; readonly sha256: string };
  readonly evaluation: {
    readonly runId: string;
    readonly evaluatorVersion: string;
    /** SHA-256 of the exact UTF-8 evaluation.json bytes, including its final newline. */
    readonly sha256: string;
  };
  readonly report: {
    readonly schemaVersion: TutorHealthReport["schemaVersion"];
    /** SHA-256 of the exact UTF-8 health-report.json bytes. */
    readonly sha256: string;
  };
  readonly tutor: TutorEvalTutorDescriptor;
  readonly judge: TutorEvalJudgeDescriptor | null;
  readonly runsPerCase: number;
}
