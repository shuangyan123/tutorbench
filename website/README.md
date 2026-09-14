# Tutor Benchmark Public Website

The website is a static, read-only Developer Preview generated from the
canonical TutorEval 0.2A dataset.

The public header uses the approved TutorBench T1 trajectory mark and the
`AI Tutor 评测基准` descriptor. The website build copies the canonical SVG
variants and supplied favicon files into `assets/brand/tutorbench/`; it does
not redraw or rasterize the primary mark.

```text
benchmark core
  -> public serializer
  -> public-data/*.json
  -> static HTML/CSS/JS
```

Build or serve it from the repository root:

```bash
npm run website:build
npm run website:dev
```

`website/dist/` is generated and ignored. The build does not require
`OPENAI_API_KEY`, does not call a Judge, and does not include model rankings or
trial data that are not present in a validated public artifact.

The `/community/` page is an informational participation entry. It explains
why future structured human review may help validate the method and how a
future invite-only workflow could work. Applications, public reviewer intake,
real Community Review, and P5 human calibration remain closed or not started;
the page has no form, waitlist, login, or service integration.

`.github/workflows/pages.yml` builds this directory and deploys it to GitHub
Pages only from `main`. GitHub Pages provides the project `base_path` and
canonical `base_url` to the generator, so project-site links work under
`/<repo>/` while local builds continue to use `/`. The workflow validates the
generated routes and public-data firewall before upload and requires no model,
API, database, or deployment secret.

The Run and Methodology pages describe the 0.4A.3 `baseline-native-default`
generation profile: the benchmark prompt/messages and 1024-token output cap
are fixed, while temperature, reasoning, and seed remain provider-native and
unconstrained. Future public cohorts must retain dataset and generation spec
identity instead of mixing different profiles.

The Run and Docs pages distinguish the local `tutorbench collect` Product
Tutor path from `tutorbench collect-model` canonical model evidence. Real-model
response artifacts are private and ignored by default, remain preliminary and
uncalibrated, and are never copied into website public data automatically.

The serializer defaults to excluding evaluator-only fields. The current
synthetic development dataset opts into its documented public disclosure and
adaptation metadata; ground truth, known misconceptions, rubrics, and hidden
evidence remain excluded.

Case target locale is independent from the developer UI locale. The public
case artifact records the resolved locale; legacy cases without the field
resolve to `en`. For a local, explicit audit view over an ignored evaluation
artifact, use `npm run website:build -- -- --evaluation <path> --output
website/private-dist --locale zh-CN`. The default Pages build never loads that
path and never emits private evaluation content.

## Reference-led homepage

The homepage uses the supplied September 2026 art direction: an ivory/forest
palette, serif thesis, case walkthrough, five-dimension path, and compact data
footer. Its descriptor is “Measurement infrastructure for AI tutoring”; other
pages retain their existing header. The approved T1 brand mark is unchanged.

`src/site/pages/home.ts` renders public cases only. Tabs expose the learner input,
authored objective, rubric-method explanation, and public context. There are no
invented Tutor replies, scores, PASS states, or published runs. Empty score tracks
mean **not scored**. The dimension progress indicator is the dimension's position
in the walkthrough, not a quality score. Dataset counts/version come from the
public artifact; evaluator version comes from the existing contract constant.

Case and dimension navigation support keyboard use; small screens retain all
five nodes in a horizontally scrollable path. The homepage supports system theme,
an optional locally saved theme choice, and reduced motion. Interface language
selection remains on the data/methodology pages; homepage editorial copy is English.

`website/src/images/foliage.png` is a generated decorative background, created with
the built-in image generator from the user-supplied visual reference. It is not a
brand asset or research evidence. Generation brief: warm off-white empty center,
soft photographic green foliage at the far edges, a slightly sharper lower-left
cluster, natural daylight; no text, logo, or UI. CSS masks keep it away from text.
