# Mathematics Challenge v0.1 — knowledge coverage and tutoring decisions

**Status:** Author-proposed, synthetic and non-canonical. The suite file version is
`0.2.0` (folder name retained for compatibility with the original pilot).
This is **not** an empirically calibrated mathematical ability test.

## What changed

This pilot now has **20 executable-compatible Scenario v3 checkpoints across
16 mathematics task structures**. The first six from the original pilot remain;
fourteen additional cases cover mathematical topics from fractional units and
percentages through proof, functions, geometry, probability/statistics,
introductory calculus and linear algebra.

Every task is linked to the proposed [44-node mathematics knowledge map](../../case-system-vnext/mathematics-knowledge-map-v0.1.json).
The human-readable audit and coverage table are in
[Mathematics Knowledge Structure](../../../docs/mathematics-knowledge-system-v0.1.md).

## Files

- `suite.json`: synthetic learner utterances, known prerequisite evidence,
  explicit help requests and atomic tutoring rubrics (20 checkpoints).
- `evidence.json`: cohort assumptions, mathematics reference truth,
  accepted alternative methods and **uncalibrated** author-estimated
  challenge (16 structures). The case reference must **not** be passed
  to the tutor under test.
- `scenarios/case-system-vnext/mathematics-knowledge-map-v0.1.json`:
  8 mathematical subject branches, 44 concepts, directed candidate
  prerequisites and 16 task-to-concept mappings.
- `src/contracts/math-challenge-evidence.ts`:
  validates task evidence and scenario coverage.
- `src/contracts/mathematics-knowledge-map.ts`:
  validates the graph, prerequisite cycles and task coverage.
- `tests/mathematics-challenge-evidence.test.ts` and
  `tests/mathematics-knowledge-map.test.ts`: automated suite, graph,
  mathematical reference and tutor-input firewall regressions.

## Evaluation boundary

A learner's **starting knowledge** should influence the teaching action and
how much explanation is warranted, not predetermine a permanently lower
learning target. User review focuses on mathematical correctness, prerequisite
boundaries, actual error structure and whether the tutor preserves existing
valid reasoning; the user is **not** recruited as a student test participant.

This suite is **not registered in the standard Tutor Health CLI**. It can be
parsed and compiled by the existing experimental Scenario vNext adapter.
No benchmark score, public leaderboard, historical frozen dataset or partner
pilot behavior is modified.

A single failure can justify creating a regression target, but no synthetic
case or one-person opinion establishes how frequently a failure occurs or
whether any learner's independent competence improved. High author-estimated
challenge is not an empirical item difficulty score.

## Future checks

- Reviewer inspection of mathematics reference answers, alternate valid
  strategies, missing domains and prerequisite assumptions (can be performed
  by the project owner; outside experts not required for experimenting).
- Compare tutor responses that are both mathematically correct but differ
  in respecting learner state and disclosure requests.
- Assess Judge repeatability and false positives before adding the suite
  to any official aggregate; do not collapse missed or invalid cases into
  a full-coverage score.
- Improve graph coverage based on observed task gaps, not arbitrary D5 counts.

Background for distinctions of mathematics content and reasoning:
[PISA 2022 Mathematics Framework](https://www.oecd.org/en/publications/pisa-2022-assessment-and-analytical-framework_dfe0bf9c-en/full-report/component-3.html)
and [TIMSS 2023 Mathematics Framework](https://timssandpirls.bc.edu/timss2023/frameworks/index.html).
