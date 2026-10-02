import type { SiteLocale } from "../i18n.js";
import { renderMethodologyAnnotation } from "./methodology-annotation.js";

export function renderMethodologyHeroArt(uiLocale: SiteLocale = "en"): string {
  // 植物、引线与 HTML 注记共用比例坐标，避免断点变化时枝叶穿过文字。
  return `<div class="method-hero-art" aria-hidden="true">
    <svg class="method-hero-illustration" viewBox="0 0 640 390" aria-hidden="true" focusable="false">
      <g class="method-hero-plant" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
        <g fill="none" stroke-width="1.8">
          <path d="M355 390C333 348 310 300 302 260C287 214 301 182 310 167"/>
          <path d="M355 390C339 352 315 321 294 304M301 255C294 242 287 232 280 222M302 260Q305 257 309 255M355 390Q343 371 340 355" stroke-width="1.2"/>
        </g>
        <g fill="currentColor" fill-opacity=".12" stroke-width="1.1">
          <path d="M310 167C268 145 263 100 286 68C307 37 354 41 386 17C381 61 399 92 370 126C352 147 324 144 310 167Z"/>
          <path d="M280 222C244 218 232 194 212 170C187 145 167 119 126 112C175 89 215 86 245 108C277 128 290 178 280 222Z"/>
          <path d="M294 304C252 313 221 302 190 288C153 271 121 267 81 278C115 244 152 220 194 220C242 218 282 257 294 304Z"/>
          <path d="M309 255C307 223 323 196 353 184C377 171 403 170 423 160C404 189 391 211 367 230C346 244 324 242 309 255Z"/>
          <path d="M340 355C324 315 329 269 358 245C381 225 412 225 435 216C423 250 431 282 408 305C388 328 357 327 340 355Z"/>
        </g>
        <g fill="none" stroke-width="1" opacity=".8">
          <path d="M310 167C312 111 348 66 386 17M280 222C249 169 215 125 126 112M294 304C242 261 168 247 81 278M309 255C340 213 378 187 423 160M340 355C349 301 391 248 435 216"/>
        </g>
        <g fill="none" stroke-width=".7" opacity=".48">
          <path d="M311 146Q282 132 279 111M317 124Q288 110 284 88M327 101Q307 87 307 58M341 79Q325 65 329 48M355 58Q350 47 352 38M317 130Q348 137 370 119M326 106Q359 111 382 90M339 83Q368 85 384 63M354 60Q374 61 384 44"/>
          <path d="M268 204Q268 170 257 153M254 182Q251 145 239 122M238 162Q230 127 214 107M216 143Q199 116 183 103M188 126Q168 111 151 106M266 201Q239 202 225 184M252 179Q226 183 208 162M235 158Q210 160 190 142M211 140Q188 137 170 124"/>
          <path d="M276 290Q270 264 250 249M250 273Q243 244 221 229M220 260Q208 231 189 222M185 254Q167 236 146 239M151 257Q131 248 115 258M275 290Q251 303 229 294M250 273Q226 288 205 281M220 260Q201 276 181 270M185 254Q172 267 156 265"/>
          <path d="M324 235Q322 213 340 193M345 214Q345 193 365 179M369 195Q377 176 398 170M324 235Q346 237 363 229M345 214Q366 217 383 203M369 195Q389 198 403 182"/>
          <path d="M345 331Q327 309 335 287M356 304Q341 283 351 253M374 279Q365 251 383 233M393 254Q391 237 409 225M345 331Q373 328 387 312M356 304Q387 307 412 282M374 279Q404 280 426 254M393 254Q413 252 429 236"/>
        </g>
      </g>
      <path class="method-hero-leader" d="M551 93C558 112 541 124 514 127Q483 133 451 134M460 128L451 134L461 139" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <p class="method-hero-note"><span class="visually-hidden">${uiLocale === "zh-CN" ? "从案例走向洞见。" : "From<br>cases to insights."}</span>${uiLocale === "zh-CN" ? '<span class="method-hero-lettering method-hero-lettering-copy">从案例<br>走向洞见。</span>' : renderMethodologyAnnotation()}</p>
    <p class="method-hero-aside">${uiLocale === "zh-CN" ? "透明评测<br>AI 教学的<br>方法。" : "A transparent<br>approach to<br>evaluating<br>AI tutoring."}</p>
  </div>`;
}
