# Dual-path answer verification: published reference vs. no-reference candidate

**Research contract 0.1.** A single reproducible, provider-free bridge now checks (A) *an existing reference answer* and (B) *a proposed answer for a problem that has no reference answer*, using the **same mathematics-first adjudicator**. It also derives exact answers with no supplied answer at all. No mandatory human reviewer or paid Judge, no production scoring changes, and no automatically authenticated examination gold.

## What is actually established

The mathematical target is derived from the **typed problem only**. Reference answers, third-party publisher statements and offline model-output replays are not available to that derivation. After a mathematical result is independently corroborated, the bridge compares each answer to it. This is the essential separation between *answer creation* and *answer verification*, avoiding circular “AI says AI is correct” scoring.

| Path | What arrives | Result/meaning |
| --- | --- | --- |
| Published answer | Typed problem + claimed answer + optional pinned source-case identifier | Verify or refute the **claim's mathematics**. Separately report whether source evidence is provisional, contradicted, unauthenticated or absent |
| No-answer deterministic baseline | Typed problem, **no answer field and no source key** | Independently compute a complete exact answer, with derivation method IDs. Clearly label it **deterministic mathematics, not an AI model run** |
| No-answer candidate replay | Typed problem + a self-contained raw model-output sample and independently extracted candidate | Verify or refute the candidate against fresh math, or abstain if the raw output cannot safely be parsed. **Offline replay only**; never count as observed live model accuracy |

All modes use the same mathematical engine. A replayed candidate is a **test fixture**, not proof that the named model actually solved the question. A numerical candidate must appear as the **entire visible text** of the replay; prose, formatting ambiguity and altered extraction are rejected, never silently treated as exact answer matches. Natural-language solutions and formal proofs are not yet parsed.

## Supported source mathematics

