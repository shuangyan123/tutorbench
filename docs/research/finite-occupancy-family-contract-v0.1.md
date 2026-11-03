# One complete mathematical task family: finite uniform occupancy

**Completion target:** an entire explicitly bounded numerical problem family, not a cherry-picked exam item. **Research-only; not authenticated official examination gold and not a natural-language/math proof grader.**

## Semantics and exact scope

Let \(n\) distinct labeled outcomes be uniformly likely. Perform \(d\) **independent draws with replacement**. Let \(X\) be the number of **different labels** that occur. The verifier accepts explicit typed input:

- \(1\le n\le64\), \(0\le d\le128\), all integers; independence, uniformity and replacement must each be explicitly asserted **as booleans**.
- One of five numeric questions: \(\mathbb E[X]\), \(\operatorname{Var}(X)\), \(P(X=k)\), \(P(X\ge k)\), \(P(X\le k)\), with integer \(0\le k\le n+1\) for event questions.
- Exact candidate numerical answers written as bounded rational fractions or finite decimal strings; an inexact nearby decimal is **not** silently accepted through tolerance.
- Three output classes: \`verified_correct_under_typed_model\`, \`verified_incorrect_under_typed_model\`, \`unverified\` (invalid model, unknown question/format, nonexistent answer). The last is not equivalent to mathematical falsehood.

All results are in exact integers and \`Fraction\`; the implementation never uses \`eval\`, string-to-SymPy parsing, floating point approximate comparison, an LLM Judge or a mandatory human reviewer.

## Proof for the complete distribution, not just the mean

For \(0\le k\le\min(n,d)\), the number of ordered samples with exactly \(k\) distinct labels is

\[
N_k = (n)_k S(d,k)
    = \binom n k\sum_{j=0}^{k}(-1)^j\binom k j(k-j)^d,
\qquad P(X=k)=\frac{N_k}{n^d}.
\]

Here \((n)_k\) is the falling factorial and \(S(d,k)\) a Stirling number of the second kind. The implementation **independently recomputes the entire count vector** by:

1. **Surjection/Stirling recurrence:** \(S(d,k)=kS(d-1,k)+S(d-1,k-1)\).
2. **State-transition dynamic programming:** extend each \(d\)-draw sample with an already-seen label in \(k\) ways, or a new label in \(n-k\) ways.
3. **Inclusion–exclusion:** for each chosen \(k\)-label subset count onto maps by alternating sums.
4. For \(n^d\le30{,}000\), **enumerate every ordered sample tuple**, independently counting \(|\mathrm{set}(\mathrm{sequence})|\).

Three algebraic algorithms must agree on every count, and all counts must be nonnegative and sum to exactly \(n^d\); the fourth enumerator must also agree whenever the input is within its cost limit.

A separate indicator-variable identity checks the mean:

\[
\mathbb E[X]=n\left[1-\left(\frac{n-1}{n}\right)^d\right].
\]

The variance is independently cross-checked from the distribution and from individual-indicator covariance:

\[
q=\left(\frac{n-1}{n}\right)^d,\qquad
r=\left(\frac{n-2}{n}\right)^d;
\quad
\operatorname{Var}(X)=nq(1-q)+n(n-1)(r-q^2).
\]

When \(n=1\), the implementation uses the direct Bernoulli variance \(q(1-q)\), avoiding a meaningless negative-base auxiliary probability. Both \(d=0\) and one-label boundaries are explicitly tested. Exact and tail-event probabilities are obtained by summing the complete, independently verified distribution.

This forms a **complete numerical answer decision** for any supported input, not a heuristic confidence score. Unsupported assumptions/claims **abstain**, and any disagreement among independent implementations **fails execution**.

## Real exam anchor (2025 new Gaokao I Q14)

Previous PR #321 independently read the third-party exam PDF text and current published answer claims, and checked its typed interpretation \(n=5,d=3\). The new family verifier must agree with that unchanged source-anchored case; it never changes the underlying exam text or answer label.

For this original mathematical problem the **complete distribution** is

| \(X\) distinct labels | 1 | 2 | 3 |
| --- | ---: | ---: | ---: |
| Number of equally likely ordered samples | 5 | 60 | 60 |
| Probability | \(1/25\) | \(12/25\) | \(12/25\) |

The exact expectation is \(61/25=2.44\), and variance \(204/625=0.3264\). For instance \(P(X\ge2)=24/25\), \(P(X\le2)=13/25\). **Only the expectation is linked to the original Q14 examination demand**; the other metrics are mathematical checks on the same formal model and are **not invented exam question subparts**.

The original source is a third-party collection and a recollection; neither author independence nor the original exam authority is authenticated here. That historical-source restriction does not prevent complete exact mathematics under the frozen assumptions.

## Reproducible acceptance tests

\`\`\`sh
python3 -m unittest scripts/research/test_verify_finite_occupancy_family.py -v
python3 scripts/research/verify_finite_occupancy_family.py \
  --fixture fixtures/research/finite-occupancy-family-v0.1.json
\`\`\`

- Forty-one accepted/incorrect/unsupported answer-control cases, with multiple questions per real-paper-linked \(n=5,d=3\) mathematical model.
- One hundred small \(n,d\) model pairs checking all independent count identities.
- More than 3,000 probability mass/CDF-tail complement assertions across 250 small models.
- Boundary tests including \(n=64,d=128\), empty sample \(d=0\), and one labeled outcome \(n=1\).
- Corruption injection: if any one counting implementation returns a wrong distribution, the verifier raises instead of silently choosing the majority.
- Adversarial candidate strings, an apparently correct result under altered sampling assumptions, duplicate cases, missing threshold, and bad response formats.

The isolated GitHub workflow executes all controls using only the Python standard library. No third-party PDF/PNG/text is republished and no historical human review, pedagogical score, production Judge, or canonical reference is modified.

## Completion and remaining boundaries

**Resolved:** independently cross-validated exact numeric answer verification for the entire bounded uniform, independent, with-replacement occupancy family (distribution, expectation, variance and threshold events), assuming the typed model matches the original question. This is a reusable mathematical engine, not a finite list of hard-coded Q14 answers.

**Not resolved:** natural-language conversion and mathematical question interpretation, drawing without replacement, unequal selection probabilities, nonindependent trials, nonnumeric proofs, unrestricted probability problems, original official-paper authenticity, or editorial independence of published answer keys. Any of these require their own bounded contracts and cannot inherit a PASS from this family.

This PR is deliberately stacked on #321 (itself based on #317 and #316). Keep as Draft pending passing CI and research code review; do not merge out of dependency order.
