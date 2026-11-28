import { hash, type Asset } from "./cards.js";
import type { Probe } from "./plan.js";
import { dialogue } from "./dialogue.js";
import { type Config, type Tutor, type Session, inferenceUsage, sumUsd, usage } from "./provider.js";
import { scoring } from "./scoring.js";
import type { Lang } from "./schema.js";
import { prepareTutor } from "./tutor.js";
import { studentPrompt, studentRequestOptions } from "./student.js";

export interface Job { probe?: Probe; restartOf?: string; runId: string; lang: Lang; repeatIndex: number; tutor: Tutor; asset: Asset }
export function runJob(config: Config, job: Job, session: Session, gitCommit: string, createdAt: string, privateRubric?: string) {
  const { runId, lang, repeatIndex, tutor, asset } = job;
  const { prompt, request } = prepareTutor(tutor, lang, asset.card.tutorSetup[lang]);
  const studentRequest = asset.protocol?.studentRequest;
  const calibration = config.kind === "calibration" || config.kind === "calibration-probe";
  const conversation = dialogue(asset, lang, request, config, session, job.probe?.prefix);
  const probe = job.probe && (({ prefix: _prefix, ...metadata }) => metadata)(job.probe);
  const { reason } = conversation.end;
  const scorings = calibration || reason === "student_invalid" || reason === "error" ? [] :
    [scoring(config, tutor, asset, lang, conversation, session, "s1", createdAt, privateRubric)];
  const resolved = (role: "student" | "tutor") => session.calls.slice().reverse().find(c => c.role === role && c.resolvedModel)?.resolvedModel ?? null;
  const { card } = asset;
  const suite = /^(.*)-v(\d+(?:\.\d+)*)$/u.exec(card.suite);
  return { ...(job.restartOf ? { restartOf: job.restartOf } : {}), schema: "tutorbench.premium-run-record", schemaVersion: studentRequest ? 6 : 5, ...(job.probe ? { probe } : {}), batchKind: config.kind ?? "evaluation", runId, batchId: config.batchId, createdAt,
    status: reason === "error" || reason === "student_invalid" ? reason : calibration ? "unscored" : scorings[0]?.merged?.verdict ? "scored" : "needs_review",
    code: { gitCommit, runnerVersion: studentRequest ? "0.2.0" : "0.1.0" }, card: { suite: suite?.[1] ?? card.suite, suiteVersion: suite?.[2] ?? null, suiteId: card.suite, id: card.id, version: card.version,
      lang, hash: asset.contentHash, contentHash: asset.contentHash, rulesVersion: asset.rulesVersion, ...(asset.protocol ? { protocolVersion: asset.protocol.version, protocolHash: asset.protocol.hash } : {}) },
    tutor: job.probe ? { id: job.probe.tutorSource, provider: "replay" as const } as ProbeTutor : { ...request.model, label: tutor.label ?? tutor.id, resolvedModel: resolved("tutor"), systemPrompt: request.system,
      promptHash: hash(request.system), tutorPromptId: prompt?.id ?? null, tutorPromptVersion: prompt?.version ?? null,
      tutorPromptHash: prompt?.hash ?? null, params: request.params },
    student: { ...config.student, resolvedModel: resolved("student"), ...studentRequestOptions(config.studentInference, asset.protocol),
      ...(studentRequest ? { responseFormat: studentRequest.responseFormat, thinking: config.studentInference?.thinking ?? studentRequest.thinking.type } : {}), promptHash: hash(studentPrompt(asset, lang)) },
    repeat: { index: repeatIndex, of: config.repeats }, ...conversation, calls: session.calls, usage: usage(session.calls, config.prices), ...(config.studentInference ? { inferenceUsage: inferenceUsage(session.calls.filter(c => c.role === "student")) } : {}), scorings };
}
// 探针只有重放来源；索引保留原导师列的可选值。
type ProbeTutor = { id: string; provider: "replay"; label?: undefined; resolvedModel?: undefined; pinnedVersion?: undefined;
  params?: undefined; tutorPromptHash?: undefined; tutorPromptId?: undefined; tutorPromptVersion?: undefined; systemPrompt?: undefined; promptHash?: undefined; developer?: undefined };
export type RunRecord = ReturnType<typeof runJob>;
export function indexRow(r: RunRecord) {
  if ((r.batchKind === "calibration" || r.batchKind === "calibration-probe") && (r.scorings.length || r.status === "scored")) throw new Error("Invalid premium field: calibration.scorings");
  const s = r.scorings.at(-1), m = s?.merged;
  if (s && m?.verdict && (s.perJudge.length !== 3 || new Set(s.perJudge.map(j => j.judgeId)).size !== 3 ||
      s.perJudge.some(j => !j.output || j.output.turns.length !== r.end.tutorTurns ||
        new Set(j.output.turns.map(t => t.turn)).size !== r.end.tutorTurns ||
        j.output.turns.some(t => !Number.isInteger(t.turn) || t.turn < 1 || t.turn > r.end.tutorTurns)))) {
    throw new Error("Invalid premium field: record.scored_panel");
  }
  return { ...(r.probe ? { probeId: r.probe.probeId } : {}), batchKind: r.batchKind ?? "evaluation", reviewFlags: m?.reviewFlags ?? [], fixedTestSkipped: m?.fixedTestSkipped ?? false, runId: r.runId, batchId: r.batchId, createdAt: r.createdAt, status: s ? (m?.verdict ? "scored" : "needs_review") : r.status,
    cardId: r.card.id, cardVersion: r.card.version, lang: r.card.lang, cardHash: r.card.contentHash, tutorLabel: r.tutor.label,
    tutorPromptId: r.tutor.tutorPromptId ?? null, tutorPromptVersion: r.tutor.tutorPromptVersion ?? null,
    tutorResolvedModel: r.tutor.resolvedModel, repeatIndex: r.repeat.index, studentResolvedModel: r.student.resolvedModel,
    judgeConfigVersion: s?.judgeConfig.version ?? null, scoringId: s?.scoringId ?? null, verdict: m?.verdict ?? null, reasons: m?.reasons ?? [],
    fixedTest: m?.fixedTest ?? (m?.reviewFlags?.includes("fixed_test_split") ? "split" : null), endReason: r.end.reason, tutorTurns: r.end.tutorTurns, turnItemsPassed: m?.turnItemsPassed ?? null,
    turnItemsTotal: m?.turnItemsTotal ?? null, helpLevels: m?.helpLevels ?? [], leakTurns: m?.leakTurns ?? [], transfer: m?.transfer ?? (m?.reviewFlags?.includes("transfer_split") ? "split" : null),
    behavioursNotFired: r.end.behavioursNotFired, discardedAttempts: r.attempts.filter(a => a.status === "discarded").length,
    disagreements: s?.disagreements.length ?? 0, usd: sumUsd([r.usage.totalUsd, ...r.scorings.slice(1).map(score => score.usage?.totalUsd ?? null)]),
    recordPath: "records/" + r.runId + ".json" };
}
