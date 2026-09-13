import { createHash } from "node:crypto";

import type {
  TutorEvalCapabilityTag,
  TutorEvalCategory,
  TutorEvalDataset,
  TutorEvalRubric,
} from "../contracts/index.js";
import { resolveTutorCaseLocale } from "../contracts/locale.js";

export const RUBRIC_AUTHORING_AUDIT_ID = "canonical-rubric-authoring-qa" as const;
export const RUBRIC_AUTHORING_AUDIT_VERSION = "0.1.0" as const;

export type RubricAuthoringEvidenceClass =
  | "structural_fact"
  | "semantic_review_candidate"
  | "informational";

export type RubricAuthoringPriority = "high" | "medium" | "low";

export type RubricAuthoringRuleId =
  | "multi_clause"
  | "long_form"
  | "category_capability_tension"
  | "within_case_overlap"
  | "cross_locale_structure"
  | "known_ambiguity_sentinel";

export interface RubricAuthoringAuditFinding {
  readonly ruleId: RubricAuthoringRuleId;
  readonly evidenceClass: RubricAuthoringEvidenceClass;
  readonly priority: RubricAuthoringPriority;
  readonly caseId: string;
  readonly caseVersion: string;
  readonly locale: string;
  readonly crossLocaleGroupId?: string;
  readonly rubricIds: readonly string[];
  readonly categories: readonly TutorEvalCategory[];
  readonly capabilityTags: readonly string[];
  readonly evidence: string;
  readonly metrics?: Readonly<Record<string, string | number | boolean>>;
}

export interface RubricAuthoringAuditSummary {
  readonly findingCount: number;
  readonly byEvidenceClass: Readonly<Record<RubricAuthoringEvidenceClass, number>>;
  readonly byPriority: Readonly<Record<RubricAuthoringPriority, number>>;
  readonly byRule: Readonly<Record<RubricAuthoringRuleId, number>>;
}

export interface RubricAuthoringAuditReport {
  readonly schemaVersion: 1;
  readonly auditId: typeof RUBRIC_AUTHORING_AUDIT_ID;
  readonly auditVersion: typeof RUBRIC_AUTHORING_AUDIT_VERSION;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly advisoryOnly: true;
  readonly mutatesBenchmarkData: false;
  readonly hardGate: false;
  readonly caseCount: number;
  readonly rubricCount: number;
  readonly ruleSetFingerprint: string;
  readonly reportFingerprint: string;
  readonly summary: RubricAuthoringAuditSummary;
  readonly findings: readonly RubricAuthoringAuditFinding[];
}

interface RuleDefinition {
  readonly id: RubricAuthoringRuleId;
  readonly evidenceClass: RubricAuthoringEvidenceClass;
  readonly description: string;
}

export const RUBRIC_AUTHORING_RULES: readonly RuleDefinition[] = Object.freeze([
  {
    id: "multi_clause",
    evidenceClass: "semantic_review_candidate",
    description:
      "Flags criterion prose whose deterministic clause/verb signals suggest more than one material requirement may be present.",
  },
  {
    id: "long_form",
    evidenceClass: "structural_fact",
    description:
      "Records unusually long criterion prose using fixed character/word thresholds; length alone is not a defect.",
  },
  {
    id: "category_capability_tension",
    evidenceClass: "semantic_review_candidate",
    description:
      "Flags a rubric whose primary capability tag belongs to a different canonical category family.",
  },
  {
    id: "within_case_overlap",
    evidenceClass: "semantic_review_candidate",
    description:
      "Flags neighboring rubrics with high lexical overlap as candidates for double-counting review.",
  },
  {
    id: "cross_locale_structure",
    evidenceClass: "structural_fact",
    description:
      "Compares cross-locale pair structure by rubric category, behavior, capability, and evaluator type without judging translation equivalence.",
  },
  {
    id: "known_ambiguity_sentinel",
    evidenceClass: "informational",
    description:
      "Keeps previously diagnosed material-requirement boundary cases visible in the review inventory.",
  },
]);

