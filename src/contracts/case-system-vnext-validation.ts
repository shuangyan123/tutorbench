import { BenchmarkConfigurationError } from "./errors.js";
import {
  CASE_SYSTEM_VNEXT_CONTENT_DEPTHS,
  CASE_SYSTEM_VNEXT_INTERACTION_HORIZONS,
  CASE_SYSTEM_VNEXT_LEARNER_STATES,
  CASE_SYSTEM_VNEXT_PEDAGOGICAL_DIFFICULTIES,
  CASE_SYSTEM_VNEXT_SCHEMA_VERSION,
  type CaseSystemVNextArchetype,
  type CaseSystemVNextPilot,
  type CaseSystemVNextReasoningStrategy,
} from "./case-system-vnext.js";
import { CASE_SYSTEM_VNEXT_DOMAIN_IDS } from "./case-system-vnext-domain-taxonomy.js";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function hasOnlyKeys(record: UnknownRecord, allowed: readonly string[]): boolean {
  const keys = new Set(allowed);
  return Object.keys(record).every((key) => keys.has(key));
}

function isText(value: unknown, max = 2_000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function isTextArray(value: unknown, maxItems = 50): value is string[] {
  return Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => isText(item, 500));
}

function isReasoningStrategy(value: unknown): value is CaseSystemVNextReasoningStrategy {
  const record = asRecord(value);
  return record !== null &&
    hasOnlyKeys(record, ["id", "label", "keyInsight", "effectiveReasoningSteps", "applicability"]) &&
    isText(record.id, 120) &&
    /^[a-z][a-z0-9-]*$/.test(record.id) &&
    isText(record.label, 200) &&
    isText(record.keyInsight, 1_000) &&
    isText(record.applicability, 1_000) &&
    (record.effectiveReasoningSteps === undefined ||
      (typeof record.effectiveReasoningSteps === "number" &&
        Number.isInteger(record.effectiveReasoningSteps) &&
        record.effectiveReasoningSteps >= 1 &&
        record.effectiveReasoningSteps <= 50));
}

function isReferenceReasoning(value: unknown): boolean {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "optimalityMode",
      "humanOptimalInstanceStrategies",
      "humanOptimalGeneralStrategies",
      "alternativeHumanValidStrategies",
      "avoidableDetours",
      "machineSearchCost",
    ]) ||
    !["human_optimal", "bounded_strategy_set", "not_applicable"].includes(String(record.optimalityMode)) ||
    record.machineSearchCost !== "out_of_scope"
  ) return false;

  for (const key of [
    "humanOptimalInstanceStrategies",
    "humanOptimalGeneralStrategies",
    "alternativeHumanValidStrategies",
  ] as const) {
    if (!Array.isArray(record[key]) || record[key].length > 20 ||
      !record[key].every(isReasoningStrategy)) return false;
  }
  if (!isTextArray(record.avoidableDetours, 20)) return false;

  if (
    record.optimalityMode === "human_optimal" &&
    ((record.humanOptimalInstanceStrategies as unknown[]).length === 0 ||
      (record.humanOptimalGeneralStrategies as unknown[]).length === 0)
  ) return false;

  if (
    record.optimalityMode === "not_applicable" &&
    (((record.humanOptimalInstanceStrategies as unknown[]).length > 0) ||
      ((record.humanOptimalGeneralStrategies as unknown[]).length > 0))
  ) return false;

  return true;
}

