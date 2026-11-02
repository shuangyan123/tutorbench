# Expanded real-examination mathematics source catalog — research v0.1

**Status: SOURCE DISCOVERY ONLY. Zero newly authenticated mathematical answer keys. Zero full-paper automatic scores.**

## The actual paper-edition denominator

The corpus discovery scope is 2022–2026 inclusive, separating each examination paper **edition** rather than counting a province twice when it shares a paper.

| Exam | 2022 | 2023 | 2024 | 2025 | 2026 | Paper-editions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Gaokao mathematics variants (national A/B humanities/science, new-Gaokao 1/2, municipal/provincial papers as named) | 10 | 9 | 7 | 5 | 5 | **36** |
| Postgraduate Math I, II, III | 3 | 3 | 3 | 3 | 3 | **15** |
| Total | 13 | 12 | 10 | 8 | 8 | **51** |

The Gaokao series changes across years. **Do not normalize all variants to “全国一卷,”** do not assume two provinces are two independently set papers, and do not treat historical 文科/理科 versions as one exam. The directory's place lists are metadata, not independently audited exam jurisdiction. Different years also have different exam paper structures; no blanket question-count assumption for Gaokao is made.

## Source provenance and why this is not mathematical verification

* Gaokao: `deekur/gaokaomath` at immutable commit `6e9677221edffa192276de27d61044f19ce63de3`, **36 PDF Git blobs** in `普通高考/2022–2026`. The repository's compilation is CC BY 4.0 according to its README; underlying questions remain the rightsholders' works. Neither PDF text nor official answer keys are bundled in this project.
* Postgraduate Math I / II / III: `lx-ruc/kaoyanshuxue` at commit `196dc9d2d8271978a030a3721a828c8723cd3864`, containing **12 year-by-subject folders for 2022–2025** with exactly 22 question PNG Git blobs in each, **264 indexed question images total**. This is repository-directory evidence, **not** confirmation that each question is completely legible, that editions match an official examination, or that repository answers are correct. No repository `LICENSE` file was found by the GitHub lookup; seek permission before republishing original question images, and independently review the original exam rights.
* Supplemental Math II Markdown: `TsekaLuk/Kaoyan-Math2-Papers` at commit `fd42c56eed412cce0cb97d6bd688f314c78e542e`, 2022, 2023, 2024 alternative source conversions. Their formulas and solution keys are **not** accepted as verified answers.
* Postgraduate Math I/II/III **2026**: the pinned image repository has **no matching question folders**. Math I has a separate previously inspected third-party PDF pointer from PR #314; Math II and Math III remain discovery indexes only here. All three have no authenticated exam key in this catalog.

**Critically, 51/51 edition entries reflects enumerating the intended comparison framework, not 51 verified papers.** 36 PDF file presences and 264 image file presences are not mathematical correctness statistics. The question-level denominator for authentic complete paper scoring is not established. Report verified mathematical coverage as *not measured*, **never** `264/264`, `51/51`, or 100%.

## Machine-checkable record contract

`fixtures/research/exam-source-expansion-2022-2026-v0.1.json` stores one record per edition with a pinned repository SHA, its source path, a Git blob SHA for PDF files or **each** postgraduate question PNG, and explicit rejection of gold-key or provenance promotion.

```sh
node scripts/audit-exam-source-expansion.mjs
npm test
```

This script checks source catalog consistency, exact IDs, all expected years and varieties, 22 distinct PNG file identifiers for each 2022–2025 postgraduate subject/year, duplicate prevention, hash syntax, and the **non-gold** boundary. It does *not* read/verify binary PDF or PNG bytes, authenticate exam authorities, OCR a formula, solve equations, validate a written proof, or link to production grading. The separate CI workflow can compare the source catalog to frozen Git trees.

## Expert acceptance gates before using real exam answers

1. **Legitimate provenance:** retain the exact paper edition, unmodified source, rights clearance and source/version hash; verify problem pages and image legibility.
2. **Transcription:** independently transcribe each equation, diagram, conditions, option order, and the demand for one solution vs the complete solution set. Double review ambiguous markings.
3. **Reference truth:** independently compute/derive answers using exact arithmetic, symbolic tools, a proof system or expert review as appropriate. A provider's “official answer” label, internet key or a single symbolic output is insufficient by itself.
4. **Coverage:** count all actual question tasks, including those too difficult to parse. Record unique paper-editions, question count validated, attempted claims, verifiable claims, *proven wrong decisions*, correct abstentions and unreviewed items with explicit denominators.
5. **Integration:** only allow a source-pinned, independently checked claim into a research validation set, and only later integrate into TutorBench if the human review and CI gates pass. **Keep teaching appropriateness a separate dimension.**

This expansion is independent of experimental Judge prompts, canonical rubrics, blind review history and student learning outcomes. No original exam questions are copied into this repository.
