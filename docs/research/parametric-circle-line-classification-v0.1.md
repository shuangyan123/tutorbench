# Parameterized circle–line intersection-count partitions (research v0.1)

## Scope: a complete, bounded family, not an arbitrary exam solver

For exact rational coefficients, consider the fixed real circle and moving line

\[
(x-h)^2+(y-k)^2=R,\qquad ax+by+c_0+c_1t=0,
\]

with \(R\ge0\), \(a^2+b^2>0\), and real parameter \(t\). The bounded typed problem asks for the **complete set of all real \(t\)** for which the two curves have **exactly 0, 1, or 2 distinct real intersection points**. All input coefficients are exact rational text subject to the same ≤1,000,000 component bound and 64-character limit as the earlier circle–line point solver. The parameter coefficient \(c_1=0\) and point circles \(R=0\) are explicitly supported.

A typed input example, requesting the set with exactly two intersections:

\`\`\`json
{
  "kind": "parametric_circle_line_intersection_count",
  "circle": {"centerX":"0","centerY":"0","radiusSquared":"1"},
  "line": {"a":"1","b":"0","baseC":"0","parameterC":"1"},
  "query": {"intersectionCount":2}
}
\`\`\`

The exact answer is the **open** interval \((-1,1)\); at \(t=\pm1\) the line is tangent and has only one intersection. This boundary distinction is part of the mathematical correctness contract. For the same model the one-intersection set is \(\{-1,1\}\), and the zero-intersection set is \((-\infty,-1)\cup(1,\infty)\).

## Two independently implemented parameter-set derivations

The primary path applies the circle-to-line distance formula. Define

\[
Q=a^2+b^2>0,\qquad
D(t)=RQ-(ah+bk+c_0+c_1t)^2.
\]

The intersection count is 0 when \(D(t)<0\), 1 when \(D(t)=0\), and 2 when \(D(t)>0\). For \(c_1\ne0\) and \(R>0\), the two tangent boundaries are

\[
t_\pm=-\frac{ah+bk+c_0}{c_1}\pm\frac{\sqrt{RQ}}{|c_1|}.
\]

The analytic path produces exact unions of open intervals and singleton tangency sets without floating-point approximation. It treats zero radius and constant lines separately rather than dropping repeated roots or dividing by zero.

The independent check expands \(D(t)\) into a quadratic polynomial over \(\mathbb Q\), then passes its signs through TutorBench's existing **exact polynomial sign-cell partitioner**. It does not call the analytic interval formula. The full two real sets are compared by exact endpoints and cell witnesses. A disagreement causes **unverified**, never a success verdict. Both implementations use SymPy exact rational/radical arithmetic; they are implementation-diverse checks, **not independently machine-checked formal proofs**.

Candidate parameter sets use the already bounded \`quadratic_real_solution_set\` representation: \`empty\`, \`all_real\`, or \`union\` with exact intervals and singleton points, including rational and restricted surd endpoints. A correct mathematical set in the supported representation is accepted; a well-typed but wrong boundary, missing tangent or unsupported set is either exactly refuted with a witness or explicitly unverified. Literal prose is never parsed as an exact set answer.

## Dual-path evidence and reproduction

The family is integrated into the existing dual-path mathematics research bridge. A supplied existing-answer candidate is compared **after** deriving the independent set, and an answerless question can be solved without a reference. Canonical-JSON-only offline replay is allowed strictly as a research fixture, not as an authenticated model run.

The frozen fixture comprises **26 synthetic typed cases**: 12 independent answerless solutions, 3 right and 3 wrong existing references, 2 right and 1 wrong offline replay, and 5 intentionally unverified malformed or forged cases. Tests include 144 cross-product parameter families with 1,008 explicit rational-\(t\) classifications, 96 seeded rational problems, exact \(\sqrt2\) tangent boundaries, complete pairwise partitions of \(\mathbb R\), corrupted independent solvers, disallowed source links and answer extraction contamination.

\`\`\`powershell
python -m pip install sympy==1.14.0 mpmath==1.3.0
python -m unittest scripts/research/test_verify_parametric_circle_line_classification.py scripts/research/test_verify_dual_path_math_answers.py -v
python scripts/research/verify_dual_path_math_answers.py --fixture fixtures/research/parametric-circle-line-classification-v0.1.json --sources fixtures/research/exam-multi-source-evidence-v0.1.json
\`\`\`

This proves mathematical correctness only **conditional on exact typed inputs**. It does not authenticate any 2022–2026 Gaokao or Kaoyan paper, judge natural-language solutions, handle arbitrary conics, or measure an actual AI model's accuracy. No user credentials, Judge API, paid model calls or human review are involved.
