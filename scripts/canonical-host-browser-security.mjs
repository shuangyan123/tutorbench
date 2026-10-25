// Local-only NV-02 regression fixture. Never falls back to a live Provider transport.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTutorExecutionPacketFile } from "../dist/src/contracts/index.js";
import { loadTutorEvalDataset } from "../dist/src/datasets/index.js";
import { buildTutorBaselineGenerationSpec, loadTutorBaselinePrompt } from "../dist/src/corpus/index.js";

export async function createSecurityFixture() {
  const token = randomBytes(32).toString("hex");
  const dataset = await loadTutorEvalDataset("tutor-eval-v0.2a");
  const prompt = await loadTutorBaselinePrompt();
  const packet = buildTutorExecutionPacketFile(dataset, [dataset.cases[0]], buildTutorBaselineGenerationSpec(prompt), prompt);
  const calls = [], requests = [], hosts = [];
  const replies = {
    openai: { id: "fixture", object: "response", status: "completed", output: [{ type: "message", role: "assistant",
      content: [{ type: "output_text", text: "Synthetic answer." }] }] },
    gemini: { candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ text: "Synthetic answer." }] } }] },
    chat: { choices: [{ finish_reason: "stop", message: { content: "Synthetic answer." } }] },
  };
  try {
    for (const [name, file, environment] of [
      ["openai", "openai-server.mjs", { OPENAI_API_KEY: "synthetic-provider", OPENAI_MODEL: "fixture", OPENAI_BASE_URL: "https://provider.invalid/v1" }],
      ["gemini", "gemini-server.mjs", { GEMINI_API_KEY: "synthetic-provider", GEMINI_MODEL: "gemini-2.5-flash" }],
      ["chat", "chat-completions-server.mjs", { TUTOR_MODEL_API_KEY: "synthetic-provider", TUTOR_MODEL: "fixture", TUTOR_MODEL_BASE_URL: "https://provider.invalid/v1" }],
    ]) {
      const mod = await import("../examples/canonical-model-host/" + file);
      const server = await mod.startServer(mod.readConfiguration({
        ...environment, CANONICAL_MODEL_HOST_PORT: "0", CANONICAL_MODEL_HOST_TOKEN: token,
      }), async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        assert.ok(body.input || body.contents || body.messages);
        calls.push({ host: name });
        return new Response(JSON.stringify(replies[name]), { headers: { "content-type": "application/json" } });
      });
      server.on("request", (req, res) => {
        const entry = { host: name, method: req.method, origin: req.headers.origin ?? null,
          contentType: req.headers["content-type"] ?? null, site: req.headers["sec-fetch-site"] ?? null };
        requests.push(entry);
        res.once("finish", () => { entry.status = res.statusCode; });
      });
      const address = server.address();
      assert.equal(address.address, "127.0.0.1");
      hosts.push({ name, server, endpoint: "http://127.0.0.1:" + address.port + "/generate" });
    }
    return { token, packet, hosts, calls, requests, close: async () => {
      await Promise.all(hosts.map(({ server }) => new Promise((done, reject) => {
        server.closeAllConnections(); server.close(error => error ? reject(error) : done());
      })));
    } };
  } catch (error) {
    for (const { server } of hosts) { server.closeAllConnections(); server.close(); }
    throw error;
  }
}

