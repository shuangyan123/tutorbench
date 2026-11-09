# Documentation index

Every document in `docs/`, grouped by topic. Titles are the documents' own headings.
For the project overview, start with the [README](../README.md); for the full
repository guide, see the [repository reference](repository-reference.md).

Contents: [Start here](#start-here) · [Methodology and measurement claims](#methodology-and-measurement-claims) · [TutorEval versions](#tutoreval-versions) · [Evaluator integrity and audits](#evaluator-integrity-and-audits) · [Judges and real-model runs](#judges-and-real-model-runs) · [Human reference and calibration](#human-reference-and-calibration) · [Case System vNext (experimental)](#case-system-vnext-experimental) · [Mathematics knowledge and exams](#mathematics-knowledge-and-exams) · [Research notes](#research-notes) · [Community Review](#community-review) · [Design-partner pilots](#design-partner-pilots) · [Public site and publication](#public-site-and-publication)

## Start here

New to TutorBench? Read these first.

- [TutorBench Quickstart](quickstart.md)
- [TutorBench repository reference](repository-reference.md)
- [Release and Public Delivery](release.md)
- [TutorBench v0.1.0 — Developer Preview](releases/v0.1.0.md)
- [Roadmap](roadmap.md)
- [TutorBench licensing and scope](licensing.md)
- [npm publication and Trusted Publishing (P2B / H1A)](npm-publishing.md)

## Methodology and measurement claims

What TutorBench measures and what it is allowed to claim.

- [TutorBench Measurement Claim Specification](measurement-claim-specification.md)
- [Tutor Benchmark Product Boundary](benchmark-product-boundary.md)
- [Architecture integration ledger — source ownership and traceability v0.1](architecture-integration-ledger-v0.1.md)
- [TutorBench Real-World Evaluation / Finding-First Model](real-world-finding-first-evaluation.md)
- [Prerequisite-Aware Teaching Evaluation — Experimental Pilot](prerequisite-aware-teaching-evaluation.md)
- [TutorEval scoring provenance](scoring-provenance.md)
- [Statistics and signal availability](statistics-evidence-semantics.md)
- [Canonical TutorEval rubric authoring QA](rubric-authoring-qa.md)
- [TutorEval bilingual cohort design](tutor-eval-bilingual-cohorts.md)
- [TutorEval cross-locale semantic audit](cross-locale-semantic-audit.md)

## TutorEval versions

The canonical benchmark, one document per version.

- [TutorEval v0.1](tutor-eval-v0.1.md)
- [TutorEval 0.2A — Rubric and Dataset Design](tutor-eval-v0.2a.md)
- [TutorEval v0.2B — Rubric Review and Calibration Infrastructure](tutor-eval-v0.2b.md)
- [TutorEval 0.3A — Hybrid Evaluation Orchestration](tutor-eval-v0.3a.md)
- [TutorEval 0.3B: Real Judge Provider Integration](tutor-eval-v0.3b.md)
- [Tutor Benchmark 0.4A.2: Portable Baseline Generation Profile](tutor-eval-v0.4a.md)
- [Tutor Benchmark 0.4A.3: Case Locale and Local Audit Views](tutor-eval-v0.4a.3-locale.md)
- [AI Tutor Judge v0.1](ai-tutor-judge-v0.1.md)

## Evaluator integrity and audits

Checks on TutorBench's own scoring.

- [TutorEval result source integrity](tutor-eval-result-integrity.md)
- [Insufficient-information validity contract (TB-A02)](tutor-eval-insufficient-information.md)
- [TB-A01 + TB-A02 evidence boundary](tutor-eval-evidence-boundary-integration.md)
- [TutorEval Disclosure and Critical-Failure Semantics Audit](tutor-eval-disclosure-critical-semantics-audit.md)
- [Critical-failure quality-gate audit](critical-failure-quality-gate-audit.md)
- [Preliminary manual leakage audit](tutor-eval-manual-leakage-audit.md)
- [Deterministic Verifier Audit and Hardening](deterministic-verifier-audit.md)
- [Upstream HTTP response limits (TB-SEC-03)](upstream-http-response-limits.md)
- [TutorBench Evaluation Framework Research Audit — 2026-09](audits/evaluation-framework-research-audit-2026-09.md)

## Judges and real-model runs

Judge providers, model evidence and replay.

- [Real-model baseline collection](real-model-baselines.md)
- [First real bilingual Tutor baseline](first-real-baseline.md)
- [Frozen Corpus Semantic Replay](frozen-corpus-semantic-replay.md)
- [Judge candidate comparison](judge-candidate-comparison.md)
- [Judge word-context discrimination diagnostic](judge-word-context-discrimination.md)
- [Material Requirement Judge calibration experiment](material-requirement-judge-calibration.md)
- [NV-02 offline browser regression](canonical-host-nv02-verification.md)
- [Review Translation Layer](review-translation.md)
- [Tutor-response pairwise prototype](tutor-response-pairwise-prototype.md)
- [Evidence-bearing programming prototype](evidence-bearing-programming-prototype.md)

## Human reference and calibration

Infrastructure for comparing against human reviewers. No real reviewer data yet.

- [TutorEval Human Critical-Failure Calibration Contract](tutor-eval-critical-failure-calibration.md)
- [Canonical TutorEval Human Calibration Pilot Readiness](canonical-human-calibration-pilot.md)
- [Material atomic human-reference calibration](human-reference-calibration.md)
- [R5 real human-reference pilot operations](r5-human-reference-operations.md)
- [R5-C1 English-only human-reference fallback pilot](r5-english-only-human-reference-pilot.md)
- [R5-C2 English-only pilot executable boundary](r5-c2-english-only-pilot-execution.md)

## Case System vNext (experimental)

How future cases are designed and stress-tested.

- [Case System vNext — Methodology Specification](case-system-vnext.md)
- [Case System vNext — Domain Coverage Matrix](case-system-vnext-coverage-matrix.md)
- [Case System vNext — Evaluator Stress Test](case-system-vnext-evaluator-stress.md)
- [Case System vNext — Independent Expert Review Protocol](case-system-vnext-expert-review.md)
- [Case System vNext — Mastery & Transfer Positioning](case-system-vnext-mastery-transfer.md)

## Mathematics knowledge and exams

Knowledge maps and exam-system reviews, several in Chinese.

- [Mathematics Knowledge Structure & Case Expansion — 2026-10 v0.1](mathematics-knowledge-system-v0.1.md)
- [TutorBench 数学知识体系：中文版逐节点审查稿 v0.1](mathematics-knowledge-system-zh-cn-v0.1.md)
- [面向考试要求的数学知识体系与案例设计（中文版 v0.1）](mathematics-exam-oriented-zh-cn-v0.1.md)
- [国内考研与国际数学考试体系对照（中文版 v0.2）](mathematics-global-exam-systems-zh-cn-v0.2.md)
- [TutorBench 数学教学案例中文逐项审查稿（20 个）v0.2.0](mathematics-cases-review-zh-cn-v0.2.md)
- [International mathematics review — localisation hub](math-locales/README.md)

## Research notes

Isolated research pilots and contracts. They do not change the canonical benchmark.

- [Exact complete solution sets: absolute values, radicals and finite piecewise branches](research/abs-radical-piecewise-solution-sets-v0.1.md)
- [Immutable third-party examination artifact identity — research v0.1](research/pinned-exam-artifact-identity-v0.1.md)
- [Mathematical wrong-answer detection and supported-type coverage (research v0.1)](research/math-wrong-answer-detection-v0.1.md)
- [DeepSeek Flash 25-question real-response math-verifier pilot (research v0.1)](research/deepseek-flash-25-math-real-response-pilot-v0.1.md)
- [Stage II: natural mathematical answers and paired DeepSeek reasoning (research v0.1)](research/real-natural-math-holdout-stage-ii-v0.1.md)
- [Stage II: external Math-Verify parsing baseline before rebuilding parsers](research/math-verify-baseline-stage-ii.md)
- [Controlled problem-statement to exact mathematics evidence chain (research v0.1)](research/controlled-statement-math-evidence-chain-v0.1.md)
- [Parameterized circle–line intersection-count partitions (research v0.1)](research/parametric-circle-line-classification-v0.1.md)
- [Dual-path answer verification: published reference vs. no-reference candidate](research/dual-path-math-answer-evidence-v0.1.md)
- [Exact circle–line intersection point sets (research v0.1)](research/circle-line-intersections-v0.1.md)
- [Exact rational transformation semantics: definedness, solution sets and counterexamples](research/exact-rational-transformation-semantics-v0.1.md)
- [2022–2026 mathematics examination reference-verification pilot](research/exam-math-real-paper-verification-pilot-2026-11-02.md)
- [Multi-source examination answer adjudication — research v0.1](research/exam-multisource-answer-adjudication-v0.1.md)
- [Expanded real-examination mathematics source catalog — research v0.1](research/expanded-exam-math-corpus-v0.1.md)
- [Bounded exact arithmetic–geometric sequence sums (research v0.1)](research/finite-arithmetic-geometric-sum-v0.1.md)
- [One complete mathematical task family: finite uniform occupancy](research/finite-occupancy-family-contract-v0.1.md)
- [2025 Gaokao National I, Question 14 — complete numeric-answer verification](research/gaokao-2025-q14-complete-answer-v0.1.md)
- [Learner Starting Points, Attainable Capability and Avoidable Learning Cost — v0.1](research/learner-starting-point-and-learning-cost-v0.1.md)
- [Deterministic math reference verification — isolated research pilot](research/math-deterministic-reference-extraction-v0.1.md)
- [Complete parameter-dependent quadratic inequality solution families](research/parameter-affine-quadratic-inequalities-v0.1.md)
- [Complete real-root classification for a parameter-dependent quadratic family](research/parameter-affine-quadratic-real-roots-v0.1.md)
- [Exact complete parameter-dependent rational inequalities: original poles are never cancelled](research/parameter-rational-linear-fractions-v0.1.md)
- [Complete real solution sets for bounded quadratic rational equations and inequalities](research/quadratic-rational-signsets-v0.1.md)
- [Typed symbolic result comparison — research contract 0.1](research/typed-symbolic-verifier-contract-v0.1.md)
- [Pedagogical Principles Research](research/pedagogical-principles/README.md)

## Community Review

The future independent human-review track. Public intake is closed.

- [Community Review Protocol P3](community-review-protocol.md)
- [Community Review Service P4-A / P4-B / P4-C / P4-D / P4-E / P4-F / P4-G](community-review-service.md)
- [TutorBench Community Review Service Deployment Runbook](community-review-deployment.md)
- [L1 Private Staging Deployment / Launch Gate](community-review-staging-gate.md)
- [Community Review Participation Application Contract / Launch Gate](community-review-application-gate.md)
- [L2-C2D Public Exposure Hardening / Pre-Launch Gate](community-review-public-exposure-gate.md)
- [External Abuse-Control Architecture Decision](community-review-edge-abuse-control-decision.md)
- [L2-C3B Reviewer Invitation and Backend Authority Gate](community-review-reviewer-invitation-gate.md)
- [Invite-only Reviewer Portal Architecture](community-review-reviewer-portal-architecture.md)
- [L2-C3C Reviewer Portal Auth Gate](community-review-reviewer-portal-auth-gate.md)

## Design-partner pilots

Private pilots with real products.

- [Design Partner Pilot Boundary](design-partner-pilot.md)
- [Design Partner Pilot Spec Template](design-partner-pilot-spec-template.md)
- [Design Partner Scenario Intake Template](design-partner-scenario-intake-template.md)
- [Design Partner Report Data Map](design-partner-report-data-map.md)

## Public site and publication

- [Public Evidence Publication Pipeline v1](public-evidence-publication.md)
- [Micro-Review promotion experiment v1](micro-review-experiment.md)
- [Website guide](../website/README.md)

The per-locale mathematics reviews and the individual pedagogical principles are
linked from their hub pages above.
