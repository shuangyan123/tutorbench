# TutorBench mathematics evaluation: separate correctness, tutoring decisions, and answer disclosure

*2026-11-01 · Proposal v0.1 · research-only, not production Judge instructions or expert gold*

## Executive finding

The 11-response user review exposes a **construct validity** issue: in multiple cases a response contains a mathematically correct final answer yet is unacceptable as tutoring under `hint_only`. A second issue is nomenclature: the user marks some incorrect answer endorsements as "answer leakage", while the present Judge's ownership boundary is focused on disclosure of a learner-reserved final result. They should not be silently collapsed into one category.

This proposal adds *orthogonal analytic facets* rather than changing any original user score, canonical rubric, existing Judge prompt, or historical run. The companion [11-response shadow dataset](../../fixtures/judge/math-orthogonal-facets-shadow-v0.1.json) describes observable response behavior; the [raw user record](math-contrast-user-review-completed-2026-11-01.json) remains authoritative for what the reviewer submitted.

### A. Distinguish three decisions before scoring

1. **Mathematical validity**: Are factual assertions, calculations and conclusions correct? This is independent of whether the response exceeds a learner-requested hint boundary.
2. **Teaching and diagnostic adequacy**: Does the Tutor identify the learner's misconception, explain the relevant distinction at an appropriate level, and offer an actionable next step consistent with learner state? Do not infer adequate teaching from a correct final answer alone.
3. **Ownership / disclosure policy**: What operation or result is reserved for the learner at this turn? Did the Tutor merely hint, directly disclose a correct final solution, assert a wrong final answer, or affirm the student's erroneous claim? Separate the observable behaviors before mapping any to critical-failure types.

**Presentation** is a fourth independent quality dimension, not an automatic mathematics error. Unrendered LaTeX control sequences and display delimiters must be recorded as **presentation-layer** failures where they occur. The contrast corpus's original Tutor response for case 11 does not include the raw `\\[` marker; the offending marker appeared in the assistant's Chinese review presentation. Similarly, the `\\frac` complaint was clarified as disapproval of *raw control commands*, not correctly rendered fractions. Do not attribute review-UI defects to the evaluated Tutor model.

### B. Operational candidate definitions (not yet canonical)

| Candidate facet | Positive evidence / PASS rule | Negative evidence | Important exclusions |
| --- | --- | --- | --- |
| `mathClaimStatus` | All substantive math claims supported by the problem; a valid result may be disclosed | Material false formula, domain, endpoint or probability claim | Answer disclosure / tone alone does not make a true claim false |
| `diagnosticAdequacy` | Identifies the specific learner misunderstanding or uses a discriminating check when the case requests a hint | Wrong agreement, irrelevant diagnosis, unexplained contradiction | Brief bounded hints are not inherently incomplete when student wants only a pointer |
| `scaffoldFit` | Respects `hint_only`, leaves concrete learner work, gives useful next operation | Full solution, bare endorsement, wrong guidance, needless reteaching | Multi-turn escalation is case-dependent and cannot be presumed in a one-turn fixture |
| `correctFinalResultDisclosed` | True only if the response actually reveals the *correct* learner-reserved final result | False when only a rule, an uncomputed hint or a **wrong** alleged final result is supplied | This research flag is deliberately narrower than the current possible interpretation of `answer_leakage` |
| `prematureClosure` | True when Tutor authoritatively ends learner inquiry by supplying a final result or approving a false conclusion | False for bounded prompts and explanations that leave material work | This flag does *not* automatically equal `answer_leakage` or `student_task_takeover` |
| `renderedNotationUsability` | Equations appear correctly typeset or as legible natural language | Learner sees raw `\\frac`, `\\[` or broken encoding | Measure on the **rendered UI** and do not infer raw tokens from the Tutor source text |

The shadow dataset currently classifies the 11 responses as:
- **7 mathematically valid** responses (1, 2, 3, 6, 7, 10, 11);
- **4 mathematically invalid** endorsements/claims (4, 5, 8, 9);
- **3 correct complete result disclosures** (3, 7, 11);
- **4 bounded hints** (1, 2, 6, 10);
- **4 wrong endorsements or final claims** (4, 5, 8, 9).

These are mutually compatible annotations, **not rates of AI quality**, and have not been independently educator-adjudicated.

### C. Critical-failure mapping: two possible definitions, not one retroactive rewrite

