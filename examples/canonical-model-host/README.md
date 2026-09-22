# Canonical model host examples

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
