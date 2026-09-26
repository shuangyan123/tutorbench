export const CASE_SYSTEM_VNEXT_TEACHING_OBJECTIVE_SCHEMA_VERSION = 1 as const;

export const CASE_SYSTEM_VNEXT_TEACHING_OBJECTIVE_MODES = [
  "learning_oriented",
  "exam_oriented",
] as const;

export type CaseSystemVNextTeachingObjectiveMode =
  (typeof CASE_SYSTEM_VNEXT_TEACHING_OBJECTIVE_MODES)[number];

export interface CaseSystemVNextTeachingObjectiveCriterion {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface CaseSystemVNextTeachingObjectiveProfile {
  readonly schemaVersion: typeof CASE_SYSTEM_VNEXT_TEACHING_OBJECTIVE_SCHEMA_VERSION;
  readonly id: string;
  readonly mode: CaseSystemVNextTeachingObjectiveMode;
  readonly label: string;
  readonly description: string;
  readonly criteria: readonly CaseSystemVNextTeachingObjectiveCriterion[];
  readonly constraints: readonly string[];
  readonly nonGoals: readonly string[];
}

export type CaseSystemVNextAssessmentTimePressure =
  | "low"
  | "moderate"
  | "high";

export interface CaseSystemVNextAssessmentContext {
  readonly examFamily: string;
  readonly questionType: string;
  readonly scoringPolicy: string;
  readonly timePressure: CaseSystemVNextAssessmentTimePressure;
  readonly timeBudgetMinutes?: number;
  readonly allowedTools: readonly string[];
  readonly syllabusBoundary: readonly string[];
  readonly requiredWork: readonly string[];
}

export interface CaseSystemVNextTeachingObjectiveSelection {
  readonly mode: CaseSystemVNextTeachingObjectiveMode;
  /**
   * Required for exam-oriented evaluation and forbidden for learning-oriented
   * evaluation so exam constraints are explicit rather than guessed.
   */
  readonly assessmentContext?: CaseSystemVNextAssessmentContext;
}

export const CASE_SYSTEM_VNEXT_TEACHING_OBJECTIVE_PROFILES = [
  {
    schemaVersion: CASE_SYSTEM_VNEXT_TEACHING_OBJECTIVE_SCHEMA_VERSION,
    id: "learning-oriented-v0.1",
    mode: "learning_oriented",
    label: "Learning-oriented",
    description:
      "Optimize tutoring for durable understanding, repair of misconceptions, learner independence, and justified transfer rather than short-horizon score maximization.",
    criteria: [
      {
        id: "conceptual-understanding",
        label: "Conceptual understanding",
        description:
          "The response helps the learner understand the governing concept or structure instead of only reproducing a procedure.",
      },
      {
        id: "reasoning-transparency",
        label: "Reasoning transparency",
        description:
          "Important reasoning moves are inspectable and compatible with the learner's prerequisites.",
      },
      {
        id: "misconception-repair",
        label: "Misconception repair",
        description:
          "When a misconception is evidenced, the response repairs the underlying model rather than only correcting the current answer.",
      },
      {
        id: "generalization-transfer-support",
        label: "Generalization and transfer support",
        description:
          "When appropriate, the response exposes reusable structure and prepares the learner to handle meaningfully changed tasks.",
      },
      {
        id: "learner-independence",
        label: "Learner independence",
        description:
          "The response supports future independent reasoning rather than creating unnecessary dependence on the Tutor.",
      },
    ],
    constraints: [
      "Shared base criteria and domain/task strategy constraints remain binding.",
      "Longer explanations are not automatically better; added material must serve the learning target.",
      "A learning-oriented profile does not require maximal depth when the authored learner state or task target does not call for it.",
    ],
    nonGoals: [
      "No claim that conceptual depth always requires the longest solution.",
      "No assumption that exam performance is irrelevant; it is simply not the primary optimization target in this mode.",
    ],
  },
  {
    schemaVersion: CASE_SYSTEM_VNEXT_TEACHING_OBJECTIVE_SCHEMA_VERSION,
    id: "exam-oriented-v0.2",
    mode: "exam_oriented",
    label: "Exam-oriented",
    description:
      "Optimize tutoring for reliable, legal score production under an explicit assessment context by building score-relevant concept and problem-family mastery, supporting transfer to legitimate variants, and preserving correctness, domain validity, and learner-appropriate reasoning.",
    criteria: [
      {
        id: "concept-method-mastery",
        label: "Concept and method mastery",
        description:
          "The response helps the learner reliably recognize and execute the concept or method needed for the assessed problem family rather than memorizing one surface form.",
      },
      {
        id: "problem-family-transfer",
        label: "Problem-family transfer",
        description:
          "The response prepares the learner to handle legitimate variants of the assessed problem type when the scoring objective depends on recognizing the same underlying structure under changed surface details.",
      },
      {
        id: "assessment-rule-compliance",
        label: "Assessment-rule compliance",
        description:
          "The strategy obeys the stated syllabus, allowed-tool, required-work, and question-format constraints.",
      },
      {
        id: "score-reliability",
        label: "Score reliability",
        description:
          "The response favors methods that are robust under the stated scoring policy rather than merely short or clever.",
      },
      {
        id: "time-efficiency",
        label: "Time efficiency",
        description:
          "The visible method uses assessment time efficiently without sacrificing required reasoning or correctness.",
      },
      {
        id: "marking-point-alignment",
        label: "Marking-point alignment",
        description:
          "Where process or partial credit matters, the response surfaces the work that the stated scoring policy requires.",
      },
      {
        id: "error-resistance",
        label: "Error resistance",
        description:
          "The strategy controls common avoidable mistakes and does not trade reliability for fragile shortcuts.",
      },
      {
        id: "verification-efficiency",
        label: "Verification efficiency",
        description:
          "The response uses a fast, assessment-legal check when such a check materially improves score reliability.",
      },
    ],
    constraints: [
      "Shared base criteria and domain/task strategy constraints remain binding.",
      "Exam orientation never licenses a false explanation, an out-of-syllabus method, prohibited tools, or fabricated evidence.",
      "Test-taking shortcuts are acceptable only when they are legal in the stated assessment context and do not contradict the task's required reasoning.",
    ],
    nonGoals: [
      "No reward for brittle test gaming, leaked answer patterns, or memorized dataset artifacts.",
      "No assumption that the shortest method maximizes expected score.",
      "No claim that these response-level proxies demonstrate durable mastery, causal learning gain, or actual score improvement without longitudinal learner and assessment evidence.",
    ],
  },
] as const satisfies readonly CaseSystemVNextTeachingObjectiveProfile[];

export function getCaseSystemVNextTeachingObjectiveProfile(
  mode: CaseSystemVNextTeachingObjectiveMode,
): CaseSystemVNextTeachingObjectiveProfile {
  const profile = CASE_SYSTEM_VNEXT_TEACHING_OBJECTIVE_PROFILES.find(
    (candidate) => candidate.mode === mode,
  );
  if (profile === undefined) {
    throw new Error("Unknown Case System vNext teaching objective mode.");
  }
  return profile;
}
