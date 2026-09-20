# Home photographic assets

PR #129 uses the final user-supplied `tutorbench-home-astra-pack.zip`, following
`ASTRA_HOME_BRIEF.md` and `ASSET_MAP.json`. The nine optimized WebP files are
copied byte-for-byte from `assets/web/`; no image generation, repainting, or
re-encoding is part of this polish pass. The package reference is a visual
composition guide, not benchmark evidence or a source of published articles.

| File | Home role |
| --- | --- |
| home-hero-bg.webp | Hero photographic base; physical book and pot lettering remains in the photo |
| home-open-data-bg.webp | Forest data band, with a CSS contrast overlay |
| home-blog-01.webp | First existing published essay cover |
| home-blog-02.webp | Second existing published essay cover |
| home-blog-03.webp | Explicit Blog index card, not an invented third post |
| foliage-left-near.webp | Transparent foreground at the data band's left edge |
| foliage-left-mid.webp | Transparent foreground at the Blog's left edge |
| foliage-right-mid.webp | Transparent foreground at the dimensions' right edge |
| foliage-right-near.webp | Transparent foreground at the Blog's right edge |

Photography is decorative and is not evidence of real learner outcomes or
research activity. The Home renderer retains current Teachometry display text,
real public cases, authored objectives, dataset/evaluator versions, published
Blog metadata, and existing routes. Unavailable scores stay `N/A`, with the
explicit no-model-run explanation. All text, navigation, annotations, controls,
icons, metrics, cards, and footer are HTML/CSS/SVG, not screenshot content.

`home.css` loads only on Home. Foliage is non-interactive and hidden from assistive
technology. Each layer has independent 11–16 second CSS breeze timing, at most
4px translation and 0.7 degree rotation. Reduced motion disables it completely.
No new reveal, parallax, tilt, count-up, or broader motion system is introduced.
Existing main-branch interactions and theme/locale behavior remain in place.
PR #125 is not a dependency and no commits were cherry-picked from it.
