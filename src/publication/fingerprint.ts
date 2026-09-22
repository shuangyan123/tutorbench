import { createHash } from "node:crypto";

export const SHA256_FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export function sha256Fingerprint(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function isSha256Fingerprint(value: unknown): value is string {
  return typeof value === "string" && SHA256_FINGERPRINT_PATTERN.test(value);
}

export function stableDigest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}
