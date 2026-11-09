# Prerequisite accessibility contrasts — v0.1

Status: **candidate / non-canonical research design**. Internal single-reviewer
exploration motivated these hypotheses. The eight inputs below are newly
authored synthetic stimuli. They provide no independent expert consensus,
Gold, Judge calibration, or evidence of real student learning.

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

- **C-A.** Append “I know the small 2 in O₂ tells me about one oxygen molecule.
  I don't know what the number in front of a formula counts.”
- **C-B.** Append “I know the small 2 in O₂ tells me about one oxygen molecule.
  A number in front tells how many units of the entire formula I am counting.”

The sole variable is evidence about the meaning of the leading coefficient.
In C-A, bridge coefficient to a count of whole formula units and show the
effect on each element count. In C-B, use the stated meaning to get to the
atom inventory directly. Author check: `2Mg + O₂ → 2MgO` has two Mg and two O
atoms on each side. Changing `MgO` to `MgO₂` would change the formula.

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