**Existing rule.** Judge v0.9.1 applies an operation-ownership pass and treats `answer_leakage` as a prohibited disclosure of a final answer, complete solution or task-completing central operation; it also says a required diagnosis is Tutor-owned, not learner-reserved by default. It does not unambiguously define whether a false *purported* final answer counts as leakage. The source code already supports `misconception_reinforcement`, `incorrect_diagnosis`, `severe_factual_error`, and `student_task_takeover` as separate critical failure types.

**Narrow, testable candidate definition:** Use `correctFinalResultDisclosed` as a separate observable indicator of a correct task-completing answer. Classify an incorrect final assertion as `incorrect_final_result_assertion` for research and evaluate it against factual/diagnosis failures. Do **not** automatically equate the analytic indicator with the production `answer_leakage` critical type, or change its semantics by implication.

**Broad learner-perceived boundary:** A reviewer can reasonably call any response that tells the student "this is the answer" an unwanted takeover, whether right or wrong. Preserve that independent user judgment as `user.answerLeakage` and analyze the separate `prematureClosure` behavior. This broader construct should not be silently compared against an intentionally narrower Judge label as though it were the same metric.

**Discriminating question:** Why does the user label the wrong-endpoint echo in case 4 *not* leakage, but the wrong-probability endorsement in case 8 and wrong-domain echo in case 9 *as* leakage? All three approve a student's prior wrong conclusion. This is **an unresolved interpretation boundary, not permission to overwrite the reviewer or infer what they meant**. A future blinded contrast must hold the subject, student statement and finality wording constant while altering whether the Tutor adds a new answer or repeats an old one.

### D. Rubric design repairs for future versioning

- **Split correctness from policy** for a future `mc-endpoint-optimization` rubric: one checks that endpoints and potential ties matter; one evaluates whether Tutor over-solves or preserves learner work. The current R1 combines endpoint comparison with tie explanation and is ambiguous for an appropriate minimal hint.
- **Separate mathematical validity from diagnostic explanation depth** for the conditional probability case. The result `1/3` in case 7 is correct: there are `C(5,2)=10` all-red unordered pairs and `C(9,2)-C(4,2)=36-6=30` pairs with at least one red. The reviewer nevertheless submitted R1=PARTIAL, R2=FAIL and wrote "结果错误。区分不是简答说对错，而是要解释清楚。" Preserve that as written and probe whether the concern was reasoning transparency rather than the numeric result.
- **Make the target student capability explicit.** A bounded hint should not be required to state the conclusion it asks the student to infer, absent a clear requirement that an explanation is needed now.
- **Introduce explicit student-state contingencies** before judging a multistep escalation. A future case should show the preceding attempts, number of failures, explicit request, and support level to determine whether a fuller explanation becomes appropriate.
- **Keep presentation independent.** Diagram usefulness, missing vocabulary, and raw math delimiters need learner-facing interface and adaptation checks, not automatic factual-error flags.

### E. What must be validated before a code change

1. **Independent rubric adjudication:** at least two qualified reviewers independently rate matching examples using explicit anchor definitions. Report per-axis agreement and disagreement; do not call any one reviewer the ground truth.
2. **Counterfactual wording control:** construct pairs that only differ in authoritative closure wording, correctness of the final fraction, and whether the learner provided the exact answer before the Tutor turn.
3. **Semantic negative controls:** a valid short hint, a conceptual correction, an accurate full solution violating hint-only, a wrong answer endorsed without new math, and an incorrectly calculated final result.
4. **Case policy variation:** compare `hint_only` with `full_solution_required`, and one-turn with demonstrated multi-turn unsuccessful attempts, to test that the same words do not always entail the same disclosure failure.
5. **Source-vs-render separation:** evaluate the original Tutor text and the actual rendered UI separately for notation quality; verify whether raw `\\[` originated in the UI.
6. **Validation before costs:** run offline structural, mathematical and provenance checks, then a limited fresh Judge run only after the adjudication gate. Report output availability and semantic agreement separately.

### F. Scope and preservation guarantee

This is a versioned design proposal and separate facet dataset. **No user R1/R2/answer-leakage label is altered; no existing fixture, rubric, model prompt, or Judge output is replaced.** The 11 examples are synthetic stress contrasts, not a probability sample, so their relative frequencies must not be read as production incidence or model accuracy.

**Status:** proposed definitions; educator agreement, learner outcomes, controlled contrast testing, and real UI rendering evidence are still missing.
