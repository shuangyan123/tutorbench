/** Pair by caller-supplied row identity. Missing judgments never enter the denominator. */
export function summarizeMeasurementPairs<Row>(
  rows: readonly Row[],
  left: (row: Row) => string | null,
  right: (row: Row) => string | null,
) {
  const pairs = rows.flatMap((row) => {
    const a = left(row);
    const b = right(row);
    return a === null || b === null ? [] : [{ a, b }];
  });
  const matrix: Record<string, number> = {};
  for (const { a, b } of pairs) {
    const key = `${a}__${b}`;
    matrix[key] = (matrix[key] ?? 0) + 1;
  }
  const disagreements = pairs.filter(({ a, b }) => a !== b).length;
  const rate = (count: number) => pairs.length === 0 ? null : count / pairs.length;
  const leftPassCount = pairs.filter(({ a }) => a === "PASS").length;
  const rightPassCount = pairs.filter(({ b }) => b === "PASS").length;
  return {
    validSamples: pairs.length, disagreements, disagreementRate: rate(disagreements),
    leftPassRate: rate(leftPassCount), rightPassRate: rate(rightPassCount),
    rightMinusLeftPassRatePoints: pairs.length === 0 ? null : 100 * (rightPassCount - leftPassCount) / pairs.length,
    matrix: Object.fromEntries(Object.entries(matrix).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)),
  };
}
