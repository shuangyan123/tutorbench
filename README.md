<p align="center">
  <img src="assets/brand/tutorbench/web/tutorbench-mark.svg" alt="TutorBench T1 trajectory mark" width="128">
</p>

# Teachometry TutorBench

**Open-source real-world evaluation and regression engine for AI tutoring
systems, developed by [Teachometry](https://teachometry.com).**

TutorBench tests how an AI tutor behaves in authored learning situations,
diagnoses concrete pedagogical failures, and preserves the evidence needed to
fix and retest them. It is built to help make AI tutors better, not to produce
a leaderboard.

[Website](https://teachometry.com) ·
[Quickstart](docs/quickstart.md) ·
[Documentation index](docs/README.md) ·
[Full repository reference](docs/repository-reference.md) ·
[Roadmap](docs/roadmap.md)

> **Naming note:** this repository is Teachometry's independent TutorBench
> project. It is not affiliated with Scale AI's separately named
> [TutorBench dataset](https://huggingface.co/datasets/ScaleAI/TutorBench).

## Project identity

**Teachometry** is the public-facing product and project identity.
**TutorBench** is Teachometry's open-source evaluation engine, repository, CLI,
and technical contract surface. On first external mention, prefer
**Teachometry TutorBench** or **Teachometry's TutorBench**; technical
documentation may use **TutorBench** after that context is established.
The T1 trajectory mark above belongs to TutorBench only; its usage rules are in
[`assets/brand/tutorbench/README.md`](assets/brand/tutorbench/README.md).

## Why it exists

Access to an AI system is not the same as access to a good tutor. A model can
answer a question correctly and still fail to diagnose a misunderstanding,
guide reasoning, adapt its help, or preserve the learner's agency. Before AI
tutoring can be trusted at scale, those capabilities need to be measurable.

TutorBench is reproducible, provider-neutral quality infrastructure for that
problem: test observable tutoring decisions in context, show where a Tutor
failed, and keep the result reproducible enough to retest after a change.

## What is in the repository

| Layer | What it does | Status |
| --- | --- | --- |
| **Tutor Health** | Measures how well a Tutor teaches in concrete learner scenarios, with Findings, a Release Gate and regression targets | Core product; 13-scenario suite, 5 of 7 dimensions covered |
| **TutorEval** | The canonical 48-case benchmark (24 English + 24 zh-CN, five subjects) with deterministic checks and optional Judge providers | Measurement foundation |
| **Case System vNext** | Designs which tutoring situations and capabilities should be tested | Experimental, non-canonical |
| **Evaluator Stress / Expert Review** | Checks whether TutorBench's own evaluators and expectations can be trusted | Reviewer-ready; no expert labels yet |
| **Mastery / Transfer / Teach-back** | Explores whether learners develop usable, transferable understanding | Experimental; no causal claims |
| **Community Review** | Protocol and service for future independent human review | Built; public intake closed |

The core flow is:

```text
Scenario -> TutorUnderTest -> Tutor output -> evaluator/Judge -> result -> report
```

## Five-minute start

```bash
git clone https://github.com/shuangyan123/tutorbench.git
cd tutorbench
npm ci
npm run quickstart
```

Quickstart needs no API key, network or Judge. It runs four fixed demo cases;
one bundled response is intentionally weak so you can see a clear `FAIL`. It is
a demonstration, not an official score. Details:
[`docs/quickstart.md`](docs/quickstart.md).

## Choose your path

| I want to… | Start here |
| --- | --- |
| Evaluate my Tutor from TypeScript | [Use your Tutor](docs/repository-reference.md#use-your-tutor) |
| Evaluate a Tutor in any language over HTTP | [Use any language](docs/repository-reference.md#use-any-language) |
| Run Tutor Health on a product | [Run a Tutor Health evaluation](docs/repository-reference.md#run-a-tutor-health-evaluation) · [finding-first model](docs/real-world-finding-first-evaluation.md) |
| Run the canonical benchmark | `npm run benchmark` · [TutorEval 0.2A](docs/tutor-eval-v0.2a.md) |
| Collect real-model evidence | [Real-model baselines](docs/real-model-baselines.md) |
| Run a private design-partner pilot | [Design Partner Pilot Boundary](docs/design-partner-pilot.md) |
| Understand the methodology | [Documentation index](docs/README.md) |

## Install channels

| Channel | Runtime | Available surface |
| --- | --- | --- |
| Published `tutor-benchmark@0.1.0` | Node 22 (`>=22 <23`) | Quickstart, TutorEval/HTTP evaluation and historical diagnostic CLI |
| Repository `main` | Node 24 (`>=24 <25`) | Current source, including Tutor Health, Scenario vNext and Community Review contracts |

The repository still declares version `0.1.0`, but its payload is newer than
the published tarball. Tutor Health is only available from the repository
build. See [release channels](docs/release.md#installation-channels).

## Use your Tutor

```ts
import { runTutorBenchmark, type TutorUnderTest } from "tutor-benchmark";

const tutor: TutorUnderTest = {
  id: "my-tutor",
  async respond(input) {
    return { text: await myTutor(input.currentStudentMessage) };
  },
};

const result = await runTutorBenchmark({ tutor });
```

`TutorUnderTest` receives only Tutor-visible input. Hidden ground truth,
misconceptions, disclosure policies and rubrics stay on the evaluator side.
Any language can implement the same boundary over HTTP (`POST /respond`); see
[`examples/http-python-tutor/`](examples/http-python-tutor/) and the
[repository reference](docs/repository-reference.md#use-any-language).

## What TutorBench does not claim

- The Tutor Health suite is an authored synthetic design artifact. It covers
  5 of 7 health dimensions and says so; it is not a validated general measure
  of tutor quality or learner outcomes.
- Deterministic checks are observable proxies, not a full measure of teaching
  quality. Without a Judge, Judge-owned criteria stay unresolved instead of
  passing silently.
- No independent expert labels exist yet, and nothing here claims to raise exam
  scores or cause learning gains.
- Community Review public intake is closed and no real reviewer campaign has
  started. There are no public model rankings.

## Data and privacy

Commit only synthetic, public, properly licensed, or reviewed anonymized
evaluation assets. Never add real chats, production exports, credentials,
cookies, private prompts, database dumps, or identifiable data. Real partner
scenarios and artifacts stay private.

## Website

[teachometry.com](https://teachometry.com) is built from this repository with
`npm run website:build` and deployed from `main` through GitHub Pages. It
consumes only secret-free public artifacts. See the
[website guide](website/README.md).

## Development

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run benchmark
npm run website:build
npm run test:package
npm run test:website
npm run release:verify
git diff --check
```

Repository rules for contributors and coding agents are in
[`AGENTS.md`](AGENTS.md). Phase status is in the [roadmap](docs/roadmap.md).

## License and governance

TutorBench is a multi-licensed public Developer Preview:

- Software code — [Apache-2.0](LICENSE).
- Benchmark, dataset, and authored evaluation content — [CC BY 4.0](LICENSES/CC-BY-4.0.txt).
- TutorBench name and brand assets — [TutorBench Brand Policy](LICENSES/BRAND-POLICY.md).

The [licensing scope](docs/licensing.md) explains mixed files, generated
artifacts, and attribution. Contribution and safety entry points are the
[contribution guide](CONTRIBUTING.md), [Code of Conduct](CODE_OF_CONDUCT.md),
and [Security Policy](SECURITY.md). The short machine-readable scope map is
[`LICENSES.md`](LICENSES.md).
