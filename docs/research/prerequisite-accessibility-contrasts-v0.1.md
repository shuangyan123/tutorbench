# Prerequisite accessibility contrasts — v0.1

Status: **candidate / non-canonical research design**. Internal single-reviewer
exploration motivated these hypotheses. The eight inputs below are newly
authored synthetic stimuli. They provide no independent expert consensus,
Gold, Judge calibration, or evidence of real student learning.

## Executable H1 fixtures (experimental only)

The eight H1 input/decision checkpoints are now materialized in the
[synthetic Scenario vNext suite](../../scenarios/experimental/prerequisite-accessibility-contrasts-v0.1/suite.json).
They use the **existing** Scenario vNext validator, TutorEval compiler, and
TutorEval runner; no new scoring category or runtime is introduced. Use the
existing `tutorbench health --suite-file <path>` input rather than extending
the canonical registered-suite list. The eight case IDs are
`pac-{m,p,c,b}-{a,b}`; each has one H1 decision and two atomic, Judge-owned
criteria (16 criteria total). The existing
[no-provider execution tests](../../tests/prerequisite-accessibility-contrasts.test.ts)
exercise the synthetic runner path and diagnostic-reference firewall.
A synthetic all-PASS Judge fixture proves plumbing only, not teaching quality.

The chemistry pair moves its identical O₂ prior-knowledge sentence into the
shared visible prompt, then varies only the coefficient-evidence suffix.
The other three pairs have a common prompt with an empty A evidence suffix
and a single added B learner-evidence suffix. The Tutor sees only the authored
student prompt, objective, and disclosure setting; expected behavior,
references, and failure-finding templates remain evaluator-only.

The H2 follow-up below and the four near-transfer prompts remain
**pre-authored research designs**, not additional executed turns or observed
learner outcomes. The cases have no real-model responses, independent subject
review, calibrated Judge scores, or human learning measurements. Do not merge
them into the canonical TutorEval or leaderboard cohort.

## Reuse and coverage

