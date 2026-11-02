# 2022–2026 mathematics examination reference-verification pilot

**Status: non-canonical research. This is neither a ten-paper full corpus nor an official answer key.**

## Scope and provenance

Five examination years, 2022–2026 inclusive, for both postgraduate mathematics I (考研数学一) and national college-entrance mathematics paper I (高考全国 I / 新高考 I, as applicable). The catalog holds ten year-by-exam records. Its `index_only` entries are **discovery pointers, not verified copies of the named paper**. Four records have a directly checked page or web rendering. Published third-party scans, recollections and answers are not assumed correct merely because they exist.

The eight hand-transcribed pilot items refer to four year-by-exam records. Seven fit a deliberately limited exact-math grammar and are classified true; one higher-level series problem is **unverified**. There are **zero verified-false candidates in the frozen eight**; separate mutated negative-control tests check false-claim detection. **7/8 is not the mathematical accuracy rate or coverage of the examination papers.** Entirely uncollected questions are absent from the denominator.

Sources and page markers appear in `fixtures/research/exam-paper-source-catalog-v0.1.json` and `fixtures/research/exam-real-paper-pilot-v0.1.json`. Transcribed inputs and answers are author-reconstructed from visible sources, **not independently authenticated** or calibrated as educator gold. Verify image/formula transcription and edition before growing the corpus.

## Run

```sh
node scripts/verify-exam-math-pilot.mjs
node scripts/verify-exam-math-pilot.mjs --require-full-coverage
npm test
```

The second command intentionally exits nonzero while even one task remains unverified. This is correct fail-closed behavior, not a test failure.

## Trust boundaries

- The utility only evaluates explicitly typed task families; it does not extract formulas from arbitrary language, diagrams or PDFs.
- BigInt rational arithmetic avoids floating-point equivalence errors inside the supported arithmetic grammar; it does not make source-transcription assumptions true.
- These `verified_true/verified_false` statuses mean *consistent with the supplied structured task and reference computation*, not formally proven against an authenticated original paper.
- Unknown/missing task families, malformed answers, missing source pages and unsupported conventions return `unverified`.
- No production Judge, canonical scoring, Tutor Health, blind-review annotations, student data or external API calls are altered.
- In particular, do not benchmark ten complete papers or report 100% accuracy with this pilot.

## Required next gates

1. Obtain authoritative legible originals for all ten papers, distinguish the old and new national-I series by year, attach a copyright-compliant source record, and record the count of questions/pages fully transcribed.
2. Independently double-check every question, diagram, formula, choice mapping, units, assumptions and answer, including an external mathematical solution for each gold key.
3. Replace hardcoded exam-family patterns with a typed general math claim representation and an established symbolic/SMT backend where applicable. Differentiate solution validity from solution-set completeness and conditional domains.
4. Add out-of-distribution cases, adversarial paraphrases, ambiguous questions, unsupported proofs and human verification. Report coverage, incorrect-pass rate and abstention separately.
5. Keep study-only until expert review and CI demonstrate reproducibility; no inference of improved pedagogical outcomes.


## 2025 Math I OCR/transcription gate (2026-11-02)

A source-version-pinned independent preflight now exists at `scripts/audit-kaoyan-transcription.mjs`. It **does not bundle third-party papers** and requires the operator to provide the original Markdown as `--input`. The pinned Git blob SHA and PDF comparison observations are in `fixtures/research/kaoyan-math1-2025-transcription-audit-v0.1.json`.

```sh
node scripts/audit-kaoyan-transcription.mjs --input path/to/downloaded/2025-paper.md
node scripts/audit-kaoyan-transcription.mjs --input path/to/downloaded/2025-paper.md --require-clean
```

The strict command is **expected to exit nonzero** against the current third-party Markdown. It detects missing option labels/answer fields, unrecognized answer tokens, suspicious extraction glyphs and source SHA drift; it also records separately sourced observations from PDF review. Its source-status names are not mathematical judgments.

Observed risks include missing labels/garbled options in question 4, blank answer marker in question 8, a question/solution radical inconsistency in question 2, and endpoint wording inconsistency in question 3. Those findings require a page-by-page human PDF reconciliation; do not auto-repair formulas from solution guesses. The provisional candidate answer for Q2 is B, but the Q2 option numeric mapping in the old pilot is a **placeholder**, and the existing task remains intentionally `unverified`.

The code-only check does not authenticate the PDF as the official exam. Do not treat a source SHA match as semantic correctness or publish extracted answer keys without independent checking.
