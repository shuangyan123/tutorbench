# R5 real human-reference pilot operations

Status: **operational preparation only; no real reviewer data collected**

Tracking issue: #121

This document defines the operational boundary for the first real independent
human-reference run over the existing canonical TutorEval calibration pilot. It
does not change TutorEval cases, rubrics, weights, thresholds, evaluator
semantics, Judge prompts, or the frozen pilot task set.

The underlying reviewer-ready pilot remains:

```text
canonical-tutoreval-human-calibration-pilot-001@0.1.0
tutor-eval-v0.2a@0.2a.6
canonical-tutoreval-rubric-annotation-guide@0.1.0
```

The existing export/import, agreement, adjudication, and reference-set workflow
in `docs/canonical-human-calibration-pilot.md` remains authoritative for the
technical mechanics. This document adds the human qualification, privacy,
provenance, handoff, and stop rules needed before real annotations are accepted.

An English-only first-run fallback is separately frozen by
`docs/r5-english-only-human-reference-pilot.md` as
`english-only-tutoreval-human-reference-pilot-001@0.1.0`. It is a distinct
pilot identity and must not be produced by manually deleting zh-CN rows from a
canonical nine-case export.

## 1. Evidence boundary

A real run may support only a narrow claim after all required steps are complete:

> Human reference established for this frozen pilot task set.

That statement means that qualified independent reviewers completed the frozen
pilot, disagreements and `UNSURE` judgments were handled through the documented
adjudication path, and the resulting reference is bound to the exact pilot,
dataset, case, rubric, response, guide, and reviewer-stream identities.

It does **not** establish:

- a validated general tutoring-ability scale;
- learner learning, retention, transfer, satisfaction, or classroom impact;
- empirical validation of the `0.75` threshold, rubric weights, or category
  weights;
- English/zh-CN measurement invariance or psychometric equivalence;
- Judge-vs-human calibration;
- statistical superiority of one Tutor/model over another;
- Elo, ranking, leaderboard order, or public model eligibility.

## 2. Reviewer qualification

Each reviewer must be a real human and must provide enough private operator-side
information to justify the role. Qualification is a documented eligibility
judgment, not an automatic credential threshold.

Minimum requirements for the canonical nine-case pilot:

1. **Independence** — the reviewer did not author the affected TutorEval cases,
   fixed pilot responses, annotation labels, Judge outputs, or adjudications and
   is not making the maintenance decision being reviewed.
2. **Instruction comprehension** — the reviewer can read and apply the frozen
   annotation guide and can distinguish `PASS`, `PARTIAL`, `FAIL`, and `UNSURE`.
3. **Subject competence** — the reviewer has sufficient educational, teaching,
   tutoring, subject-matter, or closely related experience to judge the visible
   teaching behavior in the selected pilot cases.
4. **Language competence** — for any reviewer assigned the current canonical
   EN/zh-CN fraction pair, the operator must document adequate English and
   Simplified Chinese comprehension for mathematics instruction. Self-report
   may be used for a small pilot but must be retained as provenance rather than
   treated as a psychometric language assessment.
5. **Conflict disclosure** — the reviewer declares any relationship to
   TutorBench, the maintainers, the benchmark cases, or the organization paying
   for the review. A disclosed relationship is assessed by the operator; it is
   not silently ignored.
6. **Blindness agreement** — the reviewer agrees not to seek Judge outputs,
   developer expected labels, the other reviewer's answers, adjudications, or
   benchmark result history before completing their own submission.

A professor, formal researcher title, or AI-benchmark background is **not** a
requirement. For this pilot, a qualified mathematics/education practitioner,
teacher, tutor, or appropriately experienced graduate-level reviewer may be
sufficient when the operator documents the basis for qualification.

### Reviewer qualification record

Keep a private operator record containing at least:

```text
reviewer pseudonym:
contact channel:
qualification basis:
EN competence basis:
zh-CN competence basis (when applicable):
subject/teaching experience:
conflict-of-interest declaration:
independence determination:
qualification decision: eligible | not-eligible | limited-scope
operator rationale:
date:
```

