# Research-driven measurement reliability pilot v0.1

Status: **internal, experimental, not_calibrated; Draft PR only**.
Audit base: `main@a8109bd0c33430bc3219d74fe51dc57f0af0451a`.
Sources checked on 2026-11-11. No external items, textbook content, provider calls,
real human annotations, public scores or historical report edits are included.

## 1. Research audit: actual increments over this main

These are targeted primary-source readings, not a systematic review. Research
claims below belong to their authors, not to TutorBench. A working source join
or passing test establishes software behavior, not construct validity.

| Research and verified source | Already implemented here | Partial / missing credible evidence | Increment and priority |
| --- | --- | --- | --- |
| [MisconceptDialogue, AACL 2026](https://aclanthology.org/2026.aacl-long.112/), [method §4.4–4.6](https://arxiv.org/html/2610.31679v1) | `RecordedTutor`, `runTutorResponseCorpus`, TutorEval Judge contracts, calibration references and scoring provenance already exist. | No single frozen-source report comparing exact matching, existing Judge rubric observations and independently resolved human labels. Our expert-review protocol explicitly lacks independent labels. | **P0 implemented here:** freeze one source and show paired disagreement and unavailable evidence. The paper compares multiple lenses on identical simulated dialogues; its human anchoring and multi-Judge convergence are not transferable to our cases. |
| [K12-KGraph v4](https://arxiv.org/abs/2605.09635v4) | `subject-knowledge-linkage.ts` indexes exact sources, discipline namespaces, focus/supporting roles and explicit gaps. Math/science modules validate source versions. | No verified official-curriculum alignment, independently reviewed prerequisite graph or five-task-family evaluation. v4 has expanded beyond the original text-only graph; a README/schema resemblance does not establish alignment. | **P1 proposed:** audit evidence for a small set of existing links, using distinct relation and source types. No graph replacement or textbook ingestion. |
| [MisconceptionBench, EMNLP 2026](https://aclanthology.org/2026.emnlp-main.712/), [author repository and data terms](https://github.com/wkeaner/MisconceptionBench) | Evaluator-only misconception references and `scenario-evidence-provenance.ts` tie authored references to learner turns; science links preserve uncertainty. | No expert-validated distractor taxonomy or empirical student response distributions. Authored diagnosis and model-derived similarity cannot establish these. | **P1 proposed:** review existing misconception evidence and ambiguity, retaining simple baselines when a retrieval study is separately authorized. No import of AAAS assessment items; code license does not license assessment content. |
| [SafeTutors v2](https://arxiv.org/abs/2603.17373v2) | Existing answer leakage, misconception reinforcement, takeover failures, Scenario trajectories and Health findings cover overlapping risks. | No validated mapping to all 11 dimensions/48 sub-risks, no empirical extended-dialogue risk estimates, no human learning-harm evidence. Existing checkpoints are not automatically a longitudinal study. | **P1 proposed:** trace existing failure ownership across turns and disclosure policies before adding anything. Reuse failures; do not copy a second safety score or double count rubric/Health findings. |
| [Curriculum Brain v1](https://arxiv.org/abs/2610.05860v1) | Versioned knowledge maps, separately authored case links, exact-source validators and review protocol already separate knowledge from assessment items. | Authors explicitly state item mapping is designed but unimplemented; internal checking success is not external-standard agreement. Our links are likewise author-proposed. | **P2 proposed:** independently review selected existing links and preserve rejected/unresolved links. No agent pipeline or Q-matrix/learner mastery inference is justified here. |

The MisconceptDialogue-inspired priority is measurement reliability, not case
growth or replacing the scoring system. Simulated student success does not
establish real learning. This pilot measures Tutor **response-level** lens
differences; it does not measure the paper's student remediation endpoint.

## 2. Repository evidence and ownership

| Owning source | Verified implementation and tests | Remaining limitation |
| --- | --- | --- |
| `src/research/subject-knowledge-linkage.ts` | Exact source disposition; duplicate/stale/missing nodes and link/gap conflicts rejected. `tests/subject-knowledge-linkage.test.ts`. | `independentlyReviewed`, `modelRunsMeasured`, `learnerOutcomesMeasured` are false. |
| `src/research/mathematics-linkage-audit.ts` | All 18 canonical mathematics cases + 13 default Health decisions accounted for: 24 candidate mappings, 7 explicit gaps, 44 graph nodes. `tests/mathematics-linkage-audit.test.ts`. | Inventory completeness only; zero independently reviewed mappings. |
| `src/research/natural-sciences-linkage.ts` | Exact suite/case versions, compiler identity, subject namespaces, explicit ambiguous attribution; 17 sources, 15 candidates and 2 gaps. `tests/natural-sciences-linkage.test.ts`. | Experimental decisions are not default Health coverage; no official curriculum or semantic review established. |
| `src/reporting/tutor-evaluation-audit.ts`, `tutor-eval-reporters.ts`, `tutor-health-reporters.ts` | Historical/raw and wrapped result reading; rubric/run evidence, source checks, missing-evidence/provenance handling. `tests/tutor-health-scoring-profile-provenance.test.ts`. | A readable report is not calibration; unknown historical scoring identity remains unknown. |
| `src/scoring/config.ts`, `provenance.ts`, `aggregator.ts` | Effective scoring config, identity, authored rubric inputs and arithmetic checks; `tests/tutor-eval-scoring-provenance.test.ts`. | Integrity does not validate rubric meaning or recover missing historical Judge inputs. |
| `docs/architecture-integration-ledger-v0.1.md` | Scenario/compiler/evaluator/Health ownership and source bridge explicitly separated. `tests/scenario-evidence-provenance.test.ts`. | Authored learner state is not measured mastery; open PR work is not canonical evidence. |
| `docs/case-system-vnext-expert-review.md` | Blind, counterbalanced reviews; exact export lineage; adjudication and manual promotion gate. Existing expert-review tests protect these. | Protocol explicitly says no independent review data yet. Pairwise preference labels cannot be silently converted to correctness PASS/FAIL. |
| `docs/research/subject-knowledge-evidence-landscape-v0.1.md` | Prior research distinguishes knowledge claims, relations, authored links, model evidence and learner outcomes. | Does not itself implement or validate the five new research comparisons. |

## 3. Minimum design and reuse ledger

Entry: `src/cli/measurement-reliability.ts`, deliberately separate from the
production benchmark CLI, public exports and publication pipeline.

```text
existing dataset + frozen corpus + existing TutorEval result + explicit targets
  -> existing parsers / audit reader / scoring provenance checks
  -> internal frozen capture with SHA-256 fingerprints
  -> RecordedTutor replays identical responses
  -> exact-text observation | stored Judge labels | existing human reference builder
  -> separate internal report with coverage, pairs, issues and provenance
```

Reused modules (no replacement implementations):

- Dataset/corpus/result/Judge parsers own runtime validation.
- `parseTutorEvaluationAuditArtifact` accepts both raw results and corpus wrappers;
  wrapper corpus identity/generation metadata must match the source.
- `hasMatchingTutorEvalAuthoredScoring` checks original rubric ownership/weights;
  the existing result validator checks score arithmetic and normalized labels.
- `RecordedTutor` and `toTutorTurnInput` own replay and the Tutor-visible boundary.
  The synthetic demonstration obtains its result through `runTutorResponseCorpus`
  and the existing Judge execution mechanism; production reports consume stored
  results and cannot call providers.
- `toCalibrationCandidateResponseFile`, annotation/adjudication parsers,
  readiness checks and `buildCalibrationReferenceSet` own human-reference rules.
- `canonicalScoringJson` provides established object-key canonicalization.

Only two new internal abstractions are introduced: **frozen capture** binds the
full parsed dataset (including evaluator references), corpus, result and target
selection; **paired report** joins observations on case/version/run/response/rubric.
The CLI is file orchestration. The test fixture is a provider-free control, not
a new benchmark dataset. No new evaluator, registry, scoring algorithm, rubric,
prompt, production result schema or dependency is introduced.

The report's equality check is a reporting-only lens: exact full response text
must equal an authored `acceptedAnswers` member, falling back to `finalAnswer`
only when `acceptedAnswers` is absent. No trimming, case folding, numeric
extraction, paraphrase matching or answer repair occurs. Missing answers produce
null, not FAIL. Existing `matches_ground_truth` is a containment check; relabeling
it as exact equality would be incorrect. **MisconceptDialogue uses word-boundary
regex Strict matching; our `whole-response-exact-v1` is a different, deliberately
conservative stress lens, not a reproduction of its algorithm or reported gap.**

Targets must name one existing required Judge correctness rubric per case and
have a full-solution disclosure policy. This is a structural eligibility check;
a reviewer must still confirm that the selected rubric concerns the same answer
claim. The canonical math `full-solution-check-001` correctness rubric is
deterministic; its Judge guidance/actionability rubrics are not eligible substitutes.
No rubric is edited to manufacture a paired comparison.

## 4. Interpretation and evidence gates

- Planned denominator = explicit target cases × corpus runsPerCase. Missing
  responses/evaluations remain visible. Each comparison reports its own paired
  denominator; pass rates are computed over that **same** pair set.
- Strict has PASS/FAIL/null; Judge retains PASS/PARTIAL/FAIL/null. Abstention,
  missing Judge records and absent scoring/evaluator provenance stay null.
- A matrix and per-row directional disagreement codes preserve contradictions.
  Evidence-error counts are separate from semantic disagreements. Without human
  evidence, neither method is called correct; formatting/semantic causes are not
  guessed from a label difference.
- Human labels require the exact frozen source fingerprints plus existing
  response/rubric identity validation, two reviewers and resolved disagreement.
  Readiness is evaluated per unit, so a missing/unresolved unit does not erase
  another valid reference. Synthetic annotations never become human references.
- `calibrationStatus` stays `not_calibrated`, even when human observations are
  present. Reference agreement is not a calibration study or validation claim.
- Repeated runs are correlated response samples, not independent students. No
  confidence interval, hypothesis test, ranking or learning-gain estimate is made.
- Fingerprints detect drift **after capture**, not authenticity or historical
  Judge input identity. Existing results do not hash full original criterion text.
  Source owners must verify the original dataset before capture; this tool cannot
  retrospectively prove that an unversioned criterion was never changed.
- Reports omit response text, reference answers, criterion text, rationale,
  reviewer identities and Judge evidence text. The frozen source contains
  evaluator-only data and must stay in ignored private artifacts; it is not a
  reviewer packet, Tutor packet or public publication artifact.
- File outputs use exclusive creation. Existing files, including historical
  results and inputs, cannot be overwritten. A failed write can leave a new
  partial artifact; inspect it and use a fresh output name, never silently retry
  over an existing result. There are no remote effects or model retries.

## 5. Reproduce offline

From the repository root using Node 24:

```powershell
npm ci
npm run build
node scripts/research/measurement-reliability-demo.mjs artifacts/measurement-demo
node dist/src/cli/measurement-reliability.js report --source artifacts/measurement-demo/frozen.json --output artifacts/measurement-demo/replay.json
```

Use a fresh output directory/name each time. Demo labels and replies are
author-synthetic controls. A contradictory raw Judge/recorded-rubric pair is
rejected; deliberate **Strict vs Judge** disagreement is retained.

For existing local artifacts, make a JSON targets array such as
`[{"caseId":"eligible-case","rubricId":"existing-correctness-rubric"}]`, then:

```powershell
node dist/src/cli/measurement-reliability.js freeze --dataset artifacts/dataset.json --corpus artifacts/corpus.json --evaluation artifacts/evaluation.json --targets artifacts/targets.json --output artifacts/frozen.json
node dist/src/cli/measurement-reliability.js report --source artifacts/frozen.json --output artifacts/measurement-report.json
```

For a later authorized human review, keep `frozen.fingerprints` as the operator's
`human-source.json` when preparing existing blinded calibration packets. Preserve
the existing annotation/adjudication contracts; do not give source fingerprints,
Judge labels or evaluator-only data to the Tutor. Pass completed files using
`--annotation reviewer-a.json --annotation reviewer-b.json --human-source human-source.json`
and optional `--adjudication adjudication.json`. Capturing provenance after seeing
labels is not a substitute for prospectively bound review. This PR recruits no
reviewers and produces no real human labels.

## 6. Unresolved questions / next gates

1. Which existing frozen mathematical responses have an answer-level Judge rubric
   and trustworthy original dataset provenance? The canonical correctness/teaching
   split above means a real comparable cohort must be selected, not assumed.
2. Should a future protocol use the paper's word-boundary Strict or separately
   reviewed answer extraction? That is a distinct versioned measurement decision,
   not an unnoticed change to this lens or official evaluation.
3. Which domain-qualified reviewers and preregistered sampling/adjudication plan
   can anchor the chosen constructs? Existing pairwise expert-review outcomes are
   not the same labels as TutorEval rubric annotations.
4. What explains discordant rows: formatting, broader rubric construct, wrong
   answer, Judge error or insufficient context? This requires evidence review;
   the present report does not assign unsupported causes.
5. Independent review of graph edges/curriculum links, multi-turn safety studies
   and actual learner-outcome research remain separate scoped work. No such study
   is authorized or claimed by this implementation.

Acceptance evidence: [pilot acceptance report](measurement-reliability-acceptance-v0.1.md).
