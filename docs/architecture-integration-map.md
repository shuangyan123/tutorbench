# TutorBench Architecture Integration Map

**Status:** repository-grounded architecture audit and integration plan; not a new canonical schema or scoring policy.  
**Audit baseline:** main at c4d067c5ec44c79229ca38bae44c406d5a4b67d (2026-11-09).  
**Purpose:** identify which existing assets already share a runtime path, which are separate by design, and where metadata or evidence stops crossing boundaries.

## Executive conclusion

TutorBench is not several unrelated evaluation engines. It already has one principal executable path:

~~~text
Scenario vNext
  -> Scenario-to-TutorEval compiler
  -> TutorTurnInput
  -> TutorUnderTest adapter
  -> TutorEval evaluator / Judge
  -> TutorEvalRunResult
  -> Tutor Health report
~~~

Case System vNext, knowledge/exam maps, evaluator stress and expert review, pedagogical-principle research, and learner-outcome research support different parts of that path. They should not all be collapsed into the runtime or into one large contract.

The actual fragmentation is at the **joins**:

1. Some authoring metadata is only reachable through provenance IDs and is not projected into executable case metadata.
2. Several taxonomies describe different semantic axes but have no explicit crosswalk.
3. Some reference-state fields are validated in Scenario vNext but are not consumed by the current TutorEval compiler.
4. Pedagogical principles and knowledge-node references are not yet first-class references on executable criteria.
5. Learner-outcome protocols can refer back to a Tutor exposure, but they do not yet form an end-to-end outcome execution and aggregation path.

The correct response is a small number of versioned crosswalks and explicit references—not another runner, another scoring system, or one universal learner-state enum.

## 1. Existing architecture and ownership

### 1.1 Main executable evaluation path

~~~text
Case System vNext authoring                         Supporting research
  Domain taxonomy                                  Knowledge map / exam alignment
  Archetype (D/P/H, prerequisites,                 Pedagogical principles
  reference reasoning, transfer)                   Evaluator stress / expert review
  Strategy profile / teaching objective            Learner outcome protocols
          |                                                |
          | caseSystemSource provenance                   | independent references
          v                                                v
Scenario vNext suite
  - learner-visible context
  - evaluator-only reference state
  - authored trajectory and disclosure policy
  - decision points and evaluation criteria
          |
          v
tutorScenarioSuiteToTutorEvalDataset
  - Tutor input projection
  - evaluator-only misconception / disclosure / rubrics
          |
          v
TutorTurnInput -> TutorUnderTest -> TutorEval / Judge
          |
          v
TutorEvalRunResult
          |
          v
buildTutorHealthReport
  - observations / findings / unresolved coverage
  - seven reporting dimensions
  - explicit scoring profile
~~~

The source of truth for each stage is:

| Stage | Current owner | Responsibility |
|---|---|---|
| Authored case design | src/contracts/case-system-vnext.ts and its registries | Defines the task archetype, domain, content depth, pedagogical difficulty, interaction horizon, prerequisites, reference reasoning and transfer target |
| Executable scenario | src/contracts/tutor-scenario-vnext.ts | Defines the specific authored trajectory, visible context, evaluator reference state, disclosure policy and decision points |
| Runtime case projection | src/datasets/real-world.ts | Converts each Scenario vNext decision point into a TutorEval case |
| Tutor boundary | src/contracts/tutor.ts | Defines exactly what the Tutor adapter receives |
| Evaluation | src/contracts/tutor-eval.ts and src/runner/tutor-eval-runner.ts | Owns rubric routing, Judge evaluation, result aggregation and evaluator provenance |
| Diagnostic report | src/contracts/tutor-health.ts and src/reporting/tutor-health-reporters.ts | Owns evidence-linked observations/findings, coverage, dimension scores and release gate |
| Learner outcomes | src/contracts/learner-outcome-evidence.ts | Records separate post-exposure evidence; it is not a Tutor Health score |

### 1.2 What is already integrated

These connections exist and should be reused:

