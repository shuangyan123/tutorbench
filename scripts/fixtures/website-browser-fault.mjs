// Isolated subprocess: faults must exit by themselves, not by the test runner's watchdog.
/* global document */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { join } from "node:path";
import { findBrowser, launchBrowser, openPage } from "../website-browser.mjs";
import { headerProbe } from "../website-hit-test.mjs";

const [mode, profileRoot] = process.argv.slice(2);
let browser, socket, server;
const start = performance.now();
try {
  const executable = mode === "startup-missing" ? join(profileRoot, "missing-browser")
    : mode === "startup-exit" ? process.execPath : findBrowser();
  browser = await launchBrowser(executable, {
    profileRoot, requestMs: mode === "pending-timeout" ? 1000 : 5000,
    // Use the production startup deadline; only the injected operation is short.
    shutdownMs: mode === "close-stalled" ? 1000 : 3000,
    createSocket(url) {
      socket = new globalThis.WebSocket(url);
      if (mode === "close-stalled") {
        const send = socket.send.bind(socket);
        socket.send = (data) => { if (JSON.parse(data).method !== "Browser.close") send(data); };
      }
      return socket;
    },
  });
  const page = await openPage(browser, { loadMs: mode === "navigation-stall" ? 1000 : 5000 });
  if (["disconnect", "socket-error", "crash", "pending-timeout"].includes(mode)) {
    const requests = [1, 2].map(() => page.evaluate("new Promise(() => {})"));
    const settled = Promise.allSettled(requests);
    if (mode === "disconnect") socket.close();
    if (mode === "socket-error") socket.dispatchEvent(new globalThis.Event("error"));
    if (mode === "crash") browser.process.kill("SIGKILL");
    const outcomes = await settled;
    assert.ok(outcomes.every((r) => r.status === "rejected"), "every pending request must reject");
    throw new AggregateError(outcomes.map((r) => r.reason), "Both pending requests rejected");
  }
  const html = '<!doctype html><title>Hit test fixture</title><style>body{margin:0}header{height:80px}a{display:inline-block;width:120px;height:40px}</style><header class="site-header"><a class="wordmark" href="/next/">Own target</a></header><p class="hero-note">Existing content</p>';
  server = createServer((request, response) => {
    if (request.url === "/never.js") return;
    if (request.url === "/missing/") { response.writeHead(404).end("Missing"); return; }
    response.setHeader("content-type", "text/html");
    response.end(html + '<script>document.documentElement.dataset.scriptRan="true"</script>' + (mode === "navigation-stall" ? '<script src="/never.js"></script>' : ""));
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.viewport(1024, 900);
  if (mode === "nojs-navigation") await page.setJavaScriptEnabled(false);
  await page.goto(origin + (mode === "http-error" ? "/missing/" : "/"));
  if (mode === "nojs-navigation") {
    assert.equal(await page.evaluate("document.documentElement.getAttribute('data-script-ran')"), null);
    await page.setJavaScriptEnabled(true);
    await page.goto(origin + "/");
    assert.equal(await page.evaluate("document.documentElement.dataset.scriptRan"), "true");
  }
  if (mode === "click-noop") {
    await page.call(() => document.querySelector("a").addEventListener("click", (e) => e.preventDefault()));
    await page.navigation(() => page.click(60, 20));
  }
  if (mode === "geometry") {
    await page.call(() => {
      const note = document.querySelector(".hero-note");
      note.style.cssText = "position:absolute;left:1000px;width:300px;top:150px";
    });
    const contentOnly = await page.call(headerProbe);
    assert.deepEqual(contentOnly.problems, []);
    assert.equal(contentOnly.diagnostics.length, 1);
    await page.call(() => {
      const tools = document.createElement("span");
      tools.className = "home-header-tools";
      const select = document.createElement("select");
      select.style.cssText = "width:64px;height:60px;font-size:48px";
      const option = document.createElement("option");
      option.textContent = "A long native option";
      select.append(option); tools.append(select);
      document.querySelector("header").append(tools);
    });
    assert.deepEqual((await page.call(headerProbe)).problems, [], "native select text does not escape its visible box");
    await page.call(() => {
      const button = document.createElement("button");
      button.id = "blocker";
      const r = document.querySelector("header a").getBoundingClientRect();
      button.style.cssText = `position:absolute;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:9`;
      document.querySelector("header").append(button);
    });
    const covered = await page.call(headerProbe);
    assert.ok(covered.problems.some((p) => p.includes("@center")), "real overlap must still fail");
    await page.call(() => {
      document.querySelector("#blocker").remove();
      document.querySelector("header a").style.cssText = "position:absolute;left:1050px";
    });
    const overflowing = await page.call(headerProbe);
    assert.ok(overflowing.problems.some((p) => p.includes("header overflow")), "header overflow must still fail");
    console.log("Content-only overflow PASS; covered target FAIL; overflowing header FAIL");
  }
  if (mode === "normal") {
    assert.equal(await page.navigation(() => page.click(60, 20)), origin + "/next/");
    assert.equal(await page.navigation(() => page.click(60, 20)), origin + "/next/", "same-URL click must complete a real load");
  }
} catch (error) { console.error(error); process.exitCode = 1; }
finally {
  try { await browser?.close(); } catch (error) { console.error(error); process.exitCode = 1; }
  if (server) { server.closeAllConnections(); await new Promise((done) => server.close(done)); }
  console.log(`${mode}: exit=${process.exitCode ?? 0}, elapsed=${Math.round(performance.now() - start)}ms`);
}
