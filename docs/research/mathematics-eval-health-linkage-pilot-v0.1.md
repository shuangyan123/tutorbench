# Mathematics Eval / Health knowledge linkage pilot (v0.1)

**Status: author-proposed, unreviewed; research-only.** This is an additive read-only case-to-knowledge crosswalk, **not** a new knowledge ontology, curriculum claim, scoring category, model experiment, or formal educational validation.

## Reused sources and boundaries

- Mathematics knowledge map: `scenarios/case-system-vnext/mathematics-knowledge-map-v0.1.json`, version `0.2.0`. All existing prerequisite relations in this map are author hypotheses.
- Canonical TutorEval dataset: `tutor-eval-v0.2a@0.2a.6`, loaded with `loadTutorEvalDataset()`. Its current bilingual snapshot is assembled from 0.2a.5 files with 0.2a.6 overrides; **do not** use `cases.json` as the current snapshot.
- Default Tutor Health scenario suite: `productive-struggle-intervention-v0.1@0.2.0`, loaded with `loadTutorScenarioSuiteVNext()`.
- Existing mathematics research suite and evidence registry: `scenarios/experimental/mathematics-challenge-v0.1/`. Its `taskId` → `nodeIds` mapping already exists and remains authoritative for those **research tasks**. This pilot does **not** duplicate those mappings.
- Existing architecture ownership / taxonomy audits: `docs/architecture-integration-ledger-v0.1.md` and `docs/architecture-integration-map.md` (particularly G1, G2, G6, G9). This document adds no new architecture authority.

The candidate links are stored at `scenarios/experimental/mathematics-eval-health-linkage-v0.1/links.json`. Each link pins the exact source ID and **case/scenario version**, links one or more existing knowledge-node IDs, and records a primary focus versus a supporting concept. The `evidenceAnchor` points to the exact **field**, not a copied source passage. The rationale is authored commentary for review; it is **not** a validated assertion of concept equivalence. The source dataset, default Health suite, mathematical research evidence, research suite, and knowledge-map identities/versions are pinned independently.

## Three sample regions

| Region | Existing Eval case IDs (not exhaustive) | Existing default Health scenario IDs | Existing math-research task |
| --- | --- | --- | --- |
| Fractional units / equivalent fractions | `fraction-misconception-001@1.2.0`; `paired-fraction-conceptual-001@1.1.0` | `ps-false-confidence@0.1.0`; `ps-same-misconception@0.1.0` | `fraction-unit-repair` → `mc-fraction-units` |
| Linear equations | `hint-only-linear-equation-001@1.1.0` | `ps-first-mistake@0.1.1`; `ps-repeated-mistake@0.1.1` | Other graph tasks are not used as substitutes for this area |
| Conditional probability | No **pilot-linked canonical Eval** case | No **pilot-linked default Health** scenario | `conditional-two-red` → `mc-conditional-normalization`, `mc-conditional-prerequisite`, `mc-conditional-transfer` |

An empty cell means **zero links within this pilot/scope**; it must not be presented as zero subject knowledge, zero total TutorBench cases, a demonstrated lack of model capability, or a gap in every research suite.

## Offline, version-pinned reverse lookup

The implementation is an internal read-only module at
`src/research/mathematics-linkage-pilot.ts`, with a narrow research inspector
`src/cli/mathematics-linkage-pilot.ts`. It reuses `loadTutorEvalDataset`,
`loadTutorScenarioSuiteVNext`, `parseMathematicsKnowledgeMap`,
`validateMathematicsTaskCoverage`, and `validateMathChallengeCoverage`.
It **derives**, rather than duplicates, research-task → knowledge-node links
from the existing mathematics map and task evidence registry.

After `npm run build`, run:

```sh
node dist/src/cli/mathematics-linkage-pilot.js
node dist/src/cli/mathematics-linkage-pilot.js --node fractions-units
node dist/src/cli/mathematics-linkage-pilot.js --node linear-equations
node dist/src/cli/mathematics-linkage-pilot.js --node conditional-events
node dist/src/cli/mathematics-linkage-pilot.js --json
```

The JSON report declares `scope: "authored_links_only"`,
`reviewed: false`, `modelRunsMeasured: false`, and
`learnerOutcomesMeasured: false`. No per-model scores or human performance
claims are computed. All counts retain separate denominators: **44 graph
nodes**, **16 authored research tasks / 20 research scenarios**, and
**3 canonical English Eval cases / 4 default-Health decision points** in
this limited pilot. Across all three source types, 23 distinct knowledge nodes
have at least one authored link: 22 from the pre-existing mathematics research
mapping plus one additional linked linear-equations node. This is **not** 23
validated knowledge areas or a 23/44 performance score. In particular, research-task nodes and direct Eval/Health
links are not summed as independent verified learning coverage. Missing links
mean only that the inspected authored source does not contain a link.

## What is and is not verified

`tests/mathematics-eval-health-linkage-pilot.test.ts` calls the shared projection and validates exact source identities against the current loaders, research evidence/suite matching, known graph nodes and decision-point IDs; exercises reverse lookup, coverage counts, and rejects stale source versions, phantom nodes, duplicate source records, and wrong decision points. It is designed to run offline under the normal Node 24 test suite.

- **Code-level validity:** a link refers to a known case, decision point and knowledge node at pinned versions; independently testable.
- **Authored topical plausibility:** each proposed relation is supported by an explicitly named authoring field. This pilot is **not** independent subject-matter validation.
- **Scientific/educational validity:** concept equivalence, assumed prerequisites, case representativeness, reliable teaching claims and learner outcome gains all remain **unverified**.
- **Runtime isolation:** registry is not imported by Tutor/Judge runners, does not change Eval/Health Rubrics or scoring, and does not flow into Tutor-visible context, public leaderboards or historic artifacts.

## Recommended review gates before promotion

1. Independently review and adjudicate the proposed fraction, equation and probability concept boundaries. Record disagreements, evidence and source/version provenance, and whether each link is focus, supporting, compound, or unsupported.
2. Decide how to model *mathematics research task* → *scenario* → *decision point* versus *canonical Eval case* without conflating their IDs, and whether a reusable, typed crosswalk is necessary after the pilot.
3. Add an explicit **versioned subject/domain mapping** only where a real consumer needs it. A free-form subject like `physics` must not be silently relabeled as canonical Eval `science` without a declared rule.
4. Consider a read-only coverage query that displays distinct counts for: mapped nodes, linked authored cases, executable scored case-runs, independently reviewed source relationships, and validated learner outcomes. Never add these denominators together or infer outcomes from case existence.
5. Re-run `npm run typecheck`, `npm run lint`, `npm test` and verify the exact PR HEAD CI before merging. Tests confirm structural wiring, **not** subject-matter validity.

No provider API call or historical-data rewrite is intended in this pilot.
