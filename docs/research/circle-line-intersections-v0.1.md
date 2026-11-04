# Exact circle–line intersection point sets (research v0.1)

This document defines a **bounded, exact, typed analytic-geometry verifier**. It extends TutorBench's isolated dual-path mathematics research; it does not alter the production Judge, certify a past examination paper, parse a Chinese word problem, or measure a live AI model.

## Supported question, assumptions and bounds

Given a circle and a line over the real plane:

\[
(x-h)^2+(y-k)^2=R,\qquad ax+by+c=0
\]

where \(h,k,R,a,b,c\) are exact rational numbers, \(R\ge0\), and \((a,b)\ne(0,0)\), determine the **complete unordered set of real intersection points** (0, 1 or 2 points). A zero-radius circle is deliberately included and treated as a single point.

A strict machine-readable input example:

```json
{
  "kind": "circle_line_intersections",
  "circle": {
    "centerX": "0",
    "centerY": "0",
    "radiusSquared": "2"
  },
  "line": { "a": "0", "b": "1", "c": "0" }
}
```

All six numerical inputs must be strings representing exact integers, fractions or finite decimals, not Python floats, free text, scientific notation or raw expression strings. Input numeric components, even before reduction, are bounded by 1,000,000 and fields by 64 characters. Negative radius-squared, degenerate lines and unexpected fields are refused. The output is a complete point set: for the example, \(\{(-\sqrt 2,0),(\sqrt 2,0)\}\).

## Exact result and candidate contract

An existing source's proposed answer is considered a **typed candidate**, not automatically reliable published gold. The untrusted candidate must have `{"kind":"point_set","points":[...]}` with at most two distinct, unordered points. Each point has exactly `x` and `y`, and each coordinate is either:

```json
{"kind":"rational","value":"1/2"}
```

or a bounded exact expression of the restricted form \(u+v\sqrt{w}\):

```json
{"kind":"affine_sqrt","offset":"0","coefficient":"-1","radicand":"2"}
```

Here `u`, `v` and `w` are bounded exact rational strings; \(w\ge0\) and each component of the radicand is at most 10^12. Arbitrary symbolic expressions, function calls, nested ASTs, duplicate points, an unbounded number of points, malformed candidates and prose are **unverified**, not scored as incorrect math. Well-typed but mathematically wrong coordinate sets are exactly refuted with a cardinality or coordinate witness.

For **offline model replay**, the `answer` field must contain that typed point set, and the **entire visible** `rawText` must match its canonical JSON serialization (`ensure_ascii=False`, `sort_keys=True`, compact separators). No answer may be extracted from explanatory prose. This is a strict, bounded research capture contract, **not** a natural-language model scoring capability or an attestation of a live call.

## Independently crosschecked derivation

The first solver uses geometric projection. Define \(q=a^2+b^2>0\) and \(d=ah+bk+c\). The perpendicular foot is

\[
F=\left(h-\frac{ad}{q},k-\frac{bd}{q}\right).
\]

For \(\Delta=Rq-d^2\), negative, zero and positive signs give 0, 1 and 2 intersections. When \(\Delta>0\), the two points are

\[
F\pm\frac{\sqrt{\Delta}}{q}(-b,a).
\]

The **independent algebraic solver** eliminates \(y\) to produce a univariate quadratic when \(b\ne0\), or fixes \(x=-c/a\) and solves the remaining equation when \(b=0\). It does not call the geometric solver or use its intermediate foot or \(\Delta\). Each point from **both** derivations is substituted into the **original circle and line equations**, and unordered sets must agree exactly under symbolic radical simplification. A wrong oracle, missing root or invalid point forces a safe abstention. The result and candidate are never read during mathematical derivation.

This covers tangent, secant, disjoint, vertical/horizontal/oblique lines, offset centers, rational and irrational exact coordinates and the zero-radius boundary. It does **not** cover conic-conic intersection, 3D geometry, parameterized families, inequalities, approximate measurements, free-form proofs or faithful translation of arbitrary examination statements.

## Reproduction, evidence and limitations

The frozen **23-case synthetic-only** fixture contains 8 independent no-answer derivations, 4 existing-answer candidates (2 right, 2 wrong), 4 offline replay candidates (2 right, 2 wrong) and 7 deliberately unverified invalid/forged inputs. Two independent formulas and original-equation substitutions are exercised on **288 parameter-grid cases plus 240 seeded rational geometries**, with adversarial corruption of each solver, malicious typed inputs, duplicate detection, extraction leakage, exact near-miss rejection and fake real-exam source association.

```powershell
python -m pip install sympy==1.14.0 mpmath==1.3.0
python -m unittest scripts/research/test_verify_circle_line_intersections.py scripts/research/test_verify_dual_path_math_answers.py -v
python scripts/research/verify_dual_path_math_answers.py --fixture fixtures/research/circle-line-intersections-v0.1.json --sources fixtures/research/exam-multi-source-evidence-v0.1.json
```

No real model calls, reviewer judgement, authentication secrets or official exam-source elevation are involved. **A mathematical proof under a typed question does not establish that the typed question was a faithful transcription of a real paper.** The existing source evidence and its unresolved authenticity remain separate; this family is not counted as real Gaokao/Kaoyan coverage until that linkage is independently established.
