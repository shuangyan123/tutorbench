import { isDeepStrictEqual } from "node:util";
import { toTutorTurnInput } from "../contracts/tutor-eval.js";
import type { HintPilotCase } from "./learner-evidence-hint-scenarios.js";
import type { evaluateHintFit } from "./learner-evidence-hint-rubric.js";
import { summarizeHintMeasurement } from "./learner-evidence-hint-measurement.js";
import { measurementFingerprint } from "./measurement-reliability-source.js";

type Response = { readonly id: string; readonly text: string };
type Decision = ReturnType<typeof evaluateHintFit>["verdict"];
type Label = Decision | null;

export function buildHintReviewPacket(cases: readonly HintPilotCase[], responses: readonly Response[]) {
  const fingerprints = responses.map(({ text }) => measurementFingerprint(text.trim()));
  if (cases.length !== 3 || new Set(cases.map(({ condition }) => condition)).size !== 3 ||
      responses.length === 0 || responses.some(({ id, text }) => !/^r\d{2}$/u.test(id) || !text.trim()) ||
      new Set(responses.map(({ id }) => id)).size !== responses.length ||
      new Set(fingerprints).size !== responses.length) {
    throw new Error("hint_held_out_inputs_invalid");
  }
  // 评审只看可见对话及逐字来源，避免把状态标签或判定理由带进人工参考。
  const tasks = responses.flatMap((response, index) =>
    cases.map((_, offset) => {
      const pilotCase = cases[(index + offset) % cases.length]!;
      const input = toTutorTurnInput(pilotCase.tutorCase);
      return {
        unitId: `h${String(index * cases.length + offset + 1).padStart(2, "0")}`,
        responseId: response.id,
        caseId: input.caseId,
        caseVersion: input.caseVersion,
        learningObjective: input.learningObjective,
        learnerEvidence: [...input.conversation, { role: "student", text: input.currentStudentMessage }],
        tutorReply: response.text,
      };
    })).sort(({ unitId: left }, { unitId: right }) =>
    measurementFingerprint(left).localeCompare(measurementFingerprint(right), "en"));
  const packet = { id: "learner-evidence-hint-held-out", version: "0.1.0", tasks };
  return { ...packet, fingerprint: measurementFingerprint(packet) };
}

export type HintReviewPacket = ReturnType<typeof buildHintReviewPacket>;

export function summarizeHintReviewPacket(packet: HintReviewPacket, cases: readonly HintPilotCase[]) {
  const count = (tasks: HintReviewPacket["tasks"]) => ({
    uniqueReplies: new Set(tasks.map(({ responseId }) => responseId)).size,
    plannedPairJudgments: tasks.length,
  });
  return {
    overall: count(packet.tasks),
    byCondition: Object.fromEntries(cases.map(({ condition, tutorCase }) => [
      condition, count(packet.tasks.filter(({ caseId }) => caseId === tutorCase.id)),
    ])),
  };
}

export function hintReviewTemplate(packet: HintReviewPacket) {
  return {
    packet,
    reviewerId: "",
    reviewedOn: "",
    judgments: packet.tasks.map(({ unitId }) => ({
      unitId, label: null, rationale: "", uncertainty: "",
    })),
  };
}

export function validateHintReview(packet: HintReviewPacket, submission: unknown) {
  const review = submission as (Partial<Omit<ReturnType<typeof hintReviewTemplate>, "judgments">> & {
    judgments?: readonly { unitId: string; label: Label; rationale: string; uncertainty: string }[];
  }) | null;
  if (!review || !isDeepStrictEqual(review.packet, packet) ||
      typeof review.reviewerId !== "string" || !review.reviewerId.trim() ||
      typeof review.reviewedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(review.reviewedOn) ||
      !Array.isArray(review.judgments) || review.judgments.length !== packet.tasks.length) {
    throw new Error("hint_held_out_review_source_mismatch");
  }
  const byUnit = new Map(review.judgments.map((row) => [row?.unitId, row]));
  const judgments = packet.tasks.map(({ unitId }) => {
    const row = byUnit.get(unitId);
    if (!row || (row.label !== "PASS" && row.label !== "FAIL" && row.label !== "ABSTAIN") ||
        typeof row.rationale !== "string" || !row.rationale.trim() ||
        typeof row.uncertainty !== "string" || !row.uncertainty.trim()) {
      throw new Error("hint_held_out_review_incomplete");
    }
    return { unitId, label: row.label, rationale: row.rationale, uncertainty: row.uncertainty };
  });
  return { packetFingerprint: packet.fingerprint, reviewerId: review.reviewerId, reviewedOn: review.reviewedOn, judgments };
}

export function replayHintReviewPacket(
  packet: HintReviewPacket,
  cases: readonly HintPilotCase[],
  evaluate: typeof evaluateHintFit,
) {
  return packet.tasks.map(({ unitId, responseId, caseId, caseVersion, tutorReply }) => {
    const item = cases.find(({ tutorCase }) => tutorCase.id === caseId && tutorCase.version === caseVersion);
    if (!item) throw new Error("hint_held_out_checkpoint_mismatch");
    const { verdict, reason, responseExcerpts } = evaluate(item, tutorReply);
    if (!["PASS", "FAIL", "ABSTAIN"].includes(verdict) || typeof reason !== "string" || !reason.trim() ||
        !Array.isArray(responseExcerpts) || responseExcerpts.some((excerpt) =>
          typeof excerpt !== "string" || !excerpt.trim() || !tutorReply.includes(excerpt))) {
      throw new Error("hint_held_out_invalid_verdict");
    }
    return { unitId, responseId, condition: item.condition, verdict, reason, responseExcerpts };
  });
}

export function compareHintRevisions(
  packet: HintReviewPacket,
  baseline: ReturnType<typeof replayHintReviewPacket>,
  revision: ReturnType<typeof replayHintReviewPacket>,
  reference: ReturnType<typeof validateHintReview>,
) {
  if (reference.packetFingerprint !== packet.fingerprint ||
      [baseline, revision, reference.judgments].some((rows) =>
        rows.length !== packet.tasks.length || rows.some(({ unitId }, index) => unitId !== packet.tasks[index]?.unitId))) {
    throw new Error("hint_held_out_pairing_mismatch");
  }
  const rows = packet.tasks.map((task, index) => {
    const before = baseline[index]!;
    const after = revision[index]!;
    const human = reference.judgments[index]!;
    if (before.condition !== after.condition || before.responseId !== task.responseId ||
        after.responseId !== task.responseId) throw new Error("hint_held_out_pairing_mismatch");
    const changed = before.verdict !== after.verdict;
    const comparable = before.verdict !== "ABSTAIN" && after.verdict !== "ABSTAIN" && human.label !== "ABSTAIN";
    return {
      ...task,
      condition: before.condition,
      baselineStatus: before.verdict === "ABSTAIN" ? "unavailable" as const : "eligible" as const,
      baseline: before.verdict === "ABSTAIN" ? null : before.verdict,
      candidate: after.verdict,
      reference: human.label === "ABSTAIN" ? null : human.label,
      before, after, human,
      change: !changed ? "unchanged" : !comparable ? "unresolved" :
        after.verdict === human.label ? "fix" : "regression",
    };
  });
  return {
    ...summarizeHintMeasurement(rows),
    changes: rows.filter(({ change }) => change !== "unchanged"),
    rows,
  };
}
