export const MAX_UPSTREAM_RESPONSE_BYTES = 8_000_000;
export const MAX_UPSTREAM_ERROR_BYTES = 65_536;

export interface HttpResponseBody {
  readonly status: number;
  readonly body: ReadableStream<Uint8Array> | null;
  readonly headers?: Headers;
  readonly statusText?: string;
}

export class ResponseBodyLimitError extends Error {
  constructor(readonly status: number) {
    super("Upstream HTTP response exceeded the byte budget.");
    this.name = "ResponseBodyLimitError";
  }
}

export function responseByteBudget(status: number): number {
  return status >= 200 && status < 300 ? MAX_UPSTREAM_RESPONSE_BYTES : MAX_UPSTREAM_ERROR_BYTES;
}

/** 不使用的错误响应直接取消，不读取或记录其内容。 */
export function cancelResponseBody(response: Pick<HttpResponseBody, "body">): void {
  void response.body?.cancel().catch(() => undefined);
}

/** 对解压后的实际字节计数；超限块不会进入下游 JSON/SDK 缓冲。 */
export function boundedResponse(
  response: HttpResponseBody,
  maxBytes = responseByteBudget(response.status),
  signal?: AbortSignal,
): Response {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError("Response byte budget must be a nonnegative safe integer.");
  }
  const headers = new Headers(response.headers);
  // SDK 可能因 Content-Length: 0 跳过读取；不让伪造长度绕过实际字节计数。
  headers.delete("content-length");
  let body: ReadableStream<Uint8Array> | null = null;
  if (response.body !== null) {
    const reader = response.body.getReader();
    let total = 0;
    let stopped = false;
    let output: ReadableStreamDefaultController<Uint8Array>;
    const stop = (cancel: boolean): void => {
      if (stopped) return;
      stopped = true;
      signal?.removeEventListener("abort", abort);
      // 取消立即发起；不能让异常或永不完成的上游 cancel 阻塞失败返回。
      if (cancel) void reader.cancel().catch(() => undefined);
      reader.releaseLock();
    };
    const abort = (): void => {
      if (stopped) return;
      stop(true);
      output.error(new DOMException("The operation was aborted.", "AbortError"));
    };
    body = new ReadableStream<Uint8Array>({
      start(controller) {
        output = controller;
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
      },
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (stopped) return;
          if (done) {
            stop(false);
            controller.close();
            return;
          }
          if (!(value instanceof Uint8Array)) throw new TypeError("Invalid HTTP response byte chunk.");
          if (value.byteLength > maxBytes - total) {
            throw new ResponseBodyLimitError(response.status);
          }
          total += value.byteLength;
          controller.enqueue(value);
        } catch (error) {
          if (stopped) return;
          stop(true);
          controller.error(error);
        }
      },
      cancel() { stop(true); },
    }, { highWaterMark: 0 });
  }
  return new Response(body, { status: response.status, statusText: response.statusText ?? "", headers });
}

export function readBoundedJson(response: HttpResponseBody, signal?: AbortSignal): Promise<unknown> {
  return boundedResponse(response, responseByteBudget(response.status), signal).json();
}

/** SDK 继续自行解析响应与 HTTP 错误；只替换其读取流，保留状态和重试相关头。 */
export function createBoundedFetch(fetchImplementation: typeof fetch = globalThis.fetch): typeof fetch {
  return async (input, init) => {
    const response = await fetchImplementation(input, init);
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    return boundedResponse(response, responseByteBudget(response.status), signal);
  };
}
