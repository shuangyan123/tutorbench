import { resolve } from "node:path";

import {
  inspectPublicationSources,
  writeInspectionReport,
} from "../publication/index.js";
import { PublicEvidencePublicationError } from "../publication/errors.js";

export interface PublicationInspectOptions {
  readonly corpusPath: string;
  readonly evaluationPath: string;
  readonly outputPath?: string;
  readonly help: boolean;
}

function nextValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.trim().length === 0 || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value.trim();
}

export function parsePublicationInspectOptions(
  args: readonly string[],
): PublicationInspectOptions {
  let corpusPath: string | undefined;
  let evaluationPath: string | undefined;
  let outputPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") {
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      return { corpusPath: "", evaluationPath: "", help: true };
    }
    if (argument === "--corpus") {
      corpusPath = resolve(nextValue(args, index, "--corpus"));
      index += 1;
    } else if (argument?.startsWith("--corpus=")) {
      corpusPath = resolve(argument.slice("--corpus=".length));
    } else if (argument === "--evaluation") {
      evaluationPath = resolve(nextValue(args, index, "--evaluation"));
      index += 1;
    } else if (argument?.startsWith("--evaluation=")) {
      evaluationPath = resolve(argument.slice("--evaluation=".length));
    } else if (argument === "--output") {
      outputPath = resolve(nextValue(args, index, "--output"));
      index += 1;
    } else if (argument?.startsWith("--output=")) {
      outputPath = resolve(argument.slice("--output=".length));
    } else {
      throw new Error(`Unknown publication inspection option: ${argument}`);
    }
  }
  if (corpusPath === undefined || evaluationPath === undefined) {
    throw new Error("--corpus and --evaluation are required.");
  }
  return {
    corpusPath,
    evaluationPath,
    ...(outputPath === undefined ? {} : { outputPath }),
    help: false,
  };
}

function printHelp(): void {
  console.log(`Usage: npm run publication:inspect -- --corpus <path> --evaluation <path> [options]

Offline only. No Tutor provider, model, Judge, or network call is made.
Inspection writes only a safe review report; it does not build, publish, or
modify the website. A passing report is not approval and is not public evidence.

Options:
  --corpus <path>       Frozen TutorResponseCorpus JSON file
  --evaluation <path>   Completed Tutor baseline evaluation artifact JSON file
  --output <path>       Write the deterministic inspection report
  --help                Show this help
`);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parsePublicationInspectOptions(args);
  if (options.help) {
    printHelp();
    return;
  }
  const report = await inspectPublicationSources({
    corpusPath: options.corpusPath,
    evaluationPath: options.evaluationPath,
  });
  if (options.outputPath !== undefined) {
    await writeInspectionReport(options.outputPath, report);
  }
  console.log(JSON.stringify({
    eligibleForPreliminaryPublication: report.eligibleForPreliminaryPublication,
    approvalRequired: report.approvalRequired,
    blockingIssueCount: report.blockingIssues.length,
    sourceCorpusSha256: report.sourceCorpusSha256,
    sourceEvaluationSha256: report.sourceEvaluationSha256,
    ...(options.outputPath === undefined ? {} : { inspectionReport: options.outputPath }),
  }, null, 2));
  if (!report.eligibleForPreliminaryPublication) {
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("publication-inspect.js")) {
  try {
    await main();
  } catch (error) {
    console.error(
      error instanceof PublicEvidencePublicationError
        ? error.message
        : "Public evidence inspection failed.",
    );
    process.exitCode = 1;
  }
}
