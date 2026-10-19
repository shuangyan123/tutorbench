import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const driver = fileURLToPath(new URL("./fixtures/website-browser-fault.mjs", import.meta.url));
const modes = [
  ["normal", 0, /normal: exit=0/],
  ["startup-missing", 1, /Browser launch failed/],
  ["startup-exit", 1, /Browser exited unexpectedly/],
  ["disconnect", 1, /WebSocket closed/],
  ["socket-error", 1, /WebSocket error/],
  ["crash", 1, /Browser exited unexpectedly|WebSocket closed|WebSocket error/],
  ["pending-timeout", 1, /CDP Runtime.evaluate .* timed out/],
  ["navigation-stall", 1, /Page load timed out/],
  ["click-noop", 1, /Page load timed out|Document response timed out/],
  ["http-error", 1, /Navigation returned HTTP 404/],
  ["close-stalled", 1, /forced termination/],
  ["geometry", 0, /Content-only overflow PASS; covered target FAIL; overflowing header FAIL/],
  ["nojs-navigation", 0, /nojs-navigation: exit=0/],
];

for (const [mode, expectedCode, diagnostic] of modes) {
  test(`real Chrome lifecycle: ${mode}`, { timeout: 45000 }, async () => {
    // Only this fresh test directory is removed; the marker guards sibling data.
    const root = await mkdtemp(join(tmpdir(), "website-fault-test-"));
    await writeFile(join(root, "unrelated-marker"), "preserve");
    const child = spawn(process.execPath, [driver, mode, root], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "", watchdogFired = false;
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const watchdog = setTimeout(() => { watchdogFired = true; child.kill("SIGKILL"); }, 40000);
    let testError, cleanupFailure;
    try {
      const code = await new Promise((done, fail) => { child.once("error", fail); child.once("close", done); });
      assert.equal(watchdogFired, false, `fixture required external termination:\n${output}`);
      assert.equal(code, expectedCode, output);
      assert.match(output, diagnostic);
      assert.equal(await readFile(join(root, "unrelated-marker"), "utf8"), "preserve");
      assert.deepEqual(await readdir(root), ["unrelated-marker"], `owned profiles leaked:\n${output}`);
      console.log(output.split("\n").find((line) => line.startsWith(`${mode}:`)));
    } catch (error) { testError = error; }
    finally {
      clearTimeout(watchdog);
      try { await rm(root, { recursive: true, force: true }); }
      catch (error) { cleanupFailure = error; }
    }
    if (testError && cleanupFailure) throw new AggregateError([testError, cleanupFailure], "Fault assertion and fixture cleanup failed");
    if (testError) throw testError;
    if (cleanupFailure) throw cleanupFailure;
  });
}
