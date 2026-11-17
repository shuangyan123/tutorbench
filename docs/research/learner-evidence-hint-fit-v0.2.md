# Learner-evidence hint fit v0.2.1

**Experimental · Offline · Deterministic · Not canonical**

## Purpose

`learner-evidence-hint-fit@0.2.0` is a separately versioned revision of the
v0.1.0 hint-fit rubric. The instrument returns categorical judgments for
three learner-evidence conditions on a single equation-hint case.

## Development and research evidence

Development used the 2026-11-13 maintainer review of the original equation-hint
case, 14 original development replies, and the three authored learner-evidence
contrasts. Nine additional authored replies exercise the v0.2 development design. The
v0.2.1 revision additionally has independent, author-written negative probes
for factual contradictions, semantically unrelated explanation words, and
explicitly corrected bad examples. Each
of the 23 development replies has an expected judgment in each of the three
conditions (69 judgments).

The maintainer had completed and frozen 30 held-out judgments before v0.2.1
was written. Aggregate information from that review had already entered the
discussion and may have influenced the design. The v0.2.1 implementation did
not directly inspect the frozen reference. The original review remains valid
as a frozen record of the maintainer's judgments, and its audit trail remains
intact. The existing cohort can support an exploratory paired comparison.
An independent validation or accuracy-improvement claim needs a fresh cohort
and reference frozen before the comparison, with review independent of the
rule's development.

## Revision scope

1. **Keep evidence-conditioned choices.** Unknown mastery permits more than
   one reasonable first-step cue. One local success supports transfer prompts
   while leaving stable mastery and equality understanding unestablished.
   A reported unresolved equality question requires a concept explanation.
2. **Constrain explanation coverage.** Recognize balances, trays, weights,
   numeric equalities, plain-language explanations and guided comparisons,
   but require the relevant evidence in one clause or adjacent clauses,
   rather than joining keywords across unrelated sentences.
3. **Reject unambiguous mathematical errors.** Explicit false integer
   equalities receive FAIL; possible counterexamples or hypothetical
   statements receive ABSTAIN. This is not a general algebra verifier.
   Recognized one-sided or unequal operations remain FAIL when presented
   as valid instructions. If a reply explicitly rejects the incorrect
   operation, use ABSTAIN pending assessment of the correction.
4. **Retain conservative boundaries.** Contradictory text, unsupported claims
   about mastery, ungrounded references to earlier work, and completed first
   calculations follow the existing failure or abstention paths.
5. **Use the shared answer-disclosure guard.** The rule calls the TutorEval
   deterministic evaluator with the experiment's configured disclosure rubric.

These text signals still have limited coverage of paraphrases, scope,
negation and mathematics outside explicitly bounded integer equalities.
In an independent pre-fix audit, v0.2.0 incorrectly passed `7 = 8` to
`4 = 5` described as equal, assembled unrelated balance keywords into a
spurious explanation, and failed a reply explicitly correcting an invalid
one-sided operation. The v0.2.1 code now returns FAIL for the clear false
equality and ABSTAIN for the scattered-keyword and corrective examples.
Both the older v0.2.0 candidate and the regression evidence remain
traceable by their Git SHAs. More complex errors and ambiguous corrective
statements can still escape detection; this rubric is not a math solver.

The 69 original authored A/B/C development judgments remain unchanged. New
synthetic negative tests guard the three additional behaviors. The development
checks do not establish held-out accuracy, reviewer independence, or learning
gains.

## Compatibility and historical reproduction

The source case remains `hint-only-linear-equation-001-zh-CN@1.1.0` in
`tutor-eval-v0.2a@0.2a.6`. The revision uses the shared deterministic
evaluator from the checkout where it was built. With `0.3a.6`, the
disclosure guard detects a configured answer adjacent to Han characters.
The current build leaves the production dataset, default evaluator wiring,
rubric registry, and scoring configuration as inherited from main.

For historical replay, use an isolated checkout of
`b9443b282fe2533832ea434a80d7581612df9002` (the original PR #375 freeze
infrastructure), Node.js 24, its lockfile (`npm ci`), and `npm run build`.
This checkout combines the manifest's pinned v0.1.0 sources with the frozen
packet tooling and evaluator `0.3a.5`. The original evaluator matters
because the manifest hashes the rubric source but does not pin all its
transitive imports. A build from a newer checkout has a different runtime
even when every manifest file still hashes correctly. The current
`baseline` and `compare` commands on the #375 branch now refuse execution
unless `TUTOR_EVAL_EVALUATOR_VERSION` is `0.3a.5`; the original historical
checkout remains the reproducible reference.

For a later authorized exploratory comparison, build v0.2.1 in its own
validated checkout and pass the absolute path to the compiled revision
module to the existing comparison tool in the historical checkout. Keep the
candidate's compiled dependency tree in place so its imports resolve to
`0.3a.6`. Use the existing private baseline and reference in the historical
execution environment. Record both Git SHAs, evaluator versions, and the
Node version alongside the private output. This comparison evaluates the two
versioned pipelines together, including any shared evaluator differences.

## Engineering verification

Run `npm run build`, then
`node --test dist/tests/learner-evidence-hint-fit-v0.2.test.js`. The tests
use development controls and synthetic probes, including CJK answer
boundaries and isolated keyword matches. They require no model, provider,
Judge call, or access to the frozen reference. The existing held-out cohort
remains sealed pending intentional authorization for exploratory comparison.
