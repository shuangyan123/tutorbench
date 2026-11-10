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
| `reported_only` | Learner merely claims knowledge | Independent performance |
| `stated_definition` | Learner says a correct definition | Worked application |
| `supported_local` | Learner paraphrases a Tutor example after receiving it | Independent reconstruction or transfer |
| `demonstrated_local` | Learner states locally correct reasoning without a prior authored Tutor hint about that step | Durable mastery, transfer or a ceiling |

All other student characteristics, including general intelligence, motivation, emotional state, learning disability, maximum attainable ability, and trait-level mastery, are **unmeasured**. The matrix does not infer any of them.

### Five existing evidence snapshots

| Existing scenario | Strict observation | Limited state conclusion | Tutor boundary |
| --- | --- | --- | --- |
| `pai-unknown-cause` | Only `1/3 + 1/4 = 2/7` | Specific cause **unknown** | Check the student's method or correct cautiously; do not diagnose a denominator deficit from an answer alone |
| `pai-whole-undefined` | "I do not know what that word means here." | Explicit gap in the term "whole" | Define the chosen whole with one concrete referent, then verify locally |
| `pai-rule-misconception` | Stated separate-numerator/denominator rule, but also correctly defines the denominator | Explicit incorrect addition rule **and a stated correct definition**, not proof of application | Address that rule, not an invented broader deficiency |
| `pai-after-progress` | Restates the whole-sheet meaning **after the Tutor supplied this example** | Prompt-supported paraphrase only; independent understanding and equal-parts reasoning still **unknown** | Build on demonstrated progress and address the newer question |
| `pai-known-foundation` | Correctly describes a shared whole split into differently sized parts, asks how to rewrite them | Local evidence on fraction units; equivalent-fraction method **unknown**, not proved absent | Move to equivalent units; do not restart the entire foundation lesson |

These are **five independent authored vignettes**, not five observed people, three actual groups, a single student's progression, or a measured pre/post gain.

## Why "unknown" is a first-class state

A response such as `2/7` might arise from a guessed rule, copying, arithmetic carelessness, or a misunderstood question. It cannot justify any one underlying cause. A question such as "How do I rewrite these?" does not establish that the learner lacks every relevant prerequisite. A correct statement by a student may be useful local evidence; it is not proof of delayed retention.

Thus the research comparison distinguishes *observable content* from *hypothesized diagnosis*. For evaluative use, a Tutor must not receive the matrix's `claims` or `decisionBoundary` as hidden answers. Only the existing vNext Tutor-visible conversation and projected context are supplied for original source scenarios. For paired counterfactuals, author-assigned known-concept values are **neutralized in both arms**, avoiding a hidden privileged-state confound. The matrix is an **evaluator/operator sidecar** and is not a secret injected learner memory.

## Validation: what the code actually checks

`src/experiments/learner-state-evidence.ts` provides `parseLearnerStateEvidenceMatrix(value, sourceSuite)`. It enforces:

- An exact author-synthetic schema, versioned source suite and the five existing source scenario identities; one fixed learning objective across the snapshots.
- Each evidence quote must literally occur in its declared **learner** turn. A Tutor utterance cannot be used as learner evidence.
- Claims can reference only existing observations, with distinct observation and concept IDs. `misconception_stated` needs a `stated_rule`; `explicit_gap` an explicit gap; `reported_only` a self-report; `stated_definition` a verbal definition; `supported_local` a prompted paraphrase with a preceding Tutor turn; `demonstrated_local` locally correct reasoning. An `incorrect_result` alone cannot silently promote a diagnosis.
- `unknown` cannot be disguised as an evidenced fact; source utterance or version changes invalidate quote anchors.
- No field can claim real observed learning, stable student ability, an intervention effect, or linkage of the five vignettes into one real student's longitudinal history.

These checks establish **data integrity and provenance boundaries, not the semantic correctness of our inferences**. The classification of a quoted phrase as `local_reasoning`, for example, is still an authored hypothesis requiring independent review.


### Secondary evidence-construct audit (2026-11-10)

**Provenance and limits.** This is a secondary, source-grounded desk review
of the original synthetic `suite.json`, five authored profiles in
`matrix.json@0.1.1`, the TypeScript validator and regression tests. It is
**not** an independent human subject-matter review, Gold annotation,
real-learner validation, High/Max output review or confirmation of the
private reviewer ledger. The source suite remains `prerequisite-aware-instruction-v0.1@0.1.0`.
The eight observations and ten concept-level claims are unchanged.

