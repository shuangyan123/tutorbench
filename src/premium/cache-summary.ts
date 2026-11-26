import { sumKnown, sumUsd, type Call } from "./provider.js";
import type { RunRecord } from "./runner.js";

function summarize(calls: Call[]) {
  // 未发出的重试无缓存观测；其零费用仍在原调用账本中。
  const dispatched = calls.filter(c => c.error !== "not_dispatched" && c.error !== "mock_not_dispatched");
  const inputCalls = dispatched.filter(c => c.usage?.inputTokens !== 0 || c.cache?.hitTokens != null);
  const hitTokens = sumKnown(inputCalls.map(c => c.cache?.hitTokens ?? null));
  const missTokens = sumKnown(inputCalls.map(c => c.cache?.missTokens ?? null));
  return { calls: dispatched.length, observedCalls: dispatched.filter(c => c.cache?.hitTokens != null).length,
    hitTokens, missTokens, hitRate: hitTokens !== null && missTokens !== null && hitTokens + missTokens > 0
      ? hitTokens / (hitTokens + missTokens) : null,
    hitUsd: sumUsd(inputCalls.map(c => c.cache?.hitUsd ?? null)), missUsd: sumUsd(inputCalls.map(c => c.cache?.missUsd ?? null)),
    chargedUsd: sumUsd(calls.map(c => c.usd)), estimatedCalls: calls.filter(c => c.costEstimated).length };
}

export function batchCache(records: RunRecord[]) {
  // 原记录已包含初评。重新评审只追加后续评分；被替代的对话仍然付费。
  const calls = records.flatMap(r => [...r.calls, ...r.scorings.slice(1).flatMap(s => s.calls)]);
  const groups = new Map<string, Call[]>();
  for (const c of calls) {
    const group = groups.get(c.model);
    if (group) group.push(c);
    else groups.set(c.model, [c]);
  }
  const byModel = [...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([model, group]) => ({
    model, ...summarize(group), hitUsdPerMillion: group[0]?.cache?.hitUsdPerMillion ?? null,
    missUsdPerMillion: group[0]?.cache?.missUsdPerMillion ?? null,
  }));
  return { ...summarize(calls), byModel };
}
