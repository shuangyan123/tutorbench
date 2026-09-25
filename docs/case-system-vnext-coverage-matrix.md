# Case System vNext — Core Coverage Matrix

Status: **authoring plan / no cases in this matrix are canonical yet**

This matrix defines a balanced first target for Case System vNext. The cells
are **archetypes**, not yet benchmark records. They are intended to force depth
within each discipline before case-count expansion.

The matrix is paired with
[Case System vNext — Methodology Specification](case-system-vnext.md).

## Matrix rules

- Five initial discipline profiles.
- Five content-depth levels per discipline.
- Each cell names one core problem / task archetype.
- A cell may later yield multiple learner-state and trajectory variants.
- Difficulty must also carry an independent Pedagogical Difficulty (P1–P5)
  and Interaction Horizon (H1–H3).
- "Human-optimal" reasoning is only authored where the discipline and task make
  that concept defensible.
- Open-ended domains may instead define evidence-efficient, reasoning-efficient,
  or revision-efficient reference strategies.
- The matrix is coverage scaffolding, not evidence of representativeness or
  construct validity.

## 25-cell core depth matrix

| Discipline | D1 — Direct / routine | D2 — Single-concept application | D3 — Integrated multi-step | D4 — Strategy / structural reasoning | D5 — Synthesis / proof / open reasoning |
| --- | --- | --- | --- | --- | --- |
| **Mathematics** | Arithmetic representation and routine equivalence | Proportional / fraction concept application | Multi-step algebra with intermediate-state diagnosis | Compare solution strategies and exploit structure | Proof, generalization, or derive a reusable method |
| **Science** | Interpret a direct scientific representation or fact | Apply one causal / conservation concept | Coordinate variables across a multi-step explanation | Choose an experimental test and control confounds | Compare models or design an investigation from incomplete evidence |
| **Programming** | Trace a short program or identify a local syntax/semantic error | Repair one local bug using a known construct | Debug interacting state across several operations | Select data structure / algorithm and justify complexity trade-offs | Derive or adapt an algorithm for an unfamiliar problem family |
| **Language / Writing** | Correct a local sentence-level issue | Revise one paragraph for a clear purpose | Integrate evidence and maintain argument coherence | Compare revision strategies for audience, structure, and evidence | Synthesize sources into a defensible original argument or transformation |
| **History / Social Science** | Identify an explicit source fact / chronology | Connect one claim to supporting evidence | Build a multi-cause explanation with sourced evidence | Corroborate sources and evaluate competing causal accounts | Synthesize conflicting evidence / interpretations with explicit uncertainty |

## Pilot selection: 15 archetypes

Before populating all 25 cells, the first implementation pilot should select
three depth positions per discipline: **D1, D3, and D5**.

This deliberately tests the ends and middle of the depth ladder before filling
D2 and D4.

| Discipline | D1 pilot | D3 pilot | D5 pilot |
| --- | --- | --- | --- |
| Mathematics | routine equivalence / representation | multi-step algebra diagnosis | proof / generalization / reusable method |
| Science | direct representation interpretation | multi-variable causal explanation | experimental design / competing models |
| Programming | trace / local defect | stateful debugging | algorithm derivation / general solution |
| Language / Writing | sentence-level revision | evidence-integrated argument repair | multi-source synthesis |
| History / Social Science | source fact / chronology | sourced multi-cause explanation | conflicting-source synthesis |

The pilot is expected to create **15 core task structures**, not necessarily
only 15 final scenarios. Selected archetypes may have several learner-state
variants.

## Discipline-specific depth anchors

### Mathematics

**D1 — Routine representation**

Candidate form: convert, compare, or verify a familiar representation where
the main teaching risk is overhelping or failing to check the learner's
understanding.

**D2 — Single-concept application**

Candidate form: proportional reasoning, fraction magnitude, signed quantities,
or one known geometric relationship in a new surface form.

**D3 — Integrated multi-step reasoning**

Candidate form: multi-step equation, function interpretation, geometry chain,
or probability calculation where the learner has a localized but consequential
intermediate error.

**D4 — Strategy / structure**

Candidate form: choose between expansion, factoring, symmetry, substitution,
graphical reasoning, or another valid method and justify the human-efficient
choice under the learner's prerequisites.

**D5 — Proof / generalization**

Candidate form: prove a relation, derive a formula, identify a counterexample,
or move from an efficient instance solution to a reusable general method.

Human-optimal instance and general strategies are strongly applicable here.

### Science

**D1 — Direct interpretation**

Candidate form: read a graph, identify a variable, interpret a basic model, or
state an observed relationship without adding unsupported explanation.

**D2 — Single-concept application**

Candidate form: apply conservation, force, energy, cell function, equilibrium,
or another known principle to one changed context.

**D3 — Integrated causal reasoning**

Candidate form: explain an outcome that requires coordinating several variables
or separating correlation from a plausible mechanism.

**D4 — Experimental strategy**

Candidate form: choose controls, isolate a variable, identify confounds, or
compare experimental designs.

**D5 — Model / investigation synthesis**

Candidate form: reason across incomplete or conflicting evidence, compare
models, or design an investigation with uncertainty and limitations.

