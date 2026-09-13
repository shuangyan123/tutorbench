import assert from "node:assert/strict";
import test from "node:test";

import { clampScore } from "./clamp-score.mjs";

test("clampScore caps values above 100", () => {
  assert.equal(clampScore(120), 100);
});
