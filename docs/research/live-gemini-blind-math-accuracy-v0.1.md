# Opt-in Gemini 3.8 Flash live math accuracy baseline (blind, source-separated)

**Research v0.1: safe model-execution wiring, not a measured Gemini score until a real run occurs.** This completes the connection from a frozen answer-free mathematical cohort to TutorBench's **existing** local canonical Gemini Host and the previously validated dual-path exact math adjudicator (PR #330). The research branch makes **zero external model calls in CI**, requires no reviewer, and does not change production TutorBench Judge scoring or any historical student evaluation.

## What the model actually receives

Six **identity- and model-frozen** real-language Chinese numerical problems about independent uniform draws with replacement. The suite has exactly one question **linked to a typed adaptation** of the 2025 New Gaokao I mathematics Q14 occupancy problem, and five new synthetic variations (expectation, variance, exact event, threshold event and zero-draw edge case). It does **not** contain answer keys, correct result strings, human annotations, or grader model responses.

Each one-case request uses the existing **TutorExecutionPacketFile v1** contract: pinned system prompt SHA-256, explicit generation spec (4096 max output tokens; no optional sampling controls), three role-valid messages, `locale=zh-CN`, and one case. The question generator only reads the typed mathematical **assumptions and requested metric**, never the independently calculated answer. It requests an integer, exact fraction or finite decimal **without any surrounding text**. `UNSURE` and mixed prose are *unverified*, not guessed to be mathematically correct.

The local Gemini Host implements explicit model version selection, single response validation, disabled SDK retries/continuation/tool calls, request timeout, session token separate from the provider API key, and restricted `127.0.0.1` binding. For `gemini-3.8-flash`, it now **requires an explicit `GEMINI_THINKING_LEVEL` (`low`, `medium` or `high`)** and sends native `thinkingConfig.thinkingLevel`. The baseline pins `medium`, instead of relying on the provider default. The new runner **reuses this Host** rather than adding a second API client.

### Required safety properties

- **Plan** is the default planning route and makes **zero model calls**; it does not read a secret or check the provider endpoint.
- Live calls only happen with the explicit `run --execute-live` command. The runner requires a 64-character random lowercase-hex `CANONICAL_MODEL_HOST_TOKEN` from the local environment, a pinned `gemini-3.8-flash` model ID, explicit `--thinking-level medium` (or `low`/`high`), a loopback-only `http://127.0.0.1:<port>/generate` address and an output file path.
- The output file is **reserved exclusively before any network requests** and must live within the repository's git-ignored `artifacts/` directory; an existing capture is never overwritten or silently retried, avoiding unintentional repeated costs.
- Each case gets one POST, no application-level retry. The host must return the expected canonical `output.text` and supported generation flags. HTTP failures and timeouts are counted separately; they **do not** imply a math mistake.
- The raw model text, full typed-question SHA-256, actual one-case packet SHA-256, host-reported timing and token counts, run UUID, UTC capture time, declared model, declared thinking level and 4096-token generation budget are written into an **ignored local** `artifacts/` JSON file. The session token and Google API credential are **never** serialized.
- `--model` and `--thinking-level` are **operator-declared** and must match the Host environment. The canonical Host response carries no provider-signed model or thinking-setting attestation, so the report sets `providerIdentityCryptographicallyVerified=false` and `thinkingLevelCryptographicallyVerified=false`. Its `generationConfig` is a locally recorded setting, **not** cryptographic verification.
- Mock HTTP tests may calculate numerators and denominators but **cannot** output a measured live AI accuracy: `executionProvenance=mock_transport` forces all displayed accuracy `value` fields to `null`.

### Metrics: never hide the denominator

For a genuine locally observed Host execution, the JSON report distinguishes:

\[
\text{Decidable-Answer Accuracy}=\frac{\text{Mathematically correct}}{\text{Correct+incorrect}},
\qquad
\text{Overall Success}=\frac{\text{Mathematically correct}}{\text{All attempted}},
\]
\[
\text{Verification Coverage}=\frac{\text{Correct+incorrect}}{\text{All attempted}},
\qquad
\text{Abstention Rate}=\frac{\text{Unverified responses}}{\text{All attempted}}.
\]

It also records `hostFailures`, `hostSuccessfulResponses`, `benchmarkedWholeSuite`, and `falseAcceptanceRate=null` (not empirically measured here). All fractions are accompanied by numerator, denominator and `value`; no reported success rate silently excludes failed requests or unparseable responses. A `limit=1` smoke run must explicitly say `benchmarkedWholeSuite=false` and its top-line `measuredLiveModelAccuracy` remains **null**. That top-line statistic is only populated after the entire fixed cohort has been attempted **and all six Host requests have returned successfully**; partial-run per-question fractions remain available with their exact denominators.

Model scores are **observable local Host-output scores** with independent exact mathematical adjudication. They are **not** official exam-paper accuracy (5/6 are synthetic), unbiased model leaderboard estimates, or provider-signed immutable traces. A response file copied from elsewhere is not reclassified as a genuine live call.

## Reproduce with no provider key (safe preflight)

On the **research branch** after dependencies are installed:

```powershell
python -m pip install sympy==1.14.0 mpmath==1.3.0
python scripts/research/run_local_gemini_math_pilot.py plan
python scripts/research/run_local_gemini_math_pilot.py plan --limit 1
python -m unittest scripts/research/test_run_local_gemini_math_pilot.py -v
```

