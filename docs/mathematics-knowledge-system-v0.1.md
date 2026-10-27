# Mathematics Knowledge Structure & Case Expansion — 2026-10 v0.1

**Status:** Experimental knowledge map and synthetic Tutor scenario extension.
This is a reviewable *working model*, not a fixed learning sequence, a psychological
ability hierarchy, a standardized curriculum, or an empirically calibrated difficulty
scale. **No student self-test is required.** The project's owner can review the
knowledge boundaries, solution references, misconceptions and teaching decisions.

## 1. Why reorganize by mathematics knowledge before adding case counts?

The canonical English TutorEval 0.2A snapshot has **nine math case designs**
(one `taskDifficulty=1`, eight `taskDifficulty=2`). Its foundational behavior
tests remain valuable but do not demonstrate subject breadth. The separate
Case System vNext D5 proof/generalization example labels **cognitive activity**,
not learner-calibrated mathematics difficulty.

PR #306 originally introduced six synthetic checkpoints for two mathematical
structures. This expansion extends the *same non-canonical experimental suite*
to **20 checkpoints across 16 task structures**, linked to **44 knowledge nodes
in eight curricular/subject branches**. Their mathematical references are
evaluator-owned and do not become a tutor prompt or judge-visible difficulty
score.

## 2. The mathematical topology

`scenarios/case-system-vnext/mathematics-knowledge-map-v0.1.json` records:

- **Branch**: a useful topic classification, not a universal hierarchy.
- **Node**: specific mathematics concept/practice and typical prerequisite IDs.
- **Directed edge**: a *candidate instructional prerequisite* that authors can
  question and revise; never evidence that a learner lacks the concept.
- **Common misconception**: an authoring prompt for creating test cases, never
  a hidden diagnosis attributed to a real learner.
- **Task mapping**: links a mathematical structure in `evidence.json` to one
  or more graph nodes. Multiple student states may share that structure.

| Knowledge branch | Nodes | Nodes with pilot task coverage |
| --- | ---: | ---: |
| Numbers, quantities and proportional reasoning | 7 | 4 |
| Algebra and equations | 7 | 3 |
| Functions and change | 7 | 2 |
| Geometry and spatial reasoning | 6 | 2 |
| Counting and probability | 5 | 4 |
| Statistics and data interpretation | 4 | 1 |
| Proof, logic and generalization | 4 | 4 |
| Introductory calculus and linear algebra | 4 | 2 |
| **Total** | **44** | **22** |

The remaining **22 nodes** are deliberately visible
as a coverage backlog; do **not** manufacture synthetic tasks merely to fill
all cells. Curriculum stages `primary`, `lower-secondary`, `upper-secondary`
and `university-intro` are *approximate authoring contexts*, not universal
grade equivalences or a graded numerical difficulty score.

The 2022 PISA mathematics framework organizes phenomena into quantity,
change/relationships, space/shape and uncertainty/data, while distinguishing
content from mathematical reasoning and problem-solving processes.
TIMSS 2023 likewise distinguishes *content* from *knowing, applying, reasoning*
and uses different content proportions at grades 4 and 8. We adapt these
distinctions, rather than copying their grade-level reporting into TutorBench
or claiming endorsement.

- PISA: https://www.oecd.org/en/publications/pisa-2022-assessment-and-analytical-framework_dfe0bf9c-en/full-report/component-3.html
- TIMSS: https://timssandpirls.bc.edu/timss2023/frameworks/index.html

## 3. Where the new executable checkpoints concentrate

The math suite now includes 14 additional authored checkpoints beyond its
original two task families / six states:

