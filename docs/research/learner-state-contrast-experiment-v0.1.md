# Learner-evidence counterfactuals — offline experiment v0.1

**Status:** 5 authored stimulus pairs / 10 Tutor inputs; model responses **not collected**. No real learners, API or Judge calls, human Gold, learning gain, or causal treatment estimate.

## Desk review of evidence boundaries (2026-11-07)

This is a source-grounded desk review by the authoring assistant, **not** a new blinded human reviewer. Two prior inferences needed correcting:

- **Verbal definition versus self-report.** The learner does not merely say they know a denominator: they supply a correct verbal definition. The matrix now calls this `stated_definition`, which still is not independent application.
- **Prompted paraphrase versus independent understanding.** The learner's sheet explanation comes *after* the Tutor provided that very example. The matrix calls this `supported_local`, not evidence of independent transfer.
- A named question plus an explicit “I do not know” anchors the particular concept gap; an incorrect answer alone continues to leave the cause unknown.
- A statement of a correct local relationship is not evidence of durable mastery, and a question about an unsolved procedure is not proof of permanent inability.

These are **authoring interpretations** based on literal conversation turns. The parser verifies exact provenance and a previous Tutor message for a prompted paraphrase, not semantic correctness or real student understanding.

## Frozen five contrasts

Source of truth: `scenarios/experimental/learner-state-evidence-v0.1/contrast-plan.json`.

| Pair | Controlled evidence span | Diagnostic question |
| --- | --- | --- |
| `evidence-for-rule` | Same wrong 2/7; one arm adds an explicit incorrect addition rule | Does the Tutor avoid unsupported diagnosis in the unknown-cause arm? |
| `reported-vs-defined` | A claim of knowing “whole” versus an added correct definition | Does verbal knowledge get acknowledged without inferring full mastery? |
| `echoed-progress` | Same previous Tutor example; one arm adds its learner paraphrase | Does Tutor appropriately fade the repeated example without calling the echo independent? |
| `term-gap-negative-control` | Both arms ask about “whole”; one adds “I do not know” | Is the same prerequisite explained in both arms rather than overreacting? |
| `wording-invariance` | Two semantically equivalent descriptions of the same wrong fraction-addition rule | Is diagnosis invariant to lexical variation? |

Within each pair, the existing source scenario, prior dialogue, learning objective and fixed input metadata are constant. **Only the explicitly authored learner-evidence span changes** (plus opaque case ID). Static author-assigned known-concept values are cleared **in both arms** to avoid a privileged-state leak. The source scenarios differ from one another, so cross-pair differences do not constitute a one-variable comparison.

The natural-language insertion still changes length and expression, so this design tests *bounded response sensitivity*, not randomized causal effects. All scenarios are fictional; pairs do not describe observed improvement in one student.

## Reproducible, no-cost export

Run from the repo root:

```bash
npm run build
node --test dist/tests/learner-state-evidence.test.js dist/tests/learner-state-contrast.test.js
node scripts/research/export-learner-state-contrasts.mjs
```

The export writes `artifacts/research/learner-state-contrasts-v0.1/tutor-visible.json`, containing **10** TutorTurnInput-shaped packets, stable opaque IDs and per-input SHA-256 fingerprints. Files are create-only (`wx`) to prevent accidental overwrite; supply `--out <new-path>` for a new export. It includes neither operator research questions nor evaluator-only misconception references, matrix claims or author expectations.

**Export is not execution.** To run a candidate Tutor, use the same versioned provider/model/prompt/settings for all ten cases, with a fresh independent session for each packet while retaining its authored prior dialogue. Freeze inputs, collect verbatim responses with existing Tutor-response-corpus provenance, preserve timeout/unavailable outcomes, and independently review whether multiple reasonable teaching moves are accepted. For stochastic generation, document repeat count and seeds where supported.

Do not call paid providers automatically or rank models before semantic human review. Tests and an offline ScriptedTutor adapter can verify plumbing but not independently test adaptive model behavior. Synthetic learner continuations cannot be scored as real pre/post learning outcomes.

## Stop conditions

