# TB-A01 + TB-A02 evidence boundary

Local integration based on verified main `44d77fe`. Evaluator identity remains
`0.3a.5`; result schema remains v1. Rubrics, prompts, weights and the 0.75
threshold are unchanged. This establishes artifact consistency, not Judge
calibration or provider authenticity.

## Sources

The four commits are replayed in this order, with original SHAs retained in
each commit message:

| Change | Source commit |
| --- | --- |
| TB-A01 source integrity | `7a723aef2fb2122632b9dc149fbd0c9c3cdc81f5` |
| TB-A01 aggregate parsing compatibility | `b9fec615f847fc0d67299fea9a0570171f421b93` |
| TB-A02 insufficient information | `1642d09241ff34836f36ea6c581d89e77c22e65d` |
| TB-A02 category evidence availability | `bc9593f980c5fcb4ce760d02a5e6ff337ed8905e` |

## Integrated contract

Ordinary raw Judge PASS/PARTIAL/FAIL must match normalized rubric status.
Only a structured `insufficientInformation=true` result may map those statuses
to ERROR/null. The existing TB-A02 checks still require error case state,
`passed=false`, null case overall and null run aggregates. Case counts,
case/run identity, normalized status/score and raw failure checks remain active.
A structured abstention cannot claim a failed quality gate with no failure.

Standalone v1 parsing has no authored ownership metadata. Before consuming
an abstention, Health checks that the raw Judge rubric collection exactly
matches the authored Judge subset. Unknown IDs, omissions and deterministic
IDs in that collection are rejected. Present normalized rubrics retain the
authored ID/category/weight checks. Deterministic evidence cannot carry the
Judge abstention diagnostic. A case category is numeric only when that category
has independently scoreable evidence; its numeric aggregate is not recomputed.

Genuinely missing normalized evidence stays readable as partial v1 evidence,
with explicit missing/duplicate unresolved entries. It does not receive the
benefit of a synthesized judgment, an assessed score or a resolved Finding.
Missing raw evidence outside structured abstention also remains unresolved.
Thus historical partial parsing is retained without certifying completeness.

For abstentions, each normalized critical failure must have a matching source
type, severity and evidence: a raw critical/factual signal or a FAIL on an
authored deterministic criterion with a failure mapping. Every source failure
must survive, allowing the runner's highest-severity deduplication. Unknown,
upgraded, rewritten or omitted signals are rejected. This checks projection
consistency, without assuming a default quality-gate configuration.

Health preserves independent deterministic scores and Findings. Judge-only
abstention stays unscored and UNRESOLVED; confirmed critical failures may
produce FAIL. Manifests reconstruct the report for every source, and comparison
validates that reconstruction before classifying Findings.

## Remaining limits

Historical optional fields and finite run-level aggregate parsing remain
supported; comparison still requires recorded locale and the current evaluator.
Custom scoring identity and aggregate recomputation remain TB-A05. This does
not re-execute deterministic evaluators, authenticate transcripts or detect
consistent tampering of all source layers. Synthetic tests provide regression
evidence, not human agreement or learning-effectiveness evidence.
