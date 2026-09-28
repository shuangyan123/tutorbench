import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildCaseSystemVNextExpertReviewExport,
  mergeCaseSystemVNextExpertReviewSubmissions,
  type CaseSystemVNextExpertReviewSubmission,
} from "../src/case-system-vnext/expert-review.js";
import {
  buildCaseSystemVNextExpertReviewAdjudicationExport,
  buildCaseSystemVNextExpertReviewResolution,
  parseCaseSystemVNextExpertReviewAdjudicationSubmission,
  type CaseSystemVNextExpertReviewAdjudicationExport,
} from "../src/case-system-vnext/expert-review-adjudication.js";
import {
  canonicalCaseSystemVNextExpertReviewJson,
  sameCaseSystemVNextExpertReviewJson,
} from "../src/case-system-vnext/expert-review-canonical.js";
import {
  parseCaseSystemVNextPilot,
  parseCaseSystemVNextStrategyProfileRegistry,
  type CaseSystemVNextStressFixtureSuite,
} from "../src/contracts/index.js";

async function loadJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(process.cwd(), path), "utf8")) as unknown;
}

async function buildExport() {
  const pilot = parseCaseSystemVNextPilot(
    await loadJson("scenarios/case-system-vnext/pilot-archetypes.json"),
  );
  const registry = parseCaseSystemVNextStrategyProfileRegistry(
    await loadJson("scenarios/case-system-vnext/task-strategy-profiles.json"),
  );
  const suite = await loadJson(
    "scenarios/case-system-vnext/evaluator-stress-fixtures.json",
  ) as CaseSystemVNextStressFixtureSuite;
  return buildCaseSystemVNextExpertReviewExport(
    pilot,
    suite,
    registry,
    ["reviewer-a", "reviewer-b"],
  );
}

function reverseObjectKeyOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeyOrder);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, item]) => [key, reverseObjectKeyOrder(item)]),
  );
}

test("expert review canonical JSON ignores object key order but preserves array order", () => {
  const left = {
    alpha: 1,
    nested: { first: true, second: "two" },
    list: [{ x: 1, y: 2 }, "tail"],
  };
  const reordered = {
    list: [{ y: 2, x: 1 }, "tail"],
    nested: { second: "two", first: true },
    alpha: 1,
  };
  assert.equal(
    canonicalCaseSystemVNextExpertReviewJson(left),
    canonicalCaseSystemVNextExpertReviewJson(reordered),
  );
  assert.equal(sameCaseSystemVNextExpertReviewJson(left, reordered), true);
  assert.equal(
    sameCaseSystemVNextExpertReviewJson(left, {
      ...reordered,
      list: ["tail", { y: 2, x: 1 }],
    }),
    false,
  );
});

test("expert review resolution replay accepts key-reordered adjudication artifacts", async () => {
  const exported = await buildExport();
  const submissions = exported.packets.map((packet, reviewerIndex) => ({
    schemaVersion: packet.schemaVersion,
    protocolId: packet.protocolId,
    protocolVersion: packet.protocolVersion,
    reviewerId: packet.reviewerId,
    taskSetFingerprint: packet.taskSetFingerprint,
    packetFingerprint: packet.packetFingerprint,
    reviews: packet.tasks.map((task, taskIndex) => ({
      reviewTaskId: task.reviewTaskId,
      outcome: taskIndex === 0
        ? (reviewerIndex === 0 ? "A_BETTER" as const : "A_BETTER" as const)
        : "EQUIVALENT" as const,
      sufficientlyClear: true,
    })),
  })) as unknown as readonly [
    CaseSystemVNextExpertReviewSubmission,
    CaseSystemVNextExpertReviewSubmission,
  ];
  const evidence = mergeCaseSystemVNextExpertReviewSubmissions(exported, submissions);
  const adjudication = buildCaseSystemVNextExpertReviewAdjudicationExport(
    exported,
    evidence,
    "adjudicator-c",
  );
  const submission = parseCaseSystemVNextExpertReviewAdjudicationSubmission(
    {
      schemaVersion: adjudication.packet.schemaVersion,
      protocolId: adjudication.packet.protocolId,
      protocolVersion: adjudication.packet.protocolVersion,
      adjudicatorId: adjudication.packet.adjudicatorId,
      taskSetFingerprint: adjudication.packet.taskSetFingerprint,
      sourceEvidenceFingerprint: adjudication.packet.sourceEvidenceFingerprint,
      adjudicationSetFingerprint: adjudication.packet.adjudicationSetFingerprint,
      packetFingerprint: adjudication.packet.packetFingerprint,
      adjudications: adjudication.packet.tasks.map((task) => ({
        reviewTaskId: task.reviewTaskId,
        outcome: "A_BETTER",
        sufficientlyClear: true,
      })),
    },
    adjudication.packet,
  );

  const reordered = {
    manifest: reverseObjectKeyOrder(adjudication.manifest),
    packet: reverseObjectKeyOrder(adjudication.packet),
    template: adjudication.template,
  } as unknown as CaseSystemVNextExpertReviewAdjudicationExport;

  const resolution = buildCaseSystemVNextExpertReviewResolution(
    exported,
    evidence,
    reordered,
    submission,
  );
  assert.equal(resolution.summary.adjudicatedCount, 1);
  assert.equal(resolution.summary.unresolvedCount, 0);

  const changed = {
    ...adjudication,
    manifest: {
      ...adjudication.manifest,
      adjudicationSetFingerprint: "sha256:" + "0".repeat(64),
    },
  };
  assert.throws(
    () => buildCaseSystemVNextExpertReviewResolution(
      exported,
      evidence,
      changed,
      submission,
    ),
    /adjudication data is invalid/u,
  );
});
