# Architecture integration ledger — source ownership and traceability v0.1

Status: **source-grounded engineering audit / non-canonical**. Audited against
`main@c4d067c5ec44c79229cae38bae44c406d5a4b67d` after the
prerequisite-accessibility 8-case suite landed. This is a map of responsibility
and a testable integration boundary, **not** a new learner model, scoring
taxonomy, benchmark release, or migration plan that has already been executed.

## Product invariant

TutorBench evaluates a `TutorUnderTest`; it does **not** implement a tutor
product or store a live student's hidden state. Preserve the one-way benchmark
path:

```text
Case System authoring / prerequisite knowledge hypotheses
  -> authored Scenario vNext suite (visible input vs evaluator-only reference)
  -> existing TutorEval dataset compiler
  -> TutorUnderTest adapter + evaluator/Judge
  -> TutorEvalRunResult (case/rubric/run provenance)
  -> Tutor Health report (observations/findings/coverage/identity)
  -> optional independent learner-outcome evidence (separate, NOT a score component)
```

The intentionally separate canonical TutorEval dataset and provider/corpus
replay infrastructure remain compatible; neither is replaced by this map.

## Ownership: one authority per fact

| Fact / claim | Authoritative artifact or contract | Downstream consumers | Not authoritative |
| --- | --- | --- | --- |
| Authored learner prompt, turn history, prerequisite assumption, disclosure | `TutorScenarioSuiteVNext` in versioned `suite.json` | `tutorScenarioSuiteToTutorEvalDataset`, optional `--suite-file` | A model response or its Judge analysis |
| Reference misconception and its cited learner turns | `evaluatorReferenceState.misconceptions[].evidenceLearnerTurns` | Compiler -> TutorEval evaluator-only context | `TutorTurnInput.studentState.misconceptions` (must not leak) |
| Next decision and alternative acceptable behaviors | `decisionPoints[].expectedBehavior` and criterion text, subject to independent validation | Judge packets and Tutor Health finding diagnostics | Inferred mastery or a single mandatory wording |
| A criterion's primary category and Health dimension | `evaluationCriteria[].category` and `.dimension`; existing TutorEval 0.2A capabilities are separate historical labels | Current rubric scoring and Health report dimension accumulator | A new P-007, a principle ID, or an inferred category-to-dimension conversion |
| Tutor execution response and rubric result | `TutorEvalRunResult` (case ID, case version, run index, rubric ID, scoring identity) | Health findings, comparison, report/manifest | Reconstructed or manually modified score |
| Evidence-backed Health diagnostic | `TutorHealthReport`, with `sourceScenarioSuite`, `sourceEvaluation`, evidence refs and regression targets | Human-facing report | Unversioned summary text |
| Experimental D/P/H, domain strategy, alternative strategies | `CaseSystemVNextArchetype` and linked strategy profile when a validated `caseSystemSource` is provided | Authoring and optional provenance checks | `TutorTurnInput` or automatically inferred runtime student ability |
| Mathematical concept/prerequisite hypothesis | `MathematicsKnowledgeMap` / task mapping | Subject-specific case authoring | Proof a particular learner has mastered the node |
| Observational learner outcome, teach-back | `TeachBackLearnerOutcomeEvidence` and its distinct recipient stage/task identifiers | Independent outcome analysis | Tutor Health score or causal gain |
| Goal/cost and independent checkpoints | `LearnerPathProtocol` (authoring-only), separately validated observation artifact if ever collected | Future measured learner-path study | Outcome evidence before a learner completes those assessments |

The validated reference/index path for a currently executable H1 checkpoint is:

```text
suite.id + suite.version
  -> scenario.identity.id + scenario.identity.version
     -> decisionPoint.id + evaluationCaseId + turnIndex
        -> TutorEval case id/version and rubric id
           -> evaluation.runId + caseResult.caseId + runIndex + rubricResult.rubricId
              -> Health finding { scenarioId, decisionPointId, evidence, regressionTargets }
```

The existing compiler keeps `caseSystemSource` and the evaluator-only
reference **out** of Tutor input. A full D/P/H payload is **not** carried into
`TutorEvalRunResult`: recover it from the frozen authoring source through
stable IDs, not by inventing fake learner state or exposing evaluator truth.
If a required authoring source or version is unavailable, mark that provenance
**unresolved** rather than reconstructing it from an arbitrary model reply.

