import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import {
  collectTutorEvidence,
} from "../src/collection/index.js";
import {
  TUTOR_EVAL_DATASET_ID,
  TUTOR_EVAL_DATASET_VERSION,
  type TutorResponseCorpus,
} from "../src/contracts/index.js";
import {
  buildTutorBaselineGenerationSpec,
  loadTutorBaselinePrompt,
} from "../src/corpus/index.js";
import { loadTutorEvalDataset } from "../src/datasets/index.js";
import { runTutorResponseCorpus } from "../src/runner/index.js";
import {
  buildPublicEvidencePublication,
  inspectPublicationSources,
  parsePublicEvidencePublicationBundle,
  validatePublicEvidenceOutputDirectory,
  type PublicationBuildPaths,
  type PublicEvidencePublicationBundle,
} from "../src/publication/index.js";
import { PublicEvidencePublicationError } from "../src/publication/errors.js";
import { sha256Fingerprint } from "../src/publication/fingerprint.js";

interface Fixture {
  readonly root: string;
  readonly corpusPath: string;
  readonly evaluationPath: string;
  readonly approvalPath: string;
  readonly outputDirectory: string;
}

let fixture: Fixture;
const execFileAsync = promisify(execFile);

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function buildFixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "tutorbench-publication-"));
  const corpusPath = join(root, "corpus.json");
  const evaluationPath = join(root, "evaluation.json");
  const approvalPath = join(root, "approval.json");
  const outputDirectory = join(root, "publication");
  const dataset = await loadTutorEvalDataset(TUTOR_EVAL_DATASET_ID, TUTOR_EVAL_DATASET_VERSION);
  const prompt = await loadTutorBaselinePrompt();
  const generationSpec = buildTutorBaselineGenerationSpec(prompt);
  const firstCaseId = [...dataset.cases]
    .map((tutorEvalCase) => tutorEvalCase.id)
    .sort((left, right) => left.localeCompare(right))[0];
  const tutor = {
    provider: "fixture-provider",
    model: "fixture-model",
    modelVersion: "fixture-model-version",
    promptId: generationSpec.prompt.id,
    promptVersion: generationSpec.prompt.version,
  } as const;
  const collected = await collectTutorEvidence({
    dataset,
    generationSpec,
    tutorDescriptor: tutor,
    provenance: "recorded_model",
    runsPerCase: 1,
    corpusId: "fixture-corpus",
    corpusVersion: generationSpec.specVersion,
    collectionMode: "canonical_model",
    executeResponse: async (tutorEvalCase) => ({
      text: tutorEvalCase.id === firstCaseId
        ? "<script>alert('fixture-xss')</script>"
        : `Fixture response for ${tutorEvalCase.id}.`,
      metrics: {
        latencyMs: 42,
        tokenUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        cost: 0,
      },
    }),
  });
  assert.ok(collected.corpus);
  const corpus: TutorResponseCorpus = collected.corpus;
  const evaluation = await runTutorResponseCorpus({
    corpus,
    dataset,
    requireFull: true,
    judge: {
      provider: "fixture-judge-provider",
      model: "fixture-judge-model",
      modelVersion: "fixture-judge-version",
      promptId: "fixture-judge-prompt",
      promptVersion: "fixture-judge-prompt-version",
      evaluate: async (input) => ({
        schemaVersion: 1,
        caseId: input.caseId,
        rubricResults: input.rubrics.map((rubric) => ({
          rubricId: rubric.id,
          result: "PASS" as const,
          evidence: "PRIVATE_JUDGE_EVIDENCE_SHOULD_NOT_BE_PUBLISHED",
        })),
        criticalFailures: [],
        factualErrors: [],
        insufficientInformation: false,
      }),
    },
    runId: "fixture-evaluation",
  });
  const evaluationArtifact = {
    ...evaluation,
    artifactMetadata: {
      status: "preliminary" as const,
      calibrationStatus: "uncalibrated" as const,
      publicLeaderboardEligible: false as const,
    },
  };
  await writeJson(corpusPath, corpus);
  await writeJson(evaluationPath, evaluationArtifact);
  const corpusBytes = await readFile(corpusPath);
  const evaluationBytes = await readFile(evaluationPath);
  await writeJson(approvalPath, {
    schemaVersion: 1,
    publicationId: "fixture-publication",
    publicationVersion: "1",
    scope: "preliminary-model-evidence",
    sourceCorpusSha256: sha256Fingerprint(corpusBytes),
    sourceEvaluationSha256: sha256Fingerprint(evaluationBytes),
    publicLeaderboardEligible: false,
    acknowledgements: {
      uncalibrated: true,
      judgeIsNotGroundTruth: true,
      noLearningOutcomeClaim: true,
      sourceIdentityReviewed: true,
      publicSanitizationReviewed: true,
    },
  });
  return { root, corpusPath, evaluationPath, approvalPath, outputDirectory };
}

