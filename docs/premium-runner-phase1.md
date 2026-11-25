# Premium Set Runner · offline Phase 1

This runner replays authored replies to exercise a multi-turn evaluation protocol. Its synthetic verdicts describe the fixture. All four commands use local files. A new private directory under `runs/` or an access-controlled directory outside the checkout is suitable for output. Node 24 and the repository build are required.

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

`premium:check-cards -- --card <path/to/card.json>` checks only the bilingual metadata schema. A runnable directory requires both nonempty shared rule files and a trusted `cards.lock.json`. The lock enumerates the batch's selected cards. It is read-only throughout execution. The handoff delivered private card #1 and example records. Its shared rules, authoritative hashes and cards #2–#8 are outstanding. The checked-in tile problem, rules, lock, tape and rates are independently authored synthetic fixtures.

For the Phase 1 lock convention, decode as strict UTF-8 without BOM and replace CRLF with LF. Preserve all remaining characters, spaces and trailing newlines. Form a JSON array of **five strings** in order: verbatim `card.json` text, Chinese student Markdown, English student Markdown, Chinese shared rules, English shared rules. Hash the UTF-8 bytes of compact ECMAScript `JSON.stringify(array)` using SHA-256, prefix the lowercase hex digest with `sha256:`. JSON framing preserves file boundaries. A missing component, wrong ID/version or changed digest stops loading. Inside an existing ledger, an observed card ID/version stays bound to its first digest even if someone edits the lock. A fresh output root relies on the issuer's trusted lock. Claude must confirm this encoding before issuing real locks.

### Models and tapes

`config.json` declares tutor labels, requested models, pinned versions, hosting providers and canonical **developer** IDs, student, ordered panel/reserves and the Judge configuration version. Operators supply verified developer identities, including when using a common host. Selection excludes the tutor's and student's developers and uses distinct developers across the panel. It consumes primaries before reserves. Each successful response records the returned version. Student and Judge version mismatches, and a tutor changing version within a dialogue, interrupt the affected operation.

The handoff names DeepSeek V4.1-Flash for the student, Qwen4-Max (Alibaba), Mistral Large 3 (Mistral AI), and MiniMax-M3 (MiniMax) for the panel, with GLM-5.3 (Zhipu AI) then Kimi K3.1 Pro (Moonshot AI) as reserves. These are handoff designations. Account availability and immutable serving revisions need verification before any separately authorized live phase. The runnable config pairs those designations with a mock hosting provider and explicitly synthetic serving revisions.

A tape is a JSON object keyed by `cardId/lang/tutorId`. Each entry maps a model ID to an ordered array of replies. Each reply has visible `text`, `finishReason`, `latencyMs` and token `usage` or null. Optional `resolvedModel` defaults to the configured synthetic pinned version. A missing frame or null simulates a provider error. Every job starts at frame zero. Retries and discarded dialogue attempts consume frames. Rejudging starts fresh Judge tracks. Raw private tapes and source cards belong outside tracked directories.

### Serving revision and executable identity

For students and Judges, the session compares the returned `resolvedModel` string with `pinnedVersion` on each call. For a tutor, the first returned revision establishes the reference for that model in that job, including discarded attempts. A stable tutor revision can differ from the configured pin. A new job starts a new session. The replay adapter can fill an omitted revision from the tape configuration. These comparisons establish consistency of supplied strings. A formal run requires a separately verified immutable serving revision and a provider-returned identity on every call, with any alias-to-revision mapping recorded and verified. A mock default supplies no such evidence.

The Phase 1 CLI reads `git rev-parse HEAD` from its working directory and executes the existing JavaScript under `dist/`. That SHA alone cannot establish worktree cleanliness or which sources produced the JavaScript. For formal evidence, run from the intended repository root in a fresh checkout of the reviewed commit. Verify the full commit and tree IDs and a clean index/worktree, including untracked source files. Use the committed dependency lock, record Node/npm versions, install with `npm ci`, and build into a fresh output directory. Record a digest of the executed build (relative paths and file hashes), and verify that same build at invocation. Keep those checks with the run or rejudge provenance. Phase 1 leaves this verification to the operator.

### Execution and evidence

The first message uses the selected language's exact `firstMessage`. Tutor history maps students to user and tutors to assistant. Only visible text crosses this boundary. Student history reverses these roles and preserves its own full JSON. The first assistant message contains the synthesized initial state. Rewrites receive the rejected text and reason privately. An accepted message records its rewrite count, hard failures and soft flags. Two failed rewrites discard that attempt. After three discarded attempts the run ends as `student_invalid`. The 15th tutor turn ends the conversation immediately.

Each Judge receives a separate request containing the tutor setup, localized Judge context, fixed-test number/type and numbered visible transcript. A validated ballot covers every tutor turn exactly once, with verbatim evidence from that turn and in-range references. A completed panel supplies five boolean majorities per turn, a median help level, transition votes, fixed-test outcome, transfer, and disagreements with each Judge's vote. Rule-based verdicts use per-turn majority leakage, terminal reason and independent solution evidence. Ballot errors, ties and the open protocol cases below preserve evidence for review.

