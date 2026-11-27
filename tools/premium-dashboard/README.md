# TutorBench Observatory（观测台）

A local page for reading the premium runner's output: `index.jsonl`, `batches/<batchId>.json`, `records/<runId>.json` and, for a calibration batch, `calibration-report-<batchId>.json`.
It reads run records of schema v1, v2, v3, v4 and v5 together, so a runs folder that grew across runner versions opens as one.
It is laid out like a printed atlas: numbered plates, one drawn specimen per conversation, and the words kept to titles, hovers and the run drawer.
It shows the formal pass rate, what still needs a person, the evidence behind each deterministic failure, the simulated student's checks, and where the three judges disagreed.

The folder keeps its old name, `tools/premium-dashboard/`, so links and scripts do not break.

## Open it

Open `index.html` in a browser. No server and no build step are needed; it also works from `file://`.

- **Open runs folder** picks a runs folder (for example `runs/premium/`). You can also drag the folder onto the page.
- **Load synthetic sample** shows the bundled sample in `sample/sample-data.js`.

The files are read inside the browser tab. Nothing is uploaded, and the page makes no network requests (its Content-Security-Policy allows none).

## What the page shows

The page has five views. The filters (judge configuration, batch, language, card versions) sit at the right end of the view bar.

- **Overview** has five plates:
  - *Plate I, Who teaches well*, has one row per tutor: a letter, the name, the formal pass rate, then one specimen per conversation. Counted specimens come first (good, flawed, fail). After a small gap come the ones that still need review; they stand on a dashed ground and are not counted. The hairline under each rate is its 95% range (Wilson score interval): when two tutors' lines overlap a lot, the gap between them may be luck.
  - *Plate II, Which cards separate the tutors*, is a dot plot. Each card is a row, each tutor is its letter, placed at its pass rate on that card, and a hairline joins the lowest to the highest. Tutors at the same rate stack upward. The cards with the widest spread come first, and the spread is printed at the right. A small dashed ring on a letter means some of that tutor's runs on that card still need review.
  - *Plate III, Is it worth it*, plots each tutor's pass rate (with its range) against what the tutor itself costs per conversation, or, with the toggle, how long each of its replies takes. Both are medians over the counted runs, on a log scale, so up and to the left is better. Only the tutor's own calls count; the simulated student and the judges are the benchmark's cost and stay under Run checks. Costs are price-table estimates. Waits depend on the network and provider load, so they are a guide only. Token counts are not compared, because each model's tokenizer counts the same text differently.
  - *Plate IV, Did the new version get better*, has one small panel for each tutor with more than one version in view. Each version is a dot at its pass rate with its 95% range as a vertical line. The big number is the newest version against the one before, in percentage points. It is called outside the error range only when the two ranges do not overlap. Versions are compared only on the card versions and languages that every one of them has scored runs on, so no version is judged on easier cards.
  - *Plate V, Needs you*, shows the number of conversations that need review and the number worth a spot check (soft student flags, rewrites, review flags or tied judges).
  - Hovering a specimen, a letter or a version dot gives the detail. Clicking a specimen opens that conversation. Clicking a letter, a tutor name, a version dot or a number opens the matching list.
- **Compare** puts two setups side by side. Pick A and B; the page first lists what differs (tutor, tutor model, tutor prompt, tutor parameters, simulated student model and parameters, judge configuration, rules version), then compares the pass rates overall and per card and language, only on the card versions and languages both sides scored. A result is read as the effect of a change only when exactly one thing differs (another tutor counts as one change, its model included). When more than one thing differs, the page says the difference cannot be put down to any one of them.
- **Calibration** appears when a calibration batch is loaded. It is described below.
- **All conversations** is the full list, with state tabs and the run drawer. The drawer shows the conversation's own specimen, large; clicking a leaf scrolls to that tutor turn. Tabs for superseded and calibration runs appear when such runs are loaded. A toggle keeps only the runs with a transport error.
- **Run checks** shows judge disagreement and the batches. A batch's spend is the runner's price-table estimate. The row also shows the hard cap, any budget top-up, and each reconciled provider invoice with its difference from the estimate. It lists each tutor's own prompt (name, version, start of its hash) and any parameters other than the defaults. When a model-version drift stops a batch and the same call also used up the budget, the drift is the status and the financial stop (`budgetStopReason`) is shown under it. Each batch also has a **calls** block (record schema v4 and later), described below.

