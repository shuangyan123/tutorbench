# Premium Set Runner

This runner replays authored replies to exercise a multi-turn evaluation protocol. Its synthetic verdicts describe the fixture. Replay and the strict checker operate on local files. The calibration command also supports a scripted tutor paired with a separately enabled live student. A new private directory under `runs/` or an access-controlled directory outside the checkout is suitable for output. Node 24 and the repository build are required.

## Run the bilingual fixture

```sh
npm ci
npm run build
npm run premium:check-cards -- --cards examples/premium/cards
npm run premium:run -- --cards examples/premium/cards --config examples/premium/config.json --tape examples/premium/tape.json
npm run premium:index
npm run premium:rejudge -- --run-id <runId-from-index> --cards examples/premium/cards --config examples/premium/config.json --tape examples/premium/tape.json
```

All output commands accept `--out <private-directory>`, default `runs/premium`. Repeat the run command with identical inputs to resume. One job is one batch/card/language/tutor ID/repeat. Its SHA-256 identifies the same job after a restart. Record status, cost and batch stop reason are available even when a CLI invocation successfully saves incomplete evidence.

### Private cards and identity

`premium:check-cards -- --card <path/to/card.json>` checks only the bilingual metadata schema. A runnable directory requires both nonempty shared rule files and a trusted `cards.lock.json`. The whole lock is verified before the optional CLI filter selects a card. It is read-only throughout execution. The Phase 2 handoff supplies eight locked private cards and shared rules. The issuer will add departure thresholds and reissue the locks. The checked-in tile problem, rules, lock, tape and rates are independently authored synthetic fixtures.

For the Phase 1 lock convention, decode as strict UTF-8 without BOM and replace CRLF with LF. Preserve all remaining characters, spaces and trailing newlines. Form a JSON array of **five strings** in order: verbatim `card.json` text, Chinese student Markdown, English student Markdown, Chinese shared rules, English shared rules. Hash the UTF-8 bytes of compact ECMAScript `JSON.stringify(array)` using SHA-256, prefix the lowercase hex digest with `sha256:`. JSON framing preserves file boundaries. A missing component, wrong ID/version or changed digest stops loading. Inside an existing ledger, an observed card ID/version stays bound to its first digest even if someone edits the lock. A fresh output root relies on the issuer's trusted lock. The issuer confirmed this encoding.

### Models and tapes

`config.json` declares tutor labels, requested models, pinned versions, hosting providers and canonical **developer** IDs, student, ordered panel/reserves and the Judge configuration version. Operators supply verified developer identities, including when using a common host. Selection excludes the tutor's and student's developers and uses distinct developers across the panel. It consumes primaries before reserves. Each successful response records the returned version. Student and Judge version mismatches, and a tutor changing version within a dialogue, interrupt the affected operation.

The handoff names DeepSeek V4.1-Flash for the student, Qwen4-Max (Alibaba), Mistral Large 3 (Mistral AI), and MiniMax-M3 (MiniMax) for the panel, with GLM-5.3 (Zhipu AI) then Kimi K3.1 Pro (Moonshot AI) as reserves. These are handoff designations. Account availability and immutable serving revisions need verification before any separately authorized live phase. The runnable config pairs those designations with a mock hosting provider and explicitly synthetic serving revisions.

A tape is a JSON object keyed by `cardId/lang/tutorId`. Each entry maps a model ID to an ordered array of replies. Each reply has visible `text`, `finishReason`, `latencyMs` and token `usage` or null. Optional `resolvedModel` defaults to the configured synthetic pinned version. A missing frame or null simulates a provider error. Every job starts at frame zero. Retries and discarded dialogue attempts consume frames. Rejudging starts fresh Judge tracks. Raw private tapes and source cards belong outside tracked directories.

### Per-tutor configuration

Each `tutors[]` entry accepts a private bilingual teaching prompt and generation parameters. This synthetic fragment shows the optional fields.

```json
{
  "prompt": {
    "id": "tiles-coach",
    "version": "1.0.0",
    "text": { "en": "Ask about the tiles.", "zh-CN": "问问瓷砖的规律。" }
  },
  "params": { "temperature": 0.3, "maxOutputTokens": 1024 }
}
```

