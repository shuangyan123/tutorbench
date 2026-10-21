# Cinema seating — synthetic authoring pilot

Identity: `cinema-seating-pilot@0.1.0` · Principle: [P-001@0.1.0](p-001-mathematical-representation-traceability.md)

Status: **candidate case notes, non-canonical, not executable**.
[Research index and evidence lifecycle](../README.md).
All utterances, responses, and continuations below are synthetic author examples,
not a single learner transcript, actual model output, or measured learner data.

## Shared task and correct reference

There are 5 rows of 8 seats. Two named students occupy distinct seats selected
uniformly without replacement. Condition on A occupying row 1, seat 1; B is then
uniform over the 39 remaining seats. Ask for B's probability of sitting in A's
row or in a different row. Fixing A is legitimate under this symmetric seat
model; it is not an extra restriction on B's row.

| Representation | Task meaning and justification |
| --- | --- |
| `40 = 5 × 8` | All seat objects before A's seat is occupied; 40 is a denominator for a specified first seat before occupancy, not for B after fixing A. |
| `39 = 40 − 1` | B's eligible, equally likely remaining seat outcomes; excludes only A's occupied seat. |
| `7 = 8 − 1` | Favorable same-row seats: row 1, seats **2–8**, seven seats, not 2–7. |
| `32 = 4 × 8` | Favorable different-row seats; no seat in those four rows is occupied by A. |
| `7/39` | Same-row event: seven disjoint elementary seat events, each of probability `1/39`; add them, equivalently `7 × 1/39`. |
| `32/39` | Different-row event: sum of 32 disjoint seat events, equivalently `32 × 1/39`; also `1 − 7/39`. |
| `1/39` | One **specified** remaining seat, e.g. row 2, seat 3, under the original choice rule. An unrestricted draw can instead land in row 1. |
| `1/32` | One specified different-row seat **conditional on B being restricted to the 32 different-row seats**. The probability of any different-row seat under that condition is 1. |

The numerators count outcomes in the event; the denominators count outcomes in
the active equally likely choice set. Favorable is not synonymous with eligible.
Check: `7 + 32 = 39` and `7/39 + 32/39 = 1`.

Uniform seats do not imply uniform rows: row 1 has probability `7/39`, each other
row `8/39`. A *different explicit process* could choose one of the five rows
uniformly, then one of its unoccupied seats uniformly (7 in row 1, 8 elsewhere).
That process gives row 1 probability `1/5` and a specified eligible row-1 seat
probability `1/5 × 1/7 = 1/35`; it is not the original uniform-seat process.
Multiplication itself is valid for conditional stages: in the original process,
`P(row 1) × P(seat 2 | row 1) = (7/39) × (1/7) = 1/39`.
Do not teach that all row/seat decompositions are invalid or independent.

## Authored learner-state variants: H1

