import { BenchmarkConfigurationError } from "./errors.js";
import {
  CASE_SYSTEM_VNEXT_STRATEGY_PROFILE_SCHEMA_VERSION,
  type CaseSystemVNextStrategyProfile,
  type CaseSystemVNextStrategyProfileRegistry,
} from "./case-system-vnext-strategy-profile.js";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function isText(value: unknown, max = 2_000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function hasOnlyKeys(record: UnknownRecord, allowed: readonly string[]): boolean {
  const set = new Set(allowed);
  return Object.keys(record).every((key) => set.has(key));
}

function isTextArray(value: unknown, maxItems = 50): value is string[] {
  return Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => isText(item, 1_000));
}

function isProfile(value: unknown): value is CaseSystemVNextStrategyProfile {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "schemaVersion","id","version","archetypeId","taskFamily","strategyScope",
      "evaluationMode","criteria","constraints","nonGoals","status",
    ]) ||
    record.schemaVersion !== CASE_SYSTEM_VNEXT_STRATEGY_PROFILE_SCHEMA_VERSION ||
    !isText(record.id, 120) ||
    !/^[a-z][a-z0-9-]*$/.test(record.id) ||
    !isText(record.version, 50) ||
    !isText(record.archetypeId, 120) ||
    !isText(record.taskFamily, 160) ||
    !isText(record.strategyScope, 2_000) ||
    !["ordered_preference","pareto_tradeoff","acceptable_strategy_set","no_strategy_ranking"].includes(String(record.evaluationMode)) ||
    !Array.isArray(record.criteria) ||
    record.criteria.length === 0 ||
    record.criteria.length > 20 ||
    !isTextArray(record.constraints, 30) ||
    !isTextArray(record.nonGoals, 30) ||
    record.status !== "pilot"
  ) return false;

  const ids = new Set<string>();
  for (const criterion of record.criteria) {
    const item = asRecord(criterion);
    if (
      item === null ||
      !hasOnlyKeys(item, ["id","label","description"]) ||
      !isText(item.id, 120) ||
      !/^[a-z][a-z0-9-]*$/.test(item.id) ||
      ids.has(item.id) ||
      !isText(item.label, 200) ||
      !isText(item.description, 1_000)
    ) return false;
    ids.add(item.id);
  }
  return true;
}

export function parseCaseSystemVNextStrategyProfileRegistry(
  value: unknown,
): CaseSystemVNextStrategyProfileRegistry {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, ["schemaVersion","id","version","title","description","profiles"]) ||
    record.schemaVersion !== CASE_SYSTEM_VNEXT_STRATEGY_PROFILE_SCHEMA_VERSION ||
    !isText(record.id, 120) ||
    !isText(record.version, 50) ||
    !isText(record.title, 200) ||
    !isText(record.description, 2_000) ||
    !Array.isArray(record.profiles) ||
    record.profiles.length === 0 ||
    !record.profiles.every(isProfile)
  ) {
    throw new BenchmarkConfigurationError("case_system_vnext_invalid");
  }

  const profileIds = new Set<string>();
  const archetypeIds = new Set<string>();
  for (const profile of record.profiles as CaseSystemVNextStrategyProfile[]) {
    if (profileIds.has(profile.id) || archetypeIds.has(profile.archetypeId)) {
      throw new BenchmarkConfigurationError("case_system_vnext_invalid");
    }
    profileIds.add(profile.id);
    archetypeIds.add(profile.archetypeId);
  }
  return record as unknown as CaseSystemVNextStrategyProfileRegistry;
}
