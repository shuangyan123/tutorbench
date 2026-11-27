import { hash, type Asset } from "./cards.js";
import { CallError, type Config, type Message, type Model, type Reply, type Session } from "./provider.js";
import { turnNote } from "./protocol.js";
import type { TutorRequest } from "./tutor.js";
import type { Lang } from "./schema.js";
import { checkStudent, finalStudentText, observedFormat, rewriteFeedback, studentPrompt, type ObservedFormat, type State } from "./student.js";

interface StudentMessage {
  i: number; role: "student"; text: string; state: Omit<State, "message">; fixed?: boolean; prefix?: true;
  model?: { raw: string; message: string; events: string[] };
  injected?: { kind: "fixed_test"; text: string; separator: string }; runnerEvents?: string[]; droppedEvents?: string[];
  checks?: { call?: number; observedFormat?: ObservedFormat; fenceStripped?: true; regenerated: number; hardFails: string[]; softFlags: string[] };
}
interface TutorMessage {
  i: number; role: "tutor"; turn: number; text: string; finishReason?: string; latencyMs?: number; usage?: Reply["usage"];
  prefix?: true; source?: string;
}
export type Line = StudentMessage | TutorMessage;
export type PrefixLine = Omit<StudentMessage, "i"> | Omit<TutorMessage, "i">;
type EndReason = "left" | "curt_exit" | "thanked_after_answer" | "turn_cap" | "student_invalid" | "error" | "probe_complete";
export interface Attempt {
  attempt: number; status: "discarded" | "kept" | "error"; reason: string | null; atStudentMessage: number | null;
  transcript: Line[]; rejected: { call: number; studentMessage: number; text: string | null; observedFormat?: ObservedFormat;
    fenceStripped?: true; reasons: string[]; softFlags?: string[] }[];
  calls: number[];
}
const terminal = ["left", "curt_exit", "thanked_after_answer"];
function studentState(line: StudentMessage): State {
  const { stage, events, end } = line.state;
  return { message: line.text, stage, events, end };
}
function runAttempt(asset: Asset, lang: Lang, tutor: TutorRequest, student: Model, session: Session, audit: Attempt, prefix?: PrefixLine[]): EndReason {
  const { card, protocol } = asset;
  const fixed = card.fixedTest, injectedCard = fixed.delivery === "injected";
  const atInjection = (k: number) => injectedCard && k === fixed.studentMessage;
  const states: State[] = [], tutors: string[] = [], studentHistory: Message[] = [];
  const lines = audit.transcript;
  const addTutorHistory = (text: string) => {
    tutors.push(text);
    const k = states.length + 1;
    studentHistory.push({ role: "user", content: text + (protocol ? turnNote(protocol, lang, k, atInjection(k)) : "") });
  };
  const initial: Line[] = prefix ? prefix.map((m, i) => ({ ...structuredClone(m), i: i + 1, prefix: true })) : [
    { i: 1, role: "student", text: card.firstMessage[lang], fixed: true, state: { stage: 1, events: [], end: false } },
  ];
  for (const line of initial) {
    lines.push(line);
    if (line.role === "tutor") addTutorHistory(line.text);
    else {
      const state = studentState(line);
      states.push(state);
      studentHistory.push({ role: "assistant", content: JSON.stringify(state) });
    }
  }
  const system = studentPrompt(asset, lang), request = protocol?.studentRequest;
  for (let turn = prefix ? tutors.length : 1; turn <= card.maxTutorTurns; turn++) {
    if (!prefix) {
      const reply = session.call({ ...tutor,
        messages: lines.map(m => ({ role: m.role === "student" ? "user" : "assistant", content: m.text })) });
      const text = reply.text!;
      lines.push({ i: lines.length + 1, role: "tutor", text, turn,
        finishReason: reply.finishReason, latencyMs: reply.latencyMs, usage: reply.usage });
      if (turn === card.maxTutorTurns) return "turn_cap";
      addTutorHistory(text);
    }
    const k = states.length + 1;
    const correction: Message[] = [], hardFails: string[] = [];
    const studentAudit = request ? { historyHash: hash(JSON.stringify(studentHistory)), responseFormat: request.responseFormat } : {};
    // 每个位置首次生成加两次重写；传输重试由 Session 独立处理。
    for (let rewrite = 0; rewrite <= 2; rewrite++) {
      const response = session.call({ role: "student", model: student, system,
        params: { temperature: request?.temperature ?? 0.7, maxOutputTokens: request?.maxOutputTokens ?? 512 },
        ...studentAudit, messages: [...studentHistory, ...correction] });
      const format = request ? observedFormat(response.text, response.finishReason) : undefined;
      const { state, hard, soft, fenceStripped } = checkStudent(response.text, asset, lang, states, tutors);
      if (state && !hard.length) {
        const { message, stage, events, end } = state;
        const text = finalStudentText(asset, lang, k, state);
        const droppedEvents = injectedCard ? events.filter(e => e === fixed.kind) : [];
        const inject = atInjection(k) && !end;
        const finalEvents = [...(injectedCard ? events.filter(e => e !== fixed.kind) : events), ...(inject ? [fixed.kind] : [])];
        const internal = { stage, events: finalEvents, end };
        lines.push({ i: lines.length + 1, role: "student", text, state: internal,
          ...(inject ? { injected: { kind: "fixed_test", text: fixed.mustContain[lang], separator: protocol!.injection.separator }, runnerEvents: [fixed.kind] } : {}),
          ...(droppedEvents.length ? { droppedEvents } : {}),
          ...(request ? { model: { raw: response.text!, message, events } } : {}),
          checks: { ...(format ? { call: session.calls.length, observedFormat: format } : {}),
            ...(fenceStripped ? { fenceStripped } : {}), regenerated: rewrite, hardFails, softFlags: soft } });
        states.push({ message: text, ...internal });
        studentHistory.push({ role: "assistant", content: request ? JSON.stringify(states.at(-1)) : response.text! });
        if (end) return finalEvents.find(e => terminal.includes(e)) as EndReason;
        if (prefix) return "probe_complete";
        break;
      }
      hardFails.push(...hard);
      audit.rejected.push({ call: session.calls.length, studentMessage: k, text: response.text, reasons: hard,
        ...(format ? { observedFormat: format } : {}), ...(fenceStripped ? { fenceStripped } : {}),
        ...(soft.length ? { softFlags: soft } : {}) });
      if (rewrite === 2) {
        audit.reason = hard.join(",");
        audit.atStudentMessage = k;
        return "student_invalid";
      }
      if (format !== "empty") correction.push({ role: "assistant", content: response.text! });
      correction.push({ role: "user", content: rewriteFeedback(asset, lang, states, hard) });
    }
  }
  throw new Error("Unreachable dialogue state");
}
export function dialogue(asset: Asset, lang: Lang, tutor: TutorRequest, config: Config, session: Session, prefix?: PrefixLine[]) {
  const attempts: Attempt[] = [];
  let reason: EndReason = "student_invalid";
  for (let n = 1; n <= 3; n++) {
    const attempt: Attempt = { attempt: n, status: "kept", reason: null, atStudentMessage: null, transcript: [], rejected: [], calls: [] };
    const start = session.calls.length;
    attempts.push(attempt);
    try {
      reason = runAttempt(asset, lang, tutor, config.student, session, attempt, prefix);
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
  const fixedLine = students[card.fixedTest.studentMessage - 1];
  const fixedTestDelivered = ((card.fixedTest.delivery !== "injected" || !!fixedLine?.injected) &&
    !!fixedLine?.text.includes(card.fixedTest.mustContain[lang]));
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