Both language strings, ID and version are required when a prompt is present. The tutor receives its localized text, two LF characters and the card’s localized `tutorSetup`. With no prompt it receives the original card setup verbatim. Each omitted parameter takes its own default, `temperature: null` and `maxOutputTokens: 2048`. Output caps must be positive integers. A supplied temperature can be null or a finite nonnegative number. The Judge continues to receive the card setup and visible conversation.

The private record saves the exact sent `systemPrompt`, its `promptHash` and the effective parameters in temperature/output-cap order. Its `tutorPromptId`, `tutorPromptVersion` and `tutorPromptHash` describe the independent bilingual prompt and are null when absent. Hash the UTF-8 compact JSON object `{id,version,text}` with keys sorted recursively in ordinal order, preserving the strings exactly and adding no trailing newline. Prefix the lowercase SHA-256 digest with `sha256:`. The ledger binds an ID/version to this digest across tutors, batches and languages. The batch tutor entry includes `prompt: {id,version,hash}` when configured and includes effective `params` for nondefault settings. Changing these identities requires a new batch. The index adds nullable `tutorPromptId` and `tutorPromptVersion`.

### Serving revision and executable identity

For students and Judges, the session compares the returned `resolvedModel` string with `pinnedVersion` on each call. For a tutor, the first returned revision establishes the reference for that model in that job, including discarded attempts. A stable tutor revision can differ from the configured pin. A new job starts a new session. The replay adapter can fill an omitted revision from the tape configuration. These comparisons establish consistency of supplied strings. A formal run requires a separately verified immutable serving revision and a provider-returned identity on every call, with any alias-to-revision mapping recorded and verified. A mock default supplies no such evidence.

The Phase 1 CLI reads `git rev-parse HEAD` from its working directory and executes the existing JavaScript under `dist/`. That SHA alone cannot establish worktree cleanliness or which sources produced the JavaScript. For formal evidence, run from the intended repository root in a fresh checkout of the reviewed commit. Verify the full commit and tree IDs and a clean index/worktree, including untracked source files. Use the committed dependency lock, record Node/npm versions, install with `npm ci`, and build into a fresh output directory. Record a digest of the executed build (relative paths and file hashes), and verify that same build at invocation. Keep those checks with the run or rejudge provenance. Phase 1 leaves this verification to the operator.

### Execution and evidence

The first message uses the selected language's exact `firstMessage`. Tutor history maps students to user and tutors to assistant. Only visible text crosses this boundary. Student history reverses these roles and preserves its own full JSON. The first assistant message contains the synthesized initial state. Rewrites receive the rejected text and reason privately. An accepted message records its rewrite count, hard failures and soft flags. Two failed rewrites discard that attempt. After three discarded attempts the run ends as `student_invalid`. The 15th tutor turn ends the conversation immediately.

Each Judge receives a separate request containing the tutor setup, localized Judge context, fixed-test number/type and numbered visible transcript. A validated ballot covers every tutor turn exactly once, with verbatim evidence from that turn and in-range references. A completed panel supplies five boolean majorities per turn, a median help level, transition votes, fixed-test outcome, transfer, and disagreements with each Judge's vote. Rule-based verdicts use per-turn majority leakage, terminal reason and independent solution evidence. A malformed ballot gets one repair with its validation error. All three distinct configured Judges must supply valid ballots.

See the call reservation and billing rules below.

The fixed challenge is delivered when its literal text appears on the prescribed student message. The student's event remains a separate self-report. Per-message soft flags distinguish a missing event, an event without text, an early or late event, and text on the wrong message. Accepted messages retain their text and events. Rejected rewrites retain their raw reply, hard reasons and any soft flags. Literal challenge text before the prescribed message, departure below the optional card threshold and a curt exit below the solved stage require a rewrite. For a delivered challenge with a tutor reply, `fixedTest.outcome == leaked` and `noLeak == false` must agree in both directions on that reply.

## Dashboard read interface for Claude

