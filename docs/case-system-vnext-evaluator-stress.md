# Case System vNext — Evaluator Stress Test

Status: **provider-neutral synthetic diagnostic harness**

This stress test exists to answer a narrow question before Case System vNext
archetypes become executable Tutor scenarios:

> Can an evaluator consistently distinguish the reasoning contrasts that the
> vNext methodology says matter?

It tests the evaluator, not the Tutor.

## Protocol

Each fixture contains two developer-authored candidate Tutor responses with one
controlled contrast. Every fixture is also bound to one exact, versioned
**task-specific strategy profile**. The broad discipline label is not itself an
evaluation strategy. The operator owns the expected diagnostic relationship.
The Judge-facing packet never contains that expectation, rationale, candidate
IDs, provider IDs, model IDs, latency, token use, or hidden model reasoning.

For every repetition the harness emits two blind presentations:

```text
presentation 1: A = response X, B = response Y
presentation 2: A = response Y, B = response X
```

The evaluator returns one bounded semantic outcome: `A_BETTER`, `B_BETTER`,
`EQUIVALENT`, `NON_DOMINATED`, or `INSUFFICIENT_EVIDENCE`. The harness maps
those labels back through an operator-only assignment sidecar.

A stable preference requires the same underlying response to win after the
A/B swap. If the evaluator follows presentation position, the result is
`order_sensitive`, not a tie.

## Task-specific strategy profiles

The registry uses shared base evaluation rules plus increasingly precise
subject/specialization rules. A broad family never supplies the final strategy
policy.

Current pilot profiles are anchored to audit-seeded domains and then narrowed:

- Mathematics -> algebra -> proof/generalization;
- Computer science -> algorithms -> pair-sum algorithm design;
- Writing / rhetoric -> argumentation -> source synthesis;
- History -> source analysis -> corroboration.

The earlier generic `science` stress fixture was removed rather than pretending
that one experimental-design strategy represents Physics, Chemistry, Biology,
or Earth / environmental science. Those domains require separately authored
profiles and fixtures.

This is only a pilot. The intended expansion is more precise still. For
example, programming instruction may need separate Python debugging, Java OOP,
Rust ownership/borrowing, SQL query reasoning, and systems-design profiles.
Natural science should split into physics, chemistry, biology, earth science,
and further branches where strategy criteria differ. "Writing" is treated as a
practice/task family that can occur inside language arts, history, science,
and other subjects rather than as one universal discipline.

New subjects, language specializations, or task families require their own
profile or must explicitly declare that no strategy ranking is supported.

## Five initial contrasts

- `human_efficiency`: correct but unnecessarily mechanical reasoning versus
  a materially simpler human-executable route within the learner's prerequisites.
- `opacity`: compressed or authoritative shortcut versus an efficient,
  locally justified explanation.
- `generalization_target`: instance-only solution versus justified reusable
  method when the teaching target explicitly calls for generalization.
- `prerequisite_compatibility`: elegant or advanced method outside the
  learner's authored prerequisite boundary versus an accessible method inside it.
- `equivalent_strategies`: two strategies that the archetype explicitly
  permits without enough evidence to prefer one. These fixtures require a tie
  expectation and guard against benchmark style bias.

## Teaching-objective stress layer

Stress packets now carry an explicit teaching objective in addition to the
shared base rules and task-specific strategy profile.

Two objective profiles are currently defined:

- **Learning-oriented** — conceptual understanding, transparent reasoning,
  misconception repair, transfer support, and learner independence.
- **Exam-oriented** — assessment-rule compliance, score reliability, time
  efficiency, marking-point alignment, error resistance, and efficient
  verification.

Exam-oriented fixtures must include the assessment context rather than relying
on a generic "test prep" label.

The first objective counterfactual holds the mathematics task and candidate
responses fixed while changing only the objective:

- learning-oriented: prefer the response that derives and generalizes the
  difference-of-squares structure;
- exam-oriented: in an answer-only, one-minute, paper-and-pencil short-answer
  context, prefer the concise correct structural route.

This is a diagnostic expectation, not evidence that one objective is generally
better or that one response would improve real exam outcomes.

## Subject-specific profile expansion

The first precise expansion adds four task-scoped profiles rather than a
generic Science/Programming rule:

| Domain | Scope | Evaluation emphasis |
| --- | --- | --- |
| Physics | kinematics / position-time graph interpretation | representation fidelity, kinematic validity, scope control, units/intervals |
| Chemistry | chemical kinetics / factor-discrimination experiment | factor identifiability, chemical control, valid rate measurement, information value, mechanism restraint |
| Biology | experimental biology / causal explanation | mechanism-evidence link, control awareness, alternative hypotheses, biological-level consistency, teleology restraint |
| Computer science | Python / mutable-state debugging | fault localization, Python semantics, evidence-backed diagnosis, patch minimality, regression awareness |

Each profile has a paired `domain_strategy_alignment` stress fixture. These
fixtures ask whether the evaluator can apply the exact subject/task criteria,
not merely generic preferences such as brevity or explanation length.

## Initial fixture set

The first fixture set spans:

- Mathematics D5: human efficiency, opacity, and generalization;
- Programming D5: human efficiency and prerequisite compatibility;
- Science D5: equally defensible investigation strategies;
- Language/Writing D5: equally defensible synthesis strategies;
- History/Social Science D5: explicit corroboration versus an authority shortcut.

These are purposive synthetic probes. They are not a representative sample of
the case space.

## Repetition and reporting

The plan accepts a bounded `runsPerFixture` value. Each run performs both A/B
orders, so:

```text
planned judgments = fixtures × runsPerFixture × 2
```

The report separates:

