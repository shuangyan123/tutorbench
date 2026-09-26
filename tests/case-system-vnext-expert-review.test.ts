import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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

interface CliResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runCli(args: readonly string[]): Promise<CliResult> {
  const cliPath = resolve(process.cwd(), "dist", "src", "cli", "tutorbench.js");
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (exitCode) => {
      resolveResult({ exitCode, stdout, stderr });
    });
  });
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


test("expert review CLI writes reviewer-ready packages and imports completed counterbalanced submissions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tutorbench-vnext-expert-review-"));
  try {
    const exportResult = await runCli([
      "case-system-vnext-expert-review-export",
      "--reviewer",
      "reviewer-a",
      "--reviewer",
      "reviewer-b",
      "--output-dir",
      directory,
    ]);
    assert.equal(exportResult.exitCode, 0, exportResult.stderr);
    assert.match(exportResult.stdout, /Tasks per reviewer: 17/u);
    assert.match(exportResult.stdout, /Human review data present: false/u);
    assert.deepEqual((await readdir(directory)).sort(), [
      "operator-manifest.json",
      "reviewer-1",
      "reviewer-2",
    ]);

    for (const reviewerDirectory of ["reviewer-1", "reviewer-2"]) {
      assert.deepEqual(
        (await readdir(join(directory, reviewerDirectory))).sort(),
        ["REVIEW_INSTRUCTIONS.md", "packet.json", "submission-template.json"],
      );
    }

    const packetA = JSON.parse(
      await readFile(join(directory, "reviewer-1", "packet.json"), "utf8"),
    ) as {
      readonly schemaVersion: 1;
      readonly protocolId: string;
      readonly protocolVersion: string;
      readonly reviewerId: string;
      readonly taskSetFingerprint: string;
      readonly packetFingerprint: string;
      readonly tasks: readonly { readonly reviewTaskId: string }[];
    };
    const packetB = JSON.parse(
      await readFile(join(directory, "reviewer-2", "packet.json"), "utf8"),
    ) as typeof packetA;
    const templateA = JSON.parse(
      await readFile(join(directory, "reviewer-1", "submission-template.json"), "utf8"),
    ) as { readonly reviews: readonly { readonly outcome: string; readonly sufficientlyClear: string }[] };
    const instructionsA = await readFile(
      join(directory, "reviewer-1", "REVIEW_INSTRUCTIONS.md"),
      "utf8",
    );

    assert.equal(packetA.tasks.length, 17);
    assert.equal(packetB.tasks.length, 17);
    assert.equal(packetA.reviewerId, "reviewer-a");
    assert.equal(packetB.reviewerId, "reviewer-b");
    assert.ok(templateA.reviews.every((review) =>
      review.outcome === "" && review.sufficientlyClear === ""
    ));
    assert.match(instructionsA, /A_BETTER/u);
    assert.match(instructionsA, /INSUFFICIENT_EVIDENCE/u);

    const submissionFor = (
      packet: typeof packetA,
      outcome: "A_BETTER" | "B_BETTER",
    ) => ({
      schemaVersion: packet.schemaVersion,
      protocolId: packet.protocolId,
      protocolVersion: packet.protocolVersion,
      reviewerId: packet.reviewerId,
      taskSetFingerprint: packet.taskSetFingerprint,
      packetFingerprint: packet.packetFingerprint,
      reviews: packet.tasks.map((task) => ({
        reviewTaskId: task.reviewTaskId,
        outcome,
        sufficientlyClear: true,
      })),
    });

    const submissionAPath = join(directory, "reviewer-a.completed.json");
    const submissionBPath = join(directory, "reviewer-b.completed.json");
    await writeFile(
      submissionAPath,
      `${JSON.stringify(submissionFor(packetA, "A_BETTER"), null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      submissionBPath,
      `${JSON.stringify(submissionFor(packetB, "B_BETTER"), null, 2)}\n`,
      "utf8",
    );

    const outputPath = join(directory, "expert-review-evidence.json");
    const importResult = await runCli([
      "case-system-vnext-expert-review-import",
      "--packet-dir",
      directory,
      "--submission",
      submissionAPath,
      "--submission",
      submissionBPath,
      "--output",
      outputPath,
    ]);
    assert.equal(importResult.exitCode, 0, importResult.stderr);
    assert.match(importResult.stdout, /Agreements: 17/u);
    assert.match(importResult.stdout, /No automatic reference-label promotion/u);

    const evidence = JSON.parse(await readFile(outputPath, "utf8")) as {
      readonly agreementCount: number;
      readonly disagreementCount: number;
      readonly packetAmbiguityCount: number;
      readonly reviews: readonly unknown[];
    };
    assert.equal(evidence.agreementCount, 17);
    assert.equal(evidence.disagreementCount, 0);
    assert.equal(evidence.packetAmbiguityCount, 0);
    assert.equal(evidence.reviews.length, 17);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