| Artifact | How to consume it |
| --- | --- |
| `index.jsonl` | UTF-8, one row per run, sorted by record filename, latest scoring. Filter by `status` before comparing verdicts. Group by `cardId`, `cardVersion`, `cardHash`, `lang` and Judge config version. Compare `tutorLabel` and `tutorResolvedModel`. Compare with the current trusted lock to mark older cards. |
| `batches/<batchId>.json` | Configuration, card identities, code/tape identity, budget, `spentUsd`, `status` and `runs` counts. `unknown_cost`, `budget_stop` and `actual_over_budget` stop further calls. |
| `records/<runId>.json` | Follow `recordPath` for chronological messages, first-run status, immutable attempt evidence and call ledger. Each scoring retains its config, prompt hash, isolated outputs, validation failures, aggregate and disagreement votes. Use the last scoring to render the current detail view. |

The runner emits v3 records and v2 batches. It can rebuild the index from v1, v2 and v3 records. Index rows include identities, repeat, latest scoring ID, verdict/reasons, fixed test, end reason, turn totals, help levels, leak turns, transfer, unfired behaviours, discarded attempts, disagreements and USD. The sample record and sample index use different placeholders for the same student version; reconstruction uses the record's value. The runner preserves the manifest’s full suite ID in `suiteId` and splits a trailing `-v<number>` for the example’s `suite` and `suiteVersion` fields. Aggregates and verdicts may be null. A missing panel cannot contribute a tally. Show `pending`, per-Judge errors and the raw accepted/rejected evidence on drill-down. Keep soft flags visible even on a scored run.

Phase 1 extensions for review include `attempts[].transcript/rejected/calls`, `calls[]` (model, request fingerprint, returned metadata, usage, retry delay and stable error code), `perJudge[].raw/error`, `scorings[].pending/calls/usage`, and `usage.rates`. The raw Judge field contains only the visible model text. Secret-shaped responses are withheld and recorded by failure code. Transcripts, private tutor setup and audit evidence require private storage; use synthetic or reviewed deidentified inputs. Credential filtering supplements this input boundary.

The private `.premium.sqlite` ledger commits one entire job at a time, serializes writers, and stores initial run payloads and subsequent score entries separately. A process crash before commit may replay that offline job. After commit the next run/index command repairs JSON views via atomic replacement and skips the committed job. Exported JSON files alone suffice for Dashboard use and index reconstruction. Preserve the private ledger and identical source inputs for resume/rejudge. Keep copies of completed batches while the writer is idle. Rejudge explicitly appends a new scoring, including failed panels; all earlier fields stay intact. Initial record `usage` includes scoring s1. Batch/index totals additionally include each later scoring once.

## Phase 2 protocol

Completed calibration records have `batchKind: "calibration"`, `status: "unscored"` and empty `scorings`. Errors and student-invalid attempts retain their failure status. Exclude calibration from pass rates. For evaluations, select `status: "scored"` and the current Judge configuration in the index. `card.hash` is an alias of `card.contentHash`.

Use `--judge-prompts <private-markdown>` for evaluation and rejudge. The loader selects the two fenced text blocks from the supplied revision in Chinese/English order and fingerprints the localized prompt actually sent, including the JSON contract. The checked-in fixture opts into a synthetic rubric. Each turn requires help level 3 exactly when the Judge reports leakage. Quote matching uses NFKC and collapsed whitespace on that tutor turn. One outer JSON fence is accepted. Invalid ballots and repair reasons remain in `perJudge[].rejected`.

An incomplete panel yields `pending: ["incomplete_panel"]` and a null aggregate. Program-observed departure adds `scorings[].withheldRuleVerdict: "fail"`. With a complete panel, majority leak on one turn, valid departure, or majority tutor fault at an unsolved cap produces `fail`. Other blocking reasons move to `merged.reviewFlags` on a definite failure. Without such failure, unsupported answer/solve claims and an unresolved cap wait for review. Independent solution requires both the solved stage and two Judge votes. Transfer outcomes are descriptive. Transfer turns still participate in the turn checks.

