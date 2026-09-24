import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { createHttpTutor, DEFAULT_HTTP_TUTOR_TIMEOUT_MS } from "../adapters/http-tutor.js";
import {
  loadTutorScenarioSuiteVNext,
  PRODUCTIVE_STRUGGLE_INTERVENTION_SUITE_ID,
} from "../datasets/real-world.js";
import {
  formatTutorHealthReport,
  writeTutorHealthReport,
} from "../reporting/index.js";
import { runTutorHealthEvaluation } from "../runner/tutor-health-runner.js";
import { writeTutorCliJson } from "./tutor-case-common.js";
import { createJudgeIfRequested } from "./tutorbench-evaluate.js";
import {
  assertSingleJudgeProviderSelection,
  nextTutorbenchValue,
  positiveTutorbenchInteger,
  tutorbenchOptionValue,
  TutorbenchCliUsageError,
} from "./tutorbench-common.js";

export type TutorHealthCliOptions =
  | { readonly help: true }
  | {
      readonly help: false;
      readonly endpoint: string;
      readonly suiteId: typeof PRODUCTIVE_STRUGGLE_INTERVENTION_SUITE_ID;
      readonly runsPerCase: number;
      readonly timeoutMs: number;
      readonly outputDirectory: string;
      readonly tutorProvider: string;
      readonly tutorModel: string;
      readonly promptVersion: string;
      readonly openAIJudge: boolean;
      readonly deepSeekJudge: boolean;
      readonly chatCompletionsJudge: boolean;
    };

function requiredTutorbenchValue(
  value: string | undefined,
  option: string,
): string {
  if (value === undefined || value.trim().length === 0) {
    throw new TutorbenchCliUsageError(`${option} requires a value.`);
  }
  return value.trim();
}

export function parseTutorHealthCliOptions(
  args: readonly string[],
): TutorHealthCliOptions {
  let endpoint: string | undefined;
  let suiteId: typeof PRODUCTIVE_STRUGGLE_INTERVENTION_SUITE_ID =
    PRODUCTIVE_STRUGGLE_INTERVENTION_SUITE_ID;
  let runsPerCase = 1;
  let timeoutMs: number = DEFAULT_HTTP_TUTOR_TIMEOUT_MS;
  let outputDirectory = resolve(process.cwd(), "artifacts", "tutor-health");
  let tutorProvider: string | undefined;
  let tutorModel: string | undefined;
  let promptVersion: string | undefined;
  let openAIJudge = false;
  let deepSeekJudge = false;
  let chatCompletionsJudge = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      return { help: true };
    }
    if (argument === "--judge-openai") {
      openAIJudge = true;
      continue;
    }
    if (argument === "--judge-deepseek") {
      deepSeekJudge = true;
      continue;
    }
    if (argument === "--judge-chat-completions") {
      chatCompletionsJudge = true;
      continue;
    }

    const readOption = (option: string): string | undefined => {
      if (argument === option) {
        const value = nextTutorbenchValue(args, index, option);
        index += 1;
        return value;
      }
      return tutorbenchOptionValue(argument ?? "", option);
    };

    const httpValue = readOption("--http");
    if (httpValue !== undefined) {
      endpoint = httpValue;
      continue;
    }
    const suiteValue = readOption("--suite");
    if (suiteValue !== undefined) {
      if (suiteValue !== PRODUCTIVE_STRUGGLE_INTERVENTION_SUITE_ID) {
        throw new TutorbenchCliUsageError(
          `Unsupported --suite: ${suiteValue}. Supported suite: ${PRODUCTIVE_STRUGGLE_INTERVENTION_SUITE_ID}.`,
        );
      }
      suiteId = suiteValue;
      continue;
    }
    const runsValue = readOption("--runs");
    if (runsValue !== undefined) {
      runsPerCase = positiveTutorbenchInteger(runsValue, "--runs");
      continue;
    }
    const timeoutValue = readOption("--timeout-ms");
    if (timeoutValue !== undefined) {
      timeoutMs = positiveTutorbenchInteger(timeoutValue, "--timeout-ms");
      continue;
    }
    const outputValue = readOption("--output");
    if (outputValue !== undefined) {
      outputDirectory = resolve(outputValue);
      continue;
    }
    const providerValue = readOption("--tutor-provider");
    if (providerValue !== undefined) {
      tutorProvider = requiredTutorbenchValue(providerValue, "--tutor-provider");
      continue;
    }
    const modelValue = readOption("--tutor-model");
    if (modelValue !== undefined) {
      tutorModel = requiredTutorbenchValue(modelValue, "--tutor-model");
      continue;
    }
    const promptVersionValue = readOption("--prompt-version");
    if (promptVersionValue !== undefined) {
      promptVersion = requiredTutorbenchValue(promptVersionValue, "--prompt-version");
      continue;
    }
    throw new TutorbenchCliUsageError(`Unknown option: ${argument ?? ""}`);
  }

  if (endpoint === undefined) {
    throw new TutorbenchCliUsageError("--http requires a value.");
  }
  if (tutorProvider === undefined) {
    throw new TutorbenchCliUsageError("--tutor-provider requires a value.");
  }
  if (tutorModel === undefined) {
    throw new TutorbenchCliUsageError("--tutor-model requires a value.");
  }
  if (promptVersion === undefined) {
    throw new TutorbenchCliUsageError("--prompt-version requires a value.");
  }
  assertSingleJudgeProviderSelection(
    openAIJudge,
    deepSeekJudge,
    chatCompletionsJudge,
  );

  return {
    help: false,
    endpoint,
    suiteId,
    runsPerCase,
    timeoutMs,
    outputDirectory,
    tutorProvider,
    tutorModel,
    promptVersion,
    openAIJudge,
    deepSeekJudge,
    chatCompletionsJudge,
  };
}

