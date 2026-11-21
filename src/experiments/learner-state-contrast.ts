/** Frozen, author-synthetic contrasts of learner *evidence*, not learning outcomes.
 * Tutor-facing packets contain no operator expectations or evaluator-only states.
 */
import { createHash } from "node:crypto";
import type { TutorTurnInput } from "../contracts/tutor.js";
import type { TutorScenarioSuiteVNext } from "../contracts/tutor-scenario-vnext.js";
import { toTutorTurnInput } from "../contracts/tutor-eval.js";
import { tutorScenarioSuiteToTutorEvalDataset } from "../datasets/real-world.js";

export interface LearnerEvidenceContrastPair {
  readonly id: string;
  readonly sourceScenarioId: string;
  readonly sourceScenarioVersion: string;
  readonly sourceLatestLearnerMessage: string;
  readonly prefix: string;
  readonly suffix: string;
  /** Only this span may differ between the two paired Tutor inputs. */
  readonly controls: { readonly a: string; readonly b: string };
  /** Operator-only, never export to a Tutor. */
  readonly researchQuestion: string;
  readonly comparisonKind: "signal-added" | "paraphrase-invariant" | "expected-action-invariant";
}

export interface LearnerEvidenceContrastPlan {
  readonly schemaVersion: 1;
  readonly id: "learner-state-counterfactual-contrasts-v0.1";
  readonly version: "0.1.0";
  readonly sourceSuite: { readonly id: string; readonly version: string };
  readonly evidenceMode: "author_written_counterfactual";
  readonly tutorExecutionStatus: "not_run";
  readonly learnerOutcomeStatus: "not_measured";
  readonly pairs: readonly LearnerEvidenceContrastPair[];
}

export interface LearnerEvidenceContrastCase {
  readonly caseId: string;
  readonly inputSha256: string;
  readonly input: TutorTurnInput;
}

export interface LearnerEvidenceContrastTutorPacketFile {
  readonly schemaVersion: 1;
  readonly id: "learner-state-contrast-tutor-packets";
  readonly version: "0.1.0";
  readonly blind: true;
  readonly evidenceMode: "author_written_counterfactual";
  readonly tutorExecutionStatus: "not_run";
  readonly sourceVisibleSha256: string;
  readonly cases: readonly LearnerEvidenceContrastCase[];
}

export class LearnerEvidenceContrastError extends Error {
  readonly code = "learner_evidence_contrast_invalid" as const;
  constructor(reason: string) {
    super(`Learner evidence contrast invalid: ${reason}`);
    this.name = "LearnerEvidenceContrastError";
  }
}
const fail = (reason: string): never => { throw new LearnerEvidenceContrastError(reason); };
const rec = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const exact = (v: unknown, keys: readonly string[]): v is Record<string, unknown> =>
  rec(v) && Object.keys(v).length === keys.length && Object.keys(v).every(k => keys.includes(k));
const txt = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= 1600;
const span = (v: unknown): v is string => typeof v === "string" && v.length <= 500;
const sha256 = (v: unknown): string =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const expectedSources = new Set([
  "pai-unknown-cause", "pai-known-foundation", "pai-after-progress",
  "pai-whole-undefined", "pai-rule-misconception",
]);

