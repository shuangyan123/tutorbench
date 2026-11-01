import { timingSafeEqual } from "node:crypto";
import { parseCanonicalHostSessionToken } from "../../dist/src/transport/canonical-host-session.js";

export { parseCanonicalHostSessionToken };

function headerCount(request, name) {
  let count = 0;
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index].toLowerCase() === name) count++;
  }
  return count;
}

/** Authorization precedes packet reads. Browser policy and network binding are additional boundaries. */
export function requestRejection(request, sessionToken) {
  const authority = request.headers.host?.toLowerCase();
  const port = request.socket.localPort;
  if (headerCount(request, "host") !== 1 || !port ||
      (authority !== `127.0.0.1:${port}` && authority !== `localhost:${port}`)) {
    return { status: 403, error: "host_not_allowed" };
  }
  // 此 Host 没有浏览器 UI；空 Origin、null Origin 和重复 Origin 也一律拒绝。
  if (headerCount(request, "origin") !== 0) return { status: 403, error: "origin_not_allowed" };
  const authorization = request.headers.authorization;
  const match = typeof authorization === "string" ? /^Bearer ([a-f0-9]{64})$/iu.exec(authorization) : null;
  if (headerCount(request, "authorization") !== 1 || !match ||
      !timingSafeEqual(Buffer.from(match[1], "utf8"), Buffer.from(sessionToken, "utf8"))) {
    return { status: 401, error: "host_unauthorized" };
  }
  if (request.method === "OPTIONS") return { status: 405, error: "method_not_allowed" };
  if (request.method === "POST" && request.url === "/generate" &&
      (headerCount(request, "content-type") !== 1 ||
       !/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/iu.test(request.headers["content-type"] ?? ""))) {
    return { status: 415, error: "json_content_type_required" };
  }
  return null;
}

export function rejectRequest(request, response, rejection) {
  // 不等待或缓冲未授权请求体，也不为复用连接而继续消费它。
  request.pause();
  response.shouldKeepAlive = false;
  response.writeHead(rejection.status, { "content-type": "application/json", connection: "close" });
  response.end(JSON.stringify({ error: rejection.error }));
}
