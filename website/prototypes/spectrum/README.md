# Spectrum — Teachometry homepage prototype

Design prototype for the Teachometry website overhaul (direction A, "Spectrum / 分光").
It is a standalone static page. It is **not** part of `npm run website:build`, is not
deployed by the Pages workflow, and does not replace any live route.

Open it with any static server from this folder:

```bash
cd website/prototypes/spectrum && python3 -m http.server 8770
# http://localhost:8770/?lang=zh   (or ?lang=en, add &motion=reduce to preview reduced motion)
```

- `index.html` — page structure, bilingual copy (paired `.en` / `.zh` spans).
- `spectrum.css` — design tokens (darkroom, paper, five spectral bands) and layout.
- `spectrum.js` — language switch, WebGL2 prism (hand-written shader, SVG fallback),
  scroll-driven dispersion chapter, specimen shelf, reveals.
- `specimens.js` — generated from `website/dist/public-data/cases.json`
  (`tutor-eval-v0.2a@0.2a.6`): public case inputs only, no responses or scores.
- `assets/` — byte-for-byte copies of the approved TutorBench T1 mark.

Boundaries kept: no model scores, rankings or model names; the tutoring exchange is a
constructed example (the same one used by Micro-Review) and the five-dimension reading
is labelled as illustrative, not a TutorBench score. Teachometry stays a text wordmark.

The full direction, design system and phased plan live in the project's plan doc.
