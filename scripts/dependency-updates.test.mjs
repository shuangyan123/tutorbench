import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { TextDecoder, TextEncoder } from "node:util";
import { atob, btoa } from "node:buffer";
import { webcrypto } from "node:crypto";
import { URLSearchParams } from "node:url";
import { buildCommunityReviewPortal } from "./community-review-portal-build.mjs";

const sdkName = "@auth0/auth0-spa-js";
const license = "MIT License\nPermission is hereby granted to use this synthetic fixture.\n";

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "tutorbench-sdk-metadata-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sdk = path.join(root, "node_modules", sdkName);
  const source = path.join(root, "services/community-review-service/portal-src");
  const output = path.join(root, "services/community-review-service/dist/portal");
  await mkdir(path.join(sdk, "dist"), { recursive: true });
  await mkdir(source, { recursive: true });
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "previous-build"), "preserved");
  await writeFile(path.join(root, "package.json"), JSON.stringify({ devDependencies: { [sdkName]: "9.8.7" } }));
  await writeFile(path.join(sdk, "package.json"), JSON.stringify({ name: sdkName, version: "9.8.7", license: "MIT" }));
  await writeFile(path.join(sdk, "dist/auth0-spa-js.production.js"), "fixture();\n//# sourceMappingURL=sdk.js.map\n");
  await writeFile(path.join(sdk, "LICENSE"), license);
  for (const file of ["index.html", "portal.js", "portal.css", "favicon.svg"]) {
    await writeFile(path.join(source, file), file);
  }
  return { root, sdk, output };
}

test("portal build follows the manifest exact version and copies only fixed assets", async (t) => {
  const { root, output } = await fixture(t);
  assert.equal((await buildCommunityReviewPortal(root)).auth0SpaSdk, "9.8.7");
  assert.deepEqual((await readdir(output)).sort(), ["favicon.svg", "index.html", "portal.css", "portal.js", "vendor"]);
  assert.deepEqual((await readdir(path.join(output, "vendor"))).sort(), ["auth0-spa-js.LICENSE.txt", "auth0-spa-js.js"]);
  assert.equal(await readFile(path.join(output, "vendor/auth0-spa-js.js"), "utf8"), "fixture();");
  assert.equal(await readFile(path.join(output, "vendor/auth0-spa-js.LICENSE.txt"), "utf8"), license);
});

test("portal build fails closed for invalid metadata, version drift, license and source maps", async (t) => {
  const cases = [
    ["version mismatch", "sdk", { name: sdkName, version: "9.8.6", license: "MIT" }],
    ["wrong package", "sdk", { name: "other-package", version: "9.8.7", license: "MIT" }],
    ["wrong license", "sdk", { name: sdkName, version: "9.8.7", license: "Apache-2.0" }],
    ["null package", "sdk", null],
    ["invalid package JSON", "sdk", "{"],
    ["missing dependency", "manifest", {}],
    ["range dependency", "manifest", { devDependencies: { [sdkName]: "^9.8.7" } }],
    ["tag dependency", "manifest", { devDependencies: { [sdkName]: "latest" } }],
    ["null manifest", "manifest", null],
    ["invalid manifest JSON", "manifest", "{"],
    ["invalid license file", "LICENSE", "unlicensed"],
    ["unexpected source map", "dist/auth0-spa-js.production.js", "//# sourceMappingURL=unexpected.map\nfixture();"],
    ["missing production entry", "dist/auth0-spa-js.production.js", undefined],
  ];
  for (const [name, target, value] of cases) {
    await t.test(name, async (subtest) => {
      const { root, sdk, output } = await fixture(subtest);
      const file = target === "manifest" ? path.join(root, "package.json")
        : path.join(sdk, target === "sdk" ? "package.json" : target);
      if (value === undefined) await rm(file);
      else await writeFile(file, typeof value === "string" ? value : JSON.stringify(value));
      await assert.rejects(buildCommunityReviewPortal(root));
      assert.deepEqual(await readdir(output), ["previous-build"]);
      assert.equal(await readFile(path.join(output, "previous-build"), "utf8"), "preserved");
    });
  }
});

