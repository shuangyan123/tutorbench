# Phase 4 · official mathematics requirement census

Inspected on 2026-11-20 against #395 (`19d5c35ff249f647c0623ec805b6582c6d179147`). The unit is one normative leaf in one source edition. The same AP leaf can appear in two exam views. Whole-exam denominators and percentages are unknown throughout.

## Authority, applicability and access

| Authority and dated edition | Hierarchy inspected and applicable population | Access, fingerprint and limit |
|---|---|---|
| Ministry of Education, 普通高中数学课程标准（2017年版2020年修订）. [Ministry issuance](https://jsj.moe.gov.cn/news/2/1507.shtml) · [curriculum institute PDF](https://www.ictr.edu.cn/Uploads/File/2025/02/07/3.%E6%99%AE%E9%80%9A%E9%AB%98%E4%B8%AD%E6%95%B0%E5%AD%A6%E8%AF%BE%E7%A8%8B%E6%A0%87%E5%87%86%EF%BC%882017%E5%B9%B4%E7%89%882020%E5%B9%B4%E4%BF%AE%E8%AE%A2%EF%BC%89.20250207213419.pdf) | Historical national senior-high curriculum. IV → compulsory → Theme 1 → content requirements → §1 Sets, printed p. 15. Starts after introductory prose, ends immediately before §2 Logic. Curriculum cohort and national-paper session unspecified. | Public PDF, SHA-256 `cc4d3a20daa09f5185037e93fbacd58f7df1147392e3dae4bf261c3700ba4195`. Preserve the old edition and its separate logic census. Zhejiang 2025 paper-I item commentary supplies no normative denominator. |
| Ministry of Education, 普通高中数学课程标准（2017年版2025年修订）. [Southwest University, report of Ministry-commissioned implementation training](https://xbzprtjcyj.swu.edu.cn/info/1077/1335.htm) | The June 17, 2026 report identifies the revision and May 19–20 mathematics training across eleven provinces/municipalities. This establishes implementation activity. First binding nationwide teaching cohort, province-specific transition and year/paper selection remain unverified. | Public institutional report. No issuer-authenticated normative-text digest or verified chapter comparison for this edition in the census. No 2020 leaves carried into 2025. |
| Education Examinations Authority, 2027年全国硕士研究生招生考试数学考试大纲, HEP, September 2026. [Publisher catalogue](https://xuanshu.hep.com.cn/front/book/findBookDetails?bookId=6aa1910be119ac97297a608f) · [Ministry admissions rules, art. 34](https://yz.chsi.com.cn/kyzx/jybzc/202609/20260924/2293971511.html) | The notice names Mathematics I, II and III as centrally set subjects. The 2027 label is the admissions cohort. Chapter order, leaf boundaries and denominators remain unknown separately for all three. | ISBN 978-7-04-068404-9, 160 pages. Public catalogue HTML observed at 62,304 bytes, SHA-256 `c1187ef0d9282e5701faca81f3af1d06f2b1a7b6117ca477adc98954ec94a572`. The older HTML observation remains archived. Neither digest identifies the book text. |
| KMK, Bildungsstandards im Fach Mathematik für die Allgemeine Hochschulreife, resolution 2012-10-18. [KMK index](https://www.kmk.org/bildungsministerkonferenz/bildungsthemen/bildungsstandards.html) · [standards PDF](https://www.kmk.org/fileadmin/Dateien/veroeffentlichungen_beschluesse/2012/2012_10_18-Bildungsstandards-Mathe-Abi.pdf) | National AHR standard, L4 elevated additions, printed p. 20. Starts after the 12 common bullets and ends before L5 on p. 21. Specific exam session unknown. IQB tasks and each of the 16 Länder have distinct applicability. | Public PDF, SHA-256 `a636ec6947dca2044618787a9e29116d88f68909d02e4547050e4d3fc9c77546`. The three bullets are additional expectations at the elevated level. |
| College Board, AP Calculus AB and BC Course and Exam Description, effective Fall 2020. [Course page](https://apcentral.collegeboard.org/courses/ap-calculus-bc) · [CED](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-and-bc-course-and-exam-description.pdf) · [Fall 2026 clarifications](https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-bc-course-and-exam-description-clarifications.pdf) | 2026–27 teaching year, May 2027 AP exam. Unit 2 → Topics 2.2–2.3 → learning objectives B/C/D → EK leaves on printed pp. 56–57. Both courses use the same six leaves. Topic 2.4 starts on the next page. | Public PDFs. CED SHA-256 `fd571cdc252c24d33a75ed556ee20d9261ef1ad3dbb718d0caf78acecc8253ca`, clarifications `915d8bdfd3234810715848588e71197324addbc5e048c2a66a23a33be90124af`. Checked clarifications pp. 1–2: EK edits concern Units 5/7 and the timing changes concern exam administration. |

All four normative/clarification PDF byte fingerprints were rechecked. Repository assets contain bibliographic metadata, locators and short original summaries. No redistribution licence for publisher text is assumed.

**Graduate access route.** Search an authorized university library or interlibrary loan catalogue by the exact ISBN, or use the publisher's sample-copy application subject to eligibility. If inspection or derivative publication requires permission, request it from HEP. Acquisition, permission and actual chapter inspection remain pending. With authorized access, record the title/copyright page, edition and separate I/II/III chapter/page boundaries before transcribing any leaf. Keep restricted material outside the repository. No purchase or publisher contact took place.

## Section acceptance

| New section | Reproducible count and boundary | New author links |
|---|---|---:|
| CN §1 Sets | (1) concepts/notation has three numbered leaves, (2) relations has one unnumbered statement, (3) operations has three numbered leaves. Total **7**. | 0 |
| DE L4 elevated additions | Local linear approximation, chain rule, and logarithm in its antiderivative and inverse roles. The last bullet is one requirement. Total **3**. | 0 |
| AP Topic 2.2 | CHA-2.B.2, B.3, B.4 and C.1. The B objective spans two topics. The historical exclusion of B.2 from 2.1 still applies locally. Total **4**. | 0 |
| AP Topic 2.3 | CHA-2.D.1 and D.2. Suggested skills, resources and the objective heading are excluded. Total **2**. | 0 |

Inventory 0.4.0 adds **16 leaves in four complete sections**. Across seven sections it contains **36 unique leaves**, **12 author-proposed links**, **24 explicitly unmapped**, **zero independent subject reviews**. The source totals are CN historical curriculum 13, DE 15 and AP 8. Remaining chapters have no enumerated denominator. The 16 new unmapped rows await semantic analysis. No concept or prerequisite changed.

## Replay and next evidence

From the repository root, build with `npm run build`. Run `npm run exam:inspect -- --requirements` for the resolved 0.4.0 inventory. Supply one requirements snapshot path to replay an archived edition. For the migration diff run:

```sh
npm run exam:inspect -- --requirements scenarios/case-system-vnext/exam-specifications/requirements-0.3.0.json scenarios/case-system-vnext/exam-specifications/requirements-0.4.0.json
```

The v2 manifest inherits the pinned source, correction and exam applicability from each referenced v1 scope. It supplies new section boundaries independently of the inventory rows. The new snapshot appends to the validated 0.3.0 result. Diff entries pair stable IDs and distinguish additions, removals and changed locators/editions. A split or re-keyed unit needs manual reconciliation. Use the no-flag inspector for the 0.1.0 source registry.

Next priority is an authenticated 2025 Chinese text and dated teaching-cohort or assessment instrument, followed by rights-cleared inspection of the graduate book. Obtain subject review of proposed concept links as a separate step. Other KMK sections, Land rules, AP topics, SAT and civil-service subjects remain outside this increment.
