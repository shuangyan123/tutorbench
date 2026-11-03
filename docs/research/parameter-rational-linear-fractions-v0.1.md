# Exact complete parameter-dependent rational inequalities: original poles are never cancelled

**Research contract v0.1, not canonical TutorBench scoring or official examination answer gold.** This closes a bounded mathematical capability, not an OCR, natural-language parser, proof grader, or authenticity claim about third-party past examinations.

## Mathematical scope

For **every real parameter t**, verify the complete real x-solution sets of

\[
\frac{A(t)x+B(t)}{C(t)x+D(t)}\;\square\;0,\qquad
\square\in\{=,\ne,<,\le,>,\ge\},
\]

where **each** of A, B, C and D is an affine-in-t rational coefficient, with bounded numerator/denominator and no arbitrary expressions. The original denominator condition \(C(t)x+D(t)\ne0\) is part of the problem and **must remain in effect even when both polynomials share a factor or the quotient simplifies**.

The candidate is a typed partition of the entire real t-axis into ≤32 open intervals and points, with a complete real x-solution set on each branch. X-set pieces are finite unions of intervals/points whose endpoints may be rational or quadratic surd constants, the original **numerator root** \(-B(t)/A(t)\) where A(t)≠0, the original **denominator pole** \(-D(t)/C(t)\) where C(t)≠0, and ±∞. Strict/weak endpoint inclusion is explicit. A meaningless root token at a parameter where its slope vanishes is refuted rather than assigned a fabricated value.

If the entire original denominator is identically zero for a particular parameter, the fraction has **no real domain** and the real solution set for any comparison is **empty**. That is an intentionally specified semantic decision. If the numerator is identically zero but the denominator is not, equality, nonpositive and nonnegative comparisons are true **only on the actual denominator domain**, not on all reals. Empty and nonempty solution sets are represented exactly.

## Why every real parameter is accounted for

A parameter value changes the mathematical topology of these affine-over-affine x-sign sets when one of A,B,C,D vanishes, or the two x-roots coincide. However, when a candidate x solution mentions a **fixed rational or surd endpoint e**, agreement between that endpoint and a moving numerator root or pole can also occur at an isolated parameter. These additional exact crossing parameters **must** be enumerated, or one lucky parameter sample can falsely certify a globally incorrect answer.

The root-pole collision is exactly

\[
A(t)D(t)-B(t)C(t)=0.
\]

Because all coefficients are affine rational in t, the **resultant determinant** above is a polynomial of degree at most two. The verifier computes all exact real zeros of A, B, C, D and this determinant, *plus every candidate partition boundary*. It also extracts every fixed x-endpoint e from the candidate and solves **A(t)e+B(t)=0** and **C(t)e+D(t)=0** exactly for t; these roots are mandatory additional critical parameters. The input is bounded to at most 64 distinct fixed endpoints to avoid an unchecked algebraic complexity explosion. These points cut the full real t-axis into exact singleton points and open parameter cells. On an open cell all coefficients' zero/nonzero statuses, x-root/pole ordering, signs at x-infinity **and relative ordering to each fixed candidate x-endpoint** are invariant. Therefore one certified exact interior representative of each cell and every critical point suffice to verify the **entire parameter axis**, not a finite statistical sample.

At each parameter representative the verifier:

1. Constructs the **original**, uncancelled numerator and denominator with exact coefficients.
2. Computes the complete sign chart by separating all real numerator zeros and **all denominator poles**; excludes every denominator zero, including a common zero.
3. Independently uses the strictly positive multiplier \(D(t,x)^2>0\) on the original domain: \(N/D\;\square\;0\) is equivalent to \(N D\;\square\;0\), **only where \(D\ne0\)**. The second calculation uses SymPy's polynomial inequality solver, or \(N=0\) for equality, and again removes **every original denominator zero**. This avoids a documented symbolic sorting failure for unsimplified equivalent algebraic roots at irrational parameter thresholds.
4. Compares the entire sets from the two different symbolic paths using all exact algebraic endpoints and at least one exact interior witness per interval.
5. Expands the proposed branch's typed x-interval endpoints at that t and compares **its entire set**, including pole omissions and strict/weak endpoints. A mismatch reports the **parameter witness t and x witness** where defined; uncovered or double-covered t points get an explicit partition error.

The two paths (uncancelled rational sign chart vs a separately derived denominator-square polynomial inequality reduction) share SymPy arithmetic and thus are **differential checking, not independent formal-proof kernels**. If the independent solver cannot resolve an input or disagrees with the sign chart, the checker returns **unverified**, never majority votes. This remains **research-only** until source truth and production integration are separately assessed.