async function copyMutation(
  mutateCorpus: (value: Record<string, unknown>) => void = () => undefined,
  mutateEvaluation: (value: Record<string, unknown>) => void = () => undefined,
): Promise<PublicationBuildPaths> {
  const directory = await mkdtemp(join(fixture.root, "mutation-"));
  const corpus = JSON.parse(await readFile(fixture.corpusPath, "utf8")) as Record<string, unknown>;
  const evaluation = JSON.parse(await readFile(fixture.evaluationPath, "utf8")) as Record<string, unknown>;
  mutateCorpus(corpus);
  mutateEvaluation(evaluation);
  const corpusPath = join(directory, "corpus.json");
  const evaluationPath = join(directory, "evaluation.json");
  await writeJson(corpusPath, corpus);
  await writeJson(evaluationPath, evaluation);
  return {
    corpusPath,
    evaluationPath,
    approvalPath: fixture.approvalPath,
    outputDirectory: join(directory, "publication"),
  };
}

function evaluationRun(value: Record<string, unknown>): Record<string, unknown> {
  const run = value.evaluation;
  if (typeof run !== "object" || run === null || Array.isArray(run)) {
    throw new Error("Fixture evaluation wrapper is missing its run result.");
  }
  return run as Record<string, unknown>;
}

function evaluationCaseResults(value: Record<string, unknown>): Record<string, unknown>[] {
  const results = evaluationRun(value).caseResults;
  if (!Array.isArray(results)) {
    throw new Error("Fixture evaluation run is missing case results.");
  }
  return results as Record<string, unknown>[];
}

async function assertBuildRejects(
  paths: PublicationBuildPaths,
  code: string,
): Promise<void> {
  await assert.rejects(
    () => buildPublicEvidencePublication(paths),
    (error: unknown) => {
      assert.ok(error instanceof PublicEvidencePublicationError);
      assert.ok(error.issues.some((issue) => issue.code === code));
      return true;
    },
  );
}

before(async () => {
  fixture = await buildFixture();
});

after(async () => {
  await rm(fixture.root, { recursive: true, force: true });
});

test("builds, validates, and reproduces a complete offline publication", async () => {
  const firstOutput = await buildPublicEvidencePublication({
    corpusPath: fixture.corpusPath,
    evaluationPath: fixture.evaluationPath,
    approvalPath: fixture.approvalPath,
    outputDirectory: fixture.outputDirectory,
  });
  const secondDirectory = join(fixture.root, "publication-second");
  await buildPublicEvidencePublication({
    corpusPath: fixture.corpusPath,
    evaluationPath: fixture.evaluationPath,
    approvalPath: fixture.approvalPath,
    outputDirectory: secondDirectory,
  });
  for (const filename of ["publication.json", "models.json", "trials.json"]) {
    assert.equal(
      await readFile(join(fixture.outputDirectory, filename), "utf8"),
      await readFile(join(secondDirectory, filename), "utf8"),
    );
  }
  const validated = await validatePublicEvidenceOutputDirectory(fixture.outputDirectory);
  assert.equal(validated.publication.publicLeaderboardEligible, false);
  assert.equal(validated.models.entries.length, 1);
  assert.equal(validated.trials.entries.length, 48);
  assert.equal(firstOutput.trials.entries.some((trial) => trial.tutorResponse.includes("<script>")), true);
  await assert.rejects(
    () => buildPublicEvidencePublication({
      corpusPath: fixture.corpusPath,
      evaluationPath: fixture.evaluationPath,
      approvalPath: fixture.approvalPath,
      outputDirectory: fixture.outputDirectory,
    }),
    (error: unknown) => error instanceof PublicEvidencePublicationError &&
      error.code === "publication_output_exists",
  );
  const serialized = await readFile(join(fixture.outputDirectory, "publication.json"), "utf8");
  const publicTrials = await readFile(join(fixture.outputDirectory, "trials.json"), "utf8");
  assert.match(serialized, /<script>alert\('fixture-xss'\)<\/script>/u);
  assert.match(publicTrials, /<script>alert\('fixture-xss'\)<\/script>/u);
  assert.doesNotMatch(`${serialized}\n${publicTrials}`, /PRIVATE_JUDGE_EVIDENCE_SHOULD_NOT_BE_PUBLISHED/u);
  assert.doesNotMatch(`${serialized}\n${publicTrials}`, /rawJudgeResult|evaluatorOnly|knownMisconception|apiKey/u);
});

