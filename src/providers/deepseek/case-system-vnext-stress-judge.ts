import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_VERSION,
  type CaseSystemVNextStressBlindPacket,
  type CaseSystemVNextStressJudge,
  type CaseSystemVNextStressRawOutcome,
  TutorEvalJudgeExecutionError,
  type TutorEvalJudgeMetrics,
  type TutorEvalJudgeDescriptor,
} from "../../contracts/index.js";
import { createDeepSeekJudgeExecutor } from "./tutor-eval-judge.js";
import type { ChatCompletionsFetch } from "../chat-completions/index.js";

export const CASE_SYSTEM_VNEXT_STRESS_JUDGE_PROMPT_ID =
  "case-system-vnext-evaluator-stress-judge" as const;
export const CASE_SYSTEM_VNEXT_STRESS_JUDGE_PROMPT_VERSION = "0.2" as const;
export const CASE_SYSTEM_VNEXT_STRESS_JUDGE_PROMPT_ASSET =
  "prompts/case-system-vnext-evaluator-stress-judge-v0.2.md" as const;

export const CASE_SYSTEM_VNEXT_STRESS_JUDGE_RESULT_SCHEMA_VERSION = 1 as const;

export interface CaseSystemVNextStressJudgeResult {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_STRESS_JUDGE_RESULT_SCHEMA_VERSION;
  readonly presentationId: string;
  readonly outcome: CaseSystemVNextStressRawOutcome;
}

export interface DeepSeekCaseSystemVNextStressJudge {
  readonly descriptor: TutorEvalJudgeDescriptor;
  readonly judge: CaseSystemVNextStressJudge;
}

export async function loadCaseSystemVNextStressJudgePrompt(
  baseDirectory = process.cwd(),
): Promise<string> {
  return readFile(resolve(baseDirectory, CASE_SYSTEM_VNEXT_STRESS_JUDGE_PROMPT_ASSET), "utf8");
}

function isOutcome(value: unknown): value is CaseSystemVNextStressRawOutcome {
  return value === "A_BETTER" ||
    value === "B_BETTER" ||
    value === "EQUIVALENT" ||
    value === "NON_DOMINATED" ||
    value === "INSUFFICIENT_EVIDENCE";
}

function parseResult(
  content: string,
  _metrics: TutorEvalJudgeMetrics,
  input: CaseSystemVNextStressBlindPacket,
): CaseSystemVNextStressJudgeResult {
  const value = JSON.parse(content) as unknown;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("invalid_stress_judge_result");
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !== "outcome,presentationId,schemaVersion" ||
    record.schemaVersion !== CASE_SYSTEM_VNEXT_STRESS_JUDGE_RESULT_SCHEMA_VERSION ||
    record.presentationId !== input.presentationId ||
    !isOutcome(record.outcome)
  ) {
    throw new Error("invalid_stress_judge_result");
  }
  return record as unknown as CaseSystemVNextStressJudgeResult;
}

function serializeInput(input: CaseSystemVNextStressBlindPacket): string {
  return JSON.stringify({
    kind: "CaseSystemVNextStressBlindPacket",
    protocolVersion: CASE_SYSTEM_VNEXT_EVALUATOR_STRESS_PROTOCOL_VERSION,
    payload: input,
  });
}

function reasonFor(error: TutorEvalJudgeExecutionError): string {
  return error.code;
}

export function createDeepSeekCaseSystemVNextStressJudge(options: {
  readonly model: string;
  readonly prompt: string;
  readonly apiKey?: string | null;
  readonly environment?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
  readonly thinkingMode?: "enabled" | "disabled";
  readonly reasoningEffort?: "high" | "max";
  readonly maxOutputTokens?: number;
  readonly temperature?: number;
  readonly requireReasoningSeparation?: boolean;
  readonly fetch?: ChatCompletionsFetch;
}): DeepSeekCaseSystemVNextStressJudge {
  const executor = createDeepSeekJudgeExecutor({
    model: options.model,
    prompt: options.prompt,
    promptId: CASE_SYSTEM_VNEXT_STRESS_JUDGE_PROMPT_ID,
    promptVersion: CASE_SYSTEM_VNEXT_STRESS_JUDGE_PROMPT_VERSION,
    ...(options.apiKey === undefined ? {} : { apiKey: options.apiKey }),
    ...(options.environment === undefined ? {} : { environment: options.environment }),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options.maxAttempts === undefined ? {} : { maxAttempts: options.maxAttempts }),
    ...(options.thinkingMode === undefined ? {} : { thinkingMode: options.thinkingMode }),
    ...(options.reasoningEffort === undefined ? {} : { reasoningEffort: options.reasoningEffort }),
    ...(options.maxOutputTokens === undefined ? {} : { maxOutputTokens: options.maxOutputTokens }),
    ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
    requireReasoningSeparation: options.requireReasoningSeparation ?? true,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    serializeInput,
    parseResult,
  });

  const judge: CaseSystemVNextStressJudge = async (packet) => {
    try {
      const evaluation = await executor.evaluateWithMetrics(packet);
      return {
        status: "ok",
        outcome: evaluation.result.outcome,
      };
    } catch (error) {
      if (error instanceof TutorEvalJudgeExecutionError) {
        const unavailable =
          error.code === "judge_unavailable" ||
          error.code === "judge_timeout" ||
          error.code === "judge_transport_error";
        return {
          status: unavailable ? "unavailable" : "invalid",
          reason: reasonFor(error),
        };
      }
      return { status: "invalid", reason: "unexpected_judge_error" };
    }
  };

  return {
    descriptor: executor.descriptor,
    judge,
  };
}