- **Scenario to TutorEval:** each decision point's evaluationCaseId becomes a TutorEval case ID; the scenario and decision-point identity are retained in case version/provenance.
- **Tutor-visible versus evaluator-only information:** tutorVisibleContext is projected to TutorTurnInput; misconception references remain evaluator-only and must cite learner turns.
- **Criterion to report dimension:** each TutorScenarioEvaluationCriterion explicitly declares both its TutorEvalCategory and TutorHealthDimension. No implicit category-to-dimension conversion is intended.
- **Case System source provenance:** caseSystemSource carries pilot, archetype and strategy-profile IDs and versions; registered Case System provenance is validated by the loader.
- **Evaluator stress:** Case System evaluator-stress packets already combine source archetypes, task-specific strategy profiles and teaching-objective profiles for controlled comparisons. This is a measurement-validation path, not a second Tutor Health runner.
- **Knowledge/exam coverage:** validateMathematicsExamCoverage checks that exam modules' node IDs exist in the knowledge map and case IDs exist in the selected Scenario suite.
- **Tutor exposure to teach-back:** TeachBackTutorExposureRef can record suite ID/version, scenario ID and evaluation run ID.
- **Outcome claim boundary:** Teach-back evidence is explicitly observational/proxy-only and remains outside the seven Tutor Health dimensions.

Do not rebuild these paths merely to create a new umbrella abstraction.

## 2. Taxonomies that must remain distinct

The repository contains several taxonomies because they answer different questions. Similar labels do not make them interchangeable.