When an early final thank-you follows a leaking tutor turn before the prescribed challenge, a majority on that preceding turn sets `merged.fixedTestSkipped`. Category splits keep the votes and null merged category. The index projects split fixed-test and transfer categories as `"split"`. The index also exposes `fixedTestSkipped` and `reviewFlags`. Existing records retain their original evidence and s1 when rejudged. A changed card ID, revision or digest prevents rejudging.

## Calibration commands

Supply paths to private files outside the checkout. The dry run uses the golden tutor and student tracks. For the formal cohort use the tutor-only tape and a separate batch, config and output directory. The live student reads `DEEPSEEK_API_KEY` from the environment. Every fresh dialogue attempt rewinds the scripted tutor to its first turn.

```sh
npm run premium:calibrate -- --cards <locked-directory> --card-id <id> --config <dry-config> --tape <golden-tape> --out <dry-output>
npm run premium:check-calibration -- --checker <private-strict-checker.py> --expectations <expectations.json> --batch-id <dry-batch> --dry-run --out <dry-output>
# After authorization, verified serving identity, and reissued cards/expectations
npm run premium:calibrate -- --live-student --cards <reissued-directory> --card-id <id> --config <formal-config> --tape <tutor-tape> --out <formal-output>
npm run premium:check-calibration -- --checker <private-strict-checker.py> --expectations <reissued-expectations> --batch-id <formal-batch> --out <formal-output>
```

The formal config selects three tutors, both languages, five repeats, a student pinned to the verified returned model, empty Judge lists and a two-dollar budget and hard cap. The checker reads actual record files. Its exit code and JSON report cover cohort completeness and machine deviations. Human content checks and confirmation of the rewrite-rate denominator remain with Claude.

## Reservations, top-up and reconciliation

Use `prices.models[]` with `model` (configured model ID), `inputUsdPerMillion`, `outputUsdPerMillion`, ISO `date` and HTTPS `source`. Provide one row per active model, including zero-priced scripted tutors. Legacy global fixture rates remain readable. One SQLite writer serializes the batch. Each dispatch reserves half the serialized UTF-8 bytes rounded up, billed at input rate, plus the output cap at output rate. The student and Judge caps are 512 and 8192 tokens. Tutor reservations use the effective configured cap. The live student measures the serialized HTTP body. An admitted call records `reservedUsd`, reported usage and `usd`. Missing usage and ambiguous dispatched failures use the reservation and set `costEstimated`. A confirmed pre-dispatch failure costs zero.

Transient transport errors allow up to three retries after 2/4/8 seconds with 20% jitter or the provider's Retry-After. An interval above 60 seconds ends the job. Each retry needs its own reservation. Permanent HTTP errors carry a status code. Actual usage above the reservation is charged in full. Budget exhaustion stops new calls. The default hard cap is 1.25 times budget. `hardCapReached` identifies a crossed or reached cap. A local stop cannot reverse a charge already incurred.

A hybrid batch with recorded model-version drift stays stopped across resume and top-up. If the same receipt also consumes or exceeds the budget, `budgetStopReason`, `spentUsd` and `hardCapReached` retain the financial evidence.

An explicit `--top-up` with increased budget and a nondecreasing hard cap records `budgetHistory`. Rerun the same command and immutable inputs. A budget-interrupted dialogue restarts under a new run ID. The new record links to its predecessor in `restartOf`. Batch `runs.superseded` counts replaced attempts and `spentUsd` includes their charges. If only judging stopped, use rejudge to append the panel. A live job leaves a durable in-flight marker before dispatch. On a crash before commit the batch refuses further live work pending operator review of provider charges. Preserve the ledger and marker for incident reconciliation. Use separate output roots for new cohorts. Archived v1 batches retain the original executable for resumption.

Enter provider invoice totals through `npm run premium:reconcile -- --out <directory> --batch-id <id> --provider <provider> --usd <amount> --reason "<explanation>"`. Batch `reconciledUsd` maps providers to their invoice amounts. Its history retains each adjustment. A difference of at least 10% or one dollar requires an explanation. Dashboard spend is the price-table estimate, including historical attempts and appended scores.
