# 2022–2026 real-exam source intake: four-subject phase-1 evidence

**Phase status: BLOCKED — partial source audit and question inventory.** This document cannot be used as an official examination answer key, whole-paper validation, scoring coverage claim, or pedagogy finding.

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

Across this filtered source snapshot: 172 `indexed`, 1 `discovered`, and 44 `verified` (all **upstream-declared**); 216 of 217 candidate rows have a recorded SHA-256, but the initial snapshot only counted declared hashes. The follow-up byte replay is recorded below. License fields: 191 `unknown`, 25 `permitted`, 1 `restricted`; `permitted` is not a legal conclusion about the original exam author's rights.

The existing 51-row **TutorBench mathematics catalog** counts 36 Gaokao math editions plus 15 postgraduate Math I/II/III editions. The new 217 rows are **upstream file candidates** across four Gaokao subjects and may include duplicates, separate file versions or shared editions. **Do not sum 217+51 or claim they are certified papers.**

## Reconciliation result: explicit identity matching without false deduplication

The independent [frozen reconciliation record](../../fixtures/research/exam-science-source-reconciliation-2022-2026-v0.1.json) cross-checks the source CSV against the **existing pinned TutorBench mathematics edition catalog** using only exact decoded *upstream source paths*, not title similarity.

- **25/51** external **math candidate rows** have an exact source-path association to a single existing TutorBench mathematics Gaokao edition. This is a metadata linkage, NOT the number of newly authenticated papers.
- **26/51** math candidate rows remain unassociated by that conservative rule. They may include alternative scans or already-known editions but require manual review; treating all 26 as new would double-count.
- **18** broad `year + subject + paper_type + region` collision groups occur across the 217 candidates. These groups must NOT be collapsed: a national label can conceal I/II or historical arts/sciences editions; Zhejiang may have January/June variants.
- **216** candidates supply an SHA-256; **0 repeated recorded SHA-256 values** among these. Distinct hashes do NOT establish distinct examination papers, since scans/annotations/recompression can differ.
- Existing math source links are pinned to an immutable commit, but some other repository's `raw.githubusercontent.com/.../main/...` locator is **mutable**. A matching path does not establish byte equivalence. The follow-up checks both fixed copies for the 25 links.

The reconciliation holds all matched/unmatched candidate IDs and collision-group IDs. The CSV itself and its Git blob are pinned; no question bodies or answers are imported. The upstream repo's declared file statuses are retained as claims, not adopted as certified labels.

## Priority scope and edition discipline

1. **P0**: 2022–2026 Gaokao mathematics (new-curriculum I/II, historical national A/B by year and actual arts/sciences variant), cross-referencing the existing 36-edition catalog. Begin with unambiguous short-answer, computation and structured-solvable items.
2. **P1**: 2022–2026 postgraduate Math I/II/III (15 edition targets), using the pinned question images, known 2025 Math I 22-question inventory, and independent PDF checks. The pinned image source currently has no 2026 folders; keep this as a gap.
3. **P1/P2**: Gaokao physics, chemistry, biology, as **discipline-specific exam editions**, often provincial, not automatically the same edition as nationally shared math papers. Start with reliable official or exam-agency source evidence and the upstream 2022–2026 candidate records, with separate problem and diagram review.
4. **P2**: postgraduate physics, chemistry and biology by declared **difficulty strata and exact institution/subject/year**, not a fictitious single nationally unified paper. Nationally set specialized subjects, where applicable, retain their actual IDs.

## First source-page locator witness

A **2025 New Gaokao I mathematics Q14** question has been visibly located on page 2 of a [public third-party recollection PDF](gaokao-2025-i-q14-thirdparty-page-witness-v0.1.md), with semantic alignment to the existing five-label/three-draws-with-replacement typed question. This is an **external recollection**, not the pinned original-source PDF, and does not independently authenticate the official exam or release an answer key. The page locator and its limitations are recorded separately to avoid falsely upgrading all existing 2025 catalog records.

## 2026-11-05 G0–G4 follow-up

