# Design Partner Report Data Map

Status: **structured-artifact mapping defined; no PDF/Excel renderer in this phase**.

This document maps the information shown in a design-partner Tutor Health report
to existing TutorBench artifacts. The goal is to keep customer-facing reports
grounded in the same versioned evidence used by the evaluator instead of
maintaining a separate hand-authored reporting truth.

A partner report is assembled from three inputs:

```text
private Scenario vNext suite
  + TutorEvalRunResult (evaluation.json)
  + TutorHealthReport (health-report.json)
  -> customer-facing report view
```

The private suite remains the source of authored learner context, expected
behavior, and policy boundaries. `TutorEvalRunResult` remains the source of
actual Tutor output and execution provenance. `TutorHealthReport` remains the
source of Tutor Health scoring, coverage, Findings, evidence references,
recommendations, and regression targets.

CLI runs also produce a small local run manifest binding these inputs; it is
provenance, not an additional source of scores or findings.

## Field map

| Report field | Authoritative source | Notes |
| --- | --- | --- |
| Evaluation date | `TutorEvalRunResult.createdAt` | Run timestamp, not a manually entered report date. |
| Run ID | `TutorEvalRunResult.runId` / `TutorHealthReport.sourceEvaluation.runId` | Must agree. |
| Product / Tutor provider | `TutorEvalRunResult.tutor.provider` | Partner alias may remain private. |
| Product / model / deployment identity | `TutorEvalRunResult.tutor.model` and optional `modelVersion` | Use the partner's agreed provenance convention. |
| Prompt / policy version | `TutorEvalRunResult.tutor.promptVersion` and optional `promptId` | Do not copy private prompt text into the report. |
| Evaluator version | `TutorEvalRunResult.evaluatorVersion` / `TutorHealthReport.sourceEvaluation.evaluatorVersion` | Optional only for historical compatibility. New versioned runs should record it. |
| Scenario suite ID / version | `TutorHealthReport.sourceScenarioSuite` | Must match the private suite identity. |
| Criteria / scoring profile | `TutorHealthReport.scoringProfile.id` and `.version` | The scenario suite contains the actual authored criteria; the scoring profile identifies aggregation. |
| Coverage | `TutorHealthReport.coverage` | Includes assessed dimensions and expected/present case-runs. |
| Tutor Health Score | `TutorHealthReport.healthScore` | Descriptive attention summary; not the diagnostic source of truth. |
| Release Gate | `TutorHealthReport.releaseGate` | PASS / FAIL / UNRESOLVED. |
| Finding counts | `TutorHealthReport.findingCounts` | Severity counts only. |
| Dimension snapshot | `TutorHealthReport.dimensionScores` | Null means no scored evidence for that dimension. |
| Scenario title / subject / learner level / objective | private suite `scenario.identity` and `scenario.learningContext` | Customer report should resolve by `Finding.scenarioId`. |
| Decision point | private suite `scenario.decisionPoints[]` | Resolve by `Finding.location.decisionPointId` when present. |
| Expected behavior | `TutorFinding.expectedBehavior` | Copied from the versioned scenario decision point by the report builder. |
| Observed behavior | `TutorFinding.observedBehavior` | Authored failure presentation tied to failed evaluator evidence; not hidden Judge rationale. |
| Finding title / severity / dimension | `TutorFinding.title`, `.severity`, `.dimension` | Direct report fields. |
| Evidence references | `TutorFinding.evidence` | Resolve references into bounded scenario turns, rubric results, or critical-failure records. |
| Tutor response excerpt | matching `TutorEvalCaseRunResult.rawTutorResponse` | Resolve using the Finding's scenario/case evidence and run index. Do not use provider hidden reasoning. |
| Learner/context excerpt | private suite `trajectory.conversationHistory` | Include only the minimum Tutor-visible turns needed to understand the decision point. |
| Diagnosis | `TutorFinding.diagnosis` | Evidence-bounded; not a proven internal root cause. |
| Impact | `TutorFinding.impact` | Authored product/learner impact for the violated criterion. |
| Likely causes | `TutorFinding.likelyCauses` | Hypotheses with uncalibrated confidence, not causal probabilities. |
| Actionable recommendation | `TutorFinding.recommendations` | Keep diagnostic recommendations distinct from implementation suggestions. |
| Regression target | `TutorFinding.regressionTargets` | Exact decision point to rerun after change. |
| Unresolved evidence | `TutorHealthReport.unresolved` | Must remain explicit; missing evidence is not a pass. |
| Judge identity | `TutorEvalRunResult.judge` | Include only provider/model/version metadata when useful; never raw hidden reasoning. |