### How to read a specimen

Each conversation is drawn as one small plant, standing on the plate's ground line.

| Part | Means |
| --- | --- |
| Stem | One node per tutor turn. Every specimen in a view uses the same scale (at least 15 turns), so heights compare. |
| Leaf | The judges' merged help level for that turn, 0 to 3: a longer leaf gives more help. A stub means the level is unknown. |
| Red leaf | The judges marked that turn as leaking the answer. |
| Head | The outcome: a filled dot is good, a half dot is flawed, a cross is fail, a dashed ring still needs review. A head lifted off the stem means the student left. |

Letters follow the tutor, never its rank: they are given in order of each tutor's first run over all loaded evaluation runs, so a filter never reletters anyone, and a tutor added later takes the next letter.

### Setups

A setup is everything a fair comparison holds fixed apart from the cards: tutor, tutor model, tutor prompt, tutor parameters, simulated student model and parameters, judge configuration and rules version. Cards are matched cell by cell instead. Parameters are compared by value, whatever order they were written in.

The tutor prompt is the tutor's own teaching prompt (record schema v3). It is read from `tutor.tutorPromptHash`, one hash for the prompt's Chinese and English text together, so a prompt's runs in both languages are one setup. The page shows it by `tutorPromptId` and `tutorPromptVersion`. A record with no prompt of its own (every v1 and v2 record, and a v3 record whose tutor has none) has a null hash: its tutor's system prompt is the card's setup alone. Per-language hashes (`tutor.promptHash` of the text actually sent, the judge prompt) are never part of a setup, because they would split one setup by language.

Another tutor counts as one change, its model included. Two tutor names for the same model, from the same developer and provider, are no change at all. A batch that runs a model with and without its own prompt needs two tutor names, and the prompt is then the only change.

### Tutor versions

A tutor is its label. Its version is the model the provider reported (`resolvedModel`), else the pinned or requested model. A version is the model only. The system prompt is not part of it, because it changes with the card and language, and neither is the tutor's own prompt: a new prompt is a change of setup, which Compare reads. Versions are ordered by when each first appears among all loaded records, so running an old version again later does not make it the newest.

Plates I, II and III show each tutor's newest version in view. If a tutor's row still mixes setups (another simulated student, rules version, tutor prompt or parameters), Plate I says so and points to Compare. Plate III also uses the newest version. Older versions appear on Plate IV and in the list.

The overview compares tutors, so it reads evaluation runs only. Calibration and superseded runs appear in the lists and the drawer.

## Calibration

A calibration batch checks the simulated student, not a tutor. Its verdict comes from the private checker (v2), which the runner's `check-calibration` command runs and writes to `calibration-report-<batchId>.json`. The page shows that report as written. It never re-checks a run, recomputes a verdict or applies a threshold of its own.

The view keeps three layers apart:

| Layer | Where it comes from | What the page shows |
| --- | --- | --- |
| 1 · Machine calibration | The checker report | `PASS`, `FAIL` or `CANNOT_CHECK`, the checker version, passing runs and groups, and whether it was a dry run. With no report the layer says so and gives no verdict. |
| 2 · Formal tutor scoring | — | Not applicable. Calibration runs are never scored (`unscored`, no `scorings`). |
| 3 · Independent content review | `humanReviewPending` in the report | *Pending* when the report says so. The page records no review outcome, and nothing on it can mark a review done. |

Beside the layers are the pass criteria and the rates:

- **Pass criteria** come from the private expectations file (`expectations.json`, schema v2). The report does not carry them. Put the file in the opened folder (top level) to list the per-run limits on hard and soft deviations, the passing runs a group needs and the rewrite limit. Without it, only the rewrite limit from the report is shown.
- **Rewrite rate** is the report's extra rewrites over student positions, with its limit and whether it passed.
- **Discard rate** is the report's discarded attempts over all attempts.
- **Spend** is the batch's estimated spend and status as the report states them.