/* global window, document, navigator, self, isSecureContext, AbortSignal, Response */
async function browserSuite() {
  const { observer, hosts, wire, wrongToken } = window.fixture;
  const rows = [];
  const environment = { origin: self.origin, secureContext: isSecureContext,
    userActivation: navigator.userActivation.isActive, userAgent: navigator.userAgent };
  try { environment.version = await navigator.userAgentData?.getHighEntropyValues(["fullVersionList"]); } catch { /* optional */ }
  environment.permissions = {};
  for (const name of ["local-network-access", "local-network", "loopback-network"]) {
    try { environment.permissions[name] = (await navigator.permissions.query({ name })).state; }
    catch { environment.permissions[name] = "unsupported"; }
  }
  const readStats = async () => (await fetch(observer + "/snapshot")).json();
  const show = () => { document.getElementById("results").textContent = JSON.stringify({ environment, rows }, null, 2); };
  const form = async (endpoint, encoded) => {
    const frame = document.createElement("iframe");
    frame.name = "target_" + Math.random().toString(36).slice(2); frame.hidden = true;
    document.body.append(frame);
    await new Promise(done => setTimeout(done, 50));
    const element = document.createElement("form");
    element.method = "POST"; element.action = endpoint; element.target = frame.name;
    element.enctype = encoded ? "application/x-www-form-urlencoded" : "text/plain";
    // Existing '=' inside public packet text lets form serialization preserve valid JSON.
    const split = wire.indexOf("=");
    const input = document.createElement("input");
    input.type = "hidden"; input.name = wire.slice(0, split); input.value = wire.slice(split + 1);
    element.append(input); document.body.append(element);
    let timer;
    const settled = new Promise(done => {
      frame.onload = () => done("loaded"); timer = setTimeout(() => done("timeout"), 2000);
    });
    element.submit();
    const state = await settled; clearTimeout(timer);
    let readable;
    try { readable = frame.contentWindow.location.href; } catch (error) { readable = error.name; }
    frame.remove(); element.remove();
    return { state, readable };
  };
  for (const host of hosts) {
    for (const scenario of ["cors-text", "no-cors-text", "cors-json", "no-cors-json", "form-text", "form-urlencoded", "invalid-text", "wrong-credential"]) {
      const before = await readStats();
      let result;
      try {
        if (scenario.startsWith("form-")) result = await form(host.endpoint, scenario === "form-urlencoded");
        else {
          const response = await fetch(host.endpoint, {
            method: "POST", mode: scenario.startsWith("no-cors") ? "no-cors" : "cors",
            headers: { "Content-Type": scenario.endsWith("json") ? "application/json" : "text/plain",
              ...(scenario === "wrong-credential" ? { Authorization: "Bearer " + wrongToken } : {}) },
            body: scenario === "invalid-text" ? "{}" : wire, signal: AbortSignal.timeout(4500),
          });
          result = { type: response.type, status: response.status, text: await response.text() };
        }
      } catch (error) { result = { error: error.name }; }
      const after = await readStats();
      rows.push({ host: host.name, scenario, result,
        requests: after.requests.slice(before.requests.length), calls: after.calls.slice(before.calls.length) });
      show();
    }
  }
  const submitted = await fetch(observer + "/report", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ environment, rows }) });
  if (!submitted.ok) throw new Error("Browser fixture assertions failed");
  document.getElementById("done").textContent = "DONE";
}

async function main() {
  const vulnerable = process.argv.includes("--expect-vulnerable");
  const fixture = await createSecurityFixture();
  const reports = [];
  const wire = JSON.stringify(fixture.packet);
  assert.ok(wire.includes("="));
  const web = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, "http://localhost").pathname;
      // CORS belongs only to the observation fixture; never to a tested Host.
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-headers", "Content-Type");
      res.setHeader("cache-control", "no-store");
      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
      const json = value => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(value)); };
      if (path === "/snapshot") return json({ requests: fixture.requests, calls: fixture.calls });
      if (path === "/reports") return json(reports);
      if (path === "/report") {
        let body = ""; for await (const part of req) body += part;
        const report = JSON.parse(body);
        assert.equal(report.rows.length, 24);
        assert.equal(report.environment.userActivation, false);
        for (const row of report.rows) {
          const expected = vulnerable && ["cors-text", "no-cors-text", "no-cors-json", "form-text"].includes(row.scenario) ? 1 : 0;
          assert.equal(row.calls.length, expected, row.host + "/" + row.scenario);
          assert.ok(row.requests.length >= 1, "request must reach tested Host");
        }
        reports.push(report);
        console.log(JSON.stringify({ browserReport: true, origin: report.environment.origin, cases: report.rows.length,
          calls: report.rows.reduce((sum, row) => sum + row.calls.length, 0), assertions: "PASS" }));
        return json({ accepted: true });
      }
      if (path === "/shutdown") {
        json({ closed: true }); await fixture.close(); web.closeAllConnections(); web.close(); return;
      }
      const data = { observer: "http://127.0.0.1:" + web.address().port,
        hosts: fixture.hosts.map(({ name, endpoint }) => ({ name, endpoint })), wire,
        wrongToken: randomBytes(32).toString("hex") };
      const page = '<!doctype html><meta charset="utf-8"><h1>NV-02 synthetic browser regression</h1><strong id="done">RUNNING</strong><pre id="results"></pre><script>window.fixture=' +
        JSON.stringify(data).replaceAll("<", "\\u003c") + ';(' + browserSuite.toString() + ')();</script>';
      res.setHeader("content-type", "text/html; charset=utf-8");
      if (path === "/opaque") res.end('<!doctype html><h1>Opaque sandbox</h1><iframe style="width:100%;height:85vh" sandbox="allow-scripts allow-forms" srcdoc="' +
        page.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;") + '"></iframe>');
      else res.end(page);
    } catch { res.statusCode = 500; res.end("Fixture assertion failed"); }
  });
  await new Promise(done => web.listen(0, "127.0.0.1", done));
  console.log(JSON.stringify({ fixture: "http://localhost:" + web.address().port,
    opaque: "http://localhost:" + web.address().port + "/opaque", expected: vulnerable ? "vulnerable" : "blocked" }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