test("inspection is safe, deterministic, and requires a separate approval step", async () => {
  const report = await inspectPublicationSources(fixture);
  assert.equal(report.eligibleForPreliminaryPublication, true);
  assert.equal(report.approvalRequired, true);
  assert.equal(report.coverage.expectedCaseCount, 48);
  assert.equal(report.coverage.caseRunCount, 48);
  assert.doesNotMatch(JSON.stringify(report), /Fixture response|PRIVATE_JUDGE_EVIDENCE|[A-Za-z]:[\\/]/u);
});

test("rejects synthetic provenance", async () => {
  const paths = await copyMutation((corpus) => {
    corpus.provenance = "synthetic";
    corpus.responses = (corpus.responses as Record<string, unknown>[]).map((response) => ({
      ...response,
      provenance: "synthetic",
    }));
  });
  await assertBuildRejects(paths, "publication_provenance_not_recorded_model");
});

test("rejects partial corpus coverage", async () => {
  const paths = await copyMutation((corpus) => {
    corpus.coverage = "partial";
    corpus.responses = (corpus.responses as unknown[]).slice(1);
  });
  await assertBuildRejects(paths, "publication_coverage_incomplete");
});

test("rejects a non-current dataset version", async () => {
  const paths = await copyMutation(
    (corpus) => { corpus.datasetVersion = "0.2a.5"; },
    (evaluation) => {
      evaluation.datasetVersion = "0.2a.5";
      const run = evaluation.evaluation as Record<string, unknown>;
      run.datasetVersion = "0.2a.5";
    },
  );
  await assertBuildRejects(paths, "publication_dataset_not_current");
});

test("rejects missing model snapshot", async () => {
  const paths = await copyMutation((corpus) => {
    const tutor = corpus.tutor as Record<string, unknown>;
    delete tutor.modelVersion;
  });
  await assertBuildRejects(paths, "publication_model_version_missing");
});

test("rejects external provenance and semantic replay", async () => {
  const externalPaths = await copyMutation((corpus) => {
    corpus.provenance = "external";
    corpus.responses = (corpus.responses as Record<string, unknown>[]).map((response) => ({
      ...response,
      provenance: "external",
    }));
  });
  await assertBuildRejects(externalPaths, "publication_provenance_not_recorded_model");

  const replayPaths = await copyMutation(undefined, (evaluation) => {
    evaluation.semanticReplay = {
      compatibilityId: "fixture-replay",
      sourceDatasetId: "tutor-eval-v0.2a",
      sourceDatasetVersion: "0.2a.5",
      targetDatasetId: "tutor-eval-v0.2a",
      targetDatasetVersion: "0.2a.6",
      caseVersionMappings: [
        {
          caseId: "fixture-case",
          sourceVersion: "1.0.0",
          targetVersion: "1.1.0",
        },
      ],
    };
  });
  await assertBuildRejects(replayPaths, "publication_semantic_replay_forbidden");
});

test("rejects corpus and evaluation identity mismatches", async () => {
  const paths = await copyMutation(undefined, (evaluation) => {
    evaluation.corpusId = "different-corpus";
  });
  await assertBuildRejects(paths, "publication_identity_mismatch");
});

test("rejects missing and extra case-runs", async () => {
  const missingPaths = await copyMutation(undefined, (evaluation) => {
    const run = evaluationRun(evaluation);
    const results = evaluationCaseResults(evaluation);
    const removed = results.shift();
    run.caseResults = results;
    run.caseRunCount = results.length;
    if (removed?.status === "passed") {
      run.passedCount = (run.passedCount as number) - 1;
    } else if (removed?.status === "failed") {
      run.failedCount = (run.failedCount as number) - 1;
    } else if (removed?.status === "error") {
      run.errorCount = (run.errorCount as number) - 1;
    }
  });
  await assertBuildRejects(missingPaths, "publication_missing_case_run");

  const extraPaths = await copyMutation(undefined, (evaluation) => {
    const run = evaluationRun(evaluation);
    const results = evaluationCaseResults(evaluation);
    const source = results[0];
    assert.ok(source);
    const extra = { ...source, caseId: "unexpected-case" } as Record<string, unknown>;
    results.push(extra);
    run.caseResults = results;
    run.caseRunCount = results.length;
    run.passedCount = (run.passedCount as number) + (extra.status === "passed" ? 1 : 0);
    run.failedCount = (run.failedCount as number) + (extra.status === "failed" ? 1 : 0);
    run.errorCount = (run.errorCount as number) + (extra.status === "error" ? 1 : 0);
  });
  await assertBuildRejects(extraPaths, "publication_extra_case_run");
});

