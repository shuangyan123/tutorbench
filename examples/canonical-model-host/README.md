# Canonical model host examples

## Local Provider Host authorization (NV-02)

The OpenAI, Gemini and Chat Completions Node hosts require
`CANONICAL_MODEL_HOST_TOKEN`: a fresh cryptographically random 32-byte value
encoded as 64 lowercase hex characters, separate from the Provider API key.
Missing/malformed configuration prevents startup; there is no public default.
Every `/generate` request needs `Authorization: Bearer <session capability>`.
This also applies to local no-auth upstreams: upstream and Host authorization
are separate boundaries.

Generate the capability in the parent shell without displaying it. Start the
Host and collector as child processes of that shell so they inherit it.
Never copy it into command arguments, URLs, committed files, reports or logs.
After configuring the chosen Provider as described below, a PowerShell session
can start the Host in a separate process and invoke the collector:

```powershell
$env:CANONICAL_MODEL_HOST_TOKEN = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
$hostProcess = Start-Process node -ArgumentList 'examples/canonical-model-host/openai-server.mjs' -WindowStyle Hidden -PassThru
try {
  node dist/src/cli/tutorbench.js collect-model --http http://127.0.0.1:9001/generate --provider openai --model $env:OPENAI_MODEL --limit 1
} finally {
  Stop-Process -Id $hostProcess.Id
  Remove-Item Env:CANONICAL_MODEL_HOST_TOKEN
}
```

Substitute the corresponding Gemini or Chat Completions entry point and model.
Build first. Provider calls in this example are live and require explicit
operator authorization; automated tests use fake Providers only.
Stop the Host and discard the environment value after the session; generate a
new capability for each later session. Clearing a parent's environment does not
revoke a still-running child's copy. Never reuse Provider credentials. Local
users/processes able to inspect Host memory or environment remain trusted.

Live `collect-model` now requires the environment capability. Dry-run needs
none and sends no request. Programmatic `createHttpTutorExecutionHost` callers
pass `sessionToken` explicitly. It is private client state, never packet, corpus
or report data. Credentialed clients reject redirects, URL queries/fragments,
and non-loopback cleartext HTTP. The generic canonical client can omit the
option for independently secured external implementations; these three example
Hosts always reject omitted credentials. Product HTTP adapter authentication,
packet identity, generation controls and scoring are unchanged.

Each Host remains bound to `127.0.0.1`. Before packet reads it validates the
real socket's listening port against exactly `127.0.0.1:<port>` or
`localhost:<port>`, rejects every Origin header (including empty and null),
checks the capability in constant time, and requires application/json
(optionally UTF-8 charset). Proxy headers do not override Host validation.
No browser CORS permission is added. Header rejections close the connection
without waiting for or buffering the complete packet.

See [the offline browser verification procedure](../../docs/canonical-host-nv02-verification.md).

`server.py` is a synthetic Python standard-library protocol fixture for the
advanced canonical execution boundary. It accepts one `TutorExecutionPacket`
request, reads the exact messages and generation spec, and returns sanitized
output plus the existing execution-support attestation shape. It never calls a
provider and must not be described as real-model evidence.

`openai-server.mjs` is a separate, local-only OpenAI Responses API integration
example. It is intentionally outside `src/` and the package runtime. It reads
the canonical packet through the built contract parser, forwards
`packet.cases[0].messages` without adding instructions or other messages, maps
`maxOutputTokens` to `max_output_tokens`, sets `store: false`, disables SDK
retries, and returns only Tutor-visible text plus sanitized usage and latency.
It does not enable streaming, background mode, tools, search, memory, or
provider fallback.

Run the synthetic fixture locally:

```bash
python examples/canonical-model-host/server.py
```

Run the OpenAI host from a repository checkout after building the contracts:

```powershell
npm run build
$env:OPENAI_API_KEY = "<configure locally; do not commit>"
$env:OPENAI_MODEL = "<exact provider model id>"
node examples/canonical-model-host/openai-server.mjs
```

Optional local configuration is `OPENAI_BASE_URL` (defaults to
`https://api.openai.com/v1`), `OPENAI_TIMEOUT_MS` (defaults to `30000`), and
`CANONICAL_MODEL_HOST_PORT` (defaults to `9001`). Credentials are read only
from the process environment and are never written to packets, reports,
corpora, logs, or HTTP responses.

