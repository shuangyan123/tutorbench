# DeepSeek Flash real Tutor: Low / High / Max paired pilot v0.1

**Engineering stage only — no real provider requests made by this PR or its CI.**
Three *thinking* strengths, one model, five fixed Chinese TutorEval cases, one response per case and strength: **15 planned paid calls**. No non-thinking arm is included in the formal comparison. This supersedes the non-thinking-only pilot's *primary capability measurement* intent; the old #371 protocol remains a separate, versioned, optional efficiency baseline.

Official documentation: https://api-docs.deepseek.com/guides/thinking_mode/
The DeepSeek Chat Completions API supports `reasoning_effort: low|high|max` with `thinking: { type: "enabled" }`. The default is High. We set both explicitly so the actual requested strength can be audited. In thinking mode, `max_tokens` counts **reasoning and visible answer tokens together**; the unchanged canonical baseline's 1024-token generation limit is insufficient for a fair high-effort trial. A new research-owned generation profile (`research-deepseek-tutor-effort@0.1.0`) uses **32,768 total output tokens as a common ceiling**, with one exact effort in the frozen spec. This is a common *bounded-budget* comparison, not a claim to measure Max at unlimited inference budget. Large ceilings are limits, not actual spend.

## Matched cohort

Frozen dataset: `tutor-eval-v0.2a@0.2a.6`, same existing `tutor-baseline-system-v0.2` prompt bytes, one run per ID per strength.

| Case ID | Version | Case domain in current dataset | Focus |
| --- | --- | --- | --- |
| `fraction-misconception-001-zh-CN` | 1.2.0 | mathematics | Fraction misconception and answer leakage |
| `hint-only-linear-equation-001-zh-CN` | 1.1.0 | mathematics | First-step hint constraint |
| `science-density-knowledge-001-zh-CN` | 1.1.0 | science (physics content) | Density relation |
| `science-force-transfer-001-zh-CN` | 1.1.0 | science (physics content) | Force balance and transfer |
| `science-photosynthesis-concept-001-zh-CN` | 1.1.0 | science (biology content) | Mechanism explanation |

Chemistry does not have a separately attributed canonical case in this sample. Do not infer chemistry coverage.

Three experimental conditions share model, dataset, case versions, system prompt, tool-free Host, transcript, one run per case, and a **32,768-token total completion ceiling**. The only intended treatment variable is requested `reasoning_effort`. Research cohort filenames, corpus IDs, Tutor descriptors and frozen generation specs are all **separate and effort-bound**. Model is selected by the operator; upstream model version is not cryptographically attested. Compare actual token usage and latency, not a nominal effort label alone.

## Reuse, privacy and evidence boundaries

- Existing `collectCanonicalTutorModel`, contract parser, Host session auth, corpus validator and `runTutorResponseCorpus` are reused. A research-only orchestration script supplies an explicitly versioned spec, instead of changing production baseline scoring or teaching prompts.
- The Host must see `TUTOR_MODEL_DEEPSEEK_THINKING=enabled`; it forwards the packet's exact effort value and attests `reasoningEffort: true`. Unsupported/ambiguous configurations fail closed. The Host returns **only visible message.content**, never reasoning_content or request secrets.
- A complete response must have a `stop` finish reason and nonempty content. Length/resource interruption or timeout is an execution failure, not a wrong teaching answer. Record all attempted/completed/failed and paired denominators.
- Offline inspection never invokes Judge. For a teaching-quality study, independently obtain blinded human rubric labels, then test Judge disagreements separately. The read-only #370 exact-answer reliability diagnostic is eligible only for its original, disclosed-answer *correctness* rubric targets; hint-only cases are not eligible.
- One run per condition is **a five-case workflow smoke**, not a representative model capability estimate or proof of significance. Modes may be affected by time/order and server version changes. Full evidence later needs counterbalanced order, repeated runs, diverse cases and independent human anchors.

## Windows PowerShell runbook

Run from TutorBench's repository root on Node 24. Never paste API credentials or saved Tutor replies into GitHub, commands, chat or logs.

**0. Zero-call plan:**

`§powershell
git switch main
git pull --ff-only origin main
npm ci
npm run build
node scripts/research/deepseek-tutor-efforts.mjs plan
`§

Expect 3 supported levels, 5 cases each, exactly 15 *planned* API calls, **0 actual**.

