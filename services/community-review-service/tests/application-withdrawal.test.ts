import assert from "node:assert/strict";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { test } from "node:test";
import type { Pool } from "pg";

import {
  ApplicationSubmissionRateLimiter,
  CommunityReviewApplicationIntakeApplicationService,
  CommunityReviewApplicationIntakeService,
  CommunityReviewApplicationService,
  handleCommunityReviewApiRequest,
  PostgreSQLCommunityReviewRepository,
  RejectingAuthenticationAdapter,
  StaticOperatorAuthorizer,
} from "../src/index.js";

function postgresHarness(
  connectGate: Promise<void> = Promise.resolve(),
  options: ConstructorParameters<typeof CommunityReviewApplicationIntakeService>[1] = {},
) {
  const statements: { readonly sql: string; readonly values: readonly unknown[] }[] = [];
  let connections = 0;
  let connectedFour!: () => void;
  const fourConnections = new Promise<void>((resolve) => { connectedFour = resolve; });
  const pool = {
    async connect() {
      connections += 1;
      if (connections === 4) connectedFour();
      await connectGate;
      return {
        async query(sql: string, values: readonly unknown[] = []) {
          statements.push({ sql, values });
          return { rows: [], rowCount: 0 };
        },
        release() {},
      };
    },
  } as unknown as Pool;
  const repository = new PostgreSQLCommunityReviewRepository({ pool });
  const intake = new CommunityReviewApplicationIntakeApplicationService(
    new CommunityReviewApplicationIntakeService(repository, { intakeState: "CLOSED", ...options }),
    new RejectingAuthenticationAdapter(),
    new StaticOperatorAuthorizer([]),
  );
  return { intake, statements, fourConnections, connections: () => connections };
}

async function withdraw(harness: ReturnType<typeof postgresHarness>, address = "203.0.113.8") {
  const request = Readable.from([Buffer.from(JSON.stringify({ credential: "x".repeat(43) }))]);
  const incoming = Object.assign(request, {
    method: "POST",
    headers: { "content-type": "application/json" },
    socket: { remoteAddress: address },
  }) as unknown as IncomingMessage;
  return handleCommunityReviewApiRequest(
    {} as CommunityReviewApplicationService,
    harness.intake,
    incoming,
    "/v1/applications/unknown-application/withdraw",
    4096,
  );
}

test("TB-SEC-02: CLOSED anonymous withdrawal reads only the target application", async (context) => {
  const harness = postgresHarness();
  const result = await withdraw(harness);
  assert.equal(result?.status, 404);
  assert.equal(result?.body.error, "application_withdrawal_not_authorized");
  context.diagnostic(`SQL statements for one rejected withdrawal: ${harness.statements.length}`);
  assert.equal(harness.statements.filter(({ sql }) => /SELECT/iu.test(sql)).length, 1);
  assert.ok(harness.statements.some(({ sql, values }) =>
    /FROM community_review_applications\s+WHERE application_id = \$1\s+FOR UPDATE/iu.test(sql) &&
    values[0] === "unknown-application"));
  assert.ok(harness.statements.every(({ sql }) =>
    !/pg_advisory|reviewer_|qualification_|review_batches|review_submissions/iu.test(sql)));
  assert.equal(harness.statements.at(-1)?.sql, "ROLLBACK");
});

test("TB-SEC-02: withdrawal source limit rejects before acquiring a database connection", async () => {
  const harness = postgresHarness();
  for (let index = 0; index < 30; index += 1) assert.equal((await withdraw(harness))?.status, 404);
  const connections = harness.connections();
  assert.equal((await withdraw(harness))?.status, 429);
  assert.equal(harness.connections(), connections);
  assert.equal((await withdraw(harness, "203.0.113.9"))?.status, 404);
});

test("TB-SEC-02: concurrency admission bounds database acquisition without queueing", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const harness = postgresHarness(gate);
  const pending = Array.from({ length: 4 }, () => withdraw(harness));
  let extra: ReturnType<typeof withdraw> | undefined;
  try {
    await harness.fourConnections;
    extra = withdraw(harness);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(harness.connections(), 4);
  } finally {
    release();
    await Promise.all(pending);
  }
  assert.equal((await extra)?.status, 429);
  assert.equal((await withdraw(harness))?.status, 404);
});

test("TB-SEC-02: rotating sources cannot bypass the total withdrawal budget", async () => {
  let now = 0;
  const harness = postgresHarness(Promise.resolve(), {
    withdrawalGlobalRateLimiter: new ApplicationSubmissionRateLimiter({
      maximumRequests: 2,
      windowMs: 1000,
      maximumEntries: 1,
      clock: () => now,
    }),
  });
  assert.equal((await withdraw(harness, "203.0.113.1"))?.status, 404);
  assert.equal((await withdraw(harness, "203.0.113.2"))?.status, 404);
  assert.equal((await withdraw(harness, "203.0.113.3"))?.status, 429);
  assert.equal(harness.connections(), 2);
  now = 1000;
  assert.equal((await withdraw(harness, "203.0.113.3"))?.status, 404);
  assert.equal(harness.connections(), 3);
});

test("TB-SEC-02: exhausted source budget recovers without persisting source addresses", async () => {
  let now = 0;
  const harness = postgresHarness(Promise.resolve(), {
    withdrawalRateLimiter: new ApplicationSubmissionRateLimiter({
      maximumRequests: 1,
      windowMs: 1000,
      clock: () => now,
    }),
  });
  assert.equal((await withdraw(harness))?.status, 404);
  assert.equal((await withdraw(harness))?.status, 429);
  assert.equal(harness.connections(), 1);
  assert.doesNotMatch(JSON.stringify(harness.statements), /203\.0\.113\.8/u);
  now = 1000;
  assert.equal((await withdraw(harness))?.status, 404);
});

test("TB-SEC-02: database acquisition failures release withdrawal admission slots", async () => {
  const harness = postgresHarness(Promise.reject(new Error("Synthetic connection acquisition failure")));
  for (let index = 0; index < 6; index += 1) assert.equal((await withdraw(harness))?.status, 500);
  assert.equal(harness.connections(), 6);
  assert.deepEqual(harness.statements, []);
});
