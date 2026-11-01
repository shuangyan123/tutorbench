export function trackedResponse(
  chunks: readonly Uint8Array[],
  status = 200,
  headers: HeadersInit = {},
) {
  let reads = 0;
  let bytesRead = 0;
  let cancelled = false;
  const response = new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[reads];
      if (chunk === undefined) {
        controller.close();
        return;
      }
      reads += 1;
      bytesRead += chunk.byteLength;
      controller.enqueue(chunk);
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 }), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
  return { response, reads: () => reads, bytesRead: () => bytesRead, cancelled: () => cancelled };
}

export function oversizedResponse(body: unknown, status = 200) {
  const padding = Buffer.alloc(65_536, " ");
  return trackedResponse([
    ...Array.from({ length: 123 }, () => padding),
    Buffer.from(JSON.stringify(body)),
  ], status, { "content-length": "1" });
}
