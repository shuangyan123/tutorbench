# TutorBench Observatory（观测台）

A local page for reading the premium runner's output: `index.jsonl`, `batches/<batchId>.json`, `records/<runId>.json` and, for a calibration batch, `calibration-report-<batchId>.json` (checker v2, v3 or v3.1), with the content review, the gate or final output and the probe file when they sit at the top of the folder.
It reads run records of schema v1 to v6 together, so a runs folder that grew across runner versions opens as one.
It is laid out like a printed atlas: numbered plates, one drawn specimen per conversation, and the words kept to titles, hovers and the run drawer.
It shows the formal pass rate, what still needs a person, the evidence behind each deterministic failure, the simulated student's checks, and where the three judges disagreed.

The folder keeps its old name, `tools/premium-dashboard/`, so links and scripts do not break.

## Open it

Open `index.html` in a browser. No server and no build step are needed; it also works from `file://`.

- **Open runs folder** picks a runs folder (for example `runs/premium/`). You can also drag the folder onto the page.
- **Load synthetic sample** shows the bundled sample in `sample/sample-data.js`.

The files are read inside the browser tab. Nothing is uploaded, and the page makes no network requests (its Content-Security-Policy allows none).

## What the page shows

The page has up to six views. The filters (judge configuration, batch, language, card versions) sit at the right end of the view bar.

- **Overview** has five plates:
  - *Plate I, Who teaches well*, has one row per tutor: a letter, the name, the formal pass rate, then one specimen per conversation. Counted specimens come first (good, flawed, fail). After a small gap come the ones that still need review; they stand on a dashed ground and are not counted. The hairline under each rate is its 95% range (Wilson score interval): when two tutors' lines overlap a lot, the gap between them may be luck.
  - *Plate II, Which cards separate the tutors*, is a dot plot. Each card is a row, each tutor is its letter, placed at its pass rate on that card, and a hairline joins the lowest to the highest. Tutors at the same rate stack upward. The cards with the widest spread come first, and the spread is printed at the right. A small dashed ring on a letter means some of that tutor's runs on that card still need review.
  - *Plate III, Is it worth it*, plots each tutor's pass rate (with its range) against what the tutor itself costs per conversation, or, with the toggle, how long each of its replies takes. Both are medians over the counted runs, on a log scale, so up and to the left is better. Only the tutor's own calls count; the simulated student and the judges are the benchmark's cost and stay under Run checks. Costs are price-table estimates. Waits depend on the network and provider load, so they are a guide only. Token counts are not compared, because each model's tokenizer counts the same text differently.
  - *Plate IV, Did the new version get better*, has one small panel for each tutor with more than one version in view. Each version is a dot at its pass rate with its 95% range as a vertical line. The big number is the newest version against the one before, in percentage points. It is called outside the error range only when the two ranges do not overlap. Versions are compared only on the card versions and languages that every one of them has scored runs on, so no version is judged on easier cards.
  - *Plate V, Needs you*, shows the number of conversations that need review and the number worth a spot check (soft student flags, rewrites, review flags or tied judges).
  - Hovering a specimen, a letter or a version dot gives the detail. Clicking a specimen opens that conversation. Clicking a letter, a tutor name, a version dot or a number opens the matching list.
- **Compare** puts two setups side by side. Pick A and B; the page first lists what differs (tutor, tutor model, tutor prompt, tutor parameters, simulated student model and parameters, judge configuration, rules version), then compares the pass rates overall and per card and language, only on the card versions and languages both sides scored. A result is read as the effect of a change only when exactly one thing differs (another tutor counts as one change, its model included). When more than one thing differs, the page says the difference cannot be put down to any one of them.
- **Calibration** appears when a calibration batch (full or probe) is loaded. It is described below.
- **Probes** appears when a single-step probe batch (`kind: "calibration-probe"`) is loaded. It is described below.
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

A calibration batch checks the simulated student, not a tutor. A full calibration (`kind: "calibration"`) runs whole conversations against scripted tutors; a probe batch (`kind: "calibration-probe"`, record schema v6) replays a fixed history prefix and has the student write one target message. Its verdict comes from the private checker, which the runner's `check-calibration` command runs and writes to `calibration-report-<batchId>.json`. The page shows that report as written. It never re-checks a run, recomputes a verdict or applies a threshold of its own.

Checker v2 writes `pass` per run and group and one `verdict`. Checker v3 writes `machinePass`, probe or tutor groups, an `l0` block (rewrite and discard rates, first-try acceptance by message, observed output formats), review items per run, a `machineVerdict`, and a `verdict` that stays `PENDING_REVIEW` until the review (a machine `FAIL` stays `FAIL`). Checker 3.1 adds `checkerRevision` and, for a diagnostic batch, `diagnostic: true` and `verdict: "DIAGNOSTIC"`. The page reads both shapes into one and shows the version.

