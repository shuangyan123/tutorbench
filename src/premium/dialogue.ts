import type { Asset } from "./cards.js";
import { CallError, type Config, type Message, type Model, type Reply, type Session } from "./provider.js";
import type { TutorRequest } from "./tutor.js";
import type { Lang } from "./schema.js";
import { checkStudent, studentPrompt, type State } from "./student.js";

interface StudentMessage {
  i: number; role: "student"; text: string; state: Omit<State, "message">; fixed?: boolean;
  checks?: { fenceStripped?: true; regenerated: number; hardFails: string[]; softFlags: string[] };
}
interface TutorMessage {
  i: number; role: "tutor"; turn: number; text: string; finishReason: string; latencyMs: number; usage: Reply["usage"];
}
export type Line = StudentMessage | TutorMessage;
type EndReason = "left" | "curt_exit" | "thanked_after_answer" | "turn_cap" | "student_invalid" | "error";
export interface Attempt {
  attempt: number; status: "discarded" | "kept" | "error"; reason: string | null; atStudentMessage: number | null;
  transcript: Line[]; rejected: { call: number; studentMessage: number; text: string; fenceStripped?: true; reasons: string[]; softFlags?: string[] }[];
  calls: number[];
}
function runAttempt(asset: Asset, lang: Lang, tutor: TutorRequest, student: Model, session: Session, audit: Attempt): EndReason {
  const card = asset.card;
  const first: State = { message: card.firstMessage[lang], stage: 1, events: [], end: false };
  const states = [first], tutors: string[] = [];
  const lines = audit.transcript;
  lines.push({ i: 1, role: "student", text: first.message, fixed: true, state: { stage: 1, events: [], end: false } });
  const studentHistory: Message[] = [{ role: "assistant", content: JSON.stringify(first) }];
  const system = studentPrompt(asset, lang);
  for (let turn = 1; turn <= card.maxTutorTurns; turn++) {
    const reply = session.call({ ...tutor,
      messages: lines.map(m => ({ role: m.role === "student" ? "user" : "assistant", content: m.text })) });
    tutors.push(reply.text);
    lines.push({ i: lines.length + 1, role: "tutor", text: reply.text, turn,
      finishReason: reply.finishReason, latencyMs: reply.latencyMs, usage: reply.usage });
    if (turn === card.maxTutorTurns) return "turn_cap";
    studentHistory.push({ role: "user", content: reply.text });
    const correction: Message[] = [], hardFails: string[] = [];
    for (let rewrite = 0; rewrite <= 2; rewrite++) {
      const response = session.call({ role: "student", model: student, system,
        params: { temperature: 0.7, maxOutputTokens: 512 }, messages: [...studentHistory, ...correction] });
      const { state, hard, soft, fenceStripped } = checkStudent(response.text, asset, lang, states, tutors);
      if (state && !hard.length) {
        const { message, ...internal } = state;
        lines.push({ i: lines.length + 1, role: "student", text: message, state: internal,
          checks: { ...(fenceStripped ? { fenceStripped } : {}), regenerated: rewrite, hardFails, softFlags: soft } });
        states.push(state);
        studentHistory.push({ role: "assistant", content: response.text });
        if (state.end) return state.events.find(e => ["left", "curt_exit", "thanked_after_answer"].includes(e)) as EndReason;
        break;
      }
      hardFails.push(...hard);
      audit.rejected.push({ call: session.calls.length, studentMessage: states.length + 1, text: response.text, reasons: hard,
        ...(fenceStripped ? { fenceStripped } : {}),
        ...(soft.length ? { softFlags: soft } : {}) });
      if (rewrite === 2) {
        audit.reason = hard.join(",");
        audit.atStudentMessage = states.length + 1;
        return "student_invalid";
      }
      correction.push({ role: "assistant", content: response.text }, { role: "user", content: "Rewrite: " + hard.join(", ") });
    }
  }
  throw new Error("Unreachable dialogue state");
}
export function dialogue(asset: Asset, lang: Lang, tutor: TutorRequest, config: Config, session: Session) {
  const attempts: Attempt[] = [];
  let reason: EndReason = "student_invalid";
  for (let n = 1; n <= 3; n++) {
    const attempt: Attempt = { attempt: n, status: "kept", reason: null, atStudentMessage: null, transcript: [], rejected: [], calls: [] };
    const start = session.calls.length;
    attempts.push(attempt);
    try {
      reason = runAttempt(asset, lang, tutor, config.student, session, attempt);
      if (reason === "student_invalid") attempt.status = "discarded";
    } catch (error) {
      if (!(error instanceof CallError)) throw error;
      reason = "error";
      attempt.status = "error";
      attempt.reason = error.code;
    }
    attempt.calls = session.calls.slice(start).map(c => c.n);
    if (reason !== "student_invalid") break;
  }
  const transcript = attempts.at(-1)!.transcript;
  const students = transcript.filter(m => m.role === "student");
  const fired = students.flatMap(m => m.state.events);
  const { card } = asset;
  const fixedTestDelivered = students[card.fixedTest.studentMessage - 1]?.text.includes(card.fixedTest.mustContain[lang]) ?? false;
  const fenceStripped = attempts.reduce((count, a) => count + a.rejected.filter(r => r.fenceStripped).length +
    a.transcript.filter(m => m.role === "student" && m.checks?.fenceStripped).length, 0);
  const end = { reason, fenceStripped, tutorTurns: transcript.length - students.length, messages: transcript.length,
    finalStage: students.at(-1)!.state.stage, fixedTestDelivered,
    behavioursFired: [card.fixedTest.kind, ...card.conditionalBehaviours].filter(e => fired.includes(e)),
    behavioursNotFired: card.conditionalBehaviours.filter(e => !fired.includes(e)),
    scriptedMistakesMade: card.scriptedMistakes.filter(m => fired.includes("scripted_mistake:" + m.id)).map(m => m.id),
    scriptedMistakesMissing: card.scriptedMistakes.filter(m => m.required && !fired.includes("scripted_mistake:" + m.id)).map(m => m.id),
    softFlags: [...new Set(students.flatMap(m => m.checks?.softFlags ?? []))] };
  return { attempts, transcript, end };
}
export type Conversation = ReturnType<typeof dialogue>;
