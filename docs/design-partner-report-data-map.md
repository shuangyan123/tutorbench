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

The current repository does **not** yet define a canonical automated
baseline/candidate comparison artifact. Until that roadmap item is implemented,
resolved, persistent, and newly observed Findings must be derived explicitly
from the two preserved source artifacts and recorded as a report-level
comparison, without mutating either run.

For a stable comparison key, prefer the authored decision identity:

```text
scenarioId + decisionPointId + finding type
```

rather than the generated `TutorFinding.id`, because Finding IDs intentionally
include run-specific identity.

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

The next export layer should consume the same three authoritative inputs and
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
