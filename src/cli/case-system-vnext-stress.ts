import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  parseCaseSystemVNextPilot,
  parseCaseSystemVNextStrategyProfileRegistry,
  type CaseSystemVNextStressFixtureSuite,
} from "../contracts/index.js";
import {
  buildCaseSystemVNextEvaluatorStressPlan,
  runCaseSystemVNextEvaluatorStress,
} from "../case-system-vnext/index.js";
import {
  createDeepSeekCaseSystemVNextStressJudge,
  loadCaseSystemVNextStressJudgePrompt,
  readDeepSeekJudgeEnvironment,
} from "../providers/deepseek/index.js";
import {
  nextTutorbenchValue,
  positiveTutorbenchInteger,
  tutorbenchOptionValue,
  TutorbenchCliUsageError,
} from "./tutorbench-common.js";
import { writeTutorCliJson } from "./tutor-case-common.js";

export interface CaseSystemVNextStressCliOptions {
  readonly judgeDeepSeek: boolean;
  readonly runsPerFixture: number;
  readonly fixtureIds: readonly string[];
  readonly outputPath?: string;
  readonly help: boolean;
}

export function parseCaseSystemVNextStressArgs(
  args: readonly string[],
): CaseSystemVNextStressCliOptions {
  let judgeDeepSeek = false;
  let runsPerFixture = 1;
  const fixtureIds: string[] = [];
  let outputPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] ?? "";
    if (argument === "--help" || argument === "-h") {
      return { judgeDeepSeek: false, runsPerFixture, fixtureIds, help: true };
    }
    if (argument === "--judge-deepseek") {
      judgeDeepSeek = true;
      continue;
    }
    if (argument === "--runs") {
      runsPerFixture = positiveTutorbenchInteger(
        nextTutorbenchValue(args, index, "--runs"),
        "--runs",
      );
      index += 1;
      continue;
    }
    const runsValue = tutorbenchOptionValue(argument, "--runs");
    if (runsValue !== undefined) {
      runsPerFixture = positiveTutorbenchInteger(runsValue, "--runs");
      continue;
    }
    if (argument === "--fixture") {
      fixtureIds.push(nextTutorbenchValue(args, index, "--fixture"));
      index += 1;
      continue;
    }
    const fixtureValue = tutorbenchOptionValue(argument, "--fixture");
    if (fixtureValue !== undefined) {
      fixtureIds.push(fixtureValue);
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

  if (!judgeDeepSeek) {
    throw new TutorbenchCliUsageError(
      "--judge-deepseek is required; live Case System vNext stress is an explicit paid opt-in.",
    );
  }
  if (runsPerFixture > 20) {
    throw new TutorbenchCliUsageError("--runs must be between 1 and 20.");
  }

  return {
    judgeDeepSeek,
    runsPerFixture,
    fixtureIds,
    ...(outputPath === undefined ? {} : { outputPath }),
    help: false,
  };
}

export function printCaseSystemVNextStressHelp(): void {
  console.log(`Usage: tutorbench case-system-vnext-stress --judge-deepseek [options]

Runs the Case System vNext blind A/B + B/A evaluator stress suite against the
configured DeepSeek Judge. This is live/paid diagnostic evidence and is not
human calibration or a Judge ranking.

For DeepSeek V4.1 Flash, set:
  DEEPSEEK_JUDGE_MODEL=deepseek-flash
  DEEPSEEK_API_KEY=<key>

Options:
  --judge-deepseek      Required explicit live/paid opt-in
  --runs <n>            Repetitions per fixture (default: 1; use 3 for repeated stress)
  --fixture <id>        Run only this fixture; repeat to select multiple fixtures
  --output <path>       Write JSON artifact
  --help                Show this help
`);
}

async function loadJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(process.cwd(), path), "utf8")) as unknown;
}

