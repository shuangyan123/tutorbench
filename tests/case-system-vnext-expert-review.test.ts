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
  buildCaseSystemVNextExpertReviewAdjudicationExport,
  buildCaseSystemVNextExpertReviewConsensusResolution,
  buildCaseSystemVNextExpertReviewResolution,
  parseCaseSystemVNextExpertReviewAdjudicationSubmission,
} from "../src/case-system-vnext/expert-review-adjudication.js";
import {
  buildCaseSystemVNextExpertReviewReferenceCandidate,
  parseCaseSystemVNextExpertReviewResolution,
} from "../src/case-system-vnext/expert-review-reference.js";
import {
  parseCaseSystemVNextExpertReviewExportArgs,
  selectCaseSystemVNextExpertReviewSuite,
} from "../src/cli/case-system-vnext-expert-review.js";
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
    assert.match(
      instructionsA,
      /A_BETTER: candidate A is substantively better/u,
    );
    assert.match(
      instructionsA,
      /EQUIVALENT: the candidates are materially equivalent/u,
    );
    assert.match(
      instructionsA,
      /NON_DOMINATED: each candidate has defensible advantages/u,
    );
    assert.match(
      instructionsA,
      /INSUFFICIENT_EVIDENCE: the packet does not contain enough evidence/u,
    );
    assert.equal(
      [...instructionsA].every((character) => (character.codePointAt(0) ?? 0) <= 0x7f),
      true,
    );

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
    assert.match(importResult.stdout, /Adjudication queue: 0/u);
    assert.match(importResult.stdout, /No automatic reference-label promotion/u);

    const analysis = JSON.parse(
      await readFile(join(directory, "expert-review-analysis.json"), "utf8"),
    ) as {
      readonly summary: {
        readonly totalTaskCount: number;
        readonly agreementCount: number;
        readonly adjudicationCount: number;
        readonly agreementRate: number | null;
      };
      readonly adjudicationQueue: readonly unknown[];
    };
    assert.equal(analysis.summary.totalTaskCount, 17);
    assert.equal(analysis.summary.agreementCount, 17);
    assert.equal(analysis.summary.adjudicationCount, 0);
    assert.equal(analysis.summary.agreementRate, 1);
    assert.deepEqual(analysis.adjudicationQueue, []);

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