These commands do **not** contact Gemini or require any credentials.

## Opt-in actual Gemini run (local Windows PowerShell)

First, ensure your own Google Gemini AI Studio key is configured **locally** as `GEMINI_API_KEY` through your existing secure process. **Never paste the key or session token into chat, an issue, a PR or a commit.** An API request may incur cost or consume quota; do not use live mode until you intend to make those calls.

The same PowerShell shell can spawn the existing Host subprocess so it inherits the *same* local capability token:

```powershell
npm ci
npm run build
if (-not $env:GEMINI_API_KEY) { throw "Set GEMINI_API_KEY locally before live calls" }
if (Get-NetTCPConnection -LocalPort 9001 -State Listen -ErrorAction SilentlyContinue) {
  throw "Port 9001 already in use; verify and stop the previous Host first"
}
$env:GEMINI_MODEL = "gemini-3.8-flash"
$env:GEMINI_THINKING_LEVEL = "medium"
$env:GEMINI_TIMEOUT_MS = "120000"
$env:CANONICAL_MODEL_HOST_TOKEN = python -c "import secrets; print(secrets.token_hex(32))"
$hostProc = Start-Process -FilePath node -ArgumentList "examples/canonical-model-host/gemini-server.mjs" -PassThru -NoNewWindow

# After the Host is confirmed to be running, make only ONE model request:
python scripts/research/run_local_gemini_math_pilot.py run --execute-live --limit 1 --model gemini-3.8-flash --thinking-level medium --timeout 120 --output artifacts/research/gemini38-medium-smoke-001.json

# Only after reviewing the smoke result, run a separate six-case capture:
python scripts/research/run_local_gemini_math_pilot.py run --execute-live --model gemini-3.8-flash --thinking-level medium --timeout 120 --output artifacts/research/gemini38-medium-full-001.json

Stop-Process -Id $hostProc.Id
```

**Note:** The full six-case command sends all six requests **including** the first smoke problem again, by design. They are two separately named runs; avoid repeating it if you only intended one call. For a full-cohort score, evaluate the six-case capture in isolation, never combine smoke and full into a fabricated 7-case measurement.

If the Host is already running, use its configured token rather than trying to generate a different one for an existing session; an incompatible bearer token returns HTTP 401 and must not be interpreted as an incorrect math answer. If port 9001 is in use, stop the prior Host or configure a matching local port in both processes.

### Failure-attribution contract (provider-free regression tested)

The 2026-11-04 smoke attempts did not yield any usable model answers. The direct Google REST `generateContent` probe returned HTTP `503 UNAVAILABLE` while the official Host's prior request timed out after 120 seconds; these are **two distinct observed failures**, not a measured math error and not proof of one shared root cause.

The Host now maps only an authenticated Google SDK `ApiError` with upstream HTTP 503 to `provider_unavailable` / local HTTP 503. Its existing status-safe diagnostic distinguishes provider rejection (other 4xx), 500/other 5xx, 429, timeout, SDK/transport faults, token-limit truncation and invalid responses. The Python runner reads **only** a small, literal allowlist of sanitized Host `error` codes paired to the expected HTTP status; it never copies upstream error messages, SDK payloads or arbitrary local text into its captures. A mismatched, malformed or unknown error falls back to `host_http_error_<status>`. This prevents ambiguous 502 reports without exposing credentials, prompts or hidden thinking.

The runner gives the configured Host request budget an additional 15-second socket grace period, making it possible to receive and classify the Host's HTTP 504 rather than winning a 120-second timeout race. Each case still has **one** Host POST and **zero automatic retries**. The fallback evidence from older captures, including their `host_http_error_502`, is retained unmodified; never retroactively relabel it as a specific provider cause without the safe diagnostic record.

The local captures are intentionally under `artifacts/`, which the repository ignores. Review raw output content before sharing a result file publicly. To compare `high` thinking later, stop and restart the Host with `GEMINI_THINKING_LEVEL=high`, use `--thinking-level high` and a new filename. A 4096-token ceiling can still truncate demanding reasoning; a provider `MAX_TOKENS` response must remain a Host failure rather than a mathematically incorrect response.

## Research acceptance and demonstrated limits

The isolated GitHub workflow runs **17 standard-library tests** with a fake localhost canonical Host, including request role order, prompt hashes, actual HTTP bearer-token exchange, no-Origin behavior, endpoint restriction, zero-call plan, explicit live opt-in, correct/wrong/abstained model-output classification, exact decimal precision, untrusted input, single-attempt semantics, corrupted independent mathematical engine and strict metadata. The same tests explicitly refuse to turn mocked model text into live-model accuracy statistics.

**Still missing before a real model-accuracy claim:** a local live Gemini capture generated with the user's opt-in and available credentials, authoritative provider-model attestation if independently verified provenance is required, natural-language answer extraction beyond plain numeric results, a larger genuine exam question cohort and independent measured verifier false-acceptance rates. The existing 2025 Gaokao record's publication lineage/official exam authenticity is still unknown; this pilot only tests its **typed mathematical adaptation**.

The PR remains Draft, now targeting `main` after the earlier research-stack integration. It changes no production scoring and has no human-review runtime prerequisite.
