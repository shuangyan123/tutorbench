# Stage II — natural-language mathematical answers and paired DeepSeek reasoning

**Research protocol v0.1 — code and provider-free regressions only until an operator locally authorizes real model calls.** This stage follows the 25-call DeepSeek Flash non-thinking typed-answer pilot. It targets actual verifier robustness to unseen questions, unconstrained answer presentation, and the effect of thinking mode. It is not a general math benchmark or a leaderboard.

## Primary questions

1. Can the verifier recognize true mathematical mistakes made in **unseen** bounded question instances? Which five implemented families are actually decidable?
2. What fraction of natural-language final answers can be interpreted **safely**, without guessing at the final number, a proof, a set, or a geometric configuration?
3. For precisely the **same question text**, what changes between DeepSeek Flash non-thinking and explicitly enabled high reasoning? Do not compare different question sets and treat the difference as the reasoning effect.
4. Can two independent reviewers transcribe a natural mathematical final answer to a typed candidate, retaining an exact quotation of the original and agreement before it is adjudicated?

## Provider thinking setting — checked against official API semantics

The prior 25-case run used model deepseek-flash with thinking.type=disabled and max_tokens=1536. It was a **non-thinking** run, not low/medium/high. DeepSeek Chat Completions currently supports thinking.type=enabled and reasoning_effort=low/high/max. The API maps requested medium to high; there is no distinct medium effort. Enabling thinking without explicitly passing an effort defaults to high, but this stage always requests both fields.

Stage II has two opt-in arms:

- disabled: thinking.type=disabled, max_tokens=3072, no reasoning_effort field.
- high: thinking.type=enabled, reasoning_effort=high, max_tokens=8192.

The output-token caps intentionally differ so long reasoning is not inadvertently truncated as often, but this makes cost and budget asymmetrical. Record tokens, finish reason and latency, not only correctness. Those caps are ceilings, not guarantees that every high-reasoning generation will fit. Do not infer provider-internal reasoning quality from the presence of a reasoning field. The runner never stores the provider's reasoning_content, only a presence flag and reported reasoning-token count. It saves the complete final content verbatim.

Official API documentation: https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/ and https://api-docs.deepseek.com/zh-cn/api/create-chat-completion/

## New, frozen held-out questions

Manifest: fixtures/research/real-natural-math-holdout-v0.1.json. Exactly **20 unseen typed question instances**, four for each of the same five bounded mathematical families: uniform finite occupancy, finite arithmetic-geometric sums, exact circle/line point sets, complete quadratic-rational real solution sets, and moving-line/circle parameter count sets. Every instance must be admitted by the independent-question math solver before running an external model. All 20 typed questions differ from the previously published 25. This is an engineering holdout **within the same restricted domain**, not statistically representative math coverage.

The system prompt allows natural Chinese explanation and mathematical notation, asks for a clear final answer, and **does not require JSON**. The final prompt contains only the math question and answer-format guidance. No reference answer, ground-truth label, verifier verdict, original exam answer or case mutation is transmitted to DeepSeek.

Previous problems included a zero ratio convention and a zero-radius point-circle; this suite avoids those degenerate cases by design, rather than silently resolving contestable conventions.

## Answer capture and judgment

The runner records one non-streaming POST attempt per case, never retries, and never overwrites an output file. It writes exclusive local newline-delimited JSON. Each row includes case ID, arm, request SHA, UTC timestamp, returned model ID, provider response ID when present, status, latency, token counts, finish reason and **the unmodified final rawText**. A transport error, 503, zero content or output truncation never counts as a mathematical error.

For scalar-probability and finite-sum answers, deterministic extraction is deliberately conservative: entire exact number; one complete TeX boxed number or fraction; or one explicitly labeled final-answer line. More than one boxed answer, multiple labeled final answers, unclosed TeX or free prose without a single clear final answer **abstains**. No regex picks the last arbitrary number. Equivalent exact fractions and terminating decimals are compared rationally.

For point sets, complete real solution sets, or parametric sets, any free-form natural-language answer is marked natural_answer_needs_review. The stage does **not** pretend it can generally parse Chinese explanations, handwritten-style notation or arbitrary interval expressions. This is a separately measured answer-interface gap, not evidence of a mathematical error.

Math adjudication invokes the existing exact verifier only AFTER answer extraction or review. Labels are accepted_by_verifier, refuted_by_verifier, unverified_by_verifier, natural_answer_needs_review, scalar_extraction_abstained, model_abstention, output_truncated, provider_failure, and other explicit transport/format states. Do not rebrand any of these as a provider-certified truth label. High-thinking model output may have natural-language calculation errors that the final-answer checker cannot detect; tutoring-step correctness is outside this pilot.

