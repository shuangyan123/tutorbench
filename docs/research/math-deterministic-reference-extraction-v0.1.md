# Deterministic math reference verification — isolated research pilot

**Status:** experimental and non-canonical, extracted from [research PR #308](https://github.com/shuangyan123/tutorbench/pull/308) on 2026-11-02. No production Judge prompt, score, canonical TutorEval dataset, human gold label, or real-model integration is changed.

## Included

- `fixtures/judge/math-diverse-human-review-candidates-v0.1.json`: twelve *author-written synthetic* student/Tutor exchanges across twelve mathematical task topics, ten `hint_only`, two `full_solution_allowed`; all `humanRatings` remain null.
- `fixtures/judge/math-diverse-structured-math-references-v0.1.json`: pinned exact student text, task input and response exemplars; reference inputs are author-authored assumptions, not automatically inferred.
- `scripts/verify-math-diverse-candidates.mjs`: provider-free reference calculations and narrowly constrained mathematical-assertion parsing.
- `tests/math-diverse-structured-reference.test.ts` and `tests/math-diverse-human-review-candidates.test.ts`: checks for reference mathematics, altered correct/incorrect numerical conclusions, unknown response wording, source drift, distinct tasks and missing gold labels.

## How to run

```sh
npm ci
npm run build
node scripts/verify-math-diverse-candidates.mjs --require-full-coverage
node scripts/verify-math-diverse-candidates.mjs --output artifacts/math-diverse-reference-verification.json
```

For the frozen twelve synthetic response texts, the expected classifications are **4 verified correct mathematical final assertions, 4 verified incorrect assertions, 4 recognized responses without final-result assertions, and 0 unverified**. The third category does **not** mean the response is pedagogically good or that every mathematical sentence has been checked. Strict mode fails if any item is `unverified`.

## What this does *not* establish

1. It is not a general-purpose symbolic math verifier or LLM semantic evaluator. Matching is deliberately conservative, by recognized grammatical pattern. Model paraphrases may be `unverified` even when mathematically correct.
2. It cannot score incorrect endorsement, premature closure, hint appropriateness, answer leakage, learning gain or model quality. No educator-calibrated rubric or empirical model-run artifact exists in these files.
3. The results do not automatically transfer to the original 14-arm blind review. The raw blind-review data and its uncalibrated hypotheses remain isolated in PR #308.
4. The `probeIntent` field is an author hypothesis and must not be exposed as an answer key to blind human reviewers.

## Next engineering gate

Before evaluating arbitrary Tutor responses, define a bounded representation of verified mathematical claims and broaden verification with tests for adversarial paraphrases and ambiguous student tasks. Unknowns remain unresolved and are never counted as mathematical passes. Human pedagogical reference labels require independent blinded educator review, separately from deterministic mathematics.
