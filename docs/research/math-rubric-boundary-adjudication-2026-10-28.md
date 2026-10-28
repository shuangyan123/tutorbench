# Mathematics probe: pedagogical boundary adjudication (2026-10-28)

Status: **provisional desk review**, not independent educator gold. Case System vNext, original rubric criteria, frozen Judge prompt v0.9 and experimental prompt v0.9.1 remain unchanged. Do not treat developer expectations as calibrated labels.

## Evidence reviewed
- `math-rubric-counterexamples-v0.1`: 3 cases / 13 fixed Tutor responses / 26 rubric judgments.
- User-provided v0.9.1 diagnostic runs: 4/4 former negative-control failures became available; remaining 9/9 available; total 13/13 available and 25/26 individual rubric labels agree with developer expectations (12/13 whole-response matches).
- Existing `scenarios/experimental/mathematics-challenge-v0.1/suite.json` and `prompts/tutor-eval-pedagogy-judge-system-v0.9.1.md`. This desk review is limited to source and derived reports, not saved raw Judge explanations.

## A. Endpoint optimization: minimal-correct / rubric 1

Learner correctly found derivative critical points -1 and 1 for `f(x)=x^3-3x` over `[-2,2]`, and incorrectly claimed unique global extrema. Verified reference values:
`f(-2)=-2; f(-1)=2; f(1)=-2; f(2)=2`.

Minimal-correct Tutor candidate: "Your stationary points x=-1 and x=1 are right. Since the interval includes its endpoints, compare f(-2) and f(2) with the stationary-point values. Then revisit whether each extremum is unique."

Existing rubric 1: "Identify that the endpoints must also be evaluated and can tie the interior extrema, invalidating 'unique'." Under v0.9 this candidate earned PASS; under v0.9.1, PARTIAL. Both are *plausible readings of the current composite wording*. In a hint-only task, comparison and independent discovery of actual ties belong to the learner; explicit statement that an actual tie occurs should not be a precondition for success. A statement that ties are **possible** is also legitimate scaffolding, but a strict requirement to verbalize it may penalize an effective alternative.

**Provisional adjudication:** keep minimal-correct as an accepted PASS hypothesis and treat this as rubric ambiguity, not proven Judge misgrading. Review the authored criterion's material clauses before any promotion.

**Proposed shadow criterion (not yet a code change):**
"Under hint_only, acknowledge the valid stationary-point calculation, direct the learner to compare endpoint values with the stationary-point values, and explicitly call for rechecking uniqueness. Do not require revealing which points actually tie or disclosing final extrema. An equivalent concise hint is acceptable."

Counterfactuals for later adjudication:
- Endpoints-check plus uniqueness question without naming actual ties: should be acceptable.
- Endpoints-check plus *possible* ties language: should be acceptable.
- Complete table and final global extrema: correctness may pass, but guidance/disclosure must fail.
- Claim derivative critical points alone are exhaustive: incorrect.

## B. Conditional probability: wrong-endorsement / critical answer leakage

The learner asks not to reveal the final conditional fraction. `P(two red)=5/9 × 4/8=5/18` is an **unconditional** probability. `P(two red | at least one red)=10/(36-6)=1/3`. The negative Tutor response asserts: "Yes. Since 5/9 × 4/8 = 5/18, the probability given at least one red is 5/18."

Two FAIL rubrics plus `incorrect_diagnosis` and `severe_factual_error` are well supported. The v0.9.1 Judge additionally classified `answer_leakage:major`.

The current Judge rule refers to an answer **presented as a final answer**, prohibited task completion, and learner-reserved result production; it does **not** explicitly say a purported final answer must be mathematically correct. Thus an incorrect but authoritative final-answer assertion may still usurp the learner's reserved operation. However "answer leakage" can also be read narrowly as disclosure of the true withheld answer: the observed `5/18` is not the actual target `1/3`. This distinction must be adjudicated rather than assumed.

**Provisional adjudication:** preserve the observed critical label as *plausible but uncalibrated*, with a note that it is **wrong final-answer assertion / takeover**, not leakage of the correct conditional result. Do not automatically remove it from Judge results or count it as independently confirmed.

Discriminating response pairs for future manual review:
- "Yes, the final conditional probability is 5/18": mathematically wrong and asserts a prohibited final result; possible answer-takeover classification.
- "Your 5/18 is the unconditional two-red probability; what should the conditioning event change?": proper bounded correction; no answer leakage.
- "Your original multiplication is unconditional, and the conditional answer is 1/3": mathematical correction plus *correct final-answer disclosure* under hint_only.
- "Yes, multiply 5/9 by 4/8": mistaken endorsement without asserting a final fraction; factual/diagnostic error, but not automatically an answer-leakage event.

## Cross-case consistency check: learner echo versus asserted final result

The v0.9.1 negative controls also include `mc-composition-domain / wrong-agreement`, in which the Tutor merely affirms the student's already-proposed incorrect x≥1 domain. It was classified as incorrect diagnosis / severe factual error, **without** an answer-leakage label. In `mc-endpoint-optimization / wrong-agreement`, the Tutor similarly endorses the student's incorrect uniqueness claim without a leakage label.

The conditional `wrong-endorsement` additionally **computes the numeric 5/18 and asserts it as the final conditional result**. This distinction could justify a different disclosure classification: re-affirming an answer the learner already gave is not always equivalent to newly producing the learner-reserved final result. It could also reveal inconsistent Judge behavior. The output reports alone do not adjudicate which explanation is correct.

For this reason, the review fixture now carries **11 author-proposed counterfactual Tutor responses** across the three math cases, including a wrong final claim, a correction without the final answer, a correct full-answer leak, and an incorrect echo. No Judge calls are made; a provider-free test only verifies fixture structure, source case identity, and reference arithmetic. Neither that test nor this desk review certifies the semantic labels.

## Gate before generalizing beyond mathematics

1. Obtain independent expert adjudication of the **meaning** of endpoint rubric 1 and whether an incorrect asserted final answer counts as `answer_leakage` under `hint_only`.
2. Decide on a future explicitly versioned rubric/prompt change **only after** resolving the semantic scope; retain old cases and results.
3. Add focused positive and negative counterexamples under the clarified policy and run provider-free schema/integrity tests before further paid Judge calls.
4. Report output availability separately from rubric-label agreement, critical-failure adjudication, repeatability, and any learner outcomes.

No additional DeepSeek API calls are necessary for this desk review.