test("installed Auth0 production bundle retains the browser entry and license without source maps", async () => {
  await buildCommunityReviewPortal();
  const output = path.resolve("services/community-review-service/dist/portal/vendor");
  const bundle = await readFile(path.join(output, "auth0-spa-js.js"), "utf8");
  assert.doesNotMatch(bundle, /(?:^|\r?\n)\s*\/\/# sourceMappingURL=/u);
  const sandbox = { TextDecoder, TextEncoder, URL, AbortController };
  runInNewContext(bundle, sandbox, { timeout: 5000 });
  assert.equal(typeof sandbox.auth0.Auth0Client, "function");
  for (const method of ["loginWithRedirect", "handleRedirectCallback", "getTokenSilently", "isAuthenticated", "logout"]) {
    assert.equal(typeof sandbox.auth0.Auth0Client.prototype[method], "function");
  }
  assert.equal(await readFile(path.join(output, "auth0-spa-js.LICENSE.txt"), "utf8"),
    await readFile("node_modules/@auth0/auth0-spa-js/LICENSE", "utf8"));
});

test("real Auth0 bundle preserves offline PKCE login without creating an anonymous session", async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  let networkCalls = 0;
  const network = async () => { networkCalls += 1; throw new Error("Network forbidden"); };
  const document = { cookie: "" };
  const sandbox = {
    TextEncoder, TextDecoder, URL, URLSearchParams, AbortController, atob, btoa, crypto: webcrypto,
    navigator: { userAgent: "synthetic-test" }, fetch: network, document,
    sessionStorage: storage, localStorage: storage,
    window: {
      fetch: network, crypto: webcrypto, atob, btoa, document,
      location: { origin: "https://portal.example.invalid", href: "https://portal.example.invalid/reviewer/" },
      sessionStorage: storage, localStorage: storage,
    },
  };
  const bundle = await readFile("services/community-review-service/dist/portal/vendor/auth0-spa-js.js", "utf8");
  runInNewContext(bundle, sandbox, { timeout: 5000 });
  const client = new sandbox.auth0.Auth0Client({
    domain: "tenant.example.invalid", clientId: "synthetic-spa", cacheLocation: "memory", useRefreshTokens: false,
    authorizationParams: { audience: "https://api.example.invalid/reviewer", scope: "reviewer:portal",
      redirect_uri: "https://portal.example.invalid/reviewer/callback" },
  });
  assert.equal(await client.getTokenSilently({ cacheMode: "cache-only" }), undefined);
  let authorizeUrl;
  await client.loginWithRedirect({ openUrl: async (url) => { authorizeUrl = new URL(url); } });
  assert.equal(authorizeUrl.origin, "https://tenant.example.invalid");
  assert.equal(authorizeUrl.pathname, "/authorize");
  assert.equal(authorizeUrl.searchParams.get("response_type"), "code");
  assert.equal(authorizeUrl.searchParams.get("code_challenge_method"), "S256");
  assert.ok(authorizeUrl.searchParams.get("code_challenge"));
  assert.ok(authorizeUrl.searchParams.get("state"));
  assert.ok(authorizeUrl.searchParams.get("nonce"));
  assert.equal(authorizeUrl.searchParams.get("audience"), "https://api.example.invalid/reviewer");
  assert.equal(authorizeUrl.searchParams.get("redirect_uri"), "https://portal.example.invalid/reviewer/callback");
  assert.equal(authorizeUrl.searchParams.get("scope"), "openid reviewer:portal");
  assert.equal(authorizeUrl.searchParams.has("anon_transfer_token"), false);
  assert.equal(networkCalls, 0);
});

function element() {
  return {
    children: [], textContent: "", handlers: {},
    appendChild(child) { this.children.push(child); },
    replaceChildren() { this.children = []; },
    setAttribute() {}, removeAttribute() {},
    addEventListener(event, handler) { this.handlers[event] = handler; },
  };
}

