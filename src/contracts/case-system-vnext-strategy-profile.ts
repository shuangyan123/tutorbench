export const CASE_SYSTEM_VNEXT_STRATEGY_PROFILE_SCHEMA_VERSION = 1 as const;

export type CaseSystemVNextStrategyEvaluationMode =
  | "ordered_preference"
  | "pareto_tradeoff"
  | "acceptable_strategy_set"
  | "no_strategy_ranking";

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
  /** Specific task family, not a broad discipline label. */
  readonly taskFamily: string;
  readonly strategyScope: string;
  readonly evaluationMode: CaseSystemVNextStrategyEvaluationMode;
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