export function printTutorHealthHelp(): void {
  console.log(`Usage: tutorbench health --http <url> --tutor-provider <id> --tutor-model <id> --prompt-version <id> [options]

Evaluate an external HTTP Tutor with the registered Scenario vNext suite.

Options:
  --http <url>             POST TutorTurnInput JSON to this http(s) endpoint (required)
  --suite <id>             Scenario suite (default: ${PRODUCTIVE_STRUGGLE_INTERVENTION_SUITE_ID})
  --runs <n>               Run each evaluation case n times (default: 1)
  --timeout-ms <n>         HTTP Tutor request timeout in milliseconds (default: ${DEFAULT_HTTP_TUTOR_TIMEOUT_MS})
  --output <directory>     Write evaluation.json and Health Report artifacts here
  --tutor-provider <id>    Tutor provider provenance (required)
  --tutor-model <id>       Tutor model provenance (required)
  --prompt-version <id>    Tutor prompt/version provenance (required)
  --judge-openai           Opt in to the existing OpenAI Judge provider
  --judge-deepseek         Opt in to the existing DeepSeek Judge provider
  --judge-chat-completions Opt in to the configured Chat Completions Judge
  --help                   Show this help

Without a Judge, Judge-owned checks remain unresolved and the command marks the result as incomplete evaluation evidence. Exit codes: 0 means the Release Gate passed with a Judge; 1 means a gate failure, HTTP Tutor failure, or command configuration error; 2 means evidence remains unresolved or no Judge was selected.`);
}

export async function runTutorHealthCli(
  options: Extract<TutorHealthCliOptions, { readonly help: false }>,
): Promise<number> {
  const suite = await loadTutorScenarioSuiteVNext(options.suiteId);
  const tutor = createHttpTutor({
    id: "http-tutor",
    endpoint: options.endpoint,
    timeoutMs: options.timeoutMs,
  });
  const judge = await createJudgeIfRequested(
    options.openAIJudge,
    options.deepSeekJudge,
    options.chatCompletionsJudge,
  );
  const { evaluation, report } = await runTutorHealthEvaluation({
    suite,
    tutor,
    tutorDescriptor: {
      provider: options.tutorProvider,
      model: options.tutorModel,
      promptVersion: options.promptVersion,
    },
    ...(judge === undefined ? {} : { judge }),
    runsPerCase: options.runsPerCase,
  });

  const evaluationPath = join(options.outputDirectory, "evaluation.json");
  const reportJsonPath = join(options.outputDirectory, "health-report.json");
  const reportTextPath = join(options.outputDirectory, "health-report.txt");
  const reportText = formatTutorHealthReport(report);
  await writeTutorCliJson(evaluation, evaluationPath);
  await writeTutorHealthReport(report, reportJsonPath);
  await writeFile(reportTextPath, `${reportText}\n`, "utf8");

  console.log(reportText);
  if (judge === undefined) {
    console.log(
      "\nEvidence status: INCOMPLETE — no Judge selected; Judge-owned checks remain unresolved. This is not complete evaluation evidence.",
    );
  } else if (report.releaseGate === "UNRESOLVED") {
    console.log("\nEvidence status: INCOMPLETE — unresolved evaluation evidence remains.");
  }
  console.log(`\nTutorEval result: ${evaluationPath}`);
  console.log(`Health Report: ${reportJsonPath}`);
  console.log(`Health Report text: ${reportTextPath}`);

  const tutorFailed = evaluation.caseResults.some((caseResult) =>
    caseResult.diagnostics.some((diagnostic) => diagnostic.code === "adapter_failed"),
  );
  if (tutorFailed || report.releaseGate === "FAIL") {
    return 1;
  }
  if (judge === undefined || report.releaseGate === "UNRESOLVED") {
    return 2;
  }
  return 0;
}
