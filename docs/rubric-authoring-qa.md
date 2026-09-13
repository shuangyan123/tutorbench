# Canonical TutorEval rubric authoring QA

This document defines the R2 advisory authoring audit for the current canonical
TutorEval corpus.

The audit is a **review aid**. It identifies structural facts and heuristic
semantic-review candidates so that a human reviewer can focus on concrete
rubric identities instead of rescanning the whole corpus manually. It does not
rewrite benchmark data and it is not a validity claim.

Current audit identity:

```text
canonical-rubric-authoring-qa@0.1.0
```

Current input boundary:

```text
tutor-eval-v0.2a@0.2a.6
```

## Evidence classes

Every finding is explicitly classified as one of:

- `structural_fact`: a machine-verifiable property of the authored corpus;
- `semantic_review_candidate`: a heuristic flag that needs human semantic
  interpretation before any benchmark change is considered; or
- `informational`: a known or structurally notable review anchor that is not by
  itself a reason to modify semantics.

A heuristic finding is never proof that a rubric is invalid, non-atomic,
mistranslated, double-counted, or miscategorized.

## Rules

Version `0.1.0` contains six advisory rules:

1. `multi_clause`
   - uses deterministic conjunction/action-verb signals to find criteria that
     may contain multiple material requirements;
   - output class: `semantic_review_candidate`.
2. `long_form`
   - records fixed prose-length thresholds;
   - output class: `structural_fact`;
   - length alone is not a defect.
3. `category_capability_tension`
   - compares the rubric category with the audit's canonical family for its
     primary capability tag;
   - output class: `semantic_review_candidate`.
4. `within_case_overlap`
   - uses deterministic token overlap between neighboring criteria to identify
     possible double-counting candidates;
   - output class: `semantic_review_candidate`.
5. `cross_locale_structure`
   - compares paired locale members using category, behavior, primary
     capability, weight, evaluator type, critical marker, and critical-failure
     metadata;
   - output class: `structural_fact`;
   - a mismatch does **not** establish translation inequivalence,
     psychometric inequivalence, or an observed score difference.
6. `known_ambiguity_sentinel`
   - keeps the current `language-word-context-001@1.1.1` EN/zh-CN correctness
     criteria visible because repository diagnostics already treat their
     material-requirement boundary as a useful ambiguity probe;
   - output class: `informational`.

The rules and thresholds are fingerprinted with the report. Changing a rule or
threshold requires an audit version change rather than silently changing the
meaning of an old report.

## Run locally

JSON is the default output:

```bash
npm run rubric:audit
```

Markdown output is available with:

```bash
npm run rubric:audit -- --format markdown
```

or:

```bash
npm run rubric:audit -- --format=markdown
```

The JSON report includes exact dataset, case, version, rubric, category,
capability, rule, evidence-class, priority, evidence, and deterministic
fingerprint fields. The Markdown renderer presents the same report grouped by
review priority.

## Advisory-only boundary

The audit API records all three flags explicitly:

```text
advisoryOnly = true
mutatesBenchmarkData = false
hardGate = false
```

The command always reports findings; it does not fail CI because a heuristic
flag exists. CI may compile and test the implementation, but finding counts or
particular semantic candidates are not release gates.

A future decision to create a hard authoring gate would require separate
review, because false positives are expected from text heuristics.

## Relationship to existing evidence

The audit is intentionally downstream of the existing rubric authoring rule
that one criterion should observe one teaching behavior. The `0.2a.6` fraction
correction is a useful positive structural example: diagnosis, conceptual
guidance, procedural guidance, and actionability are separate criteria.

`language-word-context-001` is intentionally retained as an ambiguity sentinel.
The current Judge semantics can score a supplied criterion containing multiple
material requirements, and prior Material Requirement diagnostics decompose
that criterion for discrimination work. R2 therefore surfaces the criterion
for review rather than automatically changing it.

Cross-locale structure checks also remain distinct from the existing manual
cross-locale semantic audit. Structural alignment cannot prove bilingual
semantic equivalence, measurement invariance, or statistical comparability.

## Non-goals

R2-B does not:

- change canonical case or rubric text;
- change weights, thresholds, category aggregation, or pass eligibility;
- change capability tags or critical-failure mappings;
- change the Judge prompt or evaluator semantics;
- bump the canonical dataset version;
- create a new calibration threshold;
- replace independent bilingual or pedagogical human review;
- establish Judge-vs-human validity, psychometric validity, or learner-outcome
  validity.

Any future semantic correction identified through this inventory must follow a
separate evidence/versioning decision and must not be applied merely because a
heuristic produced a finding.
