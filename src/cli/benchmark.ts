import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { formatTutorEvalSummary, writeTutorEvalResult } from "../reporting/index.js";
import { runScriptedBenchmark } from "./scripted-benchmark.js";

export async function main(): Promise<void> {
  const { result, diagnosis } = await runScriptedBenchmark();
  console.log("Synthetic scripted demo | Judge: not configured | Network: disabled");
  for (const locale of diagnosis.locales) {
    console.log(`${locale.locale}: ${locale.responses}/${locale.selected} scripted responses received`);
  }
  if (diagnosis.cases.some(row => row.unresolvedJudgeRubrics.length > 0)) {
    console.log("Score unavailable: required Judge rubrics remain unresolved.");
  }
  console.log(formatTutorEvalSummary(result));
  const directory = resolve(process.cwd(), "artifacts");
  await writeTutorEvalResult(result, resolve(directory, "tutor-eval-v0.2a-result.json"));
  const path = resolve(directory, "tutor-eval-v0.2a-diagnosis.json");
  await writeFile(path, JSON.stringify(diagnosis, null, 2) + "\n", "utf8");
  console.log("Offline run diagnosis:", path);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "TutorEval runner failed.");
  process.exitCode = 1;
}
