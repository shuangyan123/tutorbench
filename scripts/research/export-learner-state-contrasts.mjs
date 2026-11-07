#!/usr/bin/env node
/**
 * Offline export only. No Tutor provider, Judge provider, network or grading.
 * Build first: npm run build
 * Usage: node scripts/research/export-learner-state-contrasts.mjs [--out <path>]
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { parseTutorScenarioSuiteVNext } from "../../dist/src/contracts/tutor-scenario-vnext-validation.js";
import { buildLearnerEvidenceContrastTutorPackets } from "../../dist/src/experiments/learner-state-contrast.js";

const defaults = {
  suite: new URL("../../scenarios/experimental/prerequisite-aware-instruction-v0.1/suite.json", import.meta.url),
  plan: new URL("../../scenarios/experimental/learner-state-evidence-v0.1/contrast-plan.json", import.meta.url),
  out: "artifacts/research/learner-state-contrasts-v0.1/tutor-visible.json",
};
const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--out" || !args[1])) {
  throw new Error("Usage: node scripts/research/export-learner-state-contrasts.mjs [--out <path>]");
}
const outputPath = args.length === 0 ? defaults.out : args[1];
const [sourceRaw, planRaw] = await Promise.all([
  readFile(defaults.suite, "utf8"), readFile(defaults.plan, "utf8"),
]);
const sourceSuite = parseTutorScenarioSuiteVNext(JSON.parse(sourceRaw));
const packet = buildLearnerEvidenceContrastTutorPackets(JSON.parse(planRaw), sourceSuite);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(packet, null, 2) + "\n", { flag: "wx" });
console.log(`Exported ${packet.cases.length} frozen Tutor-visible inputs to ${outputPath}`);
console.log(`Source-visible SHA256: ${packet.sourceVisibleSha256}`);
console.log("Tutor calls: 0; Judge calls: 0; learner outcomes: not measured");
