# Case System vNext — Domain Coverage Matrix

Status: **authoring plan / pilot records are non-canonical**

Case System vNext no longer uses the earlier five-bucket
`Mathematics / Science / Programming / Language-Writing / History-Social Science`
matrix as its primary subject taxonomy.

The first-level domain vocabulary is seeded from section 5.2 of the external
2026-09-11 TutorBench Evaluation Framework / Pedagogy Taxonomy Research Audit.
That audit proposed 23 content domains with distinct evidence and reasoning
norms. The taxonomy is a design seed pending expert validation, not a validated
measurement ontology.

See:

- [Case System vNext methodology](case-system-vnext.md)
- [Evaluator Stress Test](case-system-vnext-evaluator-stress.md)
- [Evaluation Framework Research Audit](audits/evaluation-framework-research-audit-2026-09.md)

## 23-domain seed matrix

| Domain | Initial evidence / reasoning emphasis |
| --- | --- |
| Mathematics | definitions, deduction, proof obligations, counterexamples |
| Statistics | data generation, sampling, variability, uncertainty, model fit |
| Physics | system boundaries, idealization, conservation, dimensions, model regime |
| Chemistry | macro/micro/symbolic coordination, conservation, conditions, kinetics/energetics |
| Biology | multi-level mechanisms, experimental control, variation, non-teleological explanation |
| Earth / environmental science | multi-scale systems, historical observation, spatial/temporal heterogeneity, uncertainty |
| Computer science | specification, invariants, reproducible execution, testing, complexity |
| Engineering | requirements, constraints, verification, risk, design trade-offs |
| Medicine / health sciences | evidence quality, prior risk, differential reasoning, escalation, safety |
| Psychology | construct measurement, study design, causal identification, population scope |
| Economics | mechanisms, assumptions, identification, heterogeneity, external validity |
| Sociology | sampling, institutions, historical context, mixed evidence, positionality |
| Political science / civics | institutional evidence, factual/value distinction, causal claims, public reasoning |
| History | sourcing, contextualization, corroboration, source independence |
| Law | jurisdiction, authority hierarchy, temporal validity, rule-to-fact application |
| Philosophy | conceptual clarity, premises, validity, soundness, objections and replies |
| Languages / second-language learning | communication, pragmatics, interaction, mediation, register |
| Literature | textual evidence, form, genre/history, coherent interpretation |
| Writing / rhetoric | audience, purpose, argument, evidence, genre, revision |
| Business / finance / accounting | data quality, accounting/regulatory context, risk, decision objectives |
| Arts / music / design | artifact/performance evidence, technique, form, intent, revision |
| Vocational / procedural education | observable procedure, tool conditions, quality, safety, recovery |
| Interdisciplinary / emerging fields | cross-domain evidence compatibility, uncertainty, boundary assumptions |

These rows should not be read as mutually exclusive school departments. They
are research-seeded evidence domains. Cross-cutting practices such as writing,
modeling, programming, source analysis, proof, and experimental design may
appear inside more than one domain.

## Pilot v0.2 coverage

The current non-canonical pilot contains 15 archetypes across **seven** audit
domains. It intentionally tests the authoring model rather than claiming
representative subject coverage.

| Domain | D1 | D3 | D5 |
| --- | --- | --- | --- |
| Mathematics | equivalent representations | multi-step algebra diagnosis | algebraic structure / proof / generalization |
| Physics | position-time graph interpretation | — | — |
| Chemistry | — | — | discriminating kinetics experiment |
| Biology | — | biological causal explanation from experiment | — |
| Computer science | Python program tracing | Python mutable-state debugging | pair-sum algorithm design |
| Writing / rhetoric | local sentence revision | argument coherence repair | conflicting-source synthesis |
| History | explicit source interpretation | multi-cause historical explanation | conflicting-source corroboration |

A blank cell means **not authored yet**, not "not applicable".

The old requirement that every broad bucket have D1/D3/D5 coverage has been
removed. With 23 research-seeded domains, forcing identical depth cells across
all domains would create artificial symmetry before domain-specific content
standards are mature.

## Subject and specialization refinement

A domain is still too broad for many strategy judgments.

Examples:

```text
Computer science
  -> Python
     -> program tracing
     -> debugging
  -> Java
     -> object-oriented design
  -> Rust
     -> ownership / borrowing
  -> algorithms
     -> search / graph / dynamic programming / optimization

Physics
  -> mechanics
  -> electromagnetism
  -> thermodynamics
  -> waves / optics

Chemistry
  -> stoichiometry
  -> chemical kinetics
  -> equilibrium
  -> organic mechanisms

Biology
  -> genetics
  -> cell biology
  -> physiology
  -> ecology / evolution
```

Task-specific strategy profiles are authored below this level. A Computer
Science algorithm profile must not automatically govern Python debugging; a
Chemistry kinetics profile must not govern Biology experimental explanation.

## Depth remains multi-axis

D1-D5 continues to describe **content depth**, not a universal psychometric
difficulty scale.

Every archetype also carries:

- Pedagogical Difficulty P1-P5;
- Interaction Horizon H1-H3;
- learner state;
- prerequisite boundary;
- exact domain / subdomain / practice;
- reference reasoning where meaningful;
- transfer target.

A D5 task is not automatically harder to teach than every D3 task.

## Expansion sequence

The next content expansion should proceed by **domain review**, not by filling
a rectangular matrix for appearances:

1. validate the 23-domain registry and evidence norms with independent subject
   review;
2. select a small number of high-value domains for the next pilot;
3. define specializations and task families within each selected domain;
4. author D1-D5 anchors only where they are meaningful for that subject;
5. write task-specific strategy profiles before stress fixtures;
6. stress-test evaluator distinctions and alternative-strategy fairness;
7. only then convert selected archetypes into executable Tutor scenarios.

Likely near-term high-value expansions include Statistics, additional Physics,
additional Chemistry, additional Biology, and more Computer Science
specializations such as Java and Rust. This is a prioritization hypothesis, not
a claim that those domains are more educationally important.

## Claim boundary

Coverage means **structured authored coverage**, not representativeness.

Populating more domain/depth cells does not establish:

- general tutoring competence;
- psychometric comparability across domains;
- learner outcomes;
- measurement invariance;
- Judge calibration;
- transfer achieved by a learner.

The matrix is an inspectable authoring map and gap report.
