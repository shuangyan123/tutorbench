# Math wrong-answer detection and supported-type coverage — research v0.1

**Research goal:** determine which **typed mathematical final-answer families** TutorBench can actually adjudicate, whether it **detects deliberately wrong responses**, how often it **wrongly accepts an incorrect answer**, and when it must abstain.

This is a reorientation from paper-provenance investigations. It is intentionally independent of which publisher originally distributed a problem. Source comparison may identify a plausible question and resolve most transcription conflicts, but question sourcing and verifier competence are separate measurements. For disputed answers, independently sampled frontier-model solutions can be used **as additional hypotheses and counterexample generators**, alongside exact symbolic/numeric proof, rather than treated as gold merely because models agree.

## The five supported typed families

| Family | Typed question and final-answer contract | Particularly important errors to detect | Out-of-scope |
| --- | --- | --- | --- |
| Finite uniform occupancy | Bounded i.i.d. equiprobable draws with replacement; exact expectation / probability as one fraction or finite decimal | Wrong denominator, incorrect event count, near-miss decimal, off-by-one | Nonuniform sampling, unspecified replacement, explanatory proof grading |
| Finite arithmetic–geometric sums | Bounded rational coefficients and finite term count; exact scalar | Missing final term, incorrect indexing, wrong zero/one-ratio branch, near-miss decimal | Infinite series, arbitrary recurrence, freeform summation text |
| Circle–line intersection points | Bounded rational circle/line; unordered set of 0/1/2 rational or restricted radical points | Missing negative root, spurious tangency point, incorrect radicals, nonexistent real point | Arbitrary conics, geometry diagrams, symbolic prose answer |
| Bounded quadratic rational solution sets | Polynomial numerator/denominator degree ≤2 over Q; complete typed real solution set | Removed domain hole, missed root, included strict inequality boundary, lost half-line | General transcendental or multivariate equations |
| Parameterized circle–line intersection count | Complete real parameter set producing exactly 0/1/2 intersections | False tangency inclusion, missing ± parameter root, mistaken constant-line case | Other parameterized conics or unconstrained formula languages |

These are **five precise implemented scopes**, not five entire exam chapters. The research suite tests **final answers in controlled machine-readable formats**, not natural language parsing, derivation correctness, all equivalent symbolic representations, partial credit, explanation quality or genuine model-generated failure distributions.

## Adversarial, independently labeled detection trial

Fixture: `fixtures/research/math-wrong-answer-detection-v0.1.json`.

It contains **54 synthetic response trials**: 28 known-wrong mutants, 20 mathematically correct controls, and 6 deliberately unsupported inputs/responses. The 28 errors cover 26 distinct error-mode labels, including exact near misses, an omitted root, a denominator domain hole, a spurious intersection, inclusion/exclusion of an endpoint, and incorrect parameter partition. Models and response examples are fully visible, so this is **not** a blinded live-model benchmark.

The harness is separate from the adjudicator. Before any verdict, it checks each fixture's `oracleKey` against a fixed question contract, then verifies the author's truth label using its own control calculation:
- Complete finite enumeration of the five-label/three-draw probability experiment, not the production occupancy solver.
- Direct finite rational term summation, not the production weighted-series closed form.
- Explicitly hand-specified small exact point sets and intervals (e.g. `±√2`, the domain hole at 1, and the circle tangency at `±1`), with an independently coded restricted candidate parser and SymPy exact comparisons. These hand specifications remain **author-assigned control truth**, not externally calibrated expert gold.

The measured verifier receives only the question and offline replay candidate, **never** the truth label, `oracleKey`, mistake type or control answer. The harness uses the production research bridge with **no live API calls** and no published reference answers. Any candidate that the bridge cannot evaluate remains `abstained`.

Fault injection separately forces the verifier to accept everything, refute everything, or abstain on everything. The metrics and CI must expose each failure; an always-abstaining verifier must **not** pass the full supported-decision-coverage gate.

## Metrics with explicit denominators

Let W be the known-wrong, C the known-correct, and U the intentionally unsupported test subsets. The metric definitions deliberately use **all authored examples in that subset**, not only decidable answers:

- **False acceptance rate (FAR)**: wrong responses **accepted as correct** / all W. This is the critical failure risk.
- **Wrong-answer detection recall**: wrong responses **exactly refuted** / all W. A wrong response marked unverified is **not counted as detected**.
- **Wrong-answer abstention rate**: wrong responses marked unverified / all W.
- **False rejection rate**: correct responses **refuted as incorrect** / all C.
- **Supported-answer decision coverage**: all W and C given a definitive verdict / (|W| + |C|).
- **Unsupported abstention rate**: unsupported examples marked unverified / all U; scoring any U definitively is a capability overclaim.

Every metric reports numerator, denominator and value; exact family-by-family slices are also emitted so a strong scalar grade cannot hide poor set or geometry behavior. CI requires **zero falsely accepted known-wrong, zero falsely rejected known-correct, zero unsupported definitively graded, and all supported controls decidable**, for this frozen regression fixture. That is a **synthetic safety gate**, not a generalizability estimate. Zero false acceptance on 28 engineered errors does not bound the rate on arbitrary real model errors to zero.

There are no genuine generated model replies in the fixture, so `measuredLiveModelErrorDetectionRate` is **null**, and `genuineModelRuns` and `officialExamGoldReleased` are **0**.

## Reproduction

Run with Python 3 and exact SymPy dependencies:

```powershell
python -m pip install sympy==1.14.0 mpmath==1.3.0
python -m unittest scripts/research/test_measure_math_wrong_answer_detection.py -v
python scripts/research/measure_math_wrong_answer_detection.py --fixture fixtures/research/math-wrong-answer-detection-v0.1.json --require-zero-false-decisions --require-full-supported-coverage
```

The dedicated GitHub CI workflow verifies exact fixed expectations, independent oracle checks, sensitivity to malicious "accept all" and "reject all" mutant validators, an abstain-all detector, and regressions from earlier mathematical families.

## Next decisive experiment

The next step is an **out-of-fixture blind model-error dataset**: sample fresh Gaokao/Kaoyan-style tasks stratified by subtype, collect raw model answers *without disclosing reference answers*, independently adjudicate disputed examples with exact mathematics, witness counterexamples and (where useful) several different frontier models, and run this frozen verifier against the untouched replies. Include real model refusals and invalid formats in coverage denominators. Report FAR, detection recall, false rejection, abstention and per-family sample size with uncertainty, separating model service failure from a mathematical result.

Only then could we claim empirical **model wrong-answer detection** in the actual target distribution. This v0.1 suite first proves that the machinery can detect **known, independently labeled, diverse errors** without silently accepting them or gaining apparent success by abstaining.
