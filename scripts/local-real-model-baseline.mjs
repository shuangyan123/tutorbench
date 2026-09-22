import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_ENDPOINT = "http://127.0.0.1:9001/generate";
const DEFAULT_PROVIDER = "local";
const SMOKE_CASE_IDS = [
  "fraction-misconception-001",
  "hint-only-linear-equation-001",
  "fraction-misconception-001-zh-CN",
  "hint-only-linear-equation-001-zh-CN",
];

export class LocalBaselineConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "LocalBaselineConfigurationError";
  }
}

function requiredEnvironment(name, environment) {
  const value = environment[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new LocalBaselineConfigurationError(`${name} is required.`);
  }
  return value;
}

function safePathPart(value) {
  const safe = value.replace(/[^A-Za-z0-9._-]+/gu, "_").replace(/^\.+/u, "");
  if (safe.length === 0) {
    throw new LocalBaselineConfigurationError(
      "TUTORBENCH_BASELINE_ID must contain at least one path-safe character.",
    );
  }
  return safe.slice(0, 120);
}

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "[::1]" ||
    normalized === "::1";
}

export function parseLocalBaselineConfiguration(
  mode,
  environment = process.env,
  cwd = process.cwd(),
) {
  if (mode !== "plan" && mode !== "smoke" && mode !== "full") {
    throw new LocalBaselineConfigurationError(
      "Mode must be plan, smoke, or full.",
    );
  }

  const rawEndpoint = environment.TUTORBENCH_LOCAL_ENDPOINT?.trim() || DEFAULT_ENDPOINT;
  let endpoint;
  try {
    endpoint = new URL(rawEndpoint);
  } catch {
    throw new LocalBaselineConfigurationError(
      "TUTORBENCH_LOCAL_ENDPOINT must be a valid loopback http/https URL.",
    );
  }
  if (
    (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") ||
    endpoint.username.length > 0 ||
    endpoint.password.length > 0 ||
    !isLoopbackHostname(endpoint.hostname)
  ) {
    throw new LocalBaselineConfigurationError(
      "TUTORBENCH_LOCAL_ENDPOINT must be a credential-free loopback http/https URL.",
    );
  }

  const provider = environment.TUTORBENCH_LOCAL_PROVIDER?.trim() || DEFAULT_PROVIDER;
  const model = requiredEnvironment("TUTORBENCH_LOCAL_MODEL", environment);
  const baselineId = safePathPart(requiredEnvironment("TUTORBENCH_BASELINE_ID", environment));
  const modelVersion = environment.TUTORBENCH_LOCAL_MODEL_VERSION?.trim();
  const artifactRoot = resolve(cwd, "artifacts", "real-model");
  const corpusPath = resolve(artifactRoot, `${baselineId}.corpus.json`);
  const reportPath = `${corpusPath}.report.json`;
  const evaluationPath = resolve(artifactRoot, `${baselineId}.evaluation.json`);

  return {
    mode,
    endpoint: endpoint.toString(),
    provider,
    model,
    ...(modelVersion === undefined || modelVersion.length === 0 ? {} : { modelVersion }),
    baselineId,
    corpusPath,
    reportPath,
    evaluationPath,
    smokeCaseIds: SMOKE_CASE_IDS,
  };
}

function runNode(args, cwd) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Command failed with exit code ${result.status ?? "unknown"}: node ${args.join(" ")}`);
  }
}

function collectBaseArgs(configuration) {
  return [
    "dist/src/cli/tutorbench.js",
    "collect-model",
    "--http",
    configuration.endpoint,
    "--provider",
    configuration.provider,
    "--model",
    configuration.model,
    ...(configuration.modelVersion === undefined
      ? []
      : ["--model-version", configuration.modelVersion]),
    "--corpus-id",
    configuration.baselineId,
    "--output",
    configuration.corpusPath,
    "--report",
    configuration.reportPath,
  ];
}

export function buildLocalBaselineCommands(configuration) {
  const collect = collectBaseArgs(configuration);
  if (configuration.mode === "plan") {
    return [
      [
        ...collect,
        ...configuration.smokeCaseIds.flatMap((caseId) => ["--case", caseId]),
        "--dry-run",
      ],
    ];
  }
  if (configuration.mode === "smoke") {
    return [
      [
        ...collect,
        ...configuration.smokeCaseIds.flatMap((caseId) => ["--case", caseId]),
      ],
      [
        "dist/src/cli/tutor-corpus-validate.js",
        "--corpus",
        configuration.corpusPath,
      ],
      [
        "dist/src/cli/tutorbench.js",
        "evaluate",
        "--corpus",
        configuration.corpusPath,
        "--report-locale",
        "en",
        "--output",
        configuration.evaluationPath,
      ],
    ];
  }
  return [
    [
      ...collect,
      "--resume",
      configuration.corpusPath,
    ],
    [
      "dist/src/cli/tutor-corpus-validate.js",
      "--corpus",
      configuration.corpusPath,
      "--full",
    ],
    [
      "dist/src/cli/tutorbench.js",
      "evaluate",
      "--corpus",
      configuration.corpusPath,
      "--full",
      "--report-locale",
      "en",
      "--output",
      configuration.evaluationPath,
    ],
  ];
}

async function requireSmokeCorpus(configuration) {
  if (configuration.mode !== "full") {
    return;
  }
  try {
    await access(configuration.corpusPath);
  } catch {
    throw new LocalBaselineConfigurationError(
      `Full mode requires an existing smoke corpus at ${configuration.corpusPath}. Run baseline:local:smoke first.`,
    );
  }
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  const mode = args[0];
  const configuration = parseLocalBaselineConfiguration(mode, environment);
  await requireSmokeCorpus(configuration);

  console.log("TutorBench local real-model baseline");
  console.log(`Mode: ${configuration.mode}`);
  console.log(`Canonical endpoint: ${configuration.endpoint}`);
  console.log(`Model: ${configuration.provider}/${configuration.model}`);
  console.log(`Baseline id: ${configuration.baselineId}`);
  console.log(`Corpus: ${configuration.corpusPath}`);
  console.log(`Evaluation: ${configuration.evaluationPath}`);
  console.log("Status: preliminary / uncalibrated / not leaderboard eligible");

  for (const command of buildLocalBaselineCommands(configuration)) {
    runNode(command, process.cwd());
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(
      error instanceof LocalBaselineConfigurationError
        ? error.message
        : "TutorBench local real-model baseline failed.",
    );
    process.exitCode = 1;
  }
}
