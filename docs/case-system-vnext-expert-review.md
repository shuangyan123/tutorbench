# Case System vNext — Independent Expert Review Protocol

Status: **reviewer-ready protocol; no independent review data yet**

This protocol defines the independent review boundary for developer-authored
Case System vNext evaluator-stress expectations. It does not create human gold,
calibrate a Judge, or authorize public evaluator-quality claims.

## Scope

The first review round covers the versioned evaluator-stress fixture suite and
asks a narrow question:

> Given the authored task context and two candidate Tutor responses, what
> semantic relationship is justified by the evidence?

Allowed reviewer outcomes are:

- `A_BETTER`
- `B_BETTER`
- `EQUIVALENT`
- `NON_DOMINATED`
- `INSUFFICIENT_EVIDENCE`

The review is about the fixture expectation and construct clarity, not about
ranking model providers.

## Reviewer expertise

Reviewers should have relevant subject or assessment expertise for the fixture
being reviewed. One reviewer need not cover every domain. Assignment should be
made by domain/task expertise rather than by generic LLM-evaluation experience.

At minimum, the initial review set should include expertise covering:

- secondary mathematics / mathematics assessment;
- experimental biology;
- chemistry experimental design;
- physics representation interpretation;
- Python debugging / computer science instruction;
- historical source analysis;
- writing / rhetoric.

## Blindness boundary

The reviewer packet may contain:

- an opaque review identifier;
- domain, subdomain, practice, learner level, depth/difficulty/horizon;
- learner state;
- immediate teaching target;
- teaching objective and assessment context when applicable;
- prerequisite boundary;
- shared base criteria;
- exact task-specific strategy profile;
- reference-reasoning context needed to interpret the task;
- the two candidate responses labeled only A and B;
- the bounded semantic outcome vocabulary.

The reviewer packet must not contain:

- developer-authored expected outcome;
- preferred candidate ID;
- developer rationale;
- DeepSeek or any other Judge outcome;
- provider/model identity;
- presentation-level live-run results;
- expected-match statistics;
- order-sensitivity diagnostics;
- prior reviewer labels;
- adjudication results.

## Order control

Each fixture should be reviewed in a fixed but counterbalanced presentation
order across independent reviewers. If reviewer 1 receives A=X / B=Y,
reviewer 2 should receive A=Y / B=X.

A reviewer must not see both orderings of the same fixture during the same
independent pass.

## Reviewer submission

For each assigned fixture, the reviewer records:

- one bounded semantic outcome;
- optional bounded notes identifying ambiguity, missing context, or construct
  contamination;
- whether the task packet is sufficiently clear to support the selected
  outcome.

Free-form notes are diagnostic only. The bounded outcome remains the primary
comparison field.

## Interpretation

Agreement does not automatically create a reference label.

The operator must distinguish:

- same underlying preference after order normalization;
- stable equivalence;
- stable non-dominance;
- stable insufficient evidence;
- order-sensitive reviewer disagreement;
- substantive reviewer disagreement;
- packet ambiguity.

Developer expectation and reviewer outcome must be compared only after
unblinding by the operator.

## Reference-evidence gate

A developer-authored expectation may be promoted to reviewed reference evidence
only after:

1. at least two independent domain-appropriate reviewers complete the blind
   task;
2. their labels are normalized across counterbalanced A/B order;
3. disagreements are preserved rather than silently majority-voted away;
4. material disagreement or packet ambiguity is adjudicated by an independent
   domain-appropriate reviewer or recorded as unresolved;
5. the exact fixture-suite, strategy-profile, pilot, teaching-objective, and
   review-protocol versions are bound in the evidence record.

A reviewed label is still human reference evidence, not infallible ground
truth and not a learner-outcome measurement.

## Current readiness boundary

The repository currently has:

- a provider-neutral stress harness;
- 17 versioned synthetic fixtures in suite v0.5.0;
- D1/D3/D5 pilot archetypes;
- explicit task-specific strategy profiles;
- live-Judge diagnostic evidence;
- no independent expert labels for these stress fixtures.

The deterministic blind export/import boundary is implemented. From a built
repository clone, generate the two reviewer packages with:

```powershell
node dist/src/cli/tutorbench.js case-system-vnext-expert-review-export `
  --reviewer reviewer-a `
  --reviewer reviewer-b `
  --output-dir artifacts/case-system-vnext-expert-review
```

After each reviewer independently completes their own
`submission-template.json`, import the two completed files with:

```powershell
node dist/src/cli/tutorbench.js case-system-vnext-expert-review-import `
  --packet-dir artifacts/case-system-vnext-expert-review `
  --submission <reviewer-a.completed.json> `
  --submission <reviewer-b.completed.json> `
  --output artifacts/case-system-vnext-expert-review/evidence.json
```

Real reviewer recruitment and completed review data remain outside the current
repository state until they actually occur. The immediate next step is to run
the exporter, inspect the generated reviewer-facing material, and recruit
domain-appropriate reviewers without exposing the operator manifest.
