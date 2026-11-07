# Evidence-anchored learner states — offline synthetic pilot v0.1

**Status:** author-synthetic, evidence-anchored, non-canonical research material.
**Scope:** strictly define what a Tutor can and cannot infer from an authored learner turn. No new learner cohort, live student recruitment, model call, Judge result, Gold label, learning outcome, diagnostic test, or effect-size claim.

## Why this is needed

TutorBench's previous 31 single-reviewer semantic ratings suggested that many technically correct explanations can still skip important learner prerequisites. The operational response is **not** to label somebody "a weak student" or universally require longer explanations. It is to locate the learner's **current, evidenced** knowledge boundary and select a teaching action proportionate to that boundary.

Two existing and separately versioned sources are reused, not replaced:

1. `scenarios/experimental/prerequisite-aware-instruction-v0.1/suite.json` already contains five authored learner utterances, vNext decision points, and evaluator-only misconception evidence. **This is the authoritative source** for the five snapshots.
2. `scenarios/experimental/learner-path-goal-and-cost-v0.1/protocol.json` already defines one fraction-addition target, three illustrative starting paths, and independent baseline / immediate / near-transfer / delayed checkpoints. Its outcomes are uncollected and remain so.

`scenarios/experimental/learner-state-evidence-v0.1/matrix.json` adds *only* a quote-anchored evidence overlay to the first source. It does not copy the test question or create a new canonical suite. The existing `src/contracts/learner-path-protocol.ts` and `src/contracts/tutor-scenario-vnext.ts` are unchanged.

## Evidence model: observe first, infer second

Each profile consists of literal **learner** excerpts, identified by one-based learner-turn index; a small set of concept claims; and nonexclusive permissible next moves with forbidden assumptions.

| Epistemic status | Minimum justified evidence | Not justified |
| --- | --- | --- |
| `unknown` | No sound claim yet, even if a numerical answer is wrong or a learner asks for help | Inventing a unique error cause or an ability level |
| `explicit_gap` | Learner explicitly says they do not understand a named prerequisite | Global inability or every prerequisite being absent |
| `misconception_stated` | Learner explicitly articulates a wrong *rule* | Treating one statement as a permanent trait |
| `reported_only` | Learner says they know a concept | Inferring successful independent performance |
| `demonstrated_local` | Learner gives a locally correct explanation in their turn | Durable mastery, transfer, or a fixed ceiling |

All other student characteristics, including general intelligence, motivation, emotional state, learning disability, maximum attainable ability, and trait-level mastery, are **unmeasured**. The matrix does not infer any of them.

### Five existing evidence snapshots

| Existing scenario | Strict observation | Limited state conclusion | Tutor boundary |
| --- | --- | --- | --- |
| `pai-unknown-cause` | Only `1/3 + 1/4 = 2/7` | Specific cause **unknown** | Check the student's method or correct cautiously; do not diagnose a denominator deficit from an answer alone |
| `pai-whole-undefined` | "I do not know what that word means here." | Explicit gap in the term "whole" | Define the chosen whole with one concrete referent, then verify locally |
| `pai-rule-misconception` | "I always add top numbers and bottom numbers separately" | Explicitly stated, incorrect fraction-addition rule; other stated knowledge remains only self-report | Address that rule, not an invented broader deficiency |
| `pai-after-progress` | Accurately describes the whole sheet, asks why parts must be equal | Locally demonstrated meaning of whole; equal-parts reasoning still **unknown** | Build on demonstrated progress and address the newer question |
| `pai-known-foundation` | Correctly describes a shared whole split into differently sized parts, asks how to rewrite them | Local evidence on fraction units; equivalent-fraction method **unknown**, not proved absent | Move to equivalent units; do not restart the entire foundation lesson |

These are **five independent authored vignettes**, not five observed people, three actual groups, a single student's progression, or a measured pre/post gain.

## Why "unknown" is a first-class state

