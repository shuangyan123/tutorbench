import { readFileSync } from "node:fs";
import { hash, type Asset } from "./cards.js";
import type { PrefixLine } from "./dialogue.js";
import { bool, choices, id, invalid, language, list, localized, obj, positive, shape, str, unique } from "./schema.js";

export interface Probe { probeId: string; probeSetVersion: string; targetStudentMessage: number; protocolVersion: string;
  prefixHash: string; tutorSource: string; prefix: PrefixLine[] }
export type Phase = "G2" | "G3" | "G4";
const gate = choices("key", "rest");
const pin = shape({ file: id, hash: str });
const probe = shape({ probeId: id, gate, purpose: str, targetStudentMessage: positive,
  prefix: localized(list((v, f) => obj(v, f))), prefixHash: localized(str) });
const identity = shape({ id, version: id, contentHash: str, leaveNotBefore: positive });
export function readExpectations(path: string) {
  const e = obj(JSON.parse(readFileSync(path, "utf8")), "expectations");
  if (e.schemaVersion !== 3) invalid("expectations.schemaVersion");
  const card = identity(e.card, "expectations.card");
  const rulesVersion = id(e.rulesVersion, "expectations.rulesVersion");
  const protocol = shape({ file: id, hash: str, version: id })(e.protocol, "expectations.protocol");
  const tape = pin(e.tape, "expectations.tape");
  const probes = shape({ file: id, hash: str, probeSetVersion: id, gates: shape({ key: list(id), rest: list(id) }) })(e.probes, "expectations.probes");
  const languages = unique(list(language)(e.languages, "expectations.languages"), "expectations.languages");
  const repeats = positive(e.repeats, "expectations.repeats");
  const required = unique(list(id)(e.plannedGroups, "expectations.plannedGroups"), "expectations.plannedGroups");
  const optional = list(id)(e.optionalGroups, "expectations.optionalGroups");
  if (repeats !== 5 || languages.length !== 2 || !required.length ||
      !probes.gates.key.length || !probes.gates.rest.length) invalid("expectations.cohorts");
  return { card, rulesVersion, protocol, tape, probes, languages, repeats, required, optional,
    pins: { card, rulesVersion, protocolHash: protocol.hash, tapeHash: tape.hash, probesHash: probes.hash } };
}
export type Expectations = ReturnType<typeof readExpectations>;

function parsePrefix(lines: Record<string, unknown>[], target: number): PrefixLine[] {
  if (target < 2 || target > 15 || lines.length !== 2 * (target - 1)) invalid("probe.prefix.length");
  for (const [i, line] of lines.entries()) {
    if (i % 2) {
      shape({ role: choices("tutor"), turn: positive, text: str, source: str })(line, "probe.tutor");
      if (line.turn !== (i + 1) / 2) invalid("probe.turn");
    } else {
      const row = shape({ role: choices("student"), text: str,
        state: shape({ stage: positive, events: list(str), end: bool }),
        ...(i === 0 ? { fixed: bool } : {}) })(line, "probe.student");
      if (row.state.end || (i === 0 && (line.fixed !== true || row.state.stage !== 1 || row.state.events.length))) invalid("probe.state");
    }
  }
  // 校验结构后保留原对象的键顺序，避免改变私有前缀的哈希。
  return lines as unknown as PrefixLine[];
}
export function loadProbes(path: string, exp: Pick<Expectations, "languages" | "probes"> & { protocol: { version: string } }, asset: Asset, selection: "key" | "rest") {
  const raw = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  if (hash(raw) !== exp.probes.hash) invalid("probe.file_hash");
  const file = obj(JSON.parse(raw), "probes");
  if (file.schemaVersion !== 1 || file.probeSetVersion !== exp.probes.probeSetVersion ||
      file.protocolVersion !== asset.protocol?.version || file.rulesVersion !== asset.rulesVersion) invalid("probe.version");
  const rows = list(probe)(file.probes, "probes.rows");
  unique(rows.map(p => p.probeId), "probes.ids");
  for (const key of ["key", "rest"] as const) {
    if (JSON.stringify(rows.filter(p => p.gate === key).map(p => p.probeId).sort()) !==
        JSON.stringify([...exp.probes.gates[key]].sort())) invalid("probes.gate");
  }
  return exp.probes.gates[selection].map(probeId => {
    const p = rows.find(row => row.probeId === probeId)!;
    return Object.fromEntries(exp.languages.map(lang => {
      if (hash(JSON.stringify(p.prefix[lang])) !== p.prefixHash[lang]) invalid("probes.prefix_hash");
      const prefix = parsePrefix(p.prefix[lang], p.targetStudentMessage);
      const tutorSource = id(p.prefix[lang][1]!.source!.toString().split("#")[0], "probe.tutorSource");
      const result: Probe = { probeId, probeSetVersion: exp.probes.probeSetVersion, targetStudentMessage: p.targetStudentMessage,
        protocolVersion: exp.protocol.version, prefixHash: p.prefixHash[lang], tutorSource, prefix };
      return [lang, result];
    })) as Record<"en" | "zh-CN", Probe>;
  });
}
