import { escapeHtml } from "./html.js";
import type { PublicSiteBotanicalAsset } from "./assets.js";

export interface DecorativeSvgOptions {
  readonly className: string;
  readonly viewBox: string;
  readonly body: string;
  readonly preserveAspectRatio?: string;
}

/**
 * Shared wrapper for non-semantic line art. Decorative SVGs must not create a
 * second, misleading accessible name for content already expressed in HTML.
 */
export function renderDecorativeSvg(options: DecorativeSvgOptions): string {
  const preserveAspectRatio = options.preserveAspectRatio === undefined
    ? ""
    : ` preserveAspectRatio="${escapeHtml(options.preserveAspectRatio)}"`;
  return `<svg class="${escapeHtml(options.className)}" viewBox="${escapeHtml(options.viewBox)}"${preserveAspectRatio} fill="none" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision">${options.body}</svg>`;
}

/**
 * References a reviewed external SVG symbol while keeping the host element's
 * currentColor. This preserves theme control without putting the SVG paths in
 * a page template or embedding any raster content in the vector asset.
 */
export function renderBotanicalSvg(
  className: string,
  asset: PublicSiteBotanicalAsset,
): string {
  return `<svg class="${escapeHtml(className)}" viewBox="${escapeHtml(asset.svgViewBox)}" preserveAspectRatio="xMidYMid meet" fill="none" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision"><use href="/assets/${escapeHtml(asset.svg)}#${escapeHtml(asset.svgId)}"></use></svg>`;
}

/**
 * The editorial leaf branch is shared by Blog and Community. The optional
 * lower leaf keeps the two compositions distinct without maintaining two
 * nearly identical inline SVGs in separate page modules.
 */
export function renderEditorialBotanical(
  className: string,
  includeLowerLeaf = true,
): string {
  const lowerLeaf = includeLowerLeaf
    ? '<path d="M32 300C20 289 13 275 17 261C34 267 46 280 46 294C42 298 37 300 32 300Z" stroke-width="1.05" />'
    : "";
  const veinPaths = [
    "M55 79C52 67 48 53 43 41",
    "M23 161C19 147 15 133 13 119",
    "M218 54C223 39 229 25 234 14",
    "M17 219C20 204 24 191 29 182",
    "M231 40C237 27 242 16 246 9",
    "M188 63C185 50 184 37 187 25",
    ...(includeLowerLeaf ? ["M34 294 24 271"] : []),
  ].map((path) => `<path d="${path}" stroke-width=".65" />`).join("");
  const body = `<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M120 326C119 276 122 218 137 160C149 114 162 67 192 18" stroke-width="1.6" />
      <path d="M133 190C103 155 76 123 54 83M126 236C93 219 56 198 22 166M143 140C170 119 194 91 215 58M119 277C88 265 53 250 16 224M153 103C179 91 204 71 228 44M115 295C91 302 61 305 32 300" stroke-width="1.15" />
    </g>
    <g fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-linejoin="round">
      <path d="M54 83C41 67 29 49 32 32C50 37 65 54 68 72C63 78 59 81 54 83Z" stroke-width="1.05" />
      <path d="M22 166C11 147 4 126 10 108C29 116 43 135 42 153C36 159 30 163 22 166Z" stroke-width="1.05" />
      <path d="M215 58C214 39 219 20 234 8C240 27 235 46 222 60C219 60 217 59 215 58Z" stroke-width="1.05" />
      <path d="M16 224C11 207 14 190 26 178C39 194 39 211 29 225C24 226 20 226 16 224Z" stroke-width="1.05" />
      ${lowerLeaf}
      <path d="M228 44C228 27 235 12 248 4C252 21 246 38 236 47C233 47 230 46 228 44Z" stroke-width="1.05" />
      <path d="M192 18C194 39 191 57 180 73C171 64 168 48 174 35C179 27 185 21 192 18Z" stroke-width="1.05" />
    </g>
    <g fill="none" stroke="currentColor" stroke-linecap="round" opacity=".42">
      ${veinPaths}
    </g>`;
  return renderDecorativeSvg({
    className,
    viewBox: "0 0 240 330",
    preserveAspectRatio: "xMidYMid meet",
    body,
  });
}
