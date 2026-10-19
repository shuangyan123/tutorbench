import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const siteScript = await readFile("website/src/site.js", "utf8");
const storyStart = siteScript.indexOf("  const story = document.querySelector('[data-method-story]')");
const storyScript = siteScript.slice(siteScript.lastIndexOf("(() => {", storyStart), siteScript.indexOf("})();", storyStart) + 5);

type Box = { top: number; bottom: number; left: number; right: number; width: number; height: number };
const box = (left: number, top: number, width: number, height: number): Box => ({ left, top, width, height, right: left + width, bottom: top + height });

interface StoryGeometry {
  /** Viewport height. */
  innerHeight?: number;
  /** Stage height for the story's current data-* state (lets a test see which state was measured). */
  stageHeight?: (dataset: Record<string, string>) => number;
  /** Label boxes for the story's current data-* state, inside a 600 x 300 canvas at (0, 0). */
  labelBoxes?: (dataset: Record<string, string>) => Box[];
}

async function createStory(desktop = true, reduced = false, geometry: StoryGeometry = {}) {
  let scrollY = 0;
  let innerHeight = geometry.innerHeight ?? 900;
  let shift = 0;
  let queries = 0;
  let reads = 0;
  let nextFrame = 0;
  const frames = new Map<number, () => void>();
  const listeners = new Map<string, Set<() => void>>();
  const emit = (name: string) => [...(listeners.get(name) ?? [])].forEach((callback) => callback());
  const media = [desktop, reduced].map((matches) => ({ matches, change: () => {}, addEventListener(_event: string, callback: () => void) { this.change = callback; } }));
  class Element {
    readonly style: Record<string, string> = {};
    readonly dataset: Record<string, string>;
    readonly attributes: Record<string, string> = {};
    textContent = "";
    rect: (() => Box) | null = null;
    constructor(dataset: Record<string, string> = {}, readonly top = 0, readonly bottom = 0) { this.dataset = dataset; }
    setAttribute(key: string, value: string) { this.attributes[key] = value; }
    removeAttribute(key: string) { delete this.attributes[key]; }
    getBoundingClientRect() {
      reads++;
      if (this.rect) return this.rect();
      return { ...box(0, this.top + shift - scrollY, 0, this.bottom - this.top), bottom: this.bottom + shift - scrollY };
    }
    querySelector(selector: string): Element | null {
      queries++;
      if (selector === "h3") return this;
      if (selector.includes("current")) return current;
      if (selector.includes("stage")) return geometry.stageHeight ? stage : null;
      if (selector.includes("canvas")) return geometry.labelBoxes ? canvas : null;
      return null;
    }
    querySelectorAll(selector: string) {
      queries++;
      if (selector.includes("chapter")) return chapters;
      if (selector.includes("part")) return Object.values(parts);
      if (selector.includes("rail")) return railLinks;
      if (selector.includes("key")) return keys;
      return labels;
    }
  }
  const chapters = Array.from({ length: 5 }, (_, i) => new Element({}, 500 + i * 600));
  const partNames = ["reference", "trace", "deviation", "inspection", "evidence", "guided", "checkpoint-one", "checkpoint-two", "decision", "selected", "alternate", "resolve", "endpoint", "complete"];
  const parts = Object.fromEntries(partNames.map((name) => [name, new Element({ methodPart: name })]));
  const labels = ["correctness", "diagnosis", "guidance", "adaptation", "actionability"].map((name) => new Element({ methodStoryLabel: name }));
  const railLinks = Array.from({ length: 5 }, () => new Element());
  const keys = Array.from({ length: 5 }, (_, i) => new Element({ methodStoryKey: String(i) }));
  const story = new Element({}, 400, 3500);
  const current = new Element();
  const stage = new Element();
  stage.rect = () => box(0, 108, 600, geometry.stageHeight?.(story.dataset) ?? 0);
  const canvas = new Element();
  canvas.rect = () => box(0, 0, 600, 300);
  labels.forEach((label, index) => { label.rect = () => geometry.labelBoxes?.(story.dataset)[index] ?? box(index * 120, 0, 100, 20); });
  let observeVisibility = (_entries: { isIntersecting: boolean }[]) => {};
  const layoutObservers: (() => void)[] = [];
  class VisibilityObserver {
    constructor(callback: typeof observeVisibility) { observeVisibility = callback; }
    observe() {}
    disconnect() {}
  }
  // Only observers that are actually observing something receive resize notifications.
  class LayoutObserver {
    constructor(readonly callback: () => void) {}
    observe() { if (!layoutObservers.includes(this.callback)) layoutObservers.push(this.callback); }
    disconnect() { layoutObservers.splice(layoutObservers.indexOf(this.callback) >>> 0, 1); }
  }
  runInNewContext(storyScript, {
    HTMLElement: Element,
    IntersectionObserver: VisibilityObserver,
    ResizeObserver: LayoutObserver,
    document: { querySelector: () => story, fonts: { ready: Promise.resolve() } },
    window: {
      get innerHeight() { return innerHeight; },
      getComputedStyle: (element: Element) => ({ top: element === stage ? "108px" : "auto" }),
      get scrollY() { return scrollY; },
      matchMedia: (query: string) => media[query.includes("1024") ? 0 : 1],
      requestAnimationFrame: (callback: () => void) => { frames.set(++nextFrame, callback); return nextFrame; },
      cancelAnimationFrame: (id: number) => frames.delete(id),
      addEventListener: (name: string, callback: () => void) => listeners.set(name, (listeners.get(name) ?? new Set()).add(callback)),
      removeEventListener: (name: string, callback: () => void) => {
        listeners.get(name)?.delete(callback);
        if (listeners.get(name)?.size === 0) listeners.delete(name);
      },
    },
  });
  await Promise.resolve();
  const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback()); };
  observeVisibility([{ isIntersecting: true }]);
  flush();
  const go = (progress: number) => { scrollY = 50 + progress * 600 + shift; emit("scroll"); flush(); };
  const snapshot = () => JSON.stringify({ parts: Object.fromEntries(Object.entries(parts).map(([name, element]) => [name, [element.style, element.attributes]])), labels: labels.map((label) => label.style), progress: story.dataset.methodStoryProgress });
  return {
    story, parts, chapters, labels, railLinks, keys, current, go, flush, snapshot, frames, listeners, media,
    get queries() { return queries; },
    get reads() { return reads; },
    emitScroll: () => emit("scroll"),
    visible: (value: boolean) => observeVisibility([{ isIntersecting: value }]),
    resize: (value: number) => { shift = value; layoutObservers.forEach((callback) => callback()); },
    resizeWindow: (height: number) => { innerHeight = height; emit("resize"); flush(); },
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

test("Methodology keeps the rail, figure labels and figure key on the active chapter", async () => {
  const scene = await createStory();
  scene.go(2.5);
  assert.equal(scene.story.dataset.methodStoryActiveIndex, "2");
  assert.deepEqual(scene.railLinks.map((link) => link.dataset.state), ["past", "past", "current", "upcoming", "upcoming"]);
  assert.deepEqual(scene.railLinks.map((link) => link.attributes["aria-current"]), [undefined, undefined, "step", undefined, undefined]);
  assert.deepEqual(scene.labels.map((label) => label.dataset.state), ["past", "past", "current", "upcoming", "upcoming"]);
  assert.deepEqual(scene.keys.map((key) => key.attributes["data-active"] !== undefined), [false, false, true, false, false]);
  scene.go(.5);
  assert.equal(scene.railLinks[0]?.attributes["aria-current"], "step");
  assert.equal(scene.keys[2]?.attributes["data-active"], undefined);
  assert.equal(scene.keys[0]?.attributes["data-active"], "");
});

test("Methodology hands a clean, completed drawing back to CSS when tracking stops", async () => {
  const scene = await createStory();
  scene.go(1.5);
  assert.notEqual(scene.parts.guided?.style.strokeDashoffset, "");
  scene.media[0]!.matches = false;
  scene.media[0]!.change();
  for (const part of Object.values(scene.parts)) {
    for (const property of ["strokeDashoffset", "visibility", "opacity", "strokeWidth", "fillOpacity"]) {
      assert.equal(part.style[property] ?? "", "");
    }
  }
  assert.equal(scene.parts.inspection?.attributes.r, "4");
  assert.equal(scene.parts.alternate?.attributes.d, "M382 320C430 320 430 396 478 396");
  assert.ok(scene.labels.every((label) => label.dataset.state === undefined && label.style.opacity === ""));
  assert.ok(scene.railLinks.every((link) => link.dataset.state === undefined && link.attributes["aria-current"] === undefined));
  assert.ok(scene.keys.every((key) => key.attributes["data-active"] === undefined));
});

test("Methodology unpins the stage when the enhanced panel cannot fit the window and re-pins when it can", async () => {
  // Sticky top is 108px and 16px stay free below the panel. The static panel (420px)
  // would fit a 600px window; the enhanced one (500px) does not. Measuring the wrong
  // state would keep a stage whose figure key is cut off below the window.
  const stageHeight = (dataset: Record<string, string>) =>
    dataset.methodStoryLayout === "stacked" ? 300 : dataset.methodStoryEnhanced ? 500 : 420;
  const scene = await createStory(true, false, { innerHeight: 600, stageHeight });
  assert.equal(scene.story.dataset.methodStoryLayout, "stacked");
  assert.equal(scene.story.dataset.methodStoryEnhanced, undefined);
  assert.equal(scene.listeners.has("scroll"), false);

  // 108 + 420 + 16 fits 610px but 108 + 500 + 16 does not: still stacked.
  scene.resizeWindow(610);
  assert.equal(scene.story.dataset.methodStoryLayout, "stacked");
  assert.equal(scene.listeners.has("scroll"), false);

  scene.resizeWindow(624);
  assert.equal(scene.story.dataset.methodStoryLayout, undefined);
  assert.equal(scene.story.dataset.methodStoryEnhanced, "true");
  assert.equal(scene.listeners.has("scroll"), true);
  scene.visible(true);
  scene.go(2.5);
  assert.equal(scene.story.dataset.methodStoryActiveIndex, "2");
  assert.equal(scene.railLinks[2]?.attributes["aria-current"], "step");

  // Shrinking the window again hands a clean, static story back to CSS.
  scene.resizeWindow(623);
  assert.equal(scene.story.dataset.methodStoryLayout, "stacked");
  assert.equal(scene.story.dataset.methodStoryEnhanced, undefined);
  assert.equal(scene.story.dataset.methodStoryActiveIndex, undefined);
  assert.equal(scene.listeners.has("scroll"), false);
  assert.ok(scene.chapters.every((chapter) => chapter.attributes["aria-current"] === undefined));
  assert.ok(scene.railLinks.every((link) => link.attributes["aria-current"] === undefined && link.dataset.state === undefined));
  assert.equal(scene.parts.guided?.style.strokeDashoffset, "");
});

test("Methodology re-checks the fit when only the text grows, without a window resize", async () => {
  let enhancedHeight = 400;
  const scene = await createStory(true, false, {
    innerHeight: 600,
    stageHeight: (dataset) => (dataset.methodStoryEnhanced ? enhancedHeight : 380),
  });
  assert.equal(scene.story.dataset.methodStoryLayout, undefined);
  assert.equal(scene.story.dataset.methodStoryEnhanced, "true");
  // Enlarged text makes the panel taller; the stage's ResizeObserver notices it.
  enhancedHeight = 560;
  scene.resize(0);
  scene.flush();
  assert.equal(scene.story.dataset.methodStoryLayout, "stacked");
  assert.equal(scene.story.dataset.methodStoryEnhanced, undefined);
});

test("Methodology measures the static panel under reduced motion and never starts tracking", async () => {
  const stageHeight = (dataset: Record<string, string>) => (dataset.methodStoryEnhanced ? 900 : 420);
  const scene = await createStory(true, true, { innerHeight: 520, stageHeight });
  assert.equal(scene.story.dataset.methodStoryLayout, "stacked");
  scene.resizeWindow(560);
  assert.equal(scene.story.dataset.methodStoryLayout, undefined);
  assert.equal(scene.story.dataset.methodStoryEnhanced, undefined);
  assert.equal(scene.listeners.has("scroll"), false);
});

test("Methodology switches figure labels to a legend only while anchored labels collide", async () => {
  let scale = 1.5;
  // Anchored labels sit 110px apart and are 100px wide at normal text size. In legend
  // mode the boxes are reported on top of each other, so measuring the legend instead
  // of the anchored layout would never leave legend mode again.
  const labelBoxes = (dataset: Record<string, string>) =>
    Array.from({ length: 5 }, (_, index) =>
      dataset.methodStoryLabels === "legend" ? box(0, 0, 100, 20) : box(index * 110, 40, 100 * scale, 20 * scale));
  const scene = await createStory(true, false, { labelBoxes });
  assert.equal(scene.story.dataset.methodStoryLabels, "legend");
  scale = 1;
  scene.resizeWindow(900);
  assert.equal(scene.story.dataset.methodStoryLabels, undefined);

  // Leaving the drawing counts as a collision too, and the tablet static figure is checked as well.
  const offCanvas = await createStory(false, false, { labelBoxes: () => [box(-12, 40, 100, 20), ...Array.from({ length: 4 }, (_, index) => box(120 + index * 110, 40, 100, 20))] });
  assert.equal(offCanvas.story.dataset.methodStoryLabels, "legend");
  assert.equal(offCanvas.story.dataset.methodStoryEnhanced, undefined);
});
