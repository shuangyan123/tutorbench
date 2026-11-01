import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import type { ConnectionOptions } from "node:tls";

import { Client } from "pg";

import {
  CommunityReviewConfigurationError,
  loadCommunityReviewConfig,
  type CommunityReviewServiceConfig,
} from "../src/config.js";
import { PostgreSQLCommunityReviewRepository } from "../src/postgres-repository.js";
import { createCommunityReviewPostgresRepository } from "../src/runtime.js";

const databaseUrl = "postgresql://db.example.invalid/review";

function config(
  overrides: NodeJS.ProcessEnv = {},
  command: "serve" | "readiness" | "migrate" = "migrate",
): CommunityReviewServiceConfig {
  return loadCommunityReviewConfig({
    command,
    env: {
      COMMUNITY_REVIEW_ENV: "production",
      COMMUNITY_REVIEW_STORAGE: "postgres",
      COMMUNITY_REVIEW_DATABASE_URL: databaseUrl,
      COMMUNITY_REVIEW_AUTH_MODE: "oidc",
      COMMUNITY_REVIEW_OIDC_PROVIDER: "example-oidc",
      COMMUNITY_REVIEW_OIDC_ISSUER: "https://issuer.example.invalid/",
      COMMUNITY_REVIEW_OIDC_AUDIENCE: "review",
      COMMUNITY_REVIEW_OIDC_JWKS_URI: "https://issuer.example.invalid/jwks",
      COMMUNITY_REVIEW_OPERATOR_SUBJECTS: "example-oidc|synthetic-operator",
      COMMUNITY_REVIEW_MATERIAL_ROOT: resolve(tmpdir(), "tutorbench-tls-test-material"),
      ...overrides,
    },
  });
}

function configurationCode(code: CommunityReviewConfigurationError["code"]): (error: unknown) => boolean {
  return (error) => error instanceof CommunityReviewConfigurationError && error.code === code;
}

async function effectiveSsl(configuration: CommunityReviewServiceConfig): Promise<boolean | ConnectionOptions> {
  const repository = createCommunityReviewPostgresRepository(configuration);
  try {
    // 只构造真实驱动以执行最终参数解析；不调用 connect/query，也不打开数据库连接。
    const client = new Client(repository.getPool().options);
    // @types/pg 将 Client.ssl 声明为 boolean，但驱动也在此保存 TLS options。
    return client.ssl as unknown as boolean | ConnectionOptions;
  } finally {
    await repository.close();
  }
}

function assertVerified(ssl: boolean | ConnectionOptions): void {
  assert.ok(typeof ssl === "object" && ssl !== null);
  assert.equal(ssl.rejectUnauthorized, true);
  assert.equal(ssl.checkServerIdentity, undefined);
}

for (const command of ["serve", "readiness", "migrate"] as const) {
  test(`production ${command} keeps certificate verification in real pg configuration`, async () => {
    const configuration = config({
      COMMUNITY_REVIEW_DATABASE_URL: `${databaseUrl}?application_name=tls-test&statement_timeout=2500`,
    }, command);
    assertVerified(await effectiveSsl(configuration));
  });
}

const forbiddenQueries = [
  ["ssl disabled", "ssl=0"],
  ["ssl unverified", "ssl=no-verify"],
  ["ssl boolean", "ssl=true"],
  ["ssl empty", "ssl="],
  ["mode disabled", "sslmode=disable"],
  ["mode unverified", "sslmode=no-verify"],
  ["mode verified", "sslmode=verify-full"],
  ["client certificate", "sslcert=synthetic-missing-cert"],
  ["client key", "sslkey=synthetic-missing-key"],
  ["root certificate", "sslrootcert=synthetic-missing-ca"],
  ["negotiation", "sslnegotiation=direct"],
  ["libpq compatibility", "uselibpqcompat=true"],
  ["libpq weaker mode", "uselibpqcompat=true&sslmode=require"],
  ["uppercase", "SSL=0"],
  ["mixed case", "sSlMoDe=disable"],
  ["encoded ssl name", "%73sl=0"],
  ["encoded mode name", "%53%53%4c%4d%4f%44%45=disable"],
  ["encoded compatibility name", "%75selibpqcompat=true"],
  ["duplicate insecure last", "ssl=true&ssl=0"],
  ["duplicate secure last", "ssl=0&ssl=true"],
  ["encoded duplicate", "ssl=true&%73sl=no-verify"],
  ["duplicate mixed case", "sslmode=verify-full&SSLMODE=disable"],
  ["empty duplicate", "ssl=&ssl="],
  ["future ssl option", "ssl_future_option=0"],
  ["tls family", "tls=0"],
  ["encoded tls family", "%74ls.rejectUnauthorized=false"],
  ["encoded value", "ssl=no%2dverify"],
  ["space preprocessing", "application_name=tls test&%73sl=0"],
  ["malformed escape preprocessing", "application_name=%zz&%73sl=0"],
] as const;