const capabilityCategory: Readonly<Partial<Record<TutorEvalCapabilityTag, TutorEvalCategory>>> = {
  factual_correctness: "correctness",
  conceptual_correctness: "correctness",
  procedural_correctness: "correctness",
  reasoning_consistency: "correctness",
  misleading_simplification: "correctness",
  error_detection: "diagnosis",
  error_localization: "diagnosis",
  misconception_identification: "diagnosis",
  knowledge_gap_identification: "diagnosis",
  correct_answer_wrong_reasoning: "diagnosis",
  uncertainty_detection: "diagnosis",
  hint_calibration: "guidance",
  scaffolding: "guidance",
  student_agency: "guidance",
  answer_non_disclosure: "guidance",
  overhelping_avoidance: "guidance",
  conceptual_prompting: "guidance",
  procedural_prompting: "guidance",
  prior_knowledge_adaptation: "adaptation",
  difficulty_adaptation: "adaptation",
  misconception_specific_adaptation: "adaptation",
  explanation_depth_adaptation: "adaptation",
  counterfactual_adaptation: "adaptation",
  clear_next_step: "actionability",
  student_executable_action: "actionability",
  check_for_understanding: "actionability",
  productive_question: "actionability",
};

const englishActionVerbs = new Set([
  "address",
  "ask",
  "avoid",
  "check",
  "correct",
  "describe",
  "diagnose",
  "distinguish",
  "end",
  "evaluate",
  "explain",
  "give",
  "guide",
  "identify",
  "leave",
  "locate",
  "name",
  "preserve",
  "prompt",
  "provide",
  "recognize",
  "state",
  "tell",
  "use",
]);

const englishStopWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "be",
  "before",
  "but",
  "by",
  "do",
  "for",
  "from",
  "in",
  "is",
  "it",
  "not",
  "of",
  "on",
  "or",
  "rather",
  "student",
  "than",
  "that",
  "the",
  "their",
  "them",
  "they",
  "to",
  "when",
  "while",
  "with",
]);

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function rubricEvaluationType(rubric: TutorEvalRubric): string {
  return rubric.evaluationType ?? (rubric.evaluatorId === undefined ? "judge" : "deterministic");
}

function rubricBehavior(rubric: TutorEvalRubric): string {
  return rubric.behavior ?? "required";
}

function criterionWordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function criterionCodePointCount(value: string): number {
  return [...value].length;
}

function connectorCount(value: string): number {
  const english = value.toLowerCase().match(/\b(and|but|while|rather than|as well as|then)\b/gu)?.length ?? 0;
  const chinese = value.match(/并且|并|而且|同时|以及|而不是|然后/gu)?.length ?? 0;
  return english + chinese;
}

function actionVerbCount(value: string): number {
  const englishWords = value.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/gu) ?? [];
  const englishCount = englishWords.filter((word) => englishActionVerbs.has(word)).length;
  const chineseCount = value.match(/指出|识别|说明|解释|引导|要求|询问|提问|检查|纠正|给出|提供|保留|避免|判断|评估|定位|比较|使用/gu)?.length ?? 0;
  return englishCount + chineseCount;
}

