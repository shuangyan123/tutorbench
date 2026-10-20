// Dependency-free CDP transport shared by the hit test and its fault tests.
import { execFile, spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const found = spawnSync("which", [name], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error("No Chrome/Chromium found. Set CHROME_PATH to a Chromium-based browser.");
}

// 超时与断连共用一个失败出口，同时取消请求和事件等待，避免孤立的 Promise。
export async function launchBrowser(executable, {
  requestMs = 10000, startupMs = 20000, shutdownMs = 3000,
  createSocket = (url) => new globalThis.WebSocket(url),
  profileRoot = tmpdir(),
} = {}) {
  const profile = await mkdtemp(join(profileRoot, "website-hit-test-"));
  const pending = new Map();
  const watchers = new Set();
  let child, socket, failure, closing = false, closePromise;
  let nextId = 0;
  let exited = false;
  let termination, terminationError;
  let resolveExit;
  const exit = new Promise((done) => { resolveExit = done; });
  const terminate = () => termination ??= (async () => {
    if (!child?.pid || exited) return;
    if (process.platform === "win32") {
      // PID is from our spawn, never a name match or a shared browser process.
      await new Promise((done) => execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], { timeout: 2000, windowsHide: true }, (error) => {
        // Descendants may exit while taskkill enumerates the tree. A nonzero
        // status alone is inconclusive; require the owned root's exit below.
        if (error && !exited) { terminationError = error; child.kill("SIGKILL"); }
        done();
      }));
    } else {
      try { process.kill(-child.pid, "SIGKILL"); }
      catch (error) { if (error.code !== "ESRCH") throw error; }
    }
  })();
  const fail = (error) => {
    failure ??= error;
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); }
    pending.clear();
    for (const item of [...watchers]) item.reject(error);
  };
  const waitFor = (predicate, label, timeoutMs = requestMs) => {
    let watcher, timer;
    const cancel = () => { clearTimeout(timer); watchers.delete(watcher); };
    const promise = new Promise((resolve, reject) => {
      watcher = {
        accept(message) { if (predicate(message)) { cancel(); resolve(message); } },
        reject(error) { cancel(); reject(error); },
      };
      if (failure) { reject(failure); return; }
      watchers.add(watcher);
      timer = setTimeout(() => watcher.reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    // The event may fail while the triggering CDP command is still pending.
    promise.catch(() => {});
    return { promise, cancel };
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    if (failure) { reject(failure); return; }
    const id = ++nextId;
    const timer = setTimeout(() => fail(new Error(`CDP ${method} (${id}, session ${sessionId ?? "browser"}) timed out after ${requestMs}ms`)), requestMs);
    pending.set(id, { resolve, reject, timer });
    try { socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }
    catch (error) { fail(new Error(`CDP ${method}: ${error.message}`, { cause: error })); }
  });
  const close = () => closePromise ??= (async () => {
    closing = true;
    const cleanupErrors = [];
    let forced = false;
    // 强制终止的计时必须先于 Browser.close；即使连接已坏也能结束自建进程。
    const force = setTimeout(() => {
      if (!exited) { forced = true; void terminate().catch((error) => cleanupErrors.push(error)); }
    }, shutdownMs);
    const deadlineMs = shutdownMs + 3000;
    const deadline = setTimeout(() => {
      fail(new Error(`Browser cleanup exceeded ${deadlineMs}ms`));
      resolveExit();
    }, deadlineMs);
    try {
      if (child && !exited) {
        if (socket?.readyState === 1 && !failure) {
          // Browser.close may close the transport before acknowledging the command.
          void send("Browser.close").catch((error) => {
            if (!exited && !/WebSocket closed/.test(error.message)) cleanupErrors.push(error);
          });
        } else await terminate();
        await exit;
      }
      if (termination) await termination;
      if (child && !exited) {
        await terminate();
        child.stderr?.destroy();
        child.unref();
        cleanupErrors.push(new Error("Browser did not exit within cleanup deadline", { cause: terminationError }));
      }
    } finally {
      clearTimeout(force); clearTimeout(deadline);
      fail(failure ?? new Error("Browser closed"));
      socket?.close();
      // Chromium descendants can briefly retain the inherited stderr pipe after
      // the root process exits. Do not let that pipe keep the Node runner alive.
      child?.stderr?.destroy();
      child?.unref();
      // profile is exclusively the mkdtemp result above; never accept a user profile.
      try {
        await new Promise((done, reject) => {
          const timer = setTimeout(() => reject(new Error("Owned profile cleanup timed out after 3000ms")), 3000);
          rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
            .then(done, reject).finally(() => clearTimeout(timer));
        });
      }
      catch (error) { cleanupErrors.push(new Error(`Could not remove owned profile ${profile}`, { cause: error })); }
    }
    if (forced) cleanupErrors.push(new Error(`Browser required forced termination after ${shutdownMs}ms`));
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "Browser cleanup failed");
  })();
  try {
    const endpoint = waitFor((m) => m.endpoint, "Browser startup", startupMs);
    // --disable-ipc-flooding-protection: Chrome silently drops a frame's history
    // navigations after about 200 in ten seconds. The letter's fast Back/Forward
    // checks run faster than any person, so without it their own steps vanish.
    child = spawn(executable, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-background-networking", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--disable-ipc-flooding-protection", "about:blank"], { stdio: ["ignore", "ignore", "pipe"], detached: process.platform !== "win32", windowsHide: true });
    child.once("error", (error) => {
      exited = true; resolveExit(); fail(new Error(`Browser launch failed: ${error.message}`, { cause: error }));
    });
    child.once("exit", (code, signal) => {
      exited = true; resolveExit();
      fail(new Error(`Browser ${closing ? "closed" : "exited unexpectedly"} (code ${code}, signal ${signal})`));
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-16000);
      const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/u);
      if (match) for (const watcher of [...watchers]) watcher.accept({ endpoint: match[1] });
    });
    const { endpoint: url } = await endpoint.promise;
    const connected = waitFor((m) => m.connected, "CDP WebSocket connection", startupMs);
    socket = createSocket(url);
    socket.addEventListener("open", () => { for (const w of [...watchers]) w.accept({ connected: true }); });
    socket.addEventListener("close", (event) => fail(new Error(`CDP WebSocket closed (${event.code})`)));
    socket.addEventListener("error", () => fail(new Error("CDP WebSocket error")));
    socket.addEventListener("message", ({ data }) => {
      try {
        const message = JSON.parse(String(data));
        const item = pending.get(message.id);
        if (item) {
          clearTimeout(item.timer); pending.delete(message.id);
          if (message.error) item.reject(new Error(`CDP error: ${message.error.message}`));
          else item.resolve(message.result);
        } else for (const w of [...watchers]) w.accept(message);
      } catch (error) { fail(new Error("Invalid CDP message", { cause: error })); }
    });
    await connected.promise;
    return { send, waitFor, close, profile, process: child, get failure() { return failure; } };
  } catch (error) {
    try { await close(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], "Browser startup and cleanup failed", { cause: cleanupError }); }
    throw error;
  }
}