/** Strict authoring validation; semantic plausibility remains human/independent work. */
export function parseLearnerEvidenceContrastPlan(
  value: unknown,
  sourceSuite: TutorScenarioSuiteVNext,
): LearnerEvidenceContrastPlan {
  if (!exact(value, [
    "schemaVersion", "id", "version", "sourceSuite", "evidenceMode",
    "tutorExecutionStatus", "learnerOutcomeStatus", "pairs",
  ]) || value.schemaVersion !== 1 ||
      value.id !== "learner-state-counterfactual-contrasts-v0.1" ||
      value.version !== "0.1.0" ||
      value.evidenceMode !== "author_written_counterfactual" ||
      value.tutorExecutionStatus !== "not_run" ||
      value.learnerOutcomeStatus !== "not_measured") {
    return fail("plan_structure_or_claim");
  }
  if (!exact(value.sourceSuite, ["id", "version"]) ||
      value.sourceSuite.id !== sourceSuite.id ||
      value.sourceSuite.version !== sourceSuite.version ||
      sourceSuite.id !== "prerequisite-aware-instruction-v0.1" ||
      sourceSuite.version !== "0.1.0") {
    return fail("source_suite_version");
  }
  if (!Array.isArray(value.pairs) || value.pairs.length !== expectedSources.size) {
    return fail("pair_count");
  }
  const sources = new Map(sourceSuite.scenarios.map(s => [s.identity.id, s]));
  const usedSources = new Set<string>();
  const usedPairIds = new Set<string>();
  for (const pair of value.pairs) {
    if (!exact(pair, [
      "id", "sourceScenarioId", "sourceScenarioVersion", "sourceLatestLearnerMessage",
      "prefix", "suffix", "controls", "researchQuestion", "comparisonKind",
    ]) || !txt(pair.id) || !/^[a-z][a-z0-9-]{1,63}$/u.test(pair.id) ||
        !txt(pair.sourceScenarioId) || !txt(pair.sourceScenarioVersion) ||
        !txt(pair.sourceLatestLearnerMessage) || !span(pair.prefix) ||
        !span(pair.suffix) || !txt(pair.researchQuestion) ||
        !["signal-added", "paraphrase-invariant", "expected-action-invariant"]
          .includes(pair.comparisonKind as string) ||
        usedPairIds.has(pair.id) || usedSources.has(pair.sourceScenarioId)) {
      return fail("pair_structure_or_duplicate");
    }
    usedPairIds.add(pair.id);
    usedSources.add(pair.sourceScenarioId);
    if (!expectedSources.has(pair.sourceScenarioId)) return fail("unknown_source");
    const source = sources.get(pair.sourceScenarioId);
    if (!source || source.identity.version !== pair.sourceScenarioVersion ||
        source.trajectory.conversationHistory.at(-1)?.role !== "user" ||
        source.trajectory.conversationHistory.at(-1)?.content !== pair.sourceLatestLearnerMessage) {
      return fail("source_utterance_drift");
    }
    if (!exact(pair.controls, ["a", "b"]) ||
        !span(pair.controls.a) || !span(pair.controls.b) ||
        pair.controls.a === pair.controls.b ||
        pair.prefix.length === 0 ||
        pair.prefix.length + pair.suffix.length + pair.controls.a.length > 1900 ||
        pair.prefix.length + pair.suffix.length + pair.controls.b.length > 1900) {
      return fail("contrast_span");
    }
    if (pair.comparisonKind === "signal-added" ||
        pair.comparisonKind === "expected-action-invariant") {
      if (pair.controls.a !== "" || pair.controls.b.length === 0) {
        return fail("nonminimal_added_signal");
      }
    } else if (pair.controls.a === "" || pair.controls.b === "") {
      return fail("paraphrase_requires_two_phrasings");
    }
  }
  if (expectedSources.size !== usedSources.size ||
      [...expectedSources].some(k => !usedSources.has(k))) {
    return fail("uncovered_source");
  }
  if (new Set(sourceSuite.scenarios.map(s => s.learningContext.learningObjective)).size !== 1) {
    return fail("objective_not_fixed");
  }
  return value as unknown as LearnerEvidenceContrastPlan;
}

/** The Tutor-facing output is derived exclusively from the established TutorTurnInput
 * projection. Operator questions, model labels, and evaluator-only states never cross.
 * To isolate stated evidence, authored static known-concept labels are neutralized
 * on BOTH arms rather than leaking a privileged diagnosis into the experiment.
 */
export function buildLearnerEvidenceContrastTutorPackets(
  planValue: unknown,
  sourceSuite: TutorScenarioSuiteVNext,
): LearnerEvidenceContrastTutorPacketFile {
  const plan = parseLearnerEvidenceContrastPlan(planValue, sourceSuite);
  const dataset = tutorScenarioSuiteToTutorEvalDataset(sourceSuite);
  const cases: LearnerEvidenceContrastCase[] = [];
  const visibleSources = [];
  for (const [index, pair] of plan.pairs.entries()) {
    const original = dataset.cases.find(x => x.id === pair.sourceScenarioId);
    if (!original) return fail("missing_compiled_source");
    const projected = toTutorTurnInput(original);
    visibleSources.push({
      id: pair.sourceScenarioId, version: original.version,
      initialContext: projected.initialContext, conversation: projected.conversation,
      learningObjective: projected.learningObjective,
    });
    for (const arm of ["a", "b"] as const) {
      const caseId = `ls-v01-p${String(index + 1).padStart(2, "0")}-${arm}`;
      const input: TutorTurnInput = {
        ...projected,
        scenarioId: caseId, caseId, caseVersion: "0.1.0",
        currentStudentMessage: pair.prefix + pair.controls[arm] + pair.suffix,
        studentState: {
          ...projected.studentState,
          knownConcepts: [], misconceptions: [],
        },
      };
      cases.push({ caseId, inputSha256: sha256(input), input });
    }
  }
  // Fixed interleaved order: no adjacent paired arms and no random seed needed.
  const ordered = [...cases.filter((_, i) => i % 2 === 0),
    ...cases.filter((_, i) => i % 2 === 1).reverse()];
  return {
    schemaVersion: 1,
    id: "learner-state-contrast-tutor-packets",
    version: "0.1.0", blind: true,
    evidenceMode: "author_written_counterfactual",
    tutorExecutionStatus: "not_run",
    sourceVisibleSha256: sha256(visibleSources),
    cases: ordered,
  };
}