Each V-ID is a separate learner state and **one next-response decision**, not a
successive turn from one person. Assume the [P-001 prerequisites](p-001-mathematical-representation-traceability.md#prerequisites-and-applicability).
The task is D2 (single-concept finite probability application); P varies with
the teaching decision. These D/P/H labels reuse [vNext anchors](../../../case-system-vnext.md),
not a new schema or validated scale. The reference permits worked explanation
for these answer/reasoning-check cases; it is not a hint-only disclosure rule.

| ID / provisional state | Synthetic learner statement | Authored decision target | Contrast that misses the target |
| --- | --- | --- | --- |
| V1 · D2/P3/H1 · partial understanding | “A takes one seat. Only seven same-row seats remain, so the probability is 1/7, right?” | Preserve the seven-seat count; identify that eligible unfavorable rows were excluded. Explain that B can still select all 39 remaining seats and that the event contains seven of them. | Bare `7/39` supplies the correct number but does not address why the other rows still belong in the denominator. |
| V2 · D2/P3/H1 · possible sampling-model confusion | “I choose the row with 1/5, then a seat with 1/7, so 1/5 × 1/7.” | Clarify which event the product denotes; distinguish the stated uniform-seat process from uniform-row sampling. If the target is same row, it contains seven seats, not one. | “Never multiply probabilities” rejects a valid method; accepting `1/5` silently switches models. |
| V3 · D2/P3/H1 · correct count, disputed event | “There are 32 seats in other rows. So choosing any different-row seat has probability 1/32.” | Preserve 32. Distinguish an event containing 32 seats from one specified seat, and original versus restricted choice sets. | Merely `32/39` or merely “the denominator is 39” leaves the event/condition contrast unexplained. |
| V4 · D2/P1/H1 · already understands this item | “Each remaining seat has chance 1/39. Seven disjoint seats are in A's row, so 7 × 1/39 = 7/39. Just check my reasoning.” | Concisely confirm the justified sum. No repair is indicated; do not require re-explanation of every integer or a transfer task. | A full remedial lecture ignores the demonstrated mapping; “you have mastered probability” overclaims. |
| V5 · D2/P3/H1 · valid objection, not an error label | “But a random 1/39 draw might pick a same-row seat. Why call it a different-row seat?” | Affirm the objection: `1/39` describes the chance of a specified other-row seat, not a guarantee that an unrestricted draw lands in another row. | “No, a 1/39 draw must land in a different row” is a tutor error. |

Possible targeted V3 response (illustrative, not mandatory wording): “Your count
of 32 is right. B still chooses among 39 seats; 32 of those satisfy ‘different
row’, so that event has probability 32/39. A particular one of those seats has
probability 1/39. It becomes 1/32 only if B's choice is first restricted to the
32 other-row seats.” This connects the disputed representation to the choice
rule; it does not require reteaching `5 × 8`.

Possible V4 response: “Yes. Those seven disjoint seat events each have chance
1/39, so adding them gives 7/39.” A separate transfer opportunity may be offered
if requested, but the absence of one is not a defect in this bounded check.

## Authored H2 contrasts: history informs the next decision

These are two separate **short authored trajectories**, not extensions of the
V1–V5 rows and not observed learning. Each has one next Tutor response to review;
no H3 episode or autonomous learner simulation is claimed.

- **T1 · D2/P4/H2 · repeated unresolved distinction:** learner: “32 seats means
  1/32?” → prior synthetic tutor: “It is 32/39.” → learner: “I still don't see
  why 32 isn't underneath.” The next decision should change support: contrast
  all eligible seats with the event subset, perhaps by marking a seat grid.
  Repeating only `32/39` again misses the visible unresolved question. Do not
  infer frustration or a lasting cognitive diagnosis from this history.
- **T2 · D2/P2/H2 · local explanation now present:** learner: “What does 39
  count?” → prior synthetic tutor: “All seats B can choose after A occupies
  one.” → learner: “Then the 32 seats in other rows each have chance 1/39;
  together that is 32/39.” The next decision can confirm and fade. That authored
  continuation illustrates evidence a tutor could respond to; it does not show
  that the prior explanation caused learning or that transfer occurred.

H1 supports observations about the next response to a visible learner state.
H2 permits a limited check that the next response uses the supplied history.
Neither is evidence of durable learner-state tracking or measured outcomes.

## Adversarial tutor-failure probes and observation ownership

All failures below are authored examples, not observed provider incidents.

| Probe | Synthetic tutor behavior | Primary review observation |
| --- | --- | --- |
| F1: correct answer, missing link | To V3: “32/39.” | Guidance mapping is unobserved; mathematical answer alone does not resolve the expressed distinction. Do not multiply that absence into several category penalties. |
| F2: unauthorized conditioning | “There are 32 different-row seats, so B picks any different-row seat with probability 1/32.” | Correctness error: changed choice set and confused one-seat versus union event. Count the erroneous claim once. |
| F3: false enumeration | “The seven same-row seats are 2–7.” | Correctness error: that range contains six seats and omits seat 8. |
| F4: rejects sound objection | To V5: “A 1/39 draw cannot choose row 1.” | Correctness error; the learner's objection is valid. |
| F5: indiscriminate explanation | To V4: ignores “just check” and restarts counting all 40 seats and basic fraction definitions. | Adaptation mismatch with independently visible correct reasoning and the bounded request; length alone is not the failure. |

Use [P-001's atomic probes and ownership rule](p-001-mathematical-representation-traceability.md#atomic-observable-review-probes)
for distinct diagnosis, mapping, adaptation, and optional verification notes.
These contrasts are author expectations for independent review, not a new
PASS/PARTIAL/FAIL rubric, model ranking, or proof that judges can discriminate.

## Optional independent transfer opportunity

Only when the learner's goal permits a check, offer a new task without the counts
or answer: “Now use 4 rows of 6 seats. A occupies row 1, seat 1 and B chooses
uniformly among the remaining seats. What is the probability of a different row?
Explain what the denominator counts.” Do not reveal the reference before the
attempt, echo a just-supplied solution, or call an authored answer learner evidence.

Author-only reference: 24 total seats, 23 remaining, 5 same-row seats, 18
different-row seats; different-row event `18/23`, specified different-row seat
`1/23`, or `1/18` conditional on restricting B to other rows. This is a near
transfer opportunity, not observed transfer, far transfer, retention, or mastery.
Even a real correct attempt would support only that bounded performance; durable
mastery and efficacy require separate learner evidence and an appropriate design.