for (const [name, query] of forbiddenQueries) {
  test(`TLS URL policy fails closed for ${name} at configuration and repository boundaries`, () => {
    const connectionString = `${databaseUrl}?${query}`;
    for (const environment of ["production", "development", "test"] as const) {
      assert.throws(
        () => config({ COMMUNITY_REVIEW_ENV: environment, COMMUNITY_REVIEW_DATABASE_URL: connectionString }),
        configurationCode("database_invalid"),
      );
    }
    // 防止直接构造 config/repository 绕过配置入口；必须在 pg 读取证书文件前拒绝。
    assert.throws(
      () => createCommunityReviewPostgresRepository({ ...config(), databaseUrl: connectionString }),
      configurationCode("database_invalid"),
    );
    assert.throws(
      () => new PostgreSQLCommunityReviewRepository({
        connectionString,
        poolConfig: { ssl: { rejectUnauthorized: true } },
      }),
      configurationCode("database_invalid"),
    );
  });
}

test("both URL sources use the same TLS policy without falling back to another URL", () => {
  assert.throws(() => config({
    COMMUNITY_REVIEW_DATABASE_URL: undefined,
    DATABASE_URL: `${databaseUrl}?ssl=0`,
  }), configurationCode("database_invalid"));
  assert.throws(() => config({
    COMMUNITY_REVIEW_DATABASE_URL: `${databaseUrl}?ssl=no-verify`,
    DATABASE_URL: databaseUrl,
  }), configurationCode("database_invalid"));
});

for (const overrides of [
  { COMMUNITY_REVIEW_DATABASE_SSL: "disable" },
  { COMMUNITY_REVIEW_DATABASE_SSL_REJECT_UNAUTHORIZED: "false" },
] as const) {
  test(`production rejects unsafe application TLS option ${Object.keys(overrides)[0]}`, () => {
    assert.throws(() => config(overrides), configurationCode("database_tls_required"));
  });
}

test("repository factory rejects hand-built unsafe production TLS configurations", () => {
  for (const override of [{ databaseSsl: false }, { databaseSslRejectUnauthorized: false }]) {
    assert.throws(
      () => createCommunityReviewPostgresRepository({ ...config(), ...override }),
      configurationCode("database_tls_required"),
    );
  }
});

test("production TLS is authoritative over ambient pg SSL defaults", async () => {
  const previous = process.env.PGSSLMODE;
  try {
    for (const mode of ["disable", "no-verify"]) {
      process.env.PGSSLMODE = mode;
      assertVerified(await effectiveSsl(config()));
    }
  } finally {
    if (previous === undefined) delete process.env.PGSSLMODE;
    else process.env.PGSSLMODE = previous;
  }
});

test("normal URLs and unrelated query options retain real driver parsing", async () => {
  for (const protocol of ["postgres", "postgresql"]) {
    const repository = createCommunityReviewPostgresRepository(config({
      COMMUNITY_REVIEW_DATABASE_URL: `${protocol}://db.example.invalid/review?application_name=tls-test`,
    }));
    try {
      const client = new Client(repository.getPool().options);
      assert.equal(client.host, "db.example.invalid");
      assert.equal(client.database, "review");
      const parameters = (client as unknown as {
        connectionParameters: { application_name: string };
      }).connectionParameters;
      assert.equal(parameters.application_name, "tls-test");
      assertVerified(client.ssl as unknown as ConnectionOptions);
    } finally {
      await repository.close();
    }
  }
});

test("double-encoded and unrecognized query names cannot weaken real pg TLS options", async () => {
  for (const query of ["%2573sl=0", "rejectUnauthorized=false", "checkServerIdentity=no-verify"]) {
    assertVerified(await effectiveSsl(config({ COMMUNITY_REVIEW_DATABASE_URL: `${databaseUrl}?${query}` })));
  }
});

for (const environment of ["development", "test"]) {
  test(`${environment} retains explicit TLS and local plaintext configuration`, async () => {
    assert.equal(await effectiveSsl(config({ COMMUNITY_REVIEW_ENV: environment })), false);
    assertVerified(await effectiveSsl(config({
      COMMUNITY_REVIEW_ENV: environment,
      COMMUNITY_REVIEW_DATABASE_SSL: "require",
    })));
    const ssl = await effectiveSsl(config({
      COMMUNITY_REVIEW_ENV: environment,
      COMMUNITY_REVIEW_DATABASE_SSL: "require",
      COMMUNITY_REVIEW_DATABASE_SSL_REJECT_UNAUTHORIZED: "false",
    }));
    assert.ok(typeof ssl === "object" && ssl !== null);
    assert.equal(ssl.rejectUnauthorized, false);
  });
}

test("invalid URLs fail closed and configuration errors contain no input credentials", () => {
  const invalidInputs = [
    "not-a-url", "https://db.example.invalid/review", `${databaseUrl}#fragment`,
    "postgresql://synthetic-user:synthetic-password@db.example.invalid/review?ssl=0",
  ];
  for (const input of invalidInputs) {
    assert.throws(() => config({ COMMUNITY_REVIEW_DATABASE_URL: input }), (error: unknown) => {
      assert.ok(error instanceof CommunityReviewConfigurationError);
      assert.equal(error.code, "database_invalid");
      assert.ok(!String(error).includes("synthetic-user"));
      assert.ok(!String(error).includes("synthetic-password"));
      assert.ok(!String(error).includes(input));
      return true;
    });
  }
});