The provider-neutral `chat-completions-server.mjs` sends
`reasoning_split: true` only when `TUTOR_MODEL_REASONING_SPLIT=enabled`. Set
`TUTOR_MODEL_REQUIRE_REASONING_SEPARATION=true` for a fail-closed rejection of
unsplit `<think>...</think>` content. The host always returns only final
`message.content`; provider reasoning fields and payload metadata do not enter
the Tutor response or corpus.

For a local OpenAI-compatible server that does not require authentication, set
`TUTOR_MODEL_AUTH_MODE=none` and point `TUTOR_MODEL_BASE_URL` at loopback
(`localhost`, `127.0.0.1`, or `::1`). In that mode
`TUTOR_MODEL_API_KEY` is not required and the bridge sends no Authorization
header. No-auth mode is rejected for non-loopback URLs so this convenience
cannot silently weaken a remote-provider credential boundary.

Example for a local OpenAI-compatible endpoint:

```powershell
$env:TUTOR_MODEL_AUTH_MODE = "none"
$env:TUTOR_MODEL_BASE_URL = "http://127.0.0.1:11434/v1"
$env:TUTOR_MODEL = "<exact local model id>"
$env:TUTOR_MODEL_API_PATH = "/chat/completions"
$env:TUTOR_MODEL_MAX_OUTPUT_TOKENS_FIELD = "max_tokens"
$env:TUTOR_MODEL_REASONING_SPLIT = "disabled"
$env:TUTOR_MODEL_REQUIRE_REASONING_SEPARATION = "false"
node examples/canonical-model-host/chat-completions-server.mjs
```

The local server remains outside Benchmark Core. A genuine local model run can
produce preliminary `recorded_model` evidence without paid API quota, but it
is still uncalibrated and not leaderboard-eligible. Synthetic/fake local
servers remain test fixtures and must not be represented as model evidence.

In another terminal, first perform the required dry-run, then a 1–3 case smoke
run, and only after reviewing it consider the complete 24-case run. The exact
sequence and ignored artifact paths are documented in
[`docs/first-real-baseline.md`](../../docs/first-real-baseline.md).

## Google AI Studio Gemini host