1. **Finite equally likely draws with replacement**, typed independence, distribution metric and event. The imported (pinned from research PR #322) exact occupancy engine checks three separate distribution calculations—surjection/Stirling counting, occupied-state DP and inclusion-exclusion; expectation and variance also require an independent indicator-variable check. When the outcome count is small, exhaustive enumeration is a fourth safeguard. It covers bounded arbitrary n/d (1≤n≤64, 0≤d≤128) and exact numeric/decimal candidate answers without float tolerance.
2. **Univariate rational equation/inequality complete real sets**, bounded numerator and denominator degree ≤2, with explicit domain and exact candidate set pieces, imported by reusing the earlier #323 sign-chart and independent SymPy solver without copying or mutating its implementation. This supports e.g. x²−2=0 with both irrational roots, or (x−1)/(x−1)>0 with the original forbidden x=1 retained.

There is **no generic free-form exam parser**, no proof of correctness of unrelated calculus tasks, no claim that published question transcriptions have been authenticated, and no general AI solution quality score.

## The first real-examination-linked case

The pinned 2025 new Gaokao I mathematics Q14 record from PR #317 contains a third-party recollection PDF and three published worked-answer claims. The exact typed mathematical premise is: five uniformly likely labelled balls; three independent draws **with replacement**; count distinct labels. The two independent expectation derivations are:

\[
5\Bigl(1-(4/5)^3\Bigr)=61/25,
\]
and a complete occupancy-count expectation with ordered outcomes:
\[
\frac{1\cdot5+2\cdot60+3\cdot60}{5^3}=61/25.
\]

The reference \`61/25\` agrees with the mathematics. The three publisher claims agree too, but **different website names do not prove separate source lineages**; the original exam paper has **not** been authenticated by independent immutable evidence. The audit explicitly reports:
- source status \`math_matches_unverified_publications\`, not \`official_correct\`;
- \`independentlyVerifiedPublisherLineages=0\`;
- \`paperOriginalAuthenticated=false\`;
- \`officialExamGoldCertified=false\`.

If a source's value conflicts with the mathematical result, the disagreement is reported rather than resolved by publisher majority. The source-case identifier is guarded by **precise typed-problem identity**; an n=6 problem cannot be silently relabelled as the Gaokao n=5/d=3 question. The other three problems on the imported four-case source ledger are intentionally **not assigned arbitrary new mathematics adapters**: they stay unsupported until a well-defined formalization and independent calculation method exist.

The historical evidence ledger copied from #317 contains source collection metadata and legacy review policy fields. **This new bridge does not require a person to score the answer**: it uses exact mathematical proof and automated provenance checks, while keeping official-authenticity *unverified* rather than manufacturing a gold label. Human review is not a runtime prerequisite.

## Verified outcome classes

- \`reference_mathematically_verified\` / \`reference_mathematically_refuted\`: the supplied reference is correct/incorrect **under the typed assumptions**, not necessarily an authoritative exam key.
- \`deterministic_no_answer_solution\`: exact answer generated **without** a known/reference answer or AI candidate; its source is explicitly \`independent_exact_math_solver\`.
- \`replayed_candidate_mathematically_verified\` / \`replayed_candidate_mathematically_refuted\`: a strictly parsed **offline replay** was checked, not a measured fresh AI model run.
- \`unverified\`: unsupported problem, inadequate input, mixed prose, changed paper formalization, failed mathematical cross-check, or source attribution mismatch.

The report always publishes **both denominator and numerator** for replayed candidates, but it separately returns \`genuineAIModelRuns: 0\` and \`measuredLiveAIAccuracy: null\`. No one can honestly turn a fixture result into an empirical live-model accuracy statistic. It also always reports \`realExamCasesProvenAuthenticated: 0\` and \`officialExamGoldReleased: 0\`.

## Reproduction and acceptance

\`\`\`sh
python -m pip install 'sympy==1.14.0' 'mpmath==1.3.0'
python -m unittest scripts/research/test_verify_dual_path_math_answers.py -v
python scripts/research/verify_dual_path_math_answers.py \
  --fixture fixtures/research/dual-path-math-evidence-v0.1.json \
  --sources fixtures/research/exam-multi-source-evidence-v0.1.json
\`\`\`

Fixed 27 research cases include **4 correct and 2 incorrect published-reference math claims**, **6 complete deterministic no-reference solutions**, **3 correct and 3 incorrect replayed numeric answers**, and **9 mandatory abstentions**. They include a real-Gaokao-linked case and synthetic general-family cases, but **all are manually structured**.

Additional tests: randomly generated unseen occupancy problems, original-domain/no-hole equality, altered source-key and source-lineage detection, blind route refusing to ingest reference answers, invalid model metadata not counted as live, exact decimal vs nearly equal decimal, corrupted dynamic-program and symbolic-oracle fault injection that must cause abstention, and strict CLI failure for unverified cases. The path-isolated GitHub CI checks all 27 outcomes, the real source's 0 confirmed lineages and 0 authenticated papers, and the fact that **no live model-accuracy number** is published.

## Exactly what remains

This milestone solves the **common dual-path adjudication interface and blindness/evidence boundary for two bounded mathematical task families**. To measure *real* AI self-solving accuracy and real-examination coverage, next connect a versioned real-model executor, snapshot the **original model-visible problem** and raw answer with provenance, perform correct answer extraction (with a safe abstention state), and compute true live-model accuracy **against independent mathematical evidence**, including proper denominators. With no credentials or connected live-model run, **this CI intentionally makes zero AI model calls**.

Broader math subjects, true official-original paper authentication, source lineage proof, question OCR/NLP, arbitrary language answers and pedagogical quality remain separate tasks. These results cannot be presented as generalized AI mathematical accuracy, or used to promote official gold.

**Dependency:** This is a stacked Draft branch based on #329 (the exact rational transformation semantics research) and imports the bounded occupancy engine from #322 plus the historical multi-source ledger from #317. All three remain separate research tracks until their dependency integration is reviewed. The new work does not change production TutorBench Judge or historical case scores.
