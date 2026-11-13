# Learner evidence and hint fit pilot v0.1

**Experimental · Offline · Exploratory observation**

The [2026-11-13 maintainer review](learner-evidence-hint-maintainer-review-v0.1.json)
records the original learner quote, the maintainer's judgment, its scope and
open questions. It binds three recorded DeepSeek replies by corpus hash and
response identity. The final replies and detailed replay stay in ignored
`artifacts/real-model/`.

The historical hint case has separate next-step, learner-agency and
answer-disclosure criteria. The first two describe desirable reply behavior
without conditions for demonstrated prior work, an unresolved difficulty or
the effect of a previous hint. Its `knownConcepts: ["逆运算"]` is an authored
profile field. Independent application requires an actual work sample.

## Contrasts

All three checkpoints use the learner request, learning objective, locale and
hint-only policy from `hint-only-linear-equation-001-zh-CN@1.1.0` in
`tutor-eval-v0.2a@0.2a.6`. B and C add synthetic dialogue. The contrast
cases leave the optional Tutor-visible known-concepts list empty.

| Condition | Observed evidence | Bounded interpretation | Reasonable moves |
| --- | --- | --- | --- |
| A · Unknown | Learner turn 1 is the original request. | Being stuck leaves the cause, inverse-operation skill and equality understanding unknown. | Ask what undoes +3 or name subtraction on both sides. Leave the calculation open. |
| B · Local understanding | Learner turn 1 gives a correct worked example on `x + 2 = 7` before any help in the authored history. Learner turn 2 is the original request. | One local inverse-operation success. Understanding why the operation preserves equality remains unknown. | Prompt transfer or name the operation while leaving a calculation or self-explanation to the learner. A reply can fit the evidence without explicitly citing the previous problem. |
| C · Unresolved difficulty | Message 2 gives the inverse-operation hint. Learner turn 2, message 3, says why both sides need subtraction is unclear and the hint did not help. Learner turn 3 is the original request. | Explicit difficulty with preservation of equality, and a reported failure of this hint. Independent inverse-operation skill remains unknown. | Explain why matching operations preserve equality, or guide a concrete comparison of changing one side versus both. Leave a step to try. |

The authoring distinctions come from [PR #349 at its reviewed head](https://github.com/shuangyan123/tutorbench/blob/4b199e8fbf1eee73976e407478ebb2795c75eb68/src/experiments/learner-state-evidence.ts).
That draft's matrix parser has fixed fraction-case and concept allowlists. This
pilot adapts its quote inclusion and status/kind checks for the three cases,
with evidence-free `unknown` claims and a separate check on who spoke the
failed hint and when. It uses the
[prerequisite-aware suite](../prerequisite-aware-teaching-evaluation.md)
as the authoring precedent, the vNext compiler for case and Tutor input
projection, and `indexScenarioLearnerEvidence` for source and checkpoint
identity. The [integration ledger](../architecture-integration-ledger-v0.1.md)
and [crosswalk](../architecture-integration-map.md) define those ownership
boundaries. The two concepts refer to skills within the existing mathematics
knowledge-map node `linear-equations`; their statuses describe these
utterances only.

The vNext trajectories in
[`learner-evidence-hint-scenarios.ts`](../../src/research/learner-evidence-hint-scenarios.ts)
own the learner and prior Tutor dialogue. The evidence records point back to
those turns and carry exact quotes. The candidate rubric uses the validated
claims and prior-help link to select the relevant decision boundary. Tutor
input is projected through `toTutorTurnInput`. It carries the dialogue and
goal and uses case IDs without evidence labels. The claims, prior-help
interpretation, rubric, and maintainer judgment
stay on the evaluation side.

## Run

```powershell
npm run build
node --test dist/tests/learner-evidence-hint-pilot.test.js
node scripts/research/learner-evidence-hint-pilot.mjs
node scripts/research/learner-evidence-hint-pilot.mjs --frozen
node scripts/research/learner-evidence-hint-pilot.mjs --before-after
```

The default replay prints synthetic controls and traces. The optional frozen
replay requires the three original `*.complete.corpus.json` files from the
[DeepSeek effort pilot](deepseek-three-efforts-tutor-pilot-v0.1.md). It
validates the bytes, corpus metadata, case version and final response hash
before evaluation. It writes a private trace with exact response excerpts
using exclusive creation. A repeat with byte-identical output succeeds and
preserves the file. Missing or altered input fails before any report write.
The terminal lists only the effort, condition and verdict for each private
row. Neither command invokes a Tutor, provider or Judge.

`learner-evidence-hint-fit@0.1.0` emits a single experimental
`PASS`, `FAIL` or `ABSTAIN` per pair, with the applicable alternatives,
prohibited inferences, evidence locators, reasons and literal excerpts. The
existing direct-answer evaluator acts as a guard inside this single verdict.
There is no score or aggregation. The pilot has no default registry, public
API export, Tutor Health, or publication integration.

## Results and interpretation

The [Before / After Measurement Report](learner-evidence-hint-before-after-v0.1.md)
tracks baseline provenance, comparison eligibility, and limits on accuracy claims.

The synthetic cases include direct and indirect first steps, explicit transfer,
two ways to address preservation of equality, unsupported learner diagnoses,
a disclosed answer, and mixed or ambiguous text. Their expected decisions are
author-written regression controls across 14 replies and 42 decisions. The original frozen corpus produced one
reply per effort for the historical case. Each reply was replayed under all
three contrasts. The nine cells are counterfactual rubric decisions.

| Reply | A · Unknown | B · Local understanding | C · Unresolved difficulty |
| --- | --- | --- | --- |
| Low | PASS | PASS | FAIL |
| High | PASS | PASS | FAIL |
| Max | PASS | PASS | FAIL |

In B the replies leave the first calculation open. The pilot detected no
explicit reference to the prior work in these three replies. In C they did
not supply the equality-preservation support this rubric can recognize.
The same core hint can therefore be a reasonable next move in A or B and
insufficient in C. This replay establishes the behavior of the candidate
rules under the authored evidence conditions.

The [promotion policy](../research-promotion-policy-v0.1.md) supports
maintainer use of the review record, three checkpoint fixtures and trace
format for experimental review. The Chinese text signals are narrow and
can miss valid paraphrases, implicit opportunities to try or other valid
scaffolds. They can also accept a flawed explanation that happens to
match a phrase, miss an unsupported diagnosis or indirect disclosure,
or over-read a quoted phrase. `ABSTAIN` routes unresolved signals to human
review. Independent review of alternatives, matched paraphrases and
contradictory examples is still needed before expanding the rule coverage
or proposing canonical adoption. There is no calibration, effort ranking
or learning-outcome evidence here.