**What the batch is for** is drawn first, as a strip of three, with the current one in ink:

| Class | How the page knows | What follows from it |
| --- | --- | --- |
| Diagnostic | The batch has `gate: "diagnostic"`, or the report says `diagnostic: true` or `DIAGNOSTIC` | For development only. It needs no content review, a final verdict refuses it, and its numbers count toward no gate. |
| Formal calibration | A calibration or probe batch that is not diagnostic | The machine verdict goes through the content review before a gate or final verdict. |
| Tutor evaluation | Any other batch | Scored runs; see Overview and Compare. |

Then three layers, kept apart. Each is copied from its own file, and the page never turns one into another:

| Layer | Where it comes from | What the page shows |
| --- | --- | --- |
| 1 · Machine verdict | The checker report | `PASS`, `FAIL` or `CANNOT_CHECK`, the checker version or revision, passing runs and groups, whether it was a dry run, and the report's overall verdict when it differs (`PENDING_REVIEW`, `DIAGNOSTIC`). With no report the layer says so and gives no verdict. |
| 2 · Content review | `content-review-<batchId>.json` | Open or complete, items decided, items that failed, overrides of the machine, items still pending, the reviewer and whether the review was blind. A diagnostic batch shows *not needed*. With checker v2 there are no review items, so only the report's `humanReviewPending` is shown. |
| 3 · Final verdict | `gate-<scope>.json` (gate G2 or G3, or final G4) | The gate or final verdict that names this batch, its review status, how many batches it merged, its overrides and errors. Without such a file it says *none yet*. A diagnostic batch shows *not applicable*. |

The review follows the rules the content review states: an `auto_pass` item counts as pass without a decision; an `auto_fail` item passes only when the reviewer overrides it; a `needs_review` item nobody decided is pending while the review is open and counts as fail once it is complete.

Beside the layers are the pass criteria and the rates:

- **Pass criteria** come from the private expectations file (schema v2, or v3 with probe expectations). The report does not carry them. Put the file in the opened folder (top level) to list the per-run limits on hard and soft deviations, the passing runs a group (or a probe in one language) needs and the rewrite limit. Without it, only the rewrite limit from the report is shown.
- **Rewrite rate** is the report's extra rewrites over student positions, with its limit and whether it passed.
- **Discard rate** is the report's discarded attempts over all attempts.
- **Spend** is the batch's estimated spend and status as the report states them.
- With checker v3: **accepted at first try**, per target message, and the **observed output formats** (`json`, `fenced_json`, `text`, `empty`, `truncated`).

Five plates follow:

- *Plate I, Groups* has one row per scripted tutor, or per probe with its purpose, and one column per language. Each cell holds the report's passing runs out of the group's runs, its pass mark, the count after review when a gate file gives one, and one student specimen per adopted run (see below). Optional groups are labelled and never fail the batch. Superseded runs are counted under the cell, not drawn.
- *Plate II, Sent back* is a heatmap of the student replies the runner sent back: one row per rule, grouped by family (format, protocol, state), one column per student message. A darker cell means more. Clicking a cell lists the runs and attempts behind it, and each one opens the drawer at that message. Replies from superseded runs are left out and counted under the plate.
- *Plate III, Deviations* is the checker's hard and soft findings, one row per group (tutor or probe × language), one column per student message plus *whole run* for findings tied to no message. The number is the runs with a hard finding; soft findings are listed beside it. Clicking a cell lists the checker's own lines.
- *Plate IV, Content review* crosses the checker's label (auto pass, needs review, auto fail) with the reviewer's decision (pass, fail, undecided). Clicking a cell lists its items with the run, the message, the question, the checker's and the reviewer's quotes, the note, and the result by the rules; overrides and undecided fails are marked. Decisions in the review file that match no item in the report are listed under the plate.
- *Plate V, Integrity* lists the report's cohort errors, adopted runs the report does not mention, superseded runs and what replaced them, transport errors (with a link to the calls block under Run checks), the serving identity and fingerprints, how much of the learner's cache split is known, the batch's status history, the gate and phase, the calibration series and earlier batches, the requested output format, the versions the report pins, and the files the page read and did not read. The review-pack export is here too.

With more than one calibration batch loaded, a select picks the batch. Formal batches come first, diagnostic ones last.

### How to read a student specimen

| Part | Means |
| --- | --- |
| Stem | One node per student message. Every specimen on the plate uses the same scale. |
| Leaf | A message the model wrote. It grows with each time the runner sent that message back. A small bud is a message accepted first time. The card's fixed opening line has no leaf. |
| Red leaf | The checker found a hard deviation at that message. |
| Dashed leaf | A soft deviation at that message. |
| Dots by the root | Attempts the runner discarded before the kept one. |
| Head | The checker's result for the run: a filled dot passed, a cross failed, a ring means no report. A head lifted off the stem means the student left. |

