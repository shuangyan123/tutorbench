# Exact rational transformation semantics: definedness, solution sets and counterexamples

**Research contract v0.1.** This is one complete **bounded mathematical verification capability**, not a universal proof grader, a real-paper gold certification, or automatic understanding of typed/handwritten exam prose. It uses no human reviewer or paid model.

## The problem resolved

Algebraic simplification, equivalent equations and valid *solution-preserving* transformations are three **different mathematical claims**. Cancelling a factor can preserve values wherever originally defined while changing the function's **domain**; multiplying an inequality by a denominator can preserve a strict solution set while changing the expression domain, but may create a **spurious boundary solution** for a weak inequality.

The checker treats these as distinct, inspectable outcomes:

| Check | Exact success meaning |
| --- | --- |
| \`function\` | Both original expressions have the **same full real domain** and the same value at every defined point |
| \`relation\` with \`requireSameDomain=true\` | Both comparisons with zero have identical original real domains **and** identical full truth/solution sets |
| \`relation\` with \`requireSameDomain=false\` | Both comparisons have identical full real solution sets; if domains differ, success is explicitly \`verified_solution_equivalence_domain_changed\`, **never function equivalence** |
| \`chain\` | Every **adjacent** equation/inequality transformation preserves the chosen semantics; first bad transition and exact witness are returned |

Any mismatched domain, value or real truth set yields \`refuted\` plus an exact distinguishing real x witness and a specific reason. A claim outside the formally supported family yields \`unverified\`, **not PASS or FAIL**.

## Supported source representation

An explicit allowlisted, **typed JSON AST**, with exact rational constants, one real variable x, unary negation, addition, multiplication, division and nonnegative powers 0,1,2. No arbitrary source-code execution, unchecked expression-string parsing or float comparison.

The rational expression builder retains every **syntactic nonzero guard** arising from all divisions and nested subexpressions, including guards that would disappear after simplifying a rational expression. For example, \`(x/x)^0\` still requires x≠0 because evaluating the base is required. The intermediate numerator and denominator each must be a rational polynomial of degree ≤2; the exact cross-product **identity comparison** may reach degree 4. Research bounds: 48 total AST nodes per one verification call, depth 9, 8 children per commutative node, 8 steps per chain, 96 cases per batch, rational literal numerator magnitude and positive denominator ≤100,000, plus bit-length limits on polynomial coefficients. Unsupported constructs **abstain**.

No radical, logarithm, trigonometric function, derivative, parameter t, piecewise expression, arbitrary Boolean formula, student free-form written proof, or real-exam OCR input is accepted by this particular contract. Those require additional adapters and independent task-family proof obligations.

## Why the verification is complete **inside this scope**

**Original domain.** For every division \`U/V\`, require the original subexpressions U and V to be defined **and V≠0**. Record the exact zero-set polynomial of V's numerator before any cancellation. All such zero polynomials are strictly checked: an identically zero divisor means the entire expression has empty real domain and **cannot** receive a positive function/relation certificate.

**Function identity.** On the common original domain, each typed expression has an exact unreduced representation \`P(x)/Q(x)\` over the field of rational functions. After proving the original real domains equal, the function values are identically equal if and only if the coefficient vector of \`P1*Q2−P2*Q1\` vanishes exactly. If it does not, the code deterministically constructs and independently evaluates a finite **integer x witness** outside all domain holes and difference roots. Such a point always exists for a nonzero polynomial under the bounded-degree, finite-hole contract; the run **abstains** if a safe witness cannot be established under its execution budget.

**Truth/solution-set identity.** The roots of all original nonzero-domain guards and of both rational numerators/denominators partition the real line into a finite set of exact singleton endpoints and open cells. With no zeros of these polynomials inside an open cell, both definedness and the sign of each rational expression are **constant throughout that cell**. Therefore checking every exact boundary and one exact algebraic interior point of every cell establishes full equivalence of comparison-to-zero solution sets—**not merely random numeric sampling**.

**Cross-checking.** The checker evaluates the original AST recursively at every witness and compares its definedness, exact value and sign with the independently accumulated rational-polynomial representation. It also uses seeded comparisons against SymPy's separate polynomial inequality solver on the original denominator domain. If the two paths disagree or cannot decide exact comparisons, the claim **abstains**. They share SymPy algebraic-number facilities and do **not** amount to formally independent proof kernels.

## Specific mathematical distinctions

| User-submitted transformation | Verified conclusion |
| --- | --- |
| \`x/x → 1\` | **Not the same function:** x=0 is undefined on the left but defined on the right |
| \`(x−1)/(x−1) → 1\` | **Not the same function:** removable singularity at x=1 remains excluded |
| \`0·[1/(x−1)] → 0\` | **Not the same function:** multiplying by zero does not restore an undefined factor |
| \`x/(x−1)>0 → x(x−1)>0\` | **Same solution set**, but the expression domains differ at x=1 |
| \`x/(x−1)≥0 → x(x−1)≥0\` | **Wrong solution set:** the right-hand side incorrectly includes x=1 |
| \`1/(x−1)>0 → x−1>0\` | **Same solution set**, but not domain-preserving as expressions |
| \`x−1=0 → x²−1=0\` | **Wrong equation equivalence:** x=−1 is introduced |
| \`x/(x−1)>0 → x(x−1)>0 → x(x−1)≥0\` | First step preserves the solution set (not the domain); the **second** fails at x=0 |

Some non-domain-preserving steps can legitimately occur in a solution-preserving derivation. The checker does not automatically condemn them as mathematically false: instead, it requires the **requested semantic contract** to be explicit. A TutorBench caller must not map \`verified_solution_equivalence_domain_changed\` to \`verified_domain_and_function_equivalence\`.

## Reproducibility and adversarial coverage

Run from the repository root:

\`\`\`sh
python -m pip install 'sympy==1.14.0' 'mpmath==1.3.0'
python -m unittest scripts/research/test_verify_exact_rational_transformations.py -v
python scripts/research/verify_exact_rational_transformations.py \
  --fixture fixtures/research/exact-rational-transformations-v0.1.json
\`\`\`

The fixture includes **81 fixed expected results**, all explicitly mathematical and **not** official past-exam gold:

| Outcome | Count |
| --- | ---: |
| Verified whole-function/domain equivalence | 16 |
| Verified relation and original domain | 10 |
| Verified only solution-set equivalence, domain changed | 9 |
| Verified every step in a multi-step transformation | 4 |
| Refuted with an exact real x witness | 28 |
| Unverified / unsupported or malformed | 14 |

Additional automated tests check 45 random original-domain-preserving rational rescalings, 40 seeded strict crossmultiplication examples (both \`<\` and \`>\`), 30 seeded weak crossmultiplication counterexamples at original poles, 30 complementary-inequality families, 26 comparisons against SymPy's independent polynomial inequality path, irrational quadratic pole boundaries, tampered AST/polynomial oracles that **force abstention**, hostile input data, batch duplication, and strict CLI nonzero exit status for unverified cases. A separate GitHub workflow reruns every check with pinned exact mathematics dependencies. No historical TutorBench Judge, pedagogical evaluation, human label or canonical exam benchmark is edited.

## Accepted conclusion and remaining gaps

**Closed for this stage:** complete exact original-domain and solution-set semantic equivalence checking, plus identification of the first invalid step in a typed rational transformation chain, **for the bounded degree-2 rational AST family**. This supplies one reusable common foundation for earlier rational-equation and inequality verifiers rather than another question-specific answer rule.

**Not closed:** unrestricted higher-degree rational functions, radicals/logarithms or squaring constraints inside the same AST, parameterized whole-step equivalence, proofs involving implications rather than equivalence, automatically understanding exam prose/images, original official exam-gold authentication, and production TutorBench policy decisions about acceptable step transformations. An in-process hard CPU deadline is also not provided; CI uses bounded inputs and an external execution budget. These need independent engineering, evidence, and acceptance gates.

This change is an **unmerged stacked Draft PR based on #328**, which itself depends on the earlier exact parameter-inequality research chain. CI green is a **research contract pass**, not measured real-paper coverage.