## Local run manifest

Every artifact-writing `tutorbench health` run adds `pilot-run-manifest.json`.
The runtime-validated contract is `TutorHealthRunManifest`:

| Field | Meaning |
| --- | --- |
| `kind` / `schemaVersion` | `"tutor-health-run-manifest"` / `1`. |
| `provenance` | Always `"local_execution_only"`. |
| `suite.id`, `.version`, `.sha256` | Identity and canonical SHA-256 of the complete validated suite snapshot used in memory for this run. |
| `evaluation.runId`, `.evaluatorVersion`, `.sha256` | Existing execution identity and SHA-256 of the exact written `evaluation.json` UTF-8 bytes. |
| `report.schemaVersion`, `.sha256` | Health report schema `2` and SHA-256 of the exact written `health-report.json` UTF-8 bytes. |
| `tutor` | Required provider/model/promptVersion; optional existing modelVersion, promptId, temperature, reasoningEffort, seed. |
| `judge` | `null` when absent; otherwise the same bounded provenance fields plus existing thinkingMode, maxOutputTokens, timeoutMs, maxAttempts. |
| `runsPerCase` | Positive safe integer from the evaluation. |

Digests are lowercase 64-character SHA-256 hex strings. Suite canonicalization
reuses the comparison's sorted-key compact JSON: undefined object properties
are omitted, array order is retained, and no trailing newline is hashed. Object
key order and JSON whitespace do not affect the suite hash. Changes to authored
criteria, policy, conversation, array order, or even descriptive suite text do.
The complete suite is hashed; none of its hidden criteria or conversation is
copied into the manifest.

Evaluation and report digests bind file bytes, including two-space formatting
and the final newline. Each artifact is serialized once, then that same string
is hashed and written. Reformatting either file changes its manifest hash even
if the parsed JSON is equivalent. These byte digests intentionally differ from
the canonical evaluation/report digests in `comparison.json`. The manifest
itself uses sorted-key, two-space JSON plus one newline. It adds no timestamp or
random ID; the same preserved inputs and serialized source strings produce
identical manifest bytes. `health-report.txt` is a presentation, not a hashed
source in this version.

`parseTutorHealthRunManifest`, `isTutorHealthRunManifest`, and
`assertValidTutorHealthRunManifest` reject unsupported versions, missing or
malformed identity, invalid hashes, unknown fields, and unbounded descriptors.
`buildTutorHealthRunManifest({ suite, evaluationJson, reportJson })` validates
the source schemas and cross-checks suite/run/evaluator identity;
`formatTutorHealthRunManifest` emits deterministic JSON, and
`verifyTutorHealthRunManifest` recomputes the complete manifest from the supplied
suite and exact source strings. The manifest parser alone does not verify source
files or scoring semantics. Legacy evaluation/report parsers are unchanged.

This manifest does not contain endpoints, credentials, prompt bodies, raw Tutor
responses, raw Judge results, hidden reasoning, or conversation history. Use
non-secret labels in all declared provenance fields. It remains private by
default along with the suite and source artifacts, which can contain sensitive
evidence. It is not provider attestation: declared Tutor/Judge metadata does
not prove the remote system used that model, prompt, deployment, or configuration.
It is unsigned and cannot detect coordinated replacement of sources and their
manifest. Publication permission remains separate, and a real design-partner
validation loop has not yet been completed.

