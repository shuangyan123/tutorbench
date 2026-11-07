# Learner-evidence counterfactuals — offline experiment v0.1

**Status:** 5 authored stimulus pairs / 10 Tutor inputs; model responses **not collected**. No real learners, API or Judge calls, human Gold, learning gain, or causal treatment estimate.

## Desk review of evidence boundaries (2026-11-07)

This is a source-grounded desk review by the authoring assistant, **not** a new blinded human reviewer. Two prior inferences needed correcting:

- **Verbal definition versus self-report.** The learner does not merely say they know a denominator: they supply a correct verbal definition. The matrix now calls this `stated_definition`, which still is not independent application.
- **Prompted paraphrase versus independent understanding.** The learner's sheet explanation comes *after* the Tutor provided that very example. The matrix calls this `supported_local`, not evidence of independent transfer.
- A named question plus an explicit “I do not know” anchors the particular concept gap; an incorrect answer alone continues to leave the cause unknown.
- A statement of a correct local relationship is not evidence of durable mastery, and a question about an unsolved procedure is not proof of permanent inability.

These are **authoring interpretations** based on literal conversation turns. The parser verifies exact provenance and a previous Tutor message for a prompted paraphrase, not semantic correctness or real student understanding.

## Frozen five contrasts

Source of truth: `scenarios/experimental/learner-state-evidence-v0.1/contrast-plan.json`.

| Pair | Controlled evidence span | Diagnostic question |
| --- | --- | --- |
| `evidence-for-rule` | Same wrong 2/7; one arm adds an explicit incorrect addition rule | Does the Tutor avoid unsupported diagnosis in the unknown-cause arm? |
| `reported-vs-defined` | A claim of knowing “whole” versus an added correct definition | Does verbal knowledge get acknowledged without inferring full mastery? |
| `echoed-progress` | Same previous Tutor example; one arm adds its learner paraphrase | Does Tutor appropriately fade the repeated example without calling the echo independent? |
| `term-gap-negative-control` | Both arms ask about “whole”; one adds “I do not know” | Is the same prerequisite explained in both arms rather than overreacting? |
| `wording-invariance` | Two semantically equivalent descriptions of the same wrong fraction-addition rule | Is diagnosis invariant to lexical variation? |

Within each pair, the existing source scenario, prior dialogue, learning objective and fixed input metadata are constant. **Only the explicitly authored learner-evidence span changes** (plus opaque case ID). Static author-assigned known-concept values are cleared **in both arms** to avoid a privileged-state leak. The source scenarios differ from one another, so cross-pair differences do not constitute a one-variable comparison.

The natural-language insertion still changes length and expression, so this design tests *bounded response sensitivity*, not randomized causal effects. All scenarios are fictional; pairs do not describe observed improvement in one student.

## Reproducible, no-cost export

Run from the repo root:

```bash
npm run build
node --test dist/tests/learner-state-evidence.test.js dist/tests/learner-state-contrast.test.js
node scripts/research/export-learner-state-contrasts.mjs
```

The export writes `artifacts/research/learner-state-contrasts-v0.1/tutor-visible.json`, containing **10** TutorTurnInput-shaped packets, stable opaque IDs and per-input SHA-256 fingerprints. Files are create-only (`wx`) to prevent accidental overwrite; supply `--out <new-path>` for a new export. It includes neither operator research questions nor evaluator-only misconception references, matrix claims or author expectations.

**Export is not execution.** To run a candidate Tutor, use the same versioned provider/model/prompt/settings for all ten cases, with a fresh independent session for each packet while retaining its authored prior dialogue. Freeze inputs, collect verbatim responses with existing Tutor-response-corpus provenance, preserve timeout/unavailable outcomes, and independently review whether multiple reasonable teaching moves are accepted. For stochastic generation, document repeat count and seeds where supported.

Do not call paid providers automatically or rank models before semantic human review. Tests and an offline ScriptedTutor adapter can verify plumbing but not independently test adaptive model behavior. Synthetic learner continuations cannot be scored as real pre/post learning outcomes.

## Stop conditions

Keep this experiment outside the canonical Tutor Health aggregate, existing Rubric Gold, and learner outcome evidence. Stop and reopen a pair when literal source evidence changes, paired inputs differ in fields other than the evidence span and identity, evaluator-only state leaks into packets, or a plausible alternate teaching response is incorrectly forced into FAIL. The prior `learner-path-goal-and-cost-v0.1` baseline/immediate/transfer/delayed outcome checks remain entirely unmeasured.
