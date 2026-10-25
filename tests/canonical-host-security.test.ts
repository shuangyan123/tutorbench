import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { request as httpRequest, createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { after, test } from "node:test";
import { createHttpTutorExecutionHost } from "../src/adapters/http-tutor-execution-host.js";
import { parseCanonicalHostSessionToken } from "../src/transport/canonical-host-session.js";
import type { TutorExecutionPacketFile } from "../src/contracts/index.js";

interface Fixture {
  readonly token: string;
  readonly packet: TutorExecutionPacketFile;
  readonly hosts: { readonly name: string; readonly endpoint: string; readonly server: Server }[];
  readonly calls: { readonly host: string }[];
  readonly close: () => Promise<void>;
}
const { createSecurityFixture } = await import(pathToFileURL(resolve("scripts/canonical-host-browser-security.mjs")).href) as {
  createSecurityFixture: () => Promise<Fixture>;
};
const fixture = await createSecurityFixture();
after(() => fixture.close());
const wire = JSON.stringify(fixture.packet);
const headers = { "content-type": "application/json", authorization: "Bearer " + fixture.token };

function request(endpoint: string, options: {
  readonly headers?: Record<string, string | string[]>;
  readonly method?: string;
  readonly incomplete?: boolean;
} = {}): Promise<{ status: number; text: string }> {
  return new Promise((done, reject) => {
    const req = httpRequest(endpoint, { method: options.method ?? "POST", headers: options.headers ?? headers }, res => {
      let text = "";
      res.on("data", chunk => { text += String(chunk); });
      res.on("end", () => { req.destroy(); done({ status: res.statusCode!, text }); });
    });
    req.setTimeout(2000, () => { req.destroy(new Error("request timed out")); });
    req.on("error", reject);
    if (options.incomplete) req.flushHeaders();
    else req.end(wire);
  });
}

for (const host of fixture.hosts) {
  test(host.name + " rejects unauthorized requests before Provider execution", async t => {
    const port = new URL(host.endpoint).port;
    const invalid: { name: string; headers: Record<string, string | string[]>; status: number; method?: string; incomplete?: boolean }[] = [
      { name: "missing credential", headers: { "content-type": "application/json" }, status: 401 },
      { name: "wrong credential", headers: { ...headers, authorization: "Bearer " + randomBytes(32).toString("hex") }, status: 401 },
      { name: "malformed credential", headers: { ...headers, authorization: "Bearer invalid" }, status: 401 },
      { name: "duplicate credential", headers: { ...headers, authorization: [headers.authorization, headers.authorization] }, status: 401 },
      { name: "browser origin despite valid credential", headers: { ...headers, origin: "http://localhost:8080" }, status: 403 },
      { name: "null origin despite valid credential", headers: { ...headers, origin: "null" }, status: 403 },
      { name: "empty origin despite valid credential", headers: { ...headers, origin: "" }, status: 403 },
      { name: "rebinding hostname", headers: { ...headers, host: "attacker.invalid:" + port }, status: 403 },
      { name: "missing Host port", headers: { ...headers, host: "127.0.0.1" }, status: 403 },
      { name: "wrong Host port", headers: { ...headers, host: "127.0.0.1:" + (Number(port) + 1) }, status: 403 },
      { name: "trailing dot", headers: { ...headers, host: "localhost.:" + port }, status: 403 },
      { name: "proxy headers cannot repair Host", headers: { ...headers, host: "attacker.invalid:" + port,
        forwarded: "host=127.0.0.1:" + port, "x-forwarded-host": "127.0.0.1:" + port }, status: 403 },
      { name: "plain text despite valid credential", headers: { ...headers, "content-type": "text/plain" }, status: 415 },
      { name: "form despite valid credential", headers: { ...headers, "content-type": "application/x-www-form-urlencoded" }, status: 415 },
      { name: "JSON prefix is insufficient", headers: { ...headers, "content-type": "application/jsonp" }, status: 415 },
      { name: "unsupported charset", headers: { ...headers, "content-type": "application/json; charset=utf-16" }, status: 415 },
      { name: "preflight", headers: { origin: "http://localhost:8080", "access-control-request-method": "POST" }, status: 403, method: "OPTIONS" },
      { name: "credentialed OPTIONS remains closed", headers, status: 405, method: "OPTIONS" },
      { name: "reject before receiving body", headers: { "content-type": "application/json", "content-length": "1000000" },
        status: 401, incomplete: true },
    ];
    for (const entry of invalid) {
      await t.test(entry.name, async () => {
        const count = fixture.calls.length;
        const response = await request(host.endpoint, entry);
        assert.equal(response.status, entry.status);
        assert.equal(fixture.calls.length, count);
        assert.equal(response.text.includes(fixture.token), false, "no capability in error response");
      });
    }
  });

  test(host.name + " accepts the credentialed canonical client and literal loopback Host only", async () => {
    const count = fixture.calls.length;
    const client = createHttpTutorExecutionHost({ endpoint: host.endpoint, sessionToken: fixture.token });
    assert.equal(JSON.stringify(client).includes(fixture.token), false);
    assert.equal((await client.execute(fixture.packet)).output.text, "Synthetic answer.");
    assert.equal(fixture.calls.length, count + 1);
    const response = await request(host.endpoint, { headers: { ...headers, host: "LOCALHOST:" + new URL(host.endpoint).port,
      "content-type": 'Application/JSON; charset="UTF-8"', forwarded: "host=attacker.invalid" } });
    assert.equal(response.status, 200);
    assert.equal(fixture.calls.length, count + 2);
  });

  test(host.name + " CLI end-to-end uses only the environment capability and never persists it", async () => {
    const directory = await mkdtemp(join(tmpdir(), "canonical-host-auth-"));
    try {
      const output = join(directory, "corpus.json"), report = join(directory, "report.json");
      const count = fixture.calls.length;
      const run = (token: string | undefined) => new Promise<{ code: number | null; log: string }>((done, reject) => {
        const child = spawn(process.execPath, [resolve("dist/src/cli/tutorbench.js"), "collect-model", "--http", host.endpoint,
          "--provider", "synthetic-fixture", "--model", "synthetic-fixture", "--limit", "1", "--output", output, "--report", report], {
          env: { ...process.env, CANONICAL_MODEL_HOST_TOKEN: token }, stdio: ["ignore", "pipe", "pipe"],
        });
        let log = "";
        child.stdout.on("data", chunk => { log += String(chunk); }); child.stderr.on("data", chunk => { log += String(chunk); });
        child.once("error", reject); child.once("close", code => done({ code, log }));
      });
      const missing = await run(undefined);
      assert.equal(missing.code, 1); assert.equal(fixture.calls.length, count);
      const wrong = await run(randomBytes(32).toString("hex"));
      assert.equal(wrong.code, 1); assert.equal(fixture.calls.length, count);
      const valid = await run(fixture.token);
      assert.equal(valid.code, 0);
      assert.equal(fixture.calls.length, count + 1);
      const corpus = await readFile(output, "utf8"), reportText = await readFile(report, "utf8");
      assert.equal((valid.log + wrong.log + missing.log + corpus + reportText).includes(fixture.token), false);
      assert.equal(JSON.parse(corpus).responses.length, 1);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}

test("Host session configuration fails closed without disclosing values", async () => {
  for (const value of [undefined, "", "short", "a".repeat(63), "A".repeat(64), randomBytes(32).toString("hex") + "\n"]) {
    assert.throws(() => parseCanonicalHostSessionToken(value), { message: /CANONICAL_MODEL_HOST_TOKEN/u });
  }
  for (const file of ["openai-server.mjs", "gemini-server.mjs", "chat-completions-server.mjs"]) {
    const mod = await import(pathToFileURL(resolve("examples/canonical-model-host", file)).href) as {
      readConfiguration: (environment: Record<string, string>) => Record<string, unknown>;
      startServer: (configuration: { sessionToken?: string; apiKey?: string }, transport: () => never) => Promise<Server>;
    };
    let calls = 0;
    await assert.rejects(mod.startServer({}, () => { calls++; throw new Error("not reached"); }), /CANONICAL_MODEL_HOST_TOKEN/u);
    const validEnvironment = { OPENAI_API_KEY: "synthetic", OPENAI_MODEL: "synthetic", GEMINI_API_KEY: "synthetic",
      GEMINI_MODEL: "gemini-2.5-flash", TUTOR_MODEL_API_KEY: "synthetic", TUTOR_MODEL: "synthetic",
      TUTOR_MODEL_BASE_URL: "https://synthetic.invalid/v1" };
    assert.throws(() => mod.readConfiguration(validEnvironment), /CANONICAL_MODEL_HOST_TOKEN/u);
    await assert.rejects(mod.startServer({ sessionToken: fixture.token, apiKey: fixture.token }, () => {
      calls++; throw new Error("not reached");
    }), /must differ/u);
    assert.equal(calls, 0);
  }
});

test("capability transport rejects unsafe destinations and does not follow redirects", async () => {
  for (const endpoint of ["http://attacker.invalid/generate", "http://127.0.0.1:9001/generate?token=x", "https://example.invalid/#secret"]) {
    assert.throws(() => createHttpTutorExecutionHost({ endpoint, sessionToken: fixture.token }), /HTTPS or loopback/u);
  }
  let leaked = 0;
  const destination = createServer((_req, res) => { leaked++; res.end("{}"); });
  await new Promise<void>(done => destination.listen(0, "127.0.0.1", done));
  const address = destination.address(); assert.ok(address && typeof address !== "string");
  const source = createServer((_req, res) => { res.writeHead(307, { location: "http://127.0.0.1:" + address.port }); res.end(); });
  await new Promise<void>(done => source.listen(0, "127.0.0.1", done));
  try {
    const sourceAddress = source.address(); assert.ok(sourceAddress && typeof sourceAddress !== "string");
    const client = createHttpTutorExecutionHost({ endpoint: "http://127.0.0.1:" + sourceAddress.port, sessionToken: fixture.token });
    await assert.rejects(client.execute(fixture.packet), { code: "transport_error" });
    assert.equal(leaked, 0);
  } finally { source.closeAllConnections(); destination.closeAllConnections();
    await Promise.all([source, destination].map(server => new Promise<void>(done => server.close(() => done())))); }
});