| Topic / sample problem | Learner-visible fault to diagnose | Reference requirement |
| --- | --- | --- |
| Fractional unit conversion | `2/3+1/4=3/7`; meaning of equal units | `11/12`, with a coherent unit explanation |
| Successive percentages | +20%, then -20% incorrectly assumed to cancel | The second percentage uses the changed base; 200 -> 192 |
| Rational equation | Cancelling `x-1` hides an excluded root | `(x²-1)/(x-1)=2` has no solution |
| Composite function domains | Same domain wrongly assigned to `f∘g` and `g∘f` | Respect square-root domain at both stages |
| Logarithm inequalities | Base between 0 and 1 treated as increasing | `1<x<3` including strict domain |
| Similarity and area | 3:2 side ratio copied to areas | Area ratio 9:4 |
| Circle-line tangency | Passing through a circle point claimed sufficient | Tangent line slope only `m=0` |
| Repeated-symbol counting | 24 physical-tile arrangements counted as different strings | Six distinct length-3 strings |
| Base-rate conditional probability | Test sensitivity confused with posterior defect probability | `P(defect|positive)=2/13` |
| Simpson's paradox | Within-group advantages assumed to determine pooled comparison | Preserve denominators and group composition |
| Recurrence/induction | First three examples claimed as universal proof | `a_n=2^n-1`, base and inductive step |
| AM-GM inequality | Positive-term theorem used for `x<0` | Negative counterexample and valid domain |
| Closed-interval optimization | Interior stationary points declared the only extrema | Check endpoints, including equal maxima/minima |
| Inconsistent linear systems | Singular coefficients interpreted as infinite solutions | Doubling `x+2y=3` conflicts with `2x+4y=7` |

Not every scenario should expose the final reference answer. Some authored
learners explicitly ask for hints; that restriction remains in
`teachingPolicy.disclosure`. A correct full solution can still be an
inappropriate tutoring intervention under that contextual constraint.

The author-proposed `anticipatedChallenge` stays separate from prerequisite
stage and cognitive demand. Even `high` is **not a calibrated level**.

## 4. Review before adding further case families

The project owner acts as **case and methodology reviewer**, not a student
subject. Useful review comments include:

1. Missing foundational mathematical concepts, unjustified prerequisite edges
   or subject areas that deserve separate treatment.
2. Incorrect problem statement, mathematical reference, accepted alternative
   or hidden domain condition.
3. Plausible student utterances that require different teaching decisions.
4. A rubric that rewards presentation style over mathematical/pedagogical acts,
   or accidentally penalizes two independent criteria for a single fault.
5. A case that appears difficult only because it uses unfamiliar notation,
   while the underlying reasoning is routine.

A reviewer opinion is design feedback; it is not by itself measured learning
gain, reliable population difficulty or a claim about every learner's ceiling.

## 5. Machine-checked boundaries

- `parseMathematicsKnowledgeMap`: rejects unknown domains, duplicate nodes,
  nonexistent prerequisites, cycles, invalid task mappings, unknown fields.
- `validateMathematicsTaskCoverage`: requires **every authored math task** in
  evidence registry to be mapped, but permits untested knowledge nodes.
- `parseMathChallengeEvidence` and `validateMathChallengeCoverage`: ensure
  every scenario belongs to exactly one mathematical task reference.
- `parseTutorScenarioSuiteVNext` and the TutorEval adapter: preserve existing
  metadata and tutor/evaluator-only separation.
- Tests cover deterministic mathematical reference examples and negative graph
  validation cases; **they do not prove Judge or pedagogical validity**.

No canonical corpus, public aggregate, weights, quality gates, learning-outcome
claims or existing principle IDs are changed. The user-facing Tutor is not
given the map's misconception labels or the solution references.

## 6. Next knowledge areas to author

The visible untested nodes already highlight multiple useful next candidates:
inverse functions, trigonometry, limits, statistical inference,
variance/distribution interpretation, and proof by counterexample independent
of inequality exercises. Any further expansion should begin with the
mathematics gap, not with an arbitrary number of added prompts.

- 域分类新增 `classificationSource` 显式标识：官方 PISA 四大数学内容类别标为 `pisa-content`；`cross-cutting` 仅标为 `tutorbench-internal`。保留已有 `pisaContent` 字段与稳定 ID，以减少本次修复对旧读取方的破坏；后续大版本可将该字段拆成规范结构。
