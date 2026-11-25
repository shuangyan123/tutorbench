# Premium runs dashboard

A local page for reading the premium runner's output: `index.jsonl`, `batches/<batchId>.json` and `records/<runId>.json`.
It reads record and batch schema v1 and v2.
It shows the formal pass rate, what still needs a person, the evidence behind each deterministic failure, the simulated student's checks, and where the three judges disagreed.

## Open it

Open `index.html` in a browser. No server and no build step are needed; it also works from `file://`.

- **Open runs folder** picks a runs folder (for example `runs/premium/`). You can also drag the folder onto the page.
- **Load synthetic sample** shows the bundled sample in `sample/sample-data.js`.

The files are read inside the browser tab. Nothing is uploaded, and the page makes no network requests (its Content-Security-Policy allows none).

## What the page shows

The page has three views. The filters (judge configuration, batch, language, card versions) sit at the right end of the view bar.

- **Overview** has two charts and two numbers:
  - *Who teaches well* has one row per tutor: its formal pass rate, then one mark per conversation. Good, flawed and fail come first; hollow rings at the end still need review and are not counted.
  - *Which cards separate the tutors* is a card × tutor grid in one hue, where a stronger colour means a higher pass rate. The cards with the widest spread between tutors come first. A small ring in a cell means some of its conversations still need review.
  - *Needs you* shows the number of conversations that need review and the number worth a spot check (soft student flags, rewrites, or tied judges).
  - Hovering a mark or a cell gives the detail. Clicking a mark opens that conversation. Clicking a cell, a tutor name or a number opens the matching list.
- **All conversations** is the full list, with state tabs and the run drawer. Tabs for superseded and calibration runs appear when such runs are loaded.
- **Run checks** shows judge disagreement and the batches. A batch's spend is the runner's price-table estimate. The row also shows the hard cap, any budget top-up, and each reconciled provider invoice with its difference from the estimate.

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
- `index.jsonl` rows that disagree with the records, plus records missing from the index and index rows missing from `records/`. For v2 rows this includes `batchKind`, `reviewFlags` and `fixedTestSkipped`.
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

Regenerating it needs a build that contains the premium runner with record schema v2 (`src/premium/`, added in PR #431):

```sh
npm run build
node tools/premium-dashboard/sample/generate-sample.mjs --runner dist/src/premium
# optional: also write a runs folder to try "Open runs folder" (must be a new or empty folder)
node tools/premium-dashboard/sample/generate-sample.mjs --runner dist/src/premium --out /tmp/premium-sample-runs
```

The output is deterministic: the same runner gives the same file.
