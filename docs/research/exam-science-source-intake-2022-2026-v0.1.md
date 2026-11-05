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

## Prior baseline at a0333fb7

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

## Prior baseline at 736c6af

**Prior baseline status: blocked.** The versioned [source review manifest](../../fixtures/research/exam-phase1-source-review-2022-2026-v0.1.json) is separate from the question ledger. It records reviewed evidence and its artifact SHA-256. The [discovery ledger](../../fixtures/research/exam-phase1-source-leads-2022-2026-v0.1.json) records leads with their risk labels. Discovery records cannot satisfy the acceptance gate. [Independent review of the prior HEAD](https://github.com/shuangyan123/tutorbench/pull/344#pullrequestreview-5782061808)

### Reviewed page evidence

On 2026-11-05 Codex read the rendered cover and question pages, recorded top-level starts by PDF page, and separately recorded continuations and question-to-visual links. The page ledger was transcribed from the source pages separately from the prior inventory. It is a source-page review, with no claim of independent human review or original-to-candidate fidelity. The official listing links for the seven graduate files were read from the issuer HTML. The code checks the exact PDF URL in an anchor and compares the recorded cover year, issuer, subject name and subject code with the claimed identity after replaying the reviewed PDF hash. The cover of a scan is an attributed visual observation. Poppler supplies the PDF page count and supports rendering, while the code does not infer scan text through OCR.

| Observed PDF | PDF pages | Source-page expected | Located |
| --- | ---: | ---: | ---: |
| 2025 Gaokao national I mathematics | 2 | 19 | 19 |
| NJUST 2022 845 普通物理（B） | 4 | 25 | 25 |
| NJUST 2022 814 分析化学 | 4 | 38 | 38 |
| NJUST 2022 817 普通生物化学 | 2 | 36 | 36 |
| NJUST 2023 614 普通物理（A） | 2 | 21 | 21 |
| NJUST 2023 845 普通物理（B） | 2 | 23 | 23 |
| NJUST 2023 817 普通生物化学 | 1 | 20 | 20 |
| NJUST 2023 881 大学化学 | 2 | 42 | 42 |
| **Total within these eight files** | **19** | **224** | **224** |

The four 2023 files add 106 top-level items. The two physics courses and university chemistry are two-up scans. Each two-page PDF contains four printed pages. The biochemistry PDF has one printed page. The 2023 chemistry scan has separate inorganic and analytical blocks that restart section numbering. The ledger uses different section IDs for each block. The 2022 biology C.9 options are on the next PDF page, so that page and the observed count of four options are part of the independent locator. The prior 2025 Math I inventory still contributes 22 historical locators reported separately. [NJUST 2022 publisher listing](https://gs.njust.edu.cn/zsw/66/86/c4584a353926/page.htm) · [NJUST 2023 publisher listing](https://gs.njust.edu.cn/zsw/a3/f2/c4584a369650/page.htm)

### Acceptance contract

| Gate | Evidence that can satisfy it | Real witness status after local replay |
| --- | --- | --- |
| G0 | Reviewed publisher identity, an exact listing anchor and a cover observation tied to the replayed PDF. Edition and alternate-version disposition require a separate review. A shared national integrated-science PDF is one paper with three subject components. A self-set course code identifies one regular exam within an institution and year, even if separate scans use different file names. | Seven issuer links and covers match. Edition disposition is still pending. The Gaokao witness is third-party. |
| G1 | G0 plus original authenticity and internal research permission reviewed against separately hashed evidence. Redistribution status remains separate and can restrict release even when internal research is permitted. | No original-authenticity or internal-rights approval. Redistribution remains unknown for the eight files. |
| G2 | Replay signature and SHA-256, pinned Git blob where applicable, and Poppler page count for visual witnesses. Each run reports which bytes it actually read. | Local cache replay verified 36/36 catalog PDFs, 25/25 mirror PDFs and 8/8 witness PDFs. The national I witness also appears in the catalog. |
| G3 | A reviewed match or mismatch per question tied to the source hash and replayed candidate hash, covering wording, subparts, options, units, formulas and visuals. | **0/224 compared and 0/224 qualified**. Locating and reading a question does not establish fidelity of a separate candidate. |
| G4 | A SHA-bound reviewed page index covering the entire file. Section-qualified top-level starts define the denominator. Inventory IDs, stem pages, continuation pages and visuals must reconcile. Counted cross-page options must also agree. | **224/224** reconciled and all eight local binary witnesses replayed. The phase-wide question denominator remains unknown. |

`expectedQuestions` derives from reviewed source starts. `locatedQuestions` counts matching inventory locators. `sourceComparedQuestions` counts the reviewed comparisons with both artifact digests replayed, including reviewed mismatches. `sourceQualifiedQuestions` counts eligible matches after G0, G1 and G2. The current whole-phase gate requires G0–G4 for every target in the versioned cohort below. The discovery rosters and historical binary replay are reported separately. A conflict blocks acceptance and an unavailable artifact never supplies a pass. The synthetic positive case exercises the same acceptance and exit logic as the real audit. Synthetic proofs and candidate bytes are generated only in the test temp directory.

The review format uses a reviewer, date and record reference. The official confirmation and research-rights evidence are replayed from `proofs/<paperId>.original` and `proofs/<paperId>.rights` in the supplied local evidence directory. Per-question candidate artifacts are replayed from `comparisons/<paperId>/<section>.<number>.json`. Keep those evidence files in access-appropriate storage. The audit verifies the bindings and statuses in a review. Decisions about authenticity, permission and semantic fidelity require review of the underlying evidence.

### Open scope and difficulty protocol

- **Gaokao science.** The discovery ledger separates legacy national integrated science from provincial selection tests and unconfirmed joint-province labels. It has national scope leads for each of 2022–2026, plus Henan and Anhui provincial policy examples. The Northeast four-province group is still a candidate label. A complete provincial, joint-paper and session roster remains open across all 166 science candidate files. [2026 national science scope and jurisdictions](https://www.moe.gov.cn/jyb_xwfb/xw_zt/moe_357/2026/2026_zt08/mtbd/202606/t20260610_1440059.html)
- **Previously unassociated Gaokao math.** Reviewed all 26 metadata records. Shanghai spring math is a separate January sitting outside the regular-sitting catalog used here. Of the remaining 25, 24 have a plausible catalog link and Zhejiang still needs a session identification. The suggestions do not change the historical crosswalk or attest that the pages match. [Shanghai exam authority spring-session notice](https://www.shmeea.edu.cn/page/02300/20231206/18042.html)
- **2026 postgraduate Math I/II/III.** Located and locally fingerprinted one third-party typeset candidate for each of the three targets. The first pages display the corresponding year and paper name. All include answer material. No authorized exam-authority copy or complete page-to-page comparison is established. Rendering II and III on Windows reported font substitutions, so the rendering is not formula-fidelity evidence. [Math I publisher file](https://static.kaoyan.cn/file/question/2025/12/27/f3a552ec0d163308d2ac28dc7a10bbd0.pdf) · [Math II and III provider index](https://m.hqwx.com/kaoyan-kaoshi/ziliaolm/0/34300/)
- **Postgraduate science.** The verified listing-to-cover subset covers seven course-year records at one institution in 2022–2023. Further 2024 leads include issuer listings at Wuhan Institute of Technology and Sichuan University of Science & Engineering. The latter lists sample material alongside past-paper material. Link, cover and artifact verification are still needed for these leads. The discovery ledger also records separate 2025 and 2026 course leads, including syllabus-only courses. The 2022–2026 institution/course/year roster remains open. [Wuhan Institute of Technology 2024 listing](https://yjs.wit.edu.cn/info/1020/6754.htm) · [Sichuan University of Science & Engineering download index](https://yjs.suse.edu.cn/zlxz_2382/list.htm)

`within-subject-demand-v1` is a proposed sampling protocol for task demand within a named subject and comparable syllabus, informed by the separation of cognitive complexity from score difficulty in Depth of Knowledge. A foundational task primarily uses recall or one routine procedure. An integrative task connects multiple concepts or representations and requires a justified method choice. An extended task needs a nonroutine derivation, investigation design, or evaluation of alternatives with several dependent steps. Record rubric version, question IDs, reasons for each decision, coverage of the paper, and review agreement. A whole-paper band requires a reviewed band for every top-level item and a strict majority in one band. Mixed or disputed papers remain unrated. Keep empirical difficulty separate until response data exist. School name, course code, paper name, question number and point value supply no rating. All seven real graduate records remain `unrated`. [Pennsylvania science assessment technical report, item development](https://www.education.pa.gov/Documents/K-12/Assessment%20and%20Accountability/PSSA/Technical%20Reports/2008%20PSSA%20Science%20Preliminary%20Technical%20Report.pdf)

### Replay

Use Python 3 and Poppler `pdfinfo` on PATH. The pinned index remains the same input.

```sh
curl --fail --silent --show-error \
  https://raw.githubusercontent.com/qingshuo/China-Gaokao-Papers-Collection/b33ea3dd5427afa963a944808d3a6c0183fc454e/data/exams.csv \
  --output exam-index.csv
python -B -m unittest scripts/research/test_audit_exam_phase1.py -v
python -B scripts/research/audit_exam_phase1.py --csv exam-index.csv --require-complete
python -B scripts/research/audit_exam_phase1.py --csv path/to/pinned/exams.csv --pdf-dir path/to/private/replay --require-byte-recheck
python -B scripts/research/audit_exam_phase1.py --csv path/to/pinned/exams.csv --fetch --require-byte-recheck
```

`--pdf-dir` replays local PDFs and reads optional `<paperId>.html` files matched to the reviewed publisher snapshots. Catalog and mirror paths follow the earlier instructions. If an issuer PDF and a separate catalog copy share a paper ID, place the issuer copy under `witnesses/`. `--fetch` downloads the allowlisted fixed catalog copies, mirrors, issuer listings and issuer PDFs into a temporary directory that is removed after the run. CI automatically exercises this path. Its step summary shows the counts and IDs for unavailable files. It fails on integrity or evidence conflicts. Transport failures remain visible as unavailable, and `--require-byte-recheck` makes any incomplete replay nonzero. Reports distinguish `metadata_only`, `local_files` and `public_fetch`. Neither the local files nor the CI run publishes PDFs.

One local public replay fetched and verified 32/36 catalog PDFs, 23/25 mirrors and 8/8 witnesses. Four catalog requests and two mirror requests ended in a transport error. The separate complete local-cache replay verified all 36/25/8. Hosted results are tied to the check run and its step summary.

## Review 5783104922 follow-up

The current acceptance cohort is [phase1-national-and-njust-v1](../../fixtures/research/exam-phase1-acceptance-scope-2022-2026-v1.json). It fixes the paper denominator before adding any new witness. Every target has a canonical ID, exam year, subject, edition and authority. Each group records its source basis and deferred scope. The intake snapshot, 51-entry mathematics catalog and discovery leads continue as separate inventories. The audit pins the target identities within this version. Changes to the acceptance cohort require a new scope version and explicit review of additions, deferrals and removed IDs. [Independent review of the prior HEAD](https://github.com/shuangyan123/tutorbench/pull/344#pullrequestreview-5783104922)

| Target group | Target papers | Included | Deferred |
| --- | ---: | --- | --- |
| National Gaokao mathematics | 20 | I/II for 2022–2026, A/B with separate humanities and science papers in 2022–2023, and the two legacy A variants in 2024 | Provincial and municipal editions, other sittings and alternate scans as separate targets |
| National Gaokao integrated science | 9 | 2022 A/B, 2023 A/B/new curriculum, 2024 A/new curriculum, and one integrated target each for 2025 and 2026. Each paper covers physics, chemistry and biology as components of one edition. | Provincial selections, unresolved joint-province labels and other discovery candidates |
| National postgraduate mathematics | 15 | Math I/II/III for each admission year from 2022 through 2026 | Other national mathematics subjects and recollections or samples as substitutes for originals |
| University-set postgraduate science | 7 | NJUST 2022 courses 845/814/817 and 2023 courses 614/845/817/881 | Other institutions, 2024–2026 self-set courses, specialized national science and broader difficulty sampling. Existing witnesses remain unrated. |

The two national science leads in 2025 and 2026 remain target slots even while the paper evidence is missing. Official commentary and regulations substantiate the scope of the exams, while they provide no authentication of a particular PDF. The separately scheduled Shanghai spring mathematics candidate remains excluded. The 25 pending alternate mathematics candidates and 166 science candidate files remain visible in discovery. A candidate may inform an edition review without creating another acceptance target. [National Gaokao commentary](https://www.moe.gov.cn/jyb_xwfb/xw_zt/moe_357/2026/2026_zt08/mtbd/202606/t20260610_1440059.html) · [Postgraduate admissions regulations](https://www.moe.gov.cn/srcsite/A15/moe_778/s3261/202509/t20250918_1413836.html) · [NJUST 2023 publisher listing](https://gs.njust.edu.cn/zsw/a3/f2/c4584a369650/page.htm)

There are **8/51 target papers with a page witness**, **43/51 missing witnesses** and **0/51 passing all five gates**. The eight witnesses still have 224 expected and located top-level questions and **0/224 source-compared or qualified**. The 22 historical postgraduate Math I locators remain separate. The full target question denominator stays unknown until every target has a source-derived page count and inventory. Missing evidence keeps its edition in the denominator.

### Authority and permissions

G0 recognizes separate authority routes for national Gaokao, national postgraduate mathematics and a registered university's self-set exam. The source type, exam route and authority must agree. An original-paper release or a university's own past-paper publication needs a replayed HTML snapshot, exact title and attachment URL, reviewed cover tied to the PDF digest, and a separate edition-resolution record. National covers also bind the variant. The title check excludes known commentary, syllabi, guides, sample and recollection types. Domain and title are screening evidence. The scoped cover review remains a human observation. It does not perform OCR or authenticate an authority merely by discovering a file. [NEEA Gaokao commentary index](https://gaokao.neea.edu.cn/html1/folder/1510/811-1.htm) · [NEEA national postgraduate exam portal](https://yankao.neea.edu.cn/)

The publisher review includes a reviewer ID, date, review record, schema version, scope and evidence SHA-256. A changed HTML digest returns `snapshot_changed`. Even a matching `liveAnchorPresent` on that page cannot supply `reviewed_snapshot_replayed`. Local snapshots and hosted replay are reported separately.

Official-original confirmation, internal research permission and public redistribution are separate evidence decisions. The implemented proof route accepts a scoped issuer document in machine-readable JSON, linked at its exact URL from the replayed, approved publication. The document must match the URL, issuer, exam and edition identity, publication digest, artifact digest, decision purpose and schema. A versioned review binds the same scope and document digest. Missing documents, malformed or duplicate JSON fields, wrong scope and mismatched decisions do not qualify. The gate abstains on unsupported formats such as unstructured letters. Public redistribution permission is evaluated separately from internal research permission. Missing or explicitly denied redistribution permission does not grant public use. A contradictory redistribution proof blocks acceptance. No real witness currently has an approved original or rights document.

### Question fidelity evidence

The new comparison gate reuses the existing G4 page index, exact artifact digest and per-question locators. A versioned page review binds the page index digest, PDF digest, target ID and page count. The existing Markdown transcription audit and controlled-math statement parser remain separate tools. They can expose transcription issues or parse controlled text, while the phase gate needs an independent transcription of the actual cited PDF pages. The reviewer record identifies the candidate author, the independent source transcriber and the pinned hashes of both structured records. Their reviewer and author IDs must differ.

The comparison reads both records and computes findings for the stem, conditions, symbols, formulas, units, ordered options, subparts and visuals. The source record must match the question, stem page, continuation pages and visual IDs. Visual evidence requires replayed bytes on both sides. The recorded review conclusion must agree with the computed findings, with a note for every difference. Unknown equivalence or incomplete evidence remains unverified or abstained. The implementation uses strict component and visual equality. A semantically equivalent redraw or rewritten formula can require abstention and review. Reports emit field statuses and review IDs, while comparison text and source assets stay local.

For local evidence, the existing `--pdf-dir` includes the reviewed publisher HTML under `<paperId>.html`. Proof documents are read from `proofs/<paperId>.original`, `.rights` and `.redistribution`. Each candidate and independent reference are stored under `comparisons/<paperId>/<questionId>.json` and `<questionId>.source.json`. Figure and table bytes use `<questionId>.<source-or-candidate>.<visualId>.p<page>` in the same directory. Public replay fetches only route-allowlisted sources. Reproduction commands from the preceding section still apply. `--require-complete` evaluates only the versioned cohort, while `--require-byte-recheck` also exercises the historical catalog and mirror replay. No real source witness was promoted in this round.