The [metadata-only evidence ledger](../../fixtures/research/exam-phase1-witnesses-2022-2026-v0.1.json) records source URLs, observed hashes, edition identity and page locators. The original four-subject snapshot and crosswalk remain historical inputs.

| Gate | Checked in this follow-up | Open |
| --- | --- | --- |
| G0 Edition identity | Recomputed 217 candidates from the pinned CSV, 25 exact path links, 26 unmatched math records, and all 18 collision memberships. Mapped 25 byte-identical mirrors to their existing math edition IDs. | The 26 alternate math records had zero additional SHA-256 matches to the 36 catalog PDFs. Alternate editions, renderings and non-target material need source-level adjudication. The 166 science records have no verified edition denominator. Keep coarse collisions separate. |
| G1 Provenance and rights | Three graduate attachments are linked from the issuing university's past-paper listing and carry its name, exam year, subject title and code on the cover. The Gaokao witness is a third-party compilation. | Rights remain unknown for all four witnesses. Public access, a collection license and a CSV `permitted` label do not authorize redistribution of the underlying questions. |
| G2 File integrity | 36/36 catalog PDFs matched their pinned Git blobs and observed SHA-256 values. For 25/25 exact-path links, separately fetched copies from the two pinned repositories were byte-identical and matched the CSV SHA-256. Poppler read the expected page count for 4/4 visual witnesses, one of which is among the 36 catalog PDFs. | The existing Git-tree audit independently matched 264 question PNG blob IDs for 12 Math I/II/III entries from 2022–2025. PNG contents and legibility were not rechecked. All three 2026 image folders remain missing in the pinned source. Remaining Gaokao science file bytes are unreviewed. |
| G3 Question fidelity | Compared visible labels and layout on all 12 PDF pages from four witnesses. Bound figures and tables to their question and PDF page, including cases where they precede or follow the question stem on another page. Recorded visible notation and counts of immediately numbered subparts and options. | 118/118 newly located questions still lack an authoritative original-to-candidate comparison covering wording, all subparts/options, units, formulas and diagrams. Source-qualified questions remain zero. |
| G4 Inventory | Located 118/118 top-level items within four witness PDFs, with section bounds checked separately from item IDs. Reused the prior 22/22 Math I 2025 page inventory as historical evidence. | The full phase question denominator remains unknown. Neither the 217 candidate-file count nor the 264 indexed image count measures verified question coverage. |

### Editions and source leads

