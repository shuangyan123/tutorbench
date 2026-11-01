import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

interface ReviewPacket {
  schemaVersion: number;
  id: string;
  status: string;
  itemsCount: number;
  disclosurePolicy: string;
  instructions: string[];
  ratingFields: string[];
  items: Array<{
    code: string;
    studentMessage: string;
    tutorResponse: string;
    ratings: null;
  }>;
}
interface SealedKey {
  status: string;
  seed: number;
  pairedArmsAdjacent: boolean;
  mappings: Array<{
    code: string;
    pairId: string;
    caseId: string;
    factor: string;
    factorValue: string;
    armId: string;
  }>;
}

test("blind exporter separates fourteen reviewer-visible responses from experiment metadata", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tutorbench-math-blind-"));
  try {
    const packetFile = join(dir, "review-packet.json");
    const keyFile = join(dir, "sealed-mapping.json");
    const run = () => execFileSync(process.execPath, [
      "scripts/export-math-wrong-endorsement-blind-review.mjs",
      "--packet", packetFile, "--key", keyFile, "--seed", "20261101",
    ], { cwd: process.cwd(), encoding: "utf8" });
    assert.match(run(), /14 blinded items/u);
    const packetText = await readFile(packetFile, "utf8");
    const packet = JSON.parse(packetText) as ReviewPacket;
    const key = JSON.parse(await readFile(keyFile, "utf8")) as SealedKey;
    assert.equal(packet.schemaVersion, 1);
    assert.equal(packet.id, "math-wrong-endorsement-blind-review-packet-v0.1");
    assert.equal(packet.status, "unscored-review-packet");
    assert.equal(packet.disclosurePolicy, "hint_only");
    assert.equal(packet.itemsCount, 14);
    assert.equal(packet.items.length, 14);
    assert.equal(key.status, "sealed-until-ratings-complete");
    assert.equal(key.seed, 20261101);
    assert.equal(key.pairedArmsAdjacent, false);
    assert.equal(key.mappings.length, 14);
    assert.ok(packet.ratingFields.includes("answerLeakage"));
    const codes = new Set<string>();
    for (const item of packet.items) {
      assert.ok(!codes.has(item.code));
      codes.add(item.code);
      assert.equal(item.ratings, null);
      assert.ok(item.studentMessage.length > 50);
      assert.ok(item.tutorResponse.length > 25);
    }
    assert.deepEqual([...codes].sort(), Array.from({length:14}, (_,i) =>
      "T" + String(i+1).padStart(2,"0"),
    ));
    assert.deepEqual(key.mappings.map(x => x.code), packet.items.map(x => x.code));
    assert.equal(new Set(key.mappings.map(x => x.pairId)).size, 7);
    const allPairs = new Map<string, string[]>();
    for (const map of key.mappings) {
      const arms = allPairs.get(map.pairId) ?? [];
      arms.push(map.armId);
      allPairs.set(map.pairId, arms);
    }
    for (const arms of allPairs.values()) {
      assert.deepEqual(arms.sort(), ["A", "B"]);
    }
    for (let i = 1; i < key.mappings.length; i++) {
      assert.notEqual(key.mappings[i]?.pairId, key.mappings[i-1]?.pairId);
    }
    for (const hidden of [
      "pairId", "factorValue", "sourceReviewSequence", "sourceVariantId",
      "sourceUserReview", "sourceContrastFixture", "originalJudgeLabel",
      "armId", "caseId",
    ]) {
      assert.equal(packetText.includes('"' + hidden + '"'), false);
    }
    assert.match(packet.instructions.join(" "), /separate sealed mapping/u);

    assert.match(run(), /14 blinded items/u);
    assert.equal(await readFile(packetFile, "utf8"), packetText);
  } finally {
    await rm(dir, { recursive:true, force:true });
  }
});
