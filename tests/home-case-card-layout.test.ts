import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Source guards for the homepage case card. The rendered geometry (status badges
// on one line, rows inside the preview, no overlap with the card footer) is
// asserted in a real browser by scripts/website-hit-test.mjs (caseCardProbe),
// which CI runs after the website build; these checks keep the rules it relies on.

const homeCss = await readFile(join("website", "src", "home.css"), "utf8");
const hitTest = await readFile(join("scripts", "website-hit-test.mjs"), "utf8");

const rule = (source: string, selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = source.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "u"));
  assert.ok(match, `missing rule ${selector}`);
  return match[1] ?? "";
};

test("case card status column is sized by its text, not a fixed width", () => {
  const preview = rule(homeCss, ".rubric-preview");
  assert.match(preview, /grid-template-columns: minmax\(min-content, max-content\) minmax\(24px, 1fr\) max-content;/u);
  assert.match(rule(homeCss, ".rubric-row"), /grid-template-columns: subgrid;/u);
  assert.match(rule(homeCss, ".score-pending"), /white-space: nowrap;/u);
  // No breakpoint may pin the dimension or status column to a pixel width again.
  assert.doesNotMatch(homeCss, /\.rubric-row \{[^}]*grid-template-columns: \d+px/u);
});

test("case card preview grows with its rows instead of a fixed height", () => {
  assert.doesNotMatch(homeCss, /\.rubric-preview[^{]*\{[^}]*(?<!min-)height: \d+px/u, "a fixed height clips the five dimensions");
  assert.doesNotMatch(homeCss, /\.rubric-preview[^{]*\{[^}]*overflow: hidden/u);
  assert.match(homeCss, /\.walkthrough-bottom \{[^}]*flex-wrap: wrap;/u);
});

test("a narrow preview rearranges rows instead of squeezing them", () => {
  assert.match(rule(homeCss, ".rubric-preview"), /container-type: inline-size;/u);
  const narrow = homeCss.match(/@container \(max-width: [\d.]+em\) \{([\s\S]*?)\n\}/u)?.[1] ?? "";
  assert.match(narrow, /\.rubric-row \{ grid-template-columns: minmax\(0, 1fr\) max-content;/u);
  assert.match(narrow, /\.rubric-row > \.score-track \{ grid-column: 1 \/ -1; grid-row: 2; \}/u);
});

test("the browser hit test checks the case card across the affected widths", () => {
  assert.match(hitTest, /export async function caseCardProbe\(\)/u);
  assert.match(hitTest, /for \(const width of \[390, 901, 1024, 1200, 1201, 1440\]\)/u);
  assert.match(hitTest, /status of \$\{label\} on \$\{lines\} lines/u);
  assert.match(hitTest, /preview overlaps the card footer/u);
  assert.match(hitTest, /ArrowRight/u);
});
