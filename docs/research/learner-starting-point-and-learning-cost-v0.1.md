# Learner Starting Points, Attainable Capability and Avoidable Learning Cost — v0.1

Status: **candidate product/research hypothesis; experimental authoring-only protocol**.
No independent learners, outcome measurements, validated capability ceiling, causal
effect, or statistical efficiency estimate are claimed. This is not a sixth TutorEval
score or a mandatory tutoring algorithm.

## Long-term direction

**中文：** 起点不应预先决定终点。基础薄弱的学习者应有机会补上关键基础、
不断接近并扩展自己可达到的独立能力；已有较好基础的学习者应避免多余的重复、
提示和等待，将节约的资源用于更高层次的挑战。

**English:** A learner's starting point should shape the learning path, not
predetermine the destination. Teaching should help each learner expand
independently attainable capability while minimizing unnecessary learning cost.

Neither a specific learner's "maximum potential" nor equality of eventual
attainment across all learners is measurable from a single tutoring session.
Treat `target` as a **revisable learning milestone**, never as an ability ceiling.
A learner who reaches one target can move to the next. A learner who needs longer
is not downgraded to a permanently lower goal on the basis of one failure.

## Separate three kinds of evidence

| Question | Potential observation | What it does NOT show |
| --- | --- | --- |
| Did the Tutor identify an evidenced obstacle and choose a useful next action? | Authored conversation, hint/escalation/fading, math and prerequisite check | That the learner actually mastered the content |
| Did a learner solve a new task independently? | Uncued baseline, immediate, near-transfer and delayed work with timestamps and response evidence | General ability ceiling or population-level efficacy |
| Was learning effort unnecessary? | Active learning time, hints, tutor turns, re-explanations, learner-reported effort together with achieved independent performance | That fewer tokens, shorter messages or less time always means better learning |

**Do not collapse these into one efficiency score.** Reaching a goal with
less observable assistance is interesting only when independent mastery or
appropriate interim progress is also observed. Never reward a Tutor for reducing
support merely by withholding needed explanations, skipping foundations, or
lowering the learning target.

## Phase 1: falsifiable, one-person field notes (not psychometric calibration)

Use the same mathematics learning goal and the same independent assessment
prompts. Vary the *authored* learner evidence:

1. **Foundation gap:** learner explicitly lacks "whole" / denominator meaning;
   check that the Tutor repairs the prerequisite rather than repeating jargon.
2. **Partial understanding:** learner understands equal parts but cannot rewrite
   equivalent fractions; check that the Tutor preserves sound knowledge and
   repairs the specific missing link.
3. **Near-ready:** learner already shows `4/12+3/12=7/12`; check that the Tutor
   confirms briefly, fades scaffolding and offers a new independent challenge.

These are **synthetic contrast profiles**, not three observed students. A single
real user can report a baseline and test their *own* genuinely unknown material,
but cannot validate the simulated states as representative of other learners.

The protocol in
[`scenarios/experimental/learner-path-goal-and-cost-v0.1/protocol.json`](../../scenarios/experimental/learner-path-goal-and-cost-v0.1/protocol.json)
specifies four uncued checkpoints. Each stage has its own problem and reference
answer. The Tutor should not see evaluator answers or the synthetic authored
profile's hidden labels. If a hint is provided during an independent checkpoint,
mark it a protocol deviation instead of scoring it as independent success.

This experimental protocol is **not registered or executed** by the canonical
Tutor Health suite loader. The TypeScript validator
[`learner-path-protocol.ts`](../../src/contracts/learner-path-protocol.ts)
checks the plan's shape, differences between starting states and evidence
boundaries; the unit tests only prove these guardrails, not learning gains.

## Lightweight single-learner observation record (manual)

For each attempted session, record these fields when actually observed:

| Field | Record |
| --- | --- |
| Version and target | Protocol ID/version, one learning objective and date |
| Prior knowledge | The learner's exact statement or visible independently worked step |
| Independent baseline | Task, raw learner work, correct/partial/incorrect and help policy |
| Tutor transcript | Exact learner-visible turns and when the support level changed |
| Observed blockage | The first specific point at which the learner cannot continue |
| Resources | Active minutes, tutor turns, requested hints, repeated explanations, learner-reported effort |
| Independent immediate work | Full response to the uncued next task |
| Near transfer | New structure/values and independent work, if performed |
| Delayed check | Date, elapsed interval and independent work, if performed |
| Deviation or missingness | Unknown, not collected, hint contamination, interruption, or ambiguous source |

Do not publish raw learner conversations, personally identifying student
information, or private partner data without appropriate permission. Personal
self-testing notes should be kept separate from synthetic fixture JSON.

## Failure-first regression questions

- **Underhelping:** Did an inaccessible foundational term remain unexplained
  after explicit learner evidence?
- **Overhelping:** Did a Tutor re-teach a demonstrated prerequisite instead of
  enabling an independent next step?
- **Answer leakage:** Did a Tutor complete the very step the learner was
  supposed to attempt independently, against the authored disclosure boundary?
- **False mastery:** Did a Tutor claim the learner had mastered the skill based
  only on its own explanation, or on one cued answer?
- **Cheap but ineffective:** Did the Tutor minimize words/turns while leaving
  the learner unable to attempt an uncued follow-up?
- **False ceiling:** Did the Tutor stop offering challenge because of a past
  weakness despite visible progress?

Any reproducible failure is a useful engineering regression target. An isolated
failure can identify a specific bug or mismatch; it cannot establish its
prevalence across all students. Absence of observed failures is not proof of
general effectiveness.

## Scope and dependencies

This higher-level product aim complements rather than supersedes:

- P-002, understanding-breakpoint localization;
- P-003, preservation of correct reasoning;
- P-005, minimum sufficient explanation;
- P-006, independent transfer verification;
- Case System vNext's task depth, teaching decision difficulty, learner state,
  prerequisite boundary and interaction horizon;
- Tutor Health's finding-first reports, which describe Tutor behavior but do
  not infer learner outcomes.

Current implementation deliberately **does not** add IRT estimates, attainment
percentages, ceiling predictions, autonomous learner simulation, a new rubric,
a public leaderboard, or background tracking.

Next practical step: run the protocol on a genuinely unfamiliar concept with
recorded independent attempts, review incorrect Tutor actions, and convert
confirmed patterns into narrowly scoped experimental regression scenarios.
