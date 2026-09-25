# Case System vNext — Evaluator Stress Test

Status: **provider-neutral synthetic diagnostic harness**

This stress test exists to answer a narrow question before Case System vNext
archetypes become executable Tutor scenarios:

> Can an evaluator consistently distinguish the reasoning contrasts that the
> vNext methodology says matter?

It tests the evaluator, not the Tutor.

## Protocol

Each fixture contains two developer-authored candidate Tutor responses with one
controlled contrast. The operator owns the expected diagnostic relationship.
The Judge-facing packet never contains that expectation, rationale, candidate
IDs, provider IDs, model IDs, latency, token use, or hidden model reasoning.

For every repetition the harness emits two blind presentations:

```text
presentation 1: A = response X, B = response Y
presentation 2: A = response Y, B = response X
```

The evaluator returns only `A_BETTER`, `B_BETTER`, or `TIE` for the
authored contrast. The harness maps those labels back through an operator-only
assignment sidecar.

A stable preference requires the same underlying response to win after the
A/B swap. If the evaluator follows presentation position, the result is
`order_sensitive`, not a tie.

## Five initial contrasts

- `human_efficiency`: correct but unnecessarily mechanical reasoning versus
  a materially simpler human-executable route within the learner's prerequisites.
- `opacity`: compressed or authoritative shortcut versus an efficient,
  locally justified explanation.
- `generalization_target`: instance-only solution versus justified reusable
  method when the teaching target explicitly calls for generalization.
- `prerequisite_compatibility`: elegant or advanced method outside the
  learner's authored prerequisite boundary versus an accessible method inside it.
- `equivalent_strategies`: two strategies that the archetype explicitly
  permits without enough evidence to prefer one. These fixtures require a tie
  expectation and guard against benchmark style bias.

## Initial fixture set

The first fixture set spans:

- Mathematics D5: human efficiency, opacity, and generalization;
- Programming D5: human efficiency and prerequisite compatibility;
- Science D5: equally defensible investigation strategies;
- Language/Writing D5: equally defensible synthesis strategies;
- History/Social Science D5: explicit corroboration versus an authority shortcut.

These are purposive synthetic probes. They are not a representative sample of
the case space.

## Repetition and reporting

The plan accepts a bounded `runsPerFixture` value. Each run performs both A/B
orders, so:

```text
planned judgments = fixtures × runsPerFixture × 2
```

The report separates:

- comparable repetitions;
- expected diagnostic matches among comparable repetitions;
- order-sensitive repetitions;
- incomplete evidence;
- modal fixture outcome and modal share;
- aggregate diagnostics by contrast.

An unavailable Judge call remains incomplete evidence. It is not converted
into semantic disagreement or failure.

## Interpretation boundary

The report is always marked `uncalibrated`.

Fixture expectations are developer-authored diagnostic expectations, not human
gold. Therefore:

- expected-match share is not evaluator accuracy;
- stable synthetic preference is not calibration;
- no Judge/model winner is inferred;
- no general tutoring-validity claim is supported;
- no learning-outcome or realized-transfer claim is supported.

The fixed report statement is:

```text
No evaluator-quality winner or calibration claim is inferred.
```

## Provider boundary

The core harness is provider-neutral. It accepts a function that consumes the
blind packet and returns a bounded judgment.

CI uses synthetic Judge functions only and makes no live model calls.

A later live-provider adapter can reuse this boundary, but should preserve:

- explicit call budget before execution;
- repeated runs;
- provider/model/prompt provenance outside the blind semantic packet;
- no raw provider payload or chain-of-thought persistence;
- separate availability and semantic diagnostics;
- no automatic evaluator selection.

## Expansion gate

The current eight fixtures are enough to validate the harness mechanics, not
enough to validate the constructs.

Before converting the 15 pilot archetypes into executable Tutor scenarios:

1. add more controlled contrasts at D3 as well as D5;
2. obtain independent human review of fixture expectations;
3. test at least one live Judge candidate repeatedly;
4. inspect order sensitivity and false preferences on equivalent-strategy ties;
5. revise authoring guidance or Judge criteria where a construct is unstable.

See also:

- [Case System vNext](case-system-vnext.md)
- [Core Coverage Matrix](case-system-vnext-coverage-matrix.md)
- [Judge Candidate Comparison](judge-candidate-comparison.md)