function isArchetype(value: unknown): value is CaseSystemVNextArchetype {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, [
      "schemaVersion",
      "id",
      "version",
      "title",
      "domainId",
      "subdomain",
      "practice",
      "topic",
      "learnerLevel",
      "contentDepth",
      "pedagogicalDifficulty",
      "interactionHorizon",
      "coreTask",
      "learnerStates",
      "prerequisiteBoundary",
      "referenceReasoning",
      "transfer",
      "authoringStatus",
    ]) ||
    record.schemaVersion !== CASE_SYSTEM_VNEXT_SCHEMA_VERSION ||
    !isText(record.id, 120) ||
    !/^[a-z][a-z0-9-]*$/.test(record.id) ||
    !isText(record.version, 50) ||
    !isText(record.title, 200) ||
    !CASE_SYSTEM_VNEXT_DOMAIN_IDS.includes(record.domainId as never) ||
    !isText(record.subdomain, 200) ||
    !isText(record.practice, 200) ||
    !isText(record.topic, 200) ||
    !isText(record.learnerLevel, 100) ||
    !CASE_SYSTEM_VNEXT_CONTENT_DEPTHS.includes(record.contentDepth as never) ||
    !CASE_SYSTEM_VNEXT_PEDAGOGICAL_DIFFICULTIES.includes(record.pedagogicalDifficulty as never) ||
    !CASE_SYSTEM_VNEXT_INTERACTION_HORIZONS.includes(record.interactionHorizon as never) ||
    !isText(record.coreTask, 2_000) ||
    !Array.isArray(record.learnerStates) ||
    record.learnerStates.length === 0 ||
    record.learnerStates.length > 10 ||
    !record.learnerStates.every((state) => CASE_SYSTEM_VNEXT_LEARNER_STATES.includes(state as never)) ||
    new Set(record.learnerStates).size !== record.learnerStates.length ||
    !isReferenceReasoning(record.referenceReasoning) ||
    record.authoringStatus !== "pilot"
  ) return false;

  const prerequisites = asRecord(record.prerequisiteBoundary);
  if (
    prerequisites === null ||
    !hasOnlyKeys(prerequisites, ["knownConcepts", "allowedMethods", "excludedMethods"]) ||
    !isTextArray(prerequisites.knownConcepts) ||
    !isTextArray(prerequisites.allowedMethods) ||
    !isTextArray(prerequisites.excludedMethods)
  ) return false;

  const transfer = asRecord(record.transfer);
  return transfer !== null &&
    hasOnlyKeys(transfer, ["nearTransfer", "farTransfer"]) &&
    isText(transfer.nearTransfer, 1_000) &&
    (transfer.farTransfer === undefined || isText(transfer.farTransfer, 1_000));
}

export function parseCaseSystemVNextPilot(value: unknown): CaseSystemVNextPilot {
  const record = asRecord(value);
  if (
    record === null ||
    !hasOnlyKeys(record, ["schemaVersion", "id", "version", "title", "description", "archetypes"]) ||
    record.schemaVersion !== CASE_SYSTEM_VNEXT_SCHEMA_VERSION ||
    !isText(record.id, 120) ||
    !isText(record.version, 50) ||
    !isText(record.title, 200) ||
    !isText(record.description, 2_000) ||
    !Array.isArray(record.archetypes) ||
    record.archetypes.length !== 15 ||
    !record.archetypes.every(isArchetype)
  ) {
    throw new BenchmarkConfigurationError("case_system_vnext_invalid");
  }

  const ids = new Set<string>();
  const cells = new Set<string>();
  const domains = new Set<string>();
  const depths = new Set<number>();
  for (const archetype of record.archetypes as CaseSystemVNextArchetype[]) {
    if (ids.has(archetype.id)) {
      throw new BenchmarkConfigurationError("case_system_vnext_invalid");
    }
    ids.add(archetype.id);
    domains.add(archetype.domainId);
    depths.add(archetype.contentDepth);
    const cell =
      `${archetype.domainId}:${archetype.subdomain}:${archetype.practice}:D${archetype.contentDepth}`;
    if (cells.has(cell)) {
      throw new BenchmarkConfigurationError("case_system_vnext_invalid");
    }
    cells.add(cell);
  }

  if (domains.size < 7 || ![1, 3, 5].every((depth) => depths.has(depth))) {
    throw new BenchmarkConfigurationError("case_system_vnext_invalid");
  }

  return record as unknown as CaseSystemVNextPilot;
}
