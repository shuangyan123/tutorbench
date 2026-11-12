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

**Maintainer-led Evidence** can support accepting, revising, or dropping a
hypothesis and making the corresponding engineering change. Use review of
original Tutor replies, case analysis, counterexamples, independent
derivations, tests, and experiments as appropriate. Record who reviewed the
evidence, the exact case or claim version, its scope, the source and method,
contrary evidence, and unresolved questions. Retain links to the original
observations within their existing privacy boundary.

**Evidence-Proportionate Decisions** match verification to the risk of the
decision and the strength of the claim. A documented counterexample and
targeted regression tests may justify a bounded correction. Changes affecting
many cases, score comparability, or a stable interface warrant broader checks.
Reviewer independence or a specified reviewer count applies where the claim or
the governing protocol calls for it.

| Evidence status | Minimum basis |
| --- | --- |
| **Hypothesis or design** | A testable claim or protocol with assumptions, intended observations and possible counterexamples. |
| **Exploratory observation** | A replayable method and traceable observations with versions, denominators, missingness and failure modes recorded. |
| **Independently reviewed finding** | A qualified reviewer independent of the claim's authorship evaluates the exact evidence and relevant counterexamples. Record the bounded finding, material disagreements and any unresolved claims. |
| **Supported for a specified use** | Evidence proportionate to the proposed interpretation and use. Record the validation performed, stability where relevant, and limits of generalization. |

**Stronger Claims Need Stronger Evidence.** Use Independent Research Review
for claims of independent validation and evidence across the stated settings
for claims of cross-context validity. Learning gains, transfer, retention,
and causal effects require the learner outcome evidence and study design
specified in the [measurement claim specification](measurement-claim-specification.md).
CI, synthetic observations, and Judge agreement each support their own
declared scope. Source identity and rights still need authoritative
provenance.

Apply the [Case System vNext review protocol](case-system-vnext-expert-review.md#reference-evidence-gate)
when promoting its authored expectations to reviewed reference evidence.
Follow the [principles registry lifecycle](research/pedagogical-principles/README.md#authoring-lifecycle-and-versioning)
for its candidate principles. Those scoped requirements govern their own
artifacts and claims.

**Evidence Can Overturn Design.** When an original Tutor reply exposes a
flaw in a rule, preserve the reply, original evaluation, counterexample,
and reason for revision. Show why the new rule better measures the intended
behavior, check it against both valid and invalid responses, and report any
new evaluation under the revised identity.

## C. Canonical adoption eligibility

**Promote to Canonical** through a separately scoped change and explicit
maintainer approval recorded against the reviewed revision. Specify the exact
artifact and intended use, then link the supporting evidence and disposition
of every applicable gate. Record a reason for any gate marked inapplicable.
An experimental merge leaves this decision open.

**Versioned Design Adoption.** Maintainers may approve a scoped revision to
cases, rubrics, teaching principles, verifiers, or evaluation rules on the
strength of recorded internal evidence when it supports the intended use.
Run applicable engineering and evaluation regressions, record changed
identities and compatibility effects, and keep historical scoring identities
and results reproducible under their recorded versions. Apply any specific
Human Reference, Gold, or calibration gate when the change adopts or makes
claims about those artifacts.

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
  counterexamples, and any additional validation needed for the stated use.
- **C — Canonical:** no adoption requested, pending with applicable gates,
  or a separately reviewed proposal with the explicit approval record.