Real names, email addresses, private-message handles, phone numbers, payment
information, or other identifying contact data must not be copied into public
benchmark artifacts.

## 3. Reviewer identity and privacy

Repository-facing and artifact-facing reviewer identity is an opaque pseudonym
such as `reviewer-a` or `reviewer-b`. The mapping from that pseudonym to a real
person is private operator metadata.

Keep the following out of the public repository:

- real reviewer names and contact details;
- screenshots or exports of private messages;
- payment information;
- completed real reviewer submission files;
- imported real annotation files;
- raw agreement reports derived from real annotations unless a later explicit
  governance decision approves a reviewed anonymized publication boundary;
- real adjudication files and private adjudicator identity mapping.

The repository already ignores `artifacts/` and `data/private/`; use private
local/encrypted storage or a separate access-controlled store for real-run
materials. Do not rely on a public GitHub issue as the storage location for
completed annotations.

Public provenance may record non-identifying facts such as reviewer count,
qualification categories, the exact frozen pilot identity, whether adjudication
occurred, and aggregate agreement measures only after an explicit publication
review.

## 4. Blindness boundary

Before independent completion, reviewer A must not receive reviewer B's files
and reviewer B must not receive reviewer A's files. Neither reviewer receives:

- developer expected labels;
- Judge labels, evidence, reasoning, or provider output;
- the other reviewer's labels/evidence;
- adjudication outcomes;
- leaderboard/model identity or performance history;
- operator preference for a desired answer.

The reviewer receives only the exported packet/template/guide/instructions for
their pseudonymous stream. The operator may answer procedural questions but
must not resolve a live rubric judgment for the reviewer.

If a reviewer has been materially exposed to the other reviewer's answers,
Judge answers, or developer expected labels before completing their stream,
mark the stream **compromised** and do not use it as independent evidence.

## 5. #109 bilingual-review gate

Issue #109 tracks independent bilingual semantic validation of the corrected
`fraction-misconception-001@1.2.0` EN/zh-CN pair. The current `0.2a.6` text has
already been structurally corrected, but the repository does not yet contain
independent qualified bilingual human sign-off.

Therefore:

- do not describe the current fraction pair as independently bilingual-validated;
- do not use a completed R5 pilot as evidence of cross-locale equivalence;
- before a real run of the **full canonical nine-case pilot**, obtain an
  independent bilingual qualification/sign-off adequate for #109 or explicitly
  record #109 as an unresolved limitation and prevent any claim that depends on
  bilingual validation;
- if the project later chooses an English-only first-run subset, use the
  separately versioned identity and fingerprint rules in
  `docs/r5-english-only-human-reference-pilot.md`. Do not silently remove the
  zh-CN task from the existing frozen canonical pilot.

R5 does not auto-close #109.

## 6. Handoff protocol

When a candidate reviewer agrees to participate, the operator performs these
steps before sending the task:

1. collect the private qualification record;
2. decide `eligible`, `not-eligible`, or `limited-scope` and record why;
3. assign an opaque pseudonym;
4. export the frozen reviewer package using the existing canonical pilot
   command or a separately versioned, conforming fallback exporter;
5. verify the pilot/dataset/guide identities and manifest fingerprint;
6. send only that reviewer's packet, submission template, annotation guide, and
   reviewer instructions;
7. tell the reviewer not to search for project expected answers or exchange
   answers with another reviewer;
8. ask the reviewer to return only their completed submission through the
   agreed private channel.

### Short invitation text

A low-pressure invitation may use wording like:

```text
你好，我在维护一个开源 AI 教学能力评测项目。现在想请一位与项目无关、
有相关教学/数学经验的人独立看一小组教学评分标准。任务不是测试 AI，主要
是按照给定说明判断回答是否满足教学要求。材料有限，不要求长期参与。
如果你愿意，我会先发完整说明；如果不方便也完全没关系。
```

Do not send the maintainer's preferred rubric interpretation or prior review
answers in the invitation.

## 7. Reviewer declaration

Before a real submission is accepted as independent evidence, retain a private
reviewer declaration with:

