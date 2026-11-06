# Private real-exam teaching pilot

This is a non-canonical Case System vNext research pilot. Its six-question scope
contains the whole-answer verified mathematics, physics and chemistry items
selected after the private exam correctness pilot. The authored checkpoints and
replies are synthetic. Biology remains outside this slice because the available
record only verified a subclaim. No score in this pilot establishes learning
outcomes, model quality or independent expert agreement.

The source-review layer records the PDF page, question and correctness versions,
comparison with the crop, the teaching scope and its limitations. Diagram labels
and the relationships used by the checkpoint are transcribed into the actual
Tutor-visible stimulus. A local review retains the original raster crop. The
text-only fixture does not test image perception. Missing or changed evidence
blocks the fixture response and retains the checkpoint in the coverage denominator.
The authored semantic criteria refer to what the student actually said or did.
A possible interpretation of a single error remains a hypothesis.

Authoring follows the existing [vNext scenario contract](../case-system-vnext.md),
the [strategy profile catalogue](../../scenarios/case-system-vnext/task-strategy-profiles.json)
and the [pedagogical research notes](pedagogical-principles/README.md). Representation
fidelity, preservation of partial progress and minimum sufficient explanation
are used as authoring heuristics. New strategy identities are unnecessary here.
The registered executable and productive-struggle suites remain independent.

## Local replay

Use Node 24 and the environment from the
[Correctness Verifier](private-exam-correctness.md). Set the three input paths to
the local bank file, the Phase 2 evidence directory and the authored pilot
respectively. Output goes to a new file in the worktree's ignored private directory.

```powershell
npm ci
npm run build
$env:PYTHONDONTWRITEBYTECODE = '1'
$bank = '<local bank root>/bank.json'
$phase2 = '<private Phase 2 replay directory>'
$pilot = 'data/private/exam-teaching/pilot.json'
python -B scripts/research/run_private_exam_teaching.py --bank $bank --phase2 $phase2 --pilot $pilot --out data/private/exam-teaching/replay.json
node --test dist/tests/private-exam-teaching.test.js
```

The Phase 2 directory supplies `plan-final.json`, `references.json`,
`candidates.json` and `review.json`. The gate replays only the six selected
records using the existing Verifier and `handoff`, including PDF and crop
digests. It compares each fresh whole-answer record with the previous record
and the expected authoring fingerprint. An older receipt alone cannot admit a
checkpoint. Replay uses the same correctness engine and dependency versions as
the authored record.

The private pilot JSON has `schemaVersion: 1`, `teachingReferences`, an
ordinary v3 `suite`, a `scenarioQuestions` map from scenario ID to question ID,
`fixtures` keyed by evaluation case ID, `missingResponseCase`, and
`historyLink`. A teaching reference supplies `questionId`, `questionVersion`,
`correctnessInputSha256`, `tutorStimulus` and the review notes. Each fixture has
`baseline` and `adversarial` reply strings. The history link identifies the
previous and next case and the authored learner continuation anchor. Private
authoring and response files contain the material needed for the replay.

The pilot uses the existing compiler, ScriptedTutor, TutorEval and Tutor Health
runner. It executes the H2 predecessor before the main runs. The second
checkpoint consumes that reply and an authored learner continuation. A
mismatched predecessor produces an unavailable result. This covers a short
scripted interaction. Live student behavior and autonomous multi-turn model
behavior are outside this run.

## Reading the output

The private output includes input fingerprints, evidence admissions, teaching
references, the materialized suite, emitted Tutor packets, the H2 seed and
the baseline, adversarial, missing-response and mismatched-history runs.
The hidden-state mutation test verifies that evaluator-only changes leave
Tutor packets identical. The runner also compares the captured baseline
packets against the compiler's visible projection.

Each run has the original TutorEval and Tutor Health outputs plus per-category
`assessed`, `scored` and `total` criterion-run counts for the four teaching
capabilities. `assessed` counts non-error observations with an actual response
and, for Judge criteria, an actual usable judgment. `scored` requires a numeric
score. The total includes missing responses, blocked evidence and unrun Judge
criteria. The separate criterion coverage flag retains partial coverage even
if an aggregate has a number. Existing weights, quality gates and report
semantics are unchanged.

Deterministic checks cover only configured observable surface forms such as an
explicit answer token, an overlong response or a specific actionable cue.
Semantic correctness, alternate equivalent phrasing and pedagogical quality
remain Judge or human-review work. The pilot invokes no Judge and supplies no
substitute judgments. Corpus materials, authored dialogue, response packets
and observed evidence remain in the Git-ignored private directory.

## Focused private-case revision v0.1.1 (2026-11-06)

The private authored pilot in the author's local ignored directory has a **separate**
review-driven revision; it is not distributed in this repository. The revised
mathematics first-offset learner turn now explicitly shows a valid perpendicular-
distance-one calculation, rather than treating an ambiguous vertical translation
as valid. For the chemistry diagram case, the duplicate keyword-only
`contains_required_concept("lower arrow")` Actionability criterion was removed;
the existing Judge-owned semantic Actionability criterion remains. This avoids
passing an incorrect diagram claim merely because an arrow name appears.

Revised private authoring scope: **6 questions, 9 scenarios, 10 checkpoints,
57 criterion instances (17 deterministic, 40 Judge),** with the same explicit
`PARTIAL COVERAGE` boundary when Judge is unavailable. The original
`run.json` was produced from the **58-criterion v0.1.0** private pilot and must
not be reported as a v0.1.1 rerun. A new local report must be generated using
a new `--out` path and the private bank + Phase 2 inputs.

A small private set of author-labelled semantic contrasts documents literal
keyword false positives and valid-paraphrase false negatives. Such labels are
provisional review expectations, not independently calibrated Judge/human Gold
or a measured error rate. The public synthetic test specifically ensures that
Judge-only Actionability is **unscored** without a Judge, including when a Tutor
response mentions a superficial diagram cue. Neither this test nor CI executes
any copyrighted private exam item.