The config's versioned mock price table uses USD per million input/output tokens. Mock receipts and balances are rounded to the nearest billionth of a dollar. Each call checks the remaining batch allowance against a per-call reservation. It bills reported usage, including rewrites and discarded attempts. Unknown prices prevent the first call. Unknown usage/cost retains null and stops further spending. A reported cost can exceed the reservation; the ledger records the full amount and stops. Zero usage is meaningful only when reported or when the mock explicitly confirms a pre-dispatch failure.

The fixed challenge is delivered when its literal text appears on the prescribed student message. The student's event remains a separate self-report. Per-message soft flags distinguish a missing event, an event without text, an early or late event, and text on the wrong message. Accepted messages retain their text and events. Rejected rewrites retain their raw reply, hard reasons and any soft flags. The existing missing-text rewrite and skip exception still apply. For a delivered challenge with a tutor reply, `fixedTest.outcome == leaked` and `noLeak == false` must agree in both directions on that reply.

## Dashboard read interface for Claude

| Artifact | How to consume it |
| --- | --- |
| `index.jsonl` | UTF-8, one row per run, sorted by record filename, latest scoring. Filter by `status` before comparing verdicts. Group by `cardId`, `cardVersion`, `cardHash`, `lang` and Judge config version. Compare `tutorLabel` and `tutorResolvedModel`. Compare with the current trusted lock to mark older cards. |
| `batches/<batchId>.json` | Configuration, card identities, code/tape identity, budget, `spentUsd`, `status` and `runs` counts. `unknown_cost`, `budget_stop` and `actual_over_budget` stop further calls. |
| `records/<runId>.json` | Follow `recordPath` for chronological messages, first-run status, immutable attempt evidence and call ledger. Each scoring retains its config, prompt hash, isolated outputs, validation failures, aggregate and disagreement votes. Use the last scoring to render the current detail view. |

Schema names and version 1 follow the handoff. Index rows include identities, repeat, latest scoring ID, verdict/reasons, fixed test, end reason, turn totals, help levels, leak turns, transfer, unfired behaviours, discarded attempts, disagreements and USD. The sample record and sample index use different placeholders for the same student version; reconstruction uses the record's value. The runner preserves the manifest’s full suite ID in `suiteId` and splits a trailing `-v<number>` for the example’s `suite` and `suiteVersion` fields. Aggregates and verdicts may be null. A missing panel cannot contribute a tally. Show `pending`, per-Judge errors and the raw accepted/rejected evidence on drill-down. Keep soft flags visible even on a scored run.

Phase 1 extensions for review include `attempts[].transcript/rejected/calls`, `calls[]` (model, request fingerprint, returned metadata, usage, simulated retry delay and stable error code), `perJudge[].raw/error`, `scorings[].pending/calls/usage`, and `usage.rates`. The raw Judge field contains only the visible model text. Secret-shaped responses are withheld and recorded by failure code. Transcripts, private tutor setup and audit evidence require private storage; use synthetic or reviewed deidentified inputs. Credential filtering supplements this input boundary.

The private `.premium.sqlite` ledger commits one entire simulated job at a time, serializes writers, and stores initial run payloads and subsequent score entries separately. A process crash before commit may replay that offline job. After commit the next run/index command repairs JSON views via atomic replacement and skips the committed job. Exported JSON files alone suffice for Dashboard use and index reconstruction. Preserve the private ledger and identical source inputs for resume/rejudge. Keep copies of completed batches while the writer is idle. Rejudge explicitly appends a new scoring, including failed panels; all earlier fields stay intact. Initial record `usage` includes scoring s1. Batch/index totals additionally include each later scoring once.

## Protocol decisions requested from Claude

| Open question | Phase 1 handling pending confirmation |
| --- | --- |
| Unsolved, early exit without majority leakage or a rule-defined failure | Preserve `needs_review`, null verdict and `unsolved_early_exit`. Confirm the intended classification. |
| Fixed challenge skipped with `thanked_after_answer` | Accept the student message for dialogue control. Retain exact tutor evidence and Judge votes. Hold the verdict and request the required evidence standard. |
| Three different categorical votes | Keep the three votes, null category and pending reason. Confirm treatment of category ties, including Judge verdict majority. |
| Transfer trigger, initial mistake, retry and termination | Preserve the dialogue and transfer votes. A majority report of a transfer activity holds the verdict pending a trigger/end contract. |
| Deterministic failure alongside an unresolved classification or transfer | Should majority leakage, departure, or an established tutor-fault failure take precedence over pending review in the final verdict? Until confirmed, retain `needs_review` and a null final verdict. In this combination, `merged.withheldRuleVerdict` records `fail`, with the evidence in `reasons`, `leakTurns`, the recorded end reason and the underlying ballots. |
| Fixed-test event discrepancies | Confirm whether any timing or self-report discrepancy should affect validity. The new flags are audit evidence only. |
| Immutable original versus appended scores | Proposed contract uses insert-only evidence plus an atomically refreshed JSON view. Confirm latest-score indexing, append-on-failure and cumulative cost display. |
| API retries, budget reservation and overrun | Default one mock attempt. Optional `maxOfflineAttempts` (1–4 total) retries only explicit `"mock_not_dispatched"` frames, recording virtual 1/2/4-second delays. Ambiguous failures stop. Confirm live retry counts, retryable outcomes, reservation units, actual overrun reconciliation and cost authority. |

Claude review is also requested for the bilingual Judge wording and the framed lock encoding. The live pilot, student-model adherence percentages and empirical tutor comparisons require separate inputs and authorization.
