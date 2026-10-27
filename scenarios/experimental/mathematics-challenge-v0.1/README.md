# Mathematics Challenge v0.1 — research-grounded, uncalibrated pilot

**Status:** Experimental authoring probe. No promotion to TutorEval canonical snapshots,
Tutor Health registered suites, public aggregate scores, partner evaluation, or claims of
empirically measured difficulty. The original D1–D5 and P1–P5 semantics remain unchanged.

## Why

The canonical English TutorEval 0.2A cohort contains nine mathematics cases: one
taskDifficulty=1 and eight taskDifficulty=2. The pilot Case System vNext's D5
mathematics example uses a difference-of-squares generalization, which may
require high-level mathematical reasoning without being hard for a learner
already fluent in algebra. Therefore **cognitive demand is not empirical item
difficulty**, and a label such as D5 must not be treated as universal
mathematical challenge.

## Research-to-engineering translation

- **NAEP 2026 / PISA / TIMSS:** distinguish content/practices from a single
  universal complexity score. Encode the principal `mathematicalPractice`
  separately from subject, expected reasoning, and anticipated challenge.
- **Stein et al. (1996):** task cognitive demand may change during instruction.
  Authored tutor checkpoints preserve the student's remaining reasoning work
  when the disclosure boundary requires a hint.
- **Lithner (2008):** distinguish routine use of a recalled method from
  learner-relative construction/justification. `cognitiveDemand` is an
  authoring descriptor, not measured ability.
- **Kalyuga et al. (2003):** help that benefits a novice may become redundant
  for a better prepared learner. Each fixed mathematical structure has
  three evidence-bearing learner states (incorrect claim, missing prerequisite,
  near-mastery transfer).
- **Educational testing standards:** score interpretation requires supporting
  evidence. Until independently reviewed and tested on a defined cohort,
  `anticipatedChallenge` is an uncalibrated author's hypothesis only.

Sources (for research background, not automatic validation):
- https://www.nagb.gov/naep-subject-areas/mathematics/2026-naep-mathematics-framework.html
- https://www.oecd.org/en/publications/pisa-2022-assessment-and-analytical-framework_dfe0bf9c-en/full-report/component-3.html
- https://doi.org/10.1007/s10649-007-9104-2 (Lithner, 2008)
- https://doi.org/10.3102/00028312033002455 (Stein et al., 1996)
- https://doi.org/10.1016/S0959-4752(03)00015-0 (Kalyuga et al., 2003)

This mapping is a TutorBench design hypothesis, not a validated synthesis
establishing that any scenario produces learning gains.

## Assets and contracts

- `suite.json`: six fully synthetic Scenario v3 checkpoints, **not registered**
  by `loadTutorScenarioSuiteVNext`; two tasks x three learner states.
- `evidence.json`: two mathematical structures with cohort, prerequisite,
  practice, anticipated challenge, rationale, answer/alternative-method
  references, and scenario IDs. Never passes into Tutor input.
- `src/contracts/math-challenge-evidence.ts`: strict fail-closed schema and
  coverage validator, independent of scoring and public exports.
- `tests/mathematics-challenge-evidence.test.ts`: parse, hidden-data boundary,
  mathematical reference sanity checks, and negative validation cases.

### Reference mathematics

**Parameterized quadratic.** `x² - 2ax + a + 2 = 0`. Two distinct positive
real roots require the strict discriminant `4(a-2)(a+1)>0`, positive root
sum `2a>0`, and positive root product `a+2>0`. Thus exactly `a>2`.
The discriminant interval alone (`a<-1` or `a>2`) is insufficient.

**Conditional red draws.** Five red and four blue balls, two drawn without
replacement, conditional on at least one red. Unordered eligible pairs:
`C(9,2)-C(4,2)=36-6=30`. Favorable red-red pairs `C(5,2)=10`.
Therefore `P(RR | at least one R)=1/3`. When drawing three, replace
pairs by triples; do not disclose the new numeric answer in the hint-only
transfer checkpoint.

## Scope/guardrails

This six-case probe intentionally fills a **methodology gap**, not the
high-challenge end of the mathematics distribution. Both structures have only
**moderate anticipated challenge** and remain uncalibrated. Do not relabel
a short elementary proof D5 to make it appear difficult. The next iteration
should add truly non-routine proof, optimization, or constrained reasoning
tasks *after* independent mathematical and rubric review.

No real student data, partner material, public reviewer scores, API judge
execution, or additional calibrated scales are included.

### Promotion gate

1. Independent math review of task, exact solution, acceptable alternatives
   and learner prerequisite assumptions.
2. At least two blinded educators classify cognitive demand and anticipated
   challenge for a declared target cohort; adjudicate disagreement.
3. Probe pairwise responses for correct mathematics but poor intervention,
   hint leakage, unjustified diagnosis, and over-scaffolding.
4. Check repeated Judge stability and disagreement with independent human
   annotations; report insufficient coverage explicitly.
5. Only version-promote *selected* scenarios after those results; no
   retroactive change to historical scores.
