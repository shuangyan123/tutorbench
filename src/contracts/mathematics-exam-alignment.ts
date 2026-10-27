import type { MathematicsKnowledgeMap } from "./mathematics-knowledge-map.js";
import type { TutorScenarioSuiteVNext } from "./tutor-scenario-vnext.js";

/** Experimental interpretation of published examination documents, not an official paper blueprint. */
export interface MathematicsExamSource {
  readonly label: string;
  readonly url: string;
  readonly sourceKind: "official_curriculum" | "official_exam_guidance" |
    "official_exam_analysis" | "institution_republication";
  readonly published: string | null;
}
export interface MathematicsExamModule {
  readonly id: string;
  readonly labelZh: string;
  readonly nodeIds: readonly string[];
  readonly caseIds: readonly string[];
  readonly examRelevance: "curriculum-inferred" | "outline-supported";
}
export interface MathematicsExamProfile {
  readonly id: string;
  readonly nameZh: string;
  readonly examYear: number;
  readonly region: string;
  readonly scopeNote: string;
  readonly sources: readonly MathematicsExamSource[];
  readonly examFormat: {
    readonly timedExam: true;
    readonly minutes: number | null;
    readonly questionCount: number | null;
    readonly pointWeightsKnown: false;
    readonly formatNotes: string;
  };
  readonly modules: readonly MathematicsExamModule[];
  readonly capacities: readonly string[];
  readonly examStrategyNote: string;
  readonly authoringGaps: readonly string[];
}
export interface MathematicsExamAlignment {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly version: string;
  readonly status: "author-proposed-unverified";
  readonly purpose: string;
  readonly profiles: readonly MathematicsExamProfile[];
}

type Rec = Record<string, unknown>;
const rec = (x: unknown): x is Rec => x !== null && typeof x === "object" && !Array.isArray(x);
const keys = (x: Rec, props: readonly string[]) =>
  Object.keys(x).length === props.length && Object.keys(x).every(k => props.includes(k));
const text = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= 3000;
const strings = (x: unknown, allowEmpty = false): x is string[] =>
  Array.isArray(x) && x.length <= 100 && (allowEmpty || x.length > 0) &&
  x.every(text) && new Set(x).size === x.length;
const kinds = new Set(["official_curriculum", "official_exam_guidance",
  "official_exam_analysis", "institution_republication"]);
const relevance = new Set(["curriculum-inferred", "outline-supported"]);

export function parseMathematicsExamAlignment(input: unknown): MathematicsExamAlignment {
  if (!rec(input) || !keys(input, ["schemaVersion", "id", "version", "status", "purpose", "profiles"]) ||
    input.schemaVersion !== 1 || !text(input.id) || !text(input.version) ||
    input.status !== "author-proposed-unverified" || !text(input.purpose) ||
    !Array.isArray(input.profiles) || input.profiles.length < 1 || input.profiles.length > 50)
    throw new Error("mathematics_exam_alignment_invalid");

  const seenProfiles = new Set<string>();
  for (const raw of input.profiles) {
    if (!rec(raw) || !keys(raw, ["id", "nameZh", "examYear", "region", "scopeNote", "sources",
      "examFormat", "modules", "capacities", "examStrategyNote", "authoringGaps"]) ||
      !text(raw.id) || !text(raw.nameZh) || !text(raw.region) || !text(raw.scopeNote) ||
      !Number.isInteger(raw.examYear) || (raw.examYear as number) < 2020 ||
      seenProfiles.has(raw.id) || !Array.isArray(raw.sources) || raw.sources.length < 1 ||
      raw.sources.length > 15 || !Array.isArray(raw.modules) || raw.modules.length < 1 ||
      raw.modules.length > 60 || !strings(raw.capacities) ||
      !strings(raw.authoringGaps) || !text(raw.examStrategyNote))
      throw new Error("mathematics_exam_profile_invalid");
    seenProfiles.add(raw.id);

    for (const item of raw.sources) {
      if (!rec(item) || !keys(item, ["label", "url", "sourceKind", "published"]) ||
        !text(item.label) || !text(item.url) || !item.url.startsWith("https://") ||
        !kinds.has(String(item.sourceKind)) ||
        (item.published !== null && (!text(item.published) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(item.published))))
        throw new Error("mathematics_exam_source_invalid");
    }
    const format = raw.examFormat;
    if (!rec(format) || !keys(format, ["timedExam", "minutes", "questionCount",
      "pointWeightsKnown", "formatNotes"]) || format.timedExam !== true ||
      format.pointWeightsKnown !== false || !text(format.formatNotes) ||
      (format.minutes !== null && (!Number.isInteger(format.minutes) || (format.minutes as number) < 1)) ||
      (format.questionCount !== null && (!Number.isInteger(format.questionCount) || (format.questionCount as number) < 1)))
      throw new Error("mathematics_exam_format_invalid");
    const seenModules = new Set<string>();
    for (const item of raw.modules) {
      if (!rec(item) || !keys(item, ["id", "labelZh", "nodeIds", "caseIds", "examRelevance"]) ||
        !text(item.id) || seenModules.has(item.id) || !text(item.labelZh) ||
        !strings(item.nodeIds) || !strings(item.caseIds, true) ||
        !relevance.has(String(item.examRelevance)))
        throw new Error("mathematics_exam_module_invalid");
      seenModules.add(item.id);
    }
  }
  return input as unknown as MathematicsExamAlignment;
}

/** Cross-check authored exam-to-case links; unmapped syllabus gaps are explicitly allowed. */
export function validateMathematicsExamCoverage(
  exam: MathematicsExamAlignment,
  map: MathematicsKnowledgeMap,
  suite: TutorScenarioSuiteVNext,
): void {
  const knowledgeIds = new Set(map.nodes.map(n => n.id));
  const caseIds = new Set(suite.scenarios.map(s => s.identity.id));
  for (const profile of exam.profiles)
    for (const module of profile.modules) {
      if (module.nodeIds.some(id => !knowledgeIds.has(id)) ||
        module.caseIds.some(id => !caseIds.has(id)))
        throw new Error("mathematics_exam_coverage_invalid");
    }
}
