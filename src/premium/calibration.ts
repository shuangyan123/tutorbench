import { spawnSync, type SpawnSyncOptionsWithStringEncoding, type SpawnSyncReturns } from "node:child_process";
import { fileURLToPath } from "node:url";
import { childEnvironment } from "./child-environment.js";
import { studentPayload } from "./student-http.js";
import { replayProvider } from "./replay.js";
import { TransportError, type Provider, type Request, type Reply } from "./provider.js";
import type { Job } from "./runner.js";
import { invalid } from "./schema.js";

// 固定导师按本次对话轮数取帧；整段作废重来时从第一帧开始。
export function hybridProvider(tape: unknown, job: Job, student: Provider): Provider {
  const tutor = job.probe ? undefined : replayProvider(tape, job, true);
  const route: Provider = request => {
    if (tutor && request.role === "tutor" && request.model.id === job.tutor.id) return tutor(request);
    if (request.role !== "student") return invalid("calibration.role");
    return student(request);
  };
  route.requestBytes = req => Buffer.byteLength(req.role === "student" ? studentPayload(req) : JSON.stringify(req));
  return route;
}

// 隔离同步 Runner 与异步 HTTP。私有请求只经 stdin，子进程仅输出允许的字段。
type StudentWorker = (file: string, args: string[], options: SpawnSyncOptionsWithStringEncoding) => SpawnSyncReturns<string>;
export function callStudentWorker(req: Request, spawn: StudentWorker = spawnSync): Reply {
  if (req.role !== "student" || req.model.provider !== "deepseek") return invalid("calibration.student");
  const child = spawn(process.execPath, [fileURLToPath(new URL("./student-http.js", import.meta.url))], {
    env: childEnvironment("deepseek"), input: JSON.stringify(req), encoding: "utf8", timeout: 130_000, maxBuffer: 1_000_000, windowsHide: true,
  });
  if (child.error && "code" in child.error && child.error.code === "ETIMEDOUT") throw new TransportError("timeout", true, undefined, undefined, "worker_deadline");
  if (child.error || child.status !== 0) throw new TransportError("provider_error", false, undefined, undefined, "worker_failure");
  let response;
  try { response = JSON.parse(child.stdout); }
  catch { throw new TransportError("provider_error", false, undefined, undefined, "worker_failure"); }
  if (response.error) throw new TransportError(response.error, response.retryable, response.retryAfterMs, response.identity, response.diagnostic);
  return response.reply;
}
export const liveStudent: Provider = req => callStudentWorker(req);
