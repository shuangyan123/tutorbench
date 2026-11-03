# Complete real-root classification for a parameter-dependent quadratic family

**Research contract v0.1; mathematical scope only. No official exam-paper answer certification, handwritten proof checking, OCR/NLP, or human reviewer.**

## The mathematical capability

For every real value of the parameter t, check the **entire real solution set in x** of

\[
A(t)x^2+B(t)x+C(t)=0,\qquad t\in\mathbb R,
\]
\[
A(t)=a_0+a_1t,\quad B(t)=b_0+b_1t,\quad C(t)=c_0+c_1t,
\]
where all six coefficients are exact rationals, with positive denominators and coefficient magnitudes bounded by 1,000,000.

Candidate answers are an explicitly typed *finite parameter partition*, with at most 32 open/closed intervals or singleton points and one **complete root formula template** for each section. Accepted templates mean:

| Template | Exact root set of x at this t |
| --- | --- |
| \`all_reals\` | Every real x |
| \`empty\` | No real x |
| \`linear\` | \(\{-C(t)/B(t)\}\), with A=0, B≠0 |
| \`double\` | \(\{-B(t)/(2A(t))\}\), with A≠0, Δ=0 |
| \`quadratic_pair\` | \(\{[-B(t)-\sqrt{\Delta(t)}]/[2A(t)],[-B(t)+\sqrt{\Delta(t)}]/[2A(t)]\}\), with A≠0, Δ>0 |

Here Δ(t) = B(t)² − 4A(t)C(t). Each template **expands into the actual formula**; the verifier checks more than root count. The fixed template contract is deliberately more restricted than verifying arbitrary equivalent human-written algebraic expressions.

The verifier accepts alternate valid parameter partitions, but they must be **complete and pairwise disjoint across the entire real t axis**. A missed singleton, overlapping endpoint, wrong strictness, or wrong solution rule must produce an exact counterexample parameter.

## Why finite critical-point checking covers every real parameter

For rational affine A, B, C, the discriminant Δ is a rational polynomial of degree at most two. The only parameter values at which the required solution **kind** can change are real zeros of A, B, C or Δ; candidate interval endpoints are additional boundaries whose inclusion must also be validated.

1. Enumerate **all exact real roots** of A, B, C and Δ, including quadratic surds; add all candidate partition boundaries.
2. The resulting finite critical points divide the **whole real parameter axis** into singleton points and open intervals. The zero/nonzero status of A, B, C and the sign of Δ are constant on each open cell. Therefore the root-kind template cannot change inside that cell.
3. Test each critical point and one **exact rational interior witness** for each open cell. A dyadic rational interior sample avoids approximate floats and unnecessary nested surds; if a safe rational sample cannot be certified under the bound, abstain.
4. Derive the complete exact x-root set at each sampled parameter algebraically, including A=0 → linear/constant degeneration; independently call SymPy \`solveset\` on the **original parameter-substituted polynomial**, and require the exact sets to agree.
5. Verify **exactly one** candidate branch covers each sampled parameter. Compare its solution template to the derived type. Any mismatch gives a parameter witness; any independent solver conflict returns \`unverified\`, never majority voting.

Because the endpoints of all type-changing polynomial zeros and all candidate parameter sections are included, this procedure validates the complete family for all real t **within this fixed algebraic contract**; it is **not** statistical sampling of t.

Both math paths use SymPy infrastructure and are not independent formally verified kernels. The statement “verified” is scoped to this deterministic typed coefficient and formula-template model. If the question has arbitrary parameter-dependent nonlinear coefficients or demands proof steps, do not reuse the PASS.

## Concrete degeneration traps

For \(tx^2+x+1=0\):

- \(t<0\): two distinct real roots, the quadratic formula applies;
- \(t=0\): **one linear root** \(x=-1\), not the quadratic formula;
- \(0<t<1/4\): two distinct real roots;
- \(t=1/4\): exactly **one double root** \(x=-2\);
- \(t>1/4\): no real roots.

A purported answer that treats \(t=0\) as quadratic, misses \(t=1/4\), or calls the double root two distinct real roots is rejected with an exact parameter witness.

For \(t(x^2+x+1)=0\): there are **no real roots for t≠0**, but **every real x is a solution at t=0**. This catches the special case in which all coefficients vanish simultaneously.

For \(x^2+tx+1/2=0\), the real-root count changes exactly at \(t=\pm\sqrt2\). The mechanism supports algebraic irrational parameter boundaries without decimal tolerance.

A different valid partition for an equation whose unique linear root persists for all t is accepted, including arbitrary subdividing at rational parameter values. Thus the verifier checks semantic correctness, not that an answer has the same presentation as a hard-coded expected segmentation.

## Reproduction and coverage

\`\`\`sh
python -m pip install 'sympy==1.14.0' 'mpmath==1.3.0'
python -m unittest scripts/research/test_verify_parameter_quadratics.py -v
python scripts/research/verify_parameter_quadratics.py \
  --fixture fixtures/research/parameter-affine-quadratic-real-roots-v0.1.json
\`\`\`

- 54 independently specified research cases: **26 complete** classifications, **15 false** classifications with exact parameter witnesses, and **13 malformed/out-of-scope** cases requiring abstention.
- 64 deterministically seeded independent coefficient-family models; each generated family's critical parameters and the interiors between them are recalculated by both the root-kind logic and SymPy's real equation solver.
- 180 exact property checks confirming that multiplying the entire equation by any nonzero constant (positive or negative) cannot change the root set classification.
- Mutation and fault-injection checks for missing singletons, overlapping partitions, irrational critical endpoints, improperly promoted linear/quadratic cases, altered solver results, hostile strings and invalid coefficients.
- A strict CLI mode returns a nonzero exit code if *any* case is unverified.

All tests use exact rational and algebraic operations. Output \`officialExamGoldCertified=false\` and \`officialExamGoldReleased=0\` are intentionally fixed; these **synthetic mathematical cases do not count as source-verified exam papers**. No changes to production TutorBench Judge, historical reviews, student data or scored canonical evaluations.

## Explicit limits

Resolved: **all-real-parameter complete solution classifications** for univariate real x equations of degree at most two, with rational affine-in-parameter coefficients and canonical formula-template answers, including coefficient degeneracy, positive/zero/negative discriminant, algebraic parameter boundary and partition coverage.

Not resolved: general parameterized inequalities, coefficients nonlinear in t, arbitrary rational-function coefficients, higher-degree equations, systems, trigonometric/logarithmic functions, automatic natural-language answer extraction, arbitrary equivalent student-provided root formulas or proof steps. Each must have a new mathematical contract and independent tests.

This is stacked Draft research work based on #324 and does not merge before its parent dependency chain.
