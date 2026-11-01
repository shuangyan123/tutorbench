# International English mathematics knowledge review — v0.2

**Purpose:** a plain-English audit of TutorBench's **mathematics knowledge system**, not a translation of Chinese exam standards. Stable knowledge IDs are shared across local examination profiles, but syllabus coverage, assessment conditions, language and marking requirements are not shared automatically.

## Place within the four-layer classification

1. **Discipline system:** Formal sciences (an editorial navigation category; mathematics has interdisciplinary uses).
2. **Specific discipline:** Mathematics.
3. **Knowledge system:** eight authored mathematics domains, 44 concept nodes, candidate prerequisite relationships and misconception prompts.
4. **Examination system:** issuing body + exam/course + applicable year, tier/route and questions, as a **many-to-many reference** to the knowledge system, not a child that owns or duplicates its mathematics.

See [four-layer academic registry](../../scenarios/case-system-vnext/academic-structure-v0.1.json) and the [exam-specific localisation hub](README.md).

## The research and curriculum sources are different kinds of evidence

- [Common Core State Standards for Mathematics](https://www.thecorestandards.org/Math/) are useful **US curriculum** references, not international exam rules.
- [PISA 2022 Mathematics Framework](https://www.oecd.org/en/publications/pisa-2022-assessment-and-analytical-framework_dfe0bf9c-en/full-report/component-3.html) differentiates mathematical content phenomena and mathematical reasoning practices.
- [TIMSS mathematics assessment frameworks](https://timssandpirls.bc.edu/) inform content and cognitive-demand comparisons at assessed grade levels.
- [Knowledge Space Theory](https://escholarship.org/uc/item/94b9x5sw) is related to possible knowledge states, but the current authored 44-node prerequisite graph **is not** a validated knowledge space.

For any real examination, always use its issuing body's **specific syllabus and examination year**. The current nodes were **selected by the project author**, and have **not** been verified clause-by-clause against any national syllabus.

## Author-proposed 44 concepts and graph edges

"Prerequisite" means a suggested dependency for instructional case writing, **not** a compulsory learning order or a finding about any student. Unmapped concepts remain a visible coverage backlog.

### Numbers, quantities and proportional reasoning

| Knowledge ID | Concept | Context stage | Candidate prerequisites | Directly mapped by a pilot task |
| --- | --- | --- | --- | --- |
| `units-whole` | Whole and unit reference | primary | None | Not yet |
| `integers-operations` | Integer operations | primary | None | Not yet |
| `fractions-units` | Fractional units and denominators | primary | `units-whole` | Yes |
| `fraction-equivalence` | Equivalent fractions and shared units | primary | `fractions-units`, `integers-operations` | Yes |
| `ratios` | Ratios and proportional relationships | lower-secondary | `fractions-units` | Not yet |
| `percent-base` | Percent as a fraction of a base | lower-secondary | `ratios` | Yes |
| `successive-changes` | Successive multiplicative changes | lower-secondary | `percent-base` | Yes |

### Algebra and equations

| Knowledge ID | Concept | Context stage | Candidate prerequisites | Directly mapped by a pilot task |
| --- | --- | --- | --- | --- |
| `variable-symbols` | Variables, expressions and equivalence | lower-secondary | `integers-operations` | Not yet |
| `linear-equations` | Linear equations and inverse operations | lower-secondary | `variable-symbols` | Not yet |
| `polynomial-factorization` | Expansion and factorization | lower-secondary | `variable-symbols` | Not yet |
| `rational-domain` | Rational expressions and excluded values | upper-secondary | `polynomial-factorization`, `linear-equations` | Yes |
| `inequality-signs` | Inequality transformations and signs | lower-secondary | `linear-equations` | Not yet |
| `quadratic-discriminant` | Quadratic roots and discriminant | upper-secondary | `polynomial-factorization` | Yes |
| `root-sign-conditions` | Positive and negative root conditions | upper-secondary | `quadratic-discriminant`, `inequality-signs` | Yes |

### Functions and change

| Knowledge ID | Concept | Context stage | Candidate prerequisites | Directly mapped by a pilot task |
| --- | --- | --- | --- | --- |
| `coordinate-graph` | Coordinate graphs | lower-secondary | `variable-symbols` | Not yet |
| `function-definition` | Functions as mappings and domains | lower-secondary | `coordinate-graph` | Not yet |
| `function-composition` | Function composition and domain restrictions | upper-secondary | `function-definition` | Yes |
| `inverse-functions` | Inverse functions and one-to-one restrictions | upper-secondary | `function-definition` | Not yet |
| `exponential-laws` | Exponential expressions and growth | upper-secondary | `function-definition`, `polynomial-factorization` | Not yet |
| `logarithm-inequalities` | Logarithm domain, base and inequality direction | upper-secondary | `exponential-laws`, `inequality-signs` | Yes |
| `limits-continuity` | Limits and continuity | upper-secondary | `function-composition` | Not yet |

### Geometry and spatial reasoning

| Knowledge ID | Concept | Context stage | Candidate prerequisites | Directly mapped by a pilot task |
| --- | --- | --- | --- | --- |
| `length-area` | Measurements of length and area | primary | `units-whole` | Not yet |
| `angles-triangles` | Angles and triangle properties | lower-secondary | `length-area` | Not yet |
| `similarity-scale` | Similarity, length and area scale | lower-secondary | `angles-triangles`, `ratios` | Yes |
| `pythagoras` | Right triangle and distance | lower-secondary | `angles-triangles` | Not yet |
| `coordinate-geometry` | Lines, circles and coordinate constraints | upper-secondary | `coordinate-graph`, `pythagoras`, `quadratic-discriminant` | Yes |
| `trigonometry` | Trigonometric definitions and geometry | upper-secondary | `similarity-scale`, `pythagoras` | Not yet |

### Counting and probability

| Knowledge ID | Concept | Context stage | Candidate prerequisites | Directly mapped by a pilot task |
| --- | --- | --- | --- | --- |
| `counting-principle` | Multiplication, permutations and unordered choices | lower-secondary | `integers-operations` | Yes |
| `combinations` | Combinations and counting without order | upper-secondary | `counting-principle`, `fractions-units` | Yes |
| `probability-events` | Events and equally likely sample spaces | lower-secondary | `fractions-units`, `counting-principle` | Not yet |
| `conditional-events` | Conditional probability and restricted sample spaces | upper-secondary | `probability-events`, `combinations` | Yes |
| `bayes-base-rate` | Base rates and inverse conditional probability | upper-secondary | `conditional-events` | Yes |

### Statistics and data interpretation

| Knowledge ID | Concept | Context stage | Candidate prerequisites | Directly mapped by a pilot task |
| --- | --- | --- | --- | --- |
| `statistics-weighted` | Weighted averages and aggregation | lower-secondary | `percent-base` | Not yet |
| `statistics-conditioning` | Subgroup rates and Simpson's paradox | upper-secondary | `statistics-weighted` | Yes |
| `statistics-variability` | Variation and distributions | upper-secondary | `statistics-weighted` | Not yet |
| `statistics-inference` | Sampling and inference limitations | university-intro | `statistics-variability`, `conditional-events` | Not yet |

### Proof, logic and generalization

| Knowledge ID | Concept | Context stage | Candidate prerequisites | Directly mapped by a pilot task |
| --- | --- | --- | --- | --- |
| `sequences-recursive` | Sequences and recurrences | upper-secondary | `variable-symbols`, `exponential-laws` | Yes |
| `logic-quantifiers` | Quantifiers, cases and counterexamples | upper-secondary | `variable-symbols` | Yes |
| `mathematical-induction` | Induction base and step | upper-secondary | `sequences-recursive`, `logic-quantifiers` | Yes |
| `inequality-proofs` | Inequality proof and equality cases | upper-secondary | `inequality-signs`, `logic-quantifiers` | Yes |

### Introductory calculus and linear algebra

| Knowledge ID | Concept | Context stage | Candidate prerequisites | Directly mapped by a pilot task |
| --- | --- | --- | --- | --- |
| `derivatives-rate` | Derivatives and local rates of change | upper-secondary | `limits-continuity`, `polynomial-factorization` | Not yet |
| `optimization-boundary` | Optimization and domain endpoints | upper-secondary | `derivatives-rate`, `inequality-signs` | Yes |
| `systems-equations` | Linear systems and consistency | upper-secondary | `linear-equations` | Not yet |
| `linear-algebra-rank` | Rank, dependence and consistency | university-intro | `systems-equations`, `variable-symbols` | Yes |


## What requires review before scaling to more exam systems?

- **Content scope:** number and measurement in primary years; vectors, 3D geometry and complex numbers in later schooling; calculus, linear algebra, probability distributions and statistical inference in university work remain incomplete.
- **Skill granularity:** a single concept label may hide several demonstrably different capabilities. Add subskills where a Tutor decision hinges on them.
- **Alternative paths:** direct prerequisites, helpful background and substitutable mathematical strategies should not be conflated into one graph edge.
- **Cross-disciplinary reuse:** quantitative reasoning can be used by other disciplines, but local exams still require their own question forms and marking rules.
- **Localisation:** different exam authorities have different requirements even when they use English. American SAT/AP, AQA GCSE, Cambridge, IB, ETS GRE and GMAC GMAT are separately documented.
- **Evidence boundaries:** authored difficulty, synthetic responses and hand-written rubrics are **not empirical learner difficulty, real student gains or official exam standards**.

### Stable assets

- [Mathematics knowledge graph](../../scenarios/case-system-vnext/mathematics-knowledge-map-v0.1.json)
- [Examination alignment registry](../../scenarios/case-system-vnext/mathematics-exam-alignment-v0.1.json)
- [Four-layer academic structure registry](../../scenarios/case-system-vnext/academic-structure-v0.1.json)


## Schema v2 and evidence limits (2026-10-28)

The canonical graph JSON now uses schema version 2. Its 61 edge records are separately
typed as `helpful` and `author-hypothesis`; these are *not* mandatory prerequisites
or diagnoses of a learner's knowledge state. The `alternativePaths` records
demonstrate multiple strategies for conditional probability and function introduction,
not empirically validated teaching routes.

The four official PISA content categories remain in `pisaContent`. TutorBench's
proof/cross-cutting and advanced topic groupings are held only in
`internalCategory`, not misrepresented as an additional PISA category.

The graph-wide `stage` is a provisional authoring label. The introductory
`limits-continuity` node is now tagged `upper-secondary`, consistent with its
role as a suggested background for `derivatives-rate`; it does not describe
formal university-level real analysis. The new `curriculumStageMappings` registry
is empty until exam-specific, source-backed mappings can be reviewed.
