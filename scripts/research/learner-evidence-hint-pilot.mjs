import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadTutorEvalDataset } from "../../dist/src/datasets/index.js";
import { loadTutorBaselinePrompt, buildTutorBaselineGenerationSpec } from "../../dist/src/corpus/index.js";
import { assertValidTutorResponseCorpus } from "../../dist/src/contracts/index.js";
import { createHintPilot, hintSource } from "../../dist/src/research/learner-evidence-hint-scenarios.js";
import { evaluateHintFit, hintRubric } from "../../dist/src/research/learner-evidence-hint-rubric.js";
import { artifactPath, EFFORTS, prepare, validateCorpus, writeNew } from "./deepseek-tutor-efforts-core.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const controlsPath = "scenarios/experimental/learner-evidence-hint-v0.1/responses.json";
const reviewPath = "docs/research/learner-evidence-hint-maintainer-review-v0.1.json";
const privateReportPath = resolve("artifacts/real-model/learner-evidence-hint-fit-v0.1.0.replay.json");

async function readFrozen(review, dataset) {
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
      text: candidate.responseText,
    };
  }));
}

async function main(args) {
  const frozen = args.length === 1 && args[0] === "--frozen";
  if (args.length !== 0 && !frozen) throw new Error("Usage: learner-evidence-hint-pilot.mjs [--frozen]");
  const dataset = await loadTutorEvalDataset(hintSource.datasetId, hintSource.datasetVersion);
  const cases = createHintPilot(dataset);
  const review = await readJson(reviewPath);
  if (!Object.entries(hintSource).every(([key, value]) => review.case[key] === value) ||
      !cases.every((item) => item.tutorCase.tutorInput.studentMessage === review.case.learnerQuote)) {
    throw new Error("hint_maintainer_review_source_mismatch");
  }
  const candidates = frozen
    ? await readFrozen(review, dataset)
    : (await readJson(controlsPath)).map(({ id, text }) => ({ id, text, provenance: "author_synthetic" }));
  const rows = candidates.flatMap(({ text, ...source }) => cases.map((pilotCase) => ({
    ...source,
    condition: pilotCase.condition,
    ...evaluateHintFit(pilotCase, text),
  })));
  const result = { experimental: true, rubric: hintRubric, source: hintSource, rows };
  if (frozen) {
    try {
      await writeNew(privateReportPath, result);
    } catch (error) {
      if (error.code !== "EEXIST" ||
          await readFile(privateReportPath, "utf8") !== JSON.stringify(result, null, 2) + "\n") throw error;
    }
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