Reuse the [Case System vNext](../case-system-vnext.md) learner-state,
prerequisite, disclosure, and D/P/H authoring boundaries and its
[coverage matrix](../case-system-vnext-coverage-matrix.md). These annotations
describe proposed cases. Use the existing
[prerequisite-aware suite](../../scenarios/experimental/prerequisite-aware-instruction-v0.1/suite.json)
and the evidence contrasts in [Draft PR #349](https://github.com/shuangyan123/tutorbench/pull/349)
as prior designs for fractions. The new pairs change subject matter and retain
the evidence-span control. They neither depend on that branch nor duplicate its
matrix, projection code, or wording-invariance pair.

| Domain and concept family | Nearest reviewed public inventory | Decision |
| --- | --- | --- |
| Mathematics · implication and counterexample | Cinema seating distinguishes an event from its complement or choice set. Mathematics Challenge covers quadratic classification and conditional probability. | Use divisibility to isolate direction of implication without probability notation or equation solving. |
| Physics · voltage division in a series circuit | The executable pilot covers position–time graph interpretation. TutorEval covers force transfer, density, and graphs. | Use the link from a shared current to voltage across each component. |
| Chemistry · atom conservation in a symbolic reaction | The executable pilot and strategy profiles address rate factors and discriminating kinetics experiments. | Use particle counts and coefficients in a fixed reaction, with experimental design outside the task. |
| Biology · net water movement across a membrane | The executable pilot covers causal inference about plant growth. TutorEval covers photosynthesis. | Use a membrane model to distinguish bidirectional molecular motion from net flow. |

Eight initial Tutor inputs represent **four concept families, with two
contrasting starts per family**. The contrasts test sensitivity to visible
learner evidence under fixed tasks. They do not establish an effect of wording
length, domain coverage beyond these concepts, or general teaching competence.
The contrast tests whether a response uses the available evidence appropriately,
not whether the two arms receive different wording. A clear explanation can
legitimately serve both arms; repeated wording alone is not an Adaptation failure.

## Eight initial inputs

Each pair defines one shared prompt and two alternatives for its
learner-evidence span. For each input, concatenate the shared prompt with one
span. Hold the goal, scenario facts, disclosure, response language, and any
prior dialogue constant within a pair. D is content depth, P is pedagogical
difficulty, and H is the interaction horizon. All initial decisions are H1.
The headings, D/P/H labels, expected behaviors, and references below are
author-side. Give the Tutor the prompt and permitted disclosure instruction.

### M-A / M-B · Mathematics · Direction of implication

**Goal and prerequisites.** Test a divisibility implication using one
counterexample. Learners can recognize multiples using integer multiplication.
Use D2/P3/H1 and `hint_only`.

**Shared prompt.** “If a positive integer is divisible by 4, it is divisible by
2. Is the reverse statement always true? I answered yes. Can you help me test
it without giving me the counterexample?”

- **M-A.** Evidence span is empty. The cause of the incorrect answer is unknown.
- **M-B.** Append “My reason was that any rule that works in one direction must
  work in the other direction.” The learner has now stated the reversal rule.

The sole variable is whether a rationale is visible. In M-A, ask for the
reasoning or propose a test without diagnosing a specific misconception. In
M-B, address direction explicitly and invite the learner to compare a multiple
of 2 against both conditions. Author check: 6 is a counterexample to the
reverse, while the forward implication follows from `4k = 2(2k)`.

### P-A / P-B · Physics · Voltage division

**Goal and prerequisites.** Determine which resistor has the larger voltage
drop by relating the current through it to its resistance. Assume a steady
ideal circuit with ohmic resistors and a source, recognition of current and
resistance, and the ability to multiply. Use D2/P2/H1 and `hint_only`.

**Shared prompt.** “A 2-ohm resistor and a 4-ohm resistor are the only loads in
one closed loop with an ideal 6-volt battery. How can I tell which resistor has
the larger voltage drop? Give me a hint so I can choose.”

- **P-A.** Evidence span is empty. The basis for the next step has yet to be
  demonstrated.
- **P-B.** Append “There is only one path for charge, so both resistors carry
  the same steady current.”

The sole variable is visible correct local reasoning about current, with the
same request for the next step in both arms. In P-A, check or briefly bridge
the shared-current relation. In P-B, preserve it and connect each resistor's
voltage drop to its own resistance using `V = IR`. A useful hint makes clear
which quantity stays fixed in the comparison and lets the learner choose.
Author check: the current is 1 A, so the drops are 2 V and 4 V.

### C-A / C-B · Chemistry · Atom conservation

**Goal and prerequisites.** Explain how changing coefficients balances atoms
without changing the represented substances. Assume the learner can count
elements in a formula such as `O₂` and `MgO`. Use D2/P2/H1 and
`full_solution_allowed`.

**Shared prompt.** “I'm balancing `Mg + O₂ → MgO`. The instruction says to use
coefficients and keep the formulas. Can you show me why that works?”

- **C-A.** Append “I know O₂ represents one oxygen molecule containing two
  oxygen atoms. I don't know what a number in front of a formula counts.”
- **C-B.** Append “I know O₂ represents one oxygen molecule containing two
  oxygen atoms. A number in front counts the specified entities: molecules
  for O₂, formula units for MgO, and atoms for Mg.”

The sole variable is evidence about the meaning of the leading coefficient.
In C-A, explain that a coefficient counts the indicated chemical entities
(oxygen molecules for O₂, formula units for ionic MgO, or Mg atoms in this
particle-count representation), then show the effect on the atom inventory.
In C-B, preserve the stated distinction and proceed to atom counts without
re-teaching the coefficient from scratch. Author check: `2Mg + O₂ → 2MgO`
has two Mg and two O atoms on each side. Changing `MgO` to `MgO₂` would
change the formula, not balance the original reaction.

### B-A / B-B · Biology · Net flow across a membrane

**Goal and prerequisites.** Explain net water movement in an idealized osmosis
setup. Assume the learner can distinguish water from dissolved solute and
compare concentrations. Use D2/P2/H1 and `full_solution_allowed`.

**Shared prompt.** “Two compartments begin at equal hydrostatic pressure and
temperature. The membrane lets water through but blocks the dissolved solute.
There is dilute solution on the left and concentrated solution on the right,
with the same solute on both sides. My notes say water initially moves to the
right. What does this mean?”

- **B-A.** Evidence span is empty. The learner asks for the meaning of the
  directional statement.
- **B-B.** Append “If the membrane lets water through, couldn't some water
  molecules also cross from right to left?”

The sole variable is an explicit, valid objection. In B-A, explain what
direction refers to. In B-B, explicitly affirm the objection and distinguish
molecular crossings in both directions from the difference in crossing rates.
The simplified setup assumes passive movement. Author check: initially the
net flow is to the more concentrated side, even though individual crossings
are possible in both directions.

## Follow-up and independent checks

For a later, separately scoped **Tutor follow-up**, take the actual first
Tutor reply to B-B and preserve it verbatim. When the reply leaves the
individual-versus-net distinction unresolved, send this pre-authored question
in the same session: “When you say ‘moves to the right’, could the membrane
still let water cross both ways? What would you have to count to tell whether
there was net movement?” Collect the Tutor's actual second reply. Compare the
specific explanation before and after the question. Record whether the Tutor
repaired the bridge, reiterated the direction, or introduced a new error. If
the first reply already explains the distinction, record repair as not
applicable. A missing or failed reply is unobserved. The question is synthetic,
even when the two Tutor replies are actually collected. This is a proposed
short H2 trajectory. Collection and execution are outside this draft.

The [Learner Starting Points protocol](learner-starting-point-and-learning-cost-v0.1.md)
already defines baseline, immediate, near-transfer, and delayed checkpoints.
Reserve these new near-transfer prompts for uncued work. Hide author references
from the learner and Tutor until after the attempt. A hint before the attempt is
a protocol deviation. A real learner response, if later authorized and
collected, supports only the bounded performance observed. An authored or
simulated answer leaves outcomes unmeasured.

| Family | Uncued prompt | Author-only check |
| --- | --- | --- |
| Mathematics | Every multiple of 9 is a multiple of 3. Does the converse hold? Explain with an example or argument. | 6 is a multiple of 3 and not of 9. |
| Physics | An ideal battery drives one closed loop with a 1-ohm and a 3-ohm resistor. Compare their voltage drops and explain your reasoning. | Drops are in the ratio 1:3 because the steady current is shared. |
| Chemistry | Balance `H₂ + O₂ → H₂O` and explain which element counts changed as you chose coefficients. | `2H₂ + O₂ → 2H₂O` gives four H and two O atoms on each side. |
| Biology | In one minute 15 water molecules cross a membrane left-to-right and 22 cross right-to-left. Describe what happened in each direction and overall. | Both directions have traffic, with seven net crossings to the left. |

The biology transfer prompt checks **bidirectional crossing and signed net
counting only**. It does not independently test why a concentration gradient
causes osmosis, water potential, or the learner's ability to predict direction
in a new physical setup. Do not report the result as general osmosis mastery.

## Acceptable alternative explanations and adverse controls

These are response-review anchors, not required phrases or a single answer
script. An equally correct alternative is acceptable if it addresses the
observed learner need and respects `hint_only` or `full_solution_allowed`.

| Family | Acceptable teaching routes | Unacceptable inference or behavior |
| --- | --- | --- |
| Mathematics | Test multiples methodically, reason about set inclusion, or use `4k = 2(2k)` to contrast directions, leaving the learner to supply the counterexample. | Infer an unstated reversal rule in M-A, affirm the false converse, or disclose the counterexample despite `hint_only`. |
| Physics | Start from the single-path current, use `V = IR`, or reason with voltage-drop ratios proportional to resistance, without giving the learner the final comparison. | Assume series resistors have equal voltage drops, discard the correct P-B current reasoning, or complete the learner's requested choice under `hint_only`. |
| Chemistry | Count atoms with a table, particle sketch, or stepwise coefficient comparison; distinguish O₂ molecules from ionic MgO formula units. | Change a subscript to balance the reaction, confuse molecular count with atomic count, or treat an MgO formula unit as a separate MgO molecule. |
| Biology | Explain molecular crossings in both directions, net flux as a difference of rates, or use a two-way traffic analogy with its limitations. | Claim no water can cross from concentrated to dilute solution or confuse net direction with every molecule's direction. |

Assess the **observable teaching decision**, not surface variation. A response
can be suitable for both arms even if its wording is similar. A missing
prerequisite bridge, failure to use demonstrated reasoning, unsupported
diagnosis, and explicit scientific error require distinct evidence; do not
penalize one act under several rubric labels.

## Review protocol and limits

Freeze prompt versions and reference reasoning before collecting anything.
Independently review subject correctness and acceptable alternative teaching
moves before studying Tutor behavior. Separate each observed act into one
primary TutorEval category, using the existing
[TutorEval and disclosure semantics](../tutor-eval-v0.2a.md). A single missing
bridge can inform several principles while staying one Guidance observation.
An explicit false claim has its own correctness review. Disallowed solution
disclosure follows the case policy.

For a later review, interleave concept families, counterbalance pair-arm order
across reviewers, and log prior exposure, order, and newly noticed
interpretations separately from frozen labels. Keep a paraphrase test in a
separate control block if needed. Natural-language evidence spans change
length and phrasing as well as what is conveyed. A single small review could
identify failure modes and justify revising these stimuli. Follow the
[measurement claim specification](../measurement-claim-specification.md)
for evidence limits and report learner outcomes as unmeasured.
