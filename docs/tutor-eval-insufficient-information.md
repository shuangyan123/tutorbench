# Insufficient-information validity contract (TB-A02)

Design decision recorded before implementation, against main `44d77fe`.
This fixes evidence validity; it does not change teaching criteria, Judge
prompts, scoring weights, the 0.75 threshold or human calibration.

## Evidence and data flow

The v0.3 and v0.9 prompts ask the Judge to set `insufficientInformation=true`
instead of inventing student background or Tutor intent. The v1 Judge contract
requires one case-level boolean and PASS/PARTIAL/FAIL for every requested
rubric. It provides no rubric-level abstention or scope for that boolean.
The v0.9 prompt also defines a separate critical-failure pass.

Current baseline flow: prompt -> validated structured Judge result -> rubric
normalization -> TutorEval aggregation -> Health -> comparison/manifest.
The parser retains the boolean, but normalization, aggregation and Health
ignore it. A synthetic all-PASS Judge result with the flag true can therefore
produce overall 1, Health 100 and Release Gate PASS.

## Decision

| Evidence | Scored behavior | Validity |
| --- | --- | --- |
| Flag false | Existing rubric and critical-failure semantics | Existing behavior |
| Flag true, structured Judge result | Judge rubric subset becomes ERROR/null; deterministic results remain scored | Case and run are not fully assessable |
| Judge transport/timeout/schema failure | Existing ERROR/null behavior; no valid raw Judge result | Execution failure |

Because the boolean cannot localize the missing information, do not select
supposedly sufficient Judge rubrics from result polarity, evidence text,
keywords or confidence guesses. Preserve the complete validated raw Judge
result and telemetry for review. Preserve independent deterministic scores and
Findings, including failures. A mixed case can retain useful partial evidence;
a Judge-only case with insufficient information has no assessed rubric score.

The flag itself never creates a teaching FAIL, critical failure or answer leak.
Explicit critical/factual failure records retain their existing, separate
semantics; they may still block release. The new diagnostic is
`judge_insufficient_information`, distinct from transport failure codes.
Execution succeeds structurally, so its transport `failure` remains null.

Use the existing ERROR/error representation for non-scoreable rubrics/cases,
with that diagnostic. `errorCount` includes abstentions and is not a count of
transport failures alone. Case overall and run aggregates are null when the
evaluation is incomplete; completed category evidence in a case is retained.
The case quality gate still describes known critical failures, not validity.
Health records `insufficient_information` and returns UNRESOLVED unless an
independently recorded failure already requires FAIL. Partial numeric Health
scores describe only assessed evidence and cannot make the release gate PASS.

## Source and compatibility boundaries

Reject imported flag-true results claiming a completed case, scored Judge
rubrics, complete run aggregates or a numeric case category score without
independently scoreable rubric evidence in that category. An independent
rubric must be outside the raw Judge rubric IDs, have a non-ERROR result and
a non-null score. Deterministic PASS and FAIL scores remain usable, including
in a category shared with abstaining Judge rubrics. This checks evidence
availability, not the numeric aggregate or custom scoring configuration.
Preserve historical bytes; do not
silently rewrite them into new evidence. Canonical incomplete results remain
readable, including missing rubric evidence. Health rebuilds use the flag,
comparison explicitly treats the affected point as unresolved, and manifests
with flag-true sources must match a report reconstruction.

Evaluator identity advances from `0.3a.4` to `0.3a.5` for the validity change;
dataset, case, prompt and scoring identities stay unchanged. Existing resume
and comparison identity gates prevent reusing old evaluator results as current
evidence. Historical flag-false v1 parsing remains supported. The new Health
and comparison reason extends their existing schema; older readers must be
updated to understand it.

## Limits

This boolean cannot identify sufficient individual Judge rubrics. Keeping
deterministic evidence and explicit failure signals does not establish human
agreement or learning effectiveness. Scoring identity and aggregate
recomputability remain TB-A05. No automatic retry is added; a later explicit
corpus resume may rerun incomplete cases.

This branch starts from main and does not include the two local TB-A01 commits.
Their raw/normalized consistency validator needs an explicit abstention
exception during a later reviewed integration. Only valid structured
flag-true abstention may retain raw PASS/PARTIAL/FAIL while normalized Judge
rubrics become ERROR/null, with incomplete case/run state and category scores
supported only by independent evidence. All other source contradictions must
continue to be rejected by TB-A01. This correction does not integrate TB-A01.