async function portalHarness({ callback = false, callbackError = false, tokenError = false, sessionStatus = 200 } = {}) {
  const status = element();
  const state = element();
  const calls = [];
  const config = {
    enabled: true, issuer: "https://tenant.example.invalid/", clientId: "synthetic-spa",
    audience: "https://api.example.invalid/reviewer", scope: "reviewer:portal",
    portalPath: "/reviewer/", callbackPath: "/reviewer/callback",
  };
  class Auth0Client {
    constructor(options) { calls.push(["options", options]); }
    async isAuthenticated() { return true; }
    async handleRedirectCallback() {
      calls.push(["callback"]);
      if (callbackError) throw new Error("synthetic callback failure");
    }
    async getTokenSilently(options) {
      calls.push(["token", options]);
      if (tokenError) throw new Error("synthetic token failure");
      return "synthetic-access-token";
    }
    async loginWithRedirect(options) { calls.push(["login", options]); }
    async logout(options) { calls.push(["logout", options]); }
  }
  const sandbox = {
    URL,
    document: { title: "Synthetic portal", getElementById: (id) => id === "portal-status" ? status : state, createElement: element },
    window: {
      auth0: { Auth0Client },
      location: { origin: "https://portal.example.invalid", pathname: callback ? config.callbackPath : config.portalPath, search: callback ? "?code=synthetic&state=synthetic" : "" },
      history: { replaceState: (...args) => calls.push(["clean-url", ...args]) },
    },
    fetch: async (url, options) => {
      calls.push([url, options]);
      assert.ok(["/reviewer/config.json", "/v1/reviewer/session"].includes(url));
      return { ok: url.endsWith("config.json") || sessionStatus === 200, status: sessionStatus,
        json: async () => url.endsWith("config.json") ? config : { data: { reviewerAccess: "ENABLED" } } };
    },
  };
  const source = await readFile("services/community-review-service/portal-src/portal.js", "utf8");
  // 仅在隔离 VM 中暴露初始化 Promise；所有 SDK/HTTP 交互都是 synthetic mock。
  assert.ok(source.includes("void initialize();"));
  runInNewContext(source.replace("void initialize();", "globalThis.initialized = initialize();"), sandbox);
  await sandbox.initialized;
  return { status, state, calls, config };
}

test("portal authentication preserves memory-only cache, scoped callback, bootstrap and logout", async () => {
  const { status, state, calls, config } = await portalHarness({ callback: true });
  assert.equal(status.textContent, "Access verified");
  const options = calls.find(([name]) => name === "options")[1];
  assert.equal(options.cacheLocation, "memory");
  assert.equal(options.useRefreshTokens, false);
  assert.equal(options.authorizationParams.scope, config.scope);
  assert.equal(options.authorizationParams.audience, config.audience);
  assert.equal(options.authorizationParams.redirect_uri, "https://portal.example.invalid/reviewer/callback");
  assert.ok(calls.findIndex(([name]) => name === "clean-url") < calls.findIndex(([name]) => name === "token"));
  assert.equal(calls.find(([name]) => name === "token")[1].cacheMode, "cache-only");
  const session = calls.find(([name]) => name === "/v1/reviewer/session")[1];
  assert.equal(session.credentials, "omit");
  assert.equal(session.headers.Authorization, "Bearer synthetic-access-token");
  await state.children.at(-1).children[0].handlers.click();
  assert.equal(calls.find(([name]) => name === "logout")[1].logoutParams.returnTo, "https://portal.example.invalid/reviewer/");
});

test("portal authentication failures fail closed without exposing token or SDK error details", async (t) => {
  for (const options of [{ callback: true, callbackError: true }, { tokenError: true }, { sessionStatus: 401 }, { sessionStatus: 403 }]) {
    await t.test(JSON.stringify(options), async () => {
      const { status, calls, state } = await portalHarness(options);
      assert.notEqual(status.textContent, "Access verified");
      if (options.callbackError || options.tokenError) {
        assert.equal(calls.some(([name]) => name === "/v1/reviewer/session"), false);
      }
      if (options.callbackError) assert.ok(calls.some(([name]) => name === "clean-url"));
      assert.doesNotMatch(JSON.stringify(state), /synthetic-access-token|synthetic callback failure|synthetic token failure/u);
      if (options.sessionStatus === 401) {
        await state.children.at(-1).children[0].handlers.click();
        assert.equal(calls.find(([name]) => name === "login")[1].authorizationParams.scope, "reviewer:portal");
      }
    });
  }
});

test("CodeQL init/analyze share a full SHA and version and Dependabot groups only those actions", async () => {
  const workflow = await readFile(".github/workflows/codeql.yml", "utf8");
  const actions = [...workflow.matchAll(/uses: github\/codeql-action\/(init|analyze)@([a-f0-9]{40}) # (v\d+\.\d+\.\d+)/gu)];
  assert.deepEqual(actions.map((match) => match[1]).sort(), ["analyze", "init"]);
  assert.equal(actions[0][2], actions[1][2]);
  assert.equal(actions[0][3], actions[1][3]);
  const dependabot = await readFile(".github/dependabot.yml", "utf8");
  assert.match(dependabot, /package-ecosystem: "github-actions"\s+groups:\s+codeql-action:\s+patterns:\s+- "github\/codeql-action\/init"\s+- "github\/codeql-action\/analyze"\s+directory: "\/"/u);
});
