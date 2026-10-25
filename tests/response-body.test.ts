import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { gzipSync } from "node:zlib";

import {
  boundedResponse, createBoundedFetch, MAX_UPSTREAM_ERROR_BYTES, MAX_UPSTREAM_RESPONSE_BYTES,
  readBoundedJson, ResponseBodyLimitError,
} from "../src/transport/response-body.js";
import { trackedResponse } from "./helpers/upstream-response.js";

for (const length of [undefined, "0", "1", "999999999", "invalid"]) {
  test(`actual bytes govern overflow with Content-Length ${length ?? "absent"}`, async () => {
    const fixture = trackedResponse([Buffer.alloc(4), Buffer.alloc(5), Buffer.from("unread")], 200,
      length === undefined ? {} : { "content-length": length });
    await assert.rejects(boundedResponse(fixture.response, 8).text(), ResponseBodyLimitError);
    assert.equal(fixture.bytesRead(), 9);
    assert.equal(fixture.reads(), 2);
    assert.equal(fixture.cancelled(), true);
    assert.equal(fixture.response.body?.locked, false);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(fixture.reads(), 2);
  });
}

test("exact boundary is accepted across chunks without cancelling a completed stream", async () => {
  const fixture = trackedResponse([Buffer.from("1234"), Buffer.from("5678")]);
  assert.equal(await boundedResponse(fixture.response, 8).text(), "12345678");
  assert.equal(fixture.cancelled(), false);
  assert.equal(fixture.response.body?.locked, false);
});

test("one oversized chunk is rejected without forwarding it or pulling a tail", async () => {
  const fixture = trackedResponse([Buffer.alloc(9), Buffer.from("unread")]);
  const reader = boundedResponse(fixture.response, 8).body!.getReader();
  await assert.rejects(reader.read(), ResponseBodyLimitError);
  assert.equal(fixture.reads(), 1);
  assert.equal(fixture.cancelled(), true);
});

test("UTF-8 byte count cannot be replaced by string length", async () => {
  const fixture = trackedResponse([Buffer.from("汉"), Buffer.from("字"), Buffer.from("unread")]);
  await assert.rejects(boundedResponse(fixture.response, 5).text(), ResponseBodyLimitError);
  assert.equal(fixture.bytesRead(), 6);
  assert.equal(fixture.reads(), 2);
});

test("UTF-8 split inside a code point decodes correctly at the exact boundary", async () => {
  const bytes = Buffer.from("汉");
  const fixture = trackedResponse([bytes.subarray(0, 1), bytes.subarray(1)]);
  assert.equal(await boundedResponse(fixture.response, 3).text(), "汉");
});

test("empty chunks, empty bodies, null bodies and zero-byte budgets terminate normally", async () => {
  const empty = trackedResponse([Buffer.alloc(0)]);
  assert.equal(await boundedResponse(empty.response, 0).text(), "");
  assert.equal(await boundedResponse(new Response(null, { status: 204 }), 0).text(), "");
  const nonempty = trackedResponse([Buffer.from("x")]);
  await assert.rejects(boundedResponse(nonempty.response, 0).text(), ResponseBodyLimitError);
});

test("early EOF is accepted for complete JSON and rejects partial JSON without a fallback", async () => {
  const complete = trackedResponse([Buffer.from('{"ok":true}')], 200, { "content-length": "999999" });
  assert.deepEqual(await readBoundedJson(complete.response), { ok: true });
  const incomplete = trackedResponse([Buffer.from('{"ok":')]);
  await assert.rejects(readBoundedJson(incomplete.response), SyntaxError);
  assert.equal(incomplete.response.body?.locked, false);
});

test("stream read exceptions release the source lock and remain failures", async () => {
  let reads = 0;
  const source = new ReadableStream<Uint8Array>({
    pull(controller) {
      reads += 1;
      if (reads === 1) controller.enqueue(Buffer.from("{"));
      else controller.error(new Error("synthetic-private-body-error"));
    },
  }, { highWaterMark: 0 });
  await assert.rejects(boundedResponse(new Response(source), 8).text());
  assert.equal(reads, 2);
  assert.equal(source.locked, false);
});

