import { MockNotDispatched, type Provider, type Reply } from "./provider.js";
import { id, integer, invalid, nullable, obj, optional, shape, str } from "./schema.js";
import type { Job } from "./runner.js";

// Golden replay consumes frames in call order, including rejected replies.
const frame = shape({ text: str, resolvedModel: optional(str), system_fingerprint: optional(nullable(str)), finishReason: id, latencyMs: integer,
  usage: nullable(shape({ inputTokens: integer, outputTokens: integer, cacheHitTokens: optional(integer), cacheMissTokens: optional(integer),
    reasoningTokens: optional(integer), visibleOutputTokens: optional(integer) })) });
export function replayProvider(tape: unknown, job: Job, tutorByTurn = false): Provider {
  const tracks = obj(obj(tape, "tape")[[job.asset.card.id, job.lang, job.probe?.probeId ?? job.tutor.id].join("/")], "tape.job");
  const cursors = new Map<string, number>();
  return request => {
    const key = request.model.id;
    const frames = tracks[key];
    if (!Array.isArray(frames)) invalid("tape.track");
    const cursor = tutorByTurn && request.role === "tutor" ? (request.messages.length - 1) / 2 : cursors.get(key) ?? 0;
    cursors.set(key, cursor + 1);
    const value: unknown = frames[cursor];
    if (value === "mock_not_dispatched") throw new MockNotDispatched();
    if (value == null) return invalid("tape.exhausted/provider_error");
    const reply = frame(value, "tape.frame");
    return { ...reply, system_fingerprint: reply.system_fingerprint ?? null, returnedModel: reply.resolvedModel ?? null, resolvedModel: reply.resolvedModel ?? request.model.pinnedVersion } satisfies Reply;
  };
}