function lexicalTokens(value: string): Set<string> {
  const tokens = new Set<string>();
  const normalized = value.toLowerCase();
  for (const word of normalized.match(/[a-z0-9]+(?:'[a-z0-9]+)?/gu) ?? []) {
    if (word.length >= 3 && !englishStopWords.has(word)) {
      tokens.add(word);
    }
  }
  for (const run of normalized.match(/[\p{Script=Han}]+/gu) ?? []) {
    const chars = [...run];
    if (chars.length === 1) {
      tokens.add(chars[0] ?? "");
      continue;
    }
    for (let index = 0; index < chars.length - 1; index += 1) {
      tokens.add(`${chars[index]}${chars[index + 1]}`);
    }
  }
  tokens.delete("");
  return tokens;
}

function jaccard(left: Set<string>, right: Set<string>): { similarity: number; shared: number } {
  const shared = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return { similarity: union === 0 ? 0 : shared / union, shared };
}

function findingSortKey(finding: RubricAuthoringAuditFinding): string {
  const priorityOrder: Readonly<Record<RubricAuthoringPriority, string>> = {
    high: "0",
    medium: "1",
    low: "2",
  };
  return [
    priorityOrder[finding.priority],
    finding.ruleId,
    finding.caseId,
    finding.caseVersion,
    finding.locale,
    finding.rubricIds.join("|"),
    finding.evidence,
  ].join("\u0000");
}

function structuralSignature(rubric: TutorEvalRubric): string {
  return [
    rubric.category,
    rubricBehavior(rubric),
    rubric.capabilityTag ?? "",
    rubricEvaluationType(rubric),
  ].join("|");
}

function summarize(findings: readonly RubricAuthoringAuditFinding[]): RubricAuthoringAuditSummary {
  const byEvidenceClass: Record<RubricAuthoringEvidenceClass, number> = {
    structural_fact: 0,
    semantic_review_candidate: 0,
    informational: 0,
  };
  const byPriority: Record<RubricAuthoringPriority, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };
  const byRule: Record<RubricAuthoringRuleId, number> = {
    multi_clause: 0,
    long_form: 0,
    category_capability_tension: 0,
    within_case_overlap: 0,
    cross_locale_structure: 0,
    known_ambiguity_sentinel: 0,
  };
  for (const finding of findings) {
    byEvidenceClass[finding.evidenceClass] += 1;
    byPriority[finding.priority] += 1;
    byRule[finding.ruleId] += 1;
  }
  return {
    findingCount: findings.length,
    byEvidenceClass,
    byPriority,
    byRule,
  };
}

export function buildRubricAuthoringAudit(
  dataset: TutorEvalDataset,
): RubricAuthoringAuditReport {
  const findings: RubricAuthoringAuditFinding[] = [];

  for (const tutorCase of dataset.cases) {
    const locale = resolveTutorCaseLocale(tutorCase.locale);
    const rubrics = tutorCase.evaluatorOnly.rubrics;

    for (const rubric of rubrics) {
      const connectors = connectorCount(rubric.criterion);
      const verbs = actionVerbCount(rubric.criterion);
      if ((connectors >= 1 && verbs >= 2) || connectors >= 2) {
        findings.push({
          ruleId: "multi_clause",
          evidenceClass: "semantic_review_candidate",
          priority: connectors >= 2 && verbs >= 3 ? "high" : "medium",
          caseId: tutorCase.id,
          caseVersion: tutorCase.version,
          locale,
          ...(tutorCase.crossLocaleGroupId === undefined
            ? {}
            : { crossLocaleGroupId: tutorCase.crossLocaleGroupId }),
          rubricIds: [rubric.id],
          categories: [rubric.category],
          capabilityTags: rubric.capabilityTag === undefined ? [] : [rubric.capabilityTag],
          evidence: rubric.criterion,
          metrics: {
            connectorCount: connectors,
            actionVerbCount: verbs,
          },
        });
      }

      const codePoints = criterionCodePointCount(rubric.criterion);
      const words = criterionWordCount(rubric.criterion);
      if (codePoints >= 180 || words >= 30) {
        findings.push({
          ruleId: "long_form",
          evidenceClass: "structural_fact",
          priority: "low",
          caseId: tutorCase.id,
          caseVersion: tutorCase.version,
          locale,
          ...(tutorCase.crossLocaleGroupId === undefined
            ? {}
            : { crossLocaleGroupId: tutorCase.crossLocaleGroupId }),
          rubricIds: [rubric.id],
          categories: [rubric.category],
          capabilityTags: rubric.capabilityTag === undefined ? [] : [rubric.capabilityTag],
          evidence: rubric.criterion,
          metrics: {
            codePointCount: codePoints,
            whitespaceWordCount: words,
          },
        });
      }

      if (rubric.capabilityTag !== undefined) {
        const expectedCategory = capabilityCategory[rubric.capabilityTag];
        if (expectedCategory !== undefined && expectedCategory !== rubric.category) {
          findings.push({
            ruleId: "category_capability_tension",
            evidenceClass: "semantic_review_candidate",
            priority: "high",
            caseId: tutorCase.id,
            caseVersion: tutorCase.version,
            locale,
            ...(tutorCase.crossLocaleGroupId === undefined
              ? {}
              : { crossLocaleGroupId: tutorCase.crossLocaleGroupId }),
            rubricIds: [rubric.id],
            categories: [rubric.category],
            capabilityTags: [rubric.capabilityTag],
            evidence:
              `Rubric category ${rubric.category} differs from the audit family's expected ` +
              `${expectedCategory} category for capability ${rubric.capabilityTag}.`,
            metrics: {
              actualCategory: rubric.category,
              expectedCategory,
            },
          });
        }
      }

      if (
        tutorCase.id === "language-word-context-001" &&
        rubric.id === "language-word-context-001"
      ) {
        findings.push({
          ruleId: "known_ambiguity_sentinel",
          evidenceClass: "informational",
          priority: "medium",
          caseId: tutorCase.id,
          caseVersion: tutorCase.version,
          locale,
          ...(tutorCase.crossLocaleGroupId === undefined
            ? {}
            : { crossLocaleGroupId: tutorCase.crossLocaleGroupId }),
          rubricIds: [rubric.id],
          categories: [rubric.category],
          capabilityTags: rubric.capabilityTag === undefined ? [] : [rubric.capabilityTag],
          evidence:
            "Known diagnostic sentinel: prior repository work decomposes this criterion into multiple material requirements for discrimination testing.",
        });
      }
    }

    for (let leftIndex = 0; leftIndex < rubrics.length; leftIndex += 1) {
      const left = rubrics[leftIndex];
      if (left === undefined) continue;
      for (let rightIndex = leftIndex + 1; rightIndex < rubrics.length; rightIndex += 1) {
        const right = rubrics[rightIndex];
        if (right === undefined) continue;
        const overlap = jaccard(lexicalTokens(left.criterion), lexicalTokens(right.criterion));
        if (overlap.shared >= 3 && overlap.similarity >= 0.5) {
          findings.push({
            ruleId: "within_case_overlap",
            evidenceClass: "semantic_review_candidate",
            priority: overlap.similarity >= 0.7 ? "high" : "medium",
            caseId: tutorCase.id,
            caseVersion: tutorCase.version,
            locale,
            ...(tutorCase.crossLocaleGroupId === undefined
              ? {}
              : { crossLocaleGroupId: tutorCase.crossLocaleGroupId }),
            rubricIds: [left.id, right.id].sort(),
            categories: [left.category, right.category].sort() as TutorEvalCategory[],
            capabilityTags: [left.capabilityTag, right.capabilityTag]
              .filter((value): value is TutorEvalCapabilityTag => value !== undefined)
              .sort(),
            evidence: `${left.id}: ${left.criterion} || ${right.id}: ${right.criterion}`,
            metrics: {
              lexicalJaccard: Number(overlap.similarity.toFixed(4)),
              sharedTokenCount: overlap.shared,
            },
          });
        }
      }
    }
  }

  const groups = new Map<string, typeof dataset.cases[number][]>();
  for (const tutorCase of dataset.cases) {
    if (tutorCase.crossLocaleGroupId === undefined) continue;
    const group = groups.get(tutorCase.crossLocaleGroupId) ?? [];
    group.push(tutorCase);
    groups.set(tutorCase.crossLocaleGroupId, group);
  }
  for (const [groupId, members] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (members.length !== 2) {
      const exemplar = [...members].sort((left, right) => left.id.localeCompare(right.id))[0];
      if (exemplar !== undefined) {
        findings.push({
          ruleId: "cross_locale_structure",
          evidenceClass: "structural_fact",
          priority: "high",
          caseId: exemplar.id,
          caseVersion: exemplar.version,
          locale: resolveTutorCaseLocale(exemplar.locale),
          crossLocaleGroupId: groupId,
          rubricIds: [],
          categories: [],
          capabilityTags: [],
          evidence: `Cross-locale group ${groupId} has ${members.length} members; the current audit expects a pair.`,
          metrics: { memberCount: members.length },
        });
      }
      continue;
    }
    const sortedMembers = [...members].sort((left, right) =>
      resolveTutorCaseLocale(left.locale).localeCompare(resolveTutorCaseLocale(right.locale)),
    );
    const left = sortedMembers[0];
    const right = sortedMembers[1];
    if (left === undefined || right === undefined) continue;
    const leftSignatures = left.evaluatorOnly.rubrics.map(structuralSignature).sort();
    const rightSignatures = right.evaluatorOnly.rubrics.map(structuralSignature).sort();
    if (JSON.stringify(leftSignatures) !== JSON.stringify(rightSignatures)) {
      findings.push({
        ruleId: "cross_locale_structure",
        evidenceClass: "structural_fact",
        priority: "high",
        caseId: left.id,
        caseVersion: left.version,
        locale: resolveTutorCaseLocale(left.locale),
        crossLocaleGroupId: groupId,
        rubricIds: [
          ...left.evaluatorOnly.rubrics.map((rubric) => rubric.id),
          ...right.evaluatorOnly.rubrics.map((rubric) => rubric.id),
        ].sort(),
        categories: [...new Set([
          ...left.evaluatorOnly.rubrics.map((rubric) => rubric.category),
          ...right.evaluatorOnly.rubrics.map((rubric) => rubric.category),
        ])].sort() as TutorEvalCategory[],
        capabilityTags: [...new Set([
          ...left.evaluatorOnly.rubrics.flatMap((rubric) =>
            rubric.capabilityTag === undefined ? [] : [rubric.capabilityTag],
          ),
          ...right.evaluatorOnly.rubrics.flatMap((rubric) =>
            rubric.capabilityTag === undefined ? [] : [rubric.capabilityTag],
          ),
        ])].sort(),
        evidence:
          `Structural signatures differ for ${left.id}@${left.version} and ` +
          `${right.id}@${right.version}. This does not establish semantic or psychometric inequivalence.`,
        metrics: {
          leftRubricCount: left.evaluatorOnly.rubrics.length,
          rightRubricCount: right.evaluatorOnly.rubrics.length,
          leftSignature: leftSignatures.join(";"),
          rightSignature: rightSignatures.join(";"),
        },
      });
    }
  }

  findings.sort((left, right) => findingSortKey(left).localeCompare(findingSortKey(right)));
  const ruleSetFingerprint = sha256(JSON.stringify(RUBRIC_AUTHORING_RULES));
  const reportPayload = {
    auditId: RUBRIC_AUTHORING_AUDIT_ID,
    auditVersion: RUBRIC_AUTHORING_AUDIT_VERSION,
    datasetId: dataset.id,
    datasetVersion: dataset.version,
    caseCount: dataset.cases.length,
    rubricCount: dataset.cases.reduce(
      (total, tutorCase) => total + tutorCase.evaluatorOnly.rubrics.length,
      0,
    ),
    ruleSetFingerprint,
    findings,
  };
  const summary = summarize(findings);
  return {
    schemaVersion: 1,
    auditId: RUBRIC_AUTHORING_AUDIT_ID,
    auditVersion: RUBRIC_AUTHORING_AUDIT_VERSION,
    datasetId: dataset.id,
    datasetVersion: dataset.version,
    advisoryOnly: true,
    mutatesBenchmarkData: false,
    hardGate: false,
    caseCount: reportPayload.caseCount,
    rubricCount: reportPayload.rubricCount,
    ruleSetFingerprint,
    reportFingerprint: sha256(JSON.stringify(reportPayload)),
    summary,
    findings,
  };
}

function markdownCode(value: string): string {
  return `\`${value.replace(/`/gu, "\\`")}\``;
}