test("rejects old evaluator versions, execution errors, and unresolved scores", async () => {
  const oldEvaluatorPaths = await copyMutation(undefined, (evaluation) => {
    evaluationRun(evaluation).evaluatorVersion = "0.0.0-old";
  });
  await assertBuildRejects(oldEvaluatorPaths, "publication_evaluator_version_mismatch");

  const errorPaths = await copyMutation(undefined, (evaluation) => {
    const run = evaluationRun(evaluation);
    const results = evaluationCaseResults(evaluation);
    const first = results[0];
    assert.ok(first);
    const previousStatus = first.status;
    first.status = "error";
    first.passed = false;
    run.errorCount = (run.errorCount as number) + 1;
    if (previousStatus === "passed") {
      run.passedCount = (run.passedCount as number) - 1;
    } else if (previousStatus === "failed") {
      run.failedCount = (run.failedCount as number) - 1;
    }
  });
  await assertBuildRejects(errorPaths, "publication_evaluation_error");

  const scorePaths = await copyMutation(undefined, (evaluation) => {
    const first = evaluationCaseResults(evaluation)[0];
    assert.ok(first);
    const categoryScores = first.categoryScores as Record<string, unknown>;
    categoryScores.correctness = null;
  });
  await assertBuildRejects(scorePaths, "publication_score_unresolved");
});

test("rejects invalid source metadata and absent Judge evidence", async () => {
  const metadataPaths = await copyMutation(undefined, (evaluation) => {
    const metadata = evaluation.artifactMetadata as Record<string, unknown>;
    metadata.status = "calibrated";
  });
  await assertBuildRejects(metadataPaths, "publication_source_metadata_invalid");

  const calibrationPaths = await copyMutation(undefined, (evaluation) => {
    const metadata = evaluation.artifactMetadata as Record<string, unknown>;
    metadata.calibrationStatus = "calibrated";
  });
  await assertBuildRejects(calibrationPaths, "publication_source_metadata_invalid");

  const judgePaths = await copyMutation(undefined, (evaluation) => {
    evaluationRun(evaluation).judge = null;
  });
  await assertBuildRejects(judgePaths, "publication_judge_missing");
});

test("rejects subset evaluation and absent Judge evidence", async () => {
  const partialPaths = await copyMutation(undefined, (evaluation) => {
    evaluation.coverage = "partial";
    evaluation.missingCaseCount = 1;
  });
  await assertBuildRejects(partialPaths, "publication_coverage_incomplete");

  const paths = await copyMutation(undefined, (evaluation) => {
    evaluation.evaluationSelection = {
      mode: "explicit_cases",
      requestedCaseIds: ["one-case"],
      selectedCaseIds: ["one-case"],
      limit: null,
      selectedResponseCount: 1,
    };
    const run = evaluation.evaluation as Record<string, unknown>;
    run.judge = null;
  });
  await assertBuildRejects(paths, "publication_evaluation_subset");
});

test("rejects changed response text and source hash reuse", async () => {
  const paths = await copyMutation((corpus) => {
    const response = (corpus.responses as Record<string, unknown>[])[0];
    assert.ok(response);
    response.responseText = "tampered response";
  });
  await assertBuildRejects(paths, "publication_response_mismatch");

  const approval = JSON.parse(await readFile(fixture.approvalPath, "utf8")) as Record<string, unknown>;
  approval.sourceCorpusSha256 = "sha256:" + "0".repeat(64);
  const approvalPath = join(fixture.root, "wrong-hash-approval.json");
  await writeJson(approvalPath, approval);
  await assertBuildRejects({
    corpusPath: fixture.corpusPath,
    evaluationPath: fixture.evaluationPath,
    approvalPath,
    outputDirectory: join(fixture.root, "wrong-hash-publication"),
  }, "publication_source_hash_mismatch");
});

