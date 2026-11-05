# Stage II: offline comparison with Math-Verify before reinventing answer parsing

## Provenance: real user-provided smoke, not CI-simulated model quality

The 2026-11-04 DeepSeek Flash paired smoke used the **same** typed occupancy problem: six equally likely labels sampled independently with replacement four times. Both \`disabled\` and \`high\` models returned the exact correct final result 671/216 and finish reason stop, but our initial scalar extractor returned \`scalar_extraction_abstained\` for both. The final display included a boxed **equation and approximation**, e.g.:

    \boxed{E[X]=\frac{671}{216}\approx 3.1065}

This is more complex than the custom scalar parser's supported single fraction. The reported high-thinking reasoning-token count was 104; the nonthinking report had no reasoning-token count field, not a certified count of zero. A single correct pair cannot measure any improvement in mathematical accuracy attributable to thinking.

## Prior art and reuse policy

The mature open-source Hugging Face **Math-Verify** (https://github.com/huggingface/Math-Verify) already supports LaTeX, expression, equation, set/interval parsing and symbolic-equivalence comparison. Pin the independent research baseline to **math-verify==0.9.0**, whose PyPI release was published on 2026-01-10. Install its explicit ANTLR 4.13.2 feature to avoid runtime ambiguity.

The goal is to compare the **existing** answer extractor on captured real outputs with this outside tool, without silently changing TutorBench's production verifier, writing a duplicate LaTeX parser, rewriting answer text, or making additional model requests.

Math-Verify itself uses heuristic extraction and configurable numeric tolerance, so it is not a proof-producing oracle. In particular, a parsed approximation such as 3.1065 cannot be treated as exactly equal to 671/216; extracting an intermediate 625/1296 instead of the final answer would produce a spurious wrong verdict. The diagnostic uses the external library's parsed candidates as evidence only, and forwards **one single exact rational candidate** to our own typed verifier. Floats, symbolic expressions and ambiguous multiple results remain non-decisive in this conservative research report. For complete sets, geometric point sets, algebraic proofs and other tasks, automatic general mathematical truth claims remain out of scope.

## Windows result invalidation and corrective verification (2026-11-04)

The first two real Windows trials returned \`no_expression_extracted\` for both non-thinking and high-thinking \`h-occ-01\`, while the Windows shell printed \`PermissionError: [WinError 5]\` and \`OSError: [WinError 6]\` from \`multiprocessing.spawn\`. **Do not count either result as an actual extraction failure.**

Math-Verify 0.9.0 has an existing upstream issue [#79](https://github.com/huggingface/Math-Verify/issues/79), opened 2026-04-03, documenting this very Windows timeout/pickling failure: with \`raise_on_error=False\`, internal exceptions can silently return \`[]\`; related handle errors can follow. Our initial \`parsing_timeout=3\` inadvertently enabled exactly that incompatible internal timeout wrapper.

The updated baseline uses two explicit layers:

1. A fresh, minimal Python worker calls \`parse(..., parsing_timeout=None, raise_on_error=True)\` without Math-Verify's internal multiprocessing timeout or silent exception swallowing.
2. The parent calls that worker with \`subprocess.run(..., timeout=20)\`, enforces bounded UTF-8 input and output, and distinguishes \`worker_timeout\`, \`worker_launch_failure\`, \`parser_exception\`, \`worker_output_invalid\` and a genuinely successful \`parsed\` with zero candidates. Worker output is JSON-only; no SymPy object is pickled across the process boundary.

The Windows CI regression starts a real third-party parser subprocess, tests a simple boxed fraction, and inspects an equation-plus-approximation fixture without treating heuristics as guaranteed. An actual replay of the two saved JSONL files is still necessary to determine whether this version of Math-Verify successfully extracts their answers.

The package version is now obtained from \`importlib.metadata.version("math-verify")\`; the prior \`mathVerifyInstalledVersion: null\` resulted from reading a missing module \`__version__\`, not necessarily an uninstalled distribution.

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


## The next observed failure: equation-target semantics, not parser availability

After the isolated-worker Windows fix, the operator's **same two genuine saved replies** were parsed by Math-Verify 0.9.0 as exactly one SymPy object per mode:

    Eq(e*x, 671/216)

The original model displayed \`\\boxed{E[X]=\\frac{671}{216}\\approx 3.1065}\`, correctly referring to the expected number of distinct labels. Here Math-Verify's generic LaTeX parser has **misinterpreted \`E[X]\` as \`e*x\`**; this is neither a numeric answer nor a faithful left-hand semantic representation. The prior baseline correctly returned \`ambiguous_or_nonnumeric\` on both. Never use \`Eq(...).rhs\` without a bound target, since unrelated equations and intermediate derivations can have arbitrary right sides.

**Small, explicitly scoped follow-up:** \`scripts/research/check_contextual_expectation_baseline.py\` is a research-only contextual adapter, not a new mathematical expression parser. It recognizes **one uniquely boxed final answer** whose left side literally binds to \`E[X]\`, and only when the typed question requests \`finite_uniform_occupancy.query.metric=expected_value\`. It takes only the exact right-hand-side LaTeX expression and passes it to our already isolated, size- and time-bounded Math-Verify 0.9.0 worker. If Math-Verify produces exactly one rational number, an optional decimal approximation must agree within one-half of its final displayed place; any mismatch abstains. Only then does the existing typed mathematical verifier independently decide. All answer keys remain inaccessible until after extraction. No inference is made about intermediate derivation correctness.

This adapter intentionally rejects \`x=...\`, \`E[Y]=...\`, multiple boxed answers, unclosed boxes, ambiguous parser results, contradictory approximations, unexpected family/metric and worker errors. It does **not** attempt to cover probability expressions, other statistics, complex LaTeX or natural-language proofs. All earlier unparsed results remain immutable historical evidence.

Replay the original DeepSeek records **offline without new API calls** using the same independent Python environment as above:

    & "$envPath\Scripts\python.exe" scripts/research/check_contextual_expectation_baseline.py --id h-occ-01 --input "E:\AI\code save\re\artifacts\research\natural-math-disabled-20261104T143209Z-1607902c.jsonl" --input "E:\AI\code save\re\artifacts\research\natural-math-high-20261104T143213Z-9fa5b5ef.jsonl"

Expected semantics: if both records have one source-bound \`E[X]=671/216\` and compatible \`\\approx 3.1065\`, their *research-only contextual exact candidates* can be accepted by the typed verifier. The operator should verify actual returned \`contextualResult.state\`, not infer success from CI mocks. Any failure remains a research result and should not be hidden.

The longer-term engineering choice remains **reuse a mature parser plus a small, independently tested semantic target binder**, instead of rewriting LaTeX or declaring all symbolic equalities numeric answers. These results cannot establish general natural-math parsing coverage or reliable automatic grading for tutoring dialogue.