## Probes

A probe batch replays a fixed history prefix, the same in every repeat, and has the simulated student write one target message. The view shows one probe batch at a time (formal before diagnostic), with the class strip and the three layers on top.

- *Plate I, Probes × languages* has one row per probe: its id, key or remaining probe, purpose and target message, then, per language, the machine count of passing runs, the count after review when a gate file is loaded, one specimen per run, and three prefix checks: the prefix is the *same* in every run, its SHA-256 matches the record's `prefixHash`, and it matches the probe file. A check that cannot be made (no hash, no probe file) says so; it never passes by default. Probes in the probe file that this batch did not run are listed faintly.
- *Plate II* is the selected probe: what the target message should do in each language (from the probe expectations), the fixed prefix line by line with Chinese beside English, and each repeat's target message, Chinese beside English. Each target message is shown as four parts: the **raw output** the model returned, the **model's words** and the events it reported (events the runner dropped are struck through), what the **runner injected** (the fixed sentence and the events it added), and the **final message** the conversation kept, with its stage and events. Above them: the checker's result, the observed format, replies sent back before it, discarded attempts, and the review items with their decisions. Each opens the full record in the drawer.

The prefix hash is checked the way the runner makes it: SHA-256 of the prefix lines as JSON, without the line numbers the runner adds.

## The run drawer

For record schema v4 and later the drawer also shows:

- **attempt tabs**, one per attempt (kept, discarded, error), each with its own transcript, the reason it ended and the student message it stopped at
- on every student line: the student's stage and events, the end it declared, a stripped fence, soft flags, the number of rewrites, the call that wrote it and any retry wait
- under a line that was sent back, **each rejected draft** with its call, the rules that rejected it and its text (parsed when it is JSON, raw when it is not), then the accepted reply marked with its call. In a discarded attempt the last draft is marked as never accepted.
- the checker's lines for that message, copied from the report, and the checker's whole-run lines above the transcript
- the rejected replies counted by rule in the student checks
- a **calls** table with each call's role, model asked for and returned, fingerprint, tokens, cache split, cost (estimated or charged at its reservation), retry wait and error

For a calibration run the drawer opens with the checker's result for that run and a large student specimen; clicking a leaf scrolls to that message.

For record schema v6 and checker v3 it also shows:

