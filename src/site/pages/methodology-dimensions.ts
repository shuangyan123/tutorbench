import { escapeHtml } from "../html.js";

export interface LensFigureKey {
  /** Name of the drawn element that stands for this dimension, e.g. "Inspection ring". */
  readonly name: string;
  /** One sentence connecting the drawn element to what the dimension looks for. */
  readonly note: string;
}

interface LensDimension {
  readonly dimension: string;
  readonly number: string;
  readonly details: { readonly label: string; readonly lens: string; readonly figure: LensFigureKey };
}

type LabelPlacement = "above-start" | "above" | "below" | "below-end";

interface LabelAnchor {
  readonly x: number;
  readonly y: number;
  readonly placement: LabelPlacement;
}

// The drawing keeps the original 640 x 520 coordinate system (site.js animates
// absolute path data in it); the viewBox only crops the empty margins so the
// trajectory fills the stage instead of floating in its upper half.
const VIEW = { x: 24, y: 112, width: 600, height: 294 } as const;

// Each label is anchored to the element that represents its dimension, so the
// figure can be read without the chapter text beside it.
const labelAnchors: Readonly<Record<string, LabelAnchor>> = {
  correctness: { x: 58, y: 152, placement: "above-start" },
  diagnosis: { x: 242, y: 298, placement: "below" },
  guidance: { x: 326, y: 334, placement: "below" },
  adaptation: { x: 478, y: 218, placement: "above" },
  actionability: { x: 598, y: 346, placement: "below-end" },
};

function labelAnchor(dimension: string, index: number): LabelAnchor {
  return labelAnchors[dimension] ?? { x: 58 + index * 120, y: 398, placement: "below" };
}

function fraction(value: number, origin: number, size: number): string {
  return ((value - origin) / size).toFixed(4);
}

export function methodologyDimensionAnchorId(dimension: string): string {
  return `method-dimension-${dimension.replace(/[^a-z0-9-]/giu, "-").toLowerCase()}`;
}

export function renderMethodologyLensArt(dimensions: readonly LensDimension[]): string {
  const labels = dimensions.map(({ dimension, number, details }, index) => {
    const { x, y, placement } = labelAnchor(dimension, index);
    // Anchors are fractions of the drawing, so CSS can place either the whole
    // label (anchored mode) or only its number (legend mode) on the element.
    return `<span class="method-story-label" data-method-story-label="${escapeHtml(dimension)}" data-number="${number}" data-placement="${placement}" style="--label-x:${fraction(x, VIEW.x, VIEW.width)};--label-y:${fraction(y, VIEW.y, VIEW.height)}"><span class="method-story-label-number">${number}</span><strong>${escapeHtml(details.label)}</strong></span>`;
  }).join("");

  // 同一视觉世界：基准/轨迹贯穿五章，偏离点 (242,242) 原位扩成检查环。
  // 环与证据保留到结尾；引导从偏离点长到 (382,320)，并成为两条分支的共同起点。
  // 选定分支保留；另一分支在最后一章连续收拢到它，随后延伸到固定终点 (580,320)。
  // 这是互补评分视角的视觉比喻，不代表评估器执行顺序或真实评分结果。
  // 虚线 ghost 预先勾出完整路线，让前几章的画面不显得残缺；它不参与动画。
  return `<div class="method-story-canvas" style="--figure-ratio:${(VIEW.height / VIEW.width).toFixed(4)}"><svg class="method-story-map" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision">
    <g class="method-story-reference" data-method-part="reference">
      <path d="M58 166H588"/>
      <path class="method-story-ticks" d="M58 160V172M150 162V170M242 160V172M334 162V170M426 162V170M518 162V170M588 160V172"/>
    </g>
    <g class="method-story-ghost">
      <path d="M242 242H282Q300 242 300 260V302Q300 320 318 320H382"/>
      <path d="M382 320C430 320 430 230 478 230C534 230 524 320 580 320"/>
      <circle cx="580" cy="320" r="15"/>
    </g>
    <path class="method-story-trace" data-method-part="trace" d="M58 166H132C174 166 178 242 242 242"/>
    <path class="method-story-deviation" data-method-part="deviation" d="M242 166V242"/>
    <circle class="method-story-focus" cx="242" cy="242" r="4"/>
    <circle class="method-story-inspection" data-method-part="inspection" cx="242" cy="242" r="4"/>
    <path class="method-story-evidence method-story-draw" data-method-part="evidence" pathLength="1" d="M223 232H236M223 242H230M223 252H240"/>
    <path class="method-story-guided method-story-draw" data-method-part="guided" pathLength="1" d="M242 242H282Q300 242 300 260V302Q300 320 318 320H382"/>
    <g class="method-story-checkpoints">
      <circle data-method-part="checkpoint-one" cx="300" cy="272" r="4"/>
      <circle data-method-part="checkpoint-two" cx="335" cy="320" r="4"/>
    </g>
    <path class="method-story-alternate method-story-draw" data-method-part="alternate" pathLength="1" d="M382 320C430 320 430 396 478 396"/>
    <path class="method-story-selected method-story-draw" data-method-part="selected" pathLength="1" d="M382 320C430 320 430 230 478 230"/>
    <circle class="method-story-decision" data-method-part="decision" cx="382" cy="320" r="5"/>
    <path class="method-story-resolve method-story-draw" data-method-part="resolve" pathLength="1" d="M478 230C534 230 524 320 580 320"/>
    <circle class="method-story-endpoint" data-method-part="endpoint" pathLength="1" cx="580" cy="320" r="15"/>
    <path class="method-story-complete method-story-draw" data-method-part="complete" pathLength="1" d="M572 320H587M581 314L587 320L581 326"/>
  </svg><div class="method-story-labels" aria-hidden="true">${labels}</div></div>`;
}

