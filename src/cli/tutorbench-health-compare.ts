import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { assertValidTutorEvalRunResult, parseTutorHealthReport, parseTutorScenarioSuiteVNext } from "../contracts/index.js";
import { compareTutorHealthRuns, formatTutorHealthComparison, writeTutorHealthComparison, type TutorHealthComparisonInput } from "../reporting/tutor-health-comparison.js";
import { verifyTutorHealthRunManifest } from "../reporting/tutor-health-run-manifest.js";
import { nextTutorbenchValue, tutorbenchOptionValue, TutorbenchCliUsageError } from "./tutorbench-common.js";

export type TutorHealthCompareCliOptions = { readonly help: true } | {
  readonly help: false;
  readonly baseline: string;
  readonly candidate: string;
  readonly baselineSuite: string;
  readonly candidateSuite: string;
  readonly output: string;
};

export function parseTutorHealthCompareArgs(args: readonly string[]): TutorHealthCompareCliOptions {
  if (args.includes("--help") || args.includes("-h")) return { help: true };
  const values = new Map<string, string>();
  const flags = ["--baseline", "--candidate", "--baseline-suite", "--candidate-suite", "--output"];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    const flag = flags.find((item) => argument === item || argument.startsWith(`${item}=`));
    if (flag === undefined) throw new TutorbenchCliUsageError("Unknown health-compare option.");
    if (values.has(flag)) throw new TutorbenchCliUsageError(`${flag} must be supplied once.`);
    const value = tutorbenchOptionValue(argument, flag) ?? nextTutorbenchValue(args, index++, flag);
    values.set(flag, value);
  }
  for (const flag of flags) if (!values.has(flag)) throw new TutorbenchCliUsageError(`${flag} is required.`);
  return { help: false, baseline: values.get("--baseline")!, candidate: values.get("--candidate")!,
    baselineSuite: values.get("--baseline-suite")!, candidateSuite: values.get("--candidate-suite")!, output: values.get("--output")! };
}

export function printTutorHealthCompareHelp(): void {
  console.log(`Usage: tutorbench health-compare --baseline <directory> --candidate <directory> --baseline-suite <suite.json> --candidate-suite <suite.json> --output <comparison.json>

Read evaluation.json and health-report.json from each source directory, validate
both preserved suites and evaluation identities, then compare authored Findings.
No Tutor or Judge calls. Output must be a new file; source artifacts are read-only.
Both suite paths may name the same frozen suite. --flag=value is also supported.
If pilot-run-manifest.json is present, verify it against each supplied suite and
the exact source JSON bytes. Historical sources without a manifest remain supported.
Exit codes: 0 = comparable (including new/persistent Findings); 2 = unresolved
evidence; 1 = incompatible sources, invalid inputs, or I/O failure.
This command does not impose a regression threshold or release gate.`);
}

async function readJson(path: string): Promise<{ value: unknown; bytes: string }> {
  try {
    const raw = await readFile(path);
    const bytes = raw.toString("utf8");
    // 拒绝有损 UTF-8 解码，保证 manifest 核验的是磁盘上的精确字节。
    if (!raw.equals(Buffer.from(bytes, "utf8"))) throw new Error("invalid_utf8");
    return { value: JSON.parse(bytes) as unknown, bytes };
  } catch {
    // 解析错误不输出私有文件内容或路径。
    throw new TutorbenchCliUsageError("Unable to read a health-compare source JSON artifact.");
  }
}

async function readSource(directory: string, suitePath: string): Promise<TutorHealthComparisonInput> {
  const [suite, evaluation, report] = await Promise.all([
    readJson(suitePath), readJson(join(directory, "evaluation.json")), readJson(join(directory, "health-report.json")),
  ]);
  const parsedSuite = parseTutorScenarioSuiteVNext(suite.value);
  assertValidTutorEvalRunResult(evaluation.value);
  let manifest: string | undefined;
  try {
    manifest = await readFile(join(directory, "pilot-run-manifest.json"), "utf8");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw new TutorbenchCliUsageError("Unable to read health run manifest.");
    }
  }
  if (manifest !== undefined) {
    let value: unknown;
    try { value = JSON.parse(manifest); } catch {
      throw new TutorbenchCliUsageError("Invalid health run manifest JSON.");
    }
    verifyTutorHealthRunManifest(value, { suite: parsedSuite, evaluationJson: evaluation.bytes, reportJson: report.bytes });
  }
  return { suite: parsedSuite, evaluation: evaluation.value, report: parseTutorHealthReport(report.value) };
}

export async function runTutorHealthCompareCli(options: Extract<TutorHealthCompareCliOptions, { readonly help: false }>): Promise<number> {
  const [baseline, candidate] = await Promise.all([
    readSource(options.baseline, options.baselineSuite), readSource(options.candidate, options.candidateSuite),
  ]);
  const comparison = compareTutorHealthRuns({ baseline, candidate });
  try {
    await writeTutorHealthComparison(comparison, options.output);
  } catch {
    throw new TutorbenchCliUsageError("Unable to write comparison; --output must name a new writable file.");
  }
  console.log(formatTutorHealthComparison(comparison));
  return comparison.status === "comparable" ? 0 : 2;
}
