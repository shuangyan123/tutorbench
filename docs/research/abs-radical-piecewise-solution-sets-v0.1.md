# Exact complete solution sets: absolute values, radicals and finite piecewise branches

**Research-only mathematics contract v0.1.** This is a reusable, bounded mathematical verifier and **does not authenticate any official exam paper, interpret arbitrary question text, or grade written proofs**. It requires neither an LLM Judge nor a human reviewer. Its primary task is to prevent **extraneous roots introduced by squaring** and **missing or overlapping piecewise branches** from being accepted as complete real solutions.

## Precisely supported family

An input specifies a real-variable domain Ω and at most eight disjoint, exhaustive branches, each with a typed guard G_i. On branch i, check one of six comparisons (=, !=, <, <=, >, >=) between either:

- affine \`ax+b\`;
- absolute value \`|ax+b|\`; or
- principal real square root \`sqrt(ax+b)\`;

and an affine right-hand side \`cx+d\`. All coefficients are exact rationals with numerators bounded by 1,000,000 and positive denominators bounded by 1,000,000. Domains, guards and candidate **complete solution sets** are typed finite unions of open/closed/half-open real intervals and isolated points with rational or quadratic-surd endpoints.

**Unsupported:** nested absolute values, square roots of quadratics, arbitrary symbolic functions, variable parameters, nonlinear RHS, arbitrary Boolean formulas, proof narratives and automatic OCR/NLP of exam papers. These return \`unverified\`, not a guessed correct/incorrect verdict.

Guards must be **pairwise disjoint and their union must equal the declared domain**; missing endpoints, overlapping endpoints, omitted branches and guards extending outside the specified domain are not silently repaired. Within a branch involving \`sqrt(ax+b)\`, the natural real domain \`ax+b>=0\` is additionally enforced. The empty requested domain and square roots having no real domain intentionally abstain rather than produce vacuous positive evidence.

## Exact verification method

The main solver expands each branch into *logically equivalent* sign constraints, constructs complete exact real solution sets for rational linear/quadratic polynomials, and intersects them with the active guard and requested domain. It compares the final **entire** set against the candidate on all algebraic boundaries and at an exact interior sample for every resulting interval cell. Every refuted answer includes a distinguishing witness.

For absolute value, split on \`ax+b>=0\` versus \`ax+b<0\` (the zero is in exactly one branch), and solve \`±(ax+b) □ (cx+d)\` with correct endpoint inclusion.

For principal square roots, **never square without a sign condition**. If \`u=ax+b\`, \`v=cx+d\` and \`P=u-v²\`, then all results are restricted to \`u>=0\`:

| Relation | Equivalent constraints over the real natural domain |
| --- | --- |
| \`sqrt(u)=v\` | \`v>=0 AND P=0\` |
| \`sqrt(u)!=v\` | complement of equality **inside** \`u>=0\` |
| \`sqrt(u)<v\` | \`v>0 AND P<0\` |
| \`sqrt(u)<=v\` | \`v>=0 AND P<=0\` |
| \`sqrt(u)>v\` | \`v<0 OR (v>=0 AND P>0)\` |
| \`sqrt(u)>=v\` | \`v<=0 OR (v>0 AND P>=0)\` |

A **different** SymPy path independently solves the *original unsquared expression*: \`solveset\` for equations and \`solve_univariate_inequality\` or \`reduce_abs_inequality\` for inequalities. Both sets must agree exactly, including boundaries; unsupported solver output or disagreement => \`unverified\`, never majority voting. These methods share SymPy and therefore are **differential verification, not two formally independent proof kernels**.

## Representative false-positive defenses

- \`|x-1|=2\` requires **both** \`{-1,3}\`; \`{3}\` and duplicate \`{3,3}\` are incomplete.
- \`sqrt(x+1)=x-1\` has \`{3}\`, not \`{-1,3}\`. A squaring step must not accept a negative right-hand side.
- \`sqrt(2x-1)=x-1\` has **only** \`{2+sqrt(2)}\`, not the extraneous \`2-sqrt(2)\`.
- \`sqrt(x+1)>=x-1\` has \`[-1,3]\`; \`sqrt(x+1)>x-1\` has \`[-1,3)\`. The natural domain boundary \`-1\` is included in both because the RHS there is negative.
- Piecewise \`f(x)=|x|\` for \`x<0\`, \`f(x)=sqrt(x)\` for \`x>=0\`: \`f(x)=1\` has \`{-1,1}\`; \`f(x)=0\` has exactly \`{0}\`. Missing the negative branch or duplicating the guard boundary is rejected.
- Disjoint guard coverage is mandatory even when an omitted branch would not happen to affect one particular candidate's answer.

## Reproducible tests and exact acceptance

\`\`\`sh
python3 -m pip install 'sympy==1.14.0' 'mpmath==1.3.0'
python3 -m unittest scripts/research/test_verify_abs_radical_piecewise.py -v
python3 scripts/research/verify_abs_radical_piecewise.py \
  --fixture fixtures/research/abs-radical-piecewise-v0.1.json
\`\`\`

The fixture contains **90** manually asserted controls: 60 complete real sets, 13 mathematically false candidates with exact distinguishing witnesses, 17 unsupported/invalid cases requiring abstention. The tests additionally run:

- **450** reproducible random affine/absolute/square-root comparison cases against an alternative SymPy solver path (four negative constant radicands are outside the real-domain contract, so are not counted as confirmed).
- **360** complementary relation properties: equality/inequality partitions cover the natural domain without overlap.
- Positive coefficient scaling and square-root radicand scaling invariance.
- Corruption injection into the independent solver; a wrong oracle triggers abstention.
- Malformed expressions, injection-looking strings, duplicate IDs, unparseable set endpoints and unsafe branch partitions.

The path-triggered \`Exact Absolute Radical Piecewise Math Research\` GitHub workflow repeats the checks under pinned symbolic dependencies. Every result has \`officialExamGoldCertified=false\` and no production TutorBench Judge or historical human-review records are changed.

## Stage conclusion and exact limitation

**Resolved in the above scope:** complete real solution-set verification for a fixed bounded family of affine absolute values, affine square roots, and finitely guarded combinations, including exact irrational endpoints, domain restrictions and detecting wrong roots introduced by squaring. This is a general reusable *family* checker, not a hard-coded one-exam-question validator.

**Not yet resolved:** arbitrary absolute/radical expressions, nonlinear compositions, parameterized branches, natural-language equation interpretation or entire proof checking. Real-exam evidence, source provenance and paper correctness remain independent concerns. This stacked Draft PR builds on #323's rational-quadratic sign-set research, and is not merged into canonical TutorBench.
