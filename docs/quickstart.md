# TutorBench Quickstart

The five-minute path below uses the current repository source with Node 24
(`>=24 <25`). The published npm `0.1.0` instead requires Node 22 (`>=22 <23`)
and contains an older source snapshot. Both have a Quickstart demo; their
canonical dataset, evaluator and advanced features are not interchangeable.
See [release channels](release.md#installation-channels).

```bash
git clone https://github.com/shuangyan123/tutorbench.git
cd tutorbench
npm ci
npm run quickstart
```

Requirements: Node 24 (`>=24 <25`). Quickstart is provider-free,
network-free, and Judge-free. It does not read provider credentials, construct
an HTTP or model adapter, or contact a remote endpoint.

## What it runs

Quickstart has the stable identity `tutorbench-quickstart@0.1.0` and selection
`quickstart-v1`. It uses the existing deterministic development/smoke dataset
`tutor-eval-v0.1@0.1`, not the canonical scoring cohort. The fixed cases are:

| Case | Version |
| --- | --- |
| `fraction-misconception-001` | `1.0.0` |
| `correct-answer-wrong-reasoning-001` | `1.0.0` |
| `full-solution-check-001` | `1.0.0` |
| `paired-fraction-procedural-001` | `1.0.0` |

The canonical `tutor-eval-v0.2a@0.2a.6` snapshot remains separate from
Quickstart. The Quickstart uses the existing legacy dataset because an audit
found no complete deterministic-only case in the canonical snapshot; every
canonical case retains at least one Judge-owned rubric. Quickstart therefore
fails closed if a selected case changes version, fingerprint, or evaluator
ownership.

The bundled example Tutor is the deterministic
`scripted-quickstart-tutor@1.0.0` (`quickstart-example@1.0.0`). It reuses the
existing scripted Tutor and evaluator pipeline. Three cases demonstrate
passing checks, while one response is intentionally weak so a pedagogical
`FAIL` is visible. This makes the first result explainable without pretending
that the example Tutor is perfect.

## Reading the result

The terminal summary reports case-level deterministic checks, plus:

- `Judge: not required`
- `Network: disabled`
- `Official benchmark score: no`
- `Leaderboard eligible: no`

There is no Quickstart overall score. By default the command prints only the
summary. To write the independent, explicitly non-official report contract:

```bash
npm run quickstart -- --output artifacts/quickstart.json
```

Or, using Node 22 with the historical published package:

```bash
npm install tutor-benchmark@0.1.0
npx --no-install tutorbench quickstart
```

The JSON artifact has `mode: "quickstart-demo"`,
`officialBenchmarkScore: false`, and `publicLeaderboardEligible: false`.
Expected demonstration `FAIL` results do not make the command fail: exit 0
means the deterministic demo infrastructure completed. A non-zero exit means
an invariant, dataset, Tutor, or evaluator execution error occurred.

## Full benchmark and official evidence

The full local benchmark is intentionally separate:

```bash
npm run benchmark
```

The repository run uses the canonical `tutor-eval-v0.2a@0.2a.6` dataset and
evaluator `0.3a.6`, recorded in the output. The published `0.1.0` snapshot
contains `tutor-eval-v0.2a@0.2a.5` and evaluator `0.3a.4` instead; it has no
Tutor Health CLI or API. Judge-required semantic criteria remain unresolved when no explicit
Judge is configured, so the normal no-Judge run reports Judge-unavailable
errors and no score. Quickstart does not suppress, reinterpret, or replace
that fail-closed behavior.

Official or reproducible evaluation still follows the advanced evidence
chain: canonical model collection, frozen versioned corpus, explicit Judge,
and calibration/review before any future public result eligibility. A
Quickstart run is not calibrated evidence, an official benchmark result, a
leaderboard submission, a substitute for a Judge, or evidence that
deterministic proxies capture full tutoring quality.

### Diagnosing the full offline run

`npm run benchmark` runs the synthetic guided Tutor once on each of 24 English
and 24 Chinese cases. Before running, it checks the exact selected IDs against
the scripted replies. A missing or blank script stops the demo and identifies
the affected cases. The demo reads no provider credentials and makes no network
calls. The Chinese replies are authored demonstration fixtures.

At base commit `3a9c6f8`, all 24 English IDs had a scripted response and all
24 Chinese IDs lacked one. Running that revision produced 24 English
`judge_unavailable` and 24 Chinese `adapter_failed` rows. Each Chinese adapter
call stopped before evaluation. To inspect by case after running either
revision, read `caseResults` in `artifacts/tutor-eval-v0.2a-result.json`
and compare the case ID, recorded locale, response presence and diagnostic code.

The full demo additionally writes `artifacts/tutor-eval-v0.2a-diagnosis.json`.
It records the entrypoint, dataset edition, response counts and error codes by
locale, each selected case and its unresolved Judge rubric IDs. Multiple
categories can affect one case. The default run receives 48 responses, records
48 cases with `judge_unavailable`, and yields `overallScore: null`. Exit 0
means the run and report completed. Use `npm run quickstart` for the four-case
deterministic smoke demonstration.

| Diagnostic code | Where to look |
| --- | --- |
| `judge_unavailable` | The default command supplies no Judge executor. For an explicitly configured provider, check required configuration and credentials. |
| `judge_timeout` | The Judge exceeded its deadline. |
| `judge_transport_error` | A configured Judge execution failed before delivering a usable result. |
| `judge_result_invalid`, `judge_output_truncated` | Check the Judge output contract or output limit. |
| `judge_rubric_missing`, `judge_rubric_unexpected` | Compare returned and requested Judge-owned rubric IDs. |
| `judge_insufficient_information` | The Judge returned a structured abstention. |
| `adapter_failed` | The Tutor threw or returned an invalid response. |
| `evaluation_failed` | A deterministic rubric could not be evaluated. |