export async function runCaseSystemVNextStressCli(
  options: CaseSystemVNextStressCliOptions,
): Promise<void> {
  if (options.help || !options.judgeDeepSeek) {
    throw new TutorbenchCliUsageError(
      "--judge-deepseek is required; use --help for command usage.",
    );
  }

  const environment = readDeepSeekJudgeEnvironment();
  if (!environment.apiKeyConfigured) {
    throw new TutorbenchCliUsageError(
      "DEEPSEEK_API_KEY is required for live Case System vNext stress.",
    );
  }
  if (environment.model !== "deepseek-flash") {
    throw new TutorbenchCliUsageError(
      "Set DEEPSEEK_JUDGE_MODEL=deepseek-flash to run the DeepSeek V4.1 Flash stress test.",
    );
  }

  const pilot = parseCaseSystemVNextPilot(
    await loadJson("scenarios/case-system-vnext/pilot-archetypes.json"),
  );
  const registry = parseCaseSystemVNextStrategyProfileRegistry(
    await loadJson("scenarios/case-system-vnext/task-strategy-profiles.json"),
  );
  const suite = await loadJson(
    "scenarios/case-system-vnext/evaluator-stress-fixtures.json",
  ) as CaseSystemVNextStressFixtureSuite;

  const selectedFixtureIds = new Set(options.fixtureIds);
  const selectedSuite = options.fixtureIds.length === 0
    ? suite
    : {
        ...suite,
        fixtures: suite.fixtures.filter((fixture) => selectedFixtureIds.has(fixture.id)),
      };
  if (
    options.fixtureIds.length > 0 &&
    (selectedSuite.fixtures.length !== selectedFixtureIds.size ||
      new Set(options.fixtureIds).size !== options.fixtureIds.length)
  ) {
    throw new TutorbenchCliUsageError(
      "--fixture must name distinct fixture IDs from evaluator-stress-fixtures.json.",
    );
  }

  const plan = buildCaseSystemVNextEvaluatorStressPlan(
    pilot,
    selectedSuite,
    registry,
    options.runsPerFixture,
  );
  const prompt = await loadCaseSystemVNextStressJudgePrompt();
  const liveJudge = createDeepSeekCaseSystemVNextStressJudge({
    model: environment.model,
    prompt,
    thinkingMode: environment.thinkingMode,
    ...(environment.reasoningEffort === undefined
      ? {}
      : { reasoningEffort: environment.reasoningEffort }),
    maxOutputTokens: environment.maxOutputTokens,
    ...(environment.temperature === undefined
      ? {}
      : { temperature: environment.temperature }),
    timeoutMs: environment.timeoutMs,
    maxAttempts: environment.maxAttempts,
    requireReasoningSeparation: true,
  });

  console.log([
    "Case System vNext evaluator stress",
    "",
    "Mode: live",
    "Provider: deepseek",
    `Model: ${liveJudge.descriptor.model}`,
    `Fixtures: ${plan.fixtures.length}`,
    `Runs per fixture: ${plan.runsPerFixture}`,
    `Planned Judge calls: ${plan.plannedJudgmentCount}`,
    "Calibration: uncalibrated",
    "",
  ].join("\n"));

  const report = await runCaseSystemVNextEvaluatorStress(plan, liveJudge.judge);
  const artifact = {
    kind: "CaseSystemVNextLiveJudgeStressArtifact",
    provider: liveJudge.descriptor.provider,
    model: liveJudge.descriptor.model,
    judge: liveJudge.descriptor,
    report,
  };

  const outputPath = options.outputPath ?? resolve(
    process.cwd(),
    "artifacts",
    "case-system-vnext-deepseek-v41-flash-stress.json",
  );
  await writeTutorCliJson(artifact, outputPath);

  console.log([
    `Observed Judge calls: ${report.observedJudgmentCount}`,
    `Comparable repetitions: ${report.overall.comparableCount}`,
    `Developer-expectation match: ${report.overall.expectedMatchShare === null
      ? "n/a"
      : report.overall.expectedMatchShare.toFixed(3)}`,
    `Order-sensitive: ${report.overall.orderSensitiveCount}`,
    `Inconsistent: ${report.overall.inconsistentCount}`,
    `Equivalent: ${report.overall.equivalentCount}`,
    `Non-dominated: ${report.overall.nonDominatedCount}`,
    `Insufficient evidence: ${report.overall.insufficientEvidenceCount}`,
    `Incomplete evidence: ${report.overall.incompleteCount}`,
    `OK judgments: ${report.overall.okJudgmentCount}`,
    `Unavailable judgments: ${report.overall.unavailableJudgmentCount}`,
    `Invalid judgments: ${report.overall.invalidJudgmentCount}`,
    "No evaluator-quality winner or calibration claim is inferred.",
    `JSON report: ${outputPath}`,
  ].join("\n"));

  if (report.overall.incompleteCount > 0) {
    process.exitCode = 1;
  }
}
