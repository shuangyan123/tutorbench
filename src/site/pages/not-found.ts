import type { PublicBenchmarkArtifacts } from "../../datasets/public.js";
import type { SitePage } from "../html.js";
import { siteIcon as icon } from "../icons.js";
import { renderTeachometryFooter } from "./home.js";

function renderNotFoundArtwork(): string {
  return `<div class="not-found-art not-found-art-left" aria-hidden="true">
    <svg viewBox="0 0 420 340" fill="none" focusable="false">
      <path class="not-found-trail" d="M218 124C133 112 105 62 62 92C15 124 78 178 145 169C215 160 257 192 221 230C189 263 108 270 67 318" />
      <path class="not-found-stem" d="M142 314C128 265 129 208 145 150C155 115 167 81 166 46" />
      <path class="not-found-leaf" d="M145 187C104 174 80 148 73 113C108 119 134 143 145 187Z" />
      <path class="not-found-leaf" d="M149 157C141 117 151 83 181 54C191 91 179 128 149 157Z" />
      <path class="not-found-leaf" d="M137 232C99 226 71 205 53 172C91 171 123 190 137 232Z" />
      <path class="not-found-leaf" d="M141 260C109 267 79 259 51 239C84 228 115 237 141 260Z" />
      <path class="not-found-stem" d="M260 322C246 277 239 236 247 199C255 165 273 143 296 118" />
      <path class="not-found-leaf" d="M251 260C218 250 195 229 184 199C216 202 242 220 251 260Z" />
      <path class="not-found-leaf" d="M251 229C252 194 270 166 300 149C301 184 283 211 251 229Z" />
      <path class="not-found-leaf" d="M245 297C218 299 191 290 167 271C196 260 224 270 245 297Z" />
      <path class="not-found-ground" d="M38 320C89 311 141 314 192 325M197 325C239 313 291 314 328 326" />
    </svg>
    <p class="not-found-note not-found-note-left">Different<br>paths.<br>A clearer<br>direction.</p>
  </div>
  <div class="not-found-art not-found-art-right" aria-hidden="true">
    <svg viewBox="0 0 450 350" fill="none" focusable="false">
      <path class="not-found-trail" d="M314 170C365 156 396 122 429 132C459 142 428 183 383 184C339 185 317 204 344 226C369 247 405 252 427 239" />
      <path class="not-found-signpost" d="M154 318C160 243 159 163 161 58" />
      <path class="not-found-signpost" d="M148 318H175" />
      <path class="not-found-sign" d="M157 91L304 70L330 88L302 125L158 143Z" />
      <path class="not-found-sign" d="M158 145L310 134L334 154L309 188L159 197Z" />
      <path class="not-found-sign" d="M159 202L299 198L322 218L299 252L159 251Z" />
      <text class="not-found-sign-text" x="186" y="103">Better</text>
      <text class="not-found-sign-text" x="186" y="119">questions</text>
      <text class="not-found-sign-text" x="185" y="158">Stronger</text>
      <text class="not-found-sign-text" x="185" y="174">evidence</text>
      <text class="not-found-sign-text" x="185" y="217">Brighter</text>
      <text class="not-found-sign-text" x="185" y="233">tomorrows</text>
      <path class="not-found-stem" d="M357 326C342 282 337 242 346 211C354 182 375 157 398 136" />
      <path class="not-found-leaf" d="M346 273C315 264 294 245 285 217C317 219 340 238 346 273Z" />
      <path class="not-found-leaf" d="M347 239C348 204 366 178 395 160C396 195 379 222 347 239Z" />
      <path class="not-found-leaf" d="M343 303C316 305 291 297 267 278C296 268 323 278 343 303Z" />
      <path class="not-found-stem" d="M105 326C117 285 120 248 112 214C104 181 84 157 61 138" />
      <path class="not-found-leaf" d="M113 275C143 265 165 245 175 216C143 220 119 239 113 275Z" />
      <path class="not-found-leaf" d="M112 240C110 206 92 179 63 161C62 196 80 224 112 240Z" />
      <path class="not-found-ground" d="M67 327C119 315 173 316 224 327M243 328C292 314 351 316 404 327" />
    </svg>
    <p class="not-found-note not-found-note-right">Not every<br>path is lost.<br>Some just<br>lead elsewhere.</p>
  </div>`;
}

export function renderNotFoundPage(artifacts: PublicBenchmarkArtifacts): SitePage {
  return {
    title: "Page not found — Teachometry",
    description: "The requested page is not part of the public Teachometry site.",
    route: "/404.html",
    content: `<section class="not-found-stage" aria-labelledby="not-found-title">
      ${renderNotFoundArtwork()}
      <div class="not-found-copy">
        <h1 id="not-found-title"><span class="not-found-number">404</span><span class="not-found-title-copy">This trail doesn’t lead to a public artifact.</span></h1>
        <p class="not-found-description">The page you’re looking for isn’t part of the public Teachometry site. <br>You might have followed an outdated link or typed the address incorrectly.</p>
        <nav class="not-found-actions" aria-label="Helpful public routes">
          <a class="button button-primary" href="/">Return home ${icon("arrow")}</a>
          <a class="button button-secondary" href="/data/">Explore the benchmark ${icon("arrow")}</a>
          <a class="button button-secondary" href="/docs/">Read the documentation ${icon("arrow")}</a>
        </nav>
      </div>
    </section>
    ${renderTeachometryFooter(artifacts)}`,
  };
}
