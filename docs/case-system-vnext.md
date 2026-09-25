# Case System vNext — Methodology Specification

Status: **design specification / not yet an implemented schema**

This document defines the next authoring model for TutorBench cases. It does
not change the frozen `tutor-eval-v0.2a` corpus, current evaluator semantics,
Tutor Health scoring, release gates, or public claims.

The purpose of Case System vNext is to move from a small collection of
mechanism-validation cases toward a deliberately structured tutoring case space
with clearer disciplinary coverage, depth gradients, learner-state variation,
multi-turn evidence, and reference reasoning.

It also introduces a bounded notion of **human-optimal reasoning**. The target
is not model-internal search efficiency. TutorBench evaluates learner-visible,
human-executable reasoning paths.

## Why this is needed

The current canonical English TutorEval cohort contains 24 authored case
designs across five subjects, but its task difficulty is concentrated in the
middle of the scale and contains no task-difficulty-5 case. The current
13-scenario Productive Struggle & Intervention Tutor Health suite is entirely
mathematics-focused and primarily covers upper-primary / early-algebra
situations.

Those assets remain useful for reproducibility and mechanism validation. They
do not by themselves provide a balanced cross-disciplinary depth ladder.

The September 2026 external research audit also identified broader
cross-domain coverage, multi-axis difficulty, discipline-specific evidence
norms, and episode-level evidence as research candidates. This specification
turns those candidates into an explicit authoring proposal without silently
changing historical benchmark semantics.

## Non-goals

Case System vNext does **not**:

- claim validated general tutoring competence;
- claim measured learning outcomes or causal learning gains;
- replace real learner studies with simulated transfer;
- treat more cases as proof of construct validity;
- require one universal teaching policy across disciplines;
- require every task to have a unique final answer;
- equate model inference speed, token count, hidden search, or tool-call count
  with solution quality;
- force an "optimal solution" concept onto open-ended tasks where it is not
  meaningful.

## Core information model

```text
Case Archetype
├── Audit-seeded Domain Profile
├── Content Depth
├── Pedagogical Difficulty
├── Interaction Horizon
├── Learner State
├── Prerequisite Boundary
│
├── Problem / Task Reference
│   ├── accepted outcomes
│   ├── constraints
│   └── domain evidence requirements
│
├── Reference Reasoning
│   ├── human-optimal instance strategy
│   ├── human-optimal general strategy
│   ├── effective human reasoning steps
│   ├── key insight
│   ├── applicability
│   ├── required prerequisites
│   ├── alternative human-valid strategies
│   └── avoidable detours
│
├── Teaching Reference
│   ├── expected teaching decision
│   ├── disclosure boundary
│   ├── scaffolding / fading path
│   ├── escalation policy
│   └── acceptable strategy set
│
└── Transfer Reference
    ├── near-transfer target
    └── far-transfer target
```

Not every field is required for every discipline. A `DomainProfile`
determines which reference fields are meaningful.

## 0.1 Domain taxonomy source

The first-level domain taxonomy is seeded from section 5.2 of the external
**TutorBench Evaluation Framework / Pedagogy Taxonomy Research Audit**
(2026-09-11), which proposed a 23-domain coverage matrix. That matrix is used
as a research-backed design seed, not as a validated measurement ontology.

The 23 domain seeds are:

Mathematics; Statistics; Physics; Chemistry; Biology; Earth / environmental
science; Computer science; Engineering; Medicine / health sciences;
Psychology; Economics; Sociology; Political science / civics; History; Law;
Philosophy; Languages / second-language learning; Literature; Writing /
rhetoric; Business / finance / accounting; Arts / music / design; Vocational /
procedural education; Interdisciplinary / emerging fields.

These domains define the first subject-level evidence norms. They are then
refined into specializations, practices, task families, and exact archetype
strategy profiles. A broad family such as "science" is not a final strategy
scope.

The source disposition remains **design preference / pending expert
validation**. TutorBench must not describe the 23-domain matrix as a validated
educational taxonomy or calibrated scale.

## 1. Domain Profile

A domain profile captures first-level evidence and reasoning norms. The initial
domain vocabulary is the audit-seeded 23-domain matrix above rather than a
five-bucket `science / programming / language-writing / social-science`
shortcut.

A profile may define:

