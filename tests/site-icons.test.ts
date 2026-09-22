import test from "node:test";
import assert from "node:assert/strict";

import { siteIcon } from "../src/site/icons.js";

test("semantic Teachometry icons use the richer semantic treatment", () => {
  for (const name of [
    "diagnosis",
    "guidance",
    "actionability",
    "correctness",
    "adaptation",
    "book",
    "chart",
    "shield",
    "target",
    "leaf",
  ]) {
    const icon = siteIcon(name);
    assert.match(icon, /site-icon--semantic/);
    assert.match(icon, new RegExp(`data-icon="${name}"`));
    assert.match(icon, /stroke-width="1\.55"/);
    assert.match(icon, /shape-rendering="geometricPrecision"/);
  }
});

test("utility icons stay visually quieter than semantic pictograms", () => {
  const arrow = siteIcon("arrow");
  assert.doesNotMatch(arrow, /site-icon--semantic/);
  assert.match(arrow, /stroke-width="1\.7"/);
});

test("unknown icon names fail closed to the arrow geometry", () => {
  const icon = siteIcon("not-a-real-icon");
  assert.match(icon, /data-icon="not-a-real-icon"/);
  assert.match(icon, /M4\.5 12h14\.5/);
});