Four plates follow:

- *Plate I, Groups* has one row per scripted tutor and one column per language. Each cell holds the report's passing runs out of the group's runs, its pass mark, and one student specimen per adopted run (see below). Optional groups are labelled and never fail the batch. Superseded runs are counted under the cell, not drawn.
- *Plate II, Sent back* is a heatmap of the student replies the runner sent back: one row per rule, grouped by family (format, protocol, state), one column per student message. A darker cell means more. Clicking a cell lists the runs and attempts behind it, and each one opens the drawer at that message. Replies from superseded runs are left out and counted under the plate.
- *Plate III, Deviations* is the checker's hard and soft findings, one row per group (tutor × language), one column per student message plus *whole run* for findings tied to no message. The number is the runs with a hard finding; soft findings are listed beside it. Clicking a cell lists the checker's own lines.
- *Plate IV, Integrity* lists the report's cohort errors, adopted runs the report does not mention, superseded runs and what replaced them, transport errors (with a link to the calls block under Run checks), the serving identity and fingerprints, how much of the learner's cache split is known, the batch's status history and the files the page read and did not read. The review-pack export is here too.

With more than one calibration batch loaded, a select picks the batch.

### How to read a student specimen

| Part | Means |
| --- | --- |
| Stem | One node per student message. Every specimen on the plate uses the same scale. |
| Leaf | A message the model wrote. It grows with each time the runner sent that message back. A small bud is a message accepted first time. The card's fixed opening line has no leaf. |
| Red leaf | The checker found a hard deviation at that message. |
| Dashed leaf | A soft deviation at that message. |
| Dots by the root | Attempts the runner discarded before the kept one. |
| Head | The checker's result for the run: a filled dot passed, a cross failed, a ring means no report. A head lifted off the stem means the student left. |

## The run drawer

For record schema v4 and later the drawer also shows:

- **attempt tabs**, one per attempt (kept, discarded, error), each with its own transcript, the reason it ended and the student message it stopped at
- on every student line: the student's stage and events, the end it declared, a stripped fence, soft flags, the number of rewrites, the call that wrote it and any retry wait
- under a line that was sent back, **each rejected draft** with its call, the rules that rejected it and its text (parsed when it is JSON, raw when it is not), then the accepted reply marked with its call. In a discarded attempt the last draft is marked as never accepted.
- the checker's lines for that message, copied from the report, and the checker's whole-run lines above the transcript
- the rejected replies counted by rule in the student checks
- a **calls** table with each call's role, model asked for and returned, fingerprint, tokens, cache split, cost (estimated or charged at its reservation), retry wait and error

For a calibration run the drawer opens with the checker's result for that run and a large student specimen; clicking a leaf scrolls to that message.

## The calls block under Run checks

Each batch has a folded block (it says so when its records are older than v4) with four small tables:

- **Model identity**: per role, the model asked for, the model returned and when the calls were made, then the batch's serving identity (`pinned`, `alias` or not recorded) and its evidence when the batch has some.
- **Fingerprints** of the role under test (the student in a calibration batch, the tutor otherwise), each with how many conversations it was in, adopted and superseded. A second fingerprint is flagged. A missing fingerprint is shown as *none returned*, not hidden.
- **Cache**: per model, how many calls have a known hit and miss split out of all its calls, the hit and miss tokens and the hit rate over those calls only, and the batch's own summary as written. A partial split is never read as the whole. Scripted models with no input are named under the table instead of shown as zero.
- **Transport**: each call that ended in a transport error and each retry that then succeeded: its run and call number, role, error, the wait before the retry, what it was charged (at its reservation when the call failed), and what became of the run. A run that was restarted links to the run that replaced it.

## Review pack

**Export review pack** (in the calls block and on Plate IV) builds a `.zip` inside the tab from the files already open. It reuses the evidence; it runs nothing and generates no evaluation data. The zip holds one folder, `review-pack-<batchId>/`:

