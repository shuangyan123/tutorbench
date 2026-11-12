#!/usr/bin/env node
/**
 * Five-case real Tutor evidence collection using the existing canonical Host
 * and collect-model CLI. No new provider transport, evaluator, or Judge.
 *
 * plan       0 calls
 * smoke      <=1 paid call with explicit --execute-live
 * complete   <=4 new paid calls, resuming the verified smoke corpus
 * inspect    0 paid calls, offline corpus validation and evaluator (no Judge)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export const DEEPSEEK_TUTOR_FIVE_CASES = Object.freeze([
  "fraction-misconception-001-zh-CN",
  "hint-only-linear-equation-001-zh-CN",
  "science-density-knowledge-001-zh-CN",
  "science-force-transfer-001-zh-CN",
  "science-photosynthesis-concept-001-zh-CN",
]);
const corpusId = "research-deepseek-flash-zh-tutor-5-v0.1";
const caseVersions = new Map([
  ["fraction-misconception-001-zh-CN", "1.2.0"],
  ["hint-only-linear-equation-001-zh-CN", "1.1.0"],
  ["science-density-knowledge-001-zh-CN", "1.1.0"],
  ["science-force-transfer-001-zh-CN", "1.1.0"],
  ["science-photosynthesis-concept-001-zh-CN", "1.1.0"],
]);
const base = resolve(process.cwd(), "artifacts", "real-model");
const corpus = resolve(base, corpusId + ".corpus.json");
const report = resolve(base, corpusId + ".report.json");
const evaluation = resolve(base, corpusId + ".offline-evaluation.json");
const cli = resolve(process.cwd(), "dist", "src", "cli", "tutorbench.js");
const validator = resolve(process.cwd(), "dist", "src", "cli", "tutor-corpus-validate.js");
const endpoint = "http://127.0.0.1:9001/generate";

function run(script, args) {
  execFileSync(process.execPath, [script, ...args], {
    cwd: process.cwd(), env: process.env, encoding: "utf8", stdio: "inherit",
  });
}
function collectArgs(caseIds) {
  return [
    "collect-model",
    "--http", endpoint,
    "--provider", "deepseek",
    "--model", "deepseek-flash",
    "--runs", "1",
    "--corpus-id", corpusId,
    "--output", corpus,
    "--report", report,
    ...caseIds.flatMap(id => ["--case", id]),
  ];
}
function requireLiveAuthorization(args) {
  if (!args.includes("--execute-live")) {
    throw new Error("Live provider calls require explicit --execute-live; plan and inspect make no calls.");
  }
  if (process.env.TUTOR_MODEL !== "deepseek-flash" ||
      process.env.TUTOR_MODEL_BASE_URL !== "https://api.deepseek.com" ||
      process.env.TUTOR_MODEL_DEEPSEEK_THINKING !== "disabled" ||
      !process.env.TUTOR_MODEL_API_KEY ||
      !process.env.CANONICAL_MODEL_HOST_TOKEN) {
    throw new Error("Live DeepSeek configuration missing or different: review the runbook and local environment.");
  }
}
function currentCorpus() {
  if (!existsSync(corpus)) throw new Error("No smoke corpus on disk; run smoke before complete or inspect.");
  const data = JSON.parse(readFileSync(corpus, "utf8"));
  const responses = data.responses;
  if (data.corpusId !== corpusId || data.datasetId !== "tutor-eval-v0.2a" ||
      data.datasetVersion !== "0.2a.6" || data.corpusVersion !== "0.4a.3" ||
      data.tutor?.provider !== "deepseek" || data.tutor?.model !== "deepseek-flash" ||
      data.provenance !== "recorded_model" || data.runsPerCase !== 1 ||
      !Array.isArray(responses) || responses.length === 0 ||
      responses.length > DEEPSEEK_TUTOR_FIVE_CASES.length ||
      new Set(responses.map(r => r.caseId)).size !== responses.length ||
      !responses.every(r => DEEPSEEK_TUTOR_FIVE_CASES.includes(r.caseId) &&
        r.caseVersion === caseVersions.get(r.caseId) && r.runIndex === 1) ||
      !responses.some(r => r.caseId === DEEPSEEK_TUTOR_FIVE_CASES[0])) {
    throw new Error("Corpus is not the expected bounded five-case DeepSeek smoke source.");
  }
  return data;
}

export function main(args = process.argv.slice(2)) {
  const [stage, ...flags] = args;
  if (!["plan", "smoke", "complete", "inspect"].includes(stage) ||
      flags.some(x => x !== "--execute-live") || flags.length > 1 ||
      (stage === "plan" || stage === "inspect") && flags.length > 0) {
    throw new Error("Usage: node scripts/research/deepseek-tutor-five.mjs plan|smoke|complete|inspect [--execute-live]");
  }
  if (!existsSync(cli) || !existsSync(validator)) {
    throw new Error("Built CLI missing: first run npm ci && npm run build (Node 24).");
  }
  console.log("DeepSeek Tutor response pilot v0.1 — never a Judge or public model score.");
  console.log("Cases: " + DEEPSEEK_TUTOR_FIVE_CASES.join(", "));
  console.log("Corpus: " + corpus);
  if (stage === "plan") {
    run(cli, [...collectArgs(DEEPSEEK_TUTOR_FIVE_CASES), "--dry-run"]);
    return;
  }
  if (stage === "smoke") {
    requireLiveAuthorization(flags);
    if (existsSync(corpus)) throw new Error("Smoke artifact exists; do not overwrite or duplicate a paid call.");
    console.log("Provider call hard cap for this stage: 1");
    run(cli, collectArgs(DEEPSEEK_TUTOR_FIVE_CASES.slice(0, 1)));
    // Collection can produce only a report when the provider fails; do not
    // convert provider failures into a fabricated successful corpus.
    if (!existsSync(corpus)) throw new Error("Provider call produced no valid corpus; inspect collection report.");
    const data = currentCorpus();
    if (data.responses.length !== 1) throw new Error("Smoke must contain exactly one successful Tutor response.");
    run(validator, ["--corpus", corpus]);
    return;
  }
  const data = currentCorpus();
  run(validator, ["--corpus", corpus]);
  if (stage === "complete") {
    requireLiveAuthorization(flags);
    if (data.responses.length === DEEPSEEK_TUTOR_FIVE_CASES.length) {
      console.log("All five responses already present; no further paid calls.");
      return;
    }
    // Only the single-response smoke may precede the four-call continuation.
    // A partial prior continuation is NOT silently retried on a later run.
    if (!existsSync(report)) throw new Error("Missing smoke report: refuse to spend more quota.");
    const prior = JSON.parse(readFileSync(report, "utf8"));
    if (data.responses.length !== 1 || prior.requestedCaseCount !== 1 ||
        prior.completedResponseCount !== 1 || prior.failedTutorCallCount !== 0 ||
        prior.executedTutorCallCount !== 1) {
      throw new Error("Continuation already attempted or smoke report inconsistent; no automatic retry permitted.");
    }
    console.log("Maximum NEW provider calls: 4 (one-time continuation; no automatic retries)");
    run(cli, [...collectArgs(DEEPSEEK_TUTOR_FIVE_CASES), "--resume", corpus]);
    const final = currentCorpus();
    run(validator, ["--corpus", corpus]);
    console.log("Frozen real Tutor responses: " + final.responses.length + "/5. Partial remains partial.");
    return;
  }
  console.log("Offline evaluator, no Judge calls. Missing Judge-required observations remain ERROR/unresolved.");
  run(cli, ["evaluate", "--corpus", corpus, "--report-locale", "zh-CN", "--output", evaluation]);
  console.log("Offline evaluation: " + evaluation);
  console.log("No human annotation or Judge calibration; scores cannot be called model performance.");
}

if (process.argv[1]?.endsWith("deepseek-tutor-five.mjs")) {
  try { main(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