Keep this experiment outside the canonical Tutor Health aggregate, existing Rubric Gold, and learner outcome evidence. Stop and reopen a pair when literal source evidence changes, paired inputs differ in fields other than the evidence span and identity, evaluator-only state leaks into packets, or a plausible alternate teaching response is incorrectly forced into FAIL. The prior `learner-path-goal-and-cost-v0.1` baseline/immediate/transfer/delayed outcome checks remain entirely unmeasured.


## Operator commands — DeepSeek Flash high vs max (Windows PowerShell)

**Scope:** run only the frozen 10 Tutor inputs from this PR, not the canonical 48-case baseline or the unrelated 20-question math holdout. This is a direct Chat Completions research runner, because the canonical host intentionally rejects reasoning-effort generation controls. It reuses the bounded, no-redirect HTTP implementation in the existing DeepSeek research runner.

Official parameter contract: model deepseek-flash; thinking.type enabled; reasoning_effort high or max; temperature is ignored. Both arms set the same max_tokens=8192. This cap includes reasoning tokens and final-answer tokens and is a ceiling, **not a monetary spend limit**. If max truncates disproportionately, report output_truncated and use a separately versioned sensitivity experiment with a larger but identical budget across both modes.

Use the PR #349 research worktree. All commands below assume its root. Do **not** use baseline:local:* here: that command targets a different dataset and does not exercise high/max effort parity.

### Step 1 — zero-cost preparation (no API key needed)

~~~powershell
npm ci
npm run build
python -m unittest scripts/research/test_run_deepseek_learner_state_contrasts.py -v

# Original export is create-only; do this once on a fresh worktree.
node scripts/research/export-learner-state-contrasts.mjs

$runner = "scripts/research/run_deepseek_learner_state_contrasts.py"
python $runner plan --effort high --limit 10
python $runner plan --effort max --limit 10
~~~

These plan commands make **zero paid calls** and display input and request hashes. Prompts and messages are identical across high and max; the request effort differs. An existing output is never silently replaced.

### Step 2 — explicitly opt in to two paid smoke calls

The runner reads DEEPSEEK_API_KEY only from the current PowerShell process environment. Do not paste the key into chat, files, or command arguments.

~~~powershell
$secret = Read-Host "DeepSeek API Key" -AsSecureString
$env:DEEPSEEK_API_KEY = [pscredential]::new("deepseek", $secret).GetNetworkCredential().Password
Remove-Variable secret

# ONE DeepSeek request per command: the same first frozen input.
python $runner run --effort high --start-index 1 --limit 1 --execute-live --output "artifacts/research/learner-state-contrasts-v0.1/deepseek-high-smoke.jsonl"
python $runner run --effort max --start-index 1 --limit 1 --execute-live --output "artifacts/research/learner-state-contrasts-v0.1/deepseek-max-smoke.jsonl"
~~~

Inspect whether the recorded status is ok and the final text is nonempty and untruncated, plus finishReason, elapsedMs and tokenUsage where available. Never count provider failure, timeout or output_truncated as a teaching FAIL. The raw reasoning_content is never saved.

### Step 3 — remaining paired inputs (18 additional paid requests)

Proceed only after reviewing the two smoke results. These commands start at index 2, avoiding duplicate charges for the smoke inputs:

~~~powershell
python $runner run --effort high --start-index 2 --limit 9 --execute-live --output "artifacts/research/learner-state-contrasts-v0.1/deepseek-high-rest.jsonl"
python $runner run --effort max --start-index 2 --limit 9 --execute-live --output "artifacts/research/learner-state-contrasts-v0.1/deepseek-max-rest.jsonl"
~~~

No retries and no overwrite. Each file records prompt/request fingerprints, response text, usage and failure status. Use a new path for deliberate repetition.

### Step 4 — offline summary (no API calls)

~~~powershell
python $runner summarize --input "artifacts/research/learner-state-contrasts-v0.1/deepseek-high-smoke.jsonl" --input "artifacts/research/learner-state-contrasts-v0.1/deepseek-high-rest.jsonl" --input "artifacts/research/learner-state-contrasts-v0.1/deepseek-max-smoke.jsonl" --input "artifacts/research/learner-state-contrasts-v0.1/deepseek-max-rest.jsonl"
Remove-Item Env:\DEEPSEEK_API_KEY
~~~

