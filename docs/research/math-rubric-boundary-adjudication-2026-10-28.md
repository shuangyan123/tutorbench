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


## C. Eleven-response provisional adjudication (authoritative output still unchanged)

This is an **analytical recommendation**, not an independent professional educator decision. The versioned, non-canonical review table lives in
[`math-pedagogical-boundary-shadow-adjudication-v0.1.json`](../../fixtures/judge/math-pedagogical-boundary-shadow-adjudication-v0.1.json).
Its labels are never passed to the public benchmark or live TutorEval judge. It references the eleven original contrast responses without editing them.

The two statuses in each row correspond to the case's existing rubric order; only the first endpoint row's judgment is expressly based on the **candidate learner-work-preserving interpretation**, not a retroactive claim that the current wording is unambiguous.

| Task/response | Provisional two-rubric status | Answer leakage? | Additional critical-failure candidates (not calibrated) |
| --- | --- | --- | --- |
| Endpoint `endpoint-minimal` | PASS / PASS (shadow interpretation) | No | None |
| Endpoint `endpoint-possible-tie` | PASS / PASS (shadow interpretation) | No | None |
| Endpoint `endpoint-final-reveal` | PASS / FAIL | Yes | `answer_leakage` |
| Endpoint `endpoint-wrong-agreement` | FAIL / FAIL | No | `incorrect_diagnosis`, `severe_factual_error` |
| Conditional `conditional-wrong-asserted-final` | FAIL / FAIL | Provisional yes (low confidence) | `incorrect_diagnosis`, `severe_factual_error`, `answer_leakage` |
| Conditional `conditional-bounded-correction` | PASS / PASS | No | None |
| Conditional `conditional-correct-final-reveal` | PASS / FAIL | Yes | `answer_leakage` |
| Conditional `conditional-wrong-endorsement-no-final` | FAIL / FAIL | No | `incorrect_diagnosis`, `severe_factual_error` |
| Domain `domain-wrong-echo` | FAIL / FAIL | No | `incorrect_diagnosis`, `severe_factual_error` |
| Domain `domain-bounded-counterexample` | PASS / PASS | No | None |
| Domain `domain-correct-final-reveal` | PASS / FAIL | Yes | `answer_leakage` |

### Scope of an incorrect final-answer assertion

This desk review proposes a narrow behavioral decision rule **for subsequent independent assessment**:

1. Under `hint_only`, distinguish newly giving an answer **as the task's final result** from repeating/assessing a student's already-proposed expression. The latter can be incorrect, but does not automatically complete additional learner-reserved work.
2. If the Tutor computes a new numerical result and asserts that it is the final answer, this may constitute prohibited answer completion **even if numerically incorrect**. This interpretation treats `answer_leakage` as the disclosure of a purported completed answer, **not necessarily leakage of the correct ground-truth answer**.
3. The independently observable factual error remains separately assessable as `severe_factual_error` or a failed correctness rubric. Never infer that an incorrect final statement has revealed the *correct* withheld fraction.
4. The `conditional-wrong-asserted-final` example is **low-confidence and expert review required**. Its existing source text names the student's own `5/9 × 4/8` expression and expands that arithmetic into `5/18`. Whether this counts as *new material result production* or merely a redundant explanation of the student's proposal is a genuine ambiguity. Do not silently promote this tentative leakage recommendation to global policy.
5. Avoid counting the same takeover twice as both `answer_leakage` and `student_task_takeover`. If experts instead restrict leakage to true final results, evaluate whether a new type or existing task-takeover type is appropriate, without relaxing the factual-error finding.

**Priority:** Expertly decide the correct scope for the wrong-final example before changing a Judge instruction or rubric. Inspect a contrast that removes the new arithmetic (`conditional-wrong-endorsement-no-final`) and a contrast that gives the correct complete result (`conditional-correct-final-reveal`) rather than overfitting one output.

### Endpoint criterion after desk review

Under `hint_only`, requiring the Tutor to state the actual equality of endpoint and stationary-point values conflicts with the stated learner objective. Both a minimal endpoint-comparison hint and a hint mentioning *possible ties* should be accepted if they direct comparison and prompt a uniqueness check. The existing rubric's material clauses permit a stricter PARTIAL interpretation; **an isolated shadow rewrite would be more faithful to learner work, but no rubric has been changed**.

This review deliberately distinguishes (a) source rubric compliance, (b) pedagogically defensible alternative response, (c) critical-failure construct, and (d) model execution availability. Their denominators and validation status must not be collapsed into one benchmark accuracy number.

### Regression and adoption boundaries

The associated provider-free test verifies that the eleven shadow annotations match the original eleven contrasts, reference real `hint_only` cases, use legal rubric labels and critical-failure names, and remain marked `requiresIndependentExpertReview`. It does **not** prove any semantic judgment is correct or make these labels executable gold; no live Judge call, prompt change, or canonical dataset update is involved.

**Release gate:** a subject-matter educator should first adjudicate the two ambiguity boundaries, then any revised criterion or policy should be separately versioned, stress-tested for false positives and false negatives, and reported against the untouched baseline.
