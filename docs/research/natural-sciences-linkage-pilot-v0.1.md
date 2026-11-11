# Natural sciences (physics, chemistry, biology): knowledge linkage pilot v0.1

**Status: author-proposed, unreviewed.** This is a read-only, source-bound *concept authoring index*, not a comprehensive science curriculum, a validated graph of prerequisites, a model score, or a measured learning outcome.

## Source ownership and prior work

This pilot reuses existing Case System vNext subject reasoning norms (domain taxonomy v0.1), the generic AcademicStructure contract, canonical TutorEval 0.2a.6 with its version overrides, the executable Case System pilot and prerequisite-accessibility contrasts, and the existing mathematics graph/exam reference validation. It never modifies mathematics source artifacts, existing test cases, Tutor/Judge runs, or scores.

- New versioned academic snapshot: `scenarios/case-system-vnext/academic-structure-v0.2.json`. The mathematics-only v0.1 snapshot **remains immutable** and functional.
- Three independent author-proposed knowledge seeds: `scenarios/experimental/natural-sciences-knowledge-v0.1/physics.json`, `chemistry.json`, `biology.json`, all version 0.1.0.
- Exact source bindings: `scenarios/experimental/natural-sciences-knowledge-v0.1/links.json`. Explicit unresolved attribution: `unmapped.json`.
- Read-only validator and coverage audit: `src/research/natural-sciences-linkage.ts`. Internal CLI: `src/cli/natural-sciences-linkage.ts`.

## What is included (not a full subject taxonomy)

| Discipline | Subject-specific organizing focus | Concepts | Authored linked sources |
| --- | --- | ---: | ---: |
| Physics | quantities, force equilibrium, kinematic representations and ideal-circuit assumptions | 4 | 4 English/Chinese Eval + 3 experimental decision points |
| Chemistry | atom conservation, symbolic equations, experimental kinetics and controlled conditions | 3 | 0 canonical Eval + 3 experimental decision points |
| Biology | photosynthesis matter/energy, experimental causation, osmosis at molecular and net-flow levels | 3 | 2 English/Chinese Eval + 3 experimental decision points |

The subject-owned concept maps each define their own domains, reasoning facets and caveats. The common interface is *only* stable identity, source scope, version, subject ownership and evidence status. There are **no mandatory prerequisite edges**. These ten concepts are selected because existing authored cases refer to them, not because ten concepts cover all three sciences.

## Exact frozen inventory and gaps

| Source | Total | Candidate links | Explicitly unmapped |
| --- | ---: | ---: | ---: |
| Canonical Eval science, English/Chinese | 8 | 6 | 2 |
| Case System executable vNext pilot: physical/chemical/biological decisions | 3 | 3 | 0 |
| Prerequisite-accessibility science contrasts, two per science | 6 | 6 | 0 |
| **Total** | **17** | **15** | **2** |

The English and Chinese `science-graph-error-001` cases are **intentionally unattributed**. Their original category is broad `science` and a graph's reaction-rate phrase alone does not confirm which disciplinary model or concept is being tested. They cannot silently become chemistry cases by title matching. All 17 source identities, versions, decision IDs, exact source-suite versions and candidate nodes must resolve: every source is either linked or explicitly unmapped, not both.

The six prerequisite-accessibility science cases are three pairs with different learner states. Those pairs are distinct *authored decision conditions*, not independent validation of three concepts. Chemistry has no canonical Eval case in this frozen eight-case science set; experimental vNext presence must not be misreported as canonical coverage.

## Offline inspection

After `npm run build` (Node 24), run:

```sh
node dist/src/cli/natural-sciences-linkage.js
node dist/src/cli/natural-sciences-linkage.js --subject physics --json
node dist/src/cli/natural-sciences-linkage.js --subject chemistry --json
node dist/src/cli/natural-sciences-linkage.js --subject biology --json
node dist/src/cli/natural-sciences-linkage.js --subject physics --node ideal-series-ohm --json
```

The report explicitly declares `scope=canonical_science_eval_and_two_experimental_suites`, `inventoryComplete=true`, `semanticReviewCompleted=false`, `officialCurriculumVerified=false`, `defaultTutorHealthCoverageMeasured=false`, `modelRunsMeasured=false` and `learnerOutcomesMeasured=false`. The experimental scenarios carry Health-style dimension tags through the existing compiler, but these do **not** establish **default Tutor Health** science coverage. Focus nodes and supporting nodes are counted separately. No model provider is contacted.

Negative tests reject stale case or suite versions, phantom concept nodes, duplicate source mappings, missing inventory entries, inconsistent academic registries and wrong discipline assignment. Engineering validation cannot establish that the proposed concept match is educationally correct.

## Human validity gate and next stage

Any promotion to validated coverage requires two independent domain-qualified reviewers for each proposed relationship; inspect exact source objective/version, disciplinary concept boundary and focus/supporting roles, retain conflicting submissions and independently adjudicate where appropriate. Reuse the independent reviewer principles in `docs/case-system-vnext-expert-review.md`, **not** its A/B Tutor preference labels for concept-link judgments. Specific curriculum/exam-stage claims require separately verified official standards and versions; do not infer them from general topic similarity.

**This stage builds an honest transfer pilot, not an exhaustive and expert-validated physics, chemistry or biology graph.** The next generalization should extract a small domain-neutral subject adapter without copying the internal mathematics ontology or scoring system.
