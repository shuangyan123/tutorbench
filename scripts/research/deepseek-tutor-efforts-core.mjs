// Research-only, provider-neutral evidence identities; no HTTP or Judge client.
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { isDeepStrictEqual } from "node:util";

export const EFFORTS = ["low", "high", "max"];
export const CASE_VERSIONS = new Map([
  ["fraction-misconception-001-zh-CN", "1.2.0"],
  ["hint-only-linear-equation-001-zh-CN", "1.1.0"],
  ["science-density-knowledge-001-zh-CN", "1.1.0"],
  ["science-force-transfer-001-zh-CN", "1.1.0"],
  ["science-photosynthesis-concept-001-zh-CN", "1.1.0"],
]);
export const MAX_OUTPUT_TOKENS = 32768;
export const DATASET_ID = "tutor-eval-v0.2a";
export const DATASET_VERSION = "0.2a.6";
export const MODEL = "deepseek-flash";
const artifactDirectory = resolve("artifacts", "real-model");
export function corpusId(effort) {
  return "research-deepseek-flash-zh-tutor-" + effort + "-v0.1";
}
export function artifactPath(effort, stage, name) {
  return join(artifactDirectory, corpusId(effort) + "." + stage + "." + name + ".json");
}
export async function exists(path) {
  try { await access(path); return true; }
  catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
export async function writeNew(path, value) {
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", {
    encoding: "utf8", flag: "wx",
  });
}
export function parseOptions(args) {
  const [stage, ...rest] = args;
  if (!["plan", "smoke", "complete", "inspect"].includes(stage)) {
    throw new Error("Usage: deepseek-tutor-efforts.mjs plan|smoke|complete|inspect [--effort low|high|max] [--execute-live]");
  }
  let effort, live = false;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--effort" && effort === undefined) effort = rest[++i];
    else if (rest[i] === "--execute-live" && !live) live = true;
    else throw new Error("Invalid or duplicate pilot argument.");
  }
  if (stage === "plan" && (effort || live)) throw new Error("plan includes every effort; paid calls forbidden.");
  if (stage !== "plan" && !EFFORTS.includes(effort)) throw new Error("--effort must be low|high|max.");
  if (["plan", "inspect"].includes(stage) && live) throw new Error("Offline stages cannot execute live.");
  return { stage, effort, live };
}
export function requireLive(live) {
  if (!live) throw new Error("Paid model calls require --execute-live.");
  if (process.env.TUTOR_MODEL !== MODEL ||
      process.env.TUTOR_MODEL_BASE_URL !== "https://api.deepseek.com" ||
      process.env.TUTOR_MODEL_DEEPSEEK_THINKING !== "enabled" ||
      process.env.TUTOR_MODEL_REASONING_SPLIT !== "disabled" ||
      !process.env.TUTOR_MODEL_API_KEY ||
      !process.env.CANONICAL_MODEL_HOST_TOKEN) {
    throw new Error("Missing exact DeepSeek model, enabled thinking mode, or local private credentials.");
  }
}
export async function prepare(impl, effort) {
  const [dataset, promptAsset] = await Promise.all([
    impl.loadTutorEvalDataset(DATASET_ID), impl.loadTutorBaselinePrompt(),
  ]);
  if (dataset.id !== DATASET_ID || dataset.version !== DATASET_VERSION) {
    throw new Error("Dataset identity changed; reject before provider calls.");
  }
  const selectedCases = [...CASE_VERSIONS].map(([id, version]) => {
    const c = dataset.cases.find(x => x.id === id);
    if (!c || c.version !== version || c.locale !== "zh-CN") {
      throw new Error("Canonical case version/locale drift: " + id);
    }
    return c;
  });
  const spec = impl.buildTutorBaselineGenerationSpec(promptAsset);
  // Explicitly not the standard 1024-token baseline generation profile.
  const generationSpec = {
    ...spec, specId: "research-deepseek-tutor-effort", specVersion: "0.1.0",
    maxOutputTokens: MAX_OUTPUT_TOKENS, reasoningEffort: effort,
  };
  const tutorDescriptor = {
    provider: "deepseek", model: MODEL, promptId: spec.prompt.id,
    promptVersion: spec.prompt.version, reasoningEffort: effort,
  };
  return { dataset, promptAsset, selectedCases, generationSpec, tutorDescriptor };
}
export function validateCorpus(impl, corpus, ctx, effort) {
  impl.assertValidTutorResponseCorpus({ corpus, dataset: ctx.dataset });
  if (corpus.corpusId !== corpusId(effort) ||
      corpus.corpusVersion !== ctx.generationSpec.specVersion ||
      corpus.datasetId !== DATASET_ID || corpus.datasetVersion !== DATASET_VERSION ||
      corpus.provenance !== "recorded_model" || corpus.runsPerCase !== 1 ||
      !isDeepStrictEqual(corpus.tutor, ctx.tutorDescriptor) ||
      !isDeepStrictEqual(corpus.generationSpec, ctx.generationSpec) ||
      corpus.responses.length < 1 || corpus.responses.length > CASE_VERSIONS.size ||
      !corpus.responses.every(r =>
        CASE_VERSIONS.get(r.caseId) === r.caseVersion &&
        r.runIndex === 1 && r.provenance === "recorded_model") ||
      new Set(corpus.responses.map(r => r.caseId)).size !== corpus.responses.length) {
    throw new Error("Frozen corpus identity, source version, or effort mismatched.");
  }
}
