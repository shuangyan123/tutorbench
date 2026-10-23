# Spectrum — Teachometry homepage prototype

Design prototype for the Teachometry website overhaul (direction A, "Spectrum / 分光").
It is a standalone static page. It is **not** part of `npm run website:build`, is not
deployed by the Pages workflow, and does not replace any live route.

Open it with any static server from this folder:

```bash
cd website/prototypes/spectrum && python3 -m http.server 8770
# http://localhost:8770/?lang=zh   (or ?lang=en, add &motion=reduce to preview reduced motion)
```

Edition: light "research journal" in a periwinkle palette (reference: Noomo Agency). The
first screen is a real kaleidoscope rendered in Blender (Cycles): three mirrors at 60°, glass
in the five TutorBench colours and three scraps of a learner's working (1/3, 1/4, 2/7). Two
pre-rendered sequences play on a canvas: `L_*` looks into the eyepiece while the cell turns
(plays back and forth; the pointer nudges it), `P_*` backs the camera out of the eyepiece
until the kaleidoscope lies on the desk next to the notebook (driven by scroll). Two GPT
photographs open §2 and §3 as framed plates, captioned as generated illustrations.
Everything after it is laid out as one journal issue: masthead and
contents, running heads, margin notes, figures (Fig. 1–3), booktabs tables (Table 1–3),
a pull quote, notes and references, and a colophon.

- `index.html` — page structure, bilingual copy (paired `.en` / `.zh` spans).
- `spectrum.css` — design tokens (paper, ink, five spectral bands), journal grid and components.
- `cover.js` — plays the rendered cover frames (`assets/cover/`, WebP, 1200×750) on a 2D
  canvas with cross-fades. Reduced motion holds one still frame (the engraved eyepiece cap).
- `spectrum.js` — language switch, bar, sticky-figure dispersion chapter, plates shelf, reveals.
- `specimens.js` — generated from `website/dist/public-data/cases.json`
  (`tutor-eval-v0.2a@0.2a.6`): public case inputs only, no responses or scores.
- `assets/` — byte-for-byte copies of the approved TutorBench T1 mark, plus two key
  visuals (`tabs-*`, `bench-*`, wide and tall crops, WebP) and the cover frames.

Boundaries kept: no model scores, rankings or model names; the tutoring exchange is a
constructed example (the same one used by Micro-Review) and the five-dimension reading
is labelled as illustrative, not a TutorBench score. Teachometry stays a text wordmark.

The full direction, design system and phased plan live in the project's plan doc.
