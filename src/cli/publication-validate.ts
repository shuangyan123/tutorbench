import { resolve } from "node:path";

import {
  validatePublicEvidencePublicationDirectory,
} from "../publication/index.js";
import { PublicEvidencePublicationError } from "../publication/errors.js";

interface PublicationValidateOptions {
  readonly publicationPath: string;
  readonly modelsPath: string;
  readonly trialsPath: string;
  readonly help: boolean;
}

function nextValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.trim().length === 0 || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value.trim();
}

export function parsePublicationValidateOptions(
  args: readonly string[],
): PublicationValidateOptions {
  let publicationPath: string | undefined;
  let modelsPath: string | undefined;
  let trialsPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") {
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      return { publicationPath: "", modelsPath: "", trialsPath: "", help: true };
    }
    if (argument === "--publication") {
      publicationPath = resolve(nextValue(args, index, "--publication"));
      index += 1;
    } else if (argument?.startsWith("--publication=")) {
      publicationPath = resolve(argument.slice("--publication=".length));
    } else if (argument === "--models") {
      modelsPath = resolve(nextValue(args, index, "--models"));
      index += 1;
    } else if (argument?.startsWith("--models=")) {
      modelsPath = resolve(argument.slice("--models=".length));
    } else if (argument === "--trials") {
      trialsPath = resolve(nextValue(args, index, "--trials"));
      index += 1;
    } else if (argument?.startsWith("--trials=")) {
      trialsPath = resolve(argument.slice("--trials=".length));
    } else {
      throw new Error(`Unknown publication validation option: ${argument}`);
    }
  }
  if (publicationPath === undefined || modelsPath === undefined || trialsPath === undefined) {
    throw new Error("--publication, --models, and --trials are required.");
  }
  return { publicationPath, modelsPath, trialsPath, help: false };
}

function printHelp(): void {
  console.log(`Usage: npm run publication:validate -- --publication <path> --models <path> --trials <path>

Offline only. No source corpus, provider, model, Judge, or network call is
needed. This validates an already-built candidate bundle and never changes the
website, repository, or source artifacts.

Options:
  --publication <path>  publication.json
  --models <path>       models.json
  --trials <path>       trials.json
  --help                Show this help
`);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parsePublicationValidateOptions(args);
  if (options.help) {
    printHelp();
    return;
  }
  const files = await validatePublicEvidencePublicationDirectory(options);
  console.log(JSON.stringify({
    valid: true,
    publicationId: files.publication.publicationId,
    publicationVersion: files.publication.publicationVersion,
    modelCount: files.models.entries.length,
    trialCount: files.trials.entries.length,
    websiteUpdated: false,
  }, null, 2));
}

if (process.argv[1]?.endsWith("publication-validate.js")) {
  try {
    await main();
  } catch (error) {
    console.error(
      error instanceof PublicEvidencePublicationError
        ? error.message
        : "Public evidence publication validation failed.",
    );
    process.exitCode = 1;
  }
}
