# Mathematics contrast blind review: completed human-feedback round

Date: 2026-11-01. **Status: user-reviewed, not expert-calibrated gold.**
Scope: three mathematics scenarios, eleven deliberately constructed Tutor responses under `hint_only`; these are **not eleven independent mathematics problems**.

## Source of truth and provenance

- [Complete user-submitted record](math-contrast-user-review-completed-2026-11-01.json) contains all 11 R1/R2/leakage ratings and original reviewer reasons.
- The original in-progress five-response [record](math-contrast-user-review-2026-10-28.json) is retained, rather than overwritten.
- Separate provisional model-derived [desk review](math-rubric-boundary-adjudication-2026-10-28.md) and Judge prompt are **not** authoritative for the user-submitted ratings.
- The rubric and the canonical mathematics scenarios have **not changed**, and no paid Judge run was launched for this review.

## Recorded counts

Across 11 contrast responses, user labels: R1 = 4 PASS / 1 PARTIAL / 6 FAIL; R2 = 4 PASS / 0 PARTIAL / 7 FAIL; perceived answer leakage = 6/11. This curated negative/positive-control sample has no representative denominator for AI tutoring performance.

## Direct comparisons with historical DeepSeek Flash v0.9.1

To avoid false equivalence, compare only response strings that match the historical `math-rubric-counterexamples-v0.1` corpus **exactly**. Three of eleven qualify:

| User review | User R1/R2/leakage | Historical Judge R1/R2/leakage | Difference |
| --- | --- | --- | --- |
| 1: endpoint-minimal | PASS/PASS/no | PARTIAL/PASS/no | R1: endpoint hint sufficiency |
| 5: conditional-wrong-asserted-final | FAIL/FAIL/yes | FAIL/FAIL/yes | No direct disagreement |
| 9: domain-wrong-echo | FAIL/FAIL/yes | FAIL/FAIL/no | Leakage boundary for endorsement of learner's error |

Among the 3 exact responses, rubric agreement is **5/6** and leakage classification agreement is **2/3**. These figures are exploratory agreement counts, **not calibrated accuracy**. The other eight contrast responses differ from their semantically related historical probe texts; they were **not** assigned historical Judge results.

## Questions raised by the feedback

**Separate correctness from bounded teaching behavior.** For 3 and 11, the reviewer uses R1=FAIL while the mathematical final results are correct, apparently because a final result was supplied under a hint-only instruction. Keep those submitted R1 labels unchanged, but clarify whether mathematical correctness and tutoring policy compliance require distinct rubrics.

**Check what "wrong result" means for 7.** The reviewer submitted R1=PARTIAL, R2=FAIL, leakage=yes and wrote "结果错误。区分不是简答说对错，而是要解释清楚。" The numerical conditional result 1/3 is mathematically correct: C(5,2)/(C(9,2)-C(4,2)) = 10/(36-6) = 1/3. This *factual check is separate from the unchanged human rating*; discuss whether the issue is explanation adequacy, presentation, or a misconception before proposing any correction.

**Define leakage versus incorrect endorsement.** In 8 and 9 the reviewer counts endorsing the student's wrong answer as leakage. The v0.9.1 Judge did not emit answer_leakage for the exactly matching text of 9, although both R rubrics failed. Define whether answer_leakage includes wrong-answer endorsement, or reserve that failure for a distinct correctness / diagnostic category.

**Scaffolding under hint_only.** In 1, reviewer PASS versus Judge PARTIAL on the diagnosis criterion may reflect a composite rubric that requires explicit mention of possible ties, even where asking for endpoint comparison and rechecking uniqueness is enough for learning.

## Independent teaching/presentation recommendations

1. Provide an optional diagram or sketch where it clarifies the mathematics, without revealing learner-reserved conclusions (case 1).
2. Design multi-turn intervention cases so progressive hints can become more direct after repeated unsuccessful attempts; do not retroactively apply this to one-turn hint-only tasks (case 3).
3. Do not display raw math source commands (such as `\\frac`) or raw display delimiters (such as `\\[`) to learners; render the expressions or use accessible text fallback. The reviewer does **not** oppose mathematical notation itself (cases 5, 6, 11).
4. Explain conceptual distinctions rather than merely affirming or rejecting a student's statement (case 7).
5. Offer minimal refreshers on forgotten foundational terms such as definedness/domain/domain condition before using those terms in hints (case 10).

## Next validation gate

Arrange independent educator adjudication of critical-failure boundaries, then version new *shadow* rubrics and test them on matched contrasts before another paid LLM Judge run. Preserve these raw user labels and the frozen historical reports; never convert this round to a claim of model accuracy.
