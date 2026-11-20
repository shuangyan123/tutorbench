import { createHash } from "node:crypto";
import { parseMathematicsKnowledgeMap, type MathematicsKnowledgeMap } from "../contracts/mathematics-knowledge-map.js";
import type { inspectRequirements } from "./exam-requirements.js";

type Baseline = ReturnType<typeof inspectRequirements>;
const categories = ["existing-concept-can-map", "new-concept-needed", "refine-concept-or-relation", "remain-unmapped"] as const;
type Category = typeof categories[number];

function check(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error("exam_gap_invalid: " + reason);
}
function record(value: unknown, fields: string[]) {
  check(typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key)), "fields");
  return value as Record<string, unknown>;
}
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function applyGapSnapshot(input: unknown, baseInput: unknown, graph: MathematicsKnowledgeMap, baseline: Baseline) {
  check(digest(baseInput) === "829885928e34fe586ddd6840ca449ec435daad9b3d79559b9a9ce8791f9a8967" &&
    digest(graph) === "b06035ce81a569f16e46651d65dcdbd58a76fb37901fe202bc1ea99c51f2d9eb", "historical pins");
  const root = record(input, ["version", "baseInventory", "baseGraph", "graphVersion", "addedNodes", "dispositions"]);
  check(root.version === "0.3.0" && root.baseInventory === baseline.version && root.baseGraph === baseline.graph &&
    root.graphVersion === "0.3.0" && Array.isArray(root.addedNodes) && Array.isArray(root.dispositions), "release pins");
  const extended = parseMathematicsKnowledgeMap({ ...graph, version: root.graphVersion, nodes: [...graph.nodes, ...root.addedNodes] });
  const existing = new Set(graph.nodes.map(node => node.id));
  const additions = extended.nodes.slice(graph.nodes.length);
  check(additions.every(node => !node.prerequisiteIds.length), "unsupported prerequisite");
  const gaps = new Map(baseline.requirements.filter(row => row.alignment_status === "unmapped").map(row => [row.requirement_id, row]));
  const claimed = new Set<string>();
  const used = new Set<string>();
  const dispositions = (root.dispositions as unknown[]).map(value => {
    const row = record(value, ["requirement", "edition", "sha256", "category", "fit", "focus", "missingConcept", "neighbors", "rationale"]);
    const leaf = typeof row.requirement === "string" ? gaps.get(row.requirement) : undefined;
    check(leaf && !claimed.has(leaf.requirement_id) && row.edition === leaf.source_edition && row.sha256 === leaf.source_sha256, "clause binding");
    claimed.add(leaf.requirement_id);
    check(categories.includes(row.category as Category) && typeof row.rationale === "string" && row.rationale.trim().length > 0 &&
      Array.isArray(row.neighbors) && row.neighbors.length && row.neighbors.every(id => existing.has(id)) &&
      new Set(row.neighbors).size === row.neighbors.length, "semantic evidence");
    const category = row.category as Category;
    const focus = row.focus;
    const missing = row.missingConcept;
    check(category === "new-concept-needed" ? typeof missing === "string" && /^[a-z][a-z0-9-]+$/.test(missing) && !existing.has(missing) : missing === null, "missing concept");
    if (focus !== null) {
      check(typeof focus === "string" && row.fit === "full" &&
        (category === "existing-concept-can-map" ? existing.has(focus) :
          category === "new-concept-needed" && missing === focus && additions.some(node => node.id === focus)), "unsupported focus");
      used.add(focus);
    } else check(row.fit === "partial" && category !== "existing-concept-can-map", "partial overlap");
    return { requirement: leaf.requirement_id, edition: leaf.source_edition, sha256: leaf.source_sha256,
      locator: leaf.locator, category, fit: row.fit, focus, missingConcept: missing, neighbors: row.neighbors as string[], rationale: row.rationale };
  }).sort((left, right) => left.requirement < right.requirement ? -1 : 1);
  check(claimed.size === gaps.size && additions.every(node => used.has(node.id)), "missing disposition or orphan addition");
  check(digest(input) === "c0ab81307ebbda191161175c5205fda0b208225731d6bb9fc4e2863276e965e0", "changed 0.3.0 snapshot");
  const focusByLeaf = new Map(dispositions.map(row => [row.requirement, row.focus]));
  // 只覆盖旧版未映射行；不允许决定表替换既有候选、增删要求或改变分母。
  const inventory = structuredClone(baseInput) as { version: string; scopes: unknown[]; requirements: Array<{ scope: string; anchor: string; concept: string | null; status: string }> };
  inventory.version = root.version;
  for (const row of inventory.requirements) {
    const focus = focusByLeaf.get(row.scope + "/" + row.anchor);
    if (focus) { row.concept = focus; row.status = "aligned-author-proposed"; }
  }
  return { extended, inventory, audit: { baseInventory: baseline.version, baseGraph: baseline.graph, dispositions,
    categoryCounts: Object.fromEntries(categories.map(category => [category, dispositions.filter(row => row.category === category).length])),
    missingConcepts: [...new Set(dispositions.flatMap(row => typeof row.missingConcept === "string" ? [row.missingConcept] : []))].sort(),
    addedNodes: additions, independentSemanticReviews: 0 } };
}
