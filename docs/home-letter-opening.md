# Home opening: a letter to learners

Status: design prototype on a feature branch for visual review. It changes
only the public website's Home route. It does not touch evaluators, datasets,
scoring, evidence contracts, or any other route.

## Intent

A first-time visitor to Home is handed a letter. They open it themselves, read
Teachometry's long-term hopes for education at their own pace, and step into
the existing Home page. The letter is brand writing, not benchmark evidence: it
says plainly that these hopes have not been reached and that TutorBench is a
starting point for observing and improving AI teaching, not proof that anyone
learns more.

## Concept: a letter that waits for you

The best teaching often works like a good letter. It is written for one
person, it is read at that person's pace, and it waits for them. The opening
is built around that idea, which is also the first hope in the letter (asking
freely, at your own pace):

- **Nothing plays on its own clock.** The letter appears instantly and does not
  open until the visitor opens it. After the short opening (about two seconds,
  started by the visitor), the text only moves forward when the reader scrolls
  or presses Continue.
- **Ink follows the reader.** The whole letter is visible from the start, so its
  length is never hidden, but unread passages are a pale draft. As a passage
  reaches the reader it settles into ink, and its margin mark is drawn.
- **The paper becomes the page.** At the end, the sheet widens into the page
  beneath it and the letter steps aside, so Home appears out of the paper
  rather than after a curtain.

### Visual language

- **Quiet stationery, not kitsch.** A translucent glassine envelope over warm
  paper instead of kraft paper and wax. The folded letter and its lines show
  faintly through it. The palette is Teachometry's existing ivory, forest, and
  ink blue; type is the site's Georgia serif (Song/Ming serif for Chinese).
- **Window light and leaf shadow.** Soft light falls across the desk with a
  blurred leaf shadow that sways slowly, echoing the sunlit plants of the Home
  hero photograph. In dark mode the desk is lit by a warm lamp and the paper is
  a dark sheet with cream ink, so it never glares.
- **A question as the seal.** The envelope is closed with a round seal carrying
  a question mark: opening the letter is the first question.
- **Three margin marks** in a pencil-like stroke: a question (ask freely), a
  wandering path (explore by choice), and a sprout (make something new).
- **A real tri-fold.** The letter unfolds top third, then bottom third, and
  keeps two faint crease lines.

The seal, marks, and flourish are illustrations inside this opening. They are
not a Teachometry logo or a logo proposal. Teachometry is set as text, and the
TutorBench mark is not used here.

## Storyboard

| Beat | What the visitor sees | Input |
| --- | --- | --- |
| 1. Arrival | Desk in window light; a sealed envelope addressed "To whoever is learning something today" / "致　每一个正在学习的人". Top bar: Teachometry (text), the other language, Skip to Home. | — |
| 2. Opening (~2 s) | The question seal lifts, the flap turns back, the letter rises out, the envelope sinks away, and the sheet unfolds in thirds. | Click, tap, Enter, or Space on the envelope |
| 3. Reading | "Dear learner," inks in. Continue (↓) inks the next passage and brings it to the reading line; scrolling does the same. | Continue, scroll, swipe, Space/arrows, Enter on the letter |
| 4. Three hopes | I. Ask freely. II. Explore because you want to. III. Dare to make something new. Each margin mark draws as its passage inks. | — |
| 5. Honesty | A short rule, then: these hopes have not been reached; TutorBench is where we start, and it cannot yet show that anyone learns more. | — |
| 6. Signature | "Until then — keep asking." Teachometry signs with a drawn flourish, and a P.S. invites questions (link to Contact). Continue becomes Enter Teachometry. | — |
| 7. Into Home | The words fade, the sheet widens to the viewport, the letter fades, and the Home hero rises gently into place. | Enter Teachometry |

Skip to Home and Escape work at every beat and close the letter in a quarter
second.

## The letter

The letter is authored separately in each language rather than translated
word for word. The source of truth is `src/site/pages/home-letter.ts`.

### English

> *Envelope:* To whoever is learning something today
>
> Dear learner,
>
> We believe everyone deserves a chance at the best education.
> Not the most expensive. Not the most exclusive.
> The kind that begins where you are, and stays with you until you understand.
>
> This is a letter about the future we hope to help build. It holds three hopes.
>
> **I. Ask freely.**
> Think of a question you kept to yourself — because it seemed too simple,
> because everyone else seemed to get it already, because the way you saw it
> was different.
> We hope for a future where that question is welcome. Asked as many times as
> you need, at your own pace, in your own words.
>
> **II. Explore because you want to.**
> So much learning still runs on pressure: the next exam, the next deadline,
> someone watching over your shoulder.
> We hope for learning that runs on something quieter, and stronger: the wish
> to understand. Curiosity that is noticed, fed, and followed wherever it leads.
>
> **III. Dare to make something new.**
> Education should not end at remembering what is already known, finding the
> expected answer, finishing the standard task.
> We hope everyone gets the chance to form a view of their own, to ask the
> question no one has asked yet, and to try making something that does not exist.
>
> *These are long hopes. We have not reached them, and we will not pretend that
> we have.*
>
> So we are starting somewhere smaller, and more careful: learning to see
> clearly what good teaching looks like.
> TutorBench is that start. It studies how to observe, evaluate, and improve the
> way AI teaches, one authored case at a time. It cannot yet show that anyone
> learns more because of it. It can help us look closely, and honestly.
>
> We will keep writing as we learn.
> Until then — keep asking.
>
> — Teachometry
>
> P.S. If this letter leaves you with a question, ask us. That is rather the point.

### 简体中文