export async function openPage(browser, { loadMs = 10000 } = {}) {
  let scriptsEnabled = true;
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => browser.send(method, params, sessionId);
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  const call = async (fn, ...args) => {
    const { result: global } = await send("Runtime.evaluate", { expression: "globalThis" });
    const { result, exceptionDetails } = await send("Runtime.callFunctionOn", {
      objectId: global.objectId, functionDeclaration: fn.toString(),
      arguments: args.map((value) => ({ value })), returnByValue: true, awaitPromise: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  // Disabled author scripts also suppress animation-frame callbacks in CDP.
  // The completed load and synchronous geometry read suffice for static pages.
  const settled = () => scriptsEnabled
    ? evaluate("document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))))")
    : Promise.resolve();
  const navigation = async (action) => {
    // Subscribe before the action, including same-URL reloads: an unchanged URL is not proof of a click.
    const loaded = browser.waitFor((m) => m.sessionId === sessionId && m.method === "Page.loadEventFired", "Page load", loadMs);
    const response = browser.waitFor((m) => m.sessionId === sessionId && m.method === "Network.responseReceived" && m.params.type === "Document", "Document response", loadMs);
    try {
      const [, , message] = await Promise.all([action(), loaded.promise, response.promise]);
      const { status, url } = message.params.response;
      if (status < 200 || status >= 400) throw new Error(`Navigation returned HTTP ${status}: ${url}`);
      await settled();
      return await evaluate("location.href");
    } finally { loaded.cancel(); response.cancel(); }
  };
  return {
    send, evaluate, call, settled, navigation,
    async setJavaScriptEnabled(enabled) {
      await send("Emulation.setScriptExecutionDisabled", { value: !enabled });
      scriptsEnabled = enabled;
    },
    viewport: (width, height) => send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }),
    goto: (url) => navigation(async () => {
      const result = await send("Page.navigate", { url });
      if (result.errorText) throw new Error(`Navigation failed: ${result.errorText}: ${url}`);
    }),
    async click(x, y) {
      const base = { x, y, button: "left", clickCount: 1 };
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", ...base });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...base });
    },
  };
}
