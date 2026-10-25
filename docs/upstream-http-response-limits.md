# Upstream HTTP response limits (TB-SEC-03)

The HTTP transport counts actual response bytes while reading, before JSON
parsing or SDK buffering. It rejects the first chunk that would exceed the
budget, immediately initiates source cancellation, releases the reader, and
never forwards that chunk or requests the remaining tail. Cancellation errors
or a cancellation promise that never settles cannot delay the failure.

`src/transport/response-body.ts` owns the small shared stream wrapper. It has
no provider, benchmark, or scoring dependency. Native fetch supplies decoded
body bytes, so the budget also applies after HTTP content decompression.
Content-Length is not a security decision; the wrapper removes it because
some SDKs otherwise skip a body advertised as zero bytes.

## Budgets and affected paths

All numbers below are bytes, not characters or tokens, and apply per response.

| Boundary | Successful response | Non-success response |
| --- | ---: | --- |
| Tutor HTTP v1 (`HttpTutor`) | 8,000,000 | Cancel without reading |
| Canonical execution host client | 8,000,000 | 65,536 for stable provider error mapping |
| Generic Chat Completions Judge executor | 8,000,000 | Cancel without reading |
| Repository-owned OpenAI Responses Judge SDK | 8,000,000 | 65,536 before SDK error handling |
| Generic Chat Completions canonical host | 8,000,000 | Cancel without reading |
| OpenAI and Gemini canonical host SDKs | 8,000,000 | 65,536 before SDK error handling |
| HTTP review translation provider | 8,000,000 | Cancel without reading |

The shared Judge executor includes generic compatible providers, DeepSeek,
MiniMax, material-requirement judging, and vNext evaluator-stress judging.
The translation path has the same buffering defect and uses the same transport
fix; its output remains review-only, outside benchmark evidence.

### Why these budgets

8,000,000 preserves the existing compatible canonical host's intended response
budget, moving enforcement ahead of buffering. It is reused for the other
single-case JSON protocols rather than imposing a smaller visible-text limit.
The supported canonical generation specification permits up to 32,768 output
tokens, while the baseline uses 1,024. The response budget provides about 244
bytes per token at that upper setting, with room for JSON escaping, metrics,
provider envelopes, and reasoning fields that are discarded after parsing.
Regression fixtures include long escaped multilingual text and an exact
8,000,000-byte JSON envelope.

This is an operational transport allowance, not a universal token-to-byte
conversion guarantee. Product Tutor output has no prior character maximum,
and configurable Judges can request larger generations. Previously accepted
envelopes larger than this allowance now fail their case; they are never
silently truncated, scored as valid evidence, or regenerated to fit.

65,536 is separate from the generation budget: error paths need only small
stable error codes or SDK HTTP classification, not generated text. It leaves
ample room for ordinary structured error envelopes without buffering arbitrary
diagnostics or HTML. Unused error bodies need no content and are cancelled
immediately. Whole SDK envelopes, including private reasoning/metadata fields,
count toward the budget even though those fields never enter benchmark output.

## Compatibility and failure semantics

Wire requests, successful JSON schemas, generation settings, scoring, and
result sanitization are unchanged. Oversized success bodies use the existing
invalid-response/invalid-JSON failure boundary. HTTP errors preserve their
status-based classification and existing bounded retry policy; unused bodies
are cancelled before a retry. An oversized successful Judge response is not
retried. Existing abort signals and deadlines remain in place and also cancel
the bounded reader. No retry count or timeout was increased.

Custom `ChatCompletionsFetch` implementations must now return a readable byte
`body` and `status` (a native `Response` satisfies this). A `json()`-only
transport cannot enforce a pre-buffer byte limit and is no longer accepted.
Test fixtures were converted to native Responses without weakening their
assertions. The existing injected, already-parsed `OpenAIResponsesClient`
interface remains a trusted in-process seam: callers supplying their own
client own its transport. Repository-created SDK clients and all bundled
canonical hosts always install the bounded fetch wrapper, including when
their raw fetch implementation is replaced for offline tests.

## Verification and limits

Tests use synthetic readable streams and loopback HTTP only. They check chunked
overflow, missing/forged length headers, exact success/error boundaries,
multibyte UTF-8 and split code points, early EOF, stream exceptions, source
cancellation failure/stall, caller abort, decoded compressed bodies, no reads
after overflow, real installed SDK parsing, HTTP retry bounds, and per-case
failure isolation. No production or paid provider is required.

Memory remains proportional to each response budget, parser overhead, and
concurrency. A transport can deliver a single already-allocated oversized
chunk before the wrapper sees it; that chunk is rejected rather than retained
in downstream buffering. These limits do not introduce a global concurrency
or process-memory budget, and do not change SDK deadline policies. Future SDK
or fetch changes must retain the response-body regressions.
