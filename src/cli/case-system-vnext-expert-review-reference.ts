import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  buildCaseSystemVNextExpertReviewReferenceCandidate,
  parseCaseSystemVNextExpertReviewResolution,
} from "../case-system-vnext/index.js";
import {
  nextTutorbenchValue,
  tutorbenchOptionValue,
  TutorbenchCliUsageError,
} from "./tutorbench-common.js";
import { writeTutorCliJson } from "./tutor-case-common.js";

export type CaseSystemVNextExpertReviewReferenceCandidateCliOptions =
  | { readonly help: true }
  | {
      readonly help: false;
      readonly resolutionPath: string;
      readonly outputPath: string;
    };

async function loadJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(process.cwd(), path), "utf8")) as unknown;
}

export function parseCaseSystemVNextExpertReviewReferenceCandidateArgs(
  args: readonly string[],
): CaseSystemVNextExpertReviewReferenceCandidateCliOptions {
  let resolutionPath: string | undefined;
  let outputPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] ?? "";
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--resolution") {
      resolutionPath = resolve(nextTutorbenchValue(args, index, "--resolution"));
      index += 1;
      continue;
    }
    const resolutionValue = tutorbenchOptionValue(argument, "--resolution");
    if (resolutionValue !== undefined) {
      resolutionPath = resolve(resolutionValue);
      continue;
    }
    if (argument === "--output") {
      outputPath = resolve(nextTutorbenchValue(args, index, "--output"));
      index += 1;
      continue;
    }
    const outputValue = tutorbenchOptionValue(argument, "--output");
    if (outputValue !== undefined) {
      outputPath = resolve(outputValue);
      continue;
    }
    throw new TutorbenchCliUsageError(`Unknown option: ${argument}`);
  }
  if (resolutionPath === undefined) {
    throw new TutorbenchCliUsageError("--resolution is required.");
  }
  return {
    help: false,
    resolutionPath,
    outputPath: outputPath ?? resolve(
      resolutionPath,
      "..",
      "expert-review-reference-candidate.json",
    ),
  };
}

export function printCaseSystemVNextExpertReviewReferenceCandidateHelp(): void {
  console.log(`Case System vNext expert-review reference candidate

Usage:
  tutorbench case-system-vnext-expert-review-reference-candidate \\
    --resolution <path> [--output <path>]

Validates the resolution artifact, derives reference candidates, and evaluates
the promotion gate. Unresolved or insufficient-evidence tasks block the set.
Eligibility means manual promotion may be reviewed; this command never promotes
or rewrites a formal reference set.`);
}

export async function runCaseSystemVNextExpertReviewReferenceCandidate(
  options: Extract<
    CaseSystemVNextExpertReviewReferenceCandidateCliOptions,
    { readonly help: false }
  >,
): Promise<void> {
  const resolution = parseCaseSystemVNextExpertReviewResolution(
    await loadJson(options.resolutionPath),
  );
  const candidate = buildCaseSystemVNextExpertReviewReferenceCandidate(resolution);
  await writeTutorCliJson(candidate, options.outputPath);
  console.log([
    "Case System vNext expert-review reference candidate",
    `  Candidate-ready tasks: ${candidate.summary.candidateReadyCount}`,
    `  Blocked tasks: ${candidate.summary.blockedCount}`,
    `  Unresolved: ${candidate.summary.unresolvedCount}`,
    `  Insufficient evidence: ${candidate.summary.insufficientEvidenceCount}`,
    `  Promotion gate: ${candidate.promotionGate.status}`,
    `  Output: ${options.outputPath}`,
    "  Automatic promotion allowed: false",
  ].join("\n"));
}
