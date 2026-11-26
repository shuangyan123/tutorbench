# TutorBench Observatory（观测台）

A local page for reading the premium runner's output: `index.jsonl`, `batches/<batchId>.json` and `records/<runId>.json`.
It reads run records of schema v1, v2 and v3 together, so a runs folder that grew across runner versions opens as one.
It is laid out like a printed atlas: numbered plates, one drawn specimen per conversation, and the words kept to titles, hovers and the run drawer.
It shows the formal pass rate, what still needs a person, the evidence behind each deterministic failure, the simulated student's checks, and where the three judges disagreed.

The folder keeps its old name, `tools/premium-dashboard/`, so links and scripts do not break.

## Open it

Open `index.html` in a browser. No server and no build step are needed; it also works from `file://`.

- **Open runs folder** picks a runs folder (for example `runs/premium/`). You can also drag the folder onto the page.
- **Load synthetic sample** shows the bundled sample in `sample/sample-data.js`.

The files are read inside the browser tab. Nothing is uploaded, and the page makes no network requests (its Content-Security-Policy allows none).

## What the page shows

The page has four views. The filters (judge configuration, batch, language, card versions) sit at the right end of the view bar.

- **Overview** has five plates:
  - *Plate I, Who teaches well*, has one row per tutor: a letter, the name, the formal pass rate, then one specimen per conversation. Counted specimens come first (good, flawed, fail). After a small gap come the ones that still need review; they stand on a dashed ground and are not counted. The hairline under each rate is its 95% range (Wilson score interval): when two tutors' lines overlap a lot, the gap between them may be luck.
  - *Plate II, Which cards separate the tutors*, is a dot plot. Each card is a row, each tutor is its letter, placed at its pass rate on that card, and a hairline joins the lowest to the highest. Tutors at the same rate stack upward. The cards with the widest spread come first, and the spread is printed at the right. A small dashed ring on a letter means some of that tutor's runs on that card still need review.
  - *Plate III, Is it worth it*, plots each tutor's pass rate (with its range) against what the tutor itself costs per conversation, or, with the toggle, how long each of its replies takes. Both are medians over the counted runs, on a log scale, so up and to the left is better. Only the tutor's own calls count; the simulated student and the judges are the benchmark's cost and stay under Run checks. Costs are price-table estimates. Waits depend on the network and provider load, so they are a guide only. Token counts are not compared, because each model's tokenizer counts the same text differently.
  - *Plate IV, Did the new version get better*, has one small panel for each tutor with more than one version in view. Each version is a dot at its pass rate with its 95% range as a vertical line. The big number is the newest version against the one before, in percentage points. It is called outside the error range only when the two ranges do not overlap. Versions are compared only on the card versions and languages that every one of them has scored runs on, so no version is judged on easier cards.
  - *Plate V, Needs you*, shows the number of conversations that need review and the number worth a spot check (soft student flags, rewrites, review flags or tied judges).
  - Hovering a specimen, a letter or a version dot gives the detail. Clicking a specimen opens that conversation. Clicking a letter, a tutor name, a version dot or a number opens the matching list.
- **Compare** puts two setups side by side. Pick A and B; the page first lists what differs (tutor, tutor model, tutor prompt, tutor parameters, simulated student model and parameters, judge configuration, rules version), then compares the pass rates overall and per card and language, only on the card versions and languages both sides scored. A result is read as the effect of a change only when exactly one thing differs (another tutor counts as one change, its model included). When more than one thing differs, the page says the difference cannot be put down to any one of them.
- **All conversations** is the full list, with state tabs and the run drawer. The drawer shows the conversation's own specimen, large; clicking a leaf scrolls to that tutor turn. Tabs for superseded and calibration runs appear when such runs are loaded.
- **Run checks** shows judge disagreement and the batches. A batch's spend is the runner's price-table estimate. The row also shows the hard cap, any budget top-up, and each reconciled provider invoice with its difference from the estimate. It lists each tutor's own prompt (name, version, start of its hash) and any parameters other than the defaults. When a model-version drift stops a batch and the same call also used up the budget, the drift is the status and the financial stop (`budgetStopReason`) is shown under it.

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

## Files

| File | Role |
| --- | --- |
| `index.html` | Page and styles |
| `model.js` | Pure data model (no DOM). The page loads it as a script and the tests import it. |
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

Regenerating it needs a build that contains the premium runner with record schema v3 (`src/premium/`, PR #431 at 0f6dfb1 or later). The bundled sample also passes `--legacy-runner`, a build with record schema v2 (PR #431 at 23cb0a5), for the history batches; without it, the newer runner writes every batch.

```sh
npm run build
node tools/premium-dashboard/sample/generate-sample.mjs --runner dist/src/premium --legacy-runner <v2 build>/dist/src/premium
# optional: also write a runs folder to try "Open runs folder" (must be a new or empty folder)
node tools/premium-dashboard/sample/generate-sample.mjs --runner dist/src/premium --legacy-runner <v2 build>/dist/src/premium --out /tmp/premium-sample-runs
```

The output is deterministic: the same runners give the same file.