for (const cancellation of ["reject", "never resolves"] as const) {
  test(`overflow does not wait when source cancellation ${cancellation}`, { timeout: 1000 }, async () => {
    let cancelled = false;
    const source = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(Buffer.alloc(9)); },
      cancel() {
        cancelled = true;
        return cancellation === "reject" ? Promise.reject(new Error("synthetic-private-cancel-error"))
          : new Promise<void>(() => undefined);
      },
    }, { highWaterMark: 0 });
    await assert.rejects(boundedResponse(new Response(source), 8).text(), ResponseBodyLimitError);
    assert.equal(cancelled, true);
    assert.equal(source.locked, false);
  });
}

test("consumer cancellation forwards immediately without reading", async () => {
  const fixture = trackedResponse([Buffer.from("unread")]);
  await boundedResponse(fixture.response, 8).body!.cancel();
  assert.equal(fixture.reads(), 0);
  assert.equal(fixture.cancelled(), true);
});

test("already aborted requests cancel before the first source read", async () => {
  const fixture = trackedResponse([Buffer.from("unread")]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(boundedResponse(fixture.response, 8, controller.signal).text(), { name: "AbortError" });
  assert.equal(fixture.reads(), 0);
  assert.equal(fixture.cancelled(), true);
});

test("abort while a read is pending cancels and releases the reader", async () => {
  const controller = new AbortController();
  let started!: () => void;
  const reading = new Promise<void>((resolve) => { started = resolve; });
  let cancelled = false;
  const source = new ReadableStream<Uint8Array>({
    pull() { started(); return new Promise<void>(() => undefined); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const result = boundedResponse(new Response(source), 8, controller.signal).text();
  await reading;
  controller.abort();
  await assert.rejects(result, { name: "AbortError" });
  assert.equal(cancelled, true);
  assert.equal(source.locked, false);
});

test("SDK fetch wrapper preserves HTTP metadata and bounds error bodies independently", async () => {
  const fixture = trackedResponse([Buffer.alloc(MAX_UPSTREAM_ERROR_BYTES), Buffer.from("x"), Buffer.from("unread")],
    429, { "content-length": "0", "retry-after": "3", "x-request-id": "synthetic-id" });
  const response = await createBoundedFetch(async () => fixture.response)("https://synthetic.invalid");
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "3");
  assert.equal(response.headers.get("x-request-id"), "synthetic-id");
  assert.equal(response.headers.has("content-length"), false);
  await assert.rejects(response.text(), (error: unknown) => error instanceof ResponseBodyLimitError && error.status === 429);
  assert.equal(fixture.reads(), 2);
  assert.equal(fixture.cancelled(), true);
});

test("SDK wrapper accepts a complete response at the production byte budget", async () => {
  const fixture = trackedResponse([Buffer.from("{}"), Buffer.alloc(MAX_UPSTREAM_RESPONSE_BYTES - 2, " ")]);
  const response = await createBoundedFetch(async () => fixture.response)("https://synthetic.invalid");
  assert.deepEqual(await response.json(), {});
  assert.equal(fixture.bytesRead(), MAX_UPSTREAM_RESPONSE_BYTES);
  assert.equal(fixture.cancelled(), false);
});

test("budget validation fails closed", () => {
  for (const budget of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => boundedResponse(new Response(null), budget), RangeError);
  }
});

test("the error byte budget accepts a complete JSON envelope exactly at its boundary", async () => {
  const fixture = trackedResponse([Buffer.from("{}"), Buffer.alloc(MAX_UPSTREAM_ERROR_BYTES - 2, " ")], 500);
  assert.deepEqual(await readBoundedJson(fixture.response), {});
  assert.equal(fixture.bytesRead(), MAX_UPSTREAM_ERROR_BYTES);
  assert.equal(fixture.cancelled(), false);
});

test("the success budget accommodates a long Unicode response with JSON escapes", async () => {
  const text = "汉🚀".repeat(32_768);
  const escaped = JSON.stringify({ text }).replace(/[\u007f-\uffff]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
  const fixture = trackedResponse([Buffer.from(escaped)]);
  assert.ok(Buffer.byteLength(escaped) < MAX_UPSTREAM_RESPONSE_BYTES);
  assert.deepEqual(await readBoundedJson(fixture.response), { text });
});

test("native fetch compressed responses are limited by decompressed bytes", async (context) => {
  const compressed = gzipSync(Buffer.alloc(8192, " "));
  assert.ok(compressed.byteLength < 1024);
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-encoding": "gzip", "content-length": String(compressed.byteLength) });
    response.end(compressed);
  });
  context.after(() => new Promise<void>((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}`);
  await assert.rejects(boundedResponse(response, 1024).text(), ResponseBodyLimitError);
});
