# Mathematics academic-to-evaluation linkage — Stage 1 + Stage 2

**Status: technically auditable mathematics integration; author-proposed, unreviewed semantic mappings.** Read-only authoring index, **not** an exhaustive mathematics curriculum, a validated prerequisite graph, a learner mastery model, or a calibrated benchmark.

## Existing source ownership

| Existing registry | Pinned identity | Responsibility |
| --- | --- | --- |
| Academic navigation | `tutorbench-academic-structure-v0.1@0.1.0` | Formal sciences → mathematics |
| Mathematics graph | `mathematics-knowledge-map-v0.1@0.2.0` | 44 authored nodes, 8 branches, author-hypothesis relationships |
| Exam overlay | `mathematics-exam-alignment-v0.1@0.2.0` | 16 **author-proposed** exam profiles; no scored assessments |
| Research evidence | `mathematics-challenge-evidence-v0.1@0.2.0` | 16 task structures |
| Research suite | `mathematics-challenge-v0.1@0.2.0` | 20 synthetic executable checkpoints |
| Canonical Eval | `tutor-eval-v0.2a@0.2a.6` | English and Chinese cases; 18 mathematics cases |
| Default Health | `productive-struggle-intervention-v0.1@0.2.0` | 13 mathematics decision points |

Load Eval with `loadTutorEvalDataset()`; 0.2a.6 applies overrides to 0.2a.5 and raw `cases.json` is not the current canonical snapshot. Chinese cases have independently pinned IDs and versions. The existing `docs/architecture-integration-ledger-v0.1.md` (runtime/provenance) and `docs/architecture-integration-map.md` (taxonomy) remain authoritative. No new ontology or parallel source of truth is created.

## Stage 1: candidate knowledge links

`scenarios/experimental/mathematics-eval-health-linkage-v0.1/links.json` contains exact case/scenario versions, decision-point references where relevant, focus/supporting knowledge nodes, source-objective anchors and authored rationales. These are **candidate topical relations**; they do not prove a Tutor succeeded or a learner mastered the target.

The pre-existing mathematics research `taskId → nodeIds → scenarioIds` links remain owned by the original knowledge map and task evidence registry, and are derived without duplicating source records. Existing conditional-probability research cases must not be misrepresented as canonical Eval or default Health coverage.

## Stage 2: complete, fail-closed mathematics case inventory

`unmapped.json` records the sources that cannot responsibly be assigned to a current graph node. **Every current canonical mathematics Eval case and default Health decision point must have exactly one disposition: candidate link OR explicit unmapped reason.**

| Source | Total in current scope | Candidate-linked | Explicitly unmapped |
| --- | ---: | ---: | ---: |
| Canonical Eval math (English + Chinese) | 18 | 12 | 6 |
| Default Health mathematics decision points | 13 | 12 | 1 |
| **Total** | **31** | **24** | **7** |

The seven gaps are six multiplication/equal-groups Eval cases (with Chinese counterparts) and the Health square-root task requiring `x ≥ 0` for the unique solution of `x² = 9`. They must **not** be forced into generic integer arithmetic or quadratic discriminants. These are missing exact *authoring nodes*, not model failures.

The knowledge graph contains 44 nodes. The 16 pre-existing research tasks touch 22 distinct nodes. Eval/Health candidate links touch 5, of which **4 are primary targets** and one (`units-whole`) is only a supporting reference. Their union touches **25 distinct nodes**, while 19 nodes have no research-task or canonical/default-Health candidate links in these frozen sources. The 16 exam profiles reference 42 nodes through a **separate proposed overlay**. These are *authored reference counts*, not validated mathematical curriculum coverage, measured teaching quality, or student-learning gains. Do not add unrelated denominators or describe 25/44 as a performance score.

`src/research/mathematics-linkage-pilot.ts` performs version-pinned source joins. `src/research/mathematics-linkage-audit.ts` requires a mutually exclusive, complete canonical mathematics case inventory, and derives both the Eval category and the Health dimension for each linked node without translating one into the other. It reports `focus` versus `supporting` separately: a supporting node cannot inflate the primary-target coverage count.

### Offline inspector (Node 24)

```sh
npm run build
node dist/src/cli/mathematics-linkage-pilot.js --node fractions-units
node dist/src/cli/mathematics-linkage-pilot.js --node linear-equations
node dist/src/cli/mathematics-linkage-pilot.js --node conditional-events
node dist/src/cli/mathematics-linkage-pilot.js --audit
node dist/src/cli/mathematics-linkage-pilot.js --audit --json
```

The audited JSON explicitly reports `semanticsIndependentlyReviewed=false`, `runResultsInspected=false`, and `learnerOutcomesMeasured=false`. An `explicitly_unmapped` record is not a failed assessment; `candidate_linked` is not a passed assessment.

## Independent review boundary: not yet completed

The existing `docs/case-system-vnext-expert-review.md` requires two independent domain-qualified reviewers, retained disagreements and adjudication for promoting evaluator expectations. Knowledge-link validity is a **different question** from its A/B Tutor preference judgments. Do not recycle A/B reviewer outcomes as concept-link approvals.

For any proposed link, two independent mathematics/assessment reviewers should separately inspect the exact source objective and version (including locale), graph node definition, focus/supporting distinction and evidence. Each should record one of `supported`, `partial`, `unsupported`, `insufficient_evidence`, plus source-field citations and any proposed missing knowledge node. Keep independent submissions separate; disagreements require adjudication or an explicitly unresolved status. Preserve source fingerprints and reviewer identity/qualification records. Developer rationales are not independent review. Even an accepted link does not establish mastery or student learning gain.

**No independent mathematics review submissions have been received for this pilot. All 24 mappings remain author-proposed and unreviewed.** All 61 graph prerequisite relations remain author hypotheses; `curriculumStageMappings` are empty pending clause-by-clause official curriculum verification.

## Engineering acceptance gates and non-goals

- All 31 in-scope sources are linked or explicitly unmapped, and the audit rejects stale versions, phantom nodes, duplicate sources/gaps, missing coverage, inconsistent decision points and mapping/gap collisions.
- Existing AcademicStructure, mathematics research evidence/suite, graph and exam-alignment validators remain the source of truth.
- Reverse lookup preserves **exam references**, **research tasks/scenarios**, **Eval cases/categories** and **Health decision points/dimensions** as distinct types; none represents measured model or learner outcomes.
- Do not change source suites, Rubrics, scoring thresholds, Judge prompts, Tutor-visible inputs, public benchmark, PR #349, or historic outputs. Zero provider API calls.
- Require exact-HEAD Node 24 typecheck, lint, full tests, build, CodeQL and Dependency Review.

**This code can be merged as experimental, read-only infrastructure after engineering gates pass.** Merging does not promote a candidate relation into independently reviewed subject truth or justify official coverage claims.

## Boundary of “mathematics complete”

This milestone completes the **present-source mathematics integration workflow**, not all mathematics from primary school to research level. The 44-node graph remains an experimental slice. Seven case gaps, 19 nodes without these task links, absence of official stage-mapping evidence, unreviewed semantic relations and unobserved learning outcomes remain explicit limitations.

Next, extract domain-neutral references and apply them to subject-specific physics, chemistry, biology and other maps. Do not force mathematics-specific node hierarchies onto those disciplines. Preserve exact-source versioning and honest `unmapped` / `unreviewed` labels.
