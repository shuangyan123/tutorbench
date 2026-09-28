import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  CASE_SYSTEM_VNEXT_DOMAIN_IDS,
  type CaseSystemVNextDomainId,
} from "../contracts/index.js";
import {
  buildCaseSystemVNextExpertReviewAnalysis,
  buildCaseSystemVNextExpertReviewExport,
  mergeCaseSystemVNextExpertReviewSubmissions,
  parseCaseSystemVNextExpertReviewSubmission,
  type CaseSystemVNextExpertReviewSubmission,
} from "../case-system-vnext/index.js";
import {
  nextTutorbenchValue,
  tutorbenchOptionValue,
  TutorbenchCliUsageError,
} from "./tutorbench-common.js";
import { writeTutorCliJson } from "./tutor-case-common.js";
import {
  loadCaseSystemVNextExpertReviewInputs,
  loadCaseSystemVNextExpertReviewSourceExport,
  selectCaseSystemVNextExpertReviewSuite,
} from "./case-system-vnext-expert-review-source.js";

export { selectCaseSystemVNextExpertReviewSuite } from "./case-system-vnext-expert-review-source.js";

export type CaseSystemVNextExpertReviewCliOptions =
  | { readonly help: true; readonly mode: "export" | "import" }
  | {
      readonly help: false;
      readonly mode: "export";
      readonly reviewerIds: readonly [string, string];
      readonly domainIds: readonly CaseSystemVNextDomainId[];
      readonly outputDirectory: string;
    }
  | {
      readonly help: false;
      readonly mode: "import";
      readonly packetDirectory: string;
      readonly submissionPaths: readonly [string, string];
      readonly outputPath: string;
      readonly analysisOutputPath: string;
    };

function opaqueId(value: string, option: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(value) || value.includes("@")) {
    throw new TutorbenchCliUsageError(
      `${option} must be an opaque ID without PII or email syntax.`,
    );
  }
  return value;
}

export function parseCaseSystemVNextExpertReviewExportArgs(
  args: readonly string[],
): CaseSystemVNextExpertReviewCliOptions {
  const reviewerIds: string[] = [];
  const domainIds: CaseSystemVNextDomainId[] = [];
  let outputDirectory: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] ?? "";
    if (argument === "--help" || argument === "-h") {
      return { help: true, mode: "export" };
    }
    if (argument === "--reviewer") {
      reviewerIds.push(opaqueId(
        nextTutorbenchValue(args, index, "--reviewer"),
        "--reviewer",
      ));
      index += 1;
      continue;
    }
    const reviewerValue = tutorbenchOptionValue(argument, "--reviewer");
    if (reviewerValue !== undefined) {
      reviewerIds.push(opaqueId(reviewerValue, "--reviewer"));
      continue;
    }
    if (argument === "--domain") {
      const value = nextTutorbenchValue(args, index, "--domain");
      if (!CASE_SYSTEM_VNEXT_DOMAIN_IDS.includes(value as CaseSystemVNextDomainId)) {
        throw new TutorbenchCliUsageError(
          `--domain must be a Case System vNext domain ID; received: ${value}`,
        );
      }
      domainIds.push(value as CaseSystemVNextDomainId);
      index += 1;
      continue;
    }
    const domainValue = tutorbenchOptionValue(argument, "--domain");
    if (domainValue !== undefined) {
      if (!CASE_SYSTEM_VNEXT_DOMAIN_IDS.includes(domainValue as CaseSystemVNextDomainId)) {
        throw new TutorbenchCliUsageError(
          `--domain must be a Case System vNext domain ID; received: ${domainValue}`,
        );
      }
      domainIds.push(domainValue as CaseSystemVNextDomainId);
      continue;
    }
    if (argument === "--output-dir") {
      outputDirectory = resolve(nextTutorbenchValue(args, index, "--output-dir"));
      index += 1;
      continue;
    }
    const outputValue = tutorbenchOptionValue(argument, "--output-dir");
    if (outputValue !== undefined) {
      outputDirectory = resolve(outputValue);
      continue;
    }
    throw new TutorbenchCliUsageError(`Unknown option: ${argument}`);
  }
  if (reviewerIds.length !== 2 || new Set(reviewerIds).size !== 2) {
    throw new TutorbenchCliUsageError(
      "Exactly two distinct --reviewer opaque IDs are required.",
    );
  }
  if (new Set(domainIds).size !== domainIds.length) {
    throw new TutorbenchCliUsageError("--domain values must be unique.");
  }
  return {
    help: false,
    mode: "export",
    reviewerIds: [reviewerIds[0]!, reviewerIds[1]!],
    domainIds,
    outputDirectory: outputDirectory ?? resolve(
      process.cwd(),
      "artifacts",
      "case-system-vnext-expert-review",
    ),
  };
}

