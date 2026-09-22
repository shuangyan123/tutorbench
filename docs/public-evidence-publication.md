# Public Evidence Publication Pipeline v1

TutorBench keeps private model evidence separate from the public Teachometry
website. The v1 pipeline is an offline, fail-closed transformation for a
future reviewed model run:

```text
freeze
  -> evaluate
  -> inspect exact source hashes
  -> approve exact source hashes
  -> build an allow-listed bundle
  -> validate the generated files
  -> separate, intentional website integration
```

A publication bundle is not automatically a public website release. The
pipeline never writes `website/dist`, checked-in public JSON, or website data.
The default website build therefore continues to report no calibrated public
model runs and no public model trials.

## Current v1 boundary

The source pair must be a complete current canonical corpus and its matching
`TutorBaselineEvaluationArtifact`. The corpus and every response must use
`recorded_model` provenance, the current dataset and evaluator identities, and
the current `baseline-native-default` generation specification. The evaluation
must cover every frozen case-run, contain a Judge descriptor, and have no
execution errors, unresolved rubric results, or null required scores. A failed
benchmark case is valid evidence; an unresolved evaluation error is not.

The publication status is always:

```text
status = preliminary
calibrationStatus = uncalibrated
judgeEvidenceStatus = preliminary
publicLeaderboardEligible = false
```

The approval manifest is a maintainer publication decision. It is not human
calibration, a human reference, community review, or independent review. It
contains no reviewer identity or credential. The manifest must acknowledge
that Judge output is not ground truth and that the bundle makes no learning
outcome claim.

## Commands

All three commands are offline-only. They make no Tutor, provider, Judge, or
network call. They do not commit, push, open a PR, release, publish, or modify
the website.

Inspect source evidence without producing public artifacts:

```bash
npm run publication:inspect -- -- \
  --corpus path/to/corpus.json \
  --evaluation path/to/evaluation.json \
  --output path/to/publication-inspection.json
```

The report is a safe review aid. A passing report is not approval. It includes
exact source SHA-256 fingerprints in the form `sha256:<64 lowercase hex>` and
stable gate codes, but no Tutor response text, Judge evidence, private
diagnostics, paths, provider payloads, or credentials.

Create the local candidate bundle only with an explicit approval manifest:

```bash
npm run publication:build -- -- \
  --corpus path/to/corpus.json \
  --evaluation path/to/evaluation.json \
  --approval path/to/approval.json \
  --output-dir path/to/new-publication
```

The output directory contains deterministic `publication.json`, `models.json`,
and `trials.json`. The builder refuses an existing output directory and writes
the directory only after source gates, approval hashes, sanitization, and
output validation pass.

Validate an already-created candidate without the private sources:

```bash
npm run publication:validate -- -- \
  --publication path/to/new-publication/publication.json \
  --models path/to/new-publication/models.json \
  --trials path/to/new-publication/trials.json
```

## Approval manifest

The manifest is deliberately small and exact. Both hashes must be copied from
the inspection report, and every acknowledgement must be changed deliberately
to `true` by the maintainer. This is an illustrative schema only; it does not
describe a real model result and must not be committed with real evidence:

```json
{
  "schemaVersion": 1,
  "publicationId": "example-publication-id",
  "publicationVersion": "1",
  "scope": "preliminary-model-evidence",
  "sourceCorpusSha256": "sha256:<64 lowercase hex>",
  "sourceEvaluationSha256": "sha256:<64 lowercase hex>",
  "publicLeaderboardEligible": false,
  "acknowledgements": {
    "uncalibrated": true,
    "judgeIsNotGroundTruth": true,
    "noLearningOutcomeClaim": true,
    "sourceIdentityReviewed": true,
    "publicSanitizationReviewed": true
  }
}
```

`publicLeaderboardEligible: true` is rejected. There is no override or force
flag. Approval is bound to exact source bytes, not only mutable corpus IDs.

## Public-data firewall

The sanitizer constructs every public object field explicitly. It never spreads
a private source object and deletes fields afterward. Public trials retain the
exact frozen Tutor response as JSON text, safe case-run identity, five stored
category scores, preliminary rubric result projections, critical-failure type
and severity, safe Judge identity, and source operational metrics when
available. It does not expose rubric definitions, evaluator instructions,
Judge evidence prose, diagnostics, ground truth, misconceptions, raw Judge
results, provider payloads, credentials, or absolute paths.

No score interpretation prose, ranking, percentile, winner, tier, star rating,
or comparative claim is generated. The pipeline proves provenance,
sanitization, and contract integrity; it does not prove scientific calibration,
Judge-vs-human validity, or leaderboard eligibility.

## Development without provider quota

Parsers, fingerprints, gates, sanitization, reproducibility, and the private /
public firewall can be tested entirely with local temporary fixtures. Synthetic
fixtures cannot pass the real publication provenance gate. Tests may construct
temporary `recorded_model`-shaped evidence to exercise the successful
transformation, but that is infrastructure testing, not evidence of model
performance. No fixture is shipped as website evidence.

## Future real workflow

When a reviewed real corpus exists, the intended sequence is:

```text
real canonical collect-model
  -> full frozen corpus
  -> completed Judge evaluation
  -> publication:inspect
  -> maintainer review
  -> approval manifest
  -> publication:build
  -> manual review of generated public files
  -> separate website-integration PR
```

This repository currently has no claim that provider quota, a real model run,
human calibration, Judge-vs-human validation, or statistical validation is
available. Community Review remains a separate service and publication policy.
