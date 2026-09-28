import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  buildCaseSystemVNextExpertReviewReferenceCandidate,
  parseCaseSystemVNextExpertReviewAdjudicationSubmission,
  type CaseSystemVNextExpertReviewAdjudicationExport,
  type CaseSystemVNextExpertReviewAdjudicationPacket,
  type CaseSystemVNextExpertReviewEvidence,
} from "../case-system-vnext/index.js";
import {
  nextTutorbenchValue,
  tutorbenchOptionValue,
  TutorbenchCliUsageError,
} from "./tutorbench-common.js";
import { writeTutorCliJson } from "./tutor-case-common.js";
import {
  loadCaseSystemVNextExpertReviewSourceExport,
} from "./case-system-vnext-expert-review-source.js";
import {
  sameCaseSystemVNextExpertReviewJson,
} from "../case-system-vnext/expert-review-canonical.js";

export type CaseSystemVNextExpertReviewReferenceCandidateCliOptions =
  | { readonly help: true }
  | {
      readonly help: false;
      readonly packetDirectory: string;
      readonly evidencePath: string;
      readonly adjudicationDirectory?: string;
      readonly submissionPath?: string;
      readonly outputPath: string;
    };

async function loadJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(process.cwd(), path), "utf8")) as unknown;
}

export function parseCaseSystemVNextExpertReviewReferenceCandidateArgs(
  args: readonly string[],
): CaseSystemVNextExpertReviewReferenceCandidateCliOptions {
  let packetDirectory: string | undefined;
  let evidencePath: string | undefined;
  let adjudicationDirectory: string | undefined;
  let submissionPath: string | undefined;
  let outputPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] ?? "";
    if (argument === "--help" || argument === "-h") return { help: true };
    const take = (option: string): string | undefined => {
      if (argument === option) {
        index += 1;
        return nextTutorbenchValue(args, index - 1, option);
      }
      return tutorbenchOptionValue(argument, option);
    };
    const packet = take("--packet-dir");
    if (packet !== undefined) {
      packetDirectory = resolve(packet);
      continue;
    }
    const evidence = take("--evidence");
    if (evidence !== undefined) {
      evidencePath = resolve(evidence);
      continue;
    }
    const adjudication = take("--adjudication-dir");
    if (adjudication !== undefined) {
      adjudicationDirectory = resolve(adjudication);
      continue;
    }
    const submission = take("--submission");
    if (submission !== undefined) {
      submissionPath = resolve(submission);
      continue;
    }
    const output = take("--output");
    if (output !== undefined) {
      outputPath = resolve(output);
      continue;
    }
    throw new TutorbenchCliUsageError(`Unknown option: ${argument}`);
  }
  if (packetDirectory === undefined) {
    throw new TutorbenchCliUsageError("--packet-dir is required.");
  }
  if (evidencePath === undefined) {
    throw new TutorbenchCliUsageError("--evidence is required.");
  }
  if ((adjudicationDirectory === undefined) !== (submissionPath === undefined)) {
    throw new TutorbenchCliUsageError(
      "--adjudication-dir and --submission must be supplied together.",
    );
  }
  return {
    help: false,
    packetDirectory,
    evidencePath,
    ...(adjudicationDirectory === undefined
      ? {}
      : { adjudicationDirectory, submissionPath: submissionPath! }),
    outputPath: outputPath ?? resolve(
      packetDirectory,
      "expert-review-reference-candidate.json",
    ),
  };
}

export function printCaseSystemVNextExpertReviewReferenceCandidateHelp(): void {
  console.log(`Case System vNext expert-review reference candidate

Usage:
  tutorbench case-system-vnext-expert-review-reference-candidate \\
    --packet-dir <path> --evidence <path> \\
    [--adjudication-dir <path> --submission <path>] [--output <path>]

Replays source packet/evidence lineage before deriving reference candidates.
For all-consensus evidence, no adjudication inputs are required. If disagreement
or packet ambiguity exists, both adjudication inputs are required. Unresolved
or insufficient-evidence tasks block promotion. Eligibility means manual
promotion may be reviewed; this command never promotes or rewrites a formal
reference set.`);
}

export async function runCaseSystemVNextExpertReviewReferenceCandidate(
  options: Extract<
    CaseSystemVNextExpertReviewReferenceCandidateCliOptions,
    { readonly help: false }
  >,
): Promise<void> {
  const exported = await loadCaseSystemVNextExpertReviewSourceExport(options.packetDirectory);
  const evidence = await loadJson(options.evidencePath) as CaseSystemVNextExpertReviewEvidence;
  const requiresAdjudication =
    evidence.disagreementCount > 0 || evidence.packetAmbiguityCount > 0;

  let candidate;
  if (!requiresAdjudication) {
    if (
      options.adjudicationDirectory !== undefined ||
      options.submissionPath !== undefined
    ) {
      throw new Error("Case System vNext expert review lineage is invalid.");
    }
    candidate = buildCaseSystemVNextExpertReviewReferenceCandidate(
      exported,
      evidence,
    );
  } else {
    if (
      options.adjudicationDirectory === undefined ||
      options.submissionPath === undefined
    ) {
      throw new TutorbenchCliUsageError(
        "Adjudication inputs are required when source evidence contains queued tasks.",
      );
    }
    const manifest = await loadJson(
      resolve(options.adjudicationDirectory, "operator-manifest.json"),
    ) as CaseSystemVNextExpertReviewAdjudicationExport["manifest"];
    const packet = await loadJson(
      resolve(options.adjudicationDirectory, "packet.json"),
    ) as CaseSystemVNextExpertReviewAdjudicationPacket;
    const template = await loadJson(
      resolve(options.adjudicationDirectory, "submission-template.json"),
    ) as CaseSystemVNextExpertReviewAdjudicationExport["template"];
    const adjudicationExport: CaseSystemVNextExpertReviewAdjudicationExport = {
      manifest,
      packet,
      template,
    };
    const submission = parseCaseSystemVNextExpertReviewAdjudicationSubmission(
      await loadJson(options.submissionPath),
      packet,
    );
    candidate = buildCaseSystemVNextExpertReviewReferenceCandidate(
      exported,
      evidence,
      { adjudicationExport, submission },
    );
  }

  await writeTutorCliJson(candidate, options.outputPath);
  console.log([
    "Case System vNext expert-review reference candidate",
    `  Candidate-ready tasks: ${candidate.summary.candidateReadyCount}`,
    `  Blocked tasks: ${candidate.summary.blockedCount}`,
    `  Unresolved: ${candidate.summary.unresolvedCount}`,
    `  Insufficient evidence: ${candidate.summary.insufficientEvidenceCount}`,
    `  Promotion gate: ${candidate.promotionGate.status}`,
    `  Source lineage replayed: true`,
    `  Output: ${options.outputPath}`,
    "  Automatic promotion allowed: false",
  ].join("\n"));
}
