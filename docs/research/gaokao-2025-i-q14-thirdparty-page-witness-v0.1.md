# 2025 New Gaokao I math Q14 — located third-party recollection page (research witness)

**Research status: a manually visually located question on a third-party recollection PDF; NOT authenticated original examination paper, NOT an approved gold answer.**

## Evidence inspected on 2026-11-05

- Public PDF: https://www.jhgk.cn/upload/file/20250610/1749549496776033663.pdf
- Visible title claims the **2025 新Ⅰ卷 mathematics paper**, but its page 1 explicitly says it is a **回忆版** (recollection) whose content may have errors. PDF is promotional/watermarked, not an exam authority-issued original.
- **Q14 is visibly located on PDF page 2 of 4** (zero-based page index 1), in the fill-in questions section, between numbered questions 13 and 15. The rendered PDF page was visually inspected, not merely searched by extracted text.
- Short semantic alignment only: **five labeled balls (1–5), three draws with replacement, random variable X counts the distinct labels observed, request E[X]**. The extracted text and the rendered page convey these relevant properties. No protected question statement or image is recopied into TutorBench.
- For exactly that semantic model, existing TutorBench typed mathematics can independently derive `5 * (1 - (4/5)^3) = 61/25`. **This checks a model, not provenance or an official exam answer key.**

## Explicit evidence distinctions

1. The web PDF **is not** the already pinned `deekur/gaokaomath` PDF source from `fixtures/research/exam-source-expansion-2022-2026-v0.1.json`; neither byte equality nor entire-paper text equality was checked.
2. Page-location success is limited to **this one third-party recollection PDF**. Its title, branding and the phrase 回忆版 **do not prove official-paper authenticity**.
3. One AI-assisted visual inspection of the displayed page is **not** an independent second human review and not an immutable content snapshot/fingerprint.
4. The displayed page has text and typographic artifacts elsewhere, so a future exact source-to-AST certification must compare against a trustworthy original paper, including formulas and any omitted context.
5. `officialExamAuthenticated=false`, `statementFingerprinted=false`, `independentRealGoldReview=false`, and gold/production promotion remains **blocked**. No existing source fixture is retroactively marked verified by this observation.

## Handoff for phase 1

This witness removes uncertainty about **where Q14 sits in a particular public recollection**, but does not meet G1 (original provenance) or G3 (authoritative original-to-typed-source fidelity). A source-reviewed original exam PDF, recorded page/fingerprint and independent human comparison remain prerequisites before the problem becomes an authenticated exam Case.