`gemini-server.mjs` uses the official [`@google/genai` SDK](https://github.com/googleapis/js-genai),
exactly pinned to **2.30.0** as a development dependency in the root manifest
and lockfile. It is checkout-only: the SDK is absent from Benchmark Core,
browser code, and the published package's runtime dependencies. Use Node 24
and `npm ci`; do not install the deprecated `@google/generativeai` package.

The host uses **Gemini Developer API**, with `vertexai: false` and a fixed
`https://generativelanguage.googleapis.com/v1beta` endpoint. It reads only
`GEMINI_API_KEY`, `GEMINI_MODEL`, optional `GEMINI_TIMEOUT_MS` (default `60000`,
positive integer up to `2147483647`), `CANONICAL_MODEL_HOST_PORT` (default
`9001`), and the opt-in `GEMINI_HOST_DIAGNOSTICS` flag described below. SDK
cloud/backend/base-URL environment settings cannot redirect this
host. It binds only `127.0.0.1` and is a local operator example, without a
remote hosting/authentication boundary.

Prepare and dry-run in PowerShell; **no key or running host is needed**:

```powershell
npm ci
npm run build
$env:GEMINI_MODEL = "<explicit versioned Gemini model ID>"
node dist/src/cli/tutorbench.js collect-model `
  --http http://127.0.0.1:9001/generate `
  --provider google `
  --model $env:GEMINI_MODEL `
  --limit 1 `
  --dry-run
```

Choose the currently available explicit model ID from Google's
[model documentation](https://ai.google.dev/gemini-api/docs/models). There is
no default model. The host rejects `latest`, unversioned aliases and resource
paths. A versioned stable name (for example `gemini-2.5-flash` in synthetic
tests) is **not an immutable weights snapshot**: Google can update or retire
models. Match collector `--model` to `GEMINI_MODEL`; use `--model-version` only
for independently verified snapshot information, never an invented version.
Provider `modelVersion` metadata is not copied into the corpus or inferred as
a pinned snapshot. No live model availability/compatibility was established
by these offline tests.

Only after separate authorization for a **potentially billable live smoke**,
start the host in a dedicated terminal using a locally configured AI Studio
key (never paste a real key into chat/source/committed files):

```powershell
# Configure GEMINI_API_KEY securely in this local process first.
$env:GEMINI_MODEL = "<same explicit versioned Gemini model ID>"
$env:GEMINI_TIMEOUT_MS = "60000"
node examples/canonical-model-host/gemini-server.mjs
```

Starting the process makes no provider call. An authorized live `/generate`
or `collect-model` invocation does. In another terminal, first repeat the
dry-run above, then deliberately invoke the bounded live collection:

```powershell
$env:GEMINI_MODEL = "<same explicit versioned Gemini model ID>"
node dist/src/cli/tutorbench.js collect-model `
  --http http://127.0.0.1:9001/generate `
  --provider google `
  --model $env:GEMINI_MODEL `
  --timeout-ms 65000 `
  --limit 1 `
  --corpus-id preliminary-google-gemini-smoke-001 `
  --output artifacts/real-model/preliminary-google-gemini-smoke-001.corpus.json `
  --report artifacts/real-model/preliminary-google-gemini-smoke-001.report.json
```

The collector timeout should exceed the host deadline. An abort is a local
deadline, not proof that Google cancelled generation or billing. Inspect the
one-case result before authorizing further calls; no automatic retry occurs.
`--resume` is a new deliberate invocation and may incur another charge for a
previously failed case. Artifacts remain ignored, preliminary, uncalibrated,
and ineligible for public leaderboards. This host enables a model under test;
Gemini Judge integration, calibration, P-001, and publication are separate work.

### Forwarding and failures

The existing packet parser validates the prompt digest and hidden-data
firewall. One leading system message maps exactly to `systemInstruction`;
every later user/assistant message becomes its own `Content` with role
`user`/`model` and one text part. This preserves content, whitespace, order,
and adjacent user messages (including canonical visible context), without
flattening. Later system messages or consecutive assistant messages fail
before any SDK call.

The host calls [`models.generateContent`](https://googleapis.github.io/js-genai/release_docs/classes/models.Models.html)
once with `candidateCount: 1`, `responseModalities: ["TEXT"]`, and the packet's
exact `maxOutputTokens`. It attests only `{ maxOutputTokens: true }`.
Requested `temperature`, `seed`, or `reasoningEffort` fail closed with
`unsupported_generation_control`; no model-specific sampling/reasoning
support is assumed. Native thinking defaults remain in effect. No extra
prompt, tool, grounding, safety override, cache, interaction/session, or
provider storage API is used.

SDK 2.30.0 supports automatic continuation as well as retries. The host sets
`automaticContinuation: false`, `automaticFunctionCalling.disable: true`, and
[`httpOptions.retryOptions.attempts: 1`](https://googleapis.github.io/js-genai/release_docs/interfaces/types.HttpRetryOptions.html)
(the initial attempt counts). The host deadline races the complete SDK call
and passes its abort signal into the SDK; it cannot silently continue/retry.

The SDK's [`response.text`](https://googleapis.github.io/js-genai/release_docs/classes/types.GenerateContentResponse.html#text)
excludes thought parts, but also takes the first candidate and warns/ignores
non-text parts. This host instead validates exactly one intended candidate,
`STOP`, role `model`, no continuation token, and text-only parts before
concatenating only parts without `thought: true`. Thoughts, signatures,
provider IDs, metadata, and error bodies never enter output/logs/artifacts.
Blank, blocked, thought-only, tool/non-text, and abnormal-finish results fail
with `provider_response_invalid`; `MAX_TOKENS` fails with
`provider_response_truncated` (collector `execution_output_truncated`). No
partial answer is recorded as success.

401/403/429/5xx map to `provider_unauthorized`, `provider_forbidden`,
`provider_rate_limited`, and `provider_server_error`. Other HTTP failures,
transport errors, and deadline expiry use `provider_http_error`,
`provider_request_failed`, and `provider_request_timeout`. Responses contain
only these bounded codes. Invalid packet/configuration values are never
echoed. The existing HTTP adapter and collector preserve their corresponding
stable failure classifications.

### Opt-in local failure diagnostics

Only the exact `GEMINI_HOST_DIAGNOSTICS=1` enables diagnostics. All other
values (including an unset flag) keep failure diagnostics silent. Successes
produce no diagnostic event. The existing startup notice and configuration
error messages are unchanged. In a dedicated PowerShell host terminal:

```powershell
# Configure GEMINI_API_KEY securely in this process; never print it.
$env:GEMINI_MODEL = "<explicit versioned Gemini model ID>"
$env:GEMINI_HOST_DIAGNOSTICS = "1"
node examples/canonical-model-host/gemini-server.mjs
# To disable on the next startup:
# Remove-Item Env:GEMINI_HOST_DIAGNOSTICS
```

Starting this host does not call Google. Do not send `/generate`, replay or
resume a prior failed smoke without separate live-call authorization. This
diagnostic change authorizes no further live attempt and does not establish
the cause of a historical `execution_http_error`.

Each relevant failure writes one JSON line to **the host's local stderr**,
for example this **synthetic** upstream rejection:

```json
{"event":"gemini_host_failure","stage":"sdk_request","category":"http","code":"provider_http_error","upstreamStatus":404}
```

The only fields are `event`, `stage`, `category`, `code`, and
`upstreamStatus`. Stages/categories distinguish:

| Stage | Category | Meaning |
| --- | --- | --- |
| `local_request` | `request_rejected` | Wrong method/path, malformed JSON, oversized or unreadable body; no SDK call |
| `local_packet` | `request_rejected` | Packet/parser, message-role or unsupported-control rejection; no SDK call |
| `sdk_request` | `http` | SDK `ApiError` with an integer HTTP status from 400 through 599 |
| `sdk_request` | `timeout` | Host deadline expired; upstream status unknown |
| `sdk_request` | `transport_or_sdk` | Transport or otherwise unclassified SDK failure; upstream status unknown |
| `sdk_response` | `response_validation` | SDK JSON parsing or host response validation/truncation failure |
| `host` | `unknown` | Unclassified local handler failure |

`upstreamStatus` is `null` unless a trustworthy integer is available from
the SDK's [`ApiError.status`](https://googleapis.github.io/js-genai/release_docs/classes/errors.ApiError.html#status).
The host never parses messages, nested causes, response bodies, or arbitrary
errors' `status` properties to infer a status. If the SDK fails parsing an
HTTP error body before constructing `ApiError`, the status remains unknown.
`transport_or_sdk` deliberately does not assert a network-only root cause.
Codes are existing bounded host failure codes. The HTTP response and
collector failure classifications are unchanged; no diagnostic fields are
added to packets, reports, corpora, or `artifacts`. Do not redirect these
events into collection artifacts. Logging does not retry, continue, change
models, or call Judge; failure to write diagnostics does not change the
original response.

Events contain no request/response text, generated answers, hidden thoughts,
signatures, raw payload, SDK message/cause/stack, URL/query, headers,
API key, bearer token, or proxy credentials. No raw provider logging is
enabled. Offline tests use the real pinned SDK and an injected fake fetch;
they prove diagnostic behavior, not live compatibility or billing outcomes.

### Optional Node 24 proxy startup

For an authorized operator environment that requires a trusted HTTP proxy,
Node 24 supports explicit [`--use-env-proxy`](https://nodejs.org/docs/latest-v24.x/api/cli.html#--use-env-proxy)
startup. Configure only that dedicated host process; these are placeholders,
not a personal proxy address or credentials:

```powershell
$env:HTTP_PROXY = "http://<trusted-proxy-host>:<port>"
$env:HTTPS_PROXY = "http://<trusted-proxy-host>:<port>"
$env:NO_PROXY = "localhost,127.0.0.1,::1"
$env:GEMINI_HOST_DIAGNOSTICS = "1"
node --use-env-proxy examples/canonical-model-host/gemini-server.mjs
```

Keep loopback collector-to-host traffic out of the proxy. Do not print proxy
variables or include real proxy credentials in source, logs or artifacts.
An unauthenticated HTTP **404 at the API root** is only a connectivity
smoke: it does not validate an API key, model availability, the generation
route, a successful model invocation, or live SDK compatibility. These
offline tests do not exercise proxy routing. A local timeout/abort is never
proof that upstream generation stopped or no billing occurred.

Usage copies only nonnegative safe integer `promptTokenCount`,
`candidatesTokenCount`, and `totalTokenCount` to input/output/total counts
when present. Missing counts remain absent. `thoughtsTokenCount` is not
exported or added to visible-output tokens; total usage can include billed
thinking tokens, so input plus output need not equal total. Consult Google's
[thinking documentation](https://ai.google.dev/gemini-api/docs/thinking) and
[pricing](https://ai.google.dev/gemini-api/docs/pricing) before a live run.

Offline verification uses the real pinned SDK with an injected fake fetch,
plus the existing HTTP host adapter and canonical collector. It neither
contacts Google nor proves live-provider compatibility:

```powershell
npm run build
node --test dist/tests/gemini-canonical-model-host.test.js
node --test dist/tests/gemini-host-diagnostics.test.js
```