> *信封：* 致　每一个正在学习的人
>
> 亲爱的学习者：
>
> 我们相信，每个人都应该有机会，享有最好的教育。
> 不是最昂贵的，也不是最难进入的。
> 而是从你所在的地方出发，一直陪你走到真正明白的那一种。
>
> 这封信，关于我们希望一起去往的未来。信里装着三个愿望。
>
> **一　自由地提问**
> 也许你曾把一个问题咽了回去：怕它太简单，怕别人早就懂了，怕自己想得和大家不一样。
> 我们希望有这样一个未来：那个问题会被认真接住。你可以问很多遍，按自己的节奏，用自己的话。
>
> **二　主动地探索**
> 太多学习仍然靠压力推动：下一场考试，下一个截止日期，一双盯着你的眼睛。
> 我们期待另一种力量，更安静，也更持久——想要弄明白的那份好奇。它被看见，被呵护，被认真回应，并带你走向更远的地方。
>
> **三　大胆地创造**
> 教育不该止步于记住已知、找到标准答案、完成规定动作。
> 我们希望每个人都有机会形成自己的看法，提出还没有人问过的问题，去尝试做出世界上还没有的东西。
>
> *这些是很长远的愿望。我们还没有抵达，也不会假装已经抵达。*
>
> 所以，我们从更小、也更需要严谨的一步开始：先学会看清，什么是好的教学。
> TutorBench 就是这一步。它研究如何观察、评估并改进 AI 的教学，从一个个精心编写的案例做起。它还不能证明有人因此学得更好；但它能帮我们看得更仔细，也更诚实。
>
> 我们会一边学，一边继续写下去。
> 在那之前——请继续提问。
>
> —— Teachometry
>
> 附言：如果这封信让你想问点什么，欢迎来问我们。毕竟，这正是重点。

## When the letter appears

| Situation | Behaviour |
| --- | --- |
| First visit to Home (`/` or `/zh-cn/`) | Opens before first paint, so Home never flashes first |
| Any later Home visit, refresh, or Back | Home directly |
| Any other route, including direct links | Never shown |
| `prefers-reduced-motion: reduce` | Home directly; the letter is available from Home and opens fully inked with no animation |
| JavaScript off | Home directly; no letter and no entry |
| Storage blocked or unavailable | Home directly, because the visit could not be remembered |
| Link ending in `#letter` | Opens the sealed letter even for returning visitors (shareable) |
| Speculative prerender of Home | Rendered, but not remembered until the page is actually shown |

**State kept:** one `localStorage` key, `teachometry-letter-v1`, with the value
`"1"`, written when the letter is first shown. No cookie, no server call, no
analytics, and nothing about how the letter was read. Raising the key version
would deliver a substantially rewritten letter once more.

**Reading it again:** Home shows a small "A letter to learners" entry beside
the hero's handwritten note. It reopens the letter directly at the unfolded
sheet (no envelope), and focus returns to it on close. The entry is shown only
when the letter can open, and it is visible from first paint, so it never
shifts the layout.

**Language:** the letter is in the page language. Its top bar links to the
other language's letter (`zh-cn/#letter` or `../#letter`; relative so it works
under any base path).

## Engineering

- `src/site/pages/home-letter.ts` holds the copy, the dialog markup, the Home
  entry, and a small inline first-visit script. `SitePage.prelude` places the
  dialog before the header, and the script runs right after it, before the
  header and Home content are parsed.
- `website/src/letter.css` and `website/src/letter.js` load only on Home
  (about 6 KB and 3 KB gzipped). There is no dependency, no web font, no image,
  and no sound.
- The letter is a native modal `<dialog>`, so the page behind is inert and
  focus is contained. Skip is a `<form method="dialog">` button and Escape is
  native, so both work even if `letter.js` never loads.
- While the letter is open, `html` does not scroll and keeps its scrollbar
  gutter, so Home's width is the same before and after. Measured cumulative
  layout shift for a full first visit is 0.
- Motion animates only transform and opacity. The leaf blur is baked into the
  SVG and shadows are painted once. In a headless, GPU-less Chromium the
  opening and the transition into Home ran at a 60 fps median.
- The hero arrival after the letter is a single 0.9 s rise and runs only after
  Enter Teachometry.

### Accessibility

- The dialog is named "A letter from Teachometry" / "Teachometry 的一封信". Focus
  starts on the envelope, so Enter opens it, as the hint says.
- After opening, focus moves to the letter text so screen readers read it, and
  Enter there continues. Pale "unread" passages are a visual state only; the
  whole text is always in the accessibility tree.
- Every control works with mouse, touch, and keyboard and has a visible focus
  style. Reduced motion removes all animation.

### Search and direct access

Home's HTML is unchanged apart from the closed dialog before the header and the
entry link. The hero, five-dimension story, cases, and footer are still the
main landmark content. Crawlers that run JavaScript with empty storage will see
the letter covering Home, as a first visitor does. See residual risks.

## Residual risks and owner decisions

- **Interstitial risk.** Search engines can discount pages that cover content
  for visitors arriving from search, especially on mobile. Possible changes, if
  wanted: never auto-open on narrow screens, or show the letter only on direct
  visits.
- **Reduced motion means no automatic letter.** This reads "reduce motion" as
  "go straight to content". The alternative is a static, auto-opened letter.
- **The opening is about two seconds.** It is started by the visitor and
  skippable, but it could be shortened.
- **No sound.** A letter is read in silence and many people browse in shared
  spaces. A soft paper sound on opening (never autoplayed) could be added on
  request.
- **Copy review.** The English and Chinese letters are first drafts for the
  owner's voice; tone, the P.S., and the honesty passage are the parts most
  worth reviewing.
- **The seal and marks are not a logo.** If the question-mark seal is liked as
  a motif, it should go through a separate brand decision before appearing
  anywhere else.
