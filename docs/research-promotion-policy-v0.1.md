# TutorBench Research Promotion Policy v0.1

Research tools, protocols, data definitions, and cases can merge under an
experimental boundary while their claims remain under study. Record three
decisions independently for the proposed change: engineering merge eligibility,
the evidence status of each claim, and eligibility for canonical adoption.

This policy applies across research tracks. Its evidence labels describe claims
and carry no roadmap phase or artifact version. The [roadmap](roadmap.md)
tracks phase scope and authorization.

## A. Engineering merge eligibility

**Merge as Experimental** when the proposed slice passes all applicable
engineering gates and can be used within its declared research boundary.

- Label the slice `experimental` or `non-canonical` in its documentation and
  at its relevant entry point or output. Identify what invokes it and verify
  that default suite selection, evaluator and Judge behavior, scoring,
  public interfaces, and historical results keep their existing semantics.
  Check discovery, exports, packaging and publication paths as applicable.
- Document inputs, outputs, dependencies, source versions, and side effects.
  Provide a reproducible validation command using frozen or synthetic inputs
  and mocks for provider calls. Separate optional live execution from the
  default path. Keep paid calls, external writes and irreversible operations
  behind explicit authorization. Describe failure, partial results and
  retry behavior where those operations exist.
- Run applicable tests, type checks, lint and build, with regression
  coverage for shared interfaces, default behavior and data boundaries.
  Use the [engineering skill](../.agents/skills/tutor-benchmark-engineering/SKILL.md)
  for exact-head CI, review, compatibility, privacy and merge eligibility.
  Use the [source ownership ledger](architecture-integration-ledger-v0.1.md)
  for provenance and the [architecture crosswalk](architecture-integration-map.md)
  for vocabulary and cross-layer seams.

If the complete PR fails an engineering gate or mixes isolated work with a
shared contract change, keep the affected scope under review. An independently
testable slice can proceed through normal review once its own gates pass.

## B. Research evidence status

**Independent Research Review** evaluates a specific claim and version.
Record the claim, scope (such as task, cohort, language, model or supported
input type), evidence source and method, counterexamples or contrary evidence,
and unresolved questions. Include the reviewer, evidence version, and
disagreement or adjudication record when applicable.

| Evidence status | Minimum basis |
| --- | --- |
| **Hypothesis or design** | A testable claim or protocol with assumptions, intended observations and possible counterexamples. |
| **Exploratory observation** | A replayable method and traceable observations with versions, denominators, missingness and failure modes recorded. |
| **Independently reviewed finding** | A qualified reviewer independent of the claim's authorship evaluates the exact evidence and relevant counterexamples. Record the bounded finding, material disagreements and any unresolved claims. |
| **Supported for a specified use** | Evidence addresses the proposed interpretation and use, including applicable validation on independent or held-out evidence, stability, and limits of generalization. |

Choose review and validation by claim. Source identity or rights claims need
authoritative and reproducible provenance. A correctness verifier needs
independent references, adverse and unsupported cases, and repeatability
within its declared domain. A rubric or learner-evidence construct needs
domain-appropriate independent review of its meaning, alternatives and
failure modes. Use the existing [Case System vNext review protocol](case-system-vnext-expert-review.md)
where applicable and the [principles registry lifecycle](research/pedagogical-principles/README.md#authoring-lifecycle-and-versioning)
for candidate principles. Preserve stricter artifact-specific requirements.

CI establishes software behavior. Single-author judgments, synthetic learner
responses and Judge agreement each support only their declared evidence scope.
Claims about learning, transfer, retention or causal effects require the
corresponding learner outcome evidence and study design in the
[measurement claim specification](measurement-claim-specification.md).
Source checks and bounded software or verifier claims can be reviewed with
evidence appropriate to those claims.

## C. Canonical adoption eligibility

**Promote to Canonical** through a separately scoped change and explicit
maintainer approval recorded against the reviewed revision. Specify the exact
artifact and intended use, then link the supporting evidence and disposition
of every applicable gate. Record a reason for any gate marked inapplicable.
The proposed use determines the required evidence. An experimental merge
leaves this decision open.

| Gate | Evidence to review |
| --- | --- |
| Dataset / Case | Source authority and reuse rights, exact version and identity, scope and coverage denominator, fidelity of content and visuals, and traceability to the owning source. |
| Rubric | Construct and criterion boundaries, distinguishable outcomes, alternative valid behaviors, and positive, negative and ambiguous examples. |
| Judge / deterministic verifier | Correctness, stability and known failure modes for the exact implementation and configuration. Verify supported inputs, counterexamples and abstention behavior. |
| Human Reference / calibration | Independent reference judgments where applicable, retained disagreements and scoped adjudication, and calibration evidence suited to the proposed use. Apply the owning reference protocol and record unresolved cases. |
| Compatibility and provenance | Before/after behavior and regression results, migration or compatibility plan, and any new dataset, case, rubric, evaluator, or scoring identity. Preserve historical results and comparisons under their recorded identities. See [scoring provenance](scoring-provenance.md). |
| Coverage and uncertainty | Preserve `PARTIAL COVERAGE`, `ABSTAIN`, errors, unknowns and uncalibrated status wherever they apply. Report eligible, observed and unavailable counts under the applicable denominator. Preserve confirmed signals and follow the [signal availability rules](statistics-evidence-semantics.md). |

Apply this gate to proposed changes to canonical datasets, cases, rubrics,
Judge or verifier behavior, scoring, Gold, or stable interfaces. An unresolved
required gate keeps adoption pending for the proposed scope. A maintainer may
review a narrower scope with explicit coverage limits and its own evidence.
Publication and live execution retain their existing authorization boundaries.

## PR self-check

Use these three lines in the PR description or review record, with links to
the evidence and a named next action when a decision is pending.

- **A — Engineering:** experimental slice and entry points, exact revision and
  checks, shared-contract effects, and remaining blockers or split.
- **B — Evidence:** claim and status, scope, source and method,
  counterexamples, and independent review or evidence still needed.
- **C — Canonical:** no adoption requested, pending with applicable gates,
  or a separately reviewed proposal with the explicit approval record.
