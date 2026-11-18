import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { loadTutorEvalDataset } from "../../dist/src/datasets/index.js";
import { loadTutorBaselinePrompt, buildTutorBaselineGenerationSpec } from "../../dist/src/corpus/index.js";
import { assertValidTutorResponseCorpus } from "../../dist/src/contracts/index.js";
import { createHintPilot, hintSource } from "../../dist/src/research/learner-evidence-hint-scenarios.js";
import { evaluateHintFit, hintRubric } from "../../dist/src/research/learner-evidence-hint-rubric.js";
import { describeHintBaseline, summarizeHintMeasurement } from "../../dist/src/research/learner-evidence-hint-measurement.js";
import { measurementFingerprint } from "../../dist/src/research/measurement-reliability-source.js";
import { parseTutorEvaluationAuditArtifact } from "../../dist/src/reporting/tutor-evaluation-audit.js";
import { hasMatchingTutorEvalAuthoredScoring } from "../../dist/src/scoring/provenance.js";
import { runTutorResponseCorpus } from "../../dist/src/runner/tutor-response-corpus-runner.js";
import { artifactPath, EFFORTS, prepare, validateCorpus, writeNew } from "./deepseek-tutor-efforts-core.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const controlsPath = "scenarios/experimental/learner-evidence-hint-v0.1/responses.json";
const reviewPath = "docs/research/learner-evidence-hint-maintainer-review-v0.1.json";
const privateReportPath = resolve("artifacts/real-model/learner-evidence-hint-fit-v0.1.0.replay.json");
const measurementPath = resolve("artifacts/real-model/learner-evidence-hint-fit-v0.1.0.before-after.json");

async function baselineFor(corpus, dataset, candidate, effort, identity) {
  const bytes = await readFile(artifactPath(effort, "inspect", "offline-evaluation"));
  if (sha256(bytes) !== identity.offlineEvaluationSha256) throw new Error("hint_historical_result_hash");
  const historical = parseTutorEvaluationAuditArtifact(JSON.parse(bytes.toString("utf8")));
  const { evaluation } = historical;
  const originalResult = evaluation.caseResults.find((row) => row.caseId === candidate.caseId &&
    row.caseVersion === candidate.caseVersion && row.runIndex === candidate.runIndex);
  if (historical.corpusId !== corpus.corpusId || historical.corpusVersion !== corpus.corpusVersion ||
      !isDeepStrictEqual(historical.generationSpec, corpus.generationSpec) ||
      evaluation.datasetId !== dataset.id || evaluation.datasetVersion !== dataset.version ||
      evaluation.runsPerCase !== corpus.runsPerCase || !isDeepStrictEqual(evaluation.tutor, corpus.tutor) ||
      evaluation.judge !== null || !evaluation.scoringProvenance || !evaluation.evaluatorVersion ||
      !hasMatchingTutorEvalAuthoredScoring(evaluation, dataset) ||
      originalResult?.rawTutorResponse !== candidate.responseText || originalResult.rawJudgeResult !== null) {
    throw new Error("hint_historical_result_source_mismatch");
  }
  const replay = await runTutorResponseCorpus({
    dataset, corpus, caseIds: [candidate.caseId], scoring: evaluation.scoringProvenance.config,
  });
  const replayResult = replay.evaluation.caseResults[0];
  const before = describeHintBaseline(evaluation, originalResult);
  if (!replayResult || replayResult.rawTutorResponse !== candidate.responseText) {
    throw new Error("hint_baseline_replay_response_mismatch");
  }
  const rerun = describeHintBaseline(replay.evaluation, replayResult);
  return {
    before, rerun,
    replayMatchesHistory: isDeepStrictEqual(before, { ...rerun, runId: before.runId }),
    evaluationSha256: identity.offlineEvaluationSha256,
    responseFingerprint: measurementFingerprint(candidate.responseText),
  };
}

async function readFrozen(review, dataset, measure) {
  const impl = { loadTutorEvalDataset: async () => dataset, loadTutorBaselinePrompt, buildTutorBaselineGenerationSpec,
    assertValidTutorResponseCorpus };
  if (review.frozenReplies.length !== EFFORTS.length) throw new Error("hint_frozen_manifest_size");
  return Promise.all(EFFORTS.map(async (effort) => {
    const identity = review.frozenReplies.find((item) => item.effort === effort);
    const bytes = await readFile(artifactPath(effort, "complete", "corpus"));
    if (!identity || sha256(bytes) !== identity.corpusSha256) throw new Error("hint_frozen_corpus_hash");
    const corpus = JSON.parse(bytes.toString("utf8"));
    const ctx = await prepare(impl, effort);
    validateCorpus(impl, corpus, ctx, effort);
    const candidate = corpus.responses.find((item) => item.caseId === hintSource.caseId);
    if (!candidate || candidate.responseId !== identity.responseId ||
        sha256(candidate.responseText) !== identity.responseSha256) {
      throw new Error("hint_frozen_response_identity");
    }
    return {
      provenance: "recorded_model_counterfactual_replay",
      effort,
      id: candidate.responseId,
      originalSource: { ...hintSource, corpusId: corpus.corpusId, corpusVersion: corpus.corpusVersion },
      ...(measure ? { baselineEvidence: await baselineFor(corpus, dataset, candidate, effort, identity) } : {}),
      text: candidate.responseText,
    };
  }));
}

