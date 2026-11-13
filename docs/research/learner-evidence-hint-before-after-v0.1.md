# Before / After Measurement Report v0.1

**Experimental · Offline · Improvement undetermined**

## Frozen sources and study split

The comparison unit is one original response under one learner-evidence
condition. All three DeepSeek replies and the
[maintainer review](learner-evidence-hint-maintainer-review-v0.1.json)
were available when designing the rubric. They contribute nine **design**
replays. The 14 synthetic replies contribute 42 engineering controls with
author-written expectations. There are zero held-out human-labeled samples.
The historical case, recorded responses, original offline results and
maintainer judgment are read-only inputs.

The maintainer concluded that multiple strategies could be reasonable
depending on evidence of inverse-operation understanding. The frozen review
supports the conditional evaluation design. It provides no binary reference
for an individual reply in A, B or C. In particular, the synthetic C
difficulty and previous-help outcome are authored counterfactuals.

## Rules and provenance

The baseline is the historical case
`hint-only-linear-equation-001-zh-CN@1.1.0` in
`tutor-eval-v0.2a@0.2a.6`, evaluator `0.3a.5`, scoring identity
`tutor-eval-scoring:sha256:feb344b299595f23c975dd7735d6b6c59c41e04f8bdaf6358123669c8dbf09c6`.
The existing corpus runner replays each response against the original case
with the stored scoring configuration and no Judge. The original reports
are validated for bytes, scoring provenance, dataset, corpus and exact
response binding. The rerun reproduced the stored version, scoring identity,
criterion results and diagnostic codes for 3/3 source replies. The historical answer-disclosure result is `PASS` for
3/3. The historical next-step and learner-agency criteria are `ERROR`
(`judge_unavailable`) for 3/3 each. Disclosure is a different construct
from hint fit.

The candidate is `learner-evidence-hint-fit@0.1.0`. Its identity describes
an experimental categorical decision. TutorEval scoring identity is
inapplicable to this arm because it computes no numeric score. It evaluates
each response with the frozen contrast trajectory and claims. The report
records the source and checkpoint versions, review and evidence fingerprints,
historic and rerun criterion results, the candidate verdict and literal
reply excerpts for every row.

The report reuses the Measurement Reliability fingerprinting and paired
matrix calculation, the historical audit parser, and scoring-provenance
checks. Measurement Reliability's whole-answer exact-text protocol is
scoped to disclosed-answer correctness. It does not supply teaching labels
for a hint-only case.

## Results on the design set

| Condition | Planned | Baseline teaching judgments | Candidate judgments | Candidate abstentions | Per-unit maintainer references | Paired judgments with reference |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A · Unknown | 3 | 0/3 unavailable | 3/3 PASS | 0/3 | 0/3 | 0/3 |
| B · Local understanding | 3 | 0/3, all non-comparable | 3/3 PASS | 0/3 | 0/3 | 0/3 |
| C · Unresolved difficulty | 3 | 0/3, all non-comparable | 3/3 FAIL | 0/3 | 0/3 | 0/3 |
| Total | 9 | 0/9 | 9/9 | 0/9 | 0/9 | 0/9 |

The original checkpoint is closest to A. It also contains an authored
`knownConcepts` entry that A omits. Even before that context difference is
considered, the required baseline teaching evidence is unavailable for all
three replies. B and C have new histories and no matching historical
checkpoints. There are 3/9 unavailable baseline judgments and 6/9
non-comparable contexts. All 9/9 accuracy comparisons are unresolved.

For A, B, C and the combined cohort, baseline and candidate agreement,
false acceptance, false rejection, fixes and regressions are all **N/A**
(0 eligible pairs). Agreement and transitions use the same complete pairs
for both arms. False acceptance uses reference-FAIL pairs as its denominator.
False rejection uses reference-PASS pairs. Candidate abstentions, missing
references, unavailable baselines and incomparable contexts stay in
coverage denominators. The held-out set has zero planned observations and
all its rates are undefined.

## Per-reply changes

Each cell lists the available old teaching result and the candidate judgment.
The private report records each row separately with the exact learner turn,
prior help where present, and reply excerpt.

| Original reply | A · Learner turn 1 requests one hint | B · Learner turn 1 shows an independent local success | C · Tutor message 2 gives a cue, learner turn 2 reports it did not help and asks why both sides change |
| --- | --- | --- | --- |
| Low | ERROR → PASS. A cue about the inverse of +3 opens a next step. | Non-comparable → PASS. The cue leaves the calculation open. | Non-comparable → FAIL. The inverse-operation cue leaves the stated equality question unanswered. |
| High | ERROR → PASS. Naming subtraction on both sides gives a first step. | Non-comparable → PASS. The instruction still leaves the calculation open. | Non-comparable → FAIL. Naming the operation on both sides does not explain why. |
| Max | ERROR → PASS. The learner is asked to carry out the first step. | Non-comparable → PASS. The handoff preserves an independent attempt. | Non-comparable → FAIL. The handoff adds no support for preservation of equality. |

The candidate can now make the authored distinction between an appropriate
first-step hint and a cue that repeats insufficient support. That is a
demonstrated rule behavior and an engineering coverage gain. No accuracy
repair or regression can be attributed on the available data. Potential
regressions include missing valid paraphrases or implicit handoffs, treating
a superficial explanation as adequate, and missing indirect disclosure.

The review record, authored contrasts and private replay are ready for
maintainer research use. Adoption as a more accurate evaluator needs
held-out replies, exact-context independent reference judgments and usable
baseline decisions on the same construct. The current evidence cannot
establish an accuracy improvement or justify canonical adoption.

## Reproduce

```powershell
npm run build
node scripts/research/learner-evidence-hint-pilot.mjs --before-after
```

The command requires the three original complete corpora and three
`inspect.offline-evaluation` artifacts. It runs both arms locally and
writes `artifacts/real-model/learner-evidence-hint-fit-v0.1.0.before-after.json`.
The private file contains exact excerpts and a row-level audit. Standard
output contains only summary and provenance. A rerun with identical output
preserves the file. Missing or altered historical inputs fail before report
creation. The baseline replay never invokes a model or Judge.
