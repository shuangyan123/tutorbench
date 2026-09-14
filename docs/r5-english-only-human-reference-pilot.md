# R5-C1 English-only human-reference fallback pilot

Status: **versioned operational specification only; no real reviewer data collected**

Tracking issue: #121

This document defines an English-only first-run fallback for the R5 human-reference workflow. It exists so the first real reviewer run does not depend on resolving the independent bilingual-review evidence tracked by #109.

It does not modify the frozen canonical nine-case pilot, TutorEval cases, rubrics, weights, thresholds, evaluator semantics, Judge prompts, or dataset identity.

## 1. Pilot identity

The fallback identity is:

```text
english-only-tutoreval-human-reference-pilot-001@0.1.0
```

It is derived from, but is **not the same pilot as**:

```text
canonical-tutoreval-human-calibration-pilot-001@0.1.0
```

Shared source identities remain:

```text
dataset: tutor-eval-v0.2a@0.2a.6
annotation guide: canonical-tutoreval-rubric-annotation-guide@0.1.0
reviewer count: 2 independent reviewers
```

The English-only identity must appear in the operator manifest for any real run performed under this fallback. A packet exported under the canonical nine-case pilot identity must not be relabeled after export.

## 2. Frozen English-only case set

The fallback contains exactly these eight English cases and versions, preserving the canonical pilot order after removal of the zh-CN counterpart:

| Order | Case | Version |
| ---: | --- | --- |
| 1 | `fraction-misconception-001` | `1.2.0` |
| 2 | `correct-answer-wrong-reasoning-001` | `1.1.0` |
| 3 | `science-force-transfer-001` | `1.0.0` |
| 4 | `science-density-knowledge-001` | `1.0.0` |
| 5 | `language-verb-check-001` | `1.0.1` |
| 6 | `language-word-context-001` | `1.1.1` |
| 7 | `history-source-bias-001` | `1.0.0` |
| 8 | `programming-function-recall-001` | `1.0.0` |

The excluded case is exactly:

```text
fraction-misconception-001-zh-CN@1.2.0
```

No other case, response, or rubric may be removed merely to simplify reviewer work or improve agreement.

Each retained case keeps the same three fixed developer-authored synthetic response stimuli already frozen by the canonical pilot. Therefore this fallback contains exactly **8 cases and 24 fixed responses**. The actual rubric-judgment count must be computed from the frozen packet at export time and recorded in the manifest; it must not be copied from the 84-judgment canonical count.

## 3. Relationship to #109

This fallback does not resolve or bypass the evidence question in #109.

It deliberately excludes the zh-CN fraction case so that a first English-only human-reference run can proceed without making any bilingual-validation claim. Consequently:

- #109 remains open until its independent bilingual-review evidence requirement is separately satisfied;
- English-only results must not be used as evidence that the EN and zh-CN fraction rubrics are equivalent;
- a successful English-only pilot does not validate the excluded zh-CN case;
- later reintroduction of the bilingual pair requires the canonical nine-case pilot or another separately versioned bilingual protocol.

## 4. Task-set fingerprint

Every exported English-only run must compute a fresh SHA-256 task-set fingerprint from the actual reviewer-visible frozen task set. The fingerprint is an identity binding, not a semantic quality claim.

The fingerprint input must deterministically bind, in stable order:

1. pilot ID and version;
2. dataset ID and version;
3. annotation guide ID, version, and guide SHA-256 fingerprint;
4. retained case IDs and case versions;
5. retained response IDs and exact response text;
6. every reviewer-visible rubric identity and scoring-relevant rubric content attached to each retained case/response task;
7. reviewer-visible context produced by the existing positive-allowlist calibration packet boundary.

The serialization used for hashing must be deterministic. Object-key order and task order must be normalized before hashing so re-exporting the unchanged pilot produces the same fingerprint.

The operator manifest must record:

```text
pilotId
pilotVersion
datasetId
datasetVersion
annotationGuideId
annotationGuideVersion
annotationGuideFingerprint
taskSetFingerprint
caseCount
responseCount
rubricJudgmentCountPerReviewer
reviewerCount
selectedCases
humanCalibrationDataPresent: false
stimulusProvenance: developer-authored-synthetic
```

