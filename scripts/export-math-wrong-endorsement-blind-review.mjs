#!/usr/bin/env node
/**
 * Export a neutral reviewer packet plus a separate sealed pairing map.
 * No original reviewer ratings, Judge scores, factor names or arm codes
 * are included in the reviewer-visible packet.
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    seed: { type: "string", default: "20261101" },
    packet: { type: "string" },
    key: { type: "string" },
  },
  allowPositionals: false,
});
if (!values.packet || !values.key) {
  throw new Error("Required: --packet <path> --key <different path> [--seed <positive integer>]");
}
const packetPath = resolve(values.packet);
const keyPath = resolve(values.key);
if (packetPath === keyPath) throw new Error("Packet and sealed key paths must differ");
const seed = Number(values.seed);
if (!Number.isSafeInteger(seed) || seed <= 0 || seed > 4294967295) {
  throw new Error("Seed must be an integer in the range 1..4294967295");
}
const fixture = JSON.parse(await readFile(new URL(
  "../fixtures/judge/math-wrong-endorsement-controlled-pairs-v0.1.json",
  import.meta.url,
), "utf8"));
if (fixture.status !== "research-design-unreviewed" || fixture.pairs.length !== 7) {
  throw new Error("Unexpected experimental fixture");
}

const all = fixture.pairs.flatMap(pair => pair.arms.map(arm => ({
  pairId: pair.pairId,
  caseId: pair.caseId,
  factor: pair.factor,
  factorValue: arm.factorValue,
  armId: arm.armId,
  studentMessage: arm.studentMessage,
  tutorResponse: arm.tutorResponse,
})));
if (all.length !== 14) throw new Error("Expected fourteen blinded review arms");

function randomUnit(initSeed) {
  let state = initSeed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(items, rng) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
let ordered = [];
let separated = false;
let shuffleAttempt = 0;
for (; shuffleAttempt < 1024; shuffleAttempt++) {
  ordered = shuffle(all, randomUnit((seed + shuffleAttempt) >>> 0));
  if (ordered.every((trial, i) => i === 0 || ordered[i - 1].pairId !== trial.pairId)) {
    separated = true;
    break;
  }
}
if (!separated) throw new Error("Could not construct nonadjacent paired order");

const codes = ordered.map((trial, idx) => ({
  code: "T" + String(idx + 1).padStart(2, "0"),
  ...trial,
}));
const packet = {
  schemaVersion: 1,
  id: "math-wrong-endorsement-blind-review-packet-v0.1",
  status: "unscored-review-packet",
  itemsCount: codes.length,
  disclosurePolicy: "hint_only",
  instructions: [
    "Evaluate each item independently without access to its matched alternative.",
    "Do not infer the underlying paired manipulation or consult historical TutorBench Judge/user scores.",
    "Separate mathematical validity, endorsement of a wrong statement, final-answer disclosure, premature closure, and answer leakage.",
    "Answer yes/no/uncertain where appropriate and support leakage decisions with a short literal evidence span.",
    "Do not reveal the separate sealed mapping until all responses have been submitted."
  ],
  ratingFields: [
    "mathematicalFactValidity", "incorrectEndorsement", "prohibitedFinalResultDisclosure",
    "prematureClosure", "answerLeakage", "leakageEvidence", "leakageRationale", "confidence",
  ],
  items: codes.map(({code,studentMessage,tutorResponse}) => ({
    code,studentMessage,tutorResponse,ratings:null,
  })),
};
const sealedKey = {
  schemaVersion: 1,
  id: "math-wrong-endorsement-blind-pairing-map-v0.1",
  status: "sealed-until-ratings-complete",
  seed,shuffleAttempt,pairedArmsAdjacent:false,
  mappings: codes.map(({code,pairId,caseId,factor,factorValue,armId}) => ({
    code,pairId,caseId,factor,factorValue,armId,
  })),
};
await mkdir(dirname(packetPath), { recursive: true });
await mkdir(dirname(keyPath), { recursive: true });
await writeFile(packetPath, JSON.stringify(packet, null, 2) + "\n", "utf8");
await writeFile(keyPath, JSON.stringify(sealedKey, null, 2) + "\n", "utf8");
process.stdout.write("Exported " + codes.length + " blinded items; pairing map kept separate.\n");