export function parseCaseSystemVNextExpertReviewImportArgs(
  args: readonly string[],
): CaseSystemVNextExpertReviewCliOptions {
  let packetDirectory: string | undefined;
  let outputPath: string | undefined;
  let analysisOutputPath: string | undefined;
  const submissionPaths: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] ?? "";
    if (argument === "--help" || argument === "-h") {
      return { help: true, mode: "import" };
    }
    if (argument === "--packet-dir") {
      packetDirectory = resolve(nextTutorbenchValue(args, index, "--packet-dir"));
      index += 1;
      continue;
    }
    const packetValue = tutorbenchOptionValue(argument, "--packet-dir");
    if (packetValue !== undefined) {
      packetDirectory = resolve(packetValue);
      continue;
    }
    if (argument === "--submission") {
      submissionPaths.push(resolve(nextTutorbenchValue(args, index, "--submission")));
      index += 1;
      continue;
    }
    const submissionValue = tutorbenchOptionValue(argument, "--submission");
    if (submissionValue !== undefined) {
      submissionPaths.push(resolve(submissionValue));
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
    if (argument === "--analysis-output") {
      analysisOutputPath = resolve(
        nextTutorbenchValue(args, index, "--analysis-output"),
      );
      index += 1;
      continue;
    }
    const analysisOutputValue = tutorbenchOptionValue(argument, "--analysis-output");
    if (analysisOutputValue !== undefined) {
      analysisOutputPath = resolve(analysisOutputValue);
      continue;
    }
    throw new TutorbenchCliUsageError(`Unknown option: ${argument}`);
  }
  if (packetDirectory === undefined) {
    throw new TutorbenchCliUsageError("--packet-dir is required.");
  }
  if (submissionPaths.length !== 2) {
    throw new TutorbenchCliUsageError("Exactly two --submission paths are required.");
  }
  return {
    help: false,
    mode: "import",
    packetDirectory,
    submissionPaths: [submissionPaths[0]!, submissionPaths[1]!],
    outputPath: outputPath ?? resolve(packetDirectory, "expert-review-evidence.json"),
    analysisOutputPath: analysisOutputPath ??
      resolve(packetDirectory, "expert-review-analysis.json"),
  };
}

export function printCaseSystemVNextExpertReviewHelp(
  mode: "export" | "import",
): void {
  if (mode === "export") {
    console.log(`Case System vNext independent expert-review export

Usage:
  tutorbench case-system-vnext-expert-review-export \\
    --reviewer <opaque-id> --reviewer <opaque-id> [--domain <domain-id>]... \
    [--output-dir <path>]

Options:
  --domain <id>          Optional repeatable domain filter. Use one domain per
                         real expert cohort unless reviewers are qualified for
                         every selected domain.

Exports two counterbalanced blind packets plus editable submission templates.
Reviewer packets omit developer expectations, rationale, fixture IDs, live-Judge
results, provider identities, and expected-match diagnostics.`);
    return;
  }
  console.log(`Case System vNext independent expert-review import

Usage:
  tutorbench case-system-vnext-expert-review-import \\
    --packet-dir <path> --submission <path> --submission <path> [--output <path>] \
    [--analysis-output <path>]

Imports exactly two completed submissions, validates packet identity and exact
task coverage, normalizes counterbalanced A/B labels back to underlying
candidates, preserves disagreement or packet ambiguity explicitly, and writes a
separate analysis artifact with descriptive agreement statistics and an
adjudication queue.`);
}

async function loadJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(process.cwd(), path), "utf8")) as unknown;
}

async function writeText(path: string, content: string): Promise<void> {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, content, "utf8");
}

