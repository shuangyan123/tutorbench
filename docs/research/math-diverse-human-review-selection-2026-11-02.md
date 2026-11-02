# Diverse mathematics review: first human triage (2026-11-02)

Research selection plan; NOT an evaluated model run, expert consensus or a released gold dataset.

## Inputs

- Twelve different synthetic tasks: `fixtures/judge/math-diverse-human-review-candidates-v0.1.json`.
- Source-pinned structured mathematical references: `fixtures/judge/math-diverse-structured-math-references-v0.1.json`.
- Deterministic verification: `scripts/verify-math-diverse-candidates.mjs --require-full-coverage`.
- All candidate humanRatings remain null. Historical 14-arm blind scores and Judge prompts remain untouched.

## Selection criterion

Choose diverse **pedagogical decisions** rather than repeated math problems: some short hints, some wrong endorsements, a mathematically correct but prohibited disclosure, a wrong final assertion, and full explanations expressly permitted by the learner. The selection below is not a hidden answer key. Eight cases from eight topics is an intentionally small, research-only human pilot.

| ID | Mathematical topic | Policy | Human question to investigate |
| --- | --- | --- | --- |
| math-diverse-01 | Linear equation | hint_only | Does checking a student's substitution support independent correction? |
| math-diverse-02 | Fraction addition | hint_only | Does affirming the student's wrong fraction constitute misconception reinforcement even without introducing a new answer? |
| math-diverse-03 | Unit-rate proportion | hint_only | Does a bounded check respect a learner's potentially correct initial setup? |
| math-diverse-05 | Conditional coin probability | hint_only | Does giving a mathematically correct final result violate the learner's requested amount of help? |
| math-diverse-07 | Logarithm domain | hint_only | How should a confidently asserted wrong final domain be classified separately from disclosure? |
| math-diverse-08 | Product-rule derivative | hint_only | Is a diagnostic question sufficiently actionable without completing the derivative? |
| math-diverse-11 | Linear systems | full_solution_allowed | When full solution is explicitly requested, is a correct complete explanation appropriate? |
| math-diverse-12 | Absolute-value equation | full_solution_allowed | Does a full worked method adequately respond after two learner failures and an explicit request? |

Reserve the following four cases for unresolved boundaries, not for immediate duplicate rating: `math-diverse-04` (second unintroduced wrong endorsement), `math-diverse-06` (repeated sign confusion), `math-diverse-09` (second correct final under hint-only), and `math-diverse-10` (second wrong final assertion). Use a reserve item only if an independent reviewer identifies a specific uncertainty it would resolve.

## Reviewer task design

- Show the original learner message, the Tutor response, and the disclosure policy; never show `probeIntent`, control labels, model hypotheses, or prior reviewer scores.
- Calculate and check the mathematical references **before** human review. Show a separate machine-verified math-claim status in the analysis record rather than asking the user to compute a formula. A "no final result claim" status only means this bounded parser detected no task-final mathematical assertion, not that all content has been checked.
- Ask for diagnosis quality, actionable next step, scaffold fit, learner-owned operation or disclosure, and premature closure. Leave "not sure" possible.
- Present each selected task once. Do not create cosmetic near-duplicates or count variants as independent questions.
- Use at least two independent qualified educators for calibration, with their own separate raw submissions and explicit agreement/disagreement. Do not treat the present user's scores as expert gold.
- Do not send a new questionnaire automatically; review begins only after the research owner explicitly chooses to run it.
- If an unrecognized Tutor rephrasing is introduced, math status becomes `unverified`; it cannot be promoted into mathematical truth or a gold review packet until checked.

## Readiness

The structured references permit a bounded mathematical precheck for the twelve CURRENT synthetic replies. That is not proof of general math correctness automation. The practical next gate is independent educational review of a small, nonrepetitive group and comparison of operationally defined teaching dimensions, not another fourteen-arm duplication exercise.