- what counts as valid evidence or a valid response;
- what kinds of reasoning are material in that domain;
- whether a unique answer is expected;
- whether algorithmic / procedural efficiency is meaningful;
- acceptable forms of explanation or representation;
- domain-specific reliability checks;
- domain-specific teaching risks;
- domain-specific transfer expectations.

The domain layer is still not the final strategy layer. Physics, Chemistry,
Biology, Computer Science, History, Writing/Rhetoric, and other domains may
require further specialization before a strategy preference is justified.

## 1.1 Strategy adaptation is task-specific

The broad discipline-family field is a coverage and organization label. It does
**not** define one universal strategy policy.

Case System vNext uses layered rules:

```text
shared base evaluation rules
  -> discipline family
     -> concrete subject
        -> specialization / language / branch
           -> practice or task family
              -> archetype
                 -> task-specific strategy profile
```

Examples:

```text
natural_sciences -> physics -> mechanics -> quantitative_problem_solving
natural_sciences -> chemistry -> organic_chemistry -> mechanism_explanation
natural_sciences -> biology -> genetics -> causal_modeling

computing -> computer_science -> python -> debugging
computing -> computer_science -> java -> object_oriented_design
computing -> computer_science -> rust -> ownership_and_borrowing

humanities_social_sciences -> history -> source_analysis -> corroboration
language_arts -> composition -> argumentative_writing -> source_synthesis
```

"Writing" is therefore treated primarily as a cross-cutting practice/task
family rather than as one academic discipline. Likewise, "science" is a family:
physics, chemistry, biology, earth science, and other subjects require their
own subject-level profiles. Programming-language-specific instruction may also
require Python-, Java-, Rust-, JavaScript-, or other language-specific profiles.

For example, `programming` must not imply one programming-wide notion of an
optimal strategy. An algorithm-design profile may care about correctness,
complexity, and reusable algorithmic insight, while a debugging profile may
instead care about fault localization, evidence, patch minimality, and
regression risk. Those profiles must be authored separately.

Likewise, an experimental-design profile in empirical science, a quantitative
physics problem, a chemistry mechanism explanation, and a biological causal
model should not inherit one generic `science` strategy ranking.

The same rule applies to writing and the humanities: argumentative source
synthesis, sentence revision, literary interpretation, historical
corroboration, and policy analysis require different strategy references.

A task-specific profile may use one of several evaluation modes:

- ordered preference when the authored constraints support a defensible
  ordering;
- Pareto trade-off when strategies optimize competing dimensions;
- acceptable strategy set when multiple approaches are defensible;
- no strategy ranking when ranking itself is not meaningful.

This keeps "human-optimal instance/general strategy" as a valid construct for
tasks where it is defensible, rather than a universal cross-disciplinary
assumption.

## 2. Content Depth: D1–D5

Content depth describes the intellectual depth of the task itself. It is
separate from how difficult the teaching decision is.

| Level | Authoring anchor |
| --- | --- |
| **D1 — Direct / routine** | Recall, identify, execute a familiar single-step procedure, or interpret an explicit representation. |
| **D2 — Single-concept application** | Apply one known concept in a non-identical but straightforward situation. |
| **D3 — Integrated multi-step reasoning** | Coordinate multiple concepts or steps, diagnose a nontrivial error, or maintain a coherent intermediate state. |
| **D4 — Strategy selection / structural reasoning** | Choose among plausible methods, explain why one is preferable, compare strategies, or transfer a principle to a meaningfully changed problem. |
| **D5 — Synthesis / proof / open reasoning** | Construct or critique a proof, design an investigation, synthesize competing evidence, derive a general method, or solve an unfamiliar problem requiring a new representation or abstraction. |

These anchors are ordinal authoring labels, not a validated psychometric scale.

## 3. Pedagogical Difficulty: P1–P5

Pedagogical difficulty describes how hard it is to choose an appropriate
teaching action for the authored learner state.

| Level | Authoring anchor |
| --- | --- |
| **P1 — Direct feedback** | Correct or confirm a clear response with little ambiguity about the next teaching action. |
| **P2 — Bounded support** | Provide a small hint, explanation, or check aligned with an explicit learner request. |
| **P3 — Diagnosis-dependent support** | Distinguish procedural error, knowledge gap, or misconception before deciding what help to give. |
| **P4 — Adaptive trade-off** | Balance productive struggle, escalation, fading, confidence, frustration, or competing valid teaching moves. |
| **P5 — Multi-objective teaching judgment** | Balance several pedagogical goals under uncertainty, including disciplinary norms, learner history, strategy choice, and possible transfer. |