async function preserveReport(path, report) {
  try {
    await writeNew(path, report);
  } catch (error) {
    if (error.code !== "EEXIST" ||
        await readFile(path, "utf8") !== JSON.stringify(report, null, 2) + "\n") throw error;
  }
}

function buildBeforeAfter(rows, review, cases) {
  const measurementRows = rows.map(({ baselineEvidence, verdict, ...row }) => ({
    ...row,
    split: "design",
    candidate: verdict,
    baseline: null,
    baselineStatus: row.condition === "unknown" ? "unavailable" : "not_comparable",
    baselineReason: row.condition === "unknown"
      ? "The original checkpoint is the closest source to A. Its two teaching criteria require a Judge and have no judgments. A also omits the original authored knownConcepts."
      : "The historical result contains no matching learner history for this contrast.",
    originalBaselineContextOnly: baselineEvidence,
    reference: null,
    referenceReason: "The frozen maintainer review contains a conditional strategy judgment and no per-response, per-condition binary label.",
    change: {
      kind: row.condition === "unknown" ? "coverage_only" : "not_comparable",
      explanation: row.reason,
      countedAsAccuracyChange: false,
    },
  }));
  return {
    schemaVersion: 1,
    kind: "learner-evidence-hint-before-after",
    experimental: true,
    calibrationStatus: "not_calibrated",
    source: hintSource,
    fingerprints: {
      maintainerReview: measurementFingerprint(review),
      contrastInputs: measurementFingerprint(cases),
    },
    review: { id: review.id, version: review.version, judgmentQuote: review.judgmentQuote },
    candidate: {
      rubric: hintRubric,
      decisionIdentity: `${hintRubric.id}@${hintRubric.version}`,
      scoringIdentity: null,
    },
    design: summarizeHintMeasurement(measurementRows),
    heldOut: {
      status: "not_collected",
      reason: "All original replies were available when designing the contrasts. Synthetic rule controls do not supply independent references.",
      ...summarizeHintMeasurement([]),
    },
    conclusion: "insufficient_evidence_of_improvement",
    rows: measurementRows,
  };
}

async function main(args) {
  const measure = args.length === 1 && args[0] === "--before-after";
  const frozen = args.length === 1 && args[0] === "--frozen";
  if (args.length !== 0 && !frozen && !measure) {
    throw new Error("Usage: learner-evidence-hint-pilot.mjs [--frozen|--before-after]");
  }
  const dataset = await loadTutorEvalDataset(hintSource.datasetId, hintSource.datasetVersion);
  const cases = createHintPilot(dataset);
  const review = await readJson(reviewPath);
  if (!Object.entries(hintSource).every(([key, value]) => review.case[key] === value) ||
      !cases.every((item) => item.tutorCase.tutorInput.studentMessage === review.case.learnerQuote)) {
    throw new Error("hint_maintainer_review_source_mismatch");
  }
  const candidates = frozen || measure
    ? await readFrozen(review, dataset, measure)
    : (await readJson(controlsPath)).map(({ id, text }) => ({ id, text, provenance: "author_synthetic" }));
  const rows = candidates.flatMap(({ text, ...source }) => cases.map((pilotCase) => ({
    ...source,
    condition: pilotCase.condition,
    ...evaluateHintFit(pilotCase, text),
  })));
  if (measure) {
    const report = buildBeforeAfter(rows, review, cases);
    await preserveReport(measurementPath, report);
    const { rows: privateRows, ...summary } = report;
    console.log(JSON.stringify({
      ...summary, measurementPath,
      baselineReplaysMatchingHistory: { count: privateRows.filter((row) =>
        row.condition === "unknown" && row.originalBaselineContextOnly.replayMatchesHistory).length, denominator: candidates.length },
    }, null, 2));
    return;
  }
  const result = { experimental: true, rubric: hintRubric, source: hintSource, rows };
  if (frozen) {
    await preserveReport(privateReportPath, result);
    // 保留原回复片段在忽略目录内；终端只输出档位、条件和判定。
    console.log(JSON.stringify({
      experimental: true, rubric: hintRubric, source: hintSource, privateReportPath,
      rows: rows.map(({ effort, condition, verdict }) => ({ effort, condition, verdict })),
    }, null, 2));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error("Hint pilot failed:", error.code ?? error.message);
  process.exitCode = 1;
}
