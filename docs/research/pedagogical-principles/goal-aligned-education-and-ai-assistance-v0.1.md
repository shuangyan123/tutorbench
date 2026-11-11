# Goal-Aligned Education and AI Assistance — v0.1

**Status:** candidate, non-canonical research and product-direction record (2026-11-11).  
**Scope:** case authoring and hypotheses. No new TutorEval score, Tutor Health criterion, runner gate, validated pedagogy, learner outcome, or claim of market impact.

This record turns the 2026-11-10 discussion into **versioned TutorBench source material**. It deliberately reuses the existing [pedagogical research index](README.md), [Case System vNext objective profiles](../../case-system-vnext.md#12-teaching-objective-profiles), and [Learner Starting Points / Learning Cost hypothesis](../learner-starting-point-and-learning-cost-v0.1.md). The companion [authored contrast protocol](../../../scenarios/experimental/goal-aligned-assistance-v0.1/contrasts.json) and parser tests make the new distinctions inspectable.

## Core proposition / 核心命题

**中文：** 考试、长期学习与开放探索可以相互支持，不应被统一成“只求分数”或“必须不依赖 AI”的单一目标。真正的教育进步既包括在既定约束中发挥已有能力，也包括借助可靠工具进入原本无法探索的问题。

**English:** Exam performance can rest on understanding and still require extra exam-specific strategy. Open learning can go beyond a fixed syllabus. Direct AI conclusions can either obstruct a *specified independent attempt* or enable legitimate tool-augmented inquiry. The correct decision depends on the authored goal, tool/disclosure rules and evidence target—not an unconditional ban on answers.

## Registry crosswalk: reuse before inventing

Working labels **G01–G12 are not P-series principle IDs and are not scored constructs.** A principle moves into executable grading only after an atomic observable distinction, authoring review, independent adjudication, and evidence of construct validity within an approved scope.

| Working goal | Proposed direction | Existing owner / disposition |
| --- | --- | --- |
| G01 · Social value beyond rank | Distinguish a student's positional admission benefit from newly created learning capacity | Product/program evaluation; **not a Tutor-response rating** |
| G02 · Lower cost, better teaching | Compare cost at a *fixed and measured* learning target; neither lower price nor higher score alone establishes quality | [Learner Starting Points / Learning Cost](../learner-starting-point-and-learning-cost-v0.1.md); product economics outside TutorEval |
| G03 · Starting point is not destiny | Adapt support to evidenced prerequisites without assuming a fixed ability ceiling | Existing learner-path hypothesis; [P-002, P-003, P-005](README.md) |
| G04 · Learning is an exam foundation | Concept and method mastery can support exam reliability; exam strategies add time, rules and problem-family demands | Existing `learning_oriented` and `exam_oriented` profiles; **not new competing scores** |
| G05 · Match time and rules | A near-term, closed-book exam may prioritize reliable legal score-relevant steps | Existing exam `assessmentContext`; [Case System vNext](../../case-system-vnext.md#12-teaching-objective-profiles) |
| G06 · Open inquiry beyond syllabi | Allow learner-driven cross-domain questions, research synthesis and evolving prerequisites | Optional `learningContext.intent=open_inquiry`, still under `learning_oriented` |
| G07 · Assistance is goal-dependent | Withhold a target step for an independent attempt when required; **allow explicit AI conclusions** when the task permits | Optional `learningContext.assistancePolicy`; existing case-specific disclosure boundary |
| G08 · Distinguish abilities | Do not equate uncued individual performance with tool-augmented task completion; both may be valuable | `learningContext.outcomeEvidence`; [measurement claim specification](../../measurement-claim-specification.md) |
| G09 · Verify conclusions | AI-generated scientific syntheses/hypotheses need sources, uncertainty, disconfirming checks, and subject-specific evidence standards | `learningContext.verificationPlan`; domain evidence rules |
| G10 · Respect learner agency | Help people choose their own exams, fields, projects and life goals; avoid permanent labels from temporary failure | Existing learner-state/adaptation research; new open-inquiry contrast |
| G11 · Educational value ≠ industry profit | Research tutoring gains, distributional equity, cost and spillovers; avoid unsupported “most tutoring firms profiteer” claims | Empirical *sector-level* study only; **no model score** |
| G12 · Revenue is a means, not a goal | Exam preparation can fund a wider learning product, but must not be assumed to lead there automatically | Teachometry roadmap/strategy; **not a model score** |

This is one connected framework, **not twelve independent rubric penalties**. Only G06–G09 add new authorable distinctions. Other items are reused or assigned to a different evidence owner.

## Applied contract: intentional assistance, not blanket answer avoidance

The existing [teaching-objective contract](../../../src/contracts/case-system-vnext-teaching-objective.ts) keeps its two original modes:

- `exam_oriented`: requires explicit `assessmentContext` (exam family, time, tools, rules, scoring). Closed-book constraints still govern what the learner may use. Studying *for* an exam with AI is different from using AI *during* a forbidden assessment.
- `learning_oriented`: retains backward compatibility and may optionally attach **`learningContext`**:
  - `intent`: `concept_mastery` or `open_inquiry`;
  - `assistancePolicy`: `guided_attempt` or `direct_conclusions_permitted`;
  - `permittedTools`: explicit list (an empty list does **not** prohibit the tutor's own explanation);
  - `outcomeEvidence`: `independent`, `tool_augmented` or `both`;
  - `successCondition`: the declared observable task outcome;
  - `verificationPlan`: how externally derived claims can be checked (required for `open_inquiry` + `direct_conclusions_permitted`).

**Permission is not compulsion.** `direct_conclusions_permitted` means a direct conclusion is not automatically answer leakage; it does not mean every response must reveal an answer. Accuracy, intellectual honesty, safety, domain evidence, disclosure constraints and the learner's actual request still govern.

**Independence is scoped.** In an uncued fraction-mastery check, a supplied sum cannot be counted as the learner's unaided accomplishment. In research, citing an AI-derived model or letting AI compute a well-defined intermediate step can be a valid way to access a harder question. Neither task should be graded under the other's evidentiary rules.

**Tool-augmented is not automatically research-quality evidence.** An AI-generated hypothesis must be labeled as such. Medical/scientific results require domain-appropriate verification, not the tutor's confidence or a persuasive narrative.

## Authored contrast cases

[Contrast set v0.1](../../../scenarios/experimental/goal-aligned-assistance-v0.1/contrasts.json) contains **synthetic, bounded teaching-decision examples**. No case is a transcript, real learner observation, Judge output, or validation of improved learning.

The important distinction is a **legitimate preference reversal**:

1. Same underlying fraction arithmetic, **concept-mastery task**: the learner is expected to attempt the sum unaided; directly supplying the final result before the attempt misses the task.
2. Same fraction as a quantity inside an **open inquiry task**: the learner needs the numerical quantity to investigate a different question; directly supplying the sum *with justification* can enable progress.

Other cases cover exam time limits, human-only versus AI-allowed evidence, supported biological research claims and personal-goal autonomy. An evaluator must justify any preference with the *task target*, not “shorter is better”, “more detail is better”, or “more independent is always better”.

### Case author checklist

1. State the learner's **current goal**, evidence of prior knowledge and time/assessment boundary. Do not infer a person's permanent intelligence from one error.
2. State which answer or intermediate step the learner is meant to do versus may receive. Distinguish practice, formal assessment and open inquiry.
3. State the allowed tools, source trust, verification step, and the outcome evidence type. Never score a tool-produced result as uncued learner output.
4. Select **one primary observation owner** among existing Diagnosis, Guidance, Adaptation, Correctness, Actionability and domain norms. Do not turn a single mistake into repeated rubric penalties.
5. Record at least one counterexample or legitimate context-dependent reversal. Mark unknown judgments as unknown.
6. Treat a correct tutor response, student examination score, durable learning, augmented project completion and social spillover as **separate measurements**.

## Evidence / validation plan

| Claim | Correct source of evidence | Not sufficient |
| --- | --- | --- |
| Task-aware help changes appropriateness of a Tutor response | Blind reviewer comparisons of the same problem under different explicitly authored goal/disclosure constraints | Author preference alone; stable Judge agreement alone |
| AI gives sound scientific conclusions | Source and claim audit, domain expert verification, reproducible reasoning or experiment when appropriate | Fluency or model confidence |
| Student learned independently | Genuine uncued learner work at baseline, novel tasks and delayed follow-up | AI-assisted answer; scenario rubric PASS |
| Learner accomplished more with tools | Reproducible task artifacts and authorized tool-use trace, with relevant external outcome checks | Prior unassisted test result |
| Exam assistance lowers cost while retaining learning quality | Controlled comparison at similar learner starting points, including fees, time and achieved outcomes | Lower nominal subscription price |
| Industry tutoring creates net social benefits or rents | Representative causal, financial and distributional evidence, with selection and opportunity costs addressed | An individual success story or high sticker price |
| Cross-disciplinary inquiry creates discoveries | Longitudinal work, subject-matter verification and real outputs; allow null results | Synthetic dialogue or ambitious roadmap |

### Change boundary

This record **does not** alter frozen TutorEval or Tutor Health, scoring weights, CASE_SYSTEM_VNEXT_TEACHING_OBJECTIVE_SCHEMA_VERSION, historical profile IDs, existing fixtures, any public claims, or proprietary commercial strategy. The optional learning context is backward compatible and experimental. Promotion to a new official objective mode, criterion or public evidence claim needs independent review and a separately versioned change.

The next experiment should blind reviewers to preferred answers and compare the authored context-sensitive examples. If reviewers cannot reliably distinguish permissible direct conclusions from answer leakage, revise the construct before adding more scenarios or scores.
