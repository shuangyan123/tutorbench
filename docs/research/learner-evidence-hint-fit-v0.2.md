# Learner-evidence hint fit v0.2.0

**Experimental · Offline · Deterministic · Not canonical**

## Purpose

This is a separately versioned revision of \`learner-evidence-hint-fit@0.1.0\`.
It preserves the original module and baseline and is intended for a later
paired comparison through the existing held-out measurement command.

## Sources used for development

- The 2026-11-13 maintainer review of the original equation-hint case.
- The frozen 14-reply development fixture at
  \`scenarios/experimental/learner-evidence-hint-v0.1/responses.json\`.
- The existing three evidence contrasts authored in
  \`learner-evidence-hint-scenarios.ts\`.

The 30-pair held-out maintainer labels and held-out reply texts were not used
to design, tune, or test this revision. They remain sealed for comparison.

## Revision scope

v0.2.0 is a bounded robustness revision, not a new pedagogical policy.

1. **Keep evidence-conditioned choices.** Unknown mastery permits more than
   one reasonable first-step cue. One local success supports transfer prompts
   but does not establish stable mastery or explain equality preservation.
   A reported unresolved equality question requires a concept explanation,
   not a repeated inverse-operation cue.
2. **Broaden explanation coverage compositionally.** Recognize common concrete
   forms such as a balance, trays or weights; a small numeric equality; and a
   plain-language statement that equal values remain equal after the same
   operation. A single keyword is not sufficient.
3. **Make clear asymmetric transformations a hard mathematical failure.**
   The rule rejects an instruction that changes only one side while claiming
   equality is preserved, or that applies unequal subtraction amounts.
4. **Retain conservative boundaries.** Contradictory text, unsupported claims
   about learner mastery, an ungrounded reference to earlier work, an
   uncovered abstract statement, or a completed first calculation remains
   ABSTAIN or follows the existing hard guard as appropriate.
5. **Preserve the answer-disclosure guard.** The original deterministic
   TutorEval guard remains in use; v0.2.0 does not replace it.

## Compatibility and isolation

- Identity: \`learner-evidence-hint-fit@0.2.0\`.
- The v0.1.0 source, frozen manifest, 14 development controls, 30-pair packet,
  baseline, and maintainer reference are unchanged.
- The new module exports the same \`hintRubric\` and \`evaluateHintFit\`
  interface expected by the held-out comparison command.
- No model, provider, or Judge call is required.
- This revision is an experimental deterministic text evaluator. Its
  language signals can still miss paraphrases and cannot establish learning
  outcomes or independent expert consensus.

## Verification

Run \`npm run build\`, then
\`node --test dist/tests/learner-evidence-hint-fit-v0.2.test.js\`.

After local verification, the paired comparison can be run with
\`node scripts/research/learner-evidence-hint-held-out.mjs compare dist/src/research/learner-evidence-hint-rubric-v0.2.js\`.

The comparison writes a private report under \`artifacts/real-model/\`.
Do not run it until the maintainer intentionally authorizes unsealing the
held-out comparison. Do not use the held-out cohort for further rule tuning;
a new revision informed by those labels requires a fresh held-out cohort.
