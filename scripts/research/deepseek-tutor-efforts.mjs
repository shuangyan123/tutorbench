#!/usr/bin/env node
/** Bounded low/high/max genuine Tutor responses, NEVER auto-evaluated by a Judge. */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  EFFORTS, CASE_VERSIONS, MAX_OUTPUT_TOKENS, DATASET_ID, DATASET_VERSION, MODEL,
  corpusId, artifactPath, exists, readJson, writeNew, parseOptions,
  requireLive, prepare, validateCorpus, assertRecoverableSmoke,
} from "./deepseek-tutor-efforts-core.mjs";

async function loadRuntime() {
  try {
    const [
      { loadTutorEvalDataset },
      { loadTutorBaselinePrompt, buildTutorBaselineGenerationSpec },
      { collectCanonicalTutorModel },
      { createHttpTutorExecutionHost },
      { parseCanonicalHostSessionToken },
      { assertValidTutorResponseCorpus },
      { runTutorResponseCorpus },
    ] = await Promise.all([
      import("../../dist/src/datasets/index.js"),
      import("../../dist/src/corpus/index.js"),
      import("../../dist/src/collection/index.js"),
      import("../../dist/src/adapters/index.js"),
      import("../../dist/src/transport/canonical-host-session.js"),
      import("../../dist/src/contracts/index.js"),
      import("../../dist/src/runner/index.js"),
    ]);
    return {
      loadTutorEvalDataset, loadTutorBaselinePrompt, buildTutorBaselineGenerationSpec,
      collectCanonicalTutorModel, createHttpTutorExecutionHost,
      parseCanonicalHostSessionToken, assertValidTutorResponseCorpus, runTutorResponseCorpus,
    };
  } catch {
    throw new Error("Build TutorBench first: npm ci && npm run build (Node 24).");
  }
}
async function collect(impl, ctx, effort, stage, selected, resumeCorpus, previousFailedSmoke) {
  const output = artifactPath(effort, stage, "corpus");
  const reportPath = artifactPath(effort, stage, "report");
  const attemptPath = artifactPath(effort, stage, "attempt");
  if (await exists(output) || await exists(reportPath) || await exists(attemptPath)) {
    throw new Error("Stage started or saved already; refuse duplicate paid calls even after interruption.");
  }
  const sessionToken = impl.parseCanonicalHostSessionToken(process.env.CANONICAL_MODEL_HOST_TOKEN);
  // Durable pre-call marker: a killed process must never silently repeat paid requests.
  await writeNew(attemptPath, {
    protocol: "deepseek-thinking-effort-tutor-v0.1",
    stage, effort, plannedCalls: selected.length - (resumeCorpus?.responses.length ?? 0),
    corpusId: corpusId(effort), status: "attempted; not evidence of a successful provider call",
    ...(previousFailedSmoke ? { recoveryOf: "smoke", originalFailure: "execution_transport_error",
      potentialDuplicateProviderCharge: true } : {}),
  });
  const host = impl.createHttpTutorExecutionHost({
    endpoint: "http://127.0.0.1:9001/generate",
    sessionToken, timeoutMs: 270_000,
  });
  const result = await impl.collectCanonicalTutorModel({
    host, dataset: ctx.dataset, selectedCases: selected,
    promptAsset: ctx.promptAsset, generationSpec: ctx.generationSpec,
    tutorDescriptor: ctx.tutorDescriptor, runsPerCase: 1,
    baselineId: corpusId(effort), corpusId: corpusId(effort),
    corpusVersion: ctx.generationSpec.specVersion,
    ...(resumeCorpus ? { resumeCorpus } : {}),
    transport: "http", outputPath: output,
  });
  // Retain failed requests as errors; never manufacture a valid response.
  await writeNew(reportPath, result.report);
  if (result.corpus) {
    validateCorpus(impl, result.corpus, ctx, effort);
    await writeNew(output, result.corpus);
  }
  console.log(JSON.stringify({
    stage, effort, callsAttempted: result.report.executedTutorCallCount,
    completed: result.report.completedResponseCount,
    failed: result.report.failures, corpus: result.corpus ? output : null,
    report: reportPath, judgeCalls: 0, calibrated: false,
  }, null, 2));
  if (!result.corpus || result.report.failedTutorCallCount !== 0) process.exitCode = 1;
}
export async function main(args = process.argv.slice(2)) {
  const { stage, effort, live } = parseOptions(args);
  const impl = await loadRuntime();
  if (stage === "plan") {
    const ctx = await prepare(impl, "high");
    console.log(JSON.stringify({
      model: MODEL, source: DATASET_ID + "@" + DATASET_VERSION,
      mode: "thinking", efforts: EFFORTS, perEffortCases: CASE_VERSIONS.size,
      totalPlannedProviderCalls: EFFORTS.length * CASE_VERSIONS.size,
      firstStageCallsPerEffort: 1, secondStageCallsPerEffort: 4,
      maxOutputTokens: MAX_OUTPUT_TOKENS, actualCalls: 0,
      prompt: ctx.generationSpec.prompt,
      cases: ctx.selectedCases.map(c => ({ id: c.id, version: c.version })),
      calibration: "not_calibrated",
    }, null, 2));
    return;
  }
  const ctx = await prepare(impl, effort);
  const smokeCorpus = artifactPath(effort, "smoke", "corpus");
  const smokeReport = artifactPath(effort, "smoke", "report");
  if (stage === "smoke") {
    requireLive(live);
    console.log("At most one paid " + effort + " request.");
    await collect(impl, ctx, effort, "smoke", ctx.selectedCases.slice(0, 1));
    return;
  }
  const recoveredCorpus = artifactPath(effort, "smoke-retry-1", "corpus");
  const recoveredReport = artifactPath(effort, "smoke-retry-1", "report");
  if (stage === "retry-smoke") {
    requireLive(live);
    if (await exists(smokeCorpus)) {
      throw new Error("Original smoke already contains a response; no retry allowed.");
    }
    if (!await exists(artifactPath(effort, "smoke", "attempt")) ||
        !await exists(smokeReport)) {
      throw new Error("Original failed smoke attempt/report missing; no retry allowed.");
    }
    assertRecoverableSmoke(impl, ctx, effort,
      await readJson(artifactPath(effort, "smoke", "attempt")),
      await readJson(smokeReport));
    // This is a NEW, single, explicitly authorized attempt, with separate
    // immutable .attempt/.report/.corpus paths. Original failure is untouched.
    console.log("Explicitly acknowledged possible duplicate DeepSeek charge: at most ONE new " +
      effort + " request. The original failed smoke remains intact.");
    await collect(impl, ctx, effort, "smoke-retry-1", ctx.selectedCases.slice(0, 1),
      undefined, true);
    return;
  }
  const primaryExists = await exists(smokeCorpus);
  const retryExists = await exists(recoveredCorpus);
  if (primaryExists && retryExists) {
    throw new Error("Multiple successful smokes for same cohort: manual provenance review required.");
  }
  if (!primaryExists && !retryExists) {
    throw new Error("No valid frozen one-case smoke for " + effort);
  }
  const selectedSmokePath = primaryExists ? smokeCorpus : recoveredCorpus;
  const selectedReportPath = primaryExists ? smokeReport : recoveredReport;
  const smoke = await readJson(selectedSmokePath);
  validateCorpus(impl, smoke, ctx, effort);
  if (stage === "complete") {
    requireLive(live);
    const prior = await readJson(selectedReportPath);
    if (smoke.responses.length !== 1 ||
        smoke.responses[0].caseId !== ctx.selectedCases[0].id ||
        prior.completedResponseCount !== 1 ||
        prior.failedTutorCallCount !== 0 ||
        prior.executedTutorCallCount !== 1 ||
        prior.requestedCaseCount !== 1) {
      throw new Error("Smoke evidence not valid; refuse further paid calls.");
    }
    console.log("At most four additional paid " + effort + " requests.");
    await collect(impl, ctx, effort, "complete", ctx.selectedCases, smoke);
    return;
  }
  const complete = artifactPath(effort, "complete", "corpus");
  const source = await readJson(await exists(complete) ? complete : selectedSmokePath);
  validateCorpus(impl, source, ctx, effort);
  const output = artifactPath(effort, "inspect", "offline-evaluation");
  if (await exists(output)) throw new Error("Offline evaluation exists; refuse overwrite.");
  const evaluation = await impl.runTutorResponseCorpus({
    dataset: ctx.dataset, corpus: source, runId: corpusId(effort) + "-offline",
  });
  await writeNew(output, evaluation);
  console.log(JSON.stringify({
    effort, observed: source.responses.length, planned: CASE_VERSIONS.size,
    corpusCoverage: source.coverage, output,
    judgeCalls: 0, calibration: "not_calibrated",
  }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : "Research pilot failed.");
    process.exitCode = 1;
  });
}
