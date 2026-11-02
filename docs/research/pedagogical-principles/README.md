# Pedagogical Principles Research

Registry: `pedagogical-principles-research@0.1.0` · 2026-10-21

Status: **non-canonical authoring pilot; all current principles are hypotheses**.
This area studies candidate teaching behaviors for evaluating a `TutorUnderTest`.
It is not a tutor implementation, an accepted pedagogy standard, or a scoring
extension. No content here is loaded by a suite, runner, Judge, or public website.

## Candidate index

| Stable ID | Candidate / current record | Status and research question |
| --- | --- | --- |
| P-001 | [Mathematical Representation Traceability / 数学表征的语义可追溯性](v0.1.0/p-001-mathematical-representation-traceability.md) | Candidate hypothesis: can targeted object-to-symbol mappings address the demonstrated confusion without unnecessary explanation? |
| P-002 | Understanding-breakpoint localization / 理解断点定位 | Hypothesis only: can the next uncertain reasoning step be localized without asserting an unobserved cognitive diagnosis? |
| P-003 | Preservation of locally correct reasoning / 保留局部正确推理 | Hypothesis only: can valid intermediate work be preserved while repairing a distinct error? |
| P-004 | Concrete↔abstract transitions / 具体与抽象表征转换 | Hypothesis only: when does a representation change help rather than add prerequisite burden? |
| P-005 | Minimum sufficient explanation / 最小充分解释 | Hypothesis only: how much explanation suffices under the learner's request, evidence, and disclosure boundary? |
| P-006 | Independent transfer verification / 独立迁移验证 | Hypothesis only: what new, uncued learner evidence would distinguish reuse from repetition? |

P-002–P-006 have no standalone records, accepted claims, rubrics, or required
coverage cells. Their overlap with P-001 is a research question, not a reason to
create additional scores. The first authored example is
[cinema seating](v0.1.0/cinema-seating-pilot.md).

## Cross-cutting long-term learner goal (candidate, not P-007)

[Starting Points, Attainable Capability and Avoidable Learning Cost v0.1](../learner-starting-point-and-learning-cost-v0.1.md)
states a goal-level hypothesis: learning paths should adapt to evidenced
prerequisites, expand independently attainable capability and reduce
unnecessary learning costs without lowering the goal or prematurely treating
one performance as a fixed learner ceiling.

The companion experimental protocol fixes one mathematics objective across
three authored learner starting points, and reserves uncued immediate, transfer
and delayed checks for *real* learner work. It does not change P-001–P-006,
add a new scored principle, register new Tutor Health cases, or claim learner
outcomes. Independent expert validation is not a prerequisite for self-testing
and failure discovery, but claims beyond the observed scope still require
appropriate evidence.

## Authoring lifecycle and versioning

`candidate → review-ready → empirically supported / contested` describes the
disposition of a **scoped claim**, not certification of an entire principle.

- **Candidate:** definition, assumptions, counterexamples, and evidence gaps are
  explicit. Author intuition and synthetic examples suffice only for this state.
- **Review-ready:** the versioned record, math, links, privacy, and atomicity have
  been checked and the package is ready for independent review. This is authoring
  completeness, not independent endorsement or empirical support.
- **Empirically supported / contested:** attach inspectable evidence and its
  provenance, method, population/task scope, limitations, independent judgments,
  and contrary findings to the exact claim/version. Mark supported and contested
  subclaims separately; missing evidence remains unknown. Review can return a
  candidate for revision. Judge stability alone cannot promote an efficacy claim.

P-001 remains **candidate** in this slice. A Draft PR marked READY FOR REVIEW is
an engineering handoff, not promotion to an empirically supported principle.

Keep stable principle IDs. Records and case notes carry separate versioned
identities and exact mutual links under `v0.1.0/`. During initial Draft review,
edits remain auditable in Git. After that version is accepted, preserve it and
place changed definitions, assumptions, cases, or criterion intent under a new
version directory; update this index and record the change reason and predecessor.
Editorial corrections must not silently change a historical claim. No runtime
schema, semver compatibility promise, weight, or threshold is introduced here.

## Evidence must remain separated

| Evidence kind | What it could establish | Current pilot evidence |
| --- | --- | --- |
| Hypothesized pedagogy | A testable rationale for a teaching decision | P-001 author hypothesis only |
| Authored benchmark criterion | An operational definition of observable response behavior | Prose review probes only; no executable or canonical criterion |
| Independent human judgments | Scoped content or response judgments, with reviewer provenance and disagreement retained | None collected |
| Judge stability | Repeatability under a fixed Judge, prompt, item, and presentation protocol | Not tested; not human agreement or validity |
| Measured learner outcomes | Observed learner performance under a declared design; efficacy/causality needs appropriate controls | None collected; synthetic continuations are not outcomes |

**A benchmark pass is not evidence of improved student learning.** Human
preference, mathematical correctness, Judge agreement, and learner gains are
different claims. See the [measurement claim specification](../../measurement-claim-specification.md).

## Authoring context and next boundary

The seed is [Issue #283](https://github.com/shuangyan123/tutorbench/issues/283),
used as an authoring brief, not as empirical research provenance. All learner
utterances and tutor examples here are newly authored synthetic paraphrases;
there are no private transcripts, real participant records, or model outputs.
No external efficacy literature or independent pedagogical validation is claimed.
The probability reference is derived explicitly in the case note.

Reuse the existing [five-category rubric semantics](../../tutor-eval-v0.2a.md),
[atomic rubric contract](../../../src/contracts/rubric.ts), and
[rubric authoring QA](../../rubric-authoring-qa.md). Use
[Case System vNext D/P/H and learner-state authoring](../../case-system-vnext.md)
and its [coverage context](../../case-system-vnext-coverage-matrix.md) as authoring
aids, not validated scales or a new mandatory coverage matrix.

This slice ends at documentation and synthetic case notes. Executable fixtures,
Judge/human adjudication, live calls, real learner studies, canonical promotion,
or later Recall use require separate scoped approval after independent review.
Canonical cases, results, five scoring dimensions, weights, thresholds, ground
truths, and public claims retain their existing semantics.
