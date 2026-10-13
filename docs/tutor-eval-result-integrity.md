# TutorEval result source integrity

Current behavior after TB-A01. This is an import and reporting contract, not a
change to evaluation criteria or a claim of Judge calibration.

## Validation boundaries

TutorEval result validation rejects contradictory v1 evidence before reporting
or corpus resume. Checks bind rubric status to its normalized score
(`PASS=1`, `PARTIAL=0.5`, `FAIL=0`, `ERROR=null`), case status to `passed`,
summary counts to case statuses, and unique case/run identities to the declared
scope. An error cannot carry a case overall score; passing requires a PASS gate
and an overall score. Error cases may still contain numeric category scores from
the completed deterministic subset.

A present raw Judge result must belong to the same case. Its rubric judgments
must agree with corresponding normalized results. Raw critical failures and
major/critical factual errors cannot disappear or lose severity in normalized
critical failures; deduplication may retain a higher severity for the same type.
A raw Judge result with no Judge execution identity is contradictory.

Tutor Health additionally checks the authored suite, case version, rubric IDs,
category, weight, critical flag and Judge ownership. A missing case, normalized
rubric, Tutor response or required raw Judge judgment stays unresolved. ERROR
rubrics remain unresolved; completed deterministic evidence in the same case
retains its score and Findings. Identical duplicate rubric
entries retain the existing unresolved behavior. Comparison consumes these
checks before classifying Findings; incomplete evidence cannot imply resolved.

New run manifests require the report to match a reconstruction from the suite,
evaluation and saved Health profile. Hashes still bind exact evaluation/report
bytes and canonical suite content. They establish local artifact consistency,
not provider execution authenticity or independent review.

## Compatibility and limits

The result schema stays at v1. Missing optional `locale`, `judgeMetrics` and
`evaluatorVersion` remain readable. Partial case-run collections remain readable
when their stored counts agree; missing evidence is not synthesized. Existing
comparison requirements for the current evaluator and recorded locale remain.

Normalized rubric scores are status encodings. Configurable criterion scores,
category weights, thresholds and quality gates belong to aggregate scoring.
Plain v1 results do not record that configuration, so this validator does not
recompute case/category aggregates using an assumed default. The run-level
`overallScore` retains its original finite-number-or-null parsing boundary;
the pre-existing `[0,1]` bounds on case overall scores and category scores remain.
Accepting a finite run aggregate outside `[0,1]` preserves legacy parsing; it does
not establish that the aggregate was derived correctly.

The direct runner's typed scoring input currently permits configurations such
as `PASS=2` that produce case/category aggregates outside their old import
bounds. Those complete results remain rejected by both the pre-TB-A01 and
current validators. This correction restores only the run-level boundary;
it does not unify the runner configuration domain and artifact import domain.
Custom scoring identity and aggregate recomputability remain TB-A05 work.

Corpus resume retains its existing requirement
for an explicit matching scoring configuration, selection and corpus identity.

Parsing an old result or manifest does not certify its origin. Historical
reports remain readable as saved artifacts; a report produced under earlier
missing-evidence behavior may fail current source reconstruction. Preserve its
original bytes and evidence status; do not silently rewrite it or relabel it as
verified. Legacy results without source evidence cannot become assessed Health
evidence merely because their normalized statuses look successful.

This patch does not authenticate transcripts, re-execute deterministic
evaluators, calibrate a Judge, interpret `insufficientInformation`, prove custom
aggregate derivation or verify live/historical provider runs. Consistent
co-tampering of all source layers requires a separate provenance mechanism.
