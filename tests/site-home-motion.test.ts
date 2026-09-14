import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

test("reduced motion leaves homepage content visible without a reveal observer", async () => {
  const source = await readFile("website/src/site.js", "utf8");
  class Element {
    dataset: Record<string, string> = {};
    addEventListener() { /* No user input is dispatched in this motion test. */ }
  }
  const home = new Element();
  let observerCreated = false;
  runInNewContext(source, {
    HTMLElement: Element,
    HTMLButtonElement: Element,
    HTMLFormElement: Element,
    HTMLSelectElement: Element,
    document: {
      documentElement: { dataset: { uiLocale: "en" } },
      querySelector: (selector: string) => selector === ".home-page" ? home : null,
      querySelectorAll: () => [],
    },
    window: {
      localStorage: { getItem: () => null },
      matchMedia: (query: string) => ({ matches: query.includes("prefers-reduced-motion"), addEventListener() {} }),
      IntersectionObserver: class {
        constructor() { observerCreated = true; }
      },
    },
  });
  assert.equal(observerCreated, false);
  assert.equal(home.dataset.theme, "light");
});
