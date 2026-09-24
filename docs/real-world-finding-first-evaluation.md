# TutorBench Real-World Evaluation / Finding-First Model

Status: **initial additive implementation slice**. The contracts, authored
scenario suite, result transformation, and reports are implemented. This does
not establish a validated general measure of tutoring quality or learner
outcomes.

## Why add a finding-first view

Response-level rubric scores are useful for repeatable comparisons, but they
do not by themselves show which teaching decision failed, where the evidence
appears, or what a team should retest. A single response can also be
appropriate after repeated failure and premature after a first attempt.
TutorBench therefore adds authored decision-point context and an evidence-linked
diagnostic view while retaining the existing TutorEval score and quality gate.

The initial suite tests observable responses under fixed, authored histories.
It does not simulate a learner or infer student progress from a tutor response.

## Information model

```text
Evaluation Run
  -> Scenario Suite
  -> Real-world Scenario
  -> Authored Trajectory
  -> Decision Point
  -> Observation
  -> Finding
  -> Recommendation
  -> Regression Target
```

A scenario records identity/version, suite, learning context, learner state,
an authored trajectory, teaching policy, and one or more decision points. Each
decision point compiles to a normal `TutorEvalCase`. The existing runner still
owns Tutor execution, deterministic/Judge routing, rubric aggregation, ERROR
handling, and critical-failure quality gates.

Observations record evaluator-owned outputs such as a rubric result or an
existing critical-failure record. Observation types also reserve names for
future factual signals such as hint repetition or support escalation; this
slice does not infer those signals from Tutor prose. A failed rubric generates
a Finding only when the authored criterion includes a failure template.

`EvidenceRef` points to a bounded scenario turn, case/run/rubric result, or
critical-failure record. The finding-first report carries references and
evaluator ownership, not raw Judge reasoning or provider payloads. Human
evidence has a reserved contract variant but is not produced by this slice.

## Health dimensions and scoring

The versioned top-level dimensions are:

- `content_correctness`
- `learner_diagnosis`
- `intervention_strategy`
- `adaptation`
- `learning_integrity`
- `interaction_quality`
- `reliability_policy`

They are a reporting taxonomy, not replacements for the current five
`TutorEvalCategory` values. Each authored evaluation criterion declares both
its existing TutorEval category and its health dimension, so no implicit
category-to-dimension conversion is applied.

The report uses the existing rubric result score and rubric weight. ERROR and
missing results are excluded and listed as unresolved. Dimension scores are
weighted means on a 0-100 integer scale; the overall Tutor Health Score is the
configured weighted mean of dimensions with scored evidence. The exported
`core-tutor@0.1.0` profile lists all seven weights explicitly at `1`. This is a
starter reporting profile, not a universally correct or empirically validated
weighting. Organizations can pass another versioned profile.

Tutor Health Score is an attention summary. Findings and their evidence remain
the diagnostic source of truth. The Release Gate fails when an existing
non-error TutorEval case has `qualityGate: FAIL` or when a critical Finding
exists, regardless of the health score. If no known failure exists but
evaluation evidence is missing or errored, the gate is `UNRESOLVED`; it does
not convert infrastructure errors into pedagogical failures.

Historical `categoryScores`, `overallScore`, `criticalFailures`, and
`qualityGate` remain unchanged in TutorEval v0.2a / evaluator v0.3a.4 results.
The new run helper returns both the existing `TutorEvalRunResult` and the
additional `TutorHealthReport`; it does not rewrite old artifacts.

## Findings, hypotheses, and confidence

A Finding answers what happened, where, which evaluator-owned evidence
supports it, what the authored scenario expected, the observable impact, what
to inspect, possible implementation suggestions, and what to retest.
Recommendations distinguish a diagnostic action from an implementation
suggestion.

`likelyCauses` contains hypotheses with evidence references. These are not
claims about internal model causality. An empty list is valid when the evidence
does not support a useful hypothesis. The numeric confidence field is a coarse,
uncalibrated evidence-strength value from the authored mapping; it is not a
probability and must not be compared across evaluator versions as a validated
scale.

The report adapter does not copy the Judge's free-text evidence into findings.
For legacy critical failures whose exact evaluator owner is not recoverable,
the reference says `tutor_eval_aggregate` rather than guessing. Reports bind to
the source scenario-suite identity, version, and health-taxonomy version, and
the builder rejects evaluation artifacts from a different suite or case version.

## Productive Struggle & Intervention suite

`productive-struggle-intervention-v0.1` contains 13 synthetic authored
scenarios covering:

- first mistake and repeated mistake;
- partial progress and false confidence;
- explicit help request and learner frustration;
- near mastery, independent progress, and hint fading;
- overhelping, underhelping, and answer leakage;
- repeated misconception and threshold-based hint escalation.

The multi-turn escalation scenario includes three learner attempts, a light
conceptual hint, a repeated low-specificity hint, and a decision point at the
third-attempt threshold. It asks the evaluator to check whether support
specificity increases there. The first-mistake case instead expects another
learner attempt before a procedural hint. The same response can therefore be
judged differently under different authored states.

Trajectories are controlled: prior conversation is authored and replayable.
The initial suite uses one evaluated Tutor response per decision point; it does
not yet run a stateful multi-turn Tutor episode. No policy in this suite is
claimed to represent WiseTutor's official pedagogy. It is an initial TutorBench
design suite for studying when to preserve friction and when to reduce it.

## Claims and limitations

- The suite contains authored scenarios, not a representative sample of real
  tutoring sessions.
- Tutor Health Score is descriptive and has no human calibration or outcome
  validation in this release.
- A deterministic result is a proxy owned by its evaluator; a Judge result is
  a Judge-owned assessment, not independent human evidence.
- A critical failure can block the Release Gate even when the summary score is
  high. Conversely, the score alone does not establish release fitness.
- This implementation does not claim improved student learning, retention,
  mastery, or causal effects.
- There is no dashboard, autonomous student simulator, live student study, or
  new public leaderboard in this slice.

## Public API example

```ts
import {
  formatTutorHealthReport,
  runTutorHealthEvaluation,
  writeTutorHealthReport,
} from "tutor-benchmark";

const { evaluation, report } = await runTutorHealthEvaluation({
  tutor,
  judge, // Inject the same provider-independent Judge boundary used by TutorEval.
  runId: "team-regression-2026-09-24",
});

console.log(formatTutorHealthReport(report));
await writeTutorHealthReport(report, "artifacts/tutor-health.json");
// `evaluation` remains the compatible TutorEvalRunResult.
```

With no Judge injected, Judge-owned criteria remain ERROR/unresolved. The
helper makes no provider calls itself.
