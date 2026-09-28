# Case System vNext — Mastery & Transfer Positioning

Status: **design decision / evaluator candidates pending human validation**

## Decision

Mastery & Transfer is an objective-sensitive reporting area. It is not an
eighth Tutor Health dimension and is not included in the current Tutor Health
aggregate score.

## Rationale

Tutor Health measures the quality and reliability of the Tutor's observable
intervention in an authored scenario. Mastery & Transfer describes the
capability that intervention is trying to build and how that capability is
expected to convert into the authored objective.

Combining the two would mix intervention quality with an objective-dependent
outcome mechanism and would risk double-counting content correctness,
intervention strategy, adaptation, and learning integrity.

## Objective-sensitive interpretation

### Learning-oriented

```text
conceptual understanding
  -> reusable structure
     -> independent application
        -> justified transfer
```

### Exam-oriented

```text
concept / method mastery
  -> problem-family mastery
     -> robustness to legitimate variants
        -> reliable and efficient exam execution
           -> score-relevant performance
```

The endpoint is intentionally the observable assessment result that learners,
teachers, and families can understand: marks or score-relevant performance.
TutorBench currently evaluates only the response-level mechanisms that may
support that endpoint; it does not infer an actual mark gain.

For exam-oriented tutoring, mastery is instrumental rather than ceremonial.
The learner needs enough conceptual understanding to recognize when and why a
method applies, enough problem-family mastery to identify the recurring task
structure and common variants, and enough transfer robustness to preserve that
performance when surface details change. The authored endpoint is reliable,
efficient, score-relevant performance under the stated assessment rules.

## Complementary learner-outcome evidence: teach-back

TutorBench now has an experimental `Teach-back Outcome Evidence v0.1`
contract for recording a complementary post-Tutor learning signal.

The construct is deliberately narrower than "teaching skill." It asks whether a
learner can reconstruct what they learned for another recipient, diagnose that
recipient's missing prerequisite or misconception, adapt the explanation, and
whether the recipient can then perform independently.

The evidence path is:

```text
Tutor exposure
  -> learner-teacher
     -> recipient baseline
        -> teach-back interaction
           -> recipient immediate assessment
              -> near transfer
                 -> optional far transfer
```

This complements, rather than replaces, conventional learner assessment:

- the learner's own test/task performance asks whether they can perform;
- independent transfer asks whether their knowledge survives a changed task;
- teach-back asks whether their knowledge is sufficiently structured to be
  reconstructed and adapted for another learner;
- recipient outcomes provide an observable downstream signal that the
  explanation supported usable understanding.

The v0.1 process evidence covers three required dimensions:

- `knowledge_reconstruction`;
- `learner_diagnosis`;
- `adaptive_explanation`.

Recipient profiles explicitly distinguish a peer from a learner with lower
prerequisite readiness. This matters because successfully teaching a weaker
recipient requires prerequisite modeling and adaptation in addition to subject
knowledge.

Synthetic recipients are **proxy evidence only**. Human observations are
stronger external evidence, but a single before/after teach-back episode still
does not establish that the original Tutor caused the observed change.
Accordingly every v0.1 artifact fixes its claim boundary to
`observational_or_proxy_only`.

This evidence remains outside the seven Tutor Health dimensions and outside the
Tutor Health aggregate score.

## What TutorBench may currently evaluate

Response- and scenario-level evidence may support bounded judgments about:

- concept / method mastery support;
- problem-family recognition and method selection;
- recognition of common variants or traps inside the assessed problem family;
- handling of legitimate near variants;
- prerequisite compatibility;
- assessment-rule compliance;
- marking-point alignment;
- time-efficient execution;
- error resistance;
- verification efficiency.

These are score-relevant proxies. They are not observed score gains.

## What TutorBench must not claim yet

Without longitudinal learner data and actual assessment outcomes, TutorBench
must not claim that:

- a Tutor raises examination scores;
- a response caused durable mastery;
- simulated transfer equals learner transfer;
- response-level proxy gains imply a particular mark or percentile gain.

Actual score change is a future external-validation endpoint, not a current
benchmark output.

## Validation path

1. Keep the current seven Tutor Health dimensions unchanged.
2. Use objective-specific stress fixtures to validate evaluator distinctions.
3. Obtain independent human review for fixture expectations.
4. Expand exam-oriented cases from one-item speed contrasts to problem-family
   and legitimate-variant contrasts.
5. Only after learner/outcome evidence exists, study whether Mastery & Transfer
   proxies predict real assessment performance.
