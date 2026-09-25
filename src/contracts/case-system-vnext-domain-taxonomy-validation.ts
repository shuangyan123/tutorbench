import { BenchmarkConfigurationError } from "./errors.js";
import {
  CASE_SYSTEM_VNEXT_DOMAIN_IDS,
  CASE_SYSTEM_VNEXT_DOMAIN_TAXONOMY_SCHEMA_VERSION,
  type CaseSystemVNextDomainProfile,
  type CaseSystemVNextDomainTaxonomy,
} from "./case-system-vnext-domain-taxonomy.js";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function isText(value: unknown, max = 2_000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function isTextArray(value: unknown, maxItems = 50): value is string[] {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.length <= maxItems &&
    value.every((item) => isText(item, 1_000));
}

function hasOnlyKeys(record: UnknownRecord, allowed: readonly string[]): boolean {
  const set = new Set(allowed);
  return Object.keys(record).every((key) => set.has(key));
}

function isDomain(value: unknown): value is CaseSystemVNextDomainProfile {
  const record = asRecord(value);
  return record !== null &&
    hasOnlyKeys(record, [
      "id",
      "label",
      "evidenceAndReasoningNorms",
      "teachingRiskExamples",
      "status",
    ]) &&
    CASE_SYSTEM_VNEXT_DOMAIN_IDS.includes(record.id as never) &&
    isText(record.label, 200) &&
    isTextArray(record.evidenceAndReasoningNorms, 20) &&
    isTextArray(record.teachingRiskExamples, 20) &&
    record.status === "research_seed";
}

export function parseCaseSystemVNextDomainTaxonomy(
  value: unknown,
): CaseSystemVNextDomainTaxonomy {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "schemaVersion",
      "id",
      "version",
      "source",
      "domains",
    ]) ||
    record.schemaVersion !== CASE_SYSTEM_VNEXT_DOMAIN_TAXONOMY_SCHEMA_VERSION ||
    record.id !== "case-system-vnext-domain-taxonomy" ||
    !isText(record.version, 50) ||
    !Array.isArray(record.domains) ||
    record.domains.length !== CASE_SYSTEM_VNEXT_DOMAIN_IDS.length ||
    !record.domains.every(isDomain)
  ) {
    throw new BenchmarkConfigurationError("case_system_vnext_invalid");
  }

  const source = asRecord(record.source);
  if (
    source === null ||
    !hasOnlyKeys(source, ["audit", "auditDate", "section", "disposition"]) ||
    source.audit !== "TutorBench Evaluation Framework / Pedagogy Taxonomy Research Audit" ||
    source.auditDate !== "2026-09-11" ||
    source.section !== "5.2" ||
    source.disposition !== "design_preference_pending_expert_validation"
  ) {
    throw new BenchmarkConfigurationError("case_system_vnext_invalid");
  }

  const ids = new Set(
    (record.domains as CaseSystemVNextDomainProfile[]).map((domain) => domain.id),
  );
  if (
    ids.size !== CASE_SYSTEM_VNEXT_DOMAIN_IDS.length ||
    CASE_SYSTEM_VNEXT_DOMAIN_IDS.some((id) => !ids.has(id))
  ) {
    throw new BenchmarkConfigurationError("case_system_vnext_invalid");
  }

  return record as unknown as CaseSystemVNextDomainTaxonomy;
}
