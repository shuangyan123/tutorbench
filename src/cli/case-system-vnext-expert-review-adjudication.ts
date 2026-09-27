import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  buildCaseSystemVNextExpertReviewAdjudicationExport,
  buildCaseSystemVNextExpertReviewResolution,
  parseCaseSystemVNextExpertReviewAdjudicationSubmission,
  reconstructCaseSystemVNextExpertReviewExport,
  type CaseSystemVNextExpertReviewAdjudicationExport,
  type CaseSystemVNextExpertReviewAdjudicationPacket,
  type CaseSystemVNextExpertReviewEvidence,
  type CaseSystemVNextExpertReviewExport,
  type CaseSystemVNextExpertReviewPacket,
} from "../case-system-vnext/index.js";
import {
  nextTutorbenchValue,
  tutorbenchOptionValue,
  TutorbenchCliUsageError,
} from "./tutorbench-common.js";
import { writeTutorCliJson } from "./tutor-case-common.js";

export type CaseSystemVNextExpertReviewAdjudicationCliOptions =
  | { readonly help: true; readonly mode: "export" | "import" }
  | {
      readonly help: false;
      readonly mode: "export";
      readonly packetDirectory: string;
      readonly evidencePath: string;
      readonly adjudicatorId: string;
      readonly outputDirectory: string;
    }
  | {
      readonly help: false;
      readonly mode: "import";
      readonly packetDirectory: string;
      readonly evidencePath: string;
      readonly adjudicationDirectory: string;
      readonly submissionPath: string;
      readonly outputPath: string;
    };

function opaqueId(value: string, option: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(value) || value.includes("@")) {
    throw new TutorbenchCliUsageError(
      `${option} must be an opaque ID without PII or email syntax.`,
    );
  }
  return value;
}

async function loadJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(process.cwd(), path), "utf8")) as unknown;
}

async function writeText(path: string, content: string): Promise<void> {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, content, "utf8");
}


async function loadSourceExport(packetDirectory: string): Promise<CaseSystemVNextExpertReviewExport> {
  const manifest = await loadJson(
    resolve(packetDirectory, "operator-manifest.json"),
  ) as CaseSystemVNextExpertReviewExport["manifest"];
  const packets = await Promise.all([
    loadJson(resolve(packetDirectory, "reviewer-1", "packet.json")),
    loadJson(resolve(packetDirectory, "reviewer-2", "packet.json")),
  ]) as unknown as readonly [
    CaseSystemVNextExpertReviewPacket,
    CaseSystemVNextExpertReviewPacket,
  ];
  return reconstructCaseSystemVNextExpertReviewExport(manifest, packets);
}

export function parseCaseSystemVNextExpertReviewAdjudicationExportArgs(
  args: readonly string[],
): CaseSystemVNextExpertReviewAdjudicationCliOptions {
  let packetDirectory: string | undefined;
  let evidencePath: string | undefined;
  let adjudicatorId: string | undefined;
  let outputDirectory: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] ?? "";
    if (argument === "--help" || argument === "-h") {
      return { help: true, mode: "export" };
    }
    const take = (option: string): string | undefined => {
      if (argument === option) {
        index += 1;
        return nextTutorbenchValue(args, index - 1, option);
      }
      return tutorbenchOptionValue(argument, option);
    };
    const packet = take("--packet-dir");
    if (packet !== undefined) { packetDirectory = resolve(packet); continue; }
    const evidence = take("--evidence");
    if (evidence !== undefined) { evidencePath = resolve(evidence); continue; }
    const adjudicator = take("--adjudicator");
    if (adjudicator !== undefined) {
      adjudicatorId = opaqueId(adjudicator, "--adjudicator");
      continue;
    }
    const output = take("--output-dir");
    if (output !== undefined) { outputDirectory = resolve(output); continue; }
    throw new TutorbenchCliUsageError(`Unknown option: ${argument}`);
  }
  if (packetDirectory === undefined) {
    throw new TutorbenchCliUsageError("--packet-dir is required.");
  }
  if (evidencePath === undefined) {
    throw new TutorbenchCliUsageError("--evidence is required.");
  }
  if (adjudicatorId === undefined) {
    throw new TutorbenchCliUsageError("--adjudicator is required.");
  }
  return {
    help: false,
    mode: "export",
    packetDirectory,
    evidencePath,
    adjudicatorId,
    outputDirectory: outputDirectory ?? resolve(
      packetDirectory,
      "adjudication",
    ),
  };
}

