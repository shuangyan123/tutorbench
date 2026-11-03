# Complete parameter-dependent quadratic inequality solution families

**Research v0.1: entire real parameter axis, exact x-solution sets.** This document defines a mathematical proof obligation, not a certificate for an official examination answer. No manual reviewer or commercial model is necessary for the bounded verification, and no existing production TutorBench scores or human-review labels are modified.

## Exact problem family

For **every real parameter t**, verify the **entire real solution set in x** of

\[
A(t)x^2+B(t)x+C(t)\ \square\ 0,\quad
\square\in\{=,\neq,<,\le,>,\ge\},
\]
where each coefficient is an affine function of t with bounded rational coefficients. The six rational inputs must be typed and bounded exactly, with a positive denominator. These conditions encompass both genuine quadratics and **degeneration to linear or constant inequalities** at special parameter values.

A candidate solution is a complete partition of the real t-axis into at most 32 disjoint intervals or singleton points, with one standard *complete x-solution-set template* on each branch. Fourteen supported templates:

- \`all_reals\`, \`empty\`, \`point\`, \`two_points\`, \`except_point\`, \`except_two_points\`;
- \`left_open\`, \`left_closed\`, \`right_open\`, \`right_closed\`;
- \`between_open\`, \`between_closed\`, \`outside_open\`, \`outside_closed\`.

The templates are *mathematical objects*, not merely root counts: the associated x-boundaries are generated from the **actual exact linear/quadratic root formulas** at the given parameter and sorted in ascending order even when the leading coefficient is negative. Open/closed comparisons preserve or remove all appropriate root endpoints. Nonreal roots are never treated as real boundaries. Arbitrary natural-language answer strings or arbitrary student-provided alternative root expressions are not yet parsed.

## Why this checks all real parameter values

For affine-in-t rational A, B and C, the discriminant \(\Delta(t)=B(t)^2-4A(t)C(t)\) has degree at most two in t. Every change in the solution-set *template* can occur only at a real zero of **A, B, C, or Δ**. Additional candidate parameter endpoints may introduce erroneous gaps or overlaps.

The implementation therefore:

1. Computes all exact real zeros of A, B, C and Δ (including irrational surds) **plus every proposed branch boundary**.
2. Splits the entire real t-axis into open sign-invariant intervals and singleton critical values. It checks **every** singleton and a certified *exact rational interior sample* for each interval. This is a finite covering argument, **not** a random sampling heuristic.
3. From the signs of the specialized coefficients and discriminant, independently constructs the entire x-solution set for the requested relation, with exact symbolic boundaries.
4. Independently asks a separate SymPy solver to solve the original, unsimplified polynomial comparison at each representative t. The two **entire real sets** must agree on exact boundary points and interval interiors. An unsupported second solver or disagreement produces \`unverified\`, not a majority-vote PASS.
5. Requires that **exactly one** submitted parameter branch covers each representative t and its x-set template agrees with the reference. Any missing/overlapping region or wrong solution gives a reproducible exact counterexample **parameter**.

The candidate classes cannot silently substitute “two roots” for “outside an open interval”; comparing root counts alone would miss inequality orientation and endpoint errors. The two solver implementations share SymPy and are **not independent formal proof kernels**.

## Representative full mathematical classification

For \(tx^2+x+1>0\):

| Parameter t | Complete real x-solution set |
| --- | --- |
| \(t<0\) | Open interval **between** the two real roots |
| \(t=0\) | \(x>-1\) |
| \(0<t<1/4\) | **Outside** the two roots, excluding both endpoints |
| \(t=1/4\) | All real x except \(x=-2\) |
| \(t>1/4\) | **All real x** |

The two roots in relevant branches are \(x_{\pm}=(-1\pm\sqrt{1-4t})/(2t)\), **ordered by value**. A negative t reverses which ± root is smaller.

This captures both major failure modes:

- **Leading coefficient changes sign or vanishes**: using a quadratic formula at t=0, or forgetting to reverse the inequality direction for negative leading coefficient, must be refused.
- **Strict vs weak inequality at a double root**: at t=1/4, the strict positive comparison excludes x=-2; the non-strict comparison includes it.

Other tested families include \(x^2+tx+1\) (critical parameters ±2), \(x^2+tx+1/2\) (irrational critical parameters \(\pm\sqrt2\)), \(tx+1\) (linear slope changes sign), \(t(x^2+x+1)\) (all-real solutions exactly at t=0 for equality), and \(tx^2+1\) (quadratic changes to a positive constant).

## Reproduction and evidence

\`\`\`sh
python -m pip install 'sympy==1.14.0' 'mpmath==1.3.0'
python -m unittest scripts/research/test_verify_parameter_quadratic_inequalities.py -v
python scripts/research/verify_parameter_quadratic_inequalities.py \
  --fixture fixtures/research/parameter-affine-quadratic-inequalities-v0.1.json
\`\`\`

Research contract: **65** expected results (**38 complete, 15 wrong, 12 abstentions**), covering six comparison operators, coefficient degeneration, interval endpoint strictness, irrational parameter boundaries, open/closed rays, missing parameter regions and duplicated regions. Further checks:

- 48 deterministically seeded arbitrary affine-coefficient families, comparing the exact full x-solution set against the original-inequality solver at every coefficient/discriminant critical point and adjacent sign-invariant cell.
- Complement relations for \(P=0\) vs \(P\ne0\), \(P<0\) vs \(P\ge0\), and \(P>0\) vs \(P\le0\), requiring **disjointness and total coverage** of the x-axis.
- Exact invariance under nonzero polynomial coefficient scaling, with correct reversal of strict/weak comparison when the multiplier is negative.
- Every wrong source answer produces an exact t witness; a deliberately corrupted independent solver **abstains**.
- Malicious textual coefficient strings, missing/invalid fields, unreasonable coefficients, false parameters and unknown solution templates **do not execute** and cannot produce PASS.

The standalone GitHub workflow runs pinned Python/SymPy versions. All cases are mathematical research controls and are **not** described as newly authenticated high-school or postgraduate examination questions.

## Completion boundary

**Resolved inside the bounded scope:** complete real x-solution sets for all real t in quadratic polynomial comparisons with rational affine parameter coefficients, including all parameter transitions, root ordering, open/closed endpoints, strict/non-strict comparison, and linear/constant degeneration. The verifier checks entire parameter partitions using exact methods, not just convenient values.

**Not resolved:** arbitrary higher-degree and multivariate parameter inequalities, nonlinear coefficients in t, rational expressions with denominator poles, arbitrary equivalent typed real-set formulas rather than the fixed templates, free-form written proofs, automatic OCR/math extraction from exam sheets, and independent authentication of published answer keys. This work is an isolated **stacked Draft** based on PR #326; it changes neither canonical Judge behavior nor production TutorBench scoring.
