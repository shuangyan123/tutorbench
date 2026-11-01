# Controlled study: wrong endorsement versus answer leakage

*TutorBench research design v0.1 · 2026-11-01 · not calibrated gold · no Judge API calls*

## Decision this experiment is intended to support

Should TutorBench classify **endorsing a learner's wrong answer** as `answer_leakage`, or is it an independently measurable problem such as `incorrect_diagnosis`, `misconception_reinforcement`, or `prematureClosure`? Do not decide by simply rewriting a prompt to match a particular reviewer.

The initiating user reviewed **case 4** (wrong endpoint agreement, leakage **no**), **case 8** (wrong conditional probability endorsement, leakage **yes**), and **case 9** (wrong function-domain endorsement, leakage **yes**). All three received R1/R2 FAIL; that agreement does not settle the answer-leakage construct. Keep the original user labels, reasons and identifiers untouched in `math-contrast-user-review-completed-2026-11-01.json`.

The existing Judge v0.9.1 explicitly separates learner-reserved operations from required diagnosis, conceptual explanation, and local corrections, and emits `answer_leakage` for prohibited solution/result disclosure; it does not establish a single clear interpretation for a false, purported final answer. The new material is **experimental**, not a production specification.

## Raw materials and controls

- Actual source case policy, learner message, and math reference are taken from `scenarios/experimental/mathematics-challenge-v0.1/suite.json`.
- Original Tutor negative-control responses are taken verbatim from `math-pedagogical-boundary-review-v0.1.json` for the **finality** comparison.
- Controlled student-message and new Tutor-response counterfactuals are authored separately; they are **not** historical model outputs.
- **All 14 arms** remain `hint_only`. The same mathematical task is held fixed within each pair.
- Exactly seven paired contrasts, comprising 14 presented examples, are in `math-wrong-endorsement-controlled-pairs-v0.1.json`.

### Factor 1: explicit answer-finality marker (3 pairs)

For each of cases 4, 8 and 9, use the *identical original learner message* and original wrong-endorsement Tutor response in arm A. Arm B appends exactly one sentence: "That is the final answer." All other Tutor and learner text remains byte-identical.

**Estimand:** Does explicit finality wording change perceived task takeover/leakage *even though the mathematical statement is still wrong*?

**Limit:** Original wrong-endorsement texts may already sound final; unchanged ratings might reflect a ceiling effect, not proof finality is irrelevant.

### Factor 2: did the student already state the wrong conclusion? (3 pairs)

Create two matched student messages that differ only by insertion of one student-asserted wrong-conclusion sentence. Both ask for a hint, and both receive **identical** Tutor responses. Math problem, starter reasoning, assistance request and Tutor words remain fixed.

**Estimand:** Does answer ownership or novelty change whether the same Tutor output is experienced as a prohibited disclosure, rather than simply wrongful validation?

**Limit:** Prior disclosure can alter response pragmatics. Ask reviewers about appropriateness and leakage separately; do not claim perfectly isolated causal effects beyond this textual intervention.

### Factor 3: correct versus incorrect *asserted final fraction* (1 pair)

Hold the conditional-probability learner message and Tutor framing constant:

- Arm A: "The conditional probability is 5/18."
- Arm B: "The conditional probability is 1/3."

Only the numeric fraction differs. For the stated two-ball task, 5/18 is unconditional and the valid conditional result is 1/3. **Both responses** directly assert a final result despite the learner's no-final-fraction request.

**Estimand:** Is the answer-leakage label about disclosure of the *true* result, or authoritative provision of a purported final result regardless of its accuracy?

**Limit:** This factor is present for only one math case. It cannot establish domain-general behavior on its own.

## Blind-review procedure

1. Prepare an independent packet containing only the problem, student message, Tutor response, `hint_only` policy, and neutral response IDs. **Hide pair identity, factor value, arm code, historical Judge result, the user's earlier labels, and assistant-generated classifications.**
2. Randomize the 14 response presentations with a fixed recorded seed. Avoid presenting paired arms adjacently when reasonably possible; disclose this if randomization does not achieve it.
3. Each reviewer rates, *independently and before seeing the other arm*:
   - Mathematical validity: correct / incorrect / uncertain.
   - Wrong-answer endorsement: yes / no / uncertain.
   - Final-result disclosure contrary to hint-only: yes / no / uncertain.
   - Learner-task takeover or premature closure: yes / no / uncertain.
   - `answer_leakage` under **the existing published Judge definition**: yes / no / uncertain.
   - Short literal evidence span and one-sentence rationale for the leakage verdict.
4. Require reviewers to identify whether they regard "answer leakage" as revealing a **correct** withheld result or as declaring **any** purported final result. This allows interpretation drift to be separated from simple disagreement.
5. Only after all individual labels are frozen: join anonymous IDs to pair and arm metadata; compare A versus B **within each pair**, rather than pooling three subjects as independent statistical replicates.
6. Review differences with at least two independent educators or assessment experts before canonizing a definition. Preserve raw judgments even if definitions are later revised.

### Analysis table to produce after review (not populated)

| Pair | Factor changed | A leakage | B leakage | A takeover | B takeover | Reviewer rationale / uncertainty |
| --- | --- | --- | --- | --- | --- | --- |
| Endpoint finality | Only appended finality sentence | Pending | Pending | Pending | Pending | Pending |
| Endpoint prior claim | Learner-supplied wrong conclusion | Pending | Pending | Pending | Pending | Pending |
| Probability finality | Only appended finality sentence | Pending | Pending | Pending | Pending | Pending |
| Probability prior claim | Learner-supplied wrong conclusion | Pending | Pending | Pending | Pending | Pending |
| Domain finality | Only appended finality sentence | Pending | Pending | Pending | Pending | Pending |
| Domain prior claim | Learner-supplied wrong conclusion | Pending | Pending | Pending | Pending | Pending |
| Probability final truth | False versus correct asserted fraction | Pending | Pending | Pending | Pending | Pending |

A meaningful result is a *consistent boundary* across matched pairs and independent reviewers, not a predetermined number of PASS or leakage decisions. Also capture reviewer confidence and ambiguity; do not force uncertain into no.

## Before any production change

- Verify all seven pair-level controlled differences structurally, source traceability, math reference arithmetic and no accidental alterations to original user review.
- Independently adjudicate residual ambiguous cases, including why case 4 differs from 8/9 in original user labels.
- Calibrate any new failure taxonomy against real tutoring interactions, including repeated unsuccessful attempts; do not generalize from a synthetic single-turn `hint_only` suite.
- Version a future Judge prompt and rubrics separately only if justified; compare against the frozen v0.9/v0.9.1 baselines.
- Report output availability, semantic agreement, and learner-outcome evidence separately. **No DeepSeek calls are needed to construct or test this fixture.**

**Preservation rule:** Original user scores and reasons remain untouched. No canonical suites, scorer, original contrast corpus, or live Judge prompt are modified by this research stage.
