# DeepSeek Flash 25-question real-response math-verifier pilot — research v0.1

**State: a locally executable, explicitly opt-in real-provider experiment. CI uses only mock responses and does not make provider calls. This document does not claim any of the 25 real responses have already been collected.**

## Decision and objective

A real DeepSeek Flash API smoke previously returned HTTP success with finish reason stop and a correct scalar final answer 61/25. The earlier 256-token attempt was truncated and does not count as mathematically wrong. Gemini 3.8 Flash could not be diagnosed reliably in that smoke. The practical next milestone is the error-detection performance of TutorBench's **existing typed-math verifiers**, not further official-paper source authentication.

The frozen manifest is at fixtures/research/deepseek-flash-blind-math-25-v0.1.json. Exactly 25 cases, five from each currently implemented bounded family:

- 5 finite uniform occupancy problems: expectation, variance and event probabilities under independent uniform sampling with replacement.
- 5 finite arithmetic-geometric series sums: ratio 1, ratio 0, ratio -1, rational ratio, indexing cases.
- 5 exact circle-line point sets: irrational points, tangent, disjoint, two rational points, vertical line.
- 5 complete quadratic rational solution sets: roots, removable cancellation but preserved pole, strict inequality, repeated root, empty set.
- 5 moving-line/circle parameter classifications: 0/1/2 intersections, non-unit parameter coefficient, degenerate point-circle.

These are controlled **typed math questions, not a representative sample of Gaokao/Kaoyan examination papers**. Each Chinese prompt is generated entirely from the typed question fields; no answer, verifier output or label is embedded. The runner uses the existing source-blind mathematical bridge after the actual provider response has been captured, not before.

## Exactly what is measured

The runner calls the official DeepSeek Chat Completions endpoint with model deepseek-flash, non-thinking mode, 1536 maximum completion tokens, one fresh independent system/user prompt per case, and no application retries. The actual API key is read from the local DEEPSEEK_API_KEY environment variable and is never included in requests' logged metadata or result files. If the provider times out or errors, it is a provider failure, not a math error.

Responses are classified by exclusive categories:

- math_correct: complete, strictly extractable final answer accepted by the exact verifier **under the typed mathematical model**.
- math_incorrect: complete, strictly extractable final answer refuted by exact mathematics, with a counterexample when the bridge provides one.
- math_unverified: a completed answer that the existing verifier cannot adjudicate, such as unsupported number syntax.
- format_invalid: model gave invalid or ambiguous whole-object JSON for a geometric or set answer; no regex extraction from prose.
- output_truncated: finish_reason was length (even if its partial output happens to contain a number).
- empty_response: finish_reason stop but no final content.
- provider_failure: HTTP error, timeout, invalid response or upstream failure, with status code if available.
- provider_identity_mismatch: response does not report the requested model ID.
- model_incomplete: other non-stop finish reasons.

The original visible provider message.content is preserved **verbatim** in a new exclusive local JSONL artifact. JSON structured candidate fields are normalized for *evaluation only* after requiring the **entire** trimmed response to be one JSON object with no duplicate keys; the verbatim response remains in the audit record. Existing scalar and typed set/point mathematical verification contracts are reused. An exact-fraction 61/25 and the exact-equivalent finite decimal 2.44 are mathematically equivalent, not a string mismatch.

Reports include total attempted, family-level denominators, math-correct, math-incorrect, undecidable, truncated, format-invalid, provider failures and decidable coverage. **Empirical false acceptance rate and wrong-answer detection recall remain null** until a separately reviewed or independently calibrated real-response gold set exists; using the same verifier to assign both truth and its own accuracy would be circular. The synthetic wrong-answer mutation suite from PR #338 remains the specific, known-label regression gate.

## Local PowerShell procedure

Run these commands in the **same PowerShell terminal** that holds DEEPSEEK_API_KEY. Do not paste keys into chat or commit raw JSONL files.

    cd "E:\AI\code save\re"
    git fetch origin
    git switch main
    git pull --ff-only origin main
    python -m pip install sympy==1.14.0 mpmath==1.3.0

Before any paid API usage, preview the complete 25-question plan:

    python scripts/research/run_deepseek_flash_math_25.py plan --limit 25

Perform **only the first actual call** to verify key inheritance, provider response and result-file creation:

    python scripts/research/run_deepseek_flash_math_25.py run --execute-live --limit 1

If the first smoke is satisfactory, run the **remaining 24 once**; the indices are 1-based and nonoverlapping:

    python scripts/research/run_deepseek_flash_math_25.py run --execute-live --start-index 2 --limit 24

Each execution emits its unique, never-overwritten result path, by default under artifacts/research/deepseek-flash-25-*.jsonl. To combine the two results, copy the exact printed output paths as arguments to:

    python scripts/research/run_deepseek_flash_math_25.py summarize --input "PATH_TO_1_CASE.jsonl" --input "PATH_TO_24_CASES.jsonl"

Alternatively, one explicit run with limit 25 performs **25 paid API requests**. Never run a second 25-case pass just to summarize the first; use summarize mode, which makes **zero API requests**.

No automatic retries, recovery loops or retry-on-503 behaviors are enabled; a provider error stays a failed attempt. There is no hard currency price prediction because actual provider billing terms can change. The saved output includes request SHA-256, model label, provider response ID when supplied, token counts when supplied, finish reason, original text, verification status, and type-specific exact reference answer derived after the response. Provider identity is operator-declared/observed, not cryptographically signed by DeepSeek.

## Mandatory evidence limitations and follow-up

The smoke in the conversation is a user-observed live response, **not an automatically captured, replayable JSONL record of this new pilot**. Mock CI is not live AI evidence. Correctness classification is only as valid as the typed question and mathematical engine; the question→typed model alignment is fixture-authored, not externally blinded. The model is explicitly instructed to return narrow final-answer JSON for geometry and solution sets; a conversationally correct answer in another format may be marked unverified or invalid, which must not be counted as a mathematical error.

Before claiming that the verifier reliably catches actual frontier-model mistakes across general exam tasks, independently label each real response through a distinct mathematical method / reviewer, inspect false accepts and false rejects, stratify by topic and boundary error, and report sample sizes and uncertainty. No performance claims about free-form proof grading, diagram understanding or educational outcomes follow from this pilot.