## Current verified integration and remaining seams

1. **Fixed at main c4d067c5:** Unregistered suite scoring now uses
   `UNSCOPED_TUTOR_HEALTH_SCORING_PROFILE`, not the
   `productive-struggle-intervention` profile. Productive Struggle and
   Case System pilot retain their explicit identities; the compatibility
   `DEFAULT_TUTOR_HEALTH_SCORING_PROFILE` alias remains historical.
   The fallback only describes equal dimension weights, **not calibration**.
2. **Verified in this slice:** The eight H1 synthetic cases exercise source
   identity, visible/reference firewall, rubric provenance, failure finding,
   regression target and direct-vs-runner Health profile consistency in a
   no-provider synthetic test. Forced `FAIL` signals are plumbing fixtures,
   **not findings about any AI tutor**.
3. **Still open:** D/P/H depth/horizon and strategy alternatives are authoring
   information. The experimental eight-case suite currently mentions these
   in descriptions or linked research notes, not as typed, runtime-assessed
   dimensions. Do not silently promote D/P/H to calibrated scores.
4. **Still open:** TutorEval's historical learner-state tags, Case System
   vNext learner-state vocabulary, the Tutor-visible optional learner model,
   and experimental learner-evidence claims differ in purpose and granularity.
   A conversion table must distinguish `unknown`, `reported`,
   `stated rule`, `locally demonstrated`, `independently assessed` and
   `durably mastered`, without treating them as synonyms.
5. **Still open:** P-001–P-006 are candidate teaching principles and do not
   form a new scoring axis. Any principle -> rubric -> Health dimension
   attribution needs a primary-owner check and explicit duplication audit.
6. **Still open:** `LearnerPathProtocol` and teach-back outcome contracts
   use different stage names and subjects (learner vs recipient). This is a
   semantic difference, not a mechanical naming conflict to be merged away.
7. **Open, separate branch:** Draft PR #349 contains an experimental
   learner-state evidence matrix, profiles and controls. It is **not** in
   `main` in this audit. Inspect and reuse before changing learner-state
   contracts. Do not copy or recreate its experimental source in a
   second mutable registry.

## Controlled forward integration order

1. **Keep completed P0 repair:** protect scoring-profile provenance and
   suite/evaluation/run identity with regression tests.
2. **Make runtime provenance joinable:** for a proposed cross-layer source
   link, write a read-only compatibility projection; preserve frozen
   source versions and do not force it into Tutor-visible input.
3. **Reconcile the vocabularies:** inventory each existing state,
   prerequisite and capability term; classify as authoring hypothesis,
   visible learner evidence, evaluator reference, result or human outcome.
   Resolve ambiguities before creating an adapter.
4. **Attribute primary evaluation ownership:** one observable act should
   have one primary scoring owner. Link principles as explanatory references,
   not additional weighted categories.
5. **Only then implement learner-state decisions:** inspect PR #349 and
   reuse its evidence spans/epistemic safeguards as appropriate. That
   implementation requires its own scoped tests and review.

### Gates before any core learner-state refactor

- Can every generated finding be joined back to exactly one suite
  scenario/decision point and rubric/run without looking at a response?
- Are both intentional evidence variants delivered without reference or
  expected-behavior leakage?
- Is the suite/profile identity unambiguous for a custom, registered and
  historical suite?
- Are authored D/P/H and unmeasured learner outcomes clearly absent from
  calibrated scoring claims?
- Does `UNKNOWN` remain unknown on missing/contradictory evidence, and are
  alternative valid teaching moves not automatically scored `FAIL`?
- Have old canonical dataset behavior and serialized result schemas remained
  backward compatible?

## Verification

The existing `tests/prerequisite-accessibility-contrasts.test.ts` now
crosses Scenario vNext -> TutorEval -> Tutor Health with a synthetic Judge,
verifying identity and evidence linkage without model/API calls. Earlier
`tests/tutor-health-scoring-profile-provenance.test.ts` protects profile
defaulting. Both tests must run in the normal Node 24 CI. CI success
validates **software wiring**, not construct validity, real tutor quality
or learner learning. Keep external reviewer and real student evidence
separate.
