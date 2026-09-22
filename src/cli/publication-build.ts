import { resolve } from "node:path";

import {
  buildPublicEvidencePublication,
  type PublicationBuildPaths,
} from "../publication/index.js";
import { PublicEvidencePublicationError } from "../publication/errors.js";

export interface PublicationBuildOptions extends PublicationBuildPaths {
  readonly help: boolean;
}

function nextValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.trim().length === 0 || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value.trim();
}

export function parsePublicationBuildOptions(
  args: readonly string[],
): PublicationBuildOptions {
  const values: {
    corpusPath?: string;
    evaluationPath?: string;
    approvalPath?: string;
    outputDirectory?: string;
  } = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") {
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      return { corpusPath: "", evaluationPath: "", approvalPath: "", outputDirectory: "", help: true };
    }
    const options: readonly [string, keyof PublicationBuildPaths][] = [
      ["--corpus", "corpusPath"],
      ["--evaluation", "evaluationPath"],
      ["--approval", "approvalPath"],
      ["--output-dir", "outputDirectory"],
    ];
    const matched = options.find(([name]) => argument === name);
    if (matched !== undefined) {
      values[matched[1]] = resolve(nextValue(args, index, matched[0]));
      index += 1;
      continue;
    }
    const equals = options.find(([name]) => argument?.startsWith(`${name}=`));
    if (equals !== undefined) {
      values[equals[1]] = resolve((argument ?? "").slice(equals[0].length + 1));
      continue;
    }
    throw new Error(`Unknown publication build option: ${argument}`);
  }
  if (
    values.corpusPath === undefined ||
    values.evaluationPath === undefined ||
    values.approvalPath === undefined ||
    values.outputDirectory === undefined
  ) {
    throw new Error("--corpus, --evaluation, --approval, and --output-dir are required.");
  }
  return { ...values as PublicationBuildPaths, help: false };
}

function printHelp(): void {
  console.log(`Usage: npm run publication:build -- --corpus <path> --evaluation <path> --approval <path> --output-dir <path>

Offline only. No Tutor provider, model, Judge, or network call is made.
The explicit approval manifest is bound to exact source bytes. This command
creates local candidate files only; it does not release or publish to the website,
modify website/dist, commit, push, open a PR, or create a release.

Options:
  --corpus <path>       Frozen TutorResponseCorpus JSON file
  --evaluation <path>   Completed Tutor baseline evaluation artifact JSON file
  --approval <path>     Maintainer approval manifest bound to both source hashes
  --output-dir <path>   New directory for publication.json/models.json/trials.json
  --help                Show this help
`);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parsePublicationBuildOptions(args);
  if (options.help) {
    printHelp();
    return;
  }
  const files = await buildPublicEvidencePublication(options);
  console.log(JSON.stringify({
    publicationId: files.publication.publicationId,
    publicationVersion: files.publication.publicationVersion,
    status: files.publication.status,
    calibrationStatus: files.publication.calibrationStatus,
    publicLeaderboardEligible: files.publication.publicLeaderboardEligible,
    modelCount: files.models.entries.length,
    trialCount: files.trials.entries.length,
    outputDirectory: options.outputDirectory,
    websiteUpdated: false,
  }, null, 2));
}

if (process.argv[1]?.endsWith("publication-build.js")) {
  try {
    await main();
  } catch (error) {
    console.error(
      error instanceof PublicEvidencePublicationError
        ? error.message
        : "Public evidence publication build failed.",
    );
    process.exitCode = 1;
  }
}
