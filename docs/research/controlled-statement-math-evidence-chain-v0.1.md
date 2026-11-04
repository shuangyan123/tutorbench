# Controlled problem-statement → typed mathematics → exact answer evidence chain (v0.1)

## Why this gate exists

An exact solver does not certify a mathematics **exam question** if its assumptions were silently mistranscribed. A missing minus sign, altered coefficient, wrong summation length or changed intersection-count metric may create a different problem that has a mathematically valid but irrelevant answer.

This provider-free research pilot adds a **source-statement fidelity gate** before the existing exact-math dual-path judge. Its intentionally narrow purpose is to prove that a supplied, versioned **controlled-format** statement exactly corresponds to a typed mathematical question; **it is not free-form natural-language understanding** or authentication of a real examination paper. Arbitrary PDFs, screenshots, OCR, third-party summaries, symbolic algebra text and unrecognized Chinese wording fail closed.

## Threat model and stages

Each case includes: an explicit \`source\` object; the complete versioned Chinese \`statement\`; \`statementSha256\`, computed over its **original UTF-8 bytes**; an independent \`declaredQuestion\`; and a source-free \`path\` (\`existing_answer\` or \`no_answer\`).

The verifier checks, in order:

1. Strict source and payload schema, including the source's declared origin. The only allowed origin labels are \`synthetic_controlled_statement\` and \`unverified_external_transcription\` — neither means independently authenticated or official.
2. Recompute the 64-character SHA-256 fingerprint over the statement. A mismatch abstains.
3. Match the *entire* string using an **anchored, version-labelled grammar**, separately for finite arithmetic–geometric sums (\`AGSUM-1\`), bounded circle-line intersection points (\`CLPOINT-1\`) and moving-line intersection-count parameter sets (\`CLPARAM-1\`). Explicit textual coefficients are parsed to a typed question.
4. Independently render the extracted question into its canonical statement, requiring byte-for-byte identical content and permitted mathematical input bounds.
5. Require exact equality between the independently extracted question and \`declaredQuestion\`. This also catches a forged fingerprint over a modified statement whose declared mathematical data were not updated.
6. **Only then** feed the *parsed* question, not the declaration, into the existing independent exact mathematics solver. Only after derivation may it read a candidate published answer or a canonical-JSON offline replay. It uses the existing trusted bridge's correct/refuted/unverified decisions.

Each output distinguishes \`formalizationStatus\`, recomputed statement and model fingerprints, question mathematics status, candidate-verdict status, reported source origin, and explicit \`originalSourceAuthenticated:false\`, \`officialExamGoldCertified:false\`, and \`liveAIModelCallPerformed:false\`. The batch aggregates separate "formalization exact" counts from maths/answer correctness.

## What the certificate does **not** prove

**SHA-256 integrity is not a signature, independent source lineage, or evidence that the source originated with an examination authority.** Someone who edits both a statement and its hash can still create a perfectly valid controlled-format problem. The additional *declared-model agreement* gate prevents silently applying the old model after such an edit, but cannot distinguish authentic exam sources from fabricated matching source+model pairs.

Therefore:
- \`controlled_statement_exact_roundtrip\` means **exact alignment conditional on the provided controlled-format text**.
- \`unverified_external_transcription\` is only a stated origin claim; no independent publisher or official-paper authentication follows.
- No real Gaokao/Kaoyan item is marked official-gold from these 12 synthetic fixtures.
- A future real-paper source archive requires immutable original copies, independent authenticity/lineage, precise citation/coordinates, and separate verification of the typed transcription.

This gate is a necessary **bounded fidelity layer**, not proof of arbitrary exam NLP, proofs or general mathematical reasoning.

## Reproducible fixture and adversarial checks

The frozen fixture holds **12 fully decidable synthetic statements** across all three supported mathematical families: 4 independently solved with no answer, 3 mathematically verified and 3 refuted proposed answers, and 2 correctly validated offline replays. **Zero** genuine model runs and **zero** official exam gold are claimed.

Adversarial tests alter a minus sign, numeric coefficient, question metric, Unicode punctuation, trailing spaces, a source fingerprint, a typed declaration, source authority tags, a replay transcript, and a presumed exam association. Each mismatch must return **unverified**, not a successful score. The tests also prove that corrupting a candidate cannot affect the derived exact answer. No credential or network access is needed.

\`\`\`powershell
python -m pip install sympy==1.14.0 mpmath==1.3.0
python -m unittest scripts/research/test_verify_controlled_math_statement_binding.py scripts/research/test_verify_parametric_circle_line_classification.py scripts/research/test_verify_dual_path_math_answers.py -v
python scripts/research/verify_controlled_math_statement_binding.py --fixture fixtures/research/controlled-statement-math-chain-v0.1.json --require-decidable
\`\`\`

The dedicated CI workflow independently reruns both fixtures and enforces the documentation index references. Follow-on work should replace controlled text-only assumptions with immutable, reliably sourced real-paper artifacts and independently assessed text-to-model fidelity, without conflating it with exact downstream mathematics.
