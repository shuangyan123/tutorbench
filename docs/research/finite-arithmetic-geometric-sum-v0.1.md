# Bounded exact arithmetic–geometric sequence sums (research v0.1)

## Scope and meaning of a correct answer

For exact rational parameters `a`, `d`, `r` and integer `0 ≤ n ≤ 128`, the typed mathematical problem is:

\[
S_n=\sum_{k=0}^{n-1}(a+kd)r^k.
\]

This family covers finite **arithmetic sequences** (`r=1`), **geometric sequences** (`d=0`), mixed arithmetic–geometric sequences, alternating sums (`r<0`), zero ratios and the zero-term sum. It does **not** claim infinite-series convergence, an arbitrary recurrence, natural-language math parsing, a step/proof grader or a verified published exam question.

The exact JSON contract is:

```json
{
  "kind": "finite_arithmetic_geometric_sum",
  "model": {
    "firstTerm": "3/2",
    "commonDifference": "1/2",
    "commonRatio": "1/2",
    "termCount": 4
  },
  "query": {"metric": "sum"}
}
```

Only these fields and the fixed `sum` metric are permitted. The coefficients must be bounded, finite rational/decimal strings, no floats or scientific notation; unreduced numerator and denominator components must each be at most one million. The term count must be a non-boolean integer between 0 and 128 inclusive. Full candidate output must be a single exact integer, rational or finite decimal; unparseable prose is **unverified**, never treated as wrong.

## Two independent exact implementations

The first path accumulates `(a+kd) r^k` using exact `fractions.Fraction` and independently maintained term and power recurrences.

The second path is a distinct closed-form computation. For `r ≠ 1`:

\[
S_n
=a\frac{1-r^n}{1-r}
+d\frac{r-nr^n+(n-1)r^{n+1}}{(1-r)^2}.
\]

For `r=1` the expression is `na + dn(n-1)/2`; for `n=0` it is zero. The algebraic and iterative results must **agree exactly**; any disagreement causes an `unverified` result. Neither formula reads a published answer or model candidate. An adversarial test corrupts each of the two algorithms separately and checks that the bridge abstains rather than issuing a false positive.

The typed mathematics is then reused by the independent, existing **dual-path** adjudicator: `existing_answer` mathematically verifies or refutes a published **candidate**, and `no_answer` independently derives the result or compares an explicitly tagged offline replay. Neither path elevates a weakly sourced candidate to official exam gold. An illegitimate attempt to attach the real Gaokao Q14 source to this new kind is explicitly refused.

## Reproduction and measured coverage

```powershell
python -m pip install sympy==1.14.0 mpmath==1.3.0
python -m unittest scripts/research/test_verify_finite_arithmetic_geometric_sum.py scripts/research/test_verify_dual_path_math_answers.py -v
python scripts/research/verify_dual_path_math_answers.py --fixture fixtures/research/finite-arithmetic-geometric-sum-v0.1.json --sources fixtures/research/exam-multi-source-evidence-v0.1.json
```

The fixture has 13 **synthetic, explicitly typed** cases: zero terms, `r=0`, `r=1`, `r=-1`, fractional ratio, correct/wrong answer candidates, correct/wrong/near-miss offline replays, and rejected invalid or falsely attributed problems. The test suite separately covers 648 cross-product parameter models, 250 seeded rational problems (including `n=128`), malformed input, candidate contamination, arbitrary error payloads and a fault-injected oracle disagreement. All computations are deterministic and use **zero** provider/LLM calls and **zero** human review.

The verified mathematical statement remains conditional on a **faithful typed translation** of the original question. Source authenticity and question formalization must be established separately before publishing any exam-paper accuracy claim. A 13-case research fixture is not a representative benchmark for general Gaokao/Kaoyan performance.
