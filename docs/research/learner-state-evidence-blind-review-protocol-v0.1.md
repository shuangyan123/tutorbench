# Blind construct review of synthetic learner evidence — v0.1

**Status: reviewer packet prepared; zero independent human submissions or
adjudications received.** This protocol is for **semantic validity of a
learner-evidence attribution**, not ranking Tutor responses, calibrating an
LLM Judge, measuring real student learning or authorizing canonical labels.

This narrow protocol follows the existing
[Case System vNext independent expert review](../../docs/case-system-vnext-expert-review.md)
and [human calibration operations](../../docs/r5-human-reference-operations.md)
for reviewer qualification, blinding, independent submissions, disagreement
handling and manual promotion boundaries. **Do not run the Case System
A/B-response exporter** for these tasks: it compares candidate Tutor replies,
whereas this packet asks what can be inferred from learner utterances.

## Reviewer-visible materials

Supply a **copy of only** the following files to each reviewer, without a
link to the source repository or PR:

- `scenarios/experimental/learner-state-evidence-v0.1/construct-blind-packet-v0.1.json`
- `scenarios/experimental/learner-state-evidence-v0.1/construct-blind-submission-template-v0.1.json`
- This instruction document

The packet contains **nine** English-language, author-synthetic transcripts
and **14** concept-specific prompts. Its task IDs are opaque. It includes
student/Tutor turn order, a shared mathematics objective, and neutral concept
questions. It contains **no authored epistemic-status choices, scenario IDs,
expected teaching actions, evaluator-only misconception references, Judge
results or model/provider identities**. None are records of real learners.

**Blinding is procedural, not cryptographic.** Since the underlying sources
are in a public code repository, a reviewer who searches the repo, PR, matrix
or distinctive quotes could recover the author labels. Distribute isolated
copies, ask reviewers not to consult other material, and record any exposure.
Compromised blinding must be disclosed rather than silently ignored.

## Reviewer qualification and independent assignment

Use at least **two independent reviewers** comfortable with English,
upper-primary fraction concepts, mathematics education and assessment. They
must not have authored the vignettes or state labels and should not see each
other's submissions until both are locked.

- Reviewer A works through tasks `LR-01` to `LR-09` in ascending order.
- Reviewer B works through the same tasks in descending order.
- Each reviewer completes **every** `reviewTarget` independently (14
  target-level judgments) and uses their own opaque `reviewerId`.
- A third qualified reviewer should adjudicate material disagreement or
  ambiguity without seeing a manufactured consensus.

The packet mixes original source snapshots and constructed adversarial
controls, but does **not** reveal their positions or expected interpretations
to reviewers.

## Target-level review rubric

For each `reviewTarget`, read the **entire local transcript** and decide
what the learner's *words and visible interaction history* support about the
named concept. Use the most specific of the following statuses only when
warranted:

| `selectedStatus` | What must be visible |
| --- | --- |
| `unknown` | No specific concept-level status is warranted by the provided evidence |
| `explicit_gap` | Learner explicitly says they do not understand the named prerequisite; this remains a self-report of difficulty |
| `misconception_stated` | Learner states a rule **that the reviewer independently verifies is false** for that concept |
| `reported_only` | Learner reports knowledge or confidence without independent demonstration |
| `stated_definition` | Learner states a definition independently checked as correct for the named concept |
| `supported_local` | Learner correctly paraphrases/reuses relevant reasoning after actual visible Tutor support |
| `demonstrated_local` | Learner presents locally correct reasoning with no relevant preceding Tutor hint visible in this packet |

For each judgment, fill the blank JSON template:

- `selectedStatus`: one of the seven values above (or leave blank if the
  packet itself is impossible to assess, with explanation);
- `supportJudgment`: `supported`, `ambiguous`, `contradicted`, or
  `not_assessable`;
- `learnerTurnIndex`: one-based **USER-turn index** for cited evidence (not
  the overall conversation-message index), or `null` for no citation;
- `exactLearnerQuote`: a literal excerpt from that learner turn (empty for
  an unwarranted/unknown status);
- `alternativeInterpretation`: a plausible other explanation or the
  reason a more specific diagnosis is premature;
- `acceptableNextMove`: one or more nonexclusive instructional actions
  that fit the observed evidence;
- `notes`: task ambiguity or missing context.

Mark `independentReviewAcknowledgement` true only if completed without
exposure to source labels or other reviewers' answers. Do **not** insert real
names, institutional identifiers, personal student histories or private
model messages into the public repository.

**Important reasoning rules:** a wrong numeric result does not identify its
cause; asking how to proceed is not proof of an absent prerequisite; a
learner's correct definition is not independent application; merely repeating
a Tutor's sentence is not independent mastery; and a correct local
observation does not establish near-transfer or durable learning.

If semantics are underdetermined, prefer `unknown`/`ambiguous` with a
specific explanation. A literal quote match alone is insufficient for
`stated_definition`, `misconception_stated`, `supported_local`, or
`demonstrated_local`: assess mathematical correctness, concept relevance
and prompt contamination.

## Operator verification, interpretation and promotion gate

The operator, **not the reviewers**, retains the original author synthetic
source, matrix, versioned concept crosswalk and mapping of opaque task IDs to
source vignettes. The packet's five source transcripts must match the frozen
source exactly; the four adversarial transcripts are additional synthetic
controls, not new observed students. The accompanying code regression tests
check this identity and that the reviewer packet does not disclose labels.

Before comparing with authored labels, verify two independent completed
templates: identical `packetId`/`packetVersion`, exact 14
`reviewTaskId`+`targetId` pairs, no duplicates or omissions, literal
evidence quotes in one-based learner turns, and declared blinding status.
Reject unverifiable/stale submissions and preserve original files. Only then
unblind and compare to the existing, unchanged author-synthetic matrix.

Record agreement and substantive disagreement **per concept target**, not
just per five-vignette scenario. Report denominators: 14/14 attempted by
each reviewer, how many were assessable, which were ambiguous, which
disagreed, and which survived independent adjudication. Do not force a
majority label or collapse `ambiguous` into `FAIL`. Document why any
author label is contradicted, and correct it **only** after an independent
review record supports a change.

The existing vNext source-index bridge and PR #349 quote parser remain
authoritative for structured lineage and syntactic checks. This review is
an external *construct validity* gate: it does not alter Tutor-visible
state, the mathematics knowledge map, Case System D/P/H, TutorEval rubrics,
Health weights or the Judge.

**Current release decision:** `NO HUMAN GOLD`; `NO CANONICAL PROMOTION`;
`NO REAL LEARNER OUTCOME`. A green no-provider test run validates only
review packet consistency, not the correctness of any potential judgment.
