# DeepSeek Flash real Tutor cohort — five-case smoke v0.1

> **Research status (2026-11-12):** This non-thinking-only smoke is retained as a versioned historical/efficiency control, **not** the primary DeepSeek teaching-capability benchmark. The formal comparison now uses the thinking `low`, `high`, and `max` conditions in [the three-effort research protocol](deepseek-three-efforts-tutor-pilot-v0.1.md). Do not run this older non-thinking procedure when intending to measure those three thinking conditions.

**Status: ready for an operator-controlled live smoke; no real DeepSeek calls made by this PR or CI.** This is response collection, not Judge calibration, student learning measurement, or model ranking.

## Reuse instead of rebuilding

The script `scripts/research/deepseek-tutor-five.mjs` orchestrates existing `tutorbench collect-model`, the canonical HTTP model Host, versioned `TutorExecutionPacket`, `TutorResponseCorpus`, corpus validator and offline `evaluate`. It does not create a provider SDK client or a second scoring engine. Historical math-only `run_deepseek_flash_math_25.py` evaluates *typed final math answers*, not Tutor pedagogy; the experiment is separate.

## Frozen cases in canonical TutorEval v0.2a.6

| Case ID | Version | Research discipline | Learning concern |
| --- | --- | --- | --- |
| `fraction-misconception-001-zh-CN` | 1.2.0 | Mathematics | Fraction-unit diagnosis; prevent answer leakage |
| `hint-only-linear-equation-001-zh-CN` | 1.1.0 | Mathematics | Only a first-step hint |
| `science-density-knowledge-001-zh-CN` | 1.1.0 | Physics | Density–mass–volume relation |
| `science-force-transfer-001-zh-CN` | 1.1.0 | Physics | Force balance, learning transfer |
| `science-photosynthesis-concept-001-zh-CN` | 1.1.0 | Biology | Matter, light energy, biological mechanism |

The canonical subject field of the last three cases remains `science`; Physics/Biology is research interpretation only. **There is no separately attributed canonical chemistry case in this five-case cohort.** Exactly five Mandarin Chinese source cases, one run each, not a representative science sample.

## Provider configuration

Current DeepSeek Chat Completions docs say thinking defaults to enabled. The existing generic Host previously omitted this control. This pilot adds opt-in `TUTOR_MODEL_DEEPSEEK_THINKING=disabled`, forwarded as the documented `thinking: { type: "disabled" }` when the exact model is `deepseek-flash` or `deepseek-v4-pro`. Without it, the Host preserves historical behavior. Invalid configurations fail closed. Only visible assistant `message.content` enters the corpus; the Host rejects truncated/interrupted responses and never stores upstream `reasoning_content`.

Source: https://api-docs.deepseek.com/api/create-chat-completion/

## Local runbook (Windows PowerShell, Node 24)

Run inside the repository root. The key belongs only in your local environment; do not paste it into ChatGPT, commits, command flags, or reports.

**1. Build and plan, with ZERO provider calls:**

```powershell
git switch main
git pull --ff-only origin main
npm ci
npm run build
node scripts/research/deepseek-tutor-five.mjs plan
```

The plan must print **5 planned model calls / 0 executed** and the frozen case IDs.

**2. Configure the Host, still ZERO calls:**

```powershell
if (-not $env:DEEPSEEK_API_KEY) { throw "Configure DEEPSEEK_API_KEY locally." }
$env:TUTOR_MODEL_API_KEY = $env:DEEPSEEK_API_KEY
$env:TUTOR_MODEL_AUTH_MODE = "bearer"
$env:TUTOR_MODEL_BASE_URL = "https://api.deepseek.com"
$env:TUTOR_MODEL = "deepseek-flash"
$env:TUTOR_MODEL_API_PATH = "/chat/completions"
$env:TUTOR_MODEL_MAX_OUTPUT_TOKENS_FIELD = "max_tokens"
$env:TUTOR_MODEL_DEEPSEEK_THINKING = "disabled"
$env:TUTOR_MODEL_REASONING_SPLIT = "disabled"
$env:TUTOR_MODEL_REQUIRE_REASONING_SEPARATION = "true"
$env:TUTOR_MODEL_TIMEOUT_MS = "90000"
$env:CANONICAL_MODEL_HOST_TOKEN = [Convert]::ToHexString(
  [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
```

**3. First real response — at most ONE paid request:**

```powershell
$hostProcess = Start-Process node -ArgumentList 'examples/canonical-model-host/chat-completions-server.mjs' -PassThru
node scripts/research/deepseek-tutor-five.mjs smoke --execute-live
```

**STOP: manually inspect the saved corpus and collection report. Do not run the next block merely because the first command exited.** Confirm one successful `recorded_model` response, the expected case ID and version, a complete visible Tutor answer, no provider error, and no hidden reasoning. If the result is missing, partial or unsuitable, stop the host and record the failure; do not advance.

**4. After inspection, explicitly approve at most FOUR additional paid requests:**

```powershell
node scripts/research/deepseek-tutor-five.mjs complete --execute-live
node scripts/research/deepseek-tutor-five.mjs inspect
```

**5. Always stop the Host and clear its temporary credentials when finished:**

```powershell
Stop-Process -Id $hostProcess.Id -ErrorAction SilentlyContinue
Remove-Item Env:CANONICAL_MODEL_HOST_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:TUTOR_MODEL_API_KEY -ErrorAction SilentlyContinue
```

**Optional offline inspection, ZERO provider/Judge calls:**

```powershell
node scripts/research/deepseek-tutor-five.mjs inspect
```

The `complete` stage resumes the same original corpus, reuses successful case-runs, and **never selects all 48 canonical cases**. No implicit automatic retry: partial provider failures/truncation remain partial until a separate intentional invocation.

The only outputs live under ignored `artifacts/real-model`:
- `research-deepseek-flash-zh-tutor-5-v0.1.corpus.json` — private frozen visible Tutor texts;
- `research-deepseek-flash-zh-tutor-5-v0.1.report.json` — attempts, failures, coverage;
- `research-deepseek-flash-zh-tutor-5-v0.1.offline-evaluation.json` — no Judge; missing Judge-required rubrics remain incomplete.

Do not commit raw corpus content, provider keys, reviewer identifiers, student data, or model reasoning. A successful mock/CI check does not imply actual DeepSeek calls. The source model ID is operator-declared, not cryptographically attested by the provider.

## Evidence rules

The first five replies are **only a process smoke**. They are neither independently human-graded nor sufficient for model capability claims. The established PR #370 reliability code compares scoring methods only when exact frozen inputs and credible labels are supplied; it does not manufacture human reference. The next stage would seek 20–30 authorized diverse model responses, independent blinded human rubric annotations and adjudication, and a separately justified Judge call budget. Same-family DeepSeek-as-Tutor/DeepSeek-as-Judge correlations require independent replication. Current stage does not modify canonical Eval/Health scores, Judge prompts, or historical artifacts.