| File | Contents |
| --- | --- |
| `records/` | Every record of the batch, superseded ones included, as the original bytes |
| `batches/<batchId>.json` | The batch file, original bytes |
| `calibration-report-<batchId>.json` | The checker report, when loaded |
| `expectations.json` (its own name) | The private expectations, when loaded |
| `index.jsonl` | Only this batch's lines, each exactly as it was |
| `review-index.csv` | One row per record, made by the page: whether it is adopted or superseded, tutor, language, repeat, the checker's result, findings and extra rewrites copied from the report, status, end, rejected replies by rule, attempts and how they stopped, student calls, transport errors, fingerprints, the restart links and the record's path |
| `README.txt` | What is inside, the three layers, what is not included and the limits, in English and Chinese |
| `SHA256SUMS.txt` | SHA-256 of every other file in the pack |

What a browser page cannot do, so the pack does not do it:

- It cannot read the ledger database (`.premium.sqlite`), so the pack has no ledger rows. Spend comes from the batch and the records.
- It cannot run Python, so it never re-runs the checker. The report is copied, not checked again.
- It cannot reach providers, so invoices are not checked. Costs are price-table estimates unless the batch records a reconciled invoice.
- It cannot see files outside the opened folder. Cards, student prompts, the checker, build outputs and launch evidence are not in a runs folder; the README lists them as not included, and lists any file in the folder the page did not read.
- A SHA-256 sum shows that a file has not changed since the export. It is not a signature and proves nothing about who made it.
- From the synthetic sample, files are re-serialised JSON, not original bytes, and the README says so.

The pack is private review material. Keep it where the runs folder is kept.

## What counts in the pass rate

Only the run's **current** scoring decides, that is, the last entry of `scorings`. An older scoring under another judge configuration never fills in.

A run counts in the formal pass rate only when both of these hold:

1. Its current scoring uses the judge configuration selected at the top of the page.
2. That scoring has a merged verdict (`good`, `flawed` or `fail`) and no pending items.

Pass rate = (good + flawed) / counted runs. These runs are listed but never counted:

| State | Meaning |
| --- | --- |
| Needs review | No final verdict yet: a pending item, an incomplete panel, or no scoring at all. A rule verdict that was withheld is shown with its evidence. |
| Not scorable | The run ended in `error` or `student_invalid`. |
| Other judge configuration | The current scoring was made under a different judge configuration. |
| Calibration | The run belongs to a calibration batch (`batchKind: "calibration"`, status `unscored`). It checks the simulated student only and is never judged. |
| Superseded | The budget interrupted the run and the runner restarted it after a top-up. The restarted record names it in `restartOf`. The interrupted record is kept for the audit. |

Review flags (`merged.reviewFlags`) and `fixedTestSkipped` do not block a verdict. A scored run with a review flag is counted and is also offered for a spot check.

Runs on an older card version are hidden by default and labelled when shown.

## Checks on the loaded files

The page reports instead of trusting:

- files that are not runner records or batches
- two different records with one `runId`
- one card version with two content hashes
- records whose batch file is missing
- `index.jsonl` rows that disagree with the records, plus records missing from the index and index rows missing from `records/`. For v2 rows this includes `batchKind`, `reviewFlags` and `fixedTestSkipped`; for v3 rows, `tutorPromptId` and `tutorPromptVersion`. Rows without those fields still pass.
- one tutor prompt id and version with two hashes
- a record whose tutor prompt differs from the one its batch lists for that tutor
- a `restartOf` that points to no loaded record, or two restarts of one record
- a file that looks like a calibration report or expectations file but is not one, two different reports for one batch, a report whose batch is missing or is not a calibration batch, and a run named in a report that is not in `records/`

## Files