function instructions(reviewerId: string): string {
  return `# Case System vNext - Independent Expert Review

Reviewer ID: ${reviewerId}

For every task, choose exactly one outcome:

- A_BETTER: candidate A is substantively better for the authored task and criteria.
- B_BETTER: candidate B is substantively better for the authored task and criteria.
- EQUIVALENT: the candidates are materially equivalent under the authored criteria.
- NON_DOMINATED: each candidate has defensible advantages and the authored criteria do not justify an overall ordering.
- INSUFFICIENT_EVIDENCE: the packet does not contain enough evidence to support a preference, equivalence, or non-dominance judgment.

Set sufficientlyClear to true only when the packet contains enough clear
information to support your selected relationship. Optional notes should flag
ambiguity, missing context, or construct contamination; do not include personal
identifiers.

Do not seek or use developer expectations, prior reviewer labels, or model/Judge
results. Complete only your own submission template.
`;
}


export async function runCaseSystemVNextExpertReviewExport(
  options: Extract<CaseSystemVNextExpertReviewCliOptions, { readonly help: false; readonly mode: "export" }>,
): Promise<void> {
  const { pilot, registry, suite } = await loadCaseSystemVNextExpertReviewInputs();
  const selectedSuite = selectCaseSystemVNextExpertReviewSuite(
    pilot,
    suite,
    options.domainIds,
  );
  const exported = buildCaseSystemVNextExpertReviewExport(
    pilot,
    selectedSuite,
    registry,
    options.reviewerIds,
  );
  await Promise.all([
    writeTutorCliJson(exported.manifest, resolve(options.outputDirectory, "operator-manifest.json")),
    ...exported.packets.flatMap((packet, index) => {
      const directory = resolve(options.outputDirectory, `reviewer-${index + 1}`);
      return [
        writeTutorCliJson(packet, resolve(directory, "packet.json")),
        writeTutorCliJson(exported.templates[index], resolve(directory, "submission-template.json")),
        writeText(resolve(directory, "REVIEW_INSTRUCTIONS.md"), instructions(packet.reviewerId)),
      ];
    }),
  ]);
  console.log([
    "Case System vNext expert-review export",
    `  Suite: ${exported.manifest.suiteId}@${exported.manifest.suiteVersion}`,
    `  Reviewers: ${exported.manifest.reviewerIds.join(", ")}`,
    `  Domains: ${options.domainIds.length === 0 ? "all" : options.domainIds.join(", ")}`,
    `  Tasks per reviewer: ${exported.manifest.tasks.length}`,
    `  Output directory: ${options.outputDirectory}`,
    "  Human review data present: false",
  ].join("\n"));
}

export async function runCaseSystemVNextExpertReviewImport(
  options: Extract<CaseSystemVNextExpertReviewCliOptions, { readonly help: false; readonly mode: "import" }>,
): Promise<void> {
  const exported = await loadCaseSystemVNextExpertReviewSourceExport(
    options.packetDirectory,
  );
  const packets = exported.packets;
  const rawSubmissions = await Promise.all(options.submissionPaths.map(loadJson));
  const byReviewer = new Map(packets.map((packet) => [packet.reviewerId, packet]));
  const parsed = rawSubmissions.map((raw) => {
    const reviewer = typeof (raw as { reviewerId?: unknown }).reviewerId === "string"
      ? (raw as { reviewerId: string }).reviewerId
      : "";
    const packet = byReviewer.get(reviewer);
    if (packet === undefined) {
      throw new Error("Case System vNext expert review data is invalid.");
    }
    return parseCaseSystemVNextExpertReviewSubmission(raw, packet);
  }) as unknown as readonly [CaseSystemVNextExpertReviewSubmission, CaseSystemVNextExpertReviewSubmission];
  const evidence = mergeCaseSystemVNextExpertReviewSubmissions(exported, parsed);
  const analysis = buildCaseSystemVNextExpertReviewAnalysis(evidence);
  await Promise.all([
    writeTutorCliJson(evidence, options.outputPath),
    writeTutorCliJson(analysis, options.analysisOutputPath),
  ]);
  console.log([
    "Case System vNext expert-review import",
    `  Agreements: ${evidence.agreementCount}`,
    `  Disagreements: ${evidence.disagreementCount}`,
    `  Packet ambiguities: ${evidence.packetAmbiguityCount}`,
    `  Adjudication queue: ${analysis.summary.adjudicationCount}`,
    `  Evidence output: ${options.outputPath}`,
    `  Analysis output: ${options.analysisOutputPath}`,
    "  No automatic reference-label promotion is performed.",
  ].join("\n"));
}
