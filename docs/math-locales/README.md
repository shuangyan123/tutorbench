# International mathematics review — localisation hub

**Status:** experimental reviewer-facing documents. Not an English-only copy of
China's exams, not official questions, and not a production localisation UI.

TutorBench shares stable conceptual IDs, mathematics references, and synthetic
Tutor-case IDs across exams. It does **not** share a universal exam-level,
official marking scheme, calculator policy, timing, or syllabus boundary.
Use the issuing body's course and exam specification **for the examination year**.

| Review audience | Locale | Exam authorities / routes | English guide |
| --- | --- | --- | --- |
| US admissions / secondary | en-US | College Board Digital SAT and AP Calculus | [United States review](en-US/exam-review.md) |
| UK / Cambridge International | en-GB | AQA GCSE 8300, Cambridge 0580 and 9709 | [British and Cambridge review](en-GB/exam-review.md) |
| International Baccalaureate | en-001 (international English) | DP Mathematics AA and AI, SL and HL | [IB DP review](en-001/ib-dp-review.md) |
| Graduate admissions | en-US | ETS GRE General Quant and GMAC GMAT | [Graduate-admissions review](en-US/graduate-admissions-review.md) |
| China | zh-CN | 中考、高考、国考、考研数学（一）（二）（三） | [中国及全球考试对照](../mathematics-global-exam-systems-zh-cn-v0.2.md) |

**Full English mathematics knowledge audit:** [44-node review](mathematics-knowledge-review-en.md).
**English student/tutor case descriptions:** the authored
[`suite.json`](../../scenarios/experimental/mathematics-challenge-v0.1/suite.json)
already contains English student utterances and tutoring expectations. Its
evaluator-only [`evidence.json`](../../scenarios/experimental/mathematics-challenge-v0.1/evidence.json)
contains mathematical references (not authentic examination questions).

### Evidence and review standards

1. Validate the **same mathematics**, including domains and conditions, regardless
   of whether a reviewer uses English or Chinese.
2. Validate **local exam relevance** against the actual issuing body's
   year-specific syllabus, permitted technology, response forms and tiers.
3. Evaluate Tutor help using the student's evidenced prerequisites and
   disclosure request; do not assume fast answers always imply efficient learning.
4. Separate a proposed syllabus link from an official source clause: the present
   mappings are **author-inferred**, not independently item-aligned.
5. Keep nonlocalised jurisdictions and future frameworks visible as coverage gaps.
   A common language does **not** mean the same exam system.

Maintained by the experimental examiner/reviewer workflow; the registry
[`mathematics-exam-locales-v0.1.json`](../../scenarios/case-system-vnext/mathematics-exam-locales-v0.1.json)
is separate from the scored evaluation dataset. No student outcome is claimed.
