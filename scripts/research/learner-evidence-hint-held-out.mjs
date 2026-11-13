import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadTutorEvalDataset } from "../../dist/src/datasets/index.js";
import { evaluateHintFit, hintRubric } from "../../dist/src/research/learner-evidence-hint-rubric.js";
import { createHintPilot, hintSource } from "../../dist/src/research/learner-evidence-hint-scenarios.js";
import {
  buildHintReviewPacket, summarizeHintReviewPacket, hintReviewTemplate, validateHintReview,
  replayHintReviewPacket, compareHintRevisions,
} from "../../dist/src/research/learner-evidence-hint-held-out.js";
import { measurementFingerprint } from "../../dist/src/research/measurement-reliability-source.js";
import { writeNew } from "./deepseek-tutor-efforts-core.mjs";

const fixtures = "scenarios/experimental/learner-evidence-hint-v0.1";
const privateDir = "artifacts/real-model";
const sealedReviewPath = `${privateDir}/learner-evidence-hint-held-out-v0.1.0.reference.json`;
const baselinePath = `${privateDir}/learner-evidence-hint-held-out-v0.1.0.baseline.json`;
const templatePath = `${privateDir}/learner-evidence-hint-held-out-v0.1.0.review-template.json`;
const parse = async (path) => JSON.parse(await readFile(path, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function main([command, input, ...rest]) {
  if (rest.length || !["template", "baseline", "freeze-review", "compare"].includes(command) ||
      Boolean(input) !== ["freeze-review", "compare"].includes(command)) {
    throw new Error("Usage: learner-evidence-hint-held-out.mjs template|baseline|freeze-review <submission.json>|compare <local-revision.js>");
  }
  const manifest = await parse(`${fixtures}/baseline.json`);
  const identity = `${hintRubric.id}@${hintRubric.version}`;
  if (identity !== manifest.identity) throw new Error("hint_baseline_identity_mismatch");
  for (const [path, expected] of Object.entries(manifest.lfNormalizedSha256)) {
    if (sha256((await readFile(path, "utf8")).replace(/\r\n/gu, "\n")) !== expected) {
      throw new Error(`hint_baseline_frozen_source_mismatch: ${path}`);
    }
  }
  const cases = createHintPilot(await loadTutorEvalDataset(hintSource.datasetId, hintSource.datasetVersion));
  const responses = await parse(`${fixtures}/held-out-responses.json`);
  const packet = buildHintReviewPacket(cases, responses);
  if (responses.length !== manifest.heldOut.uniqueReplies ||
      packet.tasks.length !== manifest.heldOut.plannedPairJudgments ||
      packet.fingerprint !== manifest.heldOut.packetFingerprint) throw new Error("hint_held_out_packet_drift");
  if (command === "template") {
    const template = JSON.stringify(hintReviewTemplate(packet), null, 2) + "\n";
    await mkdir(resolve(privateDir), { recursive: true });
    try {
      await writeFile(resolve(templatePath), template, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST" || await readFile(resolve(templatePath), "utf8") !== template) throw error;
    }
    console.log(resolve(templatePath));
    return;
  }
  if (command === "freeze-review") {
    const bytes = await readFile(input);
    const source = bytes.toString("utf8");
    const submission = JSON.parse(source.replace(/^\uFEFF/u, ""));
    validateHintReview(packet, submission);
    await writeNew(resolve(sealedReviewPath), { sourceSha256: sha256(source), source });
    console.log(sealedReviewPath);
    return;
  }
  const snapshot = {
    identity, sourceCommit: manifest.sourceCommit, packetFingerprint: packet.fingerprint,
    rows: replayHintReviewPacket(packet, cases, evaluateHintFit),
  };
  const sealedBaseline = { ...snapshot, fingerprint: measurementFingerprint(snapshot) };
  if (command === "baseline") {
    try {
      await writeNew(resolve(baselinePath), sealedBaseline);
    } catch (error) {
      if (error.code !== "EEXIST" || measurementFingerprint(await parse(baselinePath)) !==
          measurementFingerprint(sealedBaseline)) throw error;
    }
    console.log(JSON.stringify({ identity, packetFingerprint: packet.fingerprint,
      units: summarizeHintReviewPacket(packet, cases), baselinePath, comparison: "pending_reference_and_revision" }, null, 2));
    return;
  }
  const captured = await parse(baselinePath);
  if (measurementFingerprint(captured) !== measurementFingerprint(sealedBaseline)) {
    throw new Error("hint_held_out_baseline_replay_drift");
  }
  const sealedReview = await parse(sealedReviewPath);
  if (typeof sealedReview.source !== "string" || sha256(sealedReview.source) !== sealedReview.sourceSha256) {
    throw new Error("hint_held_out_reference_drift");
  }
  const reference = validateHintReview(packet, JSON.parse(sealedReview.source.replace(/^\uFEFF/u, "")));
  // 仅加载操作者明确提供、已构建的本地规则版本。
  const revisionPath = resolve(input);
  const revision = await import(pathToFileURL(revisionPath).href);
  const version = revision.hintRubric?.version;
  if (revision.hintRubric?.id !== hintRubric.id || typeof version !== "string" ||
      !/^\d+\.\d+\.\d+$/u.test(version) || version === hintRubric.version ||
      typeof revision.evaluateHintFit !== "function" || revision.evaluateHintFit === evaluateHintFit) {
    throw new Error("hint_held_out_distinct_revision_required");
  }
  const revised = replayHintReviewPacket(packet, cases, revision.evaluateHintFit);
  const result = {
    experimental: true, packetFingerprint: packet.fingerprint,
    baseline: { identity, sourceCommit: manifest.sourceCommit, fingerprint: captured.fingerprint },
    revision: { identity: `${hintRubric.id}@${version}`, moduleSha256: sha256(await readFile(revisionPath)) },
    reference: { sourceSha256: sealedReview.sourceSha256, fingerprint: measurementFingerprint(reference) },
    units: summarizeHintReviewPacket(packet, cases),
    ...compareHintRevisions(packet, captured.rows, revised, reference),
  };
  const output = `${privateDir}/learner-evidence-hint-held-out-v${version}.comparison.json`;
  await writeNew(resolve(output), result);
  console.log(output);
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error("Held-out hint measurement failed:", error.code ?? error.message);
  process.exitCode = 1;
}
