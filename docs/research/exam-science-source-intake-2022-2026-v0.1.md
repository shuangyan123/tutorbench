# 2022–2026 real-exam source intake: four-subject phase-1 evidence

**Phase status: IN PROGRESS — source intake, NOT completed corpus verification.** This document cannot be used as an official examination answer key, whole-paper validation, scoring coverage claim, or pedagogy finding.

## Purpose and reuse boundary

Phase 1 prepares a traceable **question-source foundation** for TutorBench Correctness (phase 2), then the four remaining TutorEval teaching capabilities and exam-grounded vNext Cases. No changes to canonical TutorEval, Judge rubrics, Tutor Health, or model prompts are made here.

Start with the **existing** [five-year mathematics source catalog](expanded-exam-math-corpus-v0.1.md), its [pinned artifact identity audit](pinned-exam-artifact-identity-v0.1.md), [multi-source dispute ledger](exam-multisource-answer-adjudication-v0.1.md), and [2025 Math I question inventory](exam-math-real-paper-verification-pilot-2026-11-02.md). Do not reimplement these gates.

## Newly inspected external source candidate

Upstream: [qingshuo/China-Gaokao-Papers-Collection](https://github.com/qingshuo/China-Gaokao-Papers-Collection), pinned commit `b33ea3dd5427afa963a944808d3a6c0183fc454e`, `data/exams.csv` Git blob `38d188f067065c597ad1e3903dd4130b10d653e2`. Source records include year, area, edition, subject, file origin, file SHA-256 when present, author-declared status, and license field. See [frozen aggregate snapshot](../../fixtures/research/exam-science-upstream-intake-snapshot-2022-2026-v0.1.json).

**Source quality matters:** upstream labels `verified` indicate the repository author's content/version check only. They do not establish that the exam authority originally issued that exact file, that original question rights allow reuse, that question/diagram transcription is exact, or that its answer is mathematically correct. A Git hash proves file identity, not semantic truth.

### Candidate file records, not independent exam editions

| Subject | 2022 | 2023 | 2024 | 2025 | 2026 | File records | Upstream `verified` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 数学 | 14 | 9 | 11 | 7 | 10 | 51 | 11 |
| 物理 | 22 | 17 | 36 | 27 | 16 | 118 | 12 |
| 化学 | 4 | 1 | 15 | 9 | 1 | 30 | 11 |
| 生物 | 3 | 1 | 10 | 3 | 1 | 18 | 10 |
| **Total** | 43 | 28 | 72 | 46 | 28 | **217** | **44** |

Across this filtered source snapshot: 172 `indexed`, 1 `discovered`, and 44 `verified` (all **upstream-declared**); 216 of 217 candidate rows have a recorded SHA-256, but **none was downloaded or independently byte-verified in this TutorBench phase**. License fields: 191 `unknown`, 25 `permitted`, 1 `restricted`; `permitted` is not a legal conclusion about the original exam author's rights.

The existing 51-row **TutorBench mathematics catalog** counts 36 Gaokao math editions plus 15 postgraduate Math I/II/III editions. The new 217 rows are **upstream file candidates** across four Gaokao subjects and may include duplicates, separate file versions or shared editions. **Do not sum 217+51 or claim they are certified papers.**

## Reconciliation result: explicit identity matching without false deduplication

The independent [frozen reconciliation record](../../fixtures/research/exam-science-source-reconciliation-2022-2026-v0.1.json) cross-checks the source CSV against the **existing pinned TutorBench mathematics edition catalog** using only exact decoded *upstream source paths*, not title similarity.

- **25/51** external **math candidate rows** have an exact source-path association to a single existing TutorBench mathematics Gaokao edition. This is a metadata linkage, NOT the number of newly authenticated papers.
- **26/51** math candidate rows remain unassociated by that conservative rule. They may include alternative scans or already-known editions but require manual review; treating all 26 as new would double-count.
- **18** broad `year + subject + paper_type + region` collision groups occur across the 217 candidates. These groups must NOT be collapsed: a national label can conceal I/II or historical arts/sciences editions; Zhejiang may have January/June variants.
- **216** candidates supply an SHA-256; **0 repeated recorded SHA-256 values** among these. Distinct hashes do NOT establish distinct examination papers, since scans/annotations/recompression can differ.
- Existing math source links are pinned to an immutable commit, but some other repository's `raw.githubusercontent.com/.../main/...` locator is **mutable**. A matching path is not byte equivalence. Confirm both source blobs separately before deciding content identity.

The reconciliation holds all matched/unmatched candidate IDs and collision-group IDs. The CSV itself and its Git blob are pinned; no question bodies or answers are imported. The upstream repo's declared file statuses are retained as claims, not adopted as certified labels.

## Priority scope and edition discipline

1. **P0**: 2022–2026 Gaokao mathematics (new-curriculum I/II, historical national A/B by year and actual arts/sciences variant), cross-referencing the existing 36-edition catalog. Begin with unambiguous short-answer, computation and structured-solvable items.
2. **P1**: 2022–2026 postgraduate Math I/II/III (15 edition targets), using the pinned question images, known 2025 Math I 22-question inventory, and independent PDF checks. The pinned image source currently has no 2026 folders; keep this as a gap.
3. **P1/P2**: Gaokao physics, chemistry, biology, as **discipline-specific exam editions**, often provincial, not automatically the same edition as nationally shared math papers. Start with reliable official or exam-agency source evidence and the upstream 2022–2026 candidate records, with separate problem and diagram review.
4. **P2**: postgraduate physics, chemistry and biology by declared **difficulty strata and exact institution/subject/year**, not a fictitious single nationally unified paper. Nationally set specialized subjects, where applicable, retain their actual IDs.

## What a source item must pass before it can be used as a verified question

| Gate | Evidence needed | Status today |
| --- | --- | --- |
| G0 Edition identity | Year, specific paper variant, subject, actual jurisdiction; deduplicate identical papers | Pending reconciliation |
| G1 Original provenance | Prefer exam authority copy; otherwise immutable third-party copy + authenticity caveat; rights reviewed | Not universally satisfied |
| G2 File integrity | Immutable path/revision and verified bytes/signature/hash, not a copied filename | Existing math tooling; new science candidate bytes not yet fetched |
| G3 Problem fidelity | Every question number, all subparts/options, diagrams, units and constraints checked against original page | No four-subject per-question certification in this snapshot |
| G4 Question inventory | Entire-paper question count, locations and unsupported/missing items retained as denominator | Only previously audited subsets exist |
| G5 Answer truth (phase 2) | Independently derived answer/certificate, candidate-source dispute resolution, two-reviewer escalation where needed | **Not promoted by phase 1** |

**Phase-1 completion is blocked** until target editions and a question-level source inventory pass G0–G4, with missing/uncertain items explicitly counted. The later correctness verifier works only on source-qualified statements and reports coverage/abstention; verified educational outcomes require separate evidence.

## Reproduction and guardrails

To reproduce the metadata summary, read the **pinned** upstream CSV and filter `material_type=完整试卷`, `year in 2022..2026`, and `subject in {数学,物理,化学,生物}`; count raw rows and `status` verbatim. The snapshot's counts are reproducible **metadata statistics**, not a quality audit of the underlying scans.

Existing gate commands (these already exist; no replacement parsers):

```sh
node scripts/audit-exam-source-expansion.mjs
node scripts/gate-exam-reference-claims.mjs --proposals fixtures/research/exam-claim-promotion-negative-controls-v0.1.json
python scripts/research/audit_pinned_exam_artifacts.py
```

**No model API calls, no original question files or answer keys copied, no new gold promoted.** Do not move to the next big stage on the strength of metadata counts alone.
