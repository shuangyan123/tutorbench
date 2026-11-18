# Held-out review and regression baseline v0.1

The regression baseline is `learner-evidence-hint-fit@0.1.0` at
`7fb88533f23166d1251c94e4720f8537daec6bbe`. The
[manifest](../../scenarios/experimental/learner-evidence-hint-v0.1/baseline.json)
pins the rule source, authored trajectories, design replies, maintainer review
and new held-out packet. Source checks normalize Windows line endings. The
maintainer review retains the original corpus and historical result hashes.
The baseline has a categorical decision identity and no numeric scoring identity.

## Cohorts and measurement units

The design set comprises 14 synthetic replies (42 judgments) and three
original DeepSeek replies (nine counterfactual judgments). The held-out
cohort adds 10 different author-written replies after freezing v0.1,
covering paraphrases, mathematical errors, different reasonable strategies,
redundant help and inadequate support after a reported difficulty. Every reply
is paired with all three frozen conditions.

| Held-out condition | Unique replies within condition | Planned paired judgments | Human reviews received |
| --- | ---: | ---: | ---: |
| A · Unknown | 10 | 10 | 10/10 (private) |
| B · Local understanding | 10 | 10 | 10/10 (private) |
| C · Unresolved difficulty | 10 | 10 | 10/10 (private) |
| Combined | 10 | 30 | 30/30 (private) |

The three rows for any reply are related observations. The packet holds out
replies, with the original equation and learner histories reused. It supports
descriptive comparisons within this task. Keep this packet out of rule design
and freeze a fresh cohort if its examples or labels inform a later revision.

The maintainer completed all 30 judgments and froze the reference locally on
2026-11-16. Those private labels and the original baseline remain outside the
repository; their existence is operator-reported, not independent Gold. No
held-out agreement, accuracy improvement, or canonical promotion is claimed.

## Maintainer review

```powershell
npm run build
node scripts/research/learner-evidence-hint-held-out.mjs template
# Historical-only: run baseline in the isolated original v0.3a.5 checkout
node scripts/research/learner-evidence-hint-held-out.mjs baseline
```

Share only `artifacts/real-model/learner-evidence-hint-held-out-v0.1.0.review-template.json`
for review. Each task includes the learning goal, exact visible learner and
prior tutor turns, and the complete reply. Use the matching `unitId` in
`judgments` to enter:

- `label` — `PASS` when the response is mathematically sound and fits the
  visible evidence and hint request. Use `FAIL` when there is a material
  instructional or mathematical problem. Use `ABSTAIN` if the evidence
  supports more than one reasonable interpretation of the judgment.
- `rationale` — cite the relevant learner turn and reply words.
- `uncertainty` — record a plausible alternative reading, missing evidence,
  or write `none` when the judgment is clear.

Complete `reviewerId` and `reviewedOn` (YYYY-MM-DD). Preserve `packet` and all
unit IDs. Use a copy of the template for submission. Evaluate each pairing
in its own context and consider more than one valid hint strategy. The baseline
capture contains v0.1 decisions and stays with the operator. Reviewers can
inspect the source repository, so this is procedural masking.

## Historical evaluator compatibility

The originally captured v0.1.0 baseline depends on the deterministic
TutorEval evaluator `0.3a.5` as well as the five frozen source hashes.
The sources pinned in the manifest do not include all transitive dependencies.
After evaluator `0.3a.6` changed CJK-adjacent disclosure detection, the same
rubric source can produce different categorical judgments.

The `baseline` and `compare` commands now fail fast with
`hint_historical_evaluator_runtime_required` unless the runtime reports
`0.3a.5`. This is a fail-closed check: it does **not** silently migrate,
overwrite, or reconstruct the original baseline. To reproduce the original
capture, use the isolated source checkout
`b9443b282fe2533832ea434a80d7581612df9002` with its original lockfile,
Node 24 and evaluator `0.3a.5`. Existing private output files must be
preserved. The `template` and `freeze-review` commands retain their separate
behavior and do not regenerate the baseline.

A candidate built with `0.3a.6` must be identified separately. Any later
cross-runtime comparison measures a combined pipeline difference (rubric
and shared evaluator), not an isolated rubric improvement.

## Freeze and compare

```powershell
node scripts/research/learner-evidence-hint-held-out.mjs freeze-review path/to/maintainer-submission.json
node scripts/research/learner-evidence-hint-held-out.mjs compare path/to/compiled-revised-rubric.js
```

The freeze command requires a completed submission and exact packet match.
It preserves the supplied UTF-8 text and its SHA-256 in an exclusive local
reference file. This is a maintainer-supplied reference, with reviewer
identity recorded as supplied. It does not establish independent review,
Gold, or calibration. The comparison checks the review digest, packet and
replayed baseline. A future revision should live in a separate, trusted
local module with `hintRubric` and `evaluateHintFit` exports and a distinct
version. Run the build before capture and comparison.

The comparison reuses the Measurement Reliability fingerprints and existing
paired summaries. It reports A/B/C and combined coverage, agreement, false
acceptance, false rejection, fixes and regressions against the frozen labels.
The paired accuracy denominator requires decisive judgments from both rule
versions and the maintainer. Changes involving abstention stay visible with
their original evidence and both reasons. Detailed outputs remain in the
ignored artifacts directory.

The historical baseline and all 30 private maintainer judgments are frozen.
A separately versioned experimental rule revision exists but no authorized
held-out comparison has been run. There are no held-out accuracy or improvement
numbers. The prior aggregate maintainer feedback may have influenced candidate
design, so confirmation requires a newly frozen independent evaluation cohort.
