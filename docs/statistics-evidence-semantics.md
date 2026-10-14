# Statistics and signal availability

## Agreement

Cohen's kappa and linear weighted kappa are undefined when there are no
scored pairs or expected agreement is 1, because the denominator is zero.
Current calculations return JSON `null`; text reports display `n/a`.
Raw agreement and confusion matrices remain available. One shared label can
produce 100% observed agreement without defining kappa. This correction adds
no calibration threshold and does not rewrite saved historical metrics.

## TutorEval failure signals

The v1 fields `criticalFailureRate` and `answerLeakageRate` retain their original
recorded-positive count divided by all case runs. They are historical count
proportions, not proof that missing Judge evidence contains no failure.

Current results add optional `failureSignalMetrics`, with `schemaVersion: 1`.
Each of `criticalFailures` and `answerLeakage` contains:

| Field | Meaning |
| --- | --- |
| `confirmedCount` | Case runs with the corresponding recorded positive signal |
| `knownAbsentCount` | Case runs with complete, consistent Judge evidence and no recorded signal |
| `unavailableCount` | Remaining case runs, whose signal absence cannot be established |
| `rate` | Confirmed / all case runs, or `null` for empty or incomplete evidence |

No denominator changes to the subset of successful executions. A partial
sample retains confirmed signals and coverage while its all-case rate remains
unknown. Structured abstention can retain positive critical failure or leakage;
it cannot establish a negative result. A deterministic positive also remains
recorded when Judge evidence is unavailable. Deterministic-only negative
evidence does not establish the absence of every semantic failure.

Current global and locale summaries, and the audit website view, use these
nullable evidence rates. Numeric 0% requires nonempty, complete negative
evidence. Coverage distinguishes unknown evidence from observed absence.

Readers still accept v1 artifacts without the extension. If the extension is
present, its counts and rate must match a recomputation from case records;
supplied metadata cannot manufacture coverage. Formatting historical artifacts
derives availability from their recorded evidence while preserving the saved
numeric fields. This is a diagnostic projection, not independent authentication
of artifacts or scientific proof of teaching quality. Authored rubric/source
consistency and scoring provenance remain separate validation boundaries.

The sanitized public publication format keeps its existing numeric fields and
strict full-evidence publication checks. No public artifact is changed or
published by this correction.
