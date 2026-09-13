# Evidence-bearing programming prototype

This document records the R3 experimental prototype tracked in issue #116. The prototype demonstrates that TutorBench can generate Tutor-visible debugging evidence from a real, local, provider-free execution step and bind that evidence to auditable fingerprints.

## Boundary

The prototype is **not** part of the canonical `tutor-eval-v0.2a@0.2a.6` dataset and does not change evaluator semantics `0.3a.4`.

It does not change canonical cases, rubrics, weights, thresholds, category aggregation, Judge prompts, critical-failure behavior, leaderboard eligibility, or Community Review state. It also does not establish that execution-backed evidence improves reliability, validity, tutoring quality, learner outcomes, or cross-locale comparability.

The experimental challenge identity is:

```text
experimental-programming-test-failure-evidence-001@0.1.0
```

It is conceptually related to the canonical `programming-test-failure-001` scenario, but it intentionally has a separate identity because the visible evidence condition is different.

## Fixture and execution

The checked-in synthetic fixture is:

```text
fixtures/experimental/evidence-bearing-programming/
  clamp-score.mjs
  clamp-score.test.mjs
```

The implementation contains a deliberate synthetic bug in a small `clampScore()` function. A Node 22 `node:test` assertion expects `clampScore(120)` to return `100`; the buggy implementation returns `0`.

The evidence generator runs only the checked-in test file with the repository's current Node executable:

```text
node --test --test-reporter=tap clamp-score.test.mjs
```

The execution is bounded by a five-second timeout and a 32 KiB output limit. The expected process exit code is `1`, because this fixture is intentionally failing. An unexpected success, timeout, signal, malformed TAP evidence, oversized output, or other execution error fails closed.

No network access, Tutor provider, Judge provider, user-supplied code, shell interpolation, or general-purpose sandbox is involved.

## Normalized evidence

Only stable semantic fields are retained from the TAP result:

```text
test=clampScore caps values above 100
status=failed
expected=100
actual=0
operator=strictEqual
errorCode=ERR_ASSERTION
```

Timing, absolute paths, stack traces, and other environment-sensitive output are not part of the normalized evidence.

This distinction matters: the repository does not treat an authored string that merely says "the test failed" as execution evidence. The normalized record is created only after the checked-in fixture is actually executed and the expected failing assertion is observed.

## Provenance and binding

The evidence bundle records SHA-256 fingerprints for:

- the public experimental challenge specification;
- the exact checked-in fixture file bytes and file names;
- the declared execution specification;
- the normalized execution evidence; and
- a binding fingerprint over the challenge identity and the preceding fingerprints.

The runtime's exact Node version is recorded as diagnostic provenance, while the stable execution-spec fingerprint targets the repository-supported Node 22 range (`>=22 <23`).

Before a `TutorTurnInput` is built, the current challenge specification, fixture bytes, execution specification, evidence record, and binding fingerprint are recomputed. Any mismatch fails closed with explicit diagnostics.

## Tutor-visible and hidden data

The prototype composes an ordinary `TutorTurnInput`; it does not extend the core Tutor contract. The generated input uses `scenarioId` for the experimental identity and deliberately omits canonical `caseId` and `caseVersion` fields.

Tutor-visible context contains the normalized execution evidence plus challenge/evidence fingerprints. A hidden reference diagnosis remains outside the Tutor-visible input. This preserves the existing architectural rule that hidden evaluator material must not cross the Tutor adapter boundary.

## Evaluation semantics

The deterministic part of this prototype verifies **evidence integrity and reproducibility only**.

It does not deterministically decide whether a Tutor's debugging diagnosis, explanation, pedagogical sequencing, or next-step advice is correct. The provider-free synthetic Tutor exercised by the CLI is therefore a plumbing/reproducibility check, not a scored benchmark result.

Prototype output explicitly records:

```text
semanticTutoringEvaluation=not_evaluated
canonicalScoringApplied=false
```

Any future claim about semantic tutoring quality would require a separately justified evaluator and validation process.

## Commands

Run the prototype:

```bash
npm run experiment:evidence-programming
```

Normal repository quality gates cover the TypeScript implementation and regression tests:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run benchmark
```

## Completion claim

A passing R3 prototype shows only that TutorBench can reproduce this chain:

```text
versioned synthetic fixture
-> bounded local execution
-> normalized evidence
-> provenance/fingerprint binding
-> Tutor-visible input
-> provider-free synthetic Tutor exercise
```

It does not mean the prototype should enter the canonical dataset, that executable evidence improves measurement validity, that semantic Tutor quality has been verified, or that human calibration has been completed.
