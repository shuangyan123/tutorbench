# Tutor-response pairwise prototype

Status: **R4-B provider-free prototype**

This prototype adds a separate, versioned pairwise evaluation layer for two frozen Tutor responses to the same TutorEval case/version. It does not change canonical TutorEval scoring, dataset/rubric semantics, Judge calibration status, or public leaderboard behavior.

## Measurement boundary

The comparison unit is fixed to:

```text
same dataset identity
+ same case ID/version
+ same evaluator semantic version
+ two immutable Tutor response IDs/texts
```

The prototype derives an order-independent `pairId` from the dataset, case, evaluator version, and sorted response IDs. Source response identities and source corpora are not rewritten.

The canonical pair outcome vocabulary is:

```text
A_BETTER
B_BETTER
TIE
INCOMPARABLE
```

Canonical A/B are response-ID sorted identities used only in the operator-side result. They are distinct from the temporary A/B labels shown in a Judge presentation.

## Blinding and order swap

Each pair compiles to exactly two blind packets:

1. canonical A shown as presentation A, canonical B as presentation B;
2. the same responses shown in the opposite order.

The Judge-facing packet omits Tutor/provider/model identity, response IDs, generation identity, latency, token usage, cost, and leaderboard history. The operator-only assignment sidecar maps temporary presentation labels back to immutable response IDs.

Both orderings are required so position/order sensitivity remains observable. A preference reversal is `INCOMPARABLE` with `order_sensitive`; it is never collapsed into `TIE`.

## Authorized evidence

The blind packet carries the existing authored case evidence:

- Tutor-visible case input;
- ground truth when authored;
- known misconception when authored;
- disclosure policy;
- existing TutorEval rubrics.

The comparison instruction requires the evaluator to compare only against these authored semantics and existing critical-failure behavior. It must not invent new preferences for response length, tone, provider/model identity, latency, token use, cost, popularity, or leaderboard position.

## Evidence normalization

Two valid order-swapped judgments normalize as follows:

- same underlying response preferred twice -> stable preference;
- `TIE` twice -> stable tie;
- opposite underlying winners -> `INCOMPARABLE / order_sensitive`;
- one tie plus one preference -> `INCOMPARABLE / inconsistent`;
- unavailable or invalid presentation evidence -> `INCOMPARABLE / incomplete_evidence`.

Malformed evidence fails closed with `TutorResponsePairwiseError`.

## Explicit non-claims

This prototype does **not** establish:

- an Elo or other ranking scale;
- a leaderboard ordering;
- statistical superiority;
- Judge-vs-human calibration;
- construct validity or general tutoring ability;
- learner outcomes, retention, transfer, or classroom effectiveness.

Every normalized result records `rankingClaimAllowed: false`.

## Provider-free boundary

The implementation contains no Tutor provider call and no Judge provider call. Tests use frozen synthetic response text and exercise only deterministic packet construction, blinding, order swapping, normalization, and fail-closed validation.

A later live Judge pilot, statistical aggregation, human calibration, or public ranking would require a separately authorized phase and additional evidence.
