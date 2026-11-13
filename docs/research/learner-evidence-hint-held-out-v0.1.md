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
| A · Unknown | 10 | 10 | 0/10 |
| B · Local understanding | 10 | 10 | 0/10 |
| C · Unresolved difficulty | 10 | 10 | 0/10 |
| Combined | 10 | 30 | 0/30 |

The three rows for any reply are related observations. The packet holds out
replies, with the original equation and learner histories reused. It supports
descriptive comparisons within this task. Keep this packet out of rule design
and freeze a fresh cohort if its examples or labels inform a later revision.

## Maintainer review

```powershell
npm run build
node scripts/research/learner-evidence-hint-held-out.mjs template
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

The baseline and review packet are ready. Human labels and an actual rule
revision are pending. There are no held-out accuracy or improvement numbers.