A response such as `2/7` might arise from a guessed rule, copying, arithmetic carelessness, or a misunderstood question. It cannot justify any one underlying cause. A question such as "How do I rewrite these?" does not establish that the learner lacks every relevant prerequisite. A correct statement by a student may be useful local evidence; it is not proof of delayed retention.

Thus the research comparison distinguishes *observable content* from *hypothesized diagnosis*. For evaluative use, a Tutor must not receive the matrix's `claims` or `decisionBoundary` as hidden answers. Only the existing vNext Tutor-visible conversation and known-concept projection are supplied to the Tutor. The matrix is an **evaluator/operator sidecar** and is not a secret injected learner memory.

## Validation: what the code actually checks

`src/experiments/learner-state-evidence.ts` provides `parseLearnerStateEvidenceMatrix(value, sourceSuite)`. It enforces:

- An exact author-synthetic schema, versioned source suite and the five existing source scenario identities; one fixed learning objective across the snapshots.
- Each evidence quote must literally occur in its declared **learner** turn. A Tutor utterance cannot be used as learner evidence.
- Claims can reference only existing observations, with distinct observation and concept IDs. `misconception_stated` needs a `stated_rule`, `explicit_gap` needs an explicit-gap statement, `reported_only` needs a self-report, and `demonstrated_local` needs locally correct reasoning. An `incorrect_result` alone cannot silently promote a diagnosis.
- `unknown` cannot be disguised as an evidenced fact; source utterance or version changes invalidate quote anchors.
- No field can claim real observed learning, stable student ability, an intervention effect, or linkage of the five vignettes into one real student's longitudinal history.

These checks establish **data integrity and provenance boundaries, not the semantic correctness of our inferences**. The classification of a quoted phrase as `local_reasoning`, for example, is still an authored hypothesis requiring independent review.

Run:

```bash
npm run build
node --test dist/tests/learner-state-evidence.test.js
```

## Offline experiment design: control the learner evidence, not imaginary outcomes

1. **Authoring review first.** Independently inspect each quote, knowledge claim, alternative plausible diagnosis, and permissible Tutor action. Reject state labels based on generic grades such as "poor student." Note translation fidelity when producing Chinese Tutor-facing variants.
2. **Freeze a Tutor candidate and the five source packets.** Keep the same model/prompt/version and objective, with the existing vNext learner-visible boundary. Source histories differ across vignettes, so these are *contrasts*, **not one-variable causal tests**.
3. **Test decision sensitivity, not learning gains.** On each packet, ask whether the Tutor made an unsupported diagnosis, respected a locally demonstrated prerequisite, offered an accessible next step, or continued when the learner had a new unresolved question. Permit multiple valid teaching styles and avoid keyword-only scoring.
4. **Use perturbation controls.** Remove an explicit wrong rule and see whether an overconfident diagnosis disappears; replace a self-report with a correct worked explanation and see whether the Tutor is less repetitive; keep an incorrect answer but vary the plausible reason. These are tests of reaction to altered *authored evidence*, not simulated improvement.
5. **Keep outcomes missing.** A fictional next learner turn written by an LLM or researcher cannot count as actual student mastery, successful transfer, or educational efficacy. If no student observations exist, report `learning_outcome: not_measured` rather than zero, success, or improvement.

### Stop conditions

Do not promote this matrix into canonical Tutor Health weights or rubric Gold solely because the validator passes, the Tutor follows author expectations, or an LLM Judge agrees. Stop and reopen a case if the authoring claim is underdetermined by its literal evidence, if source prompts change, if a Tutor sees evaluator-only material, or if two plausible responses are wrongly collapsed into a single mandated teaching script.

**Research next step:** obtain an independent semantic review of these *state attributions and alternatives*, then run bounded private/offline Tutor decision-contrast tests. Real learner recruitment is **not** assumed. This can improve engineering confidence about responsiveness to learner evidence, but it cannot establish real learning effectiveness.