export function parseCaseSystemVNextExpertReviewAdjudicationImportArgs(
  args: readonly string[],
): CaseSystemVNextExpertReviewAdjudicationCliOptions {
  let packetDirectory: string | undefined;
  let evidencePath: string | undefined;
  let adjudicationDirectory: string | undefined;
  let submissionPath: string | undefined;
  let outputPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] ?? "";
    if (argument === "--help" || argument === "-h") {
      return { help: true, mode: "import" };
    }
    const take = (option: string): string | undefined => {
      if (argument === option) {
        index += 1;
        return nextTutorbenchValue(args, index - 1, option);
      }
      return tutorbenchOptionValue(argument, option);
    };
    const packet = take("--packet-dir");
    if (packet !== undefined) { packetDirectory = resolve(packet); continue; }
    const evidence = take("--evidence");
    if (evidence !== undefined) { evidencePath = resolve(evidence); continue; }
    const adjudication = take("--adjudication-dir");
    if (adjudication !== undefined) {
      adjudicationDirectory = resolve(adjudication);
      continue;
    }
    const submission = take("--submission");
    if (submission !== undefined) { submissionPath = resolve(submission); continue; }
    const output = take("--output");
    if (output !== undefined) { outputPath = resolve(output); continue; }
    throw new TutorbenchCliUsageError(`Unknown option: ${argument}`);
  }
  if (packetDirectory === undefined) {
    throw new TutorbenchCliUsageError("--packet-dir is required.");
  }
  if (evidencePath === undefined) {
    throw new TutorbenchCliUsageError("--evidence is required.");
  }
  if (adjudicationDirectory === undefined) {
    throw new TutorbenchCliUsageError("--adjudication-dir is required.");
  }
  if (submissionPath === undefined) {
    throw new TutorbenchCliUsageError("--submission is required.");
  }
  return {
    help: false,
    mode: "import",
    packetDirectory,
    evidencePath,
    adjudicationDirectory,
    submissionPath,
    outputPath: outputPath ?? resolve(
      adjudicationDirectory,
      "expert-review-resolution.json",
    ),
  };
}

export function printCaseSystemVNextExpertReviewAdjudicationHelp(
  mode: "export" | "import",
): void {
  if (mode === "export") {
    console.log(`Case System vNext expert-review adjudication export

Usage:
  tutorbench case-system-vnext-expert-review-adjudication-export \\
    --packet-dir <path> --evidence <path> --adjudicator <opaque-id> \\
    [--output-dir <path>]

Exports only disagreement and packet-ambiguity tasks for an independent third
reviewer. The adjudicator packet does not disclose prior reviewer choices.`);
    return;
  }
  console.log(`Case System vNext expert-review adjudication import

Usage:
  tutorbench case-system-vnext-expert-review-adjudication-import \\
    --packet-dir <path> --evidence <path> --adjudication-dir <path> \\
    --submission <path> [--output <path>]

Strictly validates the adjudication submission against the frozen source
evidence and packet, then writes a resolution artifact. An unclear adjudication
remains unresolved rather than being forced into a final label.`);
}

function instructions(adjudicatorId: string): string {
  return `# Case System vNext - Independent Adjudication

Adjudicator ID: ${adjudicatorId}

For every task, choose exactly one outcome:

- A_BETTER
- B_BETTER
- EQUIVALENT
- NON_DOMINATED
- INSUFFICIENT_EVIDENCE

Set sufficientlyClear to true only when the task packet is clear enough to
support the selected relationship. If sufficientlyClear is false, notes are
required and the task will remain unresolved.

Do not seek or use prior reviewer choices, developer expectations, model/Judge
results, or provider identities.
`;
}

export async function runCaseSystemVNextExpertReviewAdjudicationExport(
  options: Extract<
    CaseSystemVNextExpertReviewAdjudicationCliOptions,
    { readonly help: false; readonly mode: "export" }
  >,
): Promise<void> {
  const exported = await loadSourceExport(options.packetDirectory);
  const evidence = await loadJson(options.evidencePath) as CaseSystemVNextExpertReviewEvidence;
  const adjudication = buildCaseSystemVNextExpertReviewAdjudicationExport(
    exported,
    evidence,
    options.adjudicatorId,
  );
  await Promise.all([
    writeTutorCliJson(
      adjudication.manifest,
      resolve(options.outputDirectory, "operator-manifest.json"),
    ),
    writeTutorCliJson(
      adjudication.packet,
      resolve(options.outputDirectory, "packet.json"),
    ),
    writeTutorCliJson(
      adjudication.template,
      resolve(options.outputDirectory, "submission-template.json"),
    ),
    writeText(
      resolve(options.outputDirectory, "ADJUDICATION_INSTRUCTIONS.md"),
      instructions(options.adjudicatorId),
    ),
  ]);
  console.log([
    "Case System vNext expert-review adjudication export",
    `  Adjudicator: ${options.adjudicatorId}`,
    `  Tasks requiring adjudication: ${adjudication.manifest.tasks.length}`,
    `  Output directory: ${options.outputDirectory}`,
    "  Prior reviewer choices exposed to adjudicator: false",
  ].join("\n"));
}

export async function runCaseSystemVNextExpertReviewAdjudicationImport(
  options: Extract<
    CaseSystemVNextExpertReviewAdjudicationCliOptions,
    { readonly help: false; readonly mode: "import" }
  >,
): Promise<void> {
  const exported = await loadSourceExport(options.packetDirectory);
  const evidence = await loadJson(options.evidencePath) as CaseSystemVNextExpertReviewEvidence;
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
  const resolution = buildCaseSystemVNextExpertReviewResolution(
    exported,
    evidence,
    adjudicationExport,
    submission,
  );
  await writeTutorCliJson(resolution, options.outputPath);
  console.log([
    "Case System vNext expert-review adjudication import",
    `  Reviewer consensus: ${resolution.summary.reviewerConsensusCount}`,
    `  Adjudicated: ${resolution.summary.adjudicatedCount}`,
    `  Unresolved: ${resolution.summary.unresolvedCount}`,
    `  Output: ${options.outputPath}`,
    "  No automatic reference-label promotion is performed.",
  ].join("\n"));
}