test("rejects unresolved rubric results and leaderboard approval", async () => {
  const paths = await copyMutation(undefined, (evaluation) => {
    const run = evaluation.evaluation as Record<string, unknown>;
    const results = run.caseResults as Record<string, unknown>[];
    const rubricResults = results[0]?.rubricResults as Record<string, unknown>[];
  if (rubricResults[0] !== undefined) {
      rubricResults[0].result = "ERROR";
    }
  });
  await assertBuildRejects(paths, "publication_score_unresolved");

  const approval = JSON.parse(await readFile(fixture.approvalPath, "utf8")) as Record<string, unknown>;
  approval.publicLeaderboardEligible = true;
  const approvalPath = join(fixture.root, "leaderboard-approval.json");
  await writeJson(approvalPath, approval);
  await assertBuildRejects({
    corpusPath: fixture.corpusPath,
    evaluationPath: fixture.evaluationPath,
    approvalPath,
    outputDirectory: join(fixture.root, "leaderboard-publication"),
  }, "publication_leaderboard_forbidden");

  const acknowledgement = JSON.parse(await readFile(fixture.approvalPath, "utf8")) as Record<string, unknown>;
  const acknowledgements = acknowledgement.acknowledgements as Record<string, unknown>;
  acknowledgements.publicSanitizationReviewed = false;
  const acknowledgementPath = join(fixture.root, "incomplete-approval.json");
  await writeJson(acknowledgementPath, acknowledgement);
  await assert.rejects(
    () => buildPublicEvidencePublication({
      corpusPath: fixture.corpusPath,
      evaluationPath: fixture.evaluationPath,
      approvalPath: acknowledgementPath,
      outputDirectory: join(fixture.root, "incomplete-approval-publication"),
    }),
    (error: unknown) => error instanceof PublicEvidencePublicationError &&
      error.code === "publication_approval_invalid",
  );
});

test("public bundle parser rejects injected private fields", async () => {
  await buildPublicEvidencePublication({
    corpusPath: fixture.corpusPath,
    evaluationPath: fixture.evaluationPath,
    approvalPath: fixture.approvalPath,
    outputDirectory: join(fixture.root, "private-field-publication"),
  });
  const publication = JSON.parse(
    await readFile(join(fixture.root, "private-field-publication", "publication.json"), "utf8"),
  ) as PublicEvidencePublicationBundle & { readonly rawJudgeResult?: unknown };
  const injected = { ...publication, rawJudgeResult: { hiddenReasoning: "private" } };
  assert.throws(
    () => parsePublicEvidencePublicationBundle(injected),
    (error: unknown) => error instanceof PublicEvidencePublicationError &&
      error.code === "publication_private_field",
  );
  assert.throws(
    () => parsePublicEvidencePublicationBundle({
      ...publication,
      model: { ...publication.model, provider: "C:\\private\\provider" },
    }),
    (error: unknown) => error instanceof PublicEvidencePublicationError &&
      error.code === "publication_private_field",
  );
  assert.throws(
    () => parsePublicEvidencePublicationBundle({
      ...publication,
      model: { ...publication.model, id: "random-model-id" },
    }),
    (error: unknown) => error instanceof PublicEvidencePublicationError &&
      error.code === "publication_id_invalid",
  );
});

test("offline CLIs inspect, build, and validate temporary fixtures", async () => {
  const cliRoot = process.cwd();
  const inspectOutput = join(fixture.root, "cli-inspection.json");
  const cliPublication = join(fixture.root, "cli-publication");
  const cliArgs = [
    "--corpus",
    fixture.corpusPath,
    "--evaluation",
    fixture.evaluationPath,
  ];
  const inspected = await execFileAsync(
    process.execPath,
    [join(cliRoot, "dist/src/cli/publication-inspect.js"), ...cliArgs, "--output", inspectOutput],
    { cwd: cliRoot, maxBuffer: 2_000_000 },
  );
  assert.match(inspected.stdout, /"approvalRequired": true/u);
  assert.equal((JSON.parse(await readFile(inspectOutput, "utf8")) as Record<string, unknown>)
    .eligibleForPreliminaryPublication, true);

  const built = await execFileAsync(
    process.execPath,
    [
      join(cliRoot, "dist/src/cli/publication-build.js"),
      ...cliArgs,
      "--approval",
      fixture.approvalPath,
      "--output-dir",
      cliPublication,
    ],
    { cwd: cliRoot, maxBuffer: 2_000_000 },
  );
  assert.match(built.stdout, /"websiteUpdated": false/u);

  const validated = await execFileAsync(
    process.execPath,
    [
      join(cliRoot, "dist/src/cli/publication-validate.js"),
      "--publication",
      join(cliPublication, "publication.json"),
      "--models",
      join(cliPublication, "models.json"),
      "--trials",
      join(cliPublication, "trials.json"),
    ],
    { cwd: cliRoot, maxBuffer: 2_000_000 },
  );
  assert.match(validated.stdout, /"valid": true/u);
  assert.doesNotMatch(`${inspected.stdout}\n${built.stdout}\n${validated.stdout}`, /https?:\/\//u);
});
