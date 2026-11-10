# TutorBench taxonomy and learner-evidence crosswalk

**Status:** reviewed architecture companion; **non-canonical** and not a
scoring policy, Gold data, or learner-state implementation.
**Original audit baseline:** `main@c4d067c5` (2026-11-09).
**Reconciliation baseline:** `main@45a46cc1` (2026-11-10).

**Division of responsibility:** the
[architecture integration ledger](architecture-integration-ledger-v0.1.md)
is authoritative for the executable Scenario → TutorEval → Tutor Health
pipeline, source ownership, provenance joins and merge/refactor gates.
This document owns the **taxonomy distinctions and unapproved mapping
proposals** left after that ledger and the read-only bridge landed.
Do not edit or count both documents as independent sources of runtime truth.

## 1. Distinct vocabularies and owners

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


## 2. Candidate evidence crosswalks — not executable conversions

The following rows are **human-review candidates**, not ID aliases,
validated concept equivalences or automatic transformations.

### 2.1 Fraction evidence concepts vs mathematics knowledge map

Source A: PR #349's synthetic matrix v0.1.1 (four fixed `conceptId`
values). Source B: `mathematics-knowledge-map-v0.1` version **0.2.0**
(44 authored nodes; source relation evidence remains author-hypothesis).
The latter is the authoritative existing *knowledge-map* identifier space,
but does not establish any real student's mastery.

| PR #349 local concept | Knowledge-map node to inspect | Relation | Mapping decision |
| --- | --- | --- | --- |
| `chosen-whole` | `units-whole` | Choosing a common whole is a narrower behavior within whole/unit reference | **candidate narrower-than**, not identity |
| `equal-parts` | `fractions-units` | Equal-sized fractional parts and denominator meaning form part of the node | **candidate partial**, not identity |
| `fraction-addition-rule` | `fractions-units` and `fraction-equivalence` | The misconception overlaps the first node; actual fraction addition may require shared units from the second | **compound candidate**, no 1:1 mapping |
| `equivalent-fraction-units` | `fraction-equivalence` | Closely related shared-unit method, with no independently established level equivalence | **candidate partial**, not identity |

No `conceptId` should be rewritten automatically. A reviewed,
versioned crosswalk must include the source/local ID and version,
target map ID and version, relation strength, reviewer evidence,
cardinality and explicit `unmapped` behavior. The current map covers
mathematics only: do not infer physics/chemistry/biology node IDs.

### 2.2 Observation, epistemic claim, and Tutor-visible context

| Existing evidence | Maximum permitted conclusion without new review | Must not be converted into |
| --- | --- | --- |
| Source bridge has no authored evaluator reference | `reference_not_authored` — an **absence of metadata**, not a learner-state status | PR #349 `unknown`, `no misconception`, `mastered` |
| `incorrect_result` | This response contains an authored incorrect result; cause requires investigation | `misconception_stated` or generic inability |
| `question` | A question was asked; which prerequisite is missing is unresolved | `explicit_gap` |
| `explicit_gap` | Learner states a specific gap; it may guide a next probe | Global missing foundations or independently confirmed lack |
| `stated_rule` → `misconception_stated` | A rule was explicitly stated; scientific correctness still needs independent subject review | Stable student trait or blanket inability |
| `self_report` → `reported_only` | Learner reports a fact about their understanding | Independently demonstrated competence |
| `verbal_definition` → `stated_definition` | Learner uttered a definition; semantic correctness is a review task | Successful application or transfer |
| `prompted_paraphrase` → `supported_local` | Locally supported paraphrase if a prior Tutor turn exists | Unprompted reasoning or retention |
| `local_reasoning` → `demonstrated_local` | A locally articulated reasoning step, subject to semantic checking | Durable mastery or independent near-transfer |
| PR #349 claim `unknown` | This **specific concept** is not justified by the supplied observations; no evidence refs allowed | An absent authored field, a false score or global unknown learner |

These describe PR #349's own **authoring rules**, not a
new canonical learner-state ontology. The research matrix's
`LearnerEpistemicStatus`, TutorEval's dataset-level
`TutorEvalStudentState`, Case System's authored learner archetypes
and the optional `TutorLearnerModelContext.masteryState` are not
interconvertible without independent evidence and an explicit purpose.

**Allowed direction:** the versioned source + learner USER-turn index
may locate a visible utterance; PR #349's quote validator may then
validate a quote and the limited authored observation/claim pairing.
**Forbidden direction:** a label, model/Judge verdict, missing
reference, or knowledge-node edge may not manufacture a quotation,
Tutor-visible misconception, mastered concept or measured learning gain.
Continue to keep evaluator-only reference truth out of `TutorTurnInput`.

## 3. Cross-layer gaps requiring explicit decisions

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

### G8. PR #349 is a scoped evidence experiment, not a universal state model

Open Draft [PR #349](https://github.com/shuangyan123/tutorbench/pull/349)
contains a validated, author-synthetic matrix with five prerequisite-aware
fraction scenarios, eight literal observations and ten concept claims.
Its validator requires learner-turn quote inclusion, status/kind
compatibility and explicit `unknown` claims with no evidence references.
It validates **provenance structure**, not the semantic truth of diagnoses.

The bridge merged in
[PR #360](https://github.com/shuangyan123/tutorbench/pull/360),
`src/datasets/scenario-evidence-provenance.ts`, indexes the original
suite/scenario/decision-point/case versions and evaluator-only learner-turn
reference positions. It does not create the observation/claim semantics.
A safe join requires the source suite version, source scenario version,
one-based USER-turn position and PR #349's exact quote validation;
`no authored misconception reference` must never be converted to
`unknown` or `no misconception`.

PR #349 intentionally hard-codes these five scenario identities and four
fraction concept names. Do not turn its local enum into a cross-subject
vocabulary, add it to `TutorTurnInput`, or merge its live provider workflow
into canonical evaluation without a separate review. High/Max output review
and private evidence are outside this architecture document's verification.

### G9. The eight new H1 cases are executable but not yet connected to the broader authoring registries

The eight-case prerequisite-accessibility suite is a valid experimental Scenario vNext suite and uses the existing compiler/runner. It intentionally has no Case System source reference, knowledge-node reference, capability-tag metadata or pedagogical-principle reference. Its subject and topic labels are authored directly in the scenario.

That is acceptable for a bounded synthetic contrast experiment. It does mean the suite should not be counted as full Case System, knowledge-map or principle-registry coverage. If these cases are later promoted into those coverage reports, add explicit versioned references rather than inferring links from their titles or prompt text.


## 4. Delivery gate and remaining research

The source-ownership and CI regression gates are already specified in the
[architecture ledger](architecture-integration-ledger-v0.1.md).
Before an adapter or schema proposal, require **independent construct
review** for each concept relation above, correct source/version checks,
negative tests for unsupported promotion, decision-point overrides,
turn-index scope, and the Tutor-visible/reference firewall.
Keep unobserved learner outcomes explicitly unobserved.

**PR disposition at this reconciliation:** use this PR as the
taxonomy/semantic *companion* only; the existing ledger remains the
source-ownership guide. Keep PR #349 **Draft** until its subject,
evidence-kind semantics and local-concept scope have been independently
reviewed; do not imply that its High/Max or private review evidence has
been independently verified here. No new public model claims or paid calls.

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
