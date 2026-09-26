import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildCaseSystemVNextExpertReviewExport,
  mergeCaseSystemVNextExpertReviewSubmissions,
  parseCaseSystemVNextExpertReviewSubmission,
  type CaseSystemVNextExpertReviewSubmission,
} from "../src/case-system-vnext/expert-review.js";
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

test("expert review export counterbalances every task and hides operator expectations", async () => {
  const exported = await buildExport();
  assert.equal(exported.manifest.tasks.length, 17);
  assert.equal(exported.packets[0].tasks.length, 17);
  assert.equal(exported.packets[1].tasks.length, 17);

  for (const task of exported.manifest.tasks) {
    const [first, second] = task.assignments;
    assert.equal(first.aCandidateId, second.bCandidateId);
    assert.equal(first.bCandidateId, second.aCandidateId);
  }

  for (const packet of exported.packets) {
    const serialized = JSON.stringify(packet);
    assert.doesNotMatch(serialized, /"expected"/);
    assert.doesNotMatch(serialized, /"rationale"/);
    assert.doesNotMatch(serialized, /expectedMatch/);
    assert.doesNotMatch(serialized, /deepseek/i);
    const forbiddenIdentityKeys = new Set([
      "provider",
      "providerId",
      "providerModel",
      "model",
      "modelId",
      "modelVersion",
    ]);
    const inspectKeys = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(inspectKeys);
        return;
      }
      if (typeof value !== "object" || value === null) return;
      for (const [key, nested] of Object.entries(value)) {
        assert.equal(
          forbiddenIdentityKeys.has(key),
          false,
          `review packet must not expose provider/model identity field: ${key}`,
        );
        inspectKeys(nested);
      }
    };
    inspectKeys(packet);
    assert.doesNotMatch(serialized, /fixtureId/);
    assert.doesNotMatch(serialized, /contrastUnderTest/);
    assert.equal(
      packet.tasks.some((task) =>
        task.strategyProfile.criteria.some(
          (criterion) => criterion.id === "human-efficiency",
        ),
      ),
      true,
      "reviewer-visible strategy criteria must remain available even when their names overlap stress contrast terminology",
    );
  }
});

test("expert review import normalizes swapped A/B labels to the same candidate", async () => {
  const exported = await buildExport();
  const target = exported.manifest.tasks[0]!;
  const firstAssignment = target.assignments[0];
  const secondAssignment = target.assignments[1];
  assert.equal(firstAssignment.aCandidateId, secondAssignment.bCandidateId);

  const submissions = exported.packets.map((packet, reviewerIndex) => ({
    schemaVersion: packet.schemaVersion,
    protocolId: packet.protocolId,
    protocolVersion: packet.protocolVersion,
    reviewerId: packet.reviewerId,
    taskSetFingerprint: packet.taskSetFingerprint,
    packetFingerprint: packet.packetFingerprint,
    reviews: packet.tasks.map((task) => {
      const assignment = exported.manifest.tasks.find(
        (candidate) => candidate.reviewTaskId === task.reviewTaskId,
      )!.assignments[reviewerIndex]!;
      const preferredCandidateId = exported.manifest.tasks.find(
        (candidate) => candidate.reviewTaskId === task.reviewTaskId,
      )!.assignments[0].aCandidateId;
      return {
        reviewTaskId: task.reviewTaskId,
        outcome: assignment.aCandidateId === preferredCandidateId
          ? "A_BETTER" as const
          : "B_BETTER" as const,
        sufficientlyClear: true,
      };
    }),
  })) as unknown as readonly [
    CaseSystemVNextExpertReviewSubmission,
    CaseSystemVNextExpertReviewSubmission,
  ];

  const parsed = [
    parseCaseSystemVNextExpertReviewSubmission(submissions[0], exported.packets[0]),
    parseCaseSystemVNextExpertReviewSubmission(submissions[1], exported.packets[1]),
  ] as const;
  const evidence = mergeCaseSystemVNextExpertReviewSubmissions(exported, parsed);
  assert.equal(evidence.agreementCount, 17);
  assert.equal(evidence.disagreementCount, 0);
  assert.equal(evidence.packetAmbiguityCount, 0);
  assert.ok(
    evidence.reviews.every((review) => review.agreement === "agreement"),
  );
});

test("expert review import preserves disagreement and packet ambiguity", async () => {
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
      sufficientlyClear: taskIndex !== 1,
      ...(taskIndex === 1 ? { notes: "The task packet needs more context." } : {}),
    })),
  })) as unknown as readonly [
    CaseSystemVNextExpertReviewSubmission,
    CaseSystemVNextExpertReviewSubmission,
  ];

  const evidence = mergeCaseSystemVNextExpertReviewSubmissions(exported, submissions);
  assert.equal(evidence.reviews[0]?.agreement, "disagreement");
  assert.equal(evidence.reviews[1]?.agreement, "packet_ambiguity");
  assert.equal(evidence.disagreementCount, 1);
  assert.equal(evidence.packetAmbiguityCount, 1);
});

test("expert review submission parser rejects extra fields and incomplete task coverage", async () => {
  const exported = await buildExport();
  const packet = exported.packets[0];
  const valid = {
    schemaVersion: packet.schemaVersion,
    protocolId: packet.protocolId,
    protocolVersion: packet.protocolVersion,
    reviewerId: packet.reviewerId,
    taskSetFingerprint: packet.taskSetFingerprint,
    packetFingerprint: packet.packetFingerprint,
    reviews: packet.tasks.map((task) => ({
      reviewTaskId: task.reviewTaskId,
      outcome: "EQUIVALENT" as const,
      sufficientlyClear: true,
    })),
  };
  assert.throws(
    () => parseCaseSystemVNextExpertReviewSubmission(
      { ...valid, expected: "must-not-be-accepted" },
      packet,
    ),
    /expert review data is invalid/,
  );
  assert.throws(
    () => parseCaseSystemVNextExpertReviewSubmission(
      { ...valid, reviews: valid.reviews.slice(1) },
      packet,
    ),
    /expert review data is invalid/,
  );
});
