import type { CaseSystemVNextDomainId } from "./case-system-vnext-domain-taxonomy.js";

export const CASE_SYSTEM_VNEXT_STRATEGY_PROFILE_SCHEMA_VERSION = 1 as const;

export const CASE_SYSTEM_VNEXT_BASE_EVALUATION_CRITERIA = [
  {
    id: "task-fidelity",
    label: "Task fidelity",
    description:
      "The response addresses the authored learner task and respects explicit task constraints.",
  },
  {
    id: "epistemic-integrity",
    label: "Epistemic integrity",
    description:
      "Claims, calculations, evidence, code behavior, or source use are not knowingly unsupported or fabricated.",
  },
  {
    id: "learner-alignment",
    label: "Learner alignment",
    description:
      "The response respects the authored learner state and prerequisite boundary rather than assuming unavailable knowledge.",
  },
  {
    id: "teaching-target-alignment",
    label: "Teaching-target alignment",
    description:
      "The response supports the authored learning or teaching target instead of optimizing an unrelated objective.",
  },
  {
    id: "valid-alternative-fairness",
    label: "Valid-alternative fairness",
    description:
      "A defensible alternative strategy is not penalized unless the precise subject/task profile supplies a reason to prefer another strategy.",
  },
] as const;

export type CaseSystemVNextStrategyEvaluationMode =
  | "ordered_preference"
  | "pareto_tradeoff"
  | "acceptable_strategy_set"
  | "no_strategy_ranking";

export interface CaseSystemVNextAcademicContext {
  /** Audit-seeded domain from the 23-domain research matrix. */
  readonly domainId: CaseSystemVNextDomainId;
  /** Optional higher-level organization family. Never sufficient by itself for strategy judgment. */
  readonly disciplineFamily?: string;
  /** Concrete subject or curricular area inside the domain when useful. */
  readonly subject?: string;
  /**
   * Narrower domain when relevant: algebra, mechanics, organic_chemistry,
   * genetics, algorithms, python, java, rust, etc.
   */
  readonly specialization?: string;
  /**
   * Cross-cutting practice such as writing, debugging, proof, experimental_design,
   * source_analysis, or code_implementation.
   */
  readonly practice?: string;
}

export interface CaseSystemVNextStrategyCriterion {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface CaseSystemVNextStrategyProfile {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_STRATEGY_PROFILE_SCHEMA_VERSION;
  readonly id: string;
  readonly version: string;
  /** Exact archetype this pilot profile is authored for. */
  readonly archetypeId: string;
  /** Academic placement of this strategy policy. */
  readonly academicContext: CaseSystemVNextAcademicContext;
  /** Specific task family inside the subject/specialization. */
  readonly taskFamily: string;
  readonly strategyScope: string;
  readonly evaluationMode: CaseSystemVNextStrategyEvaluationMode;
  /**
   * Precise criteria layered on top of CASE_SYSTEM_VNEXT_BASE_EVALUATION_CRITERIA.
   * These are not assumed to apply to neighboring subjects or task families.
   */
  readonly criteria: readonly CaseSystemVNextStrategyCriterion[];
  readonly constraints: readonly string[];
  readonly nonGoals: readonly string[];
  readonly status: "pilot";
}

export interface CaseSystemVNextStrategyProfileRegistry {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_STRATEGY_PROFILE_SCHEMA_VERSION;
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly profiles: readonly CaseSystemVNextStrategyProfile[];
}
