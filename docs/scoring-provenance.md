# TutorEval scoring provenance

Current repository runs retain the v1 result envelope and add
`scoringProvenance@1`. It records the effective configuration, its canonical
SHA-256 identity, `tutor-eval-aggregate@1`, and the minimum authored case/rubric
inputs needed for aggregation. Object key order and quality-gate failure-type
order do not change the configuration identity. Rubric order remains an
authored scoring input.

Configuration validation accepts finite criterion scores and finite thresholds
in the caller's units, including values above one or below zero. Category
weights must be finite and nonnegative, with at least one positive weight.
Gate types must be known and distinct, and the minimum severity must be known.
No new score ordering or calibration policy is inferred. Defaults, required /
desirable / prohibited eligibility, and normalized rubric encodings remain
unchanged. Ordinary arithmetic retains its existing order and four-decimal
rounding; finite extreme scales use overflow-safe averaging.

With provenance present, imports verify the configuration identity and
recompute case/category/run scores, pass eligibility, and quality gates from
the recorded inputs and normalized evidence. Contradictions are rejected.
Missing source evidence can still be unresolved: arithmetic consistency does
not authenticate a Judge response. When authored data is available, Health,
diagnostic comparison, and resume also bind the recorded inputs to that data.
If any planned case/run is missing or has an evaluation error, current run-level
category and overall aggregates are `null`. Available case-level scores and
confirmed failure signals remain usable; partial Health scores cannot turn an
incomplete Release Gate into PASS.

Historical v1 results without provenance retain their original parsing bounds.
Successful parsing does **not** establish default scoring or valid aggregates.
Health can retain supported normalized rubric evidence, but missing scoring
identity prevents a new Release Gate PASS. New Health comparisons require
equal recorded TutorEval scoring identities as well as equal Health profiles;
saved historical comparisons remain readable with an explicit unverified
scoring notice and their original counts.

TutorEval category/overall scores use the configured scale. Tutor Health uses
normalized rubric evidence on its independent 0–100 dimension/profile scale;
it does not reinterpret a custom TutorEval PASS=2 as a Health score of 200.
The recorded TutorEval gate configuration participates in Release Gate
interpretation. These are distinct summaries, not interchangeable scores.

Corpus resume checks both the wrapper's explicit scoring configuration and
authored inputs before reusing completed cases. A historical wrapper with a
recorded configuration can have its case arithmetic verified while its
unverifiable stored run aggregate is ignored and recomputed for the new run.
A wrapper with no scoring configuration cannot be resumed. No historical file
is rewritten or given an assumed default configuration.

The local preliminary-publication builder also verifies recorded scoring
against its authored dataset. A legacy wrapper's explicit configuration can
support this check; absence of both configuration and provenance blocks the
build. New public bundles carry a scoring identity. Historical public bundles
may omit it and remain readable with unknown scoring identity. Public v1
retains its 0–1 numeric format, so custom units outside that format are rejected,
not clamped or relabeled. No publication or deployment is performed by this
contract change.

Provenance proves internal configuration/arithmetic consistency, not real
provider execution, independent authorship, human calibration, or learning
outcomes. It cannot retrospectively verify the aggregate of a standalone
historical result that omitted its scoring inputs.