## Parameter-cancellation and domain-degeneration examples

For

\[
\frac{x-t}{x-1}>0
\]

the full classification is:

| Real t | Exact x solution |
| --- | --- |
| t<1 | \((-\infty,t)\cup(1,\infty)\) |
| t=1 | \(\mathbb R\setminus\{1\}\) |
| t>1 | \((-\infty,1)\cup(t,\infty)\) |

At t=1, numerator and denominator are equal; **the removed x=1 pole does not return**. For weak comparisons the numerator zero is included unless it is also a denominator zero.

For

\[
\frac{x-1}{t(x-1)}>0,
\]

- t<0: empty set;
- t=0: the denominator is identically zero, hence empty set by the declared original-domain semantics;
- t>0: **all real x except 1**.

For \(\frac{tx+1}{x-1}>0\), the numerator zero disappears at t=0 and collides with the denominator pole at t=-1. The verifier separates t<-1, t=-1, -1<t<0, t=0 and t>0; a candidate using a numerator-root formula at t=0 or treating the t=-1 cancelled point as valid is rejected.

For \(\frac{0}{tx-1}=0\), the equality is true on all real x when t=0 (denominator is a nonzero constant), while for t≠0 it excludes x=1/t. This independently tests that holes cannot be deleted just because the numerator is identically zero.


**False-PASS regression:** for \((x-t)/1>0\), the correct x-set is \((t,\infty)\). A submitted branch claiming \(x>1\) for *every* t>0 would match the initial interior representative t=1 while being false elsewhere. The checker now adds **t=1** to the critical set because the moving numerator root x=t collides with the candidate's fixed endpoint x=1, and rejects the branch using an exact t,x counterexample. A fixed surd endpoint representing the same algebraic value is handled equivalently. Conversely, genuinely constant x endpoints, such as those of \((x-1)/(x-2)>0\), remain supported and accepted. This fixes an actual global-proof vulnerability that ordinary random testing could miss.

## Reproduction, no-gold boundary and acceptance

\`\`\`sh
python -m pip install 'sympy==1.14.0' 'mpmath==1.3.0'
python -m unittest scripts/research/test_verify_parameter_rational_inequalities.py -v
python scripts/research/verify_parameter_rational_inequalities.py \
  --fixture fixtures/research/parameter-rational-linear-fractions-v0.1.json
\`\`\`

The 84 recorded mathematical claims consist of **52 correct complete parameter families, 20 demonstrably wrong cases and 12 deliberately unsupported/malformed controls**. Additional tests include:

- Six independent comparison operators for denominator cancellation, numerator-zero and denominator-zero cases; **all false cases must carry an exact parameter witness**.
- 32 seeded random affine-in-t numerator/denominator coefficient families, independently checked by polynomial inequality reduction at every real coefficient/resultant root and every open parameter cell. Algebraic parameter endpoints that expose duplicate-root ordering failures in direct rational solvers are regression targets.
- Pointwise original-fraction sign checks, even when denominator is zero.
- Positive/negative common rescaling of numerator and denominator, which cannot change the rational function or original zero domain.
- Complementary relations \`eq/ne\`, \`lt/ge\`, \`gt/le\`, which must partition the **original defined x-domain** and never include excluded poles.
- Adversarial input strings, invalid source schemas, incorrect parameter partitions, original-pole pollution, injected wrong independent solver output and strict CLI failure for unverified results.

The standalone path-limited GitHub research workflow re-runs this suite under pinned SymPy 1.14 / mpmath 1.3, without paid math API, model calls or human review. Outputs always include \`officialExamGoldCertified: false\` and batch \`officialExamGoldReleased: 0\`; the synthetic cases cannot be counted as validated genuine examination questions.

## Precisely closed and open questions

**Closed within scope:** complete real x-solution-set validation for all real t in bounded rational-linear-over-rational-linear comparisons, including numerator roots, original denominator zeros, their collision, slope degeneration, negative denominator signs, and parameter partition completeness.

**Not closed:** higher-degree rational x-expressions or t-polynomials, arbitrary nested radicals/logarithms/trigonometric expressions, inequalities involving several variables, proof steps, arbitrary natural-language answer extraction, OCR source-authenticity, or production-level error rates. Those require separate contracts and evidence.

This research PR is intentionally **stacked on #327**, and should remain Draft until CI passes; no production TutorBench Judge, canonical metrics or historical human-review annotations are changed.
