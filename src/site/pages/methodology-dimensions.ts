import { escapeHtml } from "../html.js";

interface LensDimension {
  readonly dimension: string;
  readonly details: { readonly label: string; readonly lens: string };
}

const labelPositions: Readonly<Record<string, readonly [number, number]>> = {
  correctness: [58, 90],
  diagnosis: [155, 305],
  guidance: [300, 365],
  adaptation: [406, 174],
  actionability: [483, 424],
};

export function renderMethodologyLensArt(dimensions: readonly LensDimension[]): string {
  const labels = dimensions.map(({ dimension, details }, index) => {
    const [x, y] = labelPositions[dimension] ?? [58 + index * 100, 424];
    return `<span class="method-story-label" data-method-story-label="${escapeHtml(dimension)}" style="left:${x / 640 * 100}%;top:${y / 520 * 100}%"><strong>${escapeHtml(details.label)}</strong></span>`;
  }).join("");

  // 同一视觉世界：基准/轨迹贯穿五章，偏离点 (242,242) 原位扩成检查环。
  // 环与证据保留到结尾；引导从偏离点长到 (382,320)，并成为两条分支的共同起点。
  // 选定分支保留；另一分支在最后一章连续收拢到它，随后延伸到固定终点 (580,320)。
  // 这是互补评分视角的视觉比喻，不代表评估器执行顺序或真实评分结果。
  return `<svg class="method-story-map" viewBox="0 0 640 520" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision">
    <g class="method-story-reference" data-method-part="reference">
      <path d="M58 166H588"/>
      <path class="method-story-ticks" d="M58 160V172M150 162V170M242 160V172M334 162V170M426 162V170M518 162V170M588 160V172"/>
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
  </svg><div class="method-story-labels" aria-hidden="true">${labels}</div>`;
}
