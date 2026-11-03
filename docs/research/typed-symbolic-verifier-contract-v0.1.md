# Typed symbolic result comparison — research contract 0.1

**Status:** research-only; intentionally *not* a full mathematics answer verifier, production Judge component, or verified exam answer key.

## Why a distinct contract

The existing 12-item reference pilot and first real-paper examples use per-task parsers. That does not scale to hundreds of authentic exam questions and can falsely accept omissions, repeated roots, incorrect domains, or unsupported paraphrases. This prototype provides a **reusable but deliberately bounded** symbolic expression comparison stage. It does not attempt to infer mathematical claims from exam scans or natural-language explanations.

## Input and output

Use the local Python CLI with a JSON fixture:

```sh
python3 -m venv .venv-math
.venv-math/bin/pip install 'sympy==1.14.0' 'mpmath==1.3.0'
.venv-math/bin/python scripts/research/verify-typed-symbolic-claims.py --fixture fixtures/research/typed-symbolic-claim-contract-v0.1.json
```

On Windows use the Python interpreter under `.venv-math/Scripts/`, or an existing isolated environment.

**Accepted expression-tree operators:** `int`, `rat` (exact numerator/denominator), `symbol` (`x` only), `const` (`pi`), `add` and `mul` (2–8 arguments), integer `pow` (-8 to +8), `sqrt`, `sin`, `cos`, `log`, and `exp`. Integer magnitude is at most one million; tree budget at most 64 nodes and depth at most ten. No arbitrary string parsing, `eval`, arbitrary Python objects, floating point tolerance, complex-valued claims, free text, partial credit, multivariate mathematics, or proof judgement.

Possible statuses:

- `symbolically_equal`: SymPy simplifies the difference to zero **and** both unevaluated expressions have provably matching real domains.
- `counterexample_found`: a nonzero exact constant difference or exact in-domain rational witness refutes equivalence.
- `unverified`: domain disagreement, unsupported AST/operator, unknown equivalence, inability to generate a rigorous counterexample, or mathematically outside the contract. This is neither PASS nor FAIL.

The first status reports **symbolic consistency under a trusted structured representation**, **not** formally kernel-checked proof that a learner answered an authenticated exam question correctly. The results cannot certify that the original problem was parsed accurately, that a complete set of roots was given, that a proof is rigorous, or that tutoring respected hint-only constraints. SymPy itself is substantial software, not a small formal proof-checking kernel.

## Deliberately adversarial examples

- Exact rational equality: `1/2+1/3` equals `5/6`, not `2/5`.
- Trigonometric/logarithmic identities work only when the domain assumptions are supported.
- `sqrt(x^2)` **does not** equal `x` on all real inputs; witness `x=-3`.
- `x/x` must **not** be accepted as equivalent to `1` over all reals merely because SymPy simplifies the difference to zero. The unevaluated-domain check abstains due to the missing point `x=0`.
- `exp(log(x))` must likewise not be accepted as a total real identity with `x` without an explicit domain restriction.
- Even two identical expressions with **empty real domains** must remain unverified; vacuous identity is not answer evidence.
- Unrecognized tokens, decimals, complex constants and zero denominators abstain. Arbitrary user strings are never handed to `sympify`, Python evaluation or a shell.

## Validation and boundary to TutorBench

The Python test suite (12 synthetic fixture cases, plus hostile-input and CLI checks) is run in the **separate** path-filtered GitHub research workflow. Default Node tests and production evaluation do not depend on SymPy or this tool. No reference outputs are connected to canonical TutorBench, student outcomes, Judge ratings or human reviewer labels.

Before expanding this API to real model responses, an expert must separately review input provenance, source problem semantics, function domains, parsing ambiguity, completeness of solution sets, symbolic library reliability, timeout/resource limits and independent reference derivations. This is a necessary building block, not evidence of 100% automatic mathematics coverage.


## Complete real solution-set checks (bounded research extension)

The separate `scripts/research/verify-complete-rational-roots.py` evaluates **complete sets of real solutions** for trusted, structured rational-coefficient polynomials of degree at most two. It uses `fractions.Fraction` and `math.isqrt`, with exact rational arithmetic and no numerical approximation. Its claim input must provide `claimKind: "all_real_roots"`, coefficients `a,b,c` (quadratic/linear/constant), an explicit `real` or rational-bounded `interval` domain, and a candidate list of rational roots. It neither parses an exam problem nor infers the intended domain.

```sh
python scripts/research/verify-complete-rational-roots.py --fixture fixtures/research/bounded-rational-roots-contract-v0.1.json
python -m unittest scripts/research/test_complete_rational_roots.py -v
```

The verifier makes the **completeness** assertion explicit: all valid in-domain roots must be present; invalid/extraneous roots must be absent. Outputs are `verified_complete_solution_set`, `refuted_solution_set`, or `unverified`. `unverified` includes irrational roots (not currently representable by the finite rational list), polynomial identities with infinitely many solutions, malformed coefficients, missing domain, and unsupported bounds. A contradiction is not inferred merely from inability to solve. Duplicate entries are normalized as a **set**; `[2,2]` does **not** pass for the distinct required set `{2,3}`, but a polynomial with one double root at 2 legitimately has the set `{2}` (with a duplicate-entry diagnostic). This concerns solution sets, not root multiplicities.

The structured [2025 Math I Q16] *intermediate* assertion is included as a direct real-paper-linked example, not an official answer key: independently translating `P(A)=2P(B)` and `P(A∪B)=5/8` under independence gives, for `p=P(B)`,

```text
2p² - 3p + 5/8 = 0,    0 ≤ p ≤ 1/2
```

The algebraic roots are `1/4` and `5/4`, but only `1/4` meets the probability constraint. The fixture rejects the extra root and checks the unique admissible root **without claiming this is the final answer to Q16**. The actual requested conditional probability `4/5` is a further distinct step and must be checked separately; this module does not grade that complete problem or the quality of a written solution.

The example is manually formalized from a university-hosted third-party copy and is **not authenticated official gold**; no PDF images or exam paper prose are bundled. This extension is exercised by an isolated research CI workflow and does not affect production, synthetic canonical scoring, human reviewer labels, or the rest of TutorBench. Mathematical trust extends only to the correctly supplied formal statement and the program's tested exact arithmetic. It does not establish 100% accuracy for all exam questions.
