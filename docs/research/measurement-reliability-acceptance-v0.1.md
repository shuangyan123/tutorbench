# Measurement reliability pilot: acceptance evidence

Date: 2026-11-11. Base: `a8109bd0c33430bc3219d74fe51dc57f0af0451a`.
Branch: `feature/measurement-reliability-pilot`. Delivery boundary: **Draft PR,
no merge**. Environment: Windows, Node `v24.21.0`.

## Result

The scope-limited research capture/report path is implemented and locally
verified. It reuses existing TutorEval contracts, corpus replay, Judge output
validation, scoring provenance and human-reference readiness. Production
Rubrics, prompts, scoring modules, canonical cases, public scores, historical
reports and publication paths are unchanged.

[Audit, design, reuse ledger and unresolved questions](measurement-reliability-pilot-v0.1.md)
document the five studies and the exact limits of their applicability.

## Executed verification

| Command / check | Observed result |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund` | Installed existing lockfile dependencies; no dependency or lockfile changes. |
| `npm run typecheck` | PASS on final runtime implementation. |
| `npm run lint` | PASS on final runtime implementation. |
| `npm test` | PASS: **1,151 tests**, 0 failed, 0 skipped. Includes **11 new pilot tests**. |
| `npm run build` | PASS; also rerun by test/benchmark commands. |
| `npm run benchmark` | Command PASS; provider-free scripted Tutor reports 48 evaluation errors because no Judge is configured, scores unavailable. This is not 48 successful evaluations or model evidence. |
| Focused regression selection | PASS: **80 tests** across the pilot, subject/math/science linkage, Scenario provenance, Eval/Health scoring provenance, corpus/resume and calibration suites. |
| Demo + CLI freeze/report round trip | PASS; capture and report each reproduce byte-identically. |
| `git diff --check` / staged equivalent | PASS. |

Logs remain ignored under `artifacts/measurement-validation/`. The demo command
was `node scripts/research/measurement-reliability-demo.mjs artifacts/measurement-reliability-final`.
CLI report used that directory's `frozen.json` and wrote a new `replay.json`.
CLI freeze read the extracted dataset/corpus/evaluation/targets and wrote a new
`refrozen.json`. Outputs use exclusive creation; inputs/history were preserved.

Exact UTF-8 artifact SHA-256 checks from this run:

| Pair | Identical SHA-256 |
| --- | --- |
| `report.json` / `replay.json` | `bffc2c74514b713dafc34f2a54d5908eb05d1f919493df81703c4f37f21ada7a` |
| `frozen.json` / `refrozen.json` | `ad76dec6a9f6f8b2dd21d30ad7a3c5a81803cbcbeab554cbca5ba1469549c952` |

These identify synthetic control artifacts, not real benchmark or calibration
evidence. Capture fingerprints are canonical parsed-content hashes; the table
above hashes actual serialized file bytes.

## Synthetic control observations

One author-synthetic mathematical case, six frozen response variants, one
existing-contract synthetic Judge executor, **zero live calls and zero human
labels**. No external benchmark item was imported.

| Coverage / diagnostic | Observation |
| --- | --- |
| Planned response samples / distinct cases | 6 / 1 |
| Strict observations / Judge observations | 6 / 5 |
| Paired Strict–Judge denominator | 5 |
| Strict FAIL / Judge PASS | 2 |
| Strict PASS / Judge FAIL | 1 |
| Strict FAIL / Judge PARTIAL | 1 |
| Both FAIL | 1 |
| Judge insufficient information, excluded from pairs | 1 |
| Human references / complete three-way pairs | 0 / 0 |
| Calibration state | `not_calibrated` |

The deliberately scripted 4/5 disagreement and 20 percentage-point pass-rate
difference test plumbing only. They estimate neither real scorer accuracy nor
real Tutor quality. Whole-response exact equality differs from the paper's
word-boundary Strict algorithm and from the production containment verifier.

## Behavioral acceptance coverage

- Same frozen reply bytes across observations; deterministic report regeneration;
  exclusive output creation refuses overwrite, including an input path.
- Dataset/version, case content, response bytes, rubric weights, source wrapper,
  selection and human-source fingerprint mismatches fail closed.
- Existing custom scoring identity is preserved; tampering is rejected. Missing
  historical scoring/evaluator provenance is reported, never filled with defaults.
- Missing references, replies, evaluations, Judge results and Judge abstentions
  are excluded from their respective valid-pair denominator and counted separately.
- Raw Judge/stored rubric contradictions are rejected; opposing Strict/Judge
  observations are preserved. PARTIAL is not collapsed into PASS or FAIL.
- Existing annotation validation rejects wrong response identity. One reviewer,
  unresolved disagreement and synthetic labels do not supply a human reference.
  Human-reference contract branches in tests use software fixtures only; they are
  not exported as completed reviews.
- Tutor-visible replay inputs and reports exclude evaluator-only canaries,
  answers, rubric criterion text, raw Judge evidence and reply text. A canonical
  existing case is exercised through the unchanged corpus runner and wrapper
  reader with no provider; missing Judge evidence remains explicit.

## Limits and review state

No genuine human-calibrated cohort or original MisconceptDialogue experiment
has been reproduced. Selecting an eligible real frozen mathematics cohort,
verifying original source ownership and obtaining independent reference labels
remain unresolved. Integrity hashes do not authenticate historical inputs or
prove reviewer independence. All five studies inform the audit; only the
paired measurement/reporting increment is implemented in this first slice.

Remote exact-HEAD CI and review state are recorded in the Draft PR and final
handoff, rather than retroactively treating local checks as remote acceptance.
No merge, release, real model evidence publication or next-phase work is authorized.
