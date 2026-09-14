# R5-C2 English-only pilot executable boundary

Status: **executable export/import boundary implemented; no real reviewer packets sent and no real human data imported**

Tracking issue: #121

This phase implements the executable boundary for the separately versioned fallback defined in `docs/r5-english-only-human-reference-pilot.md`:

```text
english-only-tutoreval-human-reference-pilot-001@0.1.0
```

It does not change TutorEval cases, rubrics, weights, thresholds, evaluator semantics, Judge prompts, the canonical nine-case pilot, or issue #109.

## Export

Generate the frozen eight-case English-only reviewer package with two opaque reviewer pseudonyms:

```bash
npm run calibration:english-only:export -- \
  --reviewer reviewer-a \
  --reviewer reviewer-b \
  --output-dir artifacts/english-only-tutoreval-human-reference-pilot-001
```

The command rebuilds the canonical `0.2a.6` pilot source through the existing implementation, selects the exact eight English case/version pairs before final packet identity is frozen, retains all three fixed synthetic responses per case, rebuilds reviewer-visible tasks through `buildCalibrationPacket()`, and emits:

```text
operator/candidate-responses.json
operator/pilot-manifest.json
reviewer-a/review-packet.json
reviewer-a/submission-template.json
reviewer-a/ANNOTATION_GUIDE.md
reviewer-a/REVIEWER_INSTRUCTIONS.md
reviewer-b/...
```

The manifest records a deterministic SHA-256 task-set fingerprint bound to the English-only pilot identity, dataset/guide identities, selected cases, exact response text, and reviewer-visible packet entries. Reviewer IDs are not part of that task-set identity.

The executable boundary fails closed if the frozen case/version selection, response counts, canonical source identities, or reviewer-visible task identities drift.

## Import

After a separately authorized real reviewer run, a completed submission can be validated with:

```bash
npm run calibration:english-only:import -- \
  --template artifacts/english-only-tutoreval-human-reference-pilot-001/reviewer-a/submission-template.json \
  --submission /private/path/reviewer-a.completed.json \
  --output /private/path/reviewer-a.annotations.json
```

Import reconstructs the expected frozen template and rejects identity changes rather than repairing them. It verifies the exact pilot/version, dataset, guide fingerprint, task-set fingerprint, reviewer ownership, annotation slots, labels, evidence bounds, and `UNSURE` ambiguity requirements.

Canonical nine-case templates/submissions and English-only templates/submissions are intentionally not interchangeable.

## Privacy and execution boundary

This implementation is tooling readiness only. It does not authorize or perform:

- reviewer recruitment or additional contact;
- sending a reviewer packet;
- accepting or importing real reviewer data in this repository;
- committing completed reviewer files;
- adjudication;
- human-reference generation;
- Judge-vs-human comparison;
- resolution of #109;
- bilingual-equivalence, calibration, psychometric, ranking, or learner-outcome claims.

Real reviewer identity/contact records and completed submissions remain private under `docs/r5-human-reference-operations.md`.

## Current disposition

```text
R5-C2 EXECUTABLE ENGLISH-ONLY EXPORT/IMPORT BOUNDARY IMPLEMENTED
REAL REVIEWER CAMPAIGN NOT STARTED BY THIS PHASE
REAL HUMAN ANNOTATIONS NOT COLLECTED OR IMPORTED
HUMAN REFERENCE NOT ESTABLISHED
#109 NOT RESOLVED
JUDGE-VS-HUMAN CALIBRATION NOT STARTED
```
