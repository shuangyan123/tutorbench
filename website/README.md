# Teachometry Public Website

The website is a static, read-only Developer Preview generated from the
canonical TutorEval 0.2A dataset.

The public header presents **Teachometry** as the product/project identity and
uses the TutorBench T1 trajectory mark for the open-source evaluation engine. The website build copies the canonical SVG
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
footer. Its descriptor is “Real-world evaluation for AI tutoring”; the
Results page now extends that Teachometry shell with an evidence-report layout
and an explicit empty public-results state. The Models page uses the same shell
for an evidence registry and reserved schema-only dossier route; its current
empty state is derived from the public model artifact and does not invent model
identities, runs, rankings, or scores. The approved T1 brand mark is unchanged.

`src/site/pages/home.ts` renders public cases only. Tabs expose the learner input,
authored objective, rubric-method explanation, and public context. There are no
invented Tutor replies, scores, PASS states, or published runs. Empty score tracks
mean **not scored**. The dimension progress indicator is the dimension's position
in the walkthrough, not a quality score. Dataset counts/version come from the
public artifact; evaluator version comes from the existing contract constant.

Case and dimension navigation support keyboard use; small screens retain all
five nodes in a horizontally scrollable path. The shared Teachometry header is
rendered consistently across public routes, including Run and Docs. Theme and
interface-language choices are available from the same header on every public
page and persist locally when storage is available. Shared navigation, controls,
and accessibility labels switch between English and Simplified Chinese at
runtime. Page-specific editorial copy remains translated only where the page
already provides localized content; changing interface language does not invent
translations for English-only research prose.

Motion is intentionally restrained: header controls, active navigation, mobile
menu disclosure, and page entry use short transforms/opacity transitions only
when `prefers-reduced-motion` permits them. Reduced-motion users receive the
same state changes without animation.

`website/src/images/foliage.png` is an optimized decorative derivative of the
user-supplied visual reference and rendered homepage capture. It is not a brand
asset or research evidence. The asset keeps only the soft edge foliage needed by
the CSS masks and intentionally excludes page text, logos, controls, and benchmark
content.