"Optimal" is usually about evidence-efficient reasoning or investigation
design, not merely shortest algebraic steps.

### Programming

**D1 — Trace / local defect**

Candidate form: trace a short program, identify a type/syntax/semantic issue,
or explain one local state change.

**D2 — Known-construct repair**

Candidate form: repair a loop, function, conditional, or collection operation
using a familiar construct.

**D3 — Stateful debugging**

Candidate form: locate a bug across several operations, mutable state, async
control, recursion, or interacting functions.

**D4 — Strategy and complexity**

Candidate form: choose a data structure or algorithm based on constraints and
explain time/space trade-offs.

**D5 — Algorithmic generalization**

Candidate form: derive an efficient reusable algorithm for a problem family,
justify complexity, and distinguish an instance trick from a general solution.

Human-optimal general strategies are applicable, but compact code alone is not
evidence of human-understandable reasoning.

### Language / Writing

**D1 — Local revision**

Candidate form: grammar, punctuation, sentence clarity, or a directly stated
style constraint.

**D2 — Purposeful paragraph revision**

Candidate form: improve focus, topic sentence, transitions, or evidence
placement for one explicit communicative goal.

**D3 — Argument coherence**

Candidate form: diagnose reasoning gaps across claims, evidence, warrant, and
counterargument.

**D4 — Revision strategy**

Candidate form: compare two plausible restructurings for a given audience,
genre, or purpose and justify the stronger revision plan.

**D5 — Synthesis**

Candidate form: combine multiple sources or perspectives into a defensible
original argument while preserving evidence boundaries and uncertainty.

A single "optimal wording" should not be assumed. Reference strategy should
usually be represented as a set of acceptable reasoning / revision moves.

### History / Social Science

**D1 — Explicit source interpretation**

Candidate form: identify an explicit fact, chronology, speaker, institution, or
claim without importing unsupported context.

**D2 — Claim-evidence connection**

Candidate form: connect one historical/social claim to a source passage,
statistic, or documented event.

**D3 — Multi-cause explanation**

Candidate form: construct or repair a causal explanation using several evidence
types while distinguishing trigger, condition, and consequence.

**D4 — Source corroboration**

Candidate form: compare provenance, incentives, perspective, and consistency
across sources before deciding what the evidence supports.

**D5 — Competing interpretation synthesis**

Candidate form: synthesize conflicting evidence or scholarly interpretations,
state uncertainty, and explain what would change the conclusion.

No single answer string or shortest-step solution should be forced onto
contested interpretive tasks.

## Learner-state variant plan

Each selected archetype should deliberately vary learner state. The pilot does
not need every state in every cell, but the aggregate should cover at least:

- novice / missing prerequisite;
- partial understanding;
- procedural error;
- conceptual misconception;
- repeated failure;
- false confidence;
- uncertainty despite correct work;
- partial progress;
- near mastery.

A high-value counterfactual pattern is to keep the underlying task fixed while
changing learner state, so the benchmark can test whether the Tutor changes
its teaching action rather than merely recognizing the problem.

## Human-optimal reasoning coverage

The 15-case pilot should include at least:

- four cases with a meaningful distinction between a human-optimal instance
  strategy and a human-optimal general strategy;
- four cases where a valid but unnecessarily mechanical route is possible;
- three cases where an efficient method would be inappropriate because it
  exceeds the learner's prerequisites;
- three cases where multiple strategies are defensibly tied and the evaluator
  must not force one gold method;
- several open-ended cases where "optimal solution" is explicitly marked not
  applicable and the reference instead focuses on evidence quality or revision
  strategy.

These counts are authoring targets, not statistical validation targets.

## Transfer coverage

The pilot should include:

- near-transfer targets for every discipline;
- far-transfer targets for at least one D5 case in every discipline;
- explicit claim language that evaluates transfer-supporting behavior rather
  than realized learner transfer.

## Evaluator stress tests before expansion

Before moving from the 15-case pilot to the complete 25-cell matrix, test
whether the evaluator can reliably distinguish the following response pairs:

1. correct but unnecessarily mechanical vs. human-efficient and understandable;
2. efficient and justified vs. compressed but opaque;
3. instance-optimal shortcut vs. valid general method;
4. elegant general method vs. method that exceeds learner prerequisites;
5. good current-task guidance vs. guidance that also supports justified
   generalization;
6. one defensible strategy vs. another equally defensible strategy.

If these distinctions are unstable, improve the evaluator and authoring
guidelines before increasing case volume.

## Expansion gate

The full 25-cell core matrix should not be considered ready merely because all
cells contain content.

Expansion requires:

- consistent authoring review across discipline profiles;
- explicit prerequisite boundaries where reasoning efficiency is scored;
- no hidden-evaluator evidence crossing the Tutor boundary;
- clear criteria for cases with multiple valid strategies;
- calibrated or explicitly uncalibrated evaluator ownership;
- coverage reporting that distinguishes breadth from validation;
- no claim that the matrix is representative of all tutoring tasks.

The intended outcome is a coherent, inspectable **case space**, not a larger
prompt collection.