test("mathematics expert review dry run preserves all human-evidence states", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tutorbench-vnext-math-review-dry-run-"));
  try {
    const exportResult = await runCli([
      "case-system-vnext-expert-review-export",
      "--reviewer",
      "math-reviewer-a",
      "--reviewer",
      "math-reviewer-b",
      "--domain",
      "mathematics",
      "--output-dir",
      directory,
    ]);
    assert.equal(exportResult.exitCode, 0, exportResult.stderr);
    assert.match(exportResult.stdout, /Tasks per reviewer: 5/u);

    const manifest = JSON.parse(
      await readFile(join(directory, "operator-manifest.json"), "utf8"),
    ) as {
      readonly tasks: readonly {
        readonly reviewTaskId: string;
        readonly assignments: readonly [
          {
            readonly aCandidateId: string;
            readonly bCandidateId: string;
          },
          {
            readonly aCandidateId: string;
            readonly bCandidateId: string;
          },
        ];
      }[];
    };
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

    assert.equal(manifest.tasks.length, 5);
    assert.equal(packetA.tasks.length, 5);
    assert.equal(packetB.tasks.length, 5);

    const sharedPreferredCandidate = manifest.tasks[0]!.assignments[0].aCandidateId;
    assert.equal(
      manifest.tasks[0]!.assignments[1].bCandidateId,
      sharedPreferredCandidate,
    );

    const makeSubmission = (
      packet: typeof packetA,
      reviewerIndex: 0 | 1,
    ) => ({
      schemaVersion: packet.schemaVersion,
      protocolId: packet.protocolId,
      protocolVersion: packet.protocolVersion,
      reviewerId: packet.reviewerId,
      taskSetFingerprint: packet.taskSetFingerprint,
      packetFingerprint: packet.packetFingerprint,
      reviews: packet.tasks.map((task, taskIndex) => {
        if (taskIndex === 0) {
          return {
            reviewTaskId: task.reviewTaskId,
            outcome: reviewerIndex === 0 ? "A_BETTER" : "B_BETTER",
            sufficientlyClear: true,
          };
        }
        if (taskIndex === 1) {
          return {
            reviewTaskId: task.reviewTaskId,
            outcome: "EQUIVALENT",
            sufficientlyClear: true,
          };
        }
        if (taskIndex === 2) {
          return {
            reviewTaskId: task.reviewTaskId,
            outcome: "INSUFFICIENT_EVIDENCE",
            sufficientlyClear: true,
            notes: "Synthetic dry run: evidence is intentionally insufficient.",
          };
        }
        if (taskIndex === 3) {
          return {
            reviewTaskId: task.reviewTaskId,
            outcome: reviewerIndex === 0 ? "NON_DOMINATED" : "EQUIVALENT",
            sufficientlyClear: true,
          };
        }
        return {
          reviewTaskId: task.reviewTaskId,
          outcome: reviewerIndex === 0 ? "A_BETTER" : "B_BETTER",
          sufficientlyClear: reviewerIndex === 0,
          notes: reviewerIndex === 1
            ? "Synthetic dry run: packet clarity intentionally marked false."
            : "Synthetic dry run: counterpart marks packet unclear.",
        };
      }),
    });

    const submissionAPath = join(directory, "math-reviewer-a.synthetic.json");
    const submissionBPath = join(directory, "math-reviewer-b.synthetic.json");
    await writeFile(
      submissionAPath,
      `${JSON.stringify(makeSubmission(packetA, 0), null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      submissionBPath,
      `${JSON.stringify(makeSubmission(packetB, 1), null, 2)}\n`,
      "utf8",
    );

    const outputPath = join(directory, "synthetic-expert-review-evidence.json");
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
    assert.match(importResult.stdout, /Agreements: 3/u);
    assert.match(importResult.stdout, /Disagreements: 1/u);
    assert.match(importResult.stdout, /Packet ambiguities: 1/u);
    assert.match(importResult.stdout, /Adjudication queue: 2/u);
    assert.match(importResult.stdout, /No automatic reference-label promotion/u);

    const analysisPath = join(directory, "expert-review-analysis.json");
    const analysis = JSON.parse(await readFile(analysisPath, "utf8")) as {
      readonly summary: {
        readonly totalTaskCount: number;
        readonly agreementCount: number;
        readonly disagreementCount: number;
        readonly packetAmbiguityCount: number;
        readonly adjudicationCount: number;
        readonly agreementRate: number | null;
        readonly clearPacketTaskCount: number;
        readonly clearPacketAgreementRate: number | null;
      };
      readonly tasks: readonly {
        readonly reviewTaskId: string;
        readonly fixtureId: string;
        readonly agreement: "agreement" | "disagreement" | "packet_ambiguity";
        readonly requiresAdjudication: boolean;
        readonly adjudicationReason?: "reviewer_disagreement" | "packet_ambiguity";
        readonly reviewerResults: readonly {
          readonly reviewerId: string;
          readonly rawOutcome: string;
          readonly sufficientlyClear: boolean;
          readonly notes?: string;
          readonly normalizedOutcome:
            | { readonly kind: "preference"; readonly candidateId: string }
            | { readonly kind: "equivalent" }
            | { readonly kind: "non_dominated" }
            | { readonly kind: "insufficient_evidence" };
        }[];
      }[];
      readonly adjudicationQueue: readonly {
        readonly reviewTaskId: string;
        readonly fixtureId: string;
        readonly reason: "reviewer_disagreement" | "packet_ambiguity";
      }[];
      readonly limitations: readonly string[];
    };

    assert.deepEqual(analysis.summary, {
      totalTaskCount: 5,
      agreementCount: 3,
      disagreementCount: 1,
      packetAmbiguityCount: 1,
      adjudicationCount: 2,
      agreementRate: 0.6,
      clearPacketTaskCount: 4,
      clearPacketAgreementRate: 0.75,
    });
    assert.equal(analysis.tasks.length, 5);
    assert.equal(analysis.tasks[3]!.requiresAdjudication, true);
    assert.equal(
      analysis.tasks[3]!.adjudicationReason,
      "reviewer_disagreement",
    );
    assert.equal(analysis.tasks[4]!.requiresAdjudication, true);
    assert.equal(analysis.tasks[4]!.adjudicationReason, "packet_ambiguity");
    assert.equal(analysis.tasks[4]!.reviewerResults[1]!.sufficientlyClear, false);
    assert.match(
      analysis.tasks[4]!.reviewerResults[1]!.notes ?? "",
      /intentionally marked false/u,
    );
    assert.deepEqual(
      analysis.adjudicationQueue.map((item) => item.reason),
      ["reviewer_disagreement", "packet_ambiguity"],
    );
    assert.ok(
      analysis.limitations.some((item) => /not population estimates/u.test(item)),
    );

    const evidence = JSON.parse(await readFile(outputPath, "utf8")) as {
      readonly agreementCount: number;
      readonly disagreementCount: number;
      readonly packetAmbiguityCount: number;
      readonly reviews: readonly {
        readonly agreement: "agreement" | "disagreement" | "packet_ambiguity";
        readonly reviewerResults: readonly {
          readonly sufficientlyClear: boolean;
          readonly notes?: string;
          readonly normalizedOutcome:
            | { readonly kind: "preference"; readonly candidateId: string }
            | { readonly kind: "equivalent" }
            | { readonly kind: "non_dominated" }
            | { readonly kind: "insufficient_evidence" };
        }[];
      }[];
    };

    assert.equal(evidence.agreementCount, 3);
    assert.equal(evidence.disagreementCount, 1);
    assert.equal(evidence.packetAmbiguityCount, 1);
    assert.equal(evidence.reviews.length, 5);

    const normalizedPreferenceA = evidence.reviews[0]!.reviewerResults[0]!
      .normalizedOutcome;
    const normalizedPreferenceB = evidence.reviews[0]!.reviewerResults[1]!
      .normalizedOutcome;
    assert.equal(normalizedPreferenceA.kind, "preference");
    assert.equal(normalizedPreferenceB.kind, "preference");
    if (
      normalizedPreferenceA.kind !== "preference" ||
      normalizedPreferenceB.kind !== "preference"
    ) {
      assert.fail("Expected normalized preference outcomes.");
    }
    assert.equal(normalizedPreferenceA.candidateId, sharedPreferredCandidate);
    assert.equal(normalizedPreferenceB.candidateId, sharedPreferredCandidate);

    assert.equal(
      evidence.reviews[1]!.reviewerResults[0]!.normalizedOutcome.kind,
      "equivalent",
    );
    assert.equal(
      evidence.reviews[2]!.reviewerResults[0]!.normalizedOutcome.kind,
      "insufficient_evidence",
    );
    assert.equal(evidence.reviews[3]!.agreement, "disagreement");
    assert.equal(evidence.reviews[4]!.agreement, "packet_ambiguity");
    assert.equal(
      evidence.reviews[4]!.reviewerResults[1]!.sufficientlyClear,
      false,
    );
    assert.match(
      evidence.reviews[4]!.reviewerResults[1]!.notes ?? "",
      /intentionally marked false/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});


test("expert review export supports domain-scoped cohorts", async () => {
  const pilot = parseCaseSystemVNextPilot(
    await loadJson("scenarios/case-system-vnext/pilot-archetypes.json"),
  );
  const suite = await loadJson(
    "scenarios/case-system-vnext/evaluator-stress-fixtures.json",
  ) as CaseSystemVNextStressFixtureSuite;

  const mathematics = selectCaseSystemVNextExpertReviewSuite(
    pilot,
    suite,
    ["mathematics"],
  );
  assert.equal(mathematics.fixtures.length, 5);

  const computerScience = selectCaseSystemVNextExpertReviewSuite(
    pilot,
    suite,
    ["computer_science"],
  );
  assert.equal(computerScience.fixtures.length, 4);

  const combined = selectCaseSystemVNextExpertReviewSuite(
    pilot,
    suite,
    ["biology", "chemistry"],
  );
  assert.equal(combined.fixtures.length, 4);
});

test("expert review export CLI parses repeatable domain filters", () => {
  const parsed = parseCaseSystemVNextExpertReviewExportArgs([
    "--reviewer",
    "reviewer-a",
    "--reviewer",
    "reviewer-b",
    "--domain",
    "mathematics",
    "--domain=computer_science",
    "--output-dir",
    "artifacts/review",
  ]);
  assert.equal(parsed.help, false);
  if (parsed.help || parsed.mode !== "export") return;
  assert.deepEqual(parsed.domainIds, ["mathematics", "computer_science"]);
  assert.throws(
    () => parseCaseSystemVNextExpertReviewExportArgs([
      "--reviewer",
      "reviewer-a",
      "--reviewer",
      "reviewer-b",
      "--domain",
      "not-a-domain",
    ]),
    /Case System vNext domain ID/u,
  );
});

test("expert review adjudication exports only queued tasks and preserves unresolved outcomes", async () => {
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
        : taskIndex === 1
          ? "EQUIVALENT" as const
          : "NON_DOMINATED" as const,
      sufficientlyClear: taskIndex !== 1 || reviewerIndex === 0,
      ...(taskIndex === 1 && reviewerIndex === 1
        ? { notes: "Synthetic ambiguity for adjudication coverage." }
        : {}),
    })),
  })) as unknown as readonly [
    CaseSystemVNextExpertReviewSubmission,
    CaseSystemVNextExpertReviewSubmission,
  ];
  const evidence = mergeCaseSystemVNextExpertReviewSubmissions(exported, submissions);
  assert.equal(evidence.disagreementCount, 1);
  assert.equal(evidence.packetAmbiguityCount, 1);

  const adjudication = buildCaseSystemVNextExpertReviewAdjudicationExport(
    exported,
    evidence,
    "adjudicator-c",
  );
  assert.equal(adjudication.manifest.tasks.length, 2);
  assert.equal(adjudication.packet.tasks.length, 2);
  assert.deepEqual(
    adjudication.manifest.tasks.map((task) => task.reason),
    ["reviewer_disagreement", "packet_ambiguity"],
  );
  const serializedPacket = JSON.stringify(adjudication.packet);
  assert.doesNotMatch(serializedPacket, /sourceReviewerResults/u);
  assert.doesNotMatch(serializedPacket, /reviewer-a/u);
  assert.doesNotMatch(serializedPacket, /reviewer-b/u);

  const rawSubmission = {
    schemaVersion: adjudication.packet.schemaVersion,
    protocolId: adjudication.packet.protocolId,
    protocolVersion: adjudication.packet.protocolVersion,
    adjudicatorId: adjudication.packet.adjudicatorId,
    taskSetFingerprint: adjudication.packet.taskSetFingerprint,
    sourceEvidenceFingerprint: adjudication.packet.sourceEvidenceFingerprint,
    adjudicationSetFingerprint: adjudication.packet.adjudicationSetFingerprint,
    packetFingerprint: adjudication.packet.packetFingerprint,
    adjudications: adjudication.packet.tasks.map((task, index) => ({
      reviewTaskId: task.reviewTaskId,
      outcome: index === 0 ? "A_BETTER" as const : "INSUFFICIENT_EVIDENCE" as const,
      sufficientlyClear: index === 0,
      ...(index === 1
        ? { notes: "Packet remains insufficiently clear after independent adjudication." }
        : {}),
    })),
  };
  const parsed = parseCaseSystemVNextExpertReviewAdjudicationSubmission(
    rawSubmission,
    adjudication.packet,
  );
  const resolution = buildCaseSystemVNextExpertReviewResolution(
    exported,
    evidence,
    adjudication,
    parsed,
  );
  assert.equal(resolution.summary.totalTaskCount, 17);
  assert.equal(resolution.summary.reviewerConsensusCount, 15);
  assert.equal(resolution.summary.adjudicatedCount, 1);
  assert.equal(resolution.summary.unresolvedCount, 1);
  assert.equal(resolution.summary.resolvedCount, 16);
  assert.equal(resolution.summary.resolvedShare, 16 / 17);
  assert.equal(resolution.tasks[0]!.resolutionStatus, "adjudicated");
  assert.equal(resolution.tasks[1]!.resolutionStatus, "unresolved");
  assert.equal(resolution.tasks[1]!.resolution, undefined);
  assert.match(
    resolution.tasks[1]!.adjudicatorResult?.notes ?? "",
    /insufficiently clear/u,
  );
  assert.match(resolution.resolutionFingerprint, /^sha256:[0-9a-f]{64}$/u);
});

test("expert review adjudication parser rejects incomplete coverage and unclear result without notes", async () => {
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
  const base = {
    schemaVersion: adjudication.packet.schemaVersion,
    protocolId: adjudication.packet.protocolId,
    protocolVersion: adjudication.packet.protocolVersion,
    adjudicatorId: adjudication.packet.adjudicatorId,
    taskSetFingerprint: adjudication.packet.taskSetFingerprint,
    sourceEvidenceFingerprint: adjudication.packet.sourceEvidenceFingerprint,
    adjudicationSetFingerprint: adjudication.packet.adjudicationSetFingerprint,
    packetFingerprint: adjudication.packet.packetFingerprint,
  };
  assert.throws(
    () => parseCaseSystemVNextExpertReviewAdjudicationSubmission(
      { ...base, adjudications: [] },
      adjudication.packet,
    ),
    /adjudication data is invalid/u,
  );
  assert.throws(
    () => parseCaseSystemVNextExpertReviewAdjudicationSubmission(
      {
        ...base,
        adjudications: adjudication.packet.tasks.map((task) => ({
          reviewTaskId: task.reviewTaskId,
          outcome: "INSUFFICIENT_EVIDENCE",
          sufficientlyClear: false,
        })),
      },
      adjudication.packet,
    ),
    /adjudication data is invalid/u,
  );
});

test("expert review reference candidate blocks unresolved and insufficient-evidence tasks", async () => {
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
        : taskIndex === 1
          ? "INSUFFICIENT_EVIDENCE" as const
          : "EQUIVALENT" as const,
      sufficientlyClear: taskIndex !== 0 || reviewerIndex === 0,
      ...(taskIndex === 0 && reviewerIndex === 1
        ? { notes: "Synthetic ambiguity for reference gate coverage." }
        : {}),
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
  const rawSubmission = {
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
      outcome: "INSUFFICIENT_EVIDENCE" as const,
      sufficientlyClear: false,
      notes: "Synthetic adjudicator cannot resolve the ambiguous packet.",
    })),
  };
  const resolution = buildCaseSystemVNextExpertReviewResolution(
    exported,
    evidence,
    adjudication,
    parseCaseSystemVNextExpertReviewAdjudicationSubmission(
      rawSubmission,
      adjudication.packet,
    ),
  );
  const parsedResolution = parseCaseSystemVNextExpertReviewResolution(resolution);
  const candidate = buildCaseSystemVNextExpertReviewReferenceCandidate(
    parsedResolution,
  );

  assert.equal(candidate.summary.totalTaskCount, 17);
  assert.equal(candidate.summary.unresolvedCount, 1);
  assert.equal(candidate.summary.insufficientEvidenceCount, 1);
  assert.equal(candidate.summary.blockedCount, 2);
  assert.equal(candidate.summary.candidateReadyCount, 15);
  assert.equal(candidate.promotionGate.status, "blocked");
  assert.equal(candidate.promotionGate.automaticPromotionAllowed, false);
  assert.equal(candidate.promotionGate.operatorApprovalRequired, true);
  assert.deepEqual(
    candidate.promotionGate.blockers.map((blocker) => blocker.reason).sort(),
    ["insufficient_evidence", "unresolved"],
  );
});

test("expert review reference candidate becomes eligible only after all tasks have substantive resolutions", async () => {
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
  const rawSubmission = {
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
      outcome: "A_BETTER" as const,
      sufficientlyClear: true,
    })),
  };
  const resolution = buildCaseSystemVNextExpertReviewResolution(
    exported,
    evidence,
    adjudication,
    parseCaseSystemVNextExpertReviewAdjudicationSubmission(
      rawSubmission,
      adjudication.packet,
    ),
  );
  const candidate = buildCaseSystemVNextExpertReviewReferenceCandidate(resolution);

  assert.equal(candidate.summary.blockedCount, 0);
  assert.equal(candidate.summary.candidateReadyCount, 17);
  assert.equal(
    candidate.promotionGate.status,
    "eligible_for_manual_promotion",
  );
  assert.equal(candidate.promotionGate.automaticPromotionAllowed, false);
  assert.equal(candidate.promotionGate.operatorApprovalRequired, true);
  assert.deepEqual(candidate.promotionGate.blockers, []);
  assert.ok(
    candidate.tasks.every((task) =>
      task.candidateStatus === "candidate_ready" &&
      task.provenance !== undefined &&
      task.outcome !== undefined
    ),
  );
  assert.match(candidate.candidateFingerprint, /^sha256:[0-9a-f]{64}$/u);
});

test("expert review resolution parser rejects fingerprint tampering", async () => {
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
  const resolution = buildCaseSystemVNextExpertReviewResolution(
    exported,
    evidence,
    adjudication,
    submission,
  );
  assert.throws(
    () => parseCaseSystemVNextExpertReviewResolution({
      ...resolution,
      resolutionFingerprint: "sha256:" + "0".repeat(64),
    }),
    /resolution data is invalid/u,
  );
});

test("expert review consensus resolution reaches the reference gate without adjudication", async () => {
  const exported = await buildExport();
  const submissions = exported.packets.map((packet, reviewerIndex) => ({
    schemaVersion: packet.schemaVersion,
    protocolId: packet.protocolId,
    protocolVersion: packet.protocolVersion,
    reviewerId: packet.reviewerId,
    taskSetFingerprint: packet.taskSetFingerprint,
    packetFingerprint: packet.packetFingerprint,
    reviews: packet.tasks.map((task) => ({
      reviewTaskId: task.reviewTaskId,
      outcome: reviewerIndex === 0 ? "A_BETTER" as const : "B_BETTER" as const,
      sufficientlyClear: true,
    })),
  })) as unknown as readonly [
    CaseSystemVNextExpertReviewSubmission,
    CaseSystemVNextExpertReviewSubmission,
  ];
  const evidence = mergeCaseSystemVNextExpertReviewSubmissions(exported, submissions);
  assert.equal(evidence.agreementCount, 17);
  assert.equal(evidence.disagreementCount, 0);
  assert.equal(evidence.packetAmbiguityCount, 0);

  const resolution = buildCaseSystemVNextExpertReviewConsensusResolution(
    exported,
    evidence,
  );
  assert.equal(resolution.adjudicatorId, undefined);
  assert.equal(resolution.adjudicationSetFingerprint, undefined);
  assert.equal(resolution.summary.reviewerConsensusCount, 17);
  assert.equal(resolution.summary.adjudicatedCount, 0);
  assert.equal(resolution.summary.unresolvedCount, 0);

  const parsed = parseCaseSystemVNextExpertReviewResolution(resolution);
  const candidate = buildCaseSystemVNextExpertReviewReferenceCandidate(parsed);
  assert.equal(candidate.adjudicatorId, undefined);
  assert.equal(candidate.adjudicationSetFingerprint, undefined);
  assert.equal(candidate.summary.candidateReadyCount, 17);
  assert.equal(candidate.summary.blockedCount, 0);
  assert.equal(candidate.promotionGate.status, "eligible_for_manual_promotion");
});

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
    assert.match(rejected.stderr, /expert review lineage is invalid/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