export function renderRubricAuthoringAuditMarkdown(
  report: RubricAuthoringAuditReport,
): string {
  const lines: string[] = [
    "# Canonical TutorEval rubric authoring QA",
    "",
    `Audit: ${markdownCode(`${report.auditId}@${report.auditVersion}`)}`,
    `Dataset: ${markdownCode(`${report.datasetId}@${report.datasetVersion}`)}`,
    `Report fingerprint: ${markdownCode(report.reportFingerprint)}`,
    "",
    "> Advisory review aid only. Findings are not proof that a rubric is defective, non-atomic, mistranslated, double-counted, or miscategorized. This report does not modify benchmark data, scoring, or Judge semantics and is not a CI hard gate.",
    "",
    "## Summary",
    "",
    `- Cases scanned: ${report.caseCount}`,
    `- Rubrics scanned: ${report.rubricCount}`,
    `- Findings: ${report.summary.findingCount}`,
    `- Structural facts: ${report.summary.byEvidenceClass.structural_fact}`,
    `- Semantic review candidates: ${report.summary.byEvidenceClass.semantic_review_candidate}`,
    `- Informational findings: ${report.summary.byEvidenceClass.informational}`,
    "",
    "## Rule inventory",
    "",
  ];
  for (const rule of RUBRIC_AUTHORING_RULES) {
    lines.push(
      `- ${markdownCode(rule.id)} — ${markdownCode(rule.evidenceClass)} — ${rule.description}`,
    );
  }
  lines.push("", "## Findings", "");
  if (report.findings.length === 0) {
    lines.push("No advisory findings were produced.", "");
    return `${lines.join("\n")}\n`;
  }
  for (const priority of ["high", "medium", "low"] as const) {
    const priorityFindings = report.findings.filter((finding) => finding.priority === priority);
    if (priorityFindings.length === 0) continue;
    lines.push(`### ${priority[0]?.toUpperCase()}${priority.slice(1)} priority`, "");
    for (const finding of priorityFindings) {
      lines.push(
        `- **${finding.ruleId}** (${finding.evidenceClass}) — ` +
          `${markdownCode(`${finding.caseId}@${finding.caseVersion}`)} / ` +
          `${finding.rubricIds.length === 0 ? "case structure" : finding.rubricIds.map(markdownCode).join(", ")}`,
        `  - Locale: ${markdownCode(finding.locale)}${finding.crossLocaleGroupId === undefined ? "" : `; group: ${markdownCode(finding.crossLocaleGroupId)}`}`,
        `  - Evidence: ${finding.evidence}`,
      );
      if (finding.metrics !== undefined) {
        lines.push(`  - Metrics: ${markdownCode(JSON.stringify(finding.metrics))}`);
      }
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
