# Spectrum — Teachometry homepage prototype

Design prototype for the Teachometry website overhaul (direction A, "Spectrum / 分光").
It is a standalone static page. It is **not** part of `npm run website:build`, is not
deployed by the Pages workflow, and does not replace any live route.

Open it with any static server from this folder:

```bash
cd website/prototypes/spectrum && python3 -m http.server 8770
# http://localhost:8770/?lang=zh   (or ?lang=en, add &motion=reduce to preview reduced motion)
```

Edition: light "research journal". The first screen is a single live artwork (a glass
prism in daylight that refracts the scene behind it and splits one reply into five
labelled lines). Everything after it is laid out as one journal issue: masthead and
contents, running heads, margin notes, figures (Fig. 1–3), booktabs tables (Table 1–3),
a pull quote, notes and references, and a colophon.

- `index.html` — page structure, bilingual copy (paired `.en` / `.zh` spans).
- `spectrum.css` — design tokens (paper, ink, five spectral bands), journal grid and components.
- `spectrum.js` — language switch, WebGL2 cover prism (hand-written shader, SVG fallback),
  sticky-figure dispersion chapter, plates shelf, reveals.
- `specimens.js` — generated from `website/dist/public-data/cases.json`
  (`tutor-eval-v0.2a@0.2a.6`): public case inputs only, no responses or scores.
- `assets/` — byte-for-byte copies of the approved TutorBench T1 mark.

Boundaries kept: no model scores, rankings or model names; the tutoring exchange is a
constructed example (the same one used by Micro-Review) and the five-dimension reading
is labelled as illustrative, not a TutorBench score. Teachometry stays a text wordmark.

The full direction, design system and phased plan live in the project's plan doc.