A D1 task can be P4. A D5 task can be P2. They must not be collapsed into one
difficulty field.

## 4. Interaction Horizon: H1–H3

| Level | Definition |
| --- | --- |
| **H1 — Response** | One learner state and one evaluated Tutor response. |
| **H2 — Short trajectory** | Several authored turns establish attempts, hints, or state changes before the evaluated decision. |
| **H3 — Episode** | Multiple consequential decision points across a sustained tutoring episode, with explicit state transitions and evidence carried forward. |

Current scenario v3 supports authored trajectories but generally evaluates one
Tutor decision point at a time. H3 is therefore a design target, not a claim
that the current runner already performs autonomous learner episodes.

## 5. Learner State

Learner state must be evidenced by authored learner behavior, not inferred from
hidden model assumptions alone. Candidate states include:

- novice;
- partial understanding;
- procedural error;
- conceptual misconception;
- repeated failure;
- false confidence;
- uncertainty despite correct work;
- frustration / disengagement signal;
- partial progress;
- near mastery;
- independent success / transfer readiness.

A case archetype may have several learner-state variants. Reusing the same
knowledge problem across distinct learner states is preferred to inventing many
unrelated questions when the goal is to test adaptation.

## 6. Prerequisite Boundary

Every case that evaluates reasoning efficiency must state what knowledge and
methods are available to the learner.

This prevents an advanced theorem, library call, memorized trick, or compressed
identity from being labeled "optimal" merely because it shortens the visible
solution.

A prerequisite boundary may include:

- concepts already learned;
- procedures already practiced;
- representations the learner can use;
- domain conventions already introduced;
- tools or libraries allowed;
- methods explicitly out of scope.

Optimality is always conditional on this boundary.

## 7. Human-optimal reasoning

### 7.1 Human-optimal instance strategy

A **human-optimal instance strategy** is a correct reasoning path for the
specific task that, under the stated prerequisite boundary:

- is human-understandable;
- is human-executable;
- is locally verifiable;
- avoids unnecessary reasoning steps;
- avoids avoidable mechanical work when an accessible structural insight exists;
- does not rely on hidden brute force or unexplained black-box computation.

The target is the learner-visible reasoning path, not model internals.

### 7.2 Human-optimal general strategy

A **human-optimal general strategy** is a broadly applicable method for a
defined class of problems that, under the stated prerequisite boundary:

- works across the declared problem family;
- does not depend on an accidental feature of the current instance;
- keeps human reasoning steps and branch choices low;
- is explainable and reproducible by a learner;
- exposes a reusable structure or principle;
- supports transfer to new instances.

The general strategy may be less efficient for a specially structured instance
than the instance-optimal strategy.

### 7.3 No forced uniqueness

"Optimal" is not assumed to be unique.

A case may record:

- one preferred reference strategy;
- a tied set of human-optimal strategies;
- several near-optimal strategies;
- uncertainty or disagreement about optimality.

If experts cannot justify a stable ordering, the case must not fabricate one.
The evaluator should instead assess bounded properties such as avoidable
detours, prerequisite compatibility, structural insight, or transfer support.

### 7.4 Effective Human Reasoning Steps

Case authors may annotate **Effective Human Reasoning Steps (EHRS)**.

One EHRS is one meaningful cognitive move that a prepared learner could
understand and execute, such as:

- recognizing a relevant structure;
- applying a known theorem or rule;
- making a meaningful algebraic transformation;
- choosing a data structure from a requirement;
- introducing a useful representation;
- making a justified case split;
- connecting evidence to a claim;
- abstracting a specific result into a general rule.

EHRS is **not**:

- number of output tokens;
- number of lines;
- number of model reasoning tokens;
- number of arithmetic keystrokes;
- number of tool calls;
- hidden search-tree size.

EHRS is initially an authoring aid and diagnostic annotation, not a calibrated
numeric score.

## 8. Three different notions of "best"

These must remain separate:

```text
human-optimal instance strategy
        ≠
human-optimal general strategy
        ≠
pedagogically optimal teaching path
```

A Tutor can therefore be:

- correct but unnecessarily mechanical;
- efficient for the instance but non-generalizable;
- general and elegant but above the learner's prerequisites;
- mathematically / computationally efficient but pedagogically opaque;
- pedagogically appropriate even when it intentionally does not reveal the
  shortest solution immediately.

