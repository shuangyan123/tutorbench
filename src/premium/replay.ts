import { MockNotDispatched, type Provider, type Reply } from "./provider.js";
import { id, integer, invalid, nullable, obj, optional, shape, str } from "./schema.js";
import type { Job } from "./runner.js";

// Only this file-backed transport is reachable from the CLI. Every job starts a fresh tape.
const frame = shape({ text: str, resolvedModel: optional(id), finishReason: id, latencyMs: integer,
  usage: nullable(shape({ inputTokens: integer, outputTokens: integer })) });
export function replayProvider(tape: unknown, job: Job): Provider {
  const tracks = obj(obj(tape, "tape")[[job.asset.card.id, job.lang, job.tutor.id].join("/")], "tape.job");
  const cursors = new Map<string, number>();
  return request => {
    const key = request.model.id;
    const frames = tracks[key];
    if (!Array.isArray(frames)) invalid("tape.track");
    const cursor = cursors.get(key) ?? 0;
    cursors.set(key, cursor + 1);
    const value: unknown = frames[cursor];
    if (value === "mock_not_dispatched") throw new MockNotDispatched();
    if (value == null) return invalid("tape.exhausted/provider_error");
    const reply = frame(value, "tape.frame");
    return { ...reply, resolvedModel: reply.resolvedModel ?? request.model.pinnedVersion } satisfies Reply;
  };
}
