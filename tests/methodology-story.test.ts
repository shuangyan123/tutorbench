import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const siteScript = await readFile("website/src/site.js", "utf8");
const storyStart = siteScript.indexOf("  const story = document.querySelector('[data-method-story]')");
const storyScript = siteScript.slice(siteScript.lastIndexOf("(() => {", storyStart), siteScript.indexOf("})();", storyStart) + 5);

async function createStory(desktop = true, reduced = false) {
  let scrollY = 0;
  let shift = 0;
  let queries = 0;
  let reads = 0;
  let nextFrame = 0;
  const frames = new Map<number, () => void>();
  const listeners = new Map<string, () => void>();
  const media = [desktop, reduced].map((matches) => ({ matches, change: () => {}, addEventListener(_event: string, callback: () => void) { this.change = callback; } }));
  class Element {
    readonly style: Record<string, string> = {};
    readonly dataset: Record<string, string>;
    readonly attributes: Record<string, string> = {};
    textContent = "";
    constructor(dataset: Record<string, string> = {}, readonly top = 0, readonly bottom = 0) { this.dataset = dataset; }
    setAttribute(key: string, value: string) { this.attributes[key] = value; }
    removeAttribute(key: string) { delete this.attributes[key]; }
    getBoundingClientRect() { reads++; return { top: this.top + shift - scrollY, bottom: this.bottom + shift - scrollY }; }
    querySelector(selector: string): Element | null { queries++; return selector === "h3" ? this : selector.includes("current") ? current : null; }
    querySelectorAll(selector: string) { queries++; return selector.includes("chapter") ? chapters : selector.includes("part") ? Object.values(parts) : labels; }
  }
  const chapters = Array.from({ length: 5 }, (_, i) => new Element({}, 500 + i * 600));
  const partNames = ["reference", "trace", "deviation", "inspection", "evidence", "guided", "checkpoint-one", "checkpoint-two", "decision", "selected", "alternate", "resolve", "endpoint", "complete"];
  const parts = Object.fromEntries(partNames.map((name) => [name, new Element({ methodPart: name })]));
  const labels = ["correctness", "diagnosis", "guidance", "adaptation", "actionability"].map((name) => new Element({ methodStoryLabel: name }));
  const story = new Element({}, 400, 3500);
  const current = new Element();
  let observeVisibility = (_entries: { isIntersecting: boolean }[]) => {};
  let observeLayout = () => {};
  class VisibilityObserver {
    constructor(callback: typeof observeVisibility) { observeVisibility = callback; }
    observe() {}
    disconnect() {}
  }
  class LayoutObserver {
    constructor(callback: typeof observeLayout) { observeLayout = callback; }
    observe() {}
    disconnect() {}
  }
  runInNewContext(storyScript, {
    HTMLElement: Element,
    IntersectionObserver: VisibilityObserver,
    ResizeObserver: LayoutObserver,
    document: { querySelector: () => story, fonts: { ready: Promise.resolve() } },
    window: {
      innerHeight: 900,
      get scrollY() { return scrollY; },
      matchMedia: (query: string) => media[query.includes("901") ? 0 : 1],
      requestAnimationFrame: (callback: () => void) => { frames.set(++nextFrame, callback); return nextFrame; },
      cancelAnimationFrame: (id: number) => frames.delete(id),
      addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
      removeEventListener: (name: string) => listeners.delete(name),
    },
  });
  await Promise.resolve();
  const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback()); };
  observeVisibility([{ isIntersecting: true }]);
  flush();
  const go = (progress: number) => { scrollY = 50 + progress * 600 + shift; listeners.get("scroll")?.(); flush(); };
  const snapshot = () => JSON.stringify({ parts: Object.fromEntries(Object.entries(parts).map(([name, element]) => [name, [element.style, element.attributes]])), labels: labels.map((label) => label.style), progress: story.dataset.methodStoryProgress });
  return {
    story, parts, chapters, current, go, flush, snapshot, frames, listeners, media,
    get queries() { return queries; },
    get reads() { return reads; },
    emitScroll: () => listeners.get("scroll")?.(),
    visible: (value: boolean) => observeVisibility([{ isIntersecting: value }]),
    resize: (value: number) => { shift = value; observeLayout(); },
  };
}

