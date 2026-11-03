# 2025 Gaokao National I, Question 14 — complete numeric-answer verification

**Research-only closure for one sharply defined mathematical problem.** This package proves the correct numerical expectation under a typed model, and automatically rejects wrong numerical claims. It **does not** certify that an unofficial, mutable or recalled paper copy is the original exam text, or that source websites have independent editorial lineage.

## Fixed problem

The visually inspected second page of a third-party recollection PDF (https://www.jhgk.cn/upload/file/20250610/1749549496776033663.pdf) poses the number of distinct labels observed when drawing independently **three times with replacement** from **five uniformly selected labelled balls**. Multiple public sites transcribe the same problem, including:

- [21cnjy examination transcription](https://zujuan.21cnjy.com/paper/view/5580096) (question wording; no assumed answer key)
- [GaokaoHub](https://gaokaohub.com/paper/2025-xinkebiao-i-math.html) (reported answer 61/25)
- [MeloonExam](https://exam.meloon.top/paper/paper-gk-math-2025-xhgk1/) (reported answer 61/25)
- [Gaokao Wiki](https://gaokaowiki.com/math/%E7%9C%9F%E9%A2%98/%E6%B5%99%E6%B1%9F/2025/q14/) (reported answer 61/25; Zhejiang uses this exam edition)

Published answer reports are **corroboration only**. The sites' mutual editorial independence has not been audited. Their raw pages remain mutable and their independent editorial lineage is unverified. The typed evidence fixture is a record of inspected content, **while a separate research CI job now re-downloads the live public answer pages and PDF text** and rejects missing or contradictory evidence. The immutable Git blob SHA of the separately collected Gaokao PDF copy is checked at the same time. The PDF itself says it is a **recollection**, potentially imperfect.

## Three genuinely different exact proofs

Let `X` be the number of distinct ball labels seen among the three draws.

**Indicator proof**: for label `i`, the probability it is never seen is `(4/5)^3`. Linearity gives:

```math
E(X) = 5 [ 1 - (4/5)^3 ] = 61/25.
```

**Combinatorial occupancy proof**: exactly `k` distinct labels among `d` draws from `n` labels occurs in `n_(k) S(d,k)` ordered outcomes, using falling factorials and Stirling numbers of the second kind. For `n=5,d=3` the outcome counts are:

| Distinct labels X | Number of ordered outcomes |
| --- | ---: |
| 1 | 5 |
| 2 | 60 |
| 3 | 60 |
| Total | 125 |

Therefore `E(X) = (1*5 + 2*60 + 3*60)/125 = 305/125 = 61/25`.

**Direct exhaustive proof**: Python's `itertools.product(range(5), repeat=3)` explicitly enumerates all 125 ordered sample outcomes and counts the cardinality of each resulting set. This independently reproduces the above distribution, without using the Stirling recurrence or indicator formula.

Exact integers and `fractions.Fraction` prevent binary floating-point rounding. A separately implemented decimal parser treats `2.44` as exactly `61/25`, but `61/125`, `3` or slightly different decimals are provably false for this model. Unsupported natural-language answers and division by zero return `unverified`, not a guessed PASS/FAIL.

## Reproducible implementation

```sh
python3 scripts/research/verify_gaokao_q14_exact.py --require-source-consensus
python3 -m unittest scripts/research/test_verify_gaokao_q14_exact.py -v
```

**No human review is required by the algorithm or CI**, per the project direction. Nine Python tests verify the complete numerical answer, wrong answers, source disagreement, source host deduplication, model changes, exact parsing and cross-ledger consistency with the prior four-case multi-source record. A cross-model metamorphic check exercises all **42** small `n=1..7`, `d=0..5` combinations, ensuring all three methods give the same exact expectation and normalized distribution. This is a narrow deterministic claim check, not a general proof checker for arbitrary essays or mathematical statements.

The output separates:

- `verified_correct_under_typed_model` / `verified_incorrect_under_typed_model`: exact classification of a numerical answer to the typed question.
- `unverified`: unsupported or ambiguous candidate input.
- `mathematics_verified_published_sources_corroborated`: three independent exact mathematical methods agree and **at least two different website publishers are recorded** as reporting the same answer, with no recorded conflict.
- `mathematics_verified_source_consensus_unresolved`: conflicting or insufficient source reports; mathematical result remains independently fixed.
- `officialExamGoldCertified: false`: source authenticity and independent publisher lineage remain unproven; this flag is **not upgraded** by mathematical agreement.

This fixed case is a **fully checked numeric-result task under exact assumptions**, not a formally verified authentication of a historical national examination sheet. If someone silently changes replacement, uniformity, independence, number of draws, random variable or question number, the case rejects the altered problem.

## Automated live source verification — no human reviewer

A second job in `.github/workflows/gaokao-q14-complete-verification.yml` independently downloads a pinned GitHub 2025 national-I paper PDF and the separately collected recollection PDF, verifies the **Git blob SHA** of the pinned copy, extracts the relevant PDF page with `pdftotext`, and fetches current answer-site HTML from GaokaoHub, Meloon and Gaokao Wiki.

`scripts/research/audit_gaokao_q14_live_sources.py` requires the PDF page to match the **five labelled balls, three with-replacement draws, distinct labels, expected value** statement. It then requires **at least two separate observable answer-host pages** to display the mathematically derived exact fraction near that same question, not merely somewhere else on their sites. Identical downloaded HTML content cannot be double-counted. Any aligned page with an explicit contradictory final answer triggers a **hard conflict**, regardless of how many other pages agree.

Six negative-control regression tests cover mismatched problem conditions (especially *without replacement*), wrong answer sites, three-host majority against an explicit contrary source, same-content mirrors, script-only fake source text and a changed PDF blob identity. This is performed automatically in CI and **does not ask a person to check an answer**. Source-page unavailability or contradicting reports must fail closed, rather than reusing earlier positive metadata.

Run a local source audit with previously downloaded documents (paths must be actual PDF-extracted plain text and untrusted HTML, not trusted assertions):

```sh
python3 scripts/research/audit_gaokao_q14_live_sources.py \
  --pdf-text /tmp/paper-page-2.txt \
  --pinned-pdf /tmp/gaokao-pinned.pdf \
  --html-source gaokaohub=/tmp/gaokaohub.html \
  --html-source meloon=/tmp/meloon.html
```

The source audit still does **not** prove government/official origin or editorial independence, even with multiple agreements. The reported success is restricted to mathematical correctness of the exactly formalized finite-probability question plus consistency with the accessible published question descriptions and claims. No official answer gold is released.

## Generalization and what is actually resolved

The narrowly resolved point is **mathematical answer correctness for a finite, fully specified drawing-with-replacement expectation question**. No AI evaluation or human scoring is required to decide supported exact numeric candidates. The full exam-source-trust problem is **not resolved**, and no other question is treated as correct by inheritance. Next move: extract *source-backed typed claims* for other exam question families, and ensure mathematically rigorous calculations remain separate from mutable answer-key websites.

No production TutorBench Judge, historical reviewers, canonical scores, student information or full examination images are modified. This work is stacked on PR #317 (which itself depends on PR #316); leave Draft until CI and review of the research contract are complete.
