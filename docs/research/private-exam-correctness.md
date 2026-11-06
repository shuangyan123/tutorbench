# Private exam Correctness Verifier

This research CLI consumes the v1 local exam bank handoff from the exact PR #345 foundation `2399660ab6785baaaa1f964341d05616249543d6`. It works with the user-supplied exam files as the question source. Reference answers are hypotheses. The existing TutorEval Correctness rubric and scoring contracts are separate and unchanged.

## Reuse and scope

- The local exam bank supplies question identity, typed handoff, answer pairing, source PDF and crop digests. Source crops are required for every selected record. A manually formalized problem is bound to the question-only digest.
- The dual-path mathematics module supplies the exact finite-occupancy solver. Its indicator result is compared with independent enumeration of ordered outcomes. The exact real-set comparator provides witnesses for open or closed boundary errors.
- The existing contextual expected-value binder and isolated Math-Verify worker extract a bounded exact rational from a boxed `E[X]` claim. Approximate-only results remain outside the accepted LaTeX subset. A decimal used as an exact literal compares as an exact rational.
- Additional bounded rules cover pair matching with a positive arithmetic difference, one exponential/linear shift interval, a two-offset line intersection count, constant acceleration, a static friction limit with stated assumptions, balance of specified chemical species and a two-step redox ratio, and one conditional Mendelian mating model.
- General proofs, orbital force inference, arbitrary chemical feasibility and biological experiment interpretation remain outside the supported scope. Chemistry species and diagram interpretation require source review. The genetics check applies to the specified subclaim under the source-reviewed Mendelian assumptions. Short free-form answers and the problem models require targeted transcription. Multi-part questions retain abstention when only one claim is supported.

## Two paths and evidence

`blind` calls the bank's `handoff` function for the selected records, checks their question-side digests and writes a receipt. The subprocess receives only `kind`, `model` and the typed question options on stdin. The worker rejects unknown top-level fields and solves the problem entirely from its stdin payload. The operator prepares a source-reviewed plan. The solver process is isolated. The operator's source formalization remains a separate manual step.

`review` replays the blind receipt before reading reference or candidate sidecars. Path A checks the supplied value against exact constraints. Path B derives a result without the proposed value. A path disagreement abstains. A refutation needs a replayable exact mismatch. Unsupported hypotheses, missing crops, changed source or answer bytes and stale hashes fail closed. A reference transcription binds to the answer-record digest. The original source and crop locations remain inspectable. The final input digest binds the engine and dependency versions, handoff, private plan, blind receipt, reference binding and optional candidate.

A whole answer result, candidate answer result and listed reasoning-premise checks are distinct. Reference reasoning and complete proofs remain unverified. `supportsCaseAuthoring` identifies whole-answer evidence for a later human case-authoring decision. `formalScoringEligible` remains false because no teaching case has been evaluated.

## Reproduce locally

Use a Python environment with the tested versions. Keep plans and evidence under the worktree's ignored `data/private/correctness` directory. Output paths must be new so prior receipts stay intact. The private pilot includes `plan-final.json`, `references.json` and `candidates.json`.

```powershell
python -m pip install 'sympy==1.14.0' 'math-verify[antlr4_13_2]==0.9.0' 'pdfplumber==0.11.9' 'pypdfium2==5.14.0' 'Pillow==13.0.0'
$bank = 'E:/AI/code save/re-local-exam-bank/data/private/exam-bank-release-v2/bank.json'
$p = 'data/private/correctness'
$env:PYTHONDONTWRITEBYTECODE = '1'
python -B scripts/research/local_exam_bank.py handoff --bank $bank --question-id gaokao-2026-national-1/q07
python -B scripts/research/exam_correctness.py blind --bank $bank --plan "$p/plan-final.json" --out "$p/replay-blind.json"
python -B scripts/research/exam_correctness.py review --bank $bank --plan "$p/plan-final.json" --receipt "$p/replay-blind.json" --references "$p/references.json" --candidates "$p/candidates.json" --out "$p/replay-review.json"
python -B -m unittest scripts/research/test_exam_correctness.py -v
python -B data/private/correctness/check-real.py data/private/correctness/replay-controls.json
```

A plan item specifies `questionId`, `questionSha256`, `requiredPages`, `sourceReview`, `limitations` and a `check`. A check contains `scope` and the typed `problem`, or is null for an unsupported case. Nonliteral answers use a separate private reference entry with `answerSha256`, `scope`, `value` and `sourceReview`. Candidate entries use `scope`, `value` and `reasoning`. For example, a synthetic quantity uses `{"value":"500","unit":"cm/s^2"}`, and its supported premise check can use `{"field":"constant","value":true}`. A result contains the question ID, verifier version, input digest, separate status fields, scope, witnesses, missing inputs and scoring flag. Use `--expect-input-hashes` with a question-ID to input-digest map to reject a stale review explicitly.

## Private pilot results

The selected cohort consists of the four 2026 priority questions, five historical questions spanning 2022–2025 and all four subjects, then one additional geometry question after the first run. Nine of the ten selected records produced a blind derivation. Six entire reference answers matched, three additional scoped claims matched and one orbital question lacked a supported model. Whole-question results were **6 verified, 0 refuted, 4 abstained**. These counts refer to 10 selected records in a bank of 667. Support coverage of the whole bank was not measured. The three partial results and the orbital question require manual judgment before case authoring. Twelve adversarial checks on in-memory copies of private inputs passed. They are counted separately from supplied references. CI runs synthetic fixtures only.
