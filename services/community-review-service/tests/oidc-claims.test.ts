import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import { CompactSign, exportJWK, generateKeyPair } from "jose";

import {
  AuthenticationAdapterError,
  ConfiguredOperatorAuthorizer,
  OidcJwtAuthenticationAdapter,
} from "../src/index.js";
import type { OidcAccessTokenProfile } from "../src/index.js";

/** Ephemeral synthetic issuer: no tenant, stored key, token log, or real identity. */
async function syntheticIssuer() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "claims-test", alg: "RS256", use: "sig" };
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  const now = Math.floor(Date.now() / 1000);
  return {
    claims(profile: OidcAccessTokenProfile): Record<string, unknown> {
      return {
        iss: issuer,
        aud: "claims-test-api",
        sub: "synthetic-operator",
        exp: now + 300,
        ...(profile === "auth0"
          ? { azp: "claims-test-client" }
          : { client_id: "claims-test-client", iat: now, jti: "synthetic-token-id" }),
        scope: "operator:review",
      };
    },
    adapter(profile: OidcAccessTokenProfile, clockToleranceSeconds = 5) {
      return new OidcJwtAuthenticationAdapter({
        provider: "synthetic-oidc",
        issuer,
        audience: "claims-test-api",
        jwksUri: `${issuer}jwks.json`,
        channel: "operator",
        tokenProfile: profile,
        clientId: "claims-test-client",
        requiredScope: "operator:review",
        clockToleranceSeconds,
        allowInsecureHttp: true,
      });
    },
    async sign(profile: OidcAccessTokenProfile, claims: Record<string, unknown>, raw?: string) {
      // Sign raw JSON too: 1e999 is legal JSON but becomes a non-finite JS number.
      const token = await new CompactSign(new TextEncoder().encode(raw ?? JSON.stringify(claims)))
        .setProtectedHeader({ alg: "RS256", kid: "claims-test", typ: profile === "auth0" ? "JWT" : "at+jwt" })
        .sign(privateKey);
      return { authorization: `Bearer ${token}` };
    },
    async close() {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

for (const profile of ["auth0", "rfc9068"] as const) {
  test(`${profile} access tokens require exp even with a valid signature`, async () => {
    const fixture = await syntheticIssuer();
    try {
      const claims = fixture.claims(profile);
      delete claims.exp;
      await assert.rejects(fixture.adapter(profile).authenticate(await fixture.sign(profile, claims)), AuthenticationAdapterError);
    } finally {
      await fixture.close();
    }
  });

  test(`${profile} rejects malformed and non-finite expiration claims`, async (t) => {
    const fixture = await syntheticIssuer();
    const adapter = fixture.adapter(profile);
    try {
      for (const exp of [null, "9999999999", true, {}, []]) {
        await t.test(`exp ${JSON.stringify(exp)}`, async () => {
          await assert.rejects(adapter.authenticate(await fixture.sign(profile, { ...fixture.claims(profile), exp })), AuthenticationAdapterError);
        });
      }
      await t.test("numeric overflow", async () => {
        const claims = fixture.claims(profile);
        const raw = JSON.stringify(claims).replace(`"exp":${claims.exp}`, '"exp":1e999');
        await assert.rejects(adapter.authenticate(await fixture.sign(profile, claims, raw)), AuthenticationAdapterError);
      });
    } finally {
      await fixture.close();
    }
  });
}

test("RFC 9068 requires every applicable profile claim", async (t) => {
  const fixture = await syntheticIssuer();
  const adapter = fixture.adapter("rfc9068");
  try {
    for (const claim of ["iss", "exp", "aud", "sub", "client_id", "iat", "jti"]) {
      await t.test(`missing ${claim}`, async () => {
        const claims = fixture.claims("rfc9068");
        delete claims[claim];
        await assert.rejects(adapter.authenticate(await fixture.sign("rfc9068", claims)), AuthenticationAdapterError);
      });
    }
  } finally {
    await fixture.close();
  }
});

test("RFC 9068 validates issued-at and token-id claim types", async (t) => {
  const fixture = await syntheticIssuer();
  const adapter = fixture.adapter("rfc9068");
  try {
    for (const [claim, value] of [
      ["iat", null], ["iat", "123"], ["iat", true], ["iat", []],
      ["jti", null], ["jti", 123], ["jti", []], ["jti", ""], ["jti", "   "],
    ] as const) {
      await t.test(`${claim} ${JSON.stringify(value)}`, async () => {
        await assert.rejects(adapter.authenticate(await fixture.sign("rfc9068", {
          ...fixture.claims("rfc9068"), [claim]: value,
        })), AuthenticationAdapterError);
      });
    }
    await t.test("issued-at numeric overflow", async () => {
      const claims = fixture.claims("rfc9068");
      const raw = JSON.stringify(claims).replace(`"iat":${claims.iat}`, '"iat":1e999');
      await assert.rejects(adapter.authenticate(await fixture.sign("rfc9068", claims, raw)), AuthenticationAdapterError);
    });
  } finally {
    await fixture.close();
  }
});

test("valid profiles retain identity reduction and operator allowlist authority", async () => {
  const fixture = await syntheticIssuer();
  const operators = new ConfiguredOperatorAuthorizer([{ provider: "synthetic-oidc", subject: "synthetic-operator" }]);
  try {
    for (const profile of ["auth0", "rfc9068"] as const) {
      const claims = fixture.claims(profile);
      const context = await fixture.adapter(profile).authenticate(await fixture.sign(profile, {
        ...claims,
        exp: Number(claims.exp) + 0.5,
        ...(profile === "rfc9068" ? { iat: Number(claims.iat) - 0.5 } : {}),
        email: "synthetic-only@example.invalid",
      }));
      assert.deepEqual(context, {
        principal: { provider: "synthetic-oidc", subject: "synthetic-operator" }, channel: "operator",
      });
      assert.equal(operators.isOperator(context), true);
      assert.equal(operators.isOperator({ ...context, channel: "reviewer" }), false);
      assert.equal(operators.isOperator({ ...context, principal: { ...context.principal, subject: "unlisted" } }), false);
    }
  } finally {
    await fixture.close();
  }
});

test("required expiration retains the configured clock skew and nbf checks", async () => {
  const fixture = await syntheticIssuer();
  try {
    for (const profile of ["auth0", "rfc9068"] as const) {
      const claims = fixture.claims(profile);
      const adapter = fixture.adapter(profile, 60);
      const now = Math.floor(Date.now() / 1000);
      await adapter.authenticate(await fixture.sign(profile, { ...claims, exp: now - 10 }));
      await assert.rejects(adapter.authenticate(await fixture.sign(profile, { ...claims, exp: now - 120 })), AuthenticationAdapterError);
      await assert.rejects(adapter.authenticate(await fixture.sign(profile, { ...claims, nbf: now + 120 })), AuthenticationAdapterError);
    }
  } finally {
    await fixture.close();
  }
});
