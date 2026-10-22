# Spectrum — Teachometry homepage prototype

Design prototype for the Teachometry website overhaul (direction A, "Spectrum / 分光").
It is a standalone static page. It is **not** part of `npm run website:build`, is not
deployed by the Pages workflow, and does not replace any live route.

Open it with any static server from this folder:

```bash
cd website/prototypes/spectrum && python3 -m http.server 8770
# http://localhost:8770/?lang=zh   (or ?lang=en, add &motion=reduce to preview reduced motion)
```

Edition: light "research journal". The first screen is a live kaleidoscope. Its material is
one photograph (a learner's notebook with 1/3 + 1/4 = 2/7, a glass prism, the light it
throws), seen through a round eyepiece folded by 12 mirrors. Pointer movement and scrolling
turn the tube; scrolling also takes the mirrors out (12 → 6 → 3 → 1) and opens the eyepiece
until the plain photograph is left, captioned as Fig. 0. Two more photographs open §2 and §3
as full-bleed plates. All three are generated illustrations and are captioned as such.
Everything after it is laid out as one journal issue: masthead and
contents, running heads, margin notes, figures (Fig. 1–3), booktabs tables (Table 1–3),
a pull quote, notes and references, and a colophon.

- `index.html` — page structure, bilingual copy (paired `.en` / `.zh` spans).
- `spectrum.css` — design tokens (paper, ink, five spectral bands), journal grid and components.
- `kaleido.js` — the cover kaleidoscope (plain WebGL 1, no libraries). Without WebGL the
  eyepiece shows the still photograph; with reduced motion it holds one six-mirror frame.
- `spectrum.js` — language switch, bar, sticky-figure dispersion chapter, plates shelf, reveals.
- `specimens.js` — generated from `website/dist/public-data/cases.json`
  (`tutor-eval-v0.2a@0.2a.6`): public case inputs only, no responses or scores.
- `assets/` — byte-for-byte copies of the approved TutorBench T1 mark, plus the three key
  visuals (`mistake-*`, `tabs-*`, `bench-*`, wide and tall crops, WebP).

Boundaries kept: no model scores, rankings or model names; the tutoring exchange is a
constructed example (the same one used by Micro-Review) and the five-dimension reading
is labelled as illustrative, not a TutorBench score. Teachometry stays a text wordmark.

The full direction, design system and phased plan live in the project's plan doc.
