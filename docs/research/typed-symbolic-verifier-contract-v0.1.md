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