test("Methodology grows a persistent scene and reverses every intermediate state exactly", async () => {
  const scene = await createStory();
  const states = new Map<number, string>();
  for (let progress = 0; progress <= 4; progress += .125) {
    scene.go(progress);
    states.set(progress, scene.snapshot());
  }
  assert.equal(scene.parts.inspection?.attributes.r, "42");
  assert.equal(scene.parts.guided?.style.strokeDashoffset, "0");
  assert.equal(scene.parts.selected?.style.strokeDashoffset, "0");
  assert.equal(scene.parts.alternate?.attributes.d, "M382 320C430 320 430 230.000 478 230.000");
  assert.equal(scene.parts.complete?.style.strokeDashoffset, "0");
  assert.equal(scene.current.textContent, "05");
  for (let progress = 4; progress >= 0; progress -= .125) {
    scene.go(progress);
    assert.equal(scene.snapshot(), states.get(progress));
  }
  assert.equal(scene.parts.inspection?.attributes.r, "4");
  assert.equal(scene.parts.guided?.style.visibility, "hidden");
  assert.equal(scene.current.textContent, "01");
});

test("Methodology slow scroll changes geometry inside a chapter; fast jumps recover directly", async () => {
  const scene = await createStory();
  scene.go(.25);
  const smallRing = Number(scene.parts.inspection?.attributes.r);
  scene.go(.75);
  assert.ok(Number(scene.parts.inspection?.attributes.r) > smallRing);
  assert.equal(scene.story.dataset.methodStoryActiveIndex, "0");
  scene.go(1.25);
  const shortPath = Number(scene.parts.guided?.style.strokeDashoffset);
  scene.go(1.75);
  assert.ok(Number(scene.parts.guided?.style.strokeDashoffset) < shortPath);
  scene.go(3);
  const alternate = scene.parts.alternate?.attributes.d;
  scene.go(3.5);
  assert.notEqual(scene.parts.alternate?.attributes.d, alternate);
  scene.go(4);
  const finished = scene.snapshot();
  scene.go(0);
  scene.go(4);
  assert.equal(scene.snapshot(), finished);
});

test("Methodology coalesces frames, caches layout and stops work offscreen", async () => {
  const scene = await createStory();
  const queries = scene.queries;
  const reads = scene.reads;
  for (let i = 0; i < 20; i++) scene.emitScroll();
  assert.equal(scene.frames.size, 1);
  scene.flush();
  assert.equal(scene.queries, queries);
  assert.equal(scene.reads, reads);
  scene.emitScroll();
  scene.visible(false);
  assert.equal(scene.frames.size, 0);
  scene.go(3.5);
  assert.equal(scene.frames.size, 0);
  scene.visible(true);
  scene.flush();
  assert.equal(scene.story.dataset.methodStoryProgress, "0.8750");
  scene.resize(120);
  scene.go(2);
  assert.ok(scene.reads > reads);
  assert.equal(scene.story.dataset.methodStoryProgress, "0.5000");
});

test("Methodology disables tracking for fallback and resets cleanly when preferences change", async () => {
  for (const [desktop, reduced] of [[false, false], [true, true]]) {
    const scene = await createStory(desktop, reduced);
    assert.equal(scene.listeners.has("scroll"), false);
    assert.equal(scene.story.dataset.methodStoryEnhanced, undefined);
  }
  const scene = await createStory();
  scene.go(4);
  scene.emitScroll();
  scene.media[1]!.matches = true;
  scene.media[1]!.change();
  assert.equal(scene.frames.size, 0);
  assert.equal(scene.story.dataset.methodStoryProgress, undefined);
  assert.ok(scene.chapters.every((chapter) => chapter.attributes["aria-current"] === undefined));
  scene.media[1]!.matches = false;
  scene.media[1]!.change();
  scene.visible(true);
  scene.flush();
  assert.equal(scene.story.dataset.methodStoryProgress, "1.0000");
  scene.go(0);
  assert.equal(scene.parts.complete?.style.visibility, "hidden");
});
