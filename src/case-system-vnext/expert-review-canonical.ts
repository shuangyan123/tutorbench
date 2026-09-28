function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalCaseSystemVNextExpertReviewJson(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) {
    return `[${value.map(canonicalCaseSystemVNextExpertReviewJson).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([key, item]) =>
        `${JSON.stringify(key)}:${canonicalCaseSystemVNextExpertReviewJson(item)}`
      )
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("Case System vNext expert review JSON value is invalid.");
  }
  return serialized;
}

export function sameCaseSystemVNextExpertReviewJson(
  left: unknown,
  right: unknown,
): boolean {
  return canonicalCaseSystemVNextExpertReviewJson(left) ===
    canonicalCaseSystemVNextExpertReviewJson(right);
}
