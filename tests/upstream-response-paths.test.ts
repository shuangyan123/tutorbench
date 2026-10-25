import assert from "node:assert/strict";
import { test } from "node:test";

import { HttpTutor } from "../src/adapters/http-tutor.js";
import { HttpTutorExecutionHost } from "../src/adapters/http-tutor-execution-host.js";
import { buildTutorExecutionPacketFile } from "../src/contracts/index.js";
import { buildTutorBaselineGenerationSpec, loadTutorBaselinePrompt } from "../src/corpus/index.js";
import { loadTutorEvalDataset } from "../src/datasets/index.js";
import { createChatCompletionsExecutor } from "../src/providers/chat-completions/tutor-eval-judge.js";
import { HttpReviewTranslator } from "../src/review-translation/provider.js";
import { oversizedResponse, trackedResponse } from "./helpers/upstream-response.js";

const input = {
  scenarioId: "synthetic", initialContext: "", conversation: [], currentStudentMessage: "synthetic",
  studentState: { knownConcepts: [], misconceptions: [], level: "test", goal: "test" },
};

async function packet() {
  const dataset = await loadTutorEvalDataset();
  const prompt = await loadTutorBaselinePrompt();
  return buildTutorExecutionPacketFile(dataset, [dataset.cases[0]!], buildTutorBaselineGenerationSpec(prompt), prompt);
}

const paths = [
  {
    name: "Tutor HTTP v1", body: { text: "synthetic" },
    run: () => new HttpTutor({ id: "synthetic", endpoint: "https://synthetic.invalid" }).respond(input),
  },
  {
    name: "canonical execution client", body: { output: { text: "synthetic" }, executionSupport: { maxOutputTokens: true } },
    run: async () => new HttpTutorExecutionHost({ endpoint: "https://synthetic.invalid" }).execute(await packet()),
  },
  {
    name: "compatible Judge", body: { choices: [{ message: { content: "synthetic" }, finish_reason: "stop" }] },
    run: () => createChatCompletionsExecutor({
      provider: "synthetic", model: "synthetic", prompt: "synthetic", promptId: "synthetic", promptVersion: "1",
      apiKey: "synthetic", baseUrl: "https://synthetic.invalid", maxAttempts: 1,
      serializeInput: () => "", parseResult: (content) => content,
    }).evaluate({}),
  },
  {
    name: "review translation", body: { translatedText: "synthetic" },
    run: () => new HttpReviewTranslator({ endpoint: "https://synthetic.invalid" }).translate({
      targetLocale: "zh-CN", sourceType: "tutor_response", caseId: "synthetic", fieldKey: "text", sourceText: "synthetic",
    }),
  },
];

for (const path of paths) {
  test(`${path.name} cancels an oversized success body before consuming its tail`, async (context) => {
    const fixture = oversizedResponse(path.body);
    context.mock.method(globalThis, "fetch", async () => fixture.response);
    await assert.rejects(path.run());
    assert.equal(fixture.cancelled(), true);
    assert.equal(fixture.reads(), 123);
    assert.equal(fixture.bytesRead(), 8_060_928);
  });

  test(`${path.name} bounds a non-success body and preserves status failure`, async (context) => {
    const fixture = oversizedResponse({ error: "synthetic-private-body" }, 503);
    context.mock.method(globalThis, "fetch", async () => fixture.response);
    await assert.rejects(path.run(), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /synthetic-private-body/);
      if ("code" in error) {
        assert.ok(["server_error", "judge_transport_error", "translator_transport_error"].includes(String(error.code)));
      } else assert.match(error.message, /non-success/);
      return true;
    });
    assert.equal(fixture.cancelled(), true);
    assert.equal(fixture.reads(), path.name === "canonical execution client" ? 2 : 0);
  });

  test(`${path.name} rejects early EOF without exposing body content`, async (context) => {
    const fixture = trackedResponse([Buffer.from('{"synthetic-private-body":')]);
    context.mock.method(globalThis, "fetch", async () => fixture.response);
    await assert.rejects(path.run(), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /synthetic-private-body/);
      return true;
    });
    assert.equal(fixture.response.body?.locked, false);
  });

  test(`${path.name} isolates stream exceptions behind its existing error boundary`, async (context) => {
    const response = new Response(new ReadableStream({
      pull(controller) { controller.error(new Error("synthetic-private-stream-error")); },
    }, { highWaterMark: 0 }));
    context.mock.method(globalThis, "fetch", async () => response);
    await assert.rejects(path.run(), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /synthetic-private-stream-error/);
      return true;
    });
    assert.equal(response.body?.locked, false);
  });
}

test("compatible Judge retains its body-read deadline and cancels a stalled stream", async (context) => {
  let cancelled = false;
  context.mock.method(globalThis, "fetch", async () => new Response(new ReadableStream({
    pull() { return new Promise<void>(() => undefined); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 })));
  const judge = createChatCompletionsExecutor({
    provider: "synthetic", model: "synthetic", prompt: "synthetic", promptId: "synthetic", promptVersion: "1",
    apiKey: "synthetic", baseUrl: "https://synthetic.invalid", maxAttempts: 3, timeoutMs: 25,
    serializeInput: () => "", parseResult: (content) => content,
  });
  await assert.rejects(judge.evaluate({}), (error: unknown) => {
    assert.ok(error instanceof Error && "code" in error && error.code === "judge_timeout");
    return true;
  });
  assert.equal(cancelled, true);
});
