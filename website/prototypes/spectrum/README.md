# Spectrum — Teachometry homepage prototype

Design prototype for the Teachometry website overhaul (direction A, "Spectrum / 分光").
It is a standalone static page. It is **not** part of `npm run website:build`, is not
deployed by the Pages workflow, and does not replace any live route.

Open it with any static server from this folder:

```bash
cd website/prototypes/spectrum && python3 -m http.server 8770
# http://localhost:8770/?lang=zh   (or ?lang=en, add &motion=reduce to preview reduced motion)
```

Edition: light "research journal". The first screen is a live 3D scene: an open issue of
the journal on a desk in low sunlight through blinds, a glass prism lying on the right
page, and its spectrum falling on a printed λ1–λ5 scale. Scrolling moves the camera down
onto the left page, which fades into the masthead. Everything after it is laid out as one journal issue: masthead and
contents, running heads, margin notes, figures (Fig. 1–3), booktabs tables (Table 1–3),
a pull quote, notes and references, and a colophon.

- `index.html` — page structure, bilingual copy (paired `.en` / `.zh` spans).
- `spectrum.css` — design tokens (paper, ink, five spectral bands), journal grid and components.
- `cover3d.js` — the cover scene (ES module, three.js 0.165 from jsDelivr via an import map;
  page typography is drawn to canvas textures and redrawn on language change; SVG fallback).
- `spectrum.js` — language switch, bar, sticky-figure dispersion chapter, plates shelf, reveals.
- `specimens.js` — generated from `website/dist/public-data/cases.json`
  (`tutor-eval-v0.2a@0.2a.6`): public case inputs only, no responses or scores.
- `assets/` — byte-for-byte copies of the approved TutorBench T1 mark.

Boundaries kept: no model scores, rankings or model names; the tutoring exchange is a
constructed example (the same one used by Micro-Review) and the five-dimension reading
is labelled as illustrative, not a TutorBench score. Teachometry stays a text wordmark.

The full direction, design system and phased plan live in the project's plan doc.