```text
I completed this review independently.
I did not see the other reviewer's answers before completing my submission.
I did not use Judge/model outputs or developer expected labels as answer keys.
I disclosed relevant conflicts of interest to the operator.
The qualification information I provided is accurate to the best of my knowledge.

reviewer pseudonym:
date:
```

For tasks containing the EN/zh-CN fraction pair, also record the basis on which
the reviewer is considered able to understand both mathematics-language
versions.

## 8. Import and stop rules

The operator must stop rather than repair a real submission by hand when:

- the reviewer/package/guide/fingerprint identity is stale or mismatched;
- required task slots are missing, duplicated, or added;
- a reviewer changes case/rubric/response ownership fields;
- an `UNSURE` judgment lacks the required ambiguity record;
- the submission is incomplete;
- independence was compromised;
- the reviewer is later found not to satisfy the documented qualification scope.

Use the existing strict import path for the matching pilot identity. Do not copy
labels into a fresh template to make an invalid submission pass. If a
procedural correction is necessary, send the untouched original
template/package back to that reviewer and have the reviewer produce a corrected
submission themselves.

## 9. Agreement before adjudication

After two valid independent streams are imported:

1. run the existing agreement report **without adjudication**;
2. inspect coverage, exact disagreement identities, `UNSURE`, and ambiguity;
3. preserve both reviewer streams unchanged;
4. create adjudication only for disagreement/`UNSURE` items that require a final
   reference label;
5. use a pseudonymous adjudicator identity and retain source annotation IDs and
   rationale;
6. rerun the reference-set path only after explicit adjudication is complete.

There is no automatic agreement, kappa, or coverage threshold that establishes
validity or calibration. Low agreement is evidence to investigate, not a reason
to weaken the rubric or overwrite reviewer answers.

## 10. Adjudicator separation

Where practical, use an adjudicator who was not one of the two original
reviewers. If the pilot must use one of the original reviewers as adjudicator,
record that limitation explicitly and do not describe the adjudication as fully
independent.

The adjudicator may see the two source judgments only after both independent
streams are frozen. The adjudicator must not rewrite the original reviewer
files.

## 11. Judge comparison gate

Do not run or claim Judge-vs-human calibration until:

- two qualified independent reviewer streams are valid;
- human-human agreement has been inspected;
- required adjudication is complete;
- the human reference set is frozen and versioned;
- any known scope limitation, including #109, is recorded;
- a separate task authorization covers the Judge/provider run or provider-free
  comparison being proposed.

A frozen human reference authorizes no automatic Judge prompt tuning and no
ranking/leaderboard claim.

## 12. Operator checklist

Before sending a real packet:

```text
[ ] exact pilot identity verified
[ ] exact dataset identity verified
[ ] exact guide identity verified
[ ] reviewer qualification record complete
[ ] independence/conflict review complete
[ ] language scope adequate for assigned tasks
[ ] #109 state checked for bilingual pair
[ ] opaque reviewer pseudonym assigned
[ ] packet/template fingerprint verified
[ ] other reviewer/Judge/developer labels excluded
[ ] private return channel agreed
```

Before accepting a human reference:

```text
[ ] both reviewer streams independently completed
[ ] strict import succeeds without hand-repaired labels
[ ] human-human agreement inspected first
[ ] original streams frozen unchanged
[ ] disagreements/UNSURE explicitly adjudicated where required
[ ] reference set bound to exact source identities
[ ] privacy/provenance boundary reviewed
[ ] claim limited to this frozen pilot
[ ] no Judge-vs-human/ranking/validity claim inferred
```

## 13. Current R5 readiness disposition

At this operational-preparation stage:

```text
R5-B OPERATIONAL PACKAGE READY FOR REVIEW
R5-C1 ENGLISH-ONLY FALLBACK SPECIFICATION FROZEN
REAL HUMAN ANNOTATION NOT STARTED
HUMAN REFERENCE NOT ESTABLISHED
JUDGE-VS-HUMAN CALIBRATION NOT STARTED
```

A real reviewer campaign/run remains a separate execution boundary. Starting
collection or importing real completed reviewer files requires explicit task
scope and must preserve every rule above.