Summary enforces matching packet/prompt identities across files and refuses duplicate case/effort pairs. It reports coverage, errors, token totals and latency; it does not invent teaching quality, human Gold, model winner or real learner gain.

**Limit:** student inputs are English-authored synthetic vignettes; Tutor output is requested in Simplified Chinese. This is engineering contrast evidence, not a validated Chinese-native learner cohort. Human/independent semantic adjudication remains necessary. CI and ChatGPT call **zero** paid DeepSeek requests; only local operator use of run --execute-live performs calls.


## Frozen output validation and blind semantic review (after all attempts)

Reuse the repository's existing **source/manifest/submission separation** for independent semantic review. This cohort has **one human reviewer at most**, so it is not human-human agreement, expert-consensus Gold, or observed learning improvement. The operator cannot claim blindness for the previously inspected high/max `ls-v01-p01-a` responses; disclose that exposure in any report.

The new offline review tool reads the exact four saved JSONL files. It checks each header against the unchanged frozen Tutor packet, rejects duplicate `(caseId, effort)`, checks `inputSha256`, `messagesSha256`, `requestSha256`, and the SHA of stored final text, and confirms each header's selected-case list matches its actual rows. No API calls. Unlike the basic aggregate `summarize`, this validates **every response-to-request identity**.

Use a fixed list of source files (PowerShell):

~~~powershell
$root = "artifacts/research/learner-state-contrasts-v0.1"
$reviewer = "scripts/research/review_deepseek_learner_state_contrasts.py"
$inputs = @(
  "$root/deepseek-high-smoke.jsonl",
  "$root/deepseek-high-rest.jsonl",
  "$root/deepseek-max-smoke.jsonl",
  "$root/deepseek-max-rest.jsonl"
)
$inputArgs = foreach ($file in $inputs) { "--input"; $file }

# Works for partial sets too, but reports missing attempts explicitly.
python $reviewer audit @inputArgs

# Requires exactly 20 recorded attempts, including failed/truncated statuses.
# Exports only successfully completed Tutor replies to the reviewer packet.
python $reviewer prepare @inputArgs --out-dir "$root/reviewer-a-blind"
~~~

The `prepare` command refuses to overwrite an existing directory. It outputs `reviewer-packet.json`, `submission-template.json`, `REVIEWER-GUIDE.md` and a **separate operator-only** `operator-mapping.json`. Keep the latter closed until the reviewer has completed and frozen the template. The reviewer sees only student-visible context and Tutor final responses in opaque, shuffled task order, with no High/Max tags, author expectations, or pair mappings.

For each completed response, the reviewer records four **descriptive** dimensions: `evidenceFit` (response tied to observable student evidence), `instructionalSupport` (conceptual and procedural bridge), `unsupportedDiagnosis` (unjustified claims about the student) and `factualIntegrity` (correct math). An unreviewable failed call is **not** a teaching FAIL. When no strong evidence exists, `ABSTAIN` is allowed. For non-PASS judgments, preserve verbatim textual reasons. Do not collapse these four dimensions to a single number or "model winner" automatically.

After all review items are completed, save the edited template as a **new file** named `reviewer-a-completed.json`. Then unseal:

~~~powershell
python $reviewer unseal --packet-dir "$root/reviewer-a-blind" --submission "$root/reviewer-a-completed.json" --out-dir "$root/reviewer-a-analysis"
~~~

`unseal` rejects missing or unrated items, unknown IDs, duplicate tasks, changed task-set fingerprint and insufficient negative-rating evidence. It **freezes the submitted file byte-for-byte** before writing descriptive effort-level and paired results, preserving notes exactly. It does not call DeepSeek, Judge or a student. The mapping and fingerprints are local integrity checks, **not third-party digital signatures** authenticating the provider.

If the reviewer prefers conversational annotation over editing JSON, preserve all four JSONL files untouched and hand them off for a separate review UI; do not use operator mapping or an author-predicted label to prefill a human score.
