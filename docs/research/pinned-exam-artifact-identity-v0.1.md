# Immutable third-party examination artifact identity — research v0.1

**Scope: source-file integrity, not official-paper authentication, question transcription certification, or official answer gold.**

## The gap closed in this phase

A mathematically correct answer to a typed model does not prove that the model matches an actual examination paper. A claimed PDF title, webpage URL or SHA written in a manifest also does not prove which bytes were inspected. This research gate starts from existing immutable Git revision and blob references, downloads those upstream bytes only when explicitly requested, and validates them without including a copy of the external examination text in this repository.

## Two concrete external source artifacts

| Item | Public, third-party copy | What can be automatically established | What remains unverified |
| --- | --- | --- | --- |
| 2025 新高考 I 卷数学第 14 题 | deekur/gaokaomath, pinned commit 6e967722…, PDF blob 4a5702dd… | Git object byte identity, PDF file signature; separate conditional exact solution to a five-label/three-draw model equals 61/25 | Official original, Q14 PDF page/figure mapping, fidelity of that model to the PDF |
| 2025 考研数学一第 20 题 | TsekaLuk/Kaoyan-Math1-Papers, pinned commit 3151b4ac…, Markdown blob 582683c6… | Git object byte identity, bounded Q20 section located between Q20/Q21 headings with short fixed anchors | Conversion/OCR accuracy, conflicting third-party wording, independently supported mathematical solution |

Both remain third-party copies. A fixed Git blob authenticates **content identity at that Git revision**, not the educational authority or the correctness of the published transcription. The complete PDF and Markdown are **not copied** into this repository or the JSON reports.

## Verification and failure behavior

Default offline mode checks only manifest schema, immutable pin formats, safe source repositories and bounded path construction. It records every upstream artifact as not fetched. Its strict mode exits unsuccessfully when byte validation was not actually performed.

With explicit public-upstream fetching enabled, the verifier constructs only two allowlisted raw.githubusercontent.com repository paths, requires a 40-character hexadecimal revision and safe UTF-8 file paths, reads at most 16 MiB per item and checks the exact Git blob hash:

[
\mathrm{SHA1}(\text{blob} + \text{ASCII byte count} + \text{NUL} + \text{raw bytes}).
]

It also emits the raw artifact SHA-256 for reproducibility. Wrong hashes, unsafe paths, oversized or invalid formats fail closed. No provider credentials, LLM requests or manual review are needed.

For Q20 Markdown, exactly one configured Q20 heading, one later Q21 heading, and exactly one occurrence of each short section anchor are required. The report only records byte position, section byte length and section SHA-256; it does not reproduce protected question text. The conversion's mathematical fidelity is still unverified. The PDF case is explicitly marked as binary verified **but the question not located**: a valid PDF header is not an extraction or page comparison.

The conditional occupancy problem is passed to the pre-existing source-blind exact mathematics bridge. The exact answer is 61/25 under those **supplied mathematical assumptions**, not an official answer proven to come from the PDF. Replacing the candidate with 62/25 is mathematically refuted under the same model. Neither verdict can promote source authenticity.

## Five independent evidence gates

1. G1: **Object integrity.** Pinned bytes equal the source Git blob reference.
2. G2: **Question locator.** Third-party Markdown section may be located; the PDF question remains unlocated.
3. G3: **Source-to-model fidelity.** Neither external item has a certified original-statement-to-AST mapping.
4. G4: **Conditional exact mathematics.** Five-label/three-draw expectation 61/25 is derived independently from the supplied typed hypothesis.
5. G5: **Official provenance and answer gold.** Zero authenticated official papers, zero authenticated question models and zero released official answer keys.

G1 cannot imply G2–G5; G4 does not imply G3. In particular, two publishers agreeing on an answer cannot establish that their paper transcript is the official original.

## How to reproduce

Research inputs: fixtures/research/pinned-exam-artifacts-v0.1.json. Implementation: scripts/research/audit_pinned_exam_artifacts.py.

Offline, network-free tests:

    python -m unittest scripts/research/test_audit_pinned_exam_artifacts.py -v
    python scripts/research/audit_pinned_exam_artifacts.py --manifest fixtures/research/pinned-exam-artifacts-v0.1.json

Explicitly verify current accessibility and historical Git content bytes (public GitHub HTTP requests; zero LLM cost):

    python scripts/research/audit_pinned_exam_artifacts.py --manifest fixtures/research/pinned-exam-artifacts-v0.1.json --fetch-upstream --require-byte-verification

The dedicated CI workflow checks the two prior source ledgers, tampered files and identities, fraudulent official claims, ambiguous section anchors, missing/duplicated questions, malformed hypothesis values, unsafe inputs and strict offline failure. The opt-in upstream job tests the concrete pinned PDF and Markdown bytes. All output must preserve zero official examination certification and zero live AI accuracy.

## What is not solved yet

This is **not** universal Chinese mathematical NLP, diagram reading, PDF Q14 extraction or automated authority certification. The next evidence barrier is reliably locating and checking exact question regions against the immutable original pages and cross-checking every condition and formula before treating a typed model as faithful. Real-paper accuracy and full-paper coverage therefore remain unmeasured.