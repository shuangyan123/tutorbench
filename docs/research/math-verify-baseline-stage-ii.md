# Stage II: offline comparison with Math-Verify before reinventing answer parsing

## Provenance: real user-provided smoke, not CI-simulated model quality

The 2026-11-04 DeepSeek Flash paired smoke used the **same** typed occupancy problem: six equally likely labels sampled independently with replacement four times. Both \`disabled\` and \`high\` models returned the exact correct final result 671/216 and finish reason stop, but our initial scalar extractor returned \`scalar_extraction_abstained\` for both. The final display included a boxed **equation and approximation**, e.g.:

    \boxed{E[X]=\frac{671}{216}\approx 3.1065}

This is more complex than the custom scalar parser's supported single fraction. The reported high-thinking reasoning-token count was 104; the nonthinking report had no reasoning-token count field, not a certified count of zero. A single correct pair cannot measure any improvement in mathematical accuracy attributable to thinking.

## Prior art and reuse policy

The mature open-source Hugging Face **Math-Verify** (https://github.com/huggingface/Math-Verify) already supports LaTeX, expression, equation, set/interval parsing and symbolic-equivalence comparison. Pin the independent research baseline to **math-verify==0.9.0**, whose PyPI release was published on 2026-01-10. Install its explicit ANTLR 4.13.2 feature to avoid runtime ambiguity.

The goal is to compare the **existing** answer extractor on captured real outputs with this outside tool, without silently changing TutorBench's production verifier, writing a duplicate LaTeX parser, rewriting answer text, or making additional model requests.

Math-Verify itself uses heuristic extraction and configurable numeric tolerance, so it is not a proof-producing oracle. In particular, a parsed approximation such as 3.1065 cannot be treated as exactly equal to 671/216; extracting an intermediate 625/1296 instead of the final answer would produce a spurious wrong verdict. The diagnostic uses the external library's parsed candidates as evidence only, and forwards **one single exact rational candidate** to our own typed verifier. Floats, symbolic expressions and ambiguous multiple results remain non-decisive in this conservative research report. For complete sets, geometric point sets, algebraic proofs and other tasks, automatic general mathematical truth claims remain out of scope.

The comparison input is the actual JSONL files generated in the local 20-case holdout. Their immutable request SHA, response ID, finish reason and original raw model output are preserved. The benchmark script emits only minimal extracted representations and a source-response SHA-256, **not full original model text**. Reference mathematics is derived only after extraction, never passed to Math-Verify or used to select among candidate extractions.

## Windows PowerShell instructions (zero additional DeepSeek API requests)

Use the already checked-out TutorBench main after integration, but install the optional baseline into a **separate venv** so it cannot silently modify core dependencies:

    cd "E:\AI\code save\re"
    git fetch origin
    git switch main
    git pull --ff-only origin main

    $envPath = Join-Path $env:TEMP "tutorbench-mathverify-090"
    python -m venv $envPath
    & "$envPath\Scripts\python.exe" -m pip install "math-verify[antlr4_13_2]==0.9.0"

Now inspect both **original** nonthinking and high-thinking saved results, without regenerating any answer:

    & "$envPath\Scripts\python.exe" scripts/research/compare_math_verify_baseline.py --id h-occ-01 --input "E:\AI\code save\re\artifacts\research\natural-math-disabled-20261104T143209Z-1607902c.jsonl" --input "E:\AI\code save\re\artifacts\research\natural-math-high-20261104T143213Z-9fa5b5ef.jsonl"

The JSON displays two records, old TutorBench status, Math-Verify parsed expressions and exact-comparison result **only if the parsed output unambiguously constitutes one exact rational**. \`mathVerifyState=ambiguous_or_nonnumeric\`, \`no_expression_extracted\`, \`approximate_only_no_exact_comparison\` or \`parser_exception\` are valuable baseline evidence, not a failure to be hidden. There are **no model API calls**.

For additional real holdout cases, pass their saved JSONL paths and select a case ID with \`--id\`. This stage requires separate independent human mathematical review for any false-positive/false-negative claims. The external baseline is optional research-only code; TutorBench's core remains on its pinned dependencies.
