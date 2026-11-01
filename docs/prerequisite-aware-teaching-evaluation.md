# Prerequisite-Aware Teaching Evaluation — Experimental Pilot

Status: **synthetic authoring proposal; non-canonical; not human-validated**.

This pilot explores **prerequisite-sensitive instructional adaptation**: a Tutor should adapt explanations to what the learner has actually demonstrated, recognize when a term inside its own explanation is inaccessible, and fade scaffolding after locally evidenced progress. It is **not** a claim about measured learning gains or verified mastery.

## Principles and observable evidence

- **Start from the learner's evidence, not a presumed deficit.** An incorrect answer alone does not establish why the learner is wrong. A targeted diagnostic question or concise safe correction may both be appropriate.
- **Explain the explanation's prerequisites.** If a learner says "What does 'a whole' mean?", the Tutor should explain the chosen whole in concrete language rather than merely repeating "whole".
- **Use representations only when they help.** Paper, pizzas, equal parts, equivalent fractions, and counterexamples are possible strategies; no one metaphor is universally mandatory.
- **Make a meaningful next step available.** Accessible instruction differs from maximal simplification, excessive questioning, or withholding.
- **Fade support after local evidence of understanding.** A successful paraphrase supports moving to the next prerequisite; it does not prove durable mastery.
- **Distinguish evidence of a specific misconception from uncertainty about its cause.** Only reference evidenced reasoning when making specific diagnoses.

## Synthetic contrast suite

File: `scenarios/experimental/prerequisite-aware-instruction-v0.1/suite.json`.

| ID | Visible signal | Tested decision |
| --- | --- | --- |
| `pai-unknown-cause` | Student provides only wrong result 2/7 | Correct result without inventing the cause |
| `pai-whole-undefined` | Student explicitly asks what "a whole" means | Explain prerequisite in familiar terms |
| `pai-rule-misconception` | Student states incorrect numerator/denominator rule | Address the expressed rule through counterexample or comparison |
| `pai-after-progress` | Student paraphrases "whole" then asks about equal parts | Fade old explanation and move to next question |
| `pai-known-foundation` | Student demonstrates meaning of whole and equal parts | Avoid unnecessary re-teaching; scaffold common-sized units |

Each case uses the established Scenario vNext schema and two atomic, Judge-owned criteria with the existing scoring categories; it intentionally does **not** add a new category, alter weights, or modify frozen TutorEval cases.

## Validation and interpretation boundary

This experimental file is loaded explicitly by tests through `parseTutorScenarioSuiteVNext` and `tutorScenarioSuiteToTutorEvalDataset`. It is not added to the canonical dataset registry, standard benchmark score, Tutor Health aggregate, public leaderboard, or production partner pipeline.

A parser-valid fixture only establishes **contract compatibility**. It does not establish that Judge rubrics are reliable, that two responses are pedagogically equivalent, or that students actually learned. The current checks validate:

1. Case and rubric identities, decision-point structure, and existing score dimensions.
2. The Tutor-visible / evaluator-only firewall, especially hiding the wrong-rule reference.
3. The contrast between unknown cause, evidenced misconception, missing term, and local progress.
4. No duplicated criterion IDs, no unapproved new scoring dimensions, and no automatic promotion to canonical metrics.

### Next steps before promotion

- Obtain independent review of the learner-state assumptions and acceptable alternative explanations.
- Run blinded, repeated Judge assessments including paraphrases and adversarial counterexamples.
- Compare Judge decisions to independent human annotations and resolve disagreements.
- Only then consider whether to include the capability within versioned public evaluation suites.

## Partner separation

These scenarios are TutorBench-authored synthetic examples derived from general teaching questions. They contain no Guided internal prompts, confidential product details, private student data, or partner-specific targets. Any future Guided-specific policy or evidence must remain in separately authorized private partner material.
