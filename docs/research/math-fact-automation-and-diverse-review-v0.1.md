# Mathematics reference automation and diverse reviewer pilot (v0.1)

Research-only · 2026-11-01 · provider-free · not expert gold · no production Judge changes

## Why the previous 14-item review cannot serve as a calibration benchmark

The completed blind review repeated three mathematical questions across seven A/B pairs. All 14 outputs were marked mathematically incorrect and answer-leaking by one reviewer. Independent mathematics found one true mathematical assertion (T06, conditional probability 1/3), despite that Tutor violating hint-only. Label saturation and repeated prompts mean this experiment did not distinguish the leakage and premature-closure constructs. Preserve the original scores rather than relabeling them.

## Division of verification labor

1. **Math reference before human review:** run `node scripts/verify-math-assertions.mjs --require-full-coverage` on the legacy 14-arm fixture. It computes combinations, exact rational probability, evaluates all stationary/endpoints of the fixed polynomial, and checks that the two composite-function domains differ. The tool recognizes a deliberately bounded grammar of claims and returns `verified_true`, `verified_false`, or `unverified`. It is NOT a generic natural-language math solver.
2. **Human pedagogical review:** evaluate student misconception diagnosis, usefulness of next step, proportional scaffolding, task ownership, policy compliance and premature closure. Do not require reviewers to redo math arithmetic that has already been verified.
3. **Escalation:** uncertain interpretations, unrecognized paraphrases or more complex proofs remain unverified and require a qualified checker or explicit source reference. Unknown is not converted to PASS or FAIL.

## New candidate set

`fixtures/judge/math-diverse-human-review-candidates-v0.1.json` has 12 distinct topics: equations, fractions, proportions, geometry, conditional coin probability, inequalities, logarithms, differentiation, quadratics, percentage growth, systems and absolute values. It contains 10 hint-only and 2 full-solution-allowed scenarios, different student states, and a mix of bounded hints, wrong endorsements, over-disclosures and appropriate full solutions. The `probeIntent` fields are researcher hypotheses and must be hidden from blind reviewers. Every `humanRatings` value remains null.

**Blocking gate:** The mathematical references for these 12 NEW candidates are intentionally `pending_structured_reference`. The implemented automated math verifier covers only the THREE ORIGINAL math task structures and their 14 counterfactual arms. Do not send the candidates for gold labeling, infer model performance, or silently assume their math claims are verified until separate mathematical reference tests are added.

## Anti-repetition and verification policy

- Prefer distinct mathematical tasks and student states, not multiple cosmetic edits of a single response.
- Include anticipated positive and negative examples per teaching dimension; labels are not prescored.
- Construct only a few blinded A/B pairs when an explicit unresolved question requires them, and avoid adjacent presentation.
- Ask at least two independent qualified educational reviewers before calibrating ambiguity and report disagreements; human ratings are not expert gold automatically.
- Verify 14 fixture arms are recognized with exactly one true and 13 false mathematical assertions; any unknown claim must remain `unverified` and strict mode must exit with nonzero status.
- Guard 12 candidate topics, distinct response strings, mixed disclosure policies and absence of prefilled user labels with tests.
- No production rubric, historic Judge result, frozen 14 labels or canonical suite is modified in this research stage.

## Commands

    node scripts/verify-math-assertions.mjs --require-full-coverage
    node scripts/verify-math-assertions.mjs --output artifacts/math-assertion-verification.json
    npm run build
    node --test dist/tests/math-assertion-verifier.test.js dist/tests/math-diverse-human-review-candidates.test.js

These scripts are deterministic and require no API key. The generated JSON report reports reference values, every claim outcome and unverified coverage separately from student-learning and answer-leakage scores.