## Before / after tracking

Baseline and candidate runs already preserve the identities needed for a
before/after report:

- run ID and timestamp;
- Tutor provider/model/configuration;
- prompt/policy version;
- suite ID/version;
- scoring profile ID/version;
- evaluator version;
- Judge provider/model identity when used;
- Finding scenario/type and regression targets.

`TutorHealthComparison` is the canonical automated comparison artifact:
`kind: "tutor-health-comparison"`, `schemaVersion: 1`. Build it with
`compareTutorHealthRuns({ baseline, candidate })` or `tutorbench health-compare`.
Each side supplies the preserved `{ suite, evaluation, report }`. No source is
modified, and no Tutor or Judge is executed. The existing evaluation and Health
report contracts and score semantics remain unchanged.

The CLI also verifies `pilot-run-manifest.json` when present in either source
directory. A malformed/mismatched manifest prevents comparison with exit `1`.
It does not require manifests for historical artifacts or change the comparison
contract. Removing a manifest opts that directory back into historical source
validation, so this compatibility path is not an anti-tampering guarantee.

The comparison matches the exact authored identity tuple:

```text
scenarioId + decisionPointId + finding type
```

rather than the generated `TutorFinding.id`, because Finding IDs intentionally
include run-specific identity.

### Comparability gate

Before constructing a comparison, the builder validates each input and rebuilds
the Health report from its suite, evaluation, and scoring profile solely to
check that the preserved report agrees. It rejects detached/modified reports,
unknown cases, changed case versions, unknown or changed rubric metadata,
out-of-range/duplicate case runs, and inconsistent execution counts.

Both sources must have:

- equal suite ID/version, health taxonomy, and SHA-256 of the complete supplied
  suite, including authored criteria, decision points, and policy;
- equal scoring profile ID/version and all dimension weights;
- the same explicitly recorded TutorEval evaluator version; building a new
  comparison currently requires the evaluator version supported by this build;
- equal Judge descriptors, including provider/model/version, prompt ID/version,
  temperature, reasoning effort, thinking mode, output cap, timeout, attempts,
  and seed when recorded; absence versus presence also differs;
- equal requested runs per case, the frozen case identities/versions, and
  explicit case locales agreeing with the compiled suite;
- distinct run IDs.

Tutor provider/model/prompt/configuration may change: that is the candidate
under test. These descriptors remain recorded on both sides. Missing evaluator
identity or case locale is rejected even though legacy evaluations remain valid
under the existing evaluation parser. A null Judge on both sides can be compared,
but Judge-owned decisions remain unresolved. Unknown descriptor fields are
rejected rather than copied into the comparison.

Incompatible sources throw `TutorHealthComparisonError` with a bounded reason;
the CLI exits `1` and creates no comparison. Invalid source schemas also fail
closed. A mismatched evaluation contract never becomes an improvement claim.

### Finding classifications

Counts refer to unique authored identity tuples, not individual repetitions.
All source Finding IDs, repetition indices, and evidence references are retained
under each row's `baseline` and `candidate` sides. Each side also contains an
assessment for every expected repetition, including case identity, evidence,
and unresolved reason codes. This retains the candidate evidence for a resolved
Finding and the baseline evidence for a new Finding even when that side has no
Finding ID.

| Classification | Meaning |
| --- | --- |
| `resolved` | Present in at least one baseline repetition, absent from all candidate repetitions; both decisions have complete scored PASS/FAIL evidence. |
| `persistent` | Present in at least one repetition on each side, with complete evidence on both sides. This makes no frequency or severity-change claim. |
| `new` | Absent from all baseline repetitions, present in at least one candidate repetition; both decisions have complete evidence. |
| `unresolved` | Any repetition at that decision has a missing/duplicate rubric, missing case, evaluation error, missing required Judge result, or PARTIAL evidence. This takes precedence over presence/absence. |

The unresolved rule is deliberately conservative across all criteria at a
decision point. It also emits authored Finding types for unresolved decisions
where neither source has a Finding, so absence of evidence is not silently
omitted. Fully assessed identities absent on both sides are omitted. Findings
from critical failures are included using the same identity rule.