/** The active dimension's drawn element, explained under the figure. */
export function renderMethodologyLensKeys(dimensions: readonly LensDimension[]): string {
  const keys = dimensions.map(({ number, details }, index) =>
    `<p class="method-story-key" data-method-story-key="${index}"><span class="method-story-key-name"><span>${number}</span><span>${escapeHtml(details.figure.name)}</span></span><span class="method-story-key-note">${escapeHtml(details.figure.note)}</span></p>`,
  ).join("");
  return `<div class="method-story-keys" aria-hidden="true">${keys}</div>`;
}

// Small marks that repeat the figure's vocabulary inside each chapter. They give
// each dimension its own silhouette on every viewport, including phones where the
// large figure is intentionally not shown.
const glyphs: Readonly<Record<string, string>> = {
  correctness:
    '<path class="glyph-faint" d="M6 14V22M20 15V21M34 14V22M48 15V21M62 14V22"/>' +
    '<path class="glyph-strong" d="M6 18H62"/><circle class="glyph-node" cx="34" cy="18" r="3.2"/>',
  diagnosis:
    '<path class="glyph-faint" d="M6 9H62M34 9V25" stroke-dasharray="2 3"/>' +
    '<path class="glyph-strong" d="M6 9H16C24 9 25 25 34 25"/>' +
    '<circle class="glyph-ring" cx="34" cy="25" r="8.5"/><circle class="glyph-dot" cx="34" cy="25" r="2"/>',
  guidance:
    '<path class="glyph-faint" d="M6 9H16"/>' +
    '<path class="glyph-strong" d="M16 9H22Q27 9 27 14V22Q27 27 32 27H62"/>' +
    '<circle class="glyph-node" cx="27" cy="17" r="2.8"/><circle class="glyph-node" cx="44" cy="27" r="2.8"/>',
  adaptation:
    '<path class="glyph-strong" d="M6 18H20"/>' +
    '<path class="glyph-faint" d="M20 18C30 18 30 29 42 29H52"/>' +
    '<path class="glyph-strong" d="M20 18C30 18 30 7 42 7H62"/><circle class="glyph-node" cx="20" cy="18" r="3.2"/>',
  actionability:
    '<path class="glyph-strong" d="M6 18H40"/>' +
    '<circle class="glyph-end" cx="50" cy="18" r="10"/><path class="glyph-arrow" d="M45 18H55M51 14L55 18L51 22"/>',
};

export function renderMethodologyDimensionGlyph(dimension: string): string {
  const body = glyphs[dimension] ?? '<path class="glyph-strong" d="M6 18H62"/><circle class="glyph-node" cx="34" cy="18" r="3.2"/>';
  return `<svg class="method-story-glyph" viewBox="0 0 68 36" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision">${body}</svg>`;
}