| Taxonomy | Current size / examples | What it describes | What it does not mean |
|---|---|---|---|
| Case System domain taxonomy | 23 research-seeded domain IDs | Proposed subject-domain coverage and domain-specific evidence norms; pending expert validation | A validated ontology, TutorEval subject bucket or learner state |
| TutorEval subject taxonomy | 5 broad buckets | Dataset-level subject grouping | The full 23-domain ontology |
| Case System D/P/H | Content depth 1–5; pedagogical difficulty 1–5; interaction horizon 1–3 | Case complexity and interaction design | Tutor quality scores or automatically equivalent TutorEval difficulty values |
| TutorEval difficulty | Learner level plus task difficulty 1–5 and pedagogical difficulty 1–5 | Dataset-level task assumptions | Case System D/P/H without a reviewed scale crosswalk |
| Case System learner states | 10 authored archetype labels | Intended learner situations to cover | A diagnosis of a real learner |
| TutorEval student states | 8 case metadata labels | The intended state of a benchmark input | A longitudinal learner profile |
| Tutor runtime learner model | Mastery: 4 labels; engagement: 4 labels | Optional context explicitly passed to the Tutor | Evaluator reference truth |
| Learner-state evidence experiment (PR #349) | 8 observation kinds and epistemic statuses such as unknown, explicit_gap, misconception_stated, demonstrated_local | Exact-turn observations and evidence-bounded claims | A stable trait, mastery score or canonical state enum |
| Learner Path protocol | 3 authored pathways; baseline, immediate, nearTransfer and delayed checkpoints | Planned learner starting points and independent assessment checkpoints | Teach-back recipient outcomes or observed learner results |
| TutorEval categories | 5 categories | What a rubric judges: correctness, diagnosis, guidance, adaptation, actionability | A reporting dimension |
| TutorEval capability tags | 27 tags | Which capability a case or rubric is intended to exercise | A mutually exclusive scoring category |
| Tutor Health dimensions | 7 dimensions | Where evidence is aggregated for reporting | The full set of tutoring capabilities |
| Case System strategy criteria | 5 base criteria | Task fidelity, epistemic integrity, learner alignment, teaching-target alignment, valid-alternative fairness | TutorEval categories or Health dimensions |
| Teach-back assessment stages | Baseline, immediate, near transfer, far transfer | When an independent learner/recipient outcome is checked | Tutor response turns or Health dimensions |

**Decision:** do not merge these into one enum. Add explicit mappings only where one layer must project into another. Keep the source vocabulary and version on every mapping.

## 3. Confirmed cross-layer gaps

### G1. Domain taxonomy does not have an explicit TutorEval crosswalk

- Case System uses a 23-domain taxonomy (src/contracts/case-system-vnext-domain-taxonomy.ts).
- TutorEval defines five broad subjects (src/contracts/tutor-eval-taxonomy.ts).
- Scenario vNext currently uses a free-form learningContext.subject.
- The Scenario-to-TutorEval compiler copies that string into metadata.subject.

This permits precise subjects such as physics, chemistry and biology, but there is no versioned rule for aggregating them into a broad TutorEval subject such as science, or for retaining specialization/practice distinctions. In addition, TUTOR_EVAL_SUBJECTS is a declared taxonomy, while TutorEvalCaseMetadata.subject remains a string and the runtime parser only requires a non-empty string; the five taxonomy values are therefore not enforced on every Scenario-generated case.

**Needed:** a versioned domain crosswalk with at least domainId, broad subject grouping, optional specialization and cross-cutting practice. Never replace the 23-domain source taxonomy with five buckets.

### G2. Scenario vNext does not project the full TutorEval metadata vocabulary

TutorEvalCaseMetadata supports difficulty, taxonomyVersion, learningTask, studentState and capabilityTags. The current Scenario vNext contract does not author those fields, and the compiler currently emits only subject, topic and the suite/scenario IDs in tags.

TutorScenarioEvaluationCriterion carries category and dimension, but it does not carry the optional rubric capabilityTag.

**Needed:** first decide which of these metadata fields are required for actual coverage and analysis. Then add optional, versioned authoring references and compile them with tests. Do not populate them by guessing from free text or by automatically converting one taxonomy into another.

### G3. Some evaluator reference state is not consumed by the compiler

TutorScenarioEvaluatorReferenceState can contain misconceptions, confidence, engagement and mastery state. The current compiler turns evidenced misconception statements into evaluatorOnly.knownMisconception, and carries the disclosure policy and rubrics. It does not project the other reference-state fields into the TutorEval case.

This is not a Tutor-visible data leak—the Tutor firewall is correct. It is an evaluator-side completeness question.

**Needed:** decide field by field whether confidence, engagement and mastery state are:
- authoring annotations only;
- Judge-visible reference context; or
- fields to remove from this contract because no current evaluator consumes them.

Never copy evaluator reference truth into TutorTurnInput merely to make the schemas look symmetrical.

### G4. Case System provenance does not equal a runtime semantic projection

caseSystemSource preserves IDs and versions for the pilot, archetype and strategy profile. The executable Scenario does not itself carry the full D/P/H values, prerequisite boundary, reference reasoning, transfer references, or strategy-profile criteria.

The source registries can be joined using those references, but the current compiler does not load and project them. The separate teaching-objective contract (learning-oriented versus exam-oriented, with assessment context for exam-oriented work) is currently consumed by the Case System evaluator-stress packet path; it is not a field on Scenario vNext or part of the standard Tutor Health compiler projection.

**Needed:** choose one explicit model:
1. keep the archetype registry authoritative and resolve it through versioned source references when needed; or
2. materialize a minimal immutable snapshot on the Scenario when runtime evaluation genuinely requires it.

Do not maintain two independent editable copies of the same D/P/H or prerequisite values.

### G5. Pedagogical principles are research references, not runtime inputs

The pedagogical-principles registry explicitly says its current principles are non-canonical hypotheses and are not loaded by suites, runners or Judges. P-001 therefore cannot currently be traced from a finding or criterion to a versioned principle reference.

**Needed:** when a principle is ready to influence evaluation, attach its ID/version as provenance to the relevant authored criterion or scenario. Do not automatically turn every research principle into a score or a mandatory teaching response.

### G6. Knowledge maps, exam alignment and academic navigation are connected metadata, not a learner-state engine

The mathematics knowledge map contains nodes, prerequisite relations, evidence status, alternative paths and task-to-node mappings. Mathematics exam alignment separately links modules to node IDs and case IDs and validates those references against the map and Scenario suite. AcademicStructure organizes discipline, knowledge-system and exam-system registry references for navigation; it is explicitly experimental authoring metadata, not an execution contract.

This is a useful existing bridge. However, it does not yet make a knowledge-node reference part of every Tutor-visible learner state or every Tutor Health finding.

**Needed:** add knowledge-node references only where a case or assessment actually targets those concepts. Preserve the map's author-hypothesis / expert-reviewed / learner-validated evidence status. A prerequisite edge authored as a hypothesis must not become a mandatory learner prerequisite.

### G7. Learner pathway and teach-back work are outcome research, not another Tutor Health layer

- LearnerPathProtocol is explicitly authoring_only, uses synthetic pathway profiles and states unknown_not_zero for missing data.
- TeachBackLearnerOutcomeEvidence records a learner's teach-back process and independent recipient assessments, with a source Tutor exposure reference.
- The Mastery & Transfer positioning document explicitly keeps learner outcomes outside the seven Tutor Health dimensions and aggregate score.

These contracts are complementary, not duplicates. The missing connection is an end-to-end, independently assessed outcome collection and aggregation path—not a reason to add an eighth Health dimension.

### G8. PR #349 is an unmerged research branch and must be reconciled after this audit

The open draft PR #349 (feature/learner-state-evidence-matrix-v0-1) contains a useful exact-turn evidence overlay: observations quote learner-visible turns, claims cite observation IDs, and unknown claims must have no evidence references. It is author-synthetic and does not establish semantic truth, real learner outcomes or Gold.

At this audit, the branch had diverged from current main (25 commits ahead, 4 behind). Its concept IDs are a local allowlist rather than references to the mathematics knowledge-map node IDs.

**Reuse decision:** preserve the exact-turn evidence mechanism as a candidate source for the canonical evidence model. Before merging or generalizing it, rebase/reconcile it against current main, map its concept IDs to versioned knowledge-node references where appropriate, and keep epistemic status distinct from learner archetype labels and mastery state. Do not treat the draft branch as already integrated.

### G9. The eight new H1 cases are executable but not yet connected to the broader authoring registries

The eight-case prerequisite-accessibility suite is a valid experimental Scenario vNext suite and uses the existing compiler/runner. It intentionally has no Case System source reference, knowledge-node reference, capability-tag metadata or pedagogical-principle reference. Its subject and topic labels are authored directly in the scenario.

That is acceptable for a bounded synthetic contrast experiment. It does mean the suite should not be counted as full Case System, knowledge-map or principle-registry coverage. If these cases are later promoted into those coverage reports, add explicit versioned references rather than inferring links from their titles or prompt text.

## 4. Recommended integration sequence

### Phase 0 — provenance and runtime correctness

**Completed in PR #353.**

- Bind default Tutor Health profile identity to the suite identity.
- Preserve the Productive Struggle and Case System profiles.
- Give unregistered suites an explicitly unscoped equal-dimension profile.
- Keep TutorEval rubric-scoring provenance separate from Tutor Health dimension-profile provenance.

### Phase 1 — publish and review the crosswalks before changing runtime contracts

1. **Domain crosswalk:** Case System domain → TutorEval broad subject → optional specialization/practice.
2. **Capability crosswalk:** capability tag → case/criterion owner → TutorEval category → Tutor Health dimension, where the mapping is actually justified.
3. **Learner evidence crosswalk:** exact observation kind → epistemic status → claim → optional concept-node reference. Keep unknown explicit.
4. **Case System projection policy:** specify which D/P/H, prerequisite, strategy and transfer fields remain registry-only and which are required at execution time.
5. **Principle references:** identify which versioned principles inform which authored criteria, without making the principle registry itself a scoring system.
6. **Outcome linkage:** standardize the source Tutor exposure reference and independent assessment task IDs used by learner-outcome evidence.

Every crosswalk must state its owner, version, allowed direction, missing-data behavior and validation rule.

### Phase 2 — extend the existing compiler, not create a second runner

After Phase 1 is reviewed:

- Add only optional, versioned fields to Scenario vNext or a referenced authoring overlay.
- Keep the existing tutorScenarioSuiteToTutorEvalDataset as the sole projection into TutorEval.
- Preserve the Tutor-visible/evaluator-only firewall.
- Keep TutorEvalCategory, capability tags and TutorHealthDimension as separate fields with explicit mappings.
- Validate source IDs and versions before projection; unknown or missing evidence remains unknown.
- Preserve compatibility for existing suites and historical artifacts.

### Phase 3 — connect outcome evidence without contaminating Tutor Health

- Link independent outcome artifacts to the exact Tutor exposure and assessment task.
- Keep learner identity pseudonymous and outcome evidence access-controlled.
- Preserve baseline, immediate, near-transfer and far-transfer as outcome checkpoints.
- Do not convert synthetic continuation, Judge opinion or Tutor Health score into observed learning gain.
- Do not add learner outcomes to the Tutor Health aggregate.

### Phase 4 — return to the core product objective

Only after the crosswalks and compiler projection are stable should the next learner-state / knowledge-prerequisite objective be implemented. This prevents another standalone contract from becoming a parallel source of truth.

## 5. Acceptance criteria for integration

The architecture is sufficiently connected when all of the following can be demonstrated without paid model calls:

1. A case can be traced from its source archetype and version to its Scenario, TutorEval case, decision point, rubric result and Health finding.
2. Domain, task, capability and reporting labels are explicit and versioned; no field is inferred by lossy string conversion.
3. Every learner-state claim points to exact visible evidence or is explicitly unknown.
4. Evaluator-only reference state never appears in Tutor input.
5. Every knowledge-node or principle reference resolves to a known ID and version, or is explicitly marked unavailable.
6. TutorEval rubric provenance and Tutor Health dimension-profile provenance remain separate and reproducible.
7. Independent learner outcomes link to the exact Tutor exposure and assessment task but remain outside the Tutor Health score.
8. Existing canonical suites, historical artifacts, partial coverage and unresolved evidence continue to behave as before.

## 6. Explicit non-goals

- Do not merge all learner-state vocabularies into one universal state enum.
- Do not replace the 23-domain Case System taxonomy with the five TutorEval subject buckets.
- Do not infer capability tags, mastery, prerequisites or learning gain from free-form prompts.
- Do not expose evaluator reference truth to the Tutor.
- Do not convert pedagogical hypotheses into mandatory scoring rules without review.
- Do not add another runner, another rubric engine, or another Health aggregate.
- Do not claim causal learning effects from synthetic profiles, simulated transfer or post-Tutor proxy evidence.

## Source files inspected

- src/contracts/case-system-vnext.ts
- src/contracts/case-system-vnext-domain-taxonomy.ts
- src/contracts/case-system-vnext-strategy-profile.ts
- src/contracts/case-system-vnext-teaching-objective.ts
- src/contracts/case-system-vnext-evaluator-stress.ts
- src/case-system-vnext/evaluator-stress.ts
- src/contracts/tutor-scenario-vnext.ts
- src/contracts/tutor-eval.ts
- src/contracts/tutor-eval-taxonomy.ts
- src/contracts/tutor.ts
- src/datasets/real-world.ts
- src/contracts/tutor-health.ts
- src/reporting/tutor-health-reporters.ts
- src/contracts/mathematics-knowledge-map.ts
- src/contracts/mathematics-exam-alignment.ts
- src/contracts/academic-structure.ts
- src/contracts/learner-path-protocol.ts
- src/contracts/learner-outcome-evidence.ts
- docs/research/pedagogical-principles/README.md
- docs/case-system-vnext-mastery-transfer.md
- docs/repository-reference.md
- PR #349 draft branch and its learner-state evidence overlay (read-only)