## Manual double review for non-structured answers

The review-template operation produces one local JSON review form per independent reviewer. Its case context includes a hash of the real model response and the question prompt **but not the expected answer or verifier decision**. Each reviewer supplies the same exact source quote and a typed candidate object, or marks unable to extract. The replay-reviews operation checks each quote is literally in the saved raw response, both response hashes agree, the reviewers are distinct, their typed candidates match exactly and the input cases are identical before invoking the existing math verifier.

Reviewer agreement validates **transcription consistency**, not the underlying truth of the mathematical solution. Separately derive gold through independent mathematical methods (and expert arbitration on disputed cases). Therefore real-world false acceptance and actual wrong-answer detection recall remain **null** in all automatically generated summaries until that independent reference is established. No fabricated live score is generated in CI.

## Run on Windows — no ChatGPT attachment download necessary

The user already configured DEEPSEEK_API_KEY in a local PowerShell terminal. Environment variables may disappear after that terminal closes. Do not paste API keys into chat, logs, source files or command arguments. Refresh the branch normally, then use its merged script.

    cd "E:\AI\code save\re"
    git fetch origin
    git switch main
    git pull --ff-only origin main
    python -m pip install sympy==1.14.0 mpmath==1.3.0

Zero-call preview of all 20 question texts for both modes:

    python scripts/research/run_real_natural_math_holdout.py plan --mode disabled --limit 20
    python scripts/research/run_real_natural_math_holdout.py plan --mode high --limit 20

Authorize **one case in each arm** first (two potentially billable API calls total):

    python scripts/research/run_real_natural_math_holdout.py run --execute-live --mode disabled --limit 1
    python scripts/research/run_real_natural_math_holdout.py run --execute-live --mode high --limit 1

If acceptable, authorize the remaining 19 cases per arm (38 additional, potentially billable calls; **40 maximum total** for the paired test):

    python scripts/research/run_real_natural_math_holdout.py run --execute-live --mode disabled --start-index 2 --limit 19
    python scripts/research/run_real_natural_math_holdout.py run --execute-live --mode high --start-index 2 --limit 19

Each run prints its exclusive local result path. **Do not re-run any case to summarize results**. Combine all four paths (first disabled, first high, remaining disabled, remaining high) using:

    python scripts/research/run_real_natural_math_holdout.py summarize --input "PATH1.jsonl" --input "PATH2.jsonl" --input "PATH3.jsonl" --input "PATH4.jsonl"

To generate blinded review forms, use the same four --input flags:

    python scripts/research/run_real_natural_math_holdout.py review-template --reviewer reviewerA --input "PATH1.jsonl" --input "PATH2.jsonl" --input "PATH3.jsonl" --input "PATH4.jsonl" --output "artifacts/research/natural-reviewerA.json"
    python scripts/research/run_real_natural_math_holdout.py review-template --reviewer reviewerB --input "PATH1.jsonl" --input "PATH2.jsonl" --input "PATH3.jsonl" --input "PATH4.jsonl" --output "artifacts/research/natural-reviewerB.json"

Two different reviewers should work independently. Each review has a literal evidenceQuote from the saved final response, candidate as a full typed object/string, and extractionDecision=transcribed. Leave pending if not independently parseable. Verify agreement and exact math without any API calls:

    python scripts/research/run_real_natural_math_holdout.py replay-reviews --review-a "artifacts/research/natural-reviewerA.json" --review-b "artifacts/research/natural-reviewerB.json" --input "PATH1.jsonl" --input "PATH2.jsonl" --input "PATH3.jsonl" --input "PATH4.jsonl"

All raw evidence files should remain local/ignored until deliberately scrubbed and reviewed. Publicly sharing data requires checking privacy, prompts and provider terms.

## Acceptance and limits

CI must validate 20 distinct, mathematically solvable held-out questions and mock (never paid) behavior for exact and ambiguous final-answer extraction, answer-only vs explanatory outputs, high reasoning request controls, no data/key leakage, non-signed identity, truncation/503 distinction, immutable local records, source quote and double-review anti-tampering, zero-call plan and opt-in live. A successful 40-call local paired run remains separate from CI evidence.

With only 20 paired cases, differences are descriptive and uncertain. Neither high thinking nor low thinking is automatically considered the gold answer; independently verify every error. This stage does not evaluate general unstructured question reading, diagrams, multi-turn tutoring, mathematical proof-step reliability or student learning outcomes.
