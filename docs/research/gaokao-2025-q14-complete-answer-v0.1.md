# 2025 Gaokao National I, Question 14 — complete numeric-answer verification

**Research-only closure for one sharply defined mathematical problem.** This package proves the correct numerical expectation under a typed model, and automatically rejects wrong numerical claims. It **does not** certify that an unofficial, mutable or recalled paper copy is the original exam text, or that source websites have independent editorial lineage.

## Fixed problem

The visually inspected second page of a third-party recollection PDF (https://www.jhgk.cn/upload/file/20250610/1749549496776033663.pdf) poses the number of distinct labels observed when drawing independently **three times with replacement** from **five uniformly selected labelled balls**. Multiple public sites transcribe the same problem, including:

- [21cnjy examination transcription](https://zujuan.21cnjy.com/paper/view/5580096) (question wording; no assumed answer key)
- [GaokaoHub](https://gaokaohub.com/paper/2025-xinkebiao-i-math.html) (reported answer 61/25)
- [MeloonExam](https://exam.meloon.top/paper/paper-gk-math-2025-xhgk1/) (reported answer 61/25)
- [Gaokao Wiki](https://gaokaowiki.com/math/%E7%9C%9F%E9%A2%98/%E6%B5%99%E6%B1%9F/2025/q14/) (reported answer 61/25; Zhejiang uses this exam edition)

Published answer reports are **corroboration only**. The sites' mutual editorial independence has not been audited. Their raw web content is not cryptographically pinned; the machine-readable source evidence is a record of inspected content, not a fresh source retrieval every time the checker runs. The PDF itself says it is a **recollection**, potentially imperfect.

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

## Generalization and what is actually resolved

The narrowly resolved point is **mathematical answer correctness for a finite, fully specified drawing-with-replacement expectation question**. No AI evaluation or human scoring is required to decide supported exact numeric candidates. The full exam-source-trust problem is **not resolved**, and no other question is treated as correct by inheritance. Next move: extract *source-backed typed claims* for other exam question families, and ensure mathematically rigorous calculations remain separate from mutable answer-key websites.

No production TutorBench Judge, historical reviewers, canonical scores, student information or full examination images are modified. This work is stacked on PR #317 (which itself depends on PR #316); leave Draft until CI and review of the research contract are complete.