| Status | Count in five authored profiles | Minimum local support observed | Ceiling on justified inference |
| --- | ---: | --- | --- |
| `unknown` | 5 | A named concept is not justified by the supplied observations; e.g. an incorrect `2/7` alone does not establish why the learner erred | Does **not** mean the learner has no misconception, the concept is absent, or the source reference is missing |
| `explicit_gap` | 1 | `pai-whole-undefined`: the learner **says** they do not know what the term “a whole” means *here* | Reported word/context difficulty, **not** an independent demonstration that whole-number or fraction concepts are missing |
| `misconception_stated` | 1 | `pai-rule-misconception`: explicit “add top numbers and bottom numbers separately”; the rule is mathematically false in the authored sum (`1/3 + 1/4 = 7/12`, not `2/7`) | One stated incorrect rule, not persistent inability or a complete cognitive diagnosis |
| `reported_only` | **0** | **No original authored profile.** A separate in-memory test appends an explicit learner self-report to exercise this parser path | A self-report may express confidence but never demonstrates independent skill; synthetic test coverage is **not** a sixth student vignette |
| `stated_definition` | 1 | The learner says a denominator counts equal parts of a whole, correct within the authored part–whole model | Correct verbal definition, not independent application |
| `supported_local` | 1 | `pai-after-progress`: learner restates the same sheet-of-paper example after the Tutor supplied it | Prompt-supported paraphrase, not unprompted application, independent transfer or retention |
| `demonstrated_local` | 1 | `pai-known-foundation`: learner articulates a locally correct shared-whole/differently-sized-parts comparison without an earlier Tutor turn in the authored vignette | Only this local statement; not proof of computing the sum, equivalent-fraction construction or durable mastery |

**Coverage by observation kind:** `incorrect_result`, `explicit_gap`,
`stated_rule`, `verbal_definition`, `prompted_paraphrase`, and
`local_reasoning` occur once each; `question` occurs twice;
`self_report` occurs **zero** times in the original matrix. The no-provider
regression suite now checks all instantiated kind/status joins and exercises
the missing `reported_only` path with an explicitly synthetic, in-memory
source modification. No original observation, concept label, Judge result or
scoring rule is changed.

**Adversarial construct limitations (not repaired by matching strings):**

1. A quoted `stated_rule` can be correct or wrong. The validator checks
   only the author-supplied kind and quote, not mathematical correctness.
   `misconception_stated` must be independently checked for the named
   concept before an evaluator treats it as a diagnosis.
2. A `verbal_definition` or `local_reasoning` string can itself be
   scientifically false or unrelated to the claimed concept. The parser
   checks neither semantic correctness nor concept-level relevance.
3. `prompted_paraphrase` currently requires only **some** preceding Tutor
   turn. It does not check that the paraphrase actually derives from that
   Tutor's relevant example. `demonstrated_local` does not automatically
   exclude semantic copying or help supplied by an earlier Tutor turn.
   In the two current authored vignettes, the chronology and exact text
   make the respective interpretations plausible, but this is a manual
   judgment, not a proven general validator property.
4. An `explicit_gap` is a learner's expressed difficulty; wording,
   language unfamiliarity or uncertainty can explain the utterance without
   proving objective prerequisite absence.
5. Quote substring + suite/scenario **version** checks do not pin the entire
   source's bytes. Changes retaining the cited substring may go unnoticed
   if an author reuses the same version. Freeze the exact source revision or
   content digest when comparing runs, and re-review meaning after contextual
   edits.
6. The source-only absence of evaluator references in the bridge from PR
   #360 is an *absence of authored metadata*, not a `LearnerEpistemicStatus`
   of `unknown`. Local fraction concepts also remain candidate, **not
   automatic**, links to the separate mathematics knowledge map, as
   discussed in the architecture crosswalk from PR #354.

**Independent construct-acceptance gate before generalizing:** present all
five vignette transcripts and a small adversarial set (correct rule labeled
wrong; wrong reasoning labeled correct; copied and merely reported
understanding; question-only “gap”) to a subject-competent reviewer **without
the authored state labels**. For each candidate claim, record the exact
learner-turn quote, intended concept, whether the label is *supported /
ambiguous / contradicted*, alternative plausible interpretations and
acceptable Tutor next moves. Have disagreements or ambiguous labels
adjudicated rather than forcing a single label. Treat unreviewed cases as
`unverified` in research notes, **not as a new runtime status or a failed
learner**. Do not merge this draft on the basis of green structural CI alone,
and do not count private model responses or synthetic continuation as
learning outcomes.


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
