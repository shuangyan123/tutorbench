/** Local Host capability, separate from Provider credentials; never include its value in errors. */
export function parseCanonicalHostSessionToken(value: unknown): string {
  if (typeof value !== "string" || value.length !== 64 || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError("CANONICAL_MODEL_HOST_TOKEN must be a fresh 32-byte random lowercase hex value.");
  }
  return value;
}
