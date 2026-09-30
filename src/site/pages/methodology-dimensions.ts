import { escapeHtml } from "../html.js";
import { siteIcon } from "../icons.js";

interface LensDimension {
  readonly dimension: string;
  readonly details: { readonly label: string; readonly lens: string; readonly icon: string };
}

interface LensPosition {
  readonly x: number;
  readonly y: number;
  readonly labelX: number;
  readonly labelY: number;
  readonly align: "left" | "right";
}

const positions: Readonly<Record<string, LensPosition>> = {
  correctness: { x: 208, y: 392, labelX: 25, labelY: 373, align: "right" },
  diagnosis: { x: 320, y: 112, labelX: 355, labelY: 91, align: "left" },
  guidance: { x: 475, y: 221, labelX: 510, labelY: 201, align: "left" },
  adaptation: { x: 165, y: 221, labelX: 8, labelY: 201, align: "right" },
  actionability: { x: 432, y: 392, labelX: 467, labelY: 373, align: "left" },
};

function positionFor(dimension: string, index: number, count: number): LensPosition {
  if (positions[dimension]) return positions[dimension];
  const angle = -Math.PI / 2 + index * 2 * Math.PI / Math.max(count, 1);
  const x = 320 + Math.cos(angle) * 160;
  const y = 270 + Math.sin(angle) * 160;
  const align = x < 320 ? "right" : "left";
  return { x, y, labelX: align === "right" ? x - 157 : x + 35, labelY: y - 20, align };
}

export function renderMethodologyLensArt(dimensions: readonly LensDimension[]): string {
  const layout = dimensions.map(({ dimension, details }, index) => ({ dimension, details, index, ...positionFor(dimension, index, dimensions.length) }));
  const visuals = layout.map(({ dimension, details, index, x, y }) => {
    const distance = Math.hypot(x - 320, y - 270);
    const dx = (x - 320) / distance;
    const dy = (y - 270) / distance;
    // 连线只连接圆周；固定中心使五个维度始终是互补视角，而不是顺序处理节点。
    const startX = 320 + dx * 88;
    const startY = 270 + dy * 88;
    const endX = x - dx * 26;
    const endY = y - dy * 26;
    const glyph = siteIcon(details.icon)
      .replace('viewBox="0 0 24 24" ', "")
      .replace("<svg ", `<g transform="translate(${x - 13} ${y - 13}) scale(${26 / 24})" `)
      .replace("</svg>", "</g>");
    return `<g class="method-story-visual" data-method-story-visual="${index}" data-method-visual-state="${escapeHtml(dimension)}">
      <g class="method-story-spoke" data-method-story-spoke="${index}"><path class="method-story-line" d="M${startX.toFixed(2)} ${startY.toFixed(2)}L${endX.toFixed(2)} ${endY.toFixed(2)}"/><circle class="method-story-point" cx="${startX.toFixed(2)}" cy="${startY.toFixed(2)}" r="2.5"/></g>
      <g class="method-story-node" data-method-story-node="${index}"><circle cx="${x}" cy="${y}" r="26"/>${glyph}</g>
    </g>`;
  }).join("\n");
  const labels = layout.map(({ details, labelX, labelY, align }) => `<span class="method-story-label method-story-label--${align}" style="left:${(labelX / 640 * 100).toFixed(3)}%;top:${(labelY / 520 * 100).toFixed(3)}%"><strong>${escapeHtml(details.label)}</strong><small>${escapeHtml(details.lens)}</small></span>`).join("");
  return `<svg class="method-story-map" viewBox="0 0 640 520" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision"><circle class="method-story-halo" cx="320" cy="270" r="88"/><g class="method-story-visuals">${visuals}</g></svg><div class="method-story-labels" aria-hidden="true">${labels}</div>`;
}
