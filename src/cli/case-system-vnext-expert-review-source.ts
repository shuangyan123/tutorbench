import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  CASE_SYSTEM_VNEXT_DOMAIN_IDS,
  parseCaseSystemVNextPilot,
  parseCaseSystemVNextStrategyProfileRegistry,
  type CaseSystemVNextDomainId,
  type CaseSystemVNextStressFixtureSuite,
} from "../contracts/index.js";
import {
  buildCaseSystemVNextExpertReviewExport,
  type CaseSystemVNextExpertReviewExport,
} from "../case-system-vnext/index.js";
import { TutorbenchCliUsageError } from "./tutorbench-common.js";

function invalid(): never {
  throw new Error("Case System vNext expert review source export is invalid.");
}

async function loadJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(process.cwd(), path), "utf8")) as unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function packetIdentity(value: unknown): {
  readonly reviewerId: string;
  readonly domainIds: readonly CaseSystemVNextDomainId[];
} {
  const record = asRecord(value);
  if (
    record === null ||
    typeof record.reviewerId !== "string" ||
    !Array.isArray(record.tasks) ||
    record.tasks.length === 0
  ) invalid();

  const domains = new Set<CaseSystemVNextDomainId>();
  for (const taskValue of record.tasks) {
    const task = asRecord(taskValue);
    if (
      task === null ||
      typeof task.domainId !== "string" ||
      !CASE_SYSTEM_VNEXT_DOMAIN_IDS.includes(
        task.domainId as CaseSystemVNextDomainId,
      )
    ) invalid();
    domains.add(task.domainId as CaseSystemVNextDomainId);
  }

  return {
    reviewerId: record.reviewerId,
    domainIds: CASE_SYSTEM_VNEXT_DOMAIN_IDS.filter((domainId) =>
      domains.has(domainId)
    ),
  };
}

export async function loadCaseSystemVNextExpertReviewInputs() {
  const pilot = parseCaseSystemVNextPilot(
    await loadJson("scenarios/case-system-vnext/pilot-archetypes.json"),
  );
  const registry = parseCaseSystemVNextStrategyProfileRegistry(
    await loadJson("scenarios/case-system-vnext/task-strategy-profiles.json"),
  );
  const suite = await loadJson(
    "scenarios/case-system-vnext/evaluator-stress-fixtures.json",
  ) as CaseSystemVNextStressFixtureSuite;
  return { pilot, registry, suite };
}

export function selectCaseSystemVNextExpertReviewSuite(
  pilot: ReturnType<typeof parseCaseSystemVNextPilot>,
  suite: CaseSystemVNextStressFixtureSuite,
  domainIds: readonly CaseSystemVNextDomainId[],
): CaseSystemVNextStressFixtureSuite {
  if (domainIds.length === 0) return suite;
  const selectedDomains = new Set(domainIds);
  const archetypeDomain = new Map(
    pilot.archetypes.map((archetype) => [archetype.id, archetype.domainId]),
  );
  const fixtures = suite.fixtures.filter((fixture) => {
    const domainId = archetypeDomain.get(fixture.archetypeId);
    return domainId !== undefined && selectedDomains.has(domainId);
  });
  if (fixtures.length === 0) {
    throw new TutorbenchCliUsageError(
      `No evaluator-stress fixtures match --domain ${domainIds.join(", ")}.`,
    );
  }
  return { ...suite, fixtures };
}

export async function loadCaseSystemVNextExpertReviewSourceExport(
  packetDirectory: string,
): Promise<CaseSystemVNextExpertReviewExport> {
  const [manifestValue, firstPacketValue, secondPacketValue] = await Promise.all([
    loadJson(resolve(packetDirectory, "operator-manifest.json")),
    loadJson(resolve(packetDirectory, "reviewer-1", "packet.json")),
    loadJson(resolve(packetDirectory, "reviewer-2", "packet.json")),
  ]);

  const firstIdentity = packetIdentity(firstPacketValue);
  const secondIdentity = packetIdentity(secondPacketValue);
  if (
    firstIdentity.reviewerId === secondIdentity.reviewerId ||
    !isDeepStrictEqual(firstIdentity.domainIds, secondIdentity.domainIds)
  ) invalid();

  const { pilot, registry, suite } =
    await loadCaseSystemVNextExpertReviewInputs();
  const selectedSuite = selectCaseSystemVNextExpertReviewSuite(
    pilot,
    suite,
    firstIdentity.domainIds,
  );
  const expected = buildCaseSystemVNextExpertReviewExport(
    pilot,
    selectedSuite,
    registry,
    [firstIdentity.reviewerId, secondIdentity.reviewerId],
  );

  if (
    !isDeepStrictEqual(manifestValue, expected.manifest) ||
    !isDeepStrictEqual(firstPacketValue, expected.packets[0]) ||
    !isDeepStrictEqual(secondPacketValue, expected.packets[1])
  ) invalid();

  return expected;
}
