/**
 * Experimental, evaluator-owned mathematics challenge evidence.
 * These labels are authoring hypotheses, never IRT item parameters or official benchmark scores.
 */
export type MathPractice = "reasoning" | "justification" | "representation" | "modeling";
export type AuthorChallenge = "low" | "moderate" | "high" | "undetermined";
export type CalibrationState = "author-proposed-uncalibrated" | "expert-reviewed" | "empirically-calibrated";

export interface MathTaskEvidence {
  readonly id: string;
  readonly cohort: string;
  readonly targetPrerequisites: readonly string[];
  readonly mathematicalPractice: readonly MathPractice[];
  readonly cognitiveDemand: string;
  readonly anticipatedChallenge: AuthorChallenge;
  readonly challengeRationale: string;
  readonly verifiedResult: string;
  readonly validAlternativeMethods: readonly string[];
  readonly risk: string;
  readonly scenarioIds: readonly string[];
}

export interface MathChallengeEvidenceRegistry {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly version: string;
  readonly status: CalibrationState;
  readonly suiteId: string;
  readonly note: string;
  readonly tasks: readonly MathTaskEvidence[];
}

const allowedPractices = new Set<string>(["reasoning","justification","representation","modeling"]);
const allowedChallenge = new Set<string>(["low","moderate","high","undetermined"]);
const allowedStatus = new Set<string>(["author-proposed-uncalibrated","expert-reviewed","empirically-calibrated"]);
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 2000;
const strings = (v: unknown, max = 20): v is string[] =>
  Array.isArray(v) && v.length > 0 && v.length <= max && v.every(text) && new Set(v).size === v.length;
const exactKeys = (v: Record<string, unknown>, names: readonly string[]) =>
  Object.keys(v).length === names.length && Object.keys(v).every((key) => names.includes(key));

/** Fail closed: an unrecognized or under-specified entry is not silently accepted. */
export function parseMathChallengeEvidence(value: unknown): MathChallengeEvidenceRegistry {
  const root = record(value) ? value : null;
  if (!root ||
    !exactKeys(root, ["schemaVersion","id","version","status","suiteId","note","tasks"]) ||
    root.schemaVersion !== 1 || !text(root.id) || !text(root.version) ||
    !allowedStatus.has(String(root.status)) || !text(root.suiteId) || !text(root.note) ||
    !Array.isArray(root.tasks) || root.tasks.length < 1 || root.tasks.length > 100
  ) throw new Error("math_challenge_evidence_invalid");
  const seenIds = new Set<string>(), seenScenarios = new Set<string>();
  for (const item of root.tasks) {
    if (!record(item) || !exactKeys(item, ["id","cohort","targetPrerequisites","mathematicalPractice","cognitiveDemand","anticipatedChallenge","challengeRationale","verifiedResult","validAlternativeMethods","risk","scenarioIds"]) ||
      !text(item.id) || !text(item.cohort) || !strings(item.targetPrerequisites) ||
      !strings(item.mathematicalPractice) ||
      !item.mathematicalPractice.every((p: string) => allowedPractices.has(p)) ||
      !text(item.cognitiveDemand) || !allowedChallenge.has(String(item.anticipatedChallenge)) ||
      !text(item.challengeRationale) || !text(item.verifiedResult) ||
      !strings(item.validAlternativeMethods) || !text(item.risk) || !strings(item.scenarioIds)
    ) throw new Error("math_challenge_evidence_invalid");
    if (seenIds.has(item.id)) throw new Error("math_challenge_evidence_duplicate_task");
    seenIds.add(item.id);
    for (const id of item.scenarioIds) {
      if (seenScenarios.has(id)) throw new Error("math_challenge_evidence_duplicate_scenario");
      seenScenarios.add(id);
    }
  }
  return value as MathChallengeEvidenceRegistry;
}

/** Cross-check authored evidence against a parsed Scenario vNext suite without changing its runtime contract. */
export function validateMathChallengeCoverage(registry: MathChallengeEvidenceRegistry, suite: {
  readonly id: string;
  readonly scenarios: readonly { readonly identity: { readonly id: string }; readonly learningContext: { readonly subject: string } }[];
}): void {
  if (registry.suiteId !== suite.id) throw new Error("math_challenge_evidence_suite_mismatch");
  const ids = new Set(suite.scenarios.map((scenario) => scenario.identity.id));
  if (ids.size !== suite.scenarios.length || suite.scenarios.some(s => s.learningContext.subject !== "mathematics"))
    throw new Error("math_challenge_evidence_subject_mismatch");
  const references = new Set(registry.tasks.flatMap(task => task.scenarioIds));
  if (references.size !== ids.size || [...references].some(id => !ids.has(id)))
    throw new Error("math_challenge_evidence_coverage_mismatch");
}
