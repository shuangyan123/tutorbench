import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  buildCaseSystemVNextExpertReviewAdjudicationExport,
  buildCaseSystemVNextExpertReviewConsensusResolution,
} from "../src/case-system-vnext/expert-review-adjudication.js";
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

test("reference candidate CLI replays source lineage and rejects mismatched adjudication material", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tutorbench-vnext-reference-lineage-"));
  try {
    const exportResult = await runCli([
      "case-system-vnext-expert-review-export",
      "--reviewer",
      "reviewer-a",
      "--reviewer",
      "reviewer-b",
      "--domain",
      "mathematics",
      "--output-dir",
      directory,
    ]);
    assert.equal(exportResult.exitCode, 0, exportResult.stderr);

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

    const submissionFor = (
      packet: typeof packetA,
      reviewerIndex: 0 | 1,
    ) => ({
      schemaVersion: packet.schemaVersion,
      protocolId: packet.protocolId,
      protocolVersion: packet.protocolVersion,
      reviewerId: packet.reviewerId,
      taskSetFingerprint: packet.taskSetFingerprint,
      packetFingerprint: packet.packetFingerprint,
      reviews: packet.tasks.map((task, taskIndex) => ({
        reviewTaskId: task.reviewTaskId,
        outcome: taskIndex === 0
          ? (reviewerIndex === 0 ? "A_BETTER" : "A_BETTER")
          : "EQUIVALENT",
        sufficientlyClear: true,
      })),
    });

    const submissionAPath = join(directory, "reviewer-a.completed.json");
    const submissionBPath = join(directory, "reviewer-b.completed.json");
    await writeFile(
      submissionAPath,
      JSON.stringify(submissionFor(packetA, 0), null, 2),
      "utf8",
    );
    await writeFile(
      submissionBPath,
      JSON.stringify(submissionFor(packetB, 1), null, 2),
      "utf8",
    );

    const evidencePath = join(directory, "expert-review-evidence.json");
    const importResult = await runCli([
      "case-system-vnext-expert-review-import",
      "--packet-dir",
      directory,
      "--submission",
      submissionAPath,
      "--submission",
      submissionBPath,
      "--output",
      evidencePath,
    ]);
    assert.equal(importResult.exitCode, 0, importResult.stderr);

    const adjudicationDirectory = join(directory, "adjudication");
    const adjudicationExportResult = await runCli([
      "case-system-vnext-expert-review-adjudication-export",
      "--packet-dir",
      directory,
      "--evidence",
      evidencePath,
      "--adjudicator",
      "adjudicator-c",
      "--output-dir",
      adjudicationDirectory,
    ]);
    assert.equal(adjudicationExportResult.exitCode, 0, adjudicationExportResult.stderr);

    const adjudicationPacket = JSON.parse(
      await readFile(join(adjudicationDirectory, "packet.json"), "utf8"),
    ) as {
      readonly schemaVersion: 1;
      readonly protocolId: string;
      readonly protocolVersion: string;
      readonly adjudicatorId: string;
      readonly taskSetFingerprint: string;
      readonly sourceEvidenceFingerprint: string;
      readonly adjudicationSetFingerprint: string;
      readonly packetFingerprint: string;
      readonly tasks: readonly { readonly reviewTaskId: string }[];
    };
    const adjudicationSubmissionPath = join(
      directory,
      "adjudicator-c.completed.json",
    );
    await writeFile(
      adjudicationSubmissionPath,
      JSON.stringify({
        schemaVersion: adjudicationPacket.schemaVersion,
        protocolId: adjudicationPacket.protocolId,
        protocolVersion: adjudicationPacket.protocolVersion,
        adjudicatorId: adjudicationPacket.adjudicatorId,
        taskSetFingerprint: adjudicationPacket.taskSetFingerprint,
        sourceEvidenceFingerprint: adjudicationPacket.sourceEvidenceFingerprint,
        adjudicationSetFingerprint: adjudicationPacket.adjudicationSetFingerprint,
        packetFingerprint: adjudicationPacket.packetFingerprint,
        adjudications: adjudicationPacket.tasks.map((task) => ({
          reviewTaskId: task.reviewTaskId,
          outcome: "A_BETTER",
          sufficientlyClear: true,
        })),
      }, null, 2),
      "utf8",
    );

    const candidatePath = join(directory, "reference-candidate.json");
    const candidateResult = await runCli([
      "case-system-vnext-expert-review-reference-candidate",
      "--packet-dir",
      directory,
      "--evidence",
      evidencePath,
      "--adjudication-dir",
      adjudicationDirectory,
      "--submission",
      adjudicationSubmissionPath,
      "--output",
      candidatePath,
    ]);
    assert.equal(candidateResult.exitCode, 0, candidateResult.stderr);
    assert.match(candidateResult.stdout, /Source lineage replayed: true/u);

    const tamperedManifestPath = join(adjudicationDirectory, "operator-manifest.json");
    const tamperedManifest = JSON.parse(
      await readFile(tamperedManifestPath, "utf8"),
    ) as {
      adjudicationSetFingerprint: string;
      [key: string]: unknown;
    };
    tamperedManifest.adjudicationSetFingerprint = "sha256:" + "0".repeat(64);
    await writeFile(
      tamperedManifestPath,
      JSON.stringify(tamperedManifest, null, 2),
      "utf8",
    );

    const rejected = await runCli([
      "case-system-vnext-expert-review-reference-candidate",
      "--packet-dir",
      directory,
      "--evidence",
      evidencePath,
      "--adjudication-dir",
      adjudicationDirectory,
      "--submission",
      adjudicationSubmissionPath,
      "--output",
      candidatePath,
    ]);
    assert.equal(rejected.exitCode, 1);
    assert.equal(rejected.stderr, "Tutor Benchmark CLI failed.\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("expert review source loader rejects manifest and packet tampering before import or replay", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tutorbench-vnext-source-validation-"));
  try {
    const exportResult = await runCli([
      "case-system-vnext-expert-review-export",
      "--reviewer",
      "reviewer-a",
      "--reviewer",
      "reviewer-b",
      "--domain",
      "mathematics",
      "--output-dir",
      directory,
    ]);
    assert.equal(exportResult.exitCode, 0, exportResult.stderr);

    const manifestPath = join(directory, "operator-manifest.json");
    const packetAPath = join(directory, "reviewer-1", "packet.json");
    const packetBPath = join(directory, "reviewer-2", "packet.json");
    const manifestText = await readFile(manifestPath, "utf8");
    const packetAText = await readFile(packetAPath, "utf8");
    const packetBText = await readFile(packetBPath, "utf8");
    const packetA = JSON.parse(packetAText) as {
      readonly schemaVersion: 1;
      readonly protocolId: string;
      readonly protocolVersion: string;
      readonly reviewerId: string;
      readonly taskSetFingerprint: string;
      readonly packetFingerprint: string;
      readonly tasks: readonly {
        readonly reviewTaskId: string;
        readonly candidates: readonly [
          { readonly label: "A"; readonly responseText: string },
          { readonly label: "B"; readonly responseText: string },
        ];
      }[];
    };
    const packetB = JSON.parse(packetBText) as typeof packetA;

    const submissionFor = (packet: typeof packetA) => ({
      schemaVersion: packet.schemaVersion,
      protocolId: packet.protocolId,
      protocolVersion: packet.protocolVersion,
      reviewerId: packet.reviewerId,
      taskSetFingerprint: packet.taskSetFingerprint,
      packetFingerprint: packet.packetFingerprint,
      reviews: packet.tasks.map((task) => ({
        reviewTaskId: task.reviewTaskId,
        outcome: "EQUIVALENT",
        sufficientlyClear: true,
      })),
    });
    const submissionAPath = join(directory, "reviewer-a.completed.json");
    const submissionBPath = join(directory, "reviewer-b.completed.json");
    await writeFile(
      submissionAPath,
      JSON.stringify(submissionFor(packetA), null, 2),
      "utf8",
    );
    await writeFile(
      submissionBPath,
      JSON.stringify(submissionFor(packetB), null, 2),
      "utf8",
    );

    const importArgs = [
      "case-system-vnext-expert-review-import",
      "--packet-dir",
      directory,
      "--submission",
      submissionAPath,
      "--submission",
      submissionBPath,
    ] as const;

    const manifestDeleted = JSON.parse(manifestText) as {
      tasks: unknown[];
      [key: string]: unknown;
    };
    manifestDeleted.tasks = manifestDeleted.tasks.slice(1);
    await writeFile(manifestPath, JSON.stringify(manifestDeleted, null, 2), "utf8");
    let rejected = await runCli(importArgs);
    assert.equal(rejected.exitCode, 1);
    assert.equal(rejected.stderr, "Tutor Benchmark CLI failed.\n");

    await writeFile(manifestPath, manifestText, "utf8");
    const manifestSwapped = JSON.parse(manifestText) as {
      tasks: {
        assignments: [
          { aCandidateId: string; bCandidateId: string },
          { aCandidateId: string; bCandidateId: string },
        ];
      }[];
      [key: string]: unknown;
    };
    const firstAssignment = manifestSwapped.tasks[0]!.assignments[0];
    [
      firstAssignment.aCandidateId,
      firstAssignment.bCandidateId,
    ] = [
      firstAssignment.bCandidateId,
      firstAssignment.aCandidateId,
    ];
    await writeFile(manifestPath, JSON.stringify(manifestSwapped, null, 2), "utf8");
    rejected = await runCli(importArgs);
    assert.equal(rejected.exitCode, 1);
    assert.equal(rejected.stderr, "Tutor Benchmark CLI failed.\n");

    await writeFile(manifestPath, manifestText, "utf8");
    const packetTampered = JSON.parse(packetAText) as {
      tasks: { candidates: [{ responseText: string }, { responseText: string }] }[];
      [key: string]: unknown;
    };
    packetTampered.tasks[0]!.candidates[0].responseText += " tampered";
    await writeFile(packetAPath, JSON.stringify(packetTampered, null, 2), "utf8");
    rejected = await runCli(importArgs);
    assert.equal(rejected.exitCode, 1);
    assert.equal(rejected.stderr, "Tutor Benchmark CLI failed.\n");

    await writeFile(packetAPath, packetAText, "utf8");
    await writeFile(packetBPath, packetBText, "utf8");
    const imported = await runCli(importArgs);
    assert.equal(imported.exitCode, 0, imported.stderr);

    const evidencePath = join(directory, "expert-review-evidence.json");
    const evidenceText = await readFile(evidencePath, "utf8");
    const wrongProtocol = JSON.parse(evidenceText) as {
      protocolId: string;
      [key: string]: unknown;
    };
    wrongProtocol.protocolId = "wrong-protocol";
    await writeFile(evidencePath, JSON.stringify(wrongProtocol, null, 2), "utf8");
    rejected = await runCli([
      "case-system-vnext-expert-review-adjudication-export",
      "--packet-dir",
      directory,
      "--evidence",
      evidencePath,
      "--adjudicator",
      "adjudicator-c",
    ]);
    assert.equal(rejected.exitCode, 1);
    assert.equal(rejected.stderr, "Tutor Benchmark CLI failed.\n");

    await writeFile(evidencePath, evidenceText, "utf8");
    const manifestReplayTampered = JSON.parse(manifestText) as {
      tasks: unknown[];
      [key: string]: unknown;
    };
    manifestReplayTampered.tasks = manifestReplayTampered.tasks.slice(1);
    await writeFile(
      manifestPath,
      JSON.stringify(manifestReplayTampered, null, 2),
      "utf8",
    );
    rejected = await runCli([
      "case-system-vnext-expert-review-reference-candidate",
      "--packet-dir",
      directory,
      "--evidence",
      evidencePath,
    ]);
    assert.equal(rejected.exitCode, 1);
    assert.equal(rejected.stderr, "Tutor Benchmark CLI failed.\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("direct expert-review APIs reject truncated manifests and stale packet content", async () => {
  const exported = await buildExport();

  const submissionFor = (
    packet: typeof exported.packets[number],
  ): CaseSystemVNextExpertReviewSubmission => ({
    schemaVersion: packet.schemaVersion,
    protocolId: packet.protocolId,
    protocolVersion: packet.protocolVersion,
    reviewerId: packet.reviewerId,
    taskSetFingerprint: packet.taskSetFingerprint,
    packetFingerprint: packet.packetFingerprint,
    reviews: packet.tasks.map((task) => ({
      reviewTaskId: task.reviewTaskId,
      outcome: "EQUIVALENT",
      sufficientlyClear: true,
    })),
  });

  const submissions = [
    submissionFor(exported.packets[0]),
    submissionFor(exported.packets[1]),
  ] as const;
  const evidence = mergeCaseSystemVNextExpertReviewSubmissions(
    exported,
    submissions,
  );

  const truncated = structuredClone(exported) as typeof exported;
  (truncated.manifest.tasks as unknown as Array<unknown>).splice(0, 1);
  assert.throws(
    () => mergeCaseSystemVNextExpertReviewSubmissions(truncated, submissions),
    /expert review data is invalid/u,
  );

  const stalePacket = structuredClone(exported) as typeof exported;
  const firstTask = stalePacket.packets[0].tasks[0];
  assert.ok(firstTask);
  const firstCandidate = firstTask.candidates[0] as {
    label: "A" | "B";
    responseText: string;
  };
  firstCandidate.responseText += " tampered";
  assert.throws(
    () => mergeCaseSystemVNextExpertReviewSubmissions(stalePacket, submissions),
    /expert review data is invalid/u,
  );
  assert.throws(
    () => buildCaseSystemVNextExpertReviewConsensusResolution(stalePacket, evidence),
    /expert review data is invalid/u,
  );
});

test("expert review task-set fingerprint covers reviewer-visible judgment context", async () => {
  const pilot = parseCaseSystemVNextPilot(
    await loadJson("scenarios/case-system-vnext/pilot-archetypes.json"),
  );
  const registry = parseCaseSystemVNextStrategyProfileRegistry(
    await loadJson("scenarios/case-system-vnext/task-strategy-profiles.json"),
  );
  const suite = await loadJson(
    "scenarios/case-system-vnext/evaluator-stress-fixtures.json",
  ) as CaseSystemVNextStressFixtureSuite;
  const baseline = buildCaseSystemVNextExpertReviewExport(
    pilot,
    suite,
    registry,
    ["reviewer-a", "reviewer-b"],
  );

  const changedTeachingTarget: CaseSystemVNextStressFixtureSuite = {
    ...suite,
    fixtures: suite.fixtures.map((fixture, index) =>
      index === 0
        ? { ...fixture, teachingTarget: fixture.teachingTarget + " changed" }
        : fixture
    ),
  };
  const changedLearnerState: CaseSystemVNextStressFixtureSuite = {
    ...suite,
    fixtures: suite.fixtures.map((fixture, index) =>
      index === 0
        ? { ...fixture, learnerState: fixture.learnerState + " changed" }
        : fixture
    ),
  };
  for (const changedSuite of [
    changedTeachingTarget,
    changedLearnerState,
  ]) {
    const changed = buildCaseSystemVNextExpertReviewExport(
      pilot,
      changedSuite,
      registry,
      ["reviewer-a", "reviewer-b"],
    );
    assert.notEqual(
      changed.manifest.taskSetFingerprint,
      baseline.manifest.taskSetFingerprint,
    );
    assert.notEqual(
      changed.packets[0].packetFingerprint,
      baseline.packets[0].packetFingerprint,
    );
    assert.notEqual(
      changed.packets[1].packetFingerprint,
      baseline.packets[1].packetFingerprint,
    );
  }

  const changedRegistry = {
    ...registry,
    profiles: registry.profiles.map((profile, profileIndex) =>
      profileIndex === 0
        ? {
            ...profile,
            criteria: profile.criteria.map((criterion, criterionIndex) =>
              criterionIndex === 0
                ? {
                    ...criterion,
                    description: criterion.description + " changed",
                  }
                : criterion
            ),
          }
        : profile
    ),
  };
  const changedCriteria = buildCaseSystemVNextExpertReviewExport(
    pilot,
    suite,
    changedRegistry,
    ["reviewer-a", "reviewer-b"],
  );
  assert.notEqual(
    changedCriteria.manifest.taskSetFingerprint,
    baseline.manifest.taskSetFingerprint,
  );
  assert.notEqual(
    changedCriteria.packets[0].packetFingerprint,
    baseline.packets[0].packetFingerprint,
  );
  assert.notEqual(
    changedCriteria.packets[1].packetFingerprint,
    baseline.packets[1].packetFingerprint,
  );
});

test("expert review evidence is bound to the exact source reviewer packets", async () => {
  const pilot = parseCaseSystemVNextPilot(
    await loadJson("scenarios/case-system-vnext/pilot-archetypes.json"),
  );
  const registry = parseCaseSystemVNextStrategyProfileRegistry(
    await loadJson("scenarios/case-system-vnext/task-strategy-profiles.json"),
  );
  const suite = await loadJson(
    "scenarios/case-system-vnext/evaluator-stress-fixtures.json",
  ) as CaseSystemVNextStressFixtureSuite;

  const exportedA = buildCaseSystemVNextExpertReviewExport(
    pilot,
    suite,
    registry,
    ["reviewer-a", "reviewer-b"],
  );
  const submissions = exportedA.packets.map((packet) => ({
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
  })) as unknown as readonly [
    CaseSystemVNextExpertReviewSubmission,
    CaseSystemVNextExpertReviewSubmission,
  ];
  const evidenceA = mergeCaseSystemVNextExpertReviewSubmissions(
    exportedA,
    submissions,
  );

  assert.deepEqual(evidenceA.sourcePacketFingerprints, [
    {
      reviewerId: exportedA.packets[0].reviewerId,
      packetFingerprint: exportedA.packets[0].packetFingerprint,
    },
    {
      reviewerId: exportedA.packets[1].reviewerId,
      packetFingerprint: exportedA.packets[1].packetFingerprint,
    },
  ]);

  const changedSuite: CaseSystemVNextStressFixtureSuite = {
    ...suite,
    fixtures: suite.fixtures.map((fixture, index) =>
      index === 0
        ? { ...fixture, teachingTarget: fixture.teachingTarget + " changed" }
        : fixture
    ),
  };
  const exportedB = buildCaseSystemVNextExpertReviewExport(
    pilot,
    changedSuite,
    registry,
    ["reviewer-a", "reviewer-b"],
  );

  assert.throws(
    () => buildCaseSystemVNextExpertReviewConsensusResolution(
      exportedB,
      evidenceA,
    ),
    /adjudication data is invalid/u,
  );

  const disagreementSubmissions = exportedA.packets.map((packet, reviewerIndex) => ({
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
  const disagreementEvidenceA = mergeCaseSystemVNextExpertReviewSubmissions(
    exportedA,
    disagreementSubmissions,
  );

  assert.throws(
    () => buildCaseSystemVNextExpertReviewAdjudicationExport(
      exportedB,
      disagreementEvidenceA,
      "adjudicator-c",
    ),
    /adjudication data is invalid/u,
  );
});

test("legacy expert review protocol artifacts fail closed under v0.2 lineage rules", async () => {
  const exported = await buildExport();
  assert.equal(exported.manifest.protocolVersion, "0.2.0");

  const legacyPacket = {
    ...exported.packets[0],
    protocolVersion: "0.1.0",
  };
  assert.throws(
    () => parseCaseSystemVNextExpertReviewSubmission(
      {
        schemaVersion: legacyPacket.schemaVersion,
        protocolId: legacyPacket.protocolId,
        protocolVersion: legacyPacket.protocolVersion,
        reviewerId: legacyPacket.reviewerId,
        taskSetFingerprint: legacyPacket.taskSetFingerprint,
        packetFingerprint: legacyPacket.packetFingerprint,
        reviews: legacyPacket.tasks.map((task) => ({
          reviewTaskId: task.reviewTaskId,
          outcome: "EQUIVALENT",
          sufficientlyClear: true,
        })),
      },
      exported.packets[0],
    ),
    /expert review data is invalid/u,
  );
});