| File | Role |
| --- | --- |
| `index.html` | Page and styles |
| `model.js` | Pure data model (no DOM). The page loads it as a script and the tests import it. |
| `pack.js` | SHA-256, CRC-32, a stored zip writer and CSV for the review pack. Pure, no DOM; also imported by the tests. |
| `app.js` | Rendering, filters, the run drawer, folder loading. Text goes in through `textContent` only. |
| `model.test.mjs` | Node tests for the model, run by `npm test` |
| `sample/generate-sample.mjs` | Builds the synthetic sample with the premium runner in offline replay |
| `sample/sample-data.js` | The generated sample. Do not edit by hand. |

## The synthetic sample

Every card, tutor, student and judge in the sample is synthetic. No real card, prompt, model output or person appears in it, and it is not a result for any model.

The sample is produced by the premium runner itself, so it follows the runner's real output format. It covers:

- every run state
- each pending reason
- an incomplete panel
- a rescoring under a second judge configuration
- an older card version
- student soft flags, rewrites and discarded attempts
- a budget stop and an unknown-cost stop
- a calibration batch, including a student reply sent back for leaving before the card's `leaveNotBefore`
- a run interrupted by its budget, a top-up and the restart that supersedes it, then a reconciled invoice
- review flags (split votes and a rule verdict that differs from the judges' majority), `fixedTestSkipped`, a judge ballot that was valid after one retry, a fenced ballot, and a call charged at its reservation
- a rerun of Dune with a newer simulated student, so Compare shows a one-change result and Plate I warns about the mixed row
- tutors with different prices and reply speeds (Dune cheap and fast, Cedar expensive and slow)
- older tutor versions on the three cards that did not change: Birch improves at `birch-2026-09` and then clearly regresses at `birch-2026-10`; Atlas improves at `atlas-2026-11`, but within its error range
- history and new records in one folder: the batches before 2026-11-25 are record schema v2, written by the older runner; the rest are v3, written by the newer runner into the same folder and ledger. Atlas's v2 pilot runs and its later v3 runs without a prompt are one setup.
- a tutor prompt of its own: `synthetic-prompt-08` runs Atlas without a prompt beside the same model as *Atlas · coach* with `synthetic-coach` 1.0.0, in both languages; `synthetic-prompt-09` runs 1.1.0, which adds one sentence. Compare reads either pair as one change, the prompt.
- a calibration batch stopped by model-version drift whose same call also used up the budget (`budgetStopReason`)
- record schema v5 calibration, written by the v5 runner and checked by the checker, with three scripted tutors (*Steady*, *Leaks at turn 2*, *Vague hints*) whose simulated student follows a scripted tape:
  - `synthetic-cannot-check-11`: the checker cannot run, so the report says `CANNOT_CHECK`
  - `synthetic-dryrun-12`: a dry run over every group, one repeat each, that passes
  - `synthetic-calibration-13`: three repeats in two languages that fail on one group, with replies sent back for format, protocol and state rules, a discarded attempt, a timeout retried after 1.5 s, a budget stop, a top-up and the restart that supersedes the stopped run, and two student fingerprints

Regenerating it needs three builds of the premium runner (`src/premium/` from PR #431) and the private calibration checker (v2), which is not in this repository:

- `--runner`: record schema v5 with `check-calibration` (PR #431 at db9ba4b or later). It writes the v5 calibration batches.
- `--v3-runner`: record schema v3 (PR #431 at 0f6dfb1). It writes the later evaluation batches.
- `--legacy-runner`: record schema v2 (PR #431 at 23cb0a5). It writes the history batches.
- `--checker`: the private `check_calibration.py`. It needs `python` on the path.

Without `--v3-runner` or `--legacy-runner`, the next newer runner writes those batches, so the file changes.

```sh
node tools/premium-dashboard/sample/generate-sample.mjs --runner <v5 build>/dist/src/premium --v3-runner <v3 build>/dist/src/premium \
  --legacy-runner <v2 build>/dist/src/premium --checker <path to check_calibration.py>
# optional: also write a runs folder to try "Open runs folder" (must be a new or empty folder).
# It holds the reports and a synthetic calibration-expectations.json, so the calibration view shows its criteria.
node tools/premium-dashboard/sample/generate-sample.mjs <same flags> --out /tmp/premium-sample-runs
```

The output is deterministic: the same runners give the same file.
