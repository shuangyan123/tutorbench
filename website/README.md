# Teachometry Public Website

The website is a static, read-only Developer Preview generated from the
canonical TutorEval 0.2A dataset.

The Run and Docs pages describe the current repository channel, not the frozen
npm `tutor-benchmark@0.1.0` payload. They distinguish Node 24 repository setup
from the Node 22 published package and mark Tutor Health as repository-only.
See [release channels](../docs/release.md#installation-channels). A local
website build does not establish that those changes are deployed.

**Teachometry** is the parent brand and has no approved logo yet, so the shared
header and footer set its name as text. **TutorBench** is Teachometry's AI tutor
evaluation product; its T1 trajectory mark appears only beside the TutorBench
name ("TutorBench · AI tutor evaluation" in the header, "An AI tutoring quality
evaluation product by Teachometry." in the footer). The website build copies
the canonical SVG variants and supplied favicon files into
`assets/brand/tutorbench/`; it does not redraw or rasterize the primary mark.

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
npm run test:website:hit   # real-browser click/hit test (needs Chrome or CHROME_PATH)
```

The hit test serves the build, drives a local Chrome/Chromium through the
DevTools protocol and checks that every visible header control and the three
homepage paths own their own click area (centre and edges), including at
1024/1100/1440 px, in both locales and with 200% text; the 1024px header also
checks 300% text and visual navigation order. A click must produce a completed
navigation to its own URL, including same-URL links, with a successful document
response. Header geometry and hit failures block CI; unrelated document content
overflow is emitted as a non-blocking diagnostic.

CDP requests and page loads have 10-second deadlines, browser startup has a
20-second deadline, and shutdown starts its force timer before requesting
`Browser.close`. Disconnects reject pending requests and event waits. Cleanup
only removes the fresh profile created by this invocation. The command and CI
also run isolated real-Chrome subprocess tests for normal exit, missing/failed
startup, disconnect/error, crash, pending request timeout, stalled navigation,
no-op clicks, HTTP errors, stalled close, and overflow/overlap regressions.

Without JavaScript (or before the header is measured), Methodology keeps its
static single-column figure and an unpinned desktop header, so native chapter
anchors cannot land behind an unmeasured header. Measured sticky layout uses the existing
viewport-height and panel-fit guards; no width-specific guessed offset is used.

`website/dist/` is generated and ignored. The build does not require
`OPENAI_API_KEY`, does not call a Judge, and does not include model rankings or
trial data that are not present in a validated public artifact.

The `/community/` page is an informational participation entry. It explains
why future structured human review may help validate the method and how a
future invite-only workflow could work. Applications, public reviewer intake,
real Community Review, and P5 human calibration remain closed or not started;
the page has no form, waitlist, login, or service integration.

The standalone `/micro-review/` and `/zh-cn/micro-review/` routes offer one
explicitly constructed teaching dialogue, three local judgment choices, a short
authored analysis, and an optional link to the future Reviewer plan. No choice
is transmitted or persisted, no analytics is enabled, and no formal review or
benchmark result is created. See `docs/micro-review-experiment.md` for the
experiment, privacy boundaries, proposed participation measures, and launch
limitations. The homepage hero links to it as a clearly labeled constructed
demo, separate from running a TutorBench evaluation and from the Methodology;
the primary navigation is unchanged.

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

## Home opening letter

A first visit to Home opens a short letter from Teachometry before Home: a
sealed envelope the visitor opens, a reader-paced letter about three long-term
hopes for education, and a transition into Home. It is brand writing, not
evidence, and it says TutorBench cannot yet show learning gains. It is a native
modal `<dialog>` rendered before the header (`SitePage.prelude`) with a small
inline script that opens it before first paint only for a first Home visit.
JavaScript off, reduced motion, unavailable storage, repeat visits, and every
other route go straight to the page. Skip and Escape work even if
`assets/letter.js` never loads. The only state is `localStorage`
`teachometry-letter-v1 = "1"`. The Home entry "A letter to learners" and any
`#letter` link reopen it. `letter.css` and `letter.js` load only on Home. See
`docs/home-letter-opening.md` for the concept, full copy, and open decisions.

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
page. The public build is bilingual at rest: English pages stay on their
existing routes and Simplified Chinese pages are emitted under the matching
`/zh-cn/...` route with the same English slugs. The language control navigates
between those static counterparts instead of rewriting the live DOM, so the
initial HTML, metadata, layout, and accessibility labels already match the
selected language. Shared assets and public benchmark JSON remain unprefixed.

Motion is intentionally restrained: header controls, active navigation, mobile
menu disclosure, and page entry use short transforms/opacity transitions only
when `prefers-reduced-motion` permits them. Reduced-motion users receive the
same state changes without animation.

`website/src/images/foliage.png` is an optimized decorative derivative of the
user-supplied visual reference and rendered homepage capture. It is not a brand
asset or research evidence. The asset keeps only the soft edge foliage needed by
the CSS masks and intentionally excludes page text, logos, controls, and benchmark
content.
