# NV-02 offline browser regression

Only synthetic public packets, generated test capabilities and fake Provider
transports are used. The fixture never falls back to a live Provider fetch.
Host handlers, SDK mapping and packet parsing run as implemented in the checkout.
Observation-server CORS applies only to fixture results, never to tested Hosts.

Build with Node 24, then run:

```sh
npm run build
node scripts/canonical-host-browser-security.mjs
```

Open the printed `fixture` URL in a real browser with normal security settings.
Wait for DONE and a PASS report, then open the printed `opaque` URL and wait
again. Run them sequentially so per-request counter differences stay isolated.
Pages execute without user activation and never receive the valid capability.
No browser permission grant or security flag change is needed. Read `/reports`
for methods/status, Origin, Content-Type, browser version/permission states and
fake Provider counters. Use `/shutdown` to close the fixture and its three Hosts.

For historical code before the fix, run the same fixture with
`--expect-vulnerable`. This changes assertions only, never Host security.
Each of two origins runs eight scenarios against three Hosts (48 cases):
plain-text fetch, no-cors, JSON preflight, JSON requested in no-cors,
plain-text form, URL-encoded form, invalid packet, and a wrong capability's
preflight. Four calling paths trigger 24 fake Provider calls on vulnerable code.
Default assertions require zero calls for every case. Never use the vulnerable
expectation as evidence for a fixed implementation.

Baseline main `2bdd7aab1a6f5a62298ecabd3b1fdc1b841b223d`, Windows Edge
156.0.4314.42: reproduced all 24 calls with this fixture without user activation.
The complete, parser-valid packet has one case and maxOutputTokens=1024.
Plain-text form serialization preserves JSON by splitting an existing `=` into
the input name/value; schema rejection is a separate control.

With the NV-02 guards, the same Edge version and both origins completed 48/48
cases: every request was rejected with HTTP 403 and all fake Provider counts
were zero. Browser permissions/settings were unchanged. Credentialed CLI and
canonical client success, and independent header/credential failures, are
covered by the Node end-to-end regressions.

Node regressions in `tests/canonical-host-security.test.ts` additionally check
credentialed CLI/client success for every Host, missing/wrong credentials,
Origin rejection even with a valid capability, media types, duplicate headers,
real listening port, hostile Host/proxy headers, redirects and rejection before
an incomplete request body arrives. Browser scripts cannot freely set Host:
hostile Host assertions use local HTTP clients, not a claimed DNS rebinding
browser exploit.

Local-origin tests do not prove public-origin LNA or DNS rebinding exploitability.
Browser permissions, enterprise policy and runtime conditions remain separate
evidence. Server authorization stands independently of browser protections.
No production service, real Provider key, Judge or paid model call belongs here.