This separation is central to the vNext design.

## 9. Reference Reasoning

A candidate future representation is:

```yaml
referenceReasoning:
  prerequisiteBoundary:
    knownConcepts: []
    allowedMethods: []
    excludedMethods: []

  humanOptimalInstanceStrategies:
    - id: ...
      keyInsight: ...
      effectiveReasoningSteps: 3
      assumptions: []

  humanOptimalGeneralStrategies:
    - id: ...
      appliesTo: ...
      keyInsight: ...
      effectiveReasoningSteps: 4
      assumptions: []

  alternativeHumanValidStrategies:
    - id: ...
      tradeoffs: ...

  avoidableDetours:
    - ...

  machineSearchCost: out_of_scope
```

This is a design sketch, not an approved contract.

## 10. Teaching Reference

Reference reasoning does not prescribe the Tutor's full response.

A teaching reference should define the decision boundary instead:

- what the learner should be invited to notice;
- what information may be disclosed now;
- what should remain learner-owned;
- whether support should escalate or fade;
- when a more efficient strategy should be introduced;
- when the general method should be surfaced;
- when introducing the optimal method would exceed prerequisites;
- which alternative teaching strategies are acceptable.

The evaluator should prefer an acceptable strategy set over one gold-response
string.

## 11. Reasoning & Transfer evaluation candidate

Case System vNext proposes a future reporting area tentatively called
**Reasoning & Transfer**. It is not yet an eighth Tutor Health dimension.

Possible observable criteria include:

- human-efficient reasoning;
- structural insight;
- prerequisite compatibility;
- strategy appropriateness;
- generalization support;
- distinction between a special case and a general rule;
- near-transfer support;
- far-transfer support where the domain profile makes that meaningful.

Candidate Findings include:

- **Missed human-efficient strategy** — a materially simpler accessible
  reasoning path was available.
- **Brute-force explanation** — the visible method relies on exhaustive or
  unnecessarily mechanical work despite an accessible structural method.
- **Opaque shortcut** — the method is compressed but not justified at the
  learner's prerequisite level.
- **Generalization opportunity missed** — the instance is solved efficiently
  but the reusable structure is not exposed when the teaching policy calls for it.
- **Special case presented as a general rule** — a local trick is overgeneralized.
- **Efficient method introduced too early** — the method is valid but exceeds
  the learner's current prerequisite boundary.

These Findings require evaluator validation before production use.

## 12. Transfer

Transfer is represented as an authored opportunity, not as an observed
learning outcome.

### Near transfer

A new task preserves the core structure while changing surface details.

### Far transfer

A new task changes representation or context while preserving the underlying
principle.

A Tutor response may be evaluated for **transfer-supporting behavior**, such as
helping the learner articulate the general rule or select the method in a new
context.

Without a real learner response or validated learner model, TutorBench must not
claim that transfer actually occurred.

## 13. Authoring hierarchy

The proposed authoring unit is:

```text
discipline
  -> depth archetype
     -> core problem / task structure
        -> learner-state variants
           -> trajectory variants
              -> decision points
```

This is preferred over building a large flat collection of unrelated prompts.

## 14. Initial implementation sequence

1. Freeze historical `tutor-eval-v0.2a` semantics.
2. Approve the vNext methodology and coverage matrix.
3. Select a 15-case pilot: three depth points per discipline.
4. Author prerequisite and reference-reasoning annotations.
5. Create learner-state / trajectory variants for selected archetypes.
6. Test whether evaluators can distinguish:
   - correct but inefficient;
   - human-efficient and understandable;
   - compressed but opaque;
   - instance-efficient but non-generalizable.
7. Refine evaluator contracts before scaling case count.
8. Expand toward the full 25-cell core depth matrix only after the pilot is
   internally coherent.

## 15. Claim boundary

Case System vNext is intended to provide **broader structured coverage**, not a
validated general tutoring-intelligence score.

Even after the matrix is populated, claims about general competence,
cross-domain comparability, learner outcomes, measurement invariance, or
educational effectiveness require independent validation.

See also:

- [Coverage Matrix](case-system-vnext-coverage-matrix.md)
- [Evaluation Framework Research Audit](audits/evaluation-framework-research-audit-2026-09.md)
- [Measurement Claim Specification](measurement-claim-specification.md)
- [Real-World Finding-First Evaluation](real-world-finding-first-evaluation.md)
