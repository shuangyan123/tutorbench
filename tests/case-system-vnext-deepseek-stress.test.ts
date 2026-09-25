import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildCaseSystemVNextEvaluatorStressPlan,
  type CaseSystemVNextStressFixtureSuite,
} from "../src/index.js";
import {
  parseCaseSystemVNextPilot,
  parseCaseSystemVNextStrategyProfileRegistry,
} from "../src/contracts/index.js";
import {
  CASE_SYSTEM_VNEXT_STRESS_JUDGE_PROMPT_ID,
  CASE_SYSTEM_VNEXT_STRESS_JUDGE_PROMPT_VERSION,
  createDeepSeekCaseSystemVNextStressJudge,
  loadCaseSystemVNextStressJudgePrompt,
  type ChatCompletionsFetch,
} from "../src/providers/deepseek/index.js";

async function loadJson(path: string): Promise<unknown> {
  return JSON.parse(
    await readFile(resolve(process.cwd(), path), "utf8"),
  ) as unknown;
}

async function firstPacket() {
  const pilot = parseCaseSystemVNextPilot(
    await loadJson("scenarios/case-system-vnext/pilot-archetypes.json"),
  );
  const registry = parseCaseSystemVNextStrategyProfileRegistry(
    await loadJson("scenarios/case-system-vnext/task-strategy-profiles.json"),
  );
  const suite = await loadJson(
    "scenarios/case-system-vnext/evaluator-stress-fixtures.json",
  ) as CaseSystemVNextStressFixtureSuite;
  const plan = buildCaseSystemVNextEvaluatorStressPlan(pilot, suite, registry, 1);
  return plan.fixtures[0]!.repetitions[0]!.presentations[0]!.packet;
}

function response(content: string) {
  return {
    status: 200,
    json: async () => ({
      choices: [{
        message: {
          reasoning_content: "must not enter benchmark evidence",
          content,
        },
        finish_reason: "stop",
      }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 10,
        total_tokens: 110,
      },
    }),
  };
}

test("DeepSeek vNext stress adapter sends only the blind packet and parses the exact outcome", async () => {
  const packet = await firstPacket();
  const prompt = await loadCaseSystemVNextStressJudgePrompt();
  let calls = 0;

  const fetch: ChatCompletionsFetch = async (url, init) => {
    calls += 1;
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    const body = JSON.parse(init.body) as {
      readonly model: string;
      readonly messages: readonly { readonly role: string; readonly content: string }[];
    };
    assert.equal(body.model, "deepseek-flash");
    assert.equal(body.messages[0]?.content, prompt);

    const user = JSON.parse(body.messages[1]!.content) as {
      readonly kind: string;
      readonly protocolVersion: string;
      readonly payload: Record<string, unknown>;
    };
    assert.equal(user.kind, "CaseSystemVNextStressBlindPacket");
    assert.equal(user.protocolVersion, "0.3.0");
    assert.equal(user.payload.presentationId, packet.presentationId);
    const serialized = JSON.stringify(user);
    assert.doesNotMatch(serialized, /"expected"|"rationale"|candidateId/);

    return response(JSON.stringify({
      schemaVersion: 1,
      presentationId: packet.presentationId,
      outcome: "A_BETTER",
    }));
  };

  const live = createDeepSeekCaseSystemVNextStressJudge({
    model: "deepseek-flash",
    prompt,
    apiKey: "test-key",
    thinkingMode: "disabled",
    temperature: 0,
    maxOutputTokens: 256,
    timeoutMs: 1000,
    maxAttempts: 1,
    fetch,
  });

  assert.equal(live.descriptor.promptId, CASE_SYSTEM_VNEXT_STRESS_JUDGE_PROMPT_ID);
  assert.equal(live.descriptor.promptVersion, CASE_SYSTEM_VNEXT_STRESS_JUDGE_PROMPT_VERSION);
  const judgment = await live.judge(packet);
  assert.deepEqual(judgment, { status: "ok", outcome: "A_BETTER" });
  assert.equal(calls, 1);
});

test("DeepSeek vNext stress adapter fails closed on malformed or mismatched output", async () => {
  const packet = await firstPacket();
  const prompt = await loadCaseSystemVNextStressJudgePrompt();

  const malformed = createDeepSeekCaseSystemVNextStressJudge({
    model: "deepseek-flash",
    prompt,
    apiKey: "test-key",
    thinkingMode: "disabled",
    temperature: 0,
    maxAttempts: 1,
    fetch: async () => response(JSON.stringify({
      schemaVersion: 1,
      presentationId: "wrong-presentation",
      outcome: "EQUIVALENT",
    })),
  });
  assert.deepEqual(await malformed.judge(packet), {
    status: "invalid",
    reason: "judge_result_invalid",
  });

  const unavailable = createDeepSeekCaseSystemVNextStressJudge({
    model: "deepseek-flash",
    prompt,
    apiKey: "test-key",
    thinkingMode: "disabled",
    temperature: 0,
    maxAttempts: 1,
    fetch: async () => ({ status: 503, json: async () => ({}) }),
  });
  assert.deepEqual(await unavailable.judge(packet), {
    status: "unavailable",
    reason: "judge_transport_error",
  });
});
