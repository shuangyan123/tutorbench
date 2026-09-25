export const CASE_SYSTEM_VNEXT_DOMAIN_TAXONOMY_SCHEMA_VERSION = 1 as const;

export const CASE_SYSTEM_VNEXT_DOMAIN_IDS = [
  "mathematics",
  "statistics",
  "physics",
  "chemistry",
  "biology",
  "earth_environmental_science",
  "computer_science",
  "engineering",
  "medicine_health_sciences",
  "psychology",
  "economics",
  "sociology",
  "political_science_civics",
  "history",
  "law",
  "philosophy",
  "languages_second_language_learning",
  "literature",
  "writing_rhetoric",
  "business_finance_accounting",
  "arts_music_design",
  "vocational_procedural_education",
  "interdisciplinary_emerging_fields",
] as const;

export type CaseSystemVNextDomainId =
  (typeof CASE_SYSTEM_VNEXT_DOMAIN_IDS)[number];

export interface CaseSystemVNextDomainProfile {
  readonly id: CaseSystemVNextDomainId;
  readonly label: string;
  readonly evidenceAndReasoningNorms: readonly string[];
  readonly teachingRiskExamples: readonly string[];
  /** Research-seeded design profile; not a validated measurement scale. */
  readonly status: "research_seed";
}

export interface CaseSystemVNextDomainTaxonomy {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_DOMAIN_TAXONOMY_SCHEMA_VERSION;
  readonly id: "case-system-vnext-domain-taxonomy";
  readonly version: string;
  readonly source: {
    readonly audit: "TutorBench Evaluation Framework / Pedagogy Taxonomy Research Audit";
    readonly auditDate: "2026-09-11";
    readonly section: "5.2";
    readonly disposition: "design_preference_pending_expert_validation";
  };
  readonly domains: readonly CaseSystemVNextDomainProfile[];
}