Top-level `status` is `comparable` or `partially_comparable`, depending on whether
any rows remain unresolved. PARTIAL is not changed into a FAIL or a PASS in the
source report. Comparison does not calculate score deltas, compare aggregate
thresholds/release gates, or establish statistical significance. Existing
TutorEval aggregate scoring options do not define this Finding-presence test.

### Provenance and deterministic output

`baseline` and `candidate` each preserve suite identity, evaluation run/date,
dataset/evaluator identity, Tutor and Judge descriptors, full scoring profile,
repetition count, and SHA-256 digests of the supplied suite, evaluation, and
report. Digests use sorted JSON object keys, omit undefined object properties,
and preserve array order. The writer emits sorted-key, two-space JSON plus one
newline; the same preserved inputs produce the same bytes, with no new timestamp
or random ID. Array order and even non-semantic suite edits conservatively
change the suite digest.

Runtime validation checks allowed fields, versions, evidence references,
repetition coverage, unique identities, classification consistency, counts,
and source compatibility. Re-running the builder with the preserved sources is
required to verify the digests and full provenance; parsing a comparison alone
does not authenticate its sources. The suite and descriptor identities are
caller-supplied records, not cryptographic proof of the provider's actual
configuration. Preserve the suite snapshot used at execution; the historical
evaluation format does not itself bind a suite-content digest. New CLI runs bind
it through the separate local run manifest described above.

Only bounded evidence references and provenance are copied. Conversation text,
authored hidden criteria, raw Tutor/Judge payloads, and hidden reasoning are not
copied. Comparison artifacts still belong in private storage by default.

## Evidence excerpt resolution

A customer-facing report may show short conversation excerpts, but the excerpt
must remain traceable to the source artifacts.

For a normal rubric-backed Finding:

1. use `Finding.scenarioId` to locate the private scenario;
2. use `Finding.location.decisionPointId` to locate the authored decision point;
3. use the Finding's `rubric_result` evidence reference to identify
   `caseId`, `runIndex`, and `rubricId`;
4. locate the matching `TutorEvalCaseRunResult`;
5. take the actual Tutor output from `rawTutorResponse`;
6. take only the minimum relevant learner/context turns from the scenario's
   authored `trajectory.conversationHistory`.

A report must not substitute raw Judge reasoning, hidden chain-of-thought, or
provider payloads for the bounded evidence reference.

## Report limitations

Limitations are not runtime measurements and should not be fabricated as if
they were produced by the evaluator. They come from the applicable methodology
and pilot specification.

At minimum, a design-partner report should state when applicable:

- the scenarios are authored decision points, not a representative sample of
  all production tutoring;
- Tutor Health is not a validated measure of general Tutor competence;
- Judge-owned results are not independent human evidence;
- confidence fields are uncalibrated evidence-strength values, not
  probabilities;
- black-box Tutor behavior does not establish causal learning gains, retention,
  or mastery;
- partial health-dimension or case-run coverage remains partial;
- partner-specific conclusions are bounded to the agreed product version,
  scenario suite, and criteria.

These limitations should be versioned in the report template or pilot
specification and reviewed alongside the source artifact versions.

## Export boundary

This mapping intentionally stops before PDF, Excel, or dashboard implementation.

The next export layer should consume the same three authoritative inputs (and
the canonical comparison artifact for a before/after view) and
must not introduce a second mutable source of truth. A PDF, spreadsheet, or
dashboard is a presentation of the preserved artifacts, not a replacement for
them.

The minimum implementation gate for a future export renderer is:

- every displayed factual field has a documented source path;
- every displayed conversation excerpt resolves to preserved Tutor-visible or
  Tutor-output evidence;
- unresolved evidence remains visible;
- report metadata records source run/suite/profile/evaluator identity;
- no private prompt bodies, credentials, hidden Judge reasoning, or unrelated
  partner data cross into the export.