- for a probe run, the probe, its purpose and target, the probe set, the replayed tutor tape, the protocol version, and the prefix hash with its two checks. The fixed prefix folds into one block at the top of the transcript, and the target message is marked.
- under each message the model wrote, the four parts (raw output, model's words, runner injected, final message). The block is open where they differ: a runner injection, a dropped or added event, a stripped fence, or a probe's target.
- the run's review items with the checker's label, the decision, the result by the rules, the quotes and the note, then the milestones the checker found and how the student's self-reported stage and events compare.

## The calls block under Run checks

Each batch has a folded block (it says so when its records are older than v4) with four small tables:

- **Model identity**: per role, the model asked for, the model returned and when the calls were made, then the batch's serving identity (`pinned`, `alias` or not recorded) and its evidence when the batch has some.
- **Fingerprints** of the role under test (the student in a calibration batch, the tutor otherwise), each with how many conversations it was in, adopted and superseded. A second fingerprint is flagged. A missing fingerprint is shown as *none returned*, not hidden.
- **Cache**: per model, how many calls have a known hit and miss split out of all its calls, the hit and miss tokens and the hit rate over those calls only, and the batch's own summary as written. A partial split is never read as the whole. Scripted models with no input are named under the table instead of shown as zero.
- **Transport**: each call that ended in a transport error and each retry that then succeeded: its run and call number, role, error, the wait before the retry, what it was charged (at its reservation when the call failed), and what became of the run. A run that was restarted links to the run that replaced it.

## Review pack

**Export review pack** (in the calls block and on Plate V) builds a `.zip` inside the tab from the files already open. It reuses the evidence; it runs nothing and generates no evaluation data. The zip holds one folder, `review-pack-<batchId>/`. An agent can read `manifest.json` first and find everything else from it:

| File | Contents |
| --- | --- |
| `records/` | Every record of the batch, superseded ones included, as the original bytes |
| `batches/<batchId>.json` | The batch file, original bytes |
| `calibration-report-<batchId>.json` | The checker report, when loaded |
| `expectations.json` (its own name) | The private expectations, when loaded |
| `content-review-<batchId>.json` | The content review, when loaded, original bytes |
| `gate-<scope>.json` (its own name) | Every gate or final output that names this batch, original bytes |
| `probes.json` (its own name) | The probe file of a probe batch, when loaded |
| `index.jsonl` | Only this batch's lines, each exactly as it was |
| `review-index.csv` | One row per record, made by the page: the batch's class, whether the record is adopted or superseded, probe, tutor, language, repeat, the checker's result, findings and extra rewrites copied from the report, its review items (how many need review, auto fail, were decided fail, override the machine, are pending), status, end, rejected replies by rule, attempts and how they stopped, student calls, transport errors, fingerprints, the prefix hash, the restart links and the record's path |
| `review-items.csv` | One row per checker review item: run, probe or tutor, language, repeat, item, level, the checker's label and quote, the question, the reviewer's decision, quote and note, whether it overrides the machine, and the result by the rules. Not written when the report has no review items. |
| `messages.csv` | One row per student message of every attempt, kept or sent back, prefix lines and fixed openings included: whether it is the probe's target, the call, the observed format, the rules that sent it back, the raw output, the model's words and events, the injected text, the events the runner added and dropped, the final text, stage, events and end, and the hard and soft flags |
| `manifest.json` | `tutorbench.observatory-review-pack` v1: the batch, its class, kind, gate, phase, series and probes; the three layers as the page read them (machine, review, final, with their counts); every file with its role, size and SHA-256, the derived tables with their rows and columns; the files the page did not read; and the rules that keep the layers apart |
| `README.txt` | What is inside, the class, the three layers, what is not included and the limits, in English and Chinese. A diagnostic batch is marked as not counting toward any gate. |
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
| Calibration | The run belongs to a calibration or probe batch (`batchKind: "calibration"` or `"calibration-probe"`, status `unscored`). It checks the simulated student only and is never judged. |
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
- a file that looks like a content review, gate output or probe file but is not one; two different reviews for one batch; a review whose batch is missing; a decision for a run outside the batch or for an item the report does not list
- a gate or final output that names a batch that is not loaded, gives a machine verdict other than the report's, or includes a diagnostic batch
- for a probe record, the page also shows (it does not warn) whether its prefix is the same in every run, matches its hash and matches the probe file

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
- record schema v6, written by the v6 runner with a synthetic student protocol (the runner injects the fixed sentence), a synthetic probe file and two scripted tutor tapes. Their checker v3 reports, content reviews and gate output are written by the generator in the shapes the checker and the reviewer write, because the real checker v3 is written for one private card:
  - `synthetic-probes-g2-14`: gate G2, the three key probes, five repeats in two languages, in calibration series `synthetic-series-1`. The machine passes; the complete content review fails two runs and overrides one auto fail, so the gate output says `FAIL`.
  - `synthetic-probes-diag-15`: a diagnostic probe batch (`gate: "diagnostic"`, checker 3.1 `DIAGNOSTIC`), with a discarded attempt. It has no review and no final verdict.
  - `synthetic-calibration-16`: a full calibration with the protocol and two scripted tutors, checker 3.1, and a content review still open (Chinese runs read, English runs not yet).
  - Their target messages cover an injected fixed sentence, a student who wrote it or echoed it, an empty reply, a truncated reply, a fenced reply, a dropped event and a skipped stage.

Regenerating it needs four builds of the premium runner (`src/premium/` from PR #431) and the private calibration checker (v2), which is not in this repository:

- `--runner`: record schema v6 with probes (PR #431 at 1969737). It writes the v6 batches.
- `--v5-runner`: record schema v5 with `check-calibration` (PR #431 at db9ba4b). It writes the v5 calibration batches.
- `--v3-runner`: record schema v3 (PR #431 at 0f6dfb1). It writes the later evaluation batches.
- `--legacy-runner`: record schema v2 (PR #431 at 23cb0a5). It writes the history batches.
- `--checker`: the private `check_calibration.py`. It needs `python` on the path.

Without `--v5-runner`, `--v3-runner` or `--legacy-runner`, the next newer runner writes those batches, so the file changes.

```sh
node tools/premium-dashboard/sample/generate-sample.mjs --runner <v6 build>/dist/src/premium --v5-runner <v5 build>/dist/src/premium \
  --v3-runner <v3 build>/dist/src/premium --legacy-runner <v2 build>/dist/src/premium --checker <path to check_calibration.py>
# optional: also write a runs folder to try "Open runs folder" (must be a new or empty folder).
# It holds the reports, the synthetic expectations (v2 and v3), the probe file, the content reviews and the gate output,
# so every view and every part of the review pack can be tried.
node tools/premium-dashboard/sample/generate-sample.mjs <same flags> --out /tmp/premium-sample-runs
```

The output is deterministic: the same runners give the same file.
