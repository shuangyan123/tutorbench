function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalCaseSystemVNextExpertReviewJson(value: unknown): string {
  if (value === null) return "null";
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
  return JSON.stringify(value);
}

export function sameCaseSystemVNextExpertReviewJson(
  left: unknown,
  right: unknown,
): boolean {
  return canonicalCaseSystemVNextExpertReviewJson(left) ===
    canonicalCaseSystemVNextExpertReviewJson(right);
}