A changed dataset, case version, response, rubric, guide, reviewer-visible context, or pilot version must produce a different task-set fingerprint. Do not reuse a prior fingerprint after any such change.

## 5. Export rule

R5-C1 does not authorize a real reviewer campaign. It defines what a later executable export must do before any reviewer packet may be sent.

A conforming export must:

1. rebuild the canonical `0.2a.6` pilot source through the existing code path rather than copying checked-in JSON by hand;
2. select only the eight case/version pairs listed above;
3. retain all three canonical response stimuli for every retained case;
4. build reviewer-visible rubric tasks through the existing blind `buildCalibrationPacket()` boundary;
5. compute and record the English-only task-set fingerprint defined above;
6. produce two reviewer-owned empty submission templates using opaque reviewer pseudonyms;
7. bind each template to the English-only pilot identity, dataset identity, guide identity, and task-set fingerprint;
8. output operator-only candidate/manifest material separately from reviewer packets;
9. preserve the existing blindness firewall: no developer expected labels, Judge output, provider/model provenance, other-reviewer annotations, adjudication, or benchmark history in reviewer material;
10. fail closed if the selected case/version set, response count, or reviewer-visible task identities differ from this frozen specification.

Do not implement the fallback by exporting the nine-case canonical pilot and manually deleting the zh-CN rows afterward. Selection and fingerprinting must occur before the final packet/template identities are frozen.

## 6. Import and identity rule

A completed fallback submission is acceptable only when strict import verifies the exact English-only pilot identity and fingerprint used for that reviewer stream.

The operator must reject rather than repair submissions with:

- the canonical nine-case pilot identity;
- a different English-only pilot version;
- stale or mismatched task-set or guide fingerprints;
- wrong reviewer ownership;
- missing, duplicate, or extra annotation slots;
- altered case, response, rubric, dataset, or guide identities;
- incomplete required fields or malformed `UNSURE` ambiguity records.

A canonical-pilot submission and an English-only submission are not interchangeable even where some task rows are identical.

## 7. Reviewer qualification

The reviewer qualification, independence, privacy, conflict disclosure, blindness, compromised-stream, handoff, adjudication, and private-data rules in `docs/r5-human-reference-operations.md` remain authoritative.

Because this fallback contains English tasks only, zh-CN competence is not required for participation in this specific pilot. Reviewers still require documented English instruction comprehension and sufficient subject/teaching competence for the assigned task set.

Removing the bilingual requirement does not remove the independence requirement.

## 8. Agreement and reference construction

If a later separately authorized real run uses this fallback:

1. two qualified reviewers complete the same English-only task set independently;
2. both submissions pass strict identity/import validation;
3. human-human agreement is inspected before adjudication;
4. original reviewer streams remain immutable;
5. disagreements and `UNSURE` items are explicitly adjudicated where needed;
6. the derived reference is frozen and versioned against this exact English-only pilot identity and task-set fingerprint.

There is no automatic agreement or kappa threshold that converts the run into a validated scale.

## 9. Claim boundary

After a complete real run, the strongest default claim supported by this fallback is:

> Human reference established for `english-only-tutoreval-human-reference-pilot-001@0.1.0` over its frozen English-only task set.

It does **not** establish:

- human reference for the excluded zh-CN fraction case;
- EN/zh-CN semantic, measurement, or psychometric equivalence;
- resolution of #109;
- validation of rubric/category weights or the `0.75` threshold;
- Judge-vs-human calibration;
- a validated general tutoring-ability scale;
- learning, retention, transfer, or classroom impact;
- statistical model superiority, Elo, ranking, leaderboard order, or public model eligibility.

Any Judge-vs-human comparison remains a later separately authorized step after the English-only human reference has been frozen.

## 10. R5-C1 stop boundary

At completion of this preparation phase:

```text
R5-C1 ENGLISH-ONLY FALLBACK SPECIFICATION FROZEN
REAL REVIEWER CAMPAIGN NOT STARTED
REAL HUMAN ANNOTATIONS NOT COLLECTED
HUMAN REFERENCE NOT ESTABLISHED
#109 NOT RESOLVED
JUDGE-VS-HUMAN CALIBRATION NOT STARTED
```

The next execution phase requires separate authorization before sending real task packets, accepting completed real submissions, or importing real reviewer data.
