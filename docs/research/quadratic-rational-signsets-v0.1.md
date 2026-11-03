# Complete real solution sets for bounded quadratic rational equations and inequalities

**Research contract 0.1 — complete result validation for a restricted mathematical family. Not general exam understanding, official answer-key authentication, or proof grading.**

## Exact mathematical scope

The verifier checks an explicitly structured real-variable claim

\[
\frac{N(x)}{D(x)}\ \square\ 0,\qquad x\in\Omega,\qquad
\square\in\{=,\ne,<,\le,>,\ge\},
\]

where N and D are rational-coefficient polynomials of degree at most two, D is not identically zero, and the declared real domain is the entire real line or a union of up to 16 exact intervals and singleton points. Coefficient numerator magnitudes and positive denominators are bounded by 1,000,000; up to 128 tasks per batch.

The candidate answer is an **entire real solution set**, not a single witness. Exact endpoints are rational numbers, quadratic surds (a+b√r)/c, or indexed roots of another bounded quadratic polynomial (the *root_of* type, supporting large roots without a decimal approximation).

Outcomes: **verified_complete_solution_set**, **refuted_solution_set** with an exact distinguishing witness, or **unverified** for unknown/unsupported input. Every outcome explicitly states that it is **not official examination answer gold**.

## Independent checks of exact set completeness

1. Strict typed JSON parsing: allowlisted rational arithmetic, polynomial coefficients, interval/point unions and bounded surd/root endpoints. Never evaluate arbitrary source strings or use floating-point tolerance.
2. **Sign chart:** calculate all exact real numerator zeros and denominator zeros, partition the real line into open cells and boundary points, determine exact signs, and preserve all denominator poles even when the rational fraction algebraically cancels.
3. Intersect the calculated set with the original real-domain constraint, including all open/closed endpoints and disconnected components.
4. Independently apply SymPy solveset (equations) or solve_univariate_inequality (inequalities) to the original fraction, separately excluding original poles. If the two computed sets disagree, **abstain**, never majority-vote.
5. Compare the full candidate set to the reference by testing all exact endpoints **and** one exact interior point in every interval cell. If they differ, return a reproducible algebraic counterexample.

The sign chart and the separate SymPy solver are different mathematical calculation paths that **share a single symbolic library**, not two independent formal-proof kernels. This is differential checking and exact set reasoning, not proof of 100% correctness for unrestricted mathematical problems.

An empty requested domain is intentionally classified as unverified (rather than issuing a vacuous positive certificate). Root multiplicity and solution-set multiplicity are distinct: repeating the singleton 2 does not supply the missing root 3 when both 2 and 3 are required, while a polynomial with a double root at 2 has the singleton set {2}.

## Specific false-positive classes now covered

| Structured mathematical claim | Correct complete set | Incorrect answer detected |
| --- | --- | --- |
| x²=4 | {-2, 2} | Just {2}, duplicated {2, 2}, or an extraneous root |
| x²=2 | {-√2, √2} | Missing irrational root |
| x²−1>0 | (−∞,−1) ∪ (1,∞) | Incorrectly closed endpoint |
| (x−1)/(x−1)>0 | All reals except 1 | Cancelling the factor and accepting all real numbers |
| (x²−1)/(x−1)≥0 | [−1,1) ∪ (1,∞) | Incorrectly including the denominator zero 1 |
| (x²−2)/(x²−3)>0 | (−∞,−√3) ∪ (−√2,√2) ∪ (√3,∞) | Pole included or middle interval omitted |

Other tests cover zero polynomials, no-real-solution cases, common factors, repeated roots, domain restrictions that exclude a root, disjoint sets, equality and inequality operators, and incompatible answer formats.

**Real exam-linked intermediate claim:** the previously manually formalized **2025 postgraduate Mathematics I question 16** constraint 2p²−3p+5/8=0, p in [0,1/2], has exactly the admissible solution p=1/4. The other algebraic root p=5/4 violates the probability domain. This *does not* verify the full original probability question or authenticate its official answer key. No original exam text or images are copied into the research code.

## Reproducibility and acceptance

~~~sh
python -m pip install 'sympy==1.14.0' 'mpmath==1.3.0'
python -m unittest scripts/research/test_verify_quadratic_signsets.py -v
python scripts/research/verify_quadratic_signsets.py \
  --fixture fixtures/research/quadratic-rational-signsets-v0.1.json
~~~

- **64 manually expected tests**: 39 correct complete sets, 13 demonstrably wrong sets, 12 required abstentions.
- All 13 refutations are checked to have an **exact** witness with different membership in the candidate and correct sets.
- **160 deterministically seeded random polynomial relations**, each checked by the sign-cell algorithm and a separate SymPy solver.
- Fault injection: if the independent solver gives a wrong result, the system refuses certification rather than choosing a majority.
- Invalid domains, undefined denominators, malformed roots, unsafe string-like input, changed exam context and strict nonzero exit status are tested.
- An isolated GitHub research workflow repeats these checks under pinned SymPy 1.14 and mpmath 1.3, without a human reviewer or commercial model.

## Completion boundary

**Resolved in this stage:** exact full real solution-set comparison for this bounded rational-quadratic family, including surd roots, denominator holes, explicit domain intervals, and strict vs non-strict inequalities.

**Not resolved:** raw exam statement extraction, arbitrary higher-degree or parameterized equations, algebraic/transcendental systems, proof-step validity, and authentic official paper origin. These need their own distinct mathematical contracts and evidence. This work is a stacked Draft PR based on #315, and does not update production TutorBench, Judge scores, historical blind reviews or human label data.