Keep the national math paper families by examination year. For 2022 and 2023 retain national A and B with separate humanities and science variants, alongside new-curriculum I/II. In the 2024 catalog, `national-humanities` and `national-science` are the legacy national A variants and I/II are separate. In 2025 and 2026 the national math sources identify I/II. These references support edition naming and series boundaries. They do not authenticate the third-party file bytes as the issued papers or validate the province lists in the catalog. [2022 exam-authority analysis](https://jyj.changde.gov.cn/zhdt/jydt/content_917875) · [2023 exam-authority analysis](https://edu.people.com.cn/n1/2023/0607/c1006-40008595.html) · [2024 exam-authority analysis](https://www.sdqljy.cn/news/9792.html) · [2025 national math analysis](https://education.news.cn/20250607/8c18a78606ae43e1affc28552a08154c/c.html) · [2026 Ministry of Education coverage](https://www.moe.gov.cn/jyb_xwfb/xw_zt/moe_357/2026/2026_zt08/mtbd/202606/t20260608_1439853.html)

For Gaokao science, keep separately set provincial papers, joint-province papers, and subject components of legacy integrated-science papers distinguishable. A math edition does not determine its region's physics, chemistry or biology edition. For graduate science, use institution, examination year, exact subject name and code, and paper variant for self-set exams. Keep nationally set specialized subjects under their own national codes where in scope. The research sample presently covers one institution and one year, and every difficulty field stays `unrated`. Comparable difficulty strata require defined criteria within a specific subject and evidence for each assignment. A university name or exam code does not supply that evidence. [Gaokao subject-selection policy](https://www.moe.gov.cn/jyb_xwfb/s5147/202109/t20210916_563605.html) · [2026 postgraduate admissions regulations, Article 34](https://www.moe.gov.cn/srcsite/A15/moe_778/s3261/202509/t20250918_1413836.html)

### Page observations

| Witness | Pages | Top-level items located | Scope of source evidence |
| --- | ---: | ---: | --- |
| 2025 Gaokao national I mathematics | 2 | 19/19 | Pinned third-party copy. Q14 is on PDF page **1** here. It is on page **2** of the separately recorded recollection. |
| 南京理工大学 2022 普通物理（B）845 | 4 | 25/25 | Issuer attachment. For A.8 the figure is on page 1 and the stem starts on page 2. The units printed in the scan were left as observed. |
| 南京理工大学 2022 分析化学 814 | 4 | 38/38 | Issuer attachment. D.2 has a table split over pages 2–3. E.1 has structural options on page 3 and a spectrum on page 4. |
| 南京理工大学 2022 普通生物化学 817 | 2 | 36/36 | Issuer attachment. C.9 starts on page 1 and its options are on page 2. |

Page numbers are one-based within each PDF. Section letters disambiguate restarted question numbers. Figure/table identifiers are local to a question and include unlabeled visuals. The ledger counts top-level items separately from blanks, options and nested subparts. `notation` records visually observed technical notation, without an exact transcription or a notation completeness claim. [南京理工大学 2022 年硕士初试部分自命题试题](https://gs.njust.edu.cn/zsw/66/86/c4584a353926/page.htm)

### Completion block

G0 needs a closed edition roster and explicit dispositions for alternate candidates, including the science jurisdictions and postgraduate institution/course/year/stratum sample. G1 needs authoritative source evidence and a documented rights decision for every in-scope item. G2 needs replayable artifact identity and integrity evidence. G3 needs a separate, item-by-item comparison against authoritative pages, with omissions and discrepancies retained. G4 needs a source-derived question denominator and a record for every question, including unverified or unsupported items. Samples, syllabi and recollections stay separate from original exam papers. Some institutions publish only through restricted candidate portals or stop publishing specific years, so a discoverable exam may still lack obtainable original evidence. [中国石油大学（华东）下载范围](https://yz.upc.edu.cn/2025/1104/c25697a283759/page.htm) · [西安石油大学 2026 年起停发真题](https://yjszs.xsyu.edu.cn/info/1023/1631.htm)

The strict phase gate stays closed with the current evidence. The audit only reports source qualification, and all present items remain unqualified. No original papers, extracts, answer keys, or model results are bundled.

### Reproduction

```sh
python -B -m unittest scripts/research/test_audit_exam_phase1.py -v
node scripts/audit-exam-source-expansion.mjs
python -B scripts/research/audit_exam_phase1.py --csv path/to/pinned/exams.csv
python -B scripts/research/audit_exam_phase1.py --csv path/to/pinned/exams.csv --require-complete
```

The CSV is [fixed at its upstream revision](https://github.com/qingshuo/China-Gaokao-Papers-Collection/blob/b33ea3dd5427afa963a944808d3a6c0183fc454e/data/exams.csv). The audit rejects unexpected bytes or differences in the published counts and crosswalk. `--require-complete` emits the blocked status and exits 1. CI tests that outcome and runs negative controls for G0–G4.

To replay the binary audit, use an ignored local directory. Save each PDF under its paper ID with a `.pdf` suffix. Use the exact catalog revision and source paths for the 36 PDFs, the pinned CSV revision and each matched row's `local_path` for the 25 PDFs under `mirrors/`, and the issuer attachment URLs for the three graduate PDFs. The fourth visual witness is already in the catalog. Run with `--pdf-dir <directory> --require-byte-recheck` and Poppler `pdfinfo` on PATH. The strict byte replay exits 1 if a required file is missing or differs. A successful byte replay preserves the phase block. Poppler rendering supports visual review. A structural PDF checker such as [qpdf](https://qpdf.readthedocs.io/en/stable/cli.html#option-check) can supplement parsing and rendering, while its checks do not establish question fidelity.

The existing [pinned artifact audit](pinned-exam-artifact-identity-v0.1.md) and [prior Math I 2025 inventory](exam-math-real-paper-verification-pilot-2026-11-02.md) retain their separate assurance levels.