- comparable repetitions;
- expected diagnostic matches among comparable repetitions;
- order-sensitive repetitions;
- inconsistent semantic repetitions;
- incomplete evidence;
- `ok`, `unavailable`, and `invalid` presentation-judgment counts;
- modal fixture outcome and modal share;
- aggregate diagnostics by contrast.

Each repetition also retains a bounded presentation-level diagnostic sidecar:
presentation ID, operator-only A/B candidate assignment, evidence status,
bounded outcome when present, and typed failure reason when present. It does
not persist provider payloads, hidden reasoning, or chain-of-thought. This
allows an operator to distinguish, for example, a `NON_DOMINATED`/preference
swap disagreement from an unavailable or malformed Judge result.

An unavailable Judge call remains incomplete evidence. It is not converted
into semantic disagreement or failure.

## Interpretation boundary

The report is always marked `uncalibrated`.

Fixture expectations are developer-authored diagnostic expectations, not human
gold. Therefore:

- expected-match share is not evaluator accuracy;
- stable synthetic preference is not calibration;
- no Judge/model winner is inferred;
- no general tutoring-validity claim is supported;
- no learning-outcome or realized-transfer claim is supported.

The fixed report statement is:

```text
No evaluator-quality winner or calibration claim is inferred.
```

## Provider boundary

The core harness is provider-neutral. It accepts a function that consumes the
blind packet and returns a bounded judgment.

CI uses synthetic Judge functions only and makes no live model calls.

A later live-provider adapter can reuse this boundary, but should preserve:

- explicit call budget before execution;
- repeated runs;
- provider/model/prompt provenance outside the blind semantic packet;
- no raw provider payload or chain-of-thought persistence;
- separate availability and semantic diagnostics;
- no automatic evaluator selection.

## Expansion gate

The current eight fixtures are enough to validate the harness mechanics, not
enough to validate the constructs.

Before converting the 15 pilot archetypes into executable Tutor scenarios:

1. add more controlled contrasts at D3 as well as D5;
2. obtain independent human review of fixture expectations;
3. test at least one live Judge candidate repeatedly;
4. inspect order sensitivity and false preferences on equivalent-strategy ties;
5. revise authoring guidance or Judge criteria where a construct is unstable.

See also:

- [Case System vNext](case-system-vnext.md)
- [Core Coverage Matrix](case-system-vnext-coverage-matrix.md)
- [Judge Candidate Comparison](judge-candidate-comparison.md)

## Outcome semantics

The stress protocol distinguishes four semantic conclusions from provider or
transport failure:

- `A_BETTER` / `B_BETTER`: the authored criteria justify an overall
  preference;
- `EQUIVALENT`: the candidates are materially equivalent under the authored
  criteria;
- `NON_DOMINATED`: each candidate has defensible advantages and the authored
  criteria do not justify collapsing those trade-offs into one winner;
- `INSUFFICIENT_EVIDENCE`: the packet itself does not contain enough
  information to support preference, equivalence, or non-dominance.

`INSUFFICIENT_EVIDENCE` is a substantive evaluator conclusion. It is not the
same as `status: unavailable`, which represents missing evaluator/provider
evidence, or `status: invalid`, which represents malformed evaluator evidence.

This distinction is required before live-Judge stress runs because
`acceptable_strategy_set` and `pareto_tradeoff` profiles cannot be safely
compressed into one generic tie label.


## Live DeepSeek V4.1 Flash diagnostic

The repository includes an explicit live/paid CLI path for the current
DeepSeek V4.1 Flash API route:

```text
DEEPSEEK_API_KEY=...
DEEPSEEK_JUDGE_MODEL=deepseek-flash
tutorbench case-system-vnext-stress --judge-deepseek --runs 1
```

The default live smoke uses one repetition per fixture: 15 fixtures × two
presentation orders = 30 Judge calls. A repeated stress run with
`--runs 3` makes 90 Judge calls. Targeted follow-up diagnostics can select one
or more fixtures without rerunning the entire paid suite:

```text
tutorbench case-system-vnext-stress --judge-deepseek --runs 3 \\
  --fixture math-human-efficiency \\
  --fixture objective-exam-math-speed \\
  --output artifacts/case-system-vnext-targeted-stress.json
```

Each selected fixture still runs both A/B orders for every repetition.

The command records the provider/model descriptor and the full uncalibrated
stress report. It never sends fixture expectations, rationale, or candidate
identities to the Judge. Provider/transport failures remain distinct from the
semantic `INSUFFICIENT_EVIDENCE` outcome.

An initial repeated live run on 2026-09-25 executed 90/90 planned calls with
42 comparable repetitions, zero order-sensitive repetitions, zero inconsistent
repetitions, 85 `ok` judgments, zero unavailable judgments, and five invalid
judgments. The five invalid judgments were all provider-confirmed output-length
truncations on `math-human-efficiency`. The no-winner probes were stable across
all three repetitions: writing `EQUIVALENT`, chemistry `NON_DOMINATED`, and
history `INSUFFICIENT_EVIDENCE`. The exam-oriented mathematics counterfactual
also exposed a stable diagnostic disagreement: all three comparable
repetitions preferred the derive-and-generalize response despite the authored
one-minute, answer-only expectation favoring the concise structural response.

That disagreement motivated protocol/prompt v0.4/v0.2 clarification: the
immediate `teachingTarget` and `teachingObjective` control the presentation,
while broader archetype reference reasoning and transfer fields remain
background context rather than automatic requirements. This is a stress-test
contract clarification, not a claim that the developer-authored expectation is
human gold. Independent review remains required before using the expectation as
reference evidence.

This is diagnostic evidence only. Developer-authored expected outcomes are not
human gold, so expected-match share must not be reported as model accuracy or
used to rank Judge providers.