**1. Local credentials and Host, still zero calls:**

`§powershell
if (-not $env:DEEPSEEK_API_KEY) { throw "DEEPSEEK_API_KEY must be set privately." }
$env:TUTOR_MODEL_API_KEY = $env:DEEPSEEK_API_KEY
$env:TUTOR_MODEL_AUTH_MODE = "bearer"
$env:TUTOR_MODEL_BASE_URL = "https://api.deepseek.com"
$env:TUTOR_MODEL = "deepseek-flash"
$env:TUTOR_MODEL_API_PATH = "/chat/completions"
$env:TUTOR_MODEL_MAX_OUTPUT_TOKENS_FIELD = "max_tokens"
$env:TUTOR_MODEL_DEEPSEEK_THINKING = "enabled"
$env:TUTOR_MODEL_REASONING_SPLIT = "disabled"
$env:TUTOR_MODEL_REQUIRE_REASONING_SEPARATION = "true"
$env:TUTOR_MODEL_TIMEOUT_MS = "240000"
$env:CANONICAL_MODEL_HOST_TOKEN = [Convert]::ToHexString(
  [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
$hostProcess = Start-Process node -ArgumentList 'examples/canonical-model-host/chat-completions-server.mjs' -PassThru
`§

**2. Small real smoke: perform only ONE authorized call for Low, then inspect its private .corpus and .report files before advancing. Repeat explicitly for High and Max:**

`§powershell
node scripts/research/deepseek-tutor-efforts.mjs smoke --effort low --execute-live
node scripts/research/deepseek-tutor-efforts.mjs smoke --effort high --execute-live
node scripts/research/deepseek-tutor-efforts.mjs smoke --effort max --execute-live
`§

**STOP after every call to inspect** case identity, complete Tutor-visible response, provider error/finish status, tokens and whether a truncated output is wrongly marked successful. The script never silently queues the next strength. If a smoke produced no usable response, stop that arm: do not count it as a success. No retries happen automatically.

**3. Only after separately approving each of the three smokes, complete its other four case-runs once:**

`§powershell
node scripts/research/deepseek-tutor-efforts.mjs complete --effort low --execute-live
node scripts/research/deepseek-tutor-efforts.mjs complete --effort high --execute-live
node scripts/research/deepseek-tutor-efforts.mjs complete --effort max --execute-live
`§

A complete run stores a **new** effort-specific corpus/report, reusing its exact previously successful first response; the original smoke files are immutable. Every live stage first creates an exclusive private `*.attempt.json` marker **before** its first request. If the process crashes or the report is missing, the marker prevents that stage from being rerun and accidentally duplicating charged calls. Inspect the marker, corpus and report; deliberate recovery requires a separately audited procedure and is not an automatic retry. The first smoke and later continuation are independently bound to their exact effort.

**4. Purely offline evaluation, ZERO DeepSeek/Judge calls:**

`§powershell
node scripts/research/deepseek-tutor-efforts.mjs inspect --effort low
node scripts/research/deepseek-tutor-efforts.mjs inspect --effort high
node scripts/research/deepseek-tutor-efforts.mjs inspect --effort max
`§

Offline Eval is a preliminary provenance/coverage artifact; Judge-required rubrics are not evidence of successful teaching until an actual, distinct Judge run exists. Reports and frozen corpora remain private under ignored `artifacts/real-model/`, with three separate cohort identities. The `inspect` artifact uses exclusive write and will not silently replace prior results.

**5. Clean up environment and Host:**

`§powershell
Stop-Process -Id $hostProcess.Id -ErrorAction SilentlyContinue
Remove-Item Env:CANONICAL_MODEL_HOST_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:TUTOR_MODEL_API_KEY -ErrorAction SilentlyContinue
`§

## Exit gates

Engineering: tests/typecheck/lint/build, CodeQL, Dependency Review, no leakage, positive low/high/max forwarding, negative invalid/mode-mismatch cases, deterministic zero-call plan, exact source binding, private distinct corpora and at-most-1+4 request budget **per arm**.

Research: report each condition's **completed/5**, missing/failed/truncated, raw token usage and latency, then compare matched case responses qualitatively. **No human labels and no real provider calls are present in this repository PR.** Do not publish teaching scores, judge-calibration statistics, confidence intervals, model rankings or learning improvement claims from these controls.
