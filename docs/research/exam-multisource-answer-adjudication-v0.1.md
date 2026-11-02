# Multi-source examination answer adjudication — research v0.1

**Status: non-canonical, non-production, no independently approved answer gold.** The objective is to verify mathematical claims against **separate primary-paper evidence, independently published solutions, independently calculated mathematical results, and disputes**, while avoiding the false premise that three matching website answers prove a theorem.

## Why counts of websites are not proof

Two websites may republish a common answer key or copy the same mistaken OCR. An answer can also be mathematically correct for a **different interpretation of the problem**. A Git blob SHA verifies the identity of a *copy*, not the mathematical correctness or authenticity of its answers.

Each piece of evidence must retain source URL, publisher/origin group, problem-text alignment, claim value, author-lineage review state and the existence/absence of an immutable content snapshot. A source with **unverified lineage contributes zero independently confirmed publisher votes**, even when hosted on a different domain. Publishing a mathematically correct intermediate calculation is insufficient to certify a complete exam solution.

## First three live-source cases (exam edition + question number)

| Case | Source-page verification | Web/converted evidence | Two mathematical cross-checks | Current result |
| --- | --- | --- | --- | --- |
| 2025 Math I, Q20, outward cone flux | University-hosted exam PDF, page 4 visually reviewed; not established as authentic official paper | Pengyu Chen's independently posted solution page and csgraduates.com both show `-2√3π/3`; third-party OCR/Markdown instead ends in `√2π/4−1`; a third site changes the rotating line's equation | Divergence theorem with correct upper cap, and direct outward-oriented cone parameterization both give `-2√3π/3` | **Contested**: source conflict / textual drift, manual adjudication required |
| 2025 Math I, Q8, variance maximum | Same university-hosted PDF, page 2 visually reviewed | Three distinct publisher sites display choice **C**; converted Markdown answer marker is blank | Covariance-matrix eigenvalues and Cauchy bound with sharp equality each establish `1+|ρ|` | **Corroborated, provisional** (not official gold, publisher independence unreviewed) |
| 2022 Math II, Q2, double integral | Third-party Markdown / Git blob, original PDF question/options not yet independently read | Converted key says D with displayed D=2, while the same converted explanation derives 2/3 | Symbolic integration after region reversal and an independent antiderivative-derivative/endpoint check both yield 2/3 for the *transcribed expression* | **Blocked** until original question and options are verified |

Sources and stable metadata are in `fixtures/research/exam-multi-source-evidence-v0.1.json`. Key external source pages:

- University-hosted 2025 Math I paper: https://edu.xaiu.edu.cn/__local/F/34/3C/E53427A7070AE155EC2FF88073B_9EAE259B_511D6.pdf
- Pengyu Chen's dated 2024-12-23 individual mathematics working: https://kungfu-crab.github.io/posts/2025%E8%80%83%E7%A0%94%E6%95%B0%E5%AD%A6-%E4%B8%80-%E8%A7%A3%E7%AD%94/
- csgraduates.com independent website (editorial/actual lineage still unverified): https://csgraduates.com/study_methods/math/math1/2025/
- Another site with conflicting Q20 formula transcription: https://www.kuaiyizhi.cn/zh-cn/courses/higher-mathematics/2025-math1-zhenti/
- Source-converted Math I Markdown at `TsekaLuk/Kaoyan-Math1-Papers`, pinned blob `582683c6623fd24b1e3f46c8ef45112fa31b5beb`
- Source-converted Math II Markdown at `TsekaLuk/Kaoyan-Math2-Papers`, pinned blob `a256f908ba4dd13e4e3da861857dce6e19f47c29`

**Lineage cautions:** None of the external publishers has received a documented editorial independence audit. These sites are therefore *different publisher hosts with matching claims*, not verified independent provenance chains. Their mutable web pages are also not archived/hash-pinned in this initial research set. Human review and content snapshots are next gates.

## Two independent methods, each still bounded to a formalized statement

`scripts/research/adjudicate_exam_sources.py` executes two distinct mathematical identities for each of the three worked cases (six subchecks). For Q20, a direct surface parameterization must use the **outward**, not inward, cross-product orientation; the divergence/cap identity is checked separately. For Q8, exact symbolic spectrum and sharp variance bound are checked. For Q2, explicit Fubini region reversal and differentiation of the proposed antiderivative are checked.

This is **methodological cross-checking** using one substantial SymPy implementation, not a formally verified kernel or evidence of completely independent software stacks. A successful SymPy check does not verify a scanned formula, exam option mapping, unspecified conditions or proof adequacy.

Run:

```bash
python -m pip install 'sympy==1.14.0' 'mpmath==1.3.0'
python scripts/research/adjudicate_exam_sources.py
python -m unittest scripts/research/test_adjudicate_exam_sources.py -v
```

The isolated GitHub workflow repeats both operations without commercial model/Judge calls, nor modifications to production TutorBench.

## Adjudication rules for future expansion

1. **Separate original question identity from mathematics.** Independently confirm the paper edition, image quality, question number, all options, function domain, diagrams, units and orientation. Authenticate the official source or explicitly flag copies.
2. **Do not count publisher agreement without lineage review.** Group mirrored websites under the same publisher/original-solution family. Unknown lineage remains unknown; same repository's answer and its explanation are one publisher group. Separate websites alone do not establish independence.
3. **Use independently checkable mathematics.** Reconstruct exact mathematical claims with a trusted typed representation, compare at least two methods where practical, and record counterexamples and domain restrictions. Do not transform multiple partial subclaim passes into whole-question PASS.
4. **Flag all disagreements.** When a published answer conflicts with source options, when the mathematical derivation contradicts a copied key, or when problem statements differ, issue a dispute. A numeric majority cannot override a proven counterexample.
5. **Promote nothing automatically in v0.1.** The reviewer must explicitly approve a versioned evidence bundle, with a second paper/source read, source-independent derivation, verified lineage or independent proof and human judgment for proofs. Pending that contract, `answerGoldCertified=false` is mandatory.
6. **Report denominators.** Distinguish indexed exam editions, visually checked questions, source-consistent answers, mathematically checked subclaims, verified complete solutions, false passes and justified abstentions. Three examples are **not** a useful accuracy estimate.

## Integration boundary

This work is a child/stacked research branch of the expanded source-corpus PR (#316), not a new modification to the canonical benchmark or a replacement for the existing Judge. After source/derivation quality gates, the output can be consumed by an explicitly opt-in mathematics reference-verification experiment. The original human blind-review labels and educational / tutor-pedagogy scores remain unchanged.
