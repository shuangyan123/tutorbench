# Opt-in Gemini live math accuracy baseline (blind, source-separated)

**Research v0.1: safe model-execution wiring, not a measured Gemini score until a real run occurs.** This completes the connection from a frozen answer-free mathematical cohort to TutorBench's **existing** local canonical Gemini Host and the previously validated dual-path exact math adjudicator (PR #330). The research branch makes **zero external model calls in CI**, requires no reviewer, and does not change production TutorBench Judge scoring or any historical student evaluation.

## What the model actually receives

Six frozen real-language Chinese numerical problems about independent uniform draws with replacement. The suite has exactly one question **linked to a typed adaptation** of the 2025 New Gaokao I mathematics Q14 occupancy problem, and five new synthetic variations (expectation, variance, exact event, threshold event and zero-draw edge case). It does **not** contain answer keys, correct result strings, human annotations, or grader model responses.

Each one-case request uses the existing **TutorExecutionPacketFile v1** contract: pinned system prompt SHA-256, explicit generation spec (256 max output tokens; no optional controls), three role-valid messages, \`locale=zh-CN\`, and one case. The question generator only reads the typed mathematical **assumptions and requested metric**, never the independently calculated answer. It requests an integer, exact fraction or finite decimal **without any surrounding text**. \`UNSURE\` and mixed prose are *unverified*, not guessed to be mathematically correct.

The local Gemini Host already implements explicit model version selection, single response validation, disabled SDK retries/continuation/tool calls, request timeout, session token separate from the provider API key, and restricted \`127.0.0.1\` binding. The new runner **reuses this Host** rather than calling Google directly or adding another API wrapper.

### Required safety properties

- **Plan** is the default planning route and makes **zero model calls**; it does not read a secret or check the provider endpoint.
- Live calls only happen with the explicit \`run --execute-live\` command. The runner requires a 64-character random lowercase-hex \`CANONICAL_MODEL_HOST_TOKEN\` from the local environment, a versioned declared Gemini ID, a loopback-only \`http://127.0.0.1:<port>/generate\` address and an output file path.
- The output file is **reserved exclusively before any network requests**; an existing capture is never overwritten or silently retried, avoiding unintentional repeated costs.
- Each case gets one POST, no application-level retry. The host must return the expected canonical \`output.text\` and supported generation flags. HTTP failures and timeouts are counted separately; they **do not** imply a math mistake.
- The raw model text, full typed-question SHA-256, actual one-case packet SHA-256, host-reported timing and token counts, run UUID, UTC capture time and declared model are written into an **ignored local** \`artifacts/\` JSON file. The session token and Google API credential are **never** serialized.
- User-set \`--model\` is **operator-declared**; neither the canonical Host response nor its local capture contains provider-signed model identity. The report therefore sets \`providerIdentityCryptographicallyVerified=false\` and does **not** assert a signed provider/model attestation.
- Mock HTTP tests may calculate numerators and denominators but **cannot** output a measured live AI accuracy: \`executionProvenance=mock_transport\` forces all displayed accuracy \`value\` fields to \`null\`.

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

It also records \`hostFailures\`, \`hostSuccessfulResponses\`, \`benchmarkedWholeSuite\`, and \`falseAcceptanceRate=null\` (not empirically measured here). All fractions are accompanied by numerator, denominator and \`value\`; no reported success rate silently excludes failed requests or unparseable responses. A \`limit=1\` smoke run must explicitly say \`benchmarkedWholeSuite=false\` and cannot be described as a full-cohort accuracy result.

Model scores are **observable local Host-output scores** with independent exact mathematical adjudication. They are **not** official exam-paper accuracy (5/6 are synthetic), unbiased model leaderboard estimates, or provider-signed immutable traces. A response file copied from elsewhere is not reclassified as a genuine live call.

## Reproduce with no provider key (safe preflight)

On the **research branch** after dependencies are installed:

\`\`\`powershell
python -m pip install sympy==1.14.0 mpmath==1.3.0
python scripts/research/run_local_gemini_math_pilot.py plan
python scripts/research/run_local_gemini_math_pilot.py plan --limit 1
python -m unittest scripts/research/test_run_local_gemini_math_pilot.py -v
\`\`\`

These commands do **not** contact Gemini or require any credentials.

## Opt-in actual Gemini run (local Windows PowerShell)

First, ensure your own Google Gemini AI Studio key is configured **locally** as \`GEMINI_API_KEY\` through your existing secure process. **Never paste the key or session token into chat, an issue, a PR or a commit.** An API request may incur cost or consume quota; do not use live mode until you intend to make those calls.

The same PowerShell shell can spawn the existing Host subprocess so it inherits the *same* local capability token:

\`\`\`powershell
npm ci
npm run build
$env:GEMINI_MODEL = "gemini-2.5-flash"
$env:CANONICAL_MODEL_HOST_TOKEN = python -c "import secrets; print(secrets.token_hex(32))"
$hostProc = Start-Process -FilePath node -ArgumentList "examples/canonical-model-host/gemini-server.mjs" -PassThru -NoNewWindow

# First make only one intentional paid/quota-consuming request:
python scripts/research/run_local_gemini_math_pilot.py run --execute-live --limit 1 --model gemini-2.5-flash --output artifacts/research/gemini-math-smoke-001.json

# Then, if desired, run all 6 fixed questions under a NEW capture filename:
python scripts/research/run_local_gemini_math_pilot.py run --execute-live --model gemini-2.5-flash --output artifacts/research/gemini-math-full-001.json

Stop-Process -Id $hostProc.Id
\`\`\`

**Note:** The full six-case command sends all six requests **including** the first smoke problem again, by design. They are two separately named runs; avoid repeating it if you only intended one call. For a full-cohort score, evaluate the six-case capture in isolation, never combine smoke and full into a fabricated 7-case measurement.

If the Host is already running, use its configured token rather than trying to generate a different one for an existing session; an incompatible bearer token returns HTTP 401 and must not be interpreted as an incorrect math answer. If port 9001 is in use, stop the prior Host or configure a matching local port in both processes.

The local captures are intentionally under \`artifacts/\`, which the repository ignores. Review raw output content before sharing a result file publicly.

## Research acceptance and demonstrated limits

The isolated GitHub workflow runs **14 standard-library tests** with a fake localhost canonical Host, including request role order, prompt hashes, actual HTTP bearer-token exchange, no-Origin behavior, endpoint restriction, zero-call plan, explicit live opt-in, correct/wrong/abstained model-output classification, exact decimal precision, untrusted input, single-attempt semantics, corrupted independent mathematical engine and strict metadata. The same tests explicitly refuse to turn mocked model text into live-model accuracy statistics.

**Still missing before a real model-accuracy claim:** a local live Gemini capture generated with the user's opt-in and available credentials, authoritative provider-model attestation if independently verified provenance is required, natural-language answer extraction beyond plain numeric results, a larger genuine exam question cohort and independent measured verifier false-acceptance rates. The existing 2025 Gaokao record's publication lineage/official exam authenticity is still unknown; this pilot only tests its **typed mathematical adaptation**.

The PR remains Draft and stacked on #330. It changes no production scoring and has no human-review runtime prerequisite.
