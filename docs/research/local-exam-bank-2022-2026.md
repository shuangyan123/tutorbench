# Local exam bank for 2022–2026

This research tool builds a local question bank from user-supplied exam files. It uses the existing mathematics catalog IDs, PDF layout extraction and the four source-bound transcriptions from PR #344. The import runs independently of that draft's G0–G4 acceptance cohort. Local file bytes are the working source. The bank represents the regular Gaokao and Jiangsu selection exams. Its reader returns research data and a pending verifier handoff.

## Build and query

The tested Windows runtime used Python 3.12, `pdfplumber 0.11.9`, `pypdfium2 5.14.0` and `Pillow 13.0.0`. Use a Python environment outside the checkout.

```powershell
python -m pip install 'pdfplumber==0.11.9' 'pypdfium2==5.14.0' 'Pillow==13.0.0'
$env:PYTHONUTF8 = '1'
python -B scripts/research/local_exam_bank.py build --source 'E:/BaiduNetdiskDownload' --out data/private/exam-bank-release --pilot 'E:/AI/code save/re-pr344-phase1/data/private/pilot-2026-jiangsu'
python -B scripts/research/local_exam_bank.py list --bank data/private/exam-bank-release/bank.json --exam gaokao --year 2026 --subject math --edition national-1
python -B scripts/research/local_exam_bank.py get --bank data/private/exam-bank-release/bank.json --exam gaokao --year 2026 --subject physics --edition jiangsu-selection --number 7
python -B scripts/research/local_exam_bank.py handoff --bank data/private/exam-bank-release/bank.json --question-id gaokao-2026-national-1/q19
python -B -m unittest scripts/research/test_local_exam_bank.py -v
```

Use a fresh output path under `data/private/` for each build. `--years 2026` restricts the run to the smoke cohort. `--pilot` is optional. It loads the four existing transcriptions only when the source and candidate digests match. The JSON, JavaScript data, PDF working copies, and source/answer crop images all stay in the ignored output directory.

Open the generated `index.html` for the four filters and original-image rendering. A loopback server can serve the same files when the browser environment restricts file URLs.

```powershell
python -B -m http.server 18764 --bind 127.0.0.1 --directory data/private/exam-bank-release
```

Use `http://127.0.0.1:18764/#year=2026&subject=physics&edition=jiangsu-selection&number=7` in that browser. The query CLI uses the same records. An ambiguous or missing single-item query returns an error.

## Data and coverage

| Output | Meaning |
| --- | --- |
| `bank.json` | Version 1 bank. Paper identity is exam, regular session, year, subject and edition. Each item has a stable `paperId/qNN` ID, source SHA-256, printed number, PDF pages, candidate fields, display crops and reference-answer record. |
| `exam-coverage-2022-2026.csv` | One row per target edition, including missing editions, expected and indexed question counts, uncertain boundaries and reference answer counts. |
| `coverage-report.md` | Readable rendering of the CSV results. |
| `file-inventory.csv` and `file-inventory.json` | Local inputs with role, format, SHA-256, page and text extraction counts, and byte or content duplicate status. |
| `exceptions.json` | Question IDs requiring transcription or answer-pairing work, with reasons. |

Source display coordinates use points measured from the top-left of the physical PDF page. The per-question regions preserve formulas, tables, diagrams and layout without relying on reconstructed native text. Embedded image locations give finer coordinates where the PDF exposes them. Vector diagrams and tables remain in the question region. Candidate text, options and nested parts are separate from the rendered source. Empty formula or unit arrays on a `needs_manual_transcription` item indicate unfinished extraction. The four pilot drafts carry visually transcribed fields. They remain working assumptions.

Answer pairing uses explicit printed answer numbers or a repeated prompt with the same number in an annotated edition. An incompatible choice count or unresolved prompt remains pending. A matched reference uses `user_supplied_assumed_correct`. Conflicts use `disputed`, and absent or unreliable pairing uses `abstained`. The contract reserves `verified` for later checking. Explicit analysis and recognizable interleaved proofs have separately referenced solution regions. The handoff emits the question and candidate answer as a `tutorbench-correctness-input-candidate` with `verificationStatus: pending` and `formalScoringEligible: false`. It makes no verifier call.

## Local input results

The target roster contains 20 national mathematics editions and 15 Jiangsu science editions. It includes both 2026 mathematics editions and Jiangsu biology as explicit target slots. The five source directories and four loose PDFs supplied 72 in-scope files. National Paper I in the Jiangsu mathematics directory is the same edition as its counterpart in the national directory. Content comparison recognized six different-byte copies and byte comparison recognized two exact copies. This left 33 editions with material.

| Year | Target editions | With material | Complete source-page indexing | Indexed questions | Matched reference answers |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2022 | 9 | 9 | 9 | 192 | 189 |
| 2023 | 9 | 9 | 9 | 192 | 190 |
| 2024 | 7 | 7 | 6 | 137 | 136 |
| 2025 | 5 | 5 | 5 | 94 | 94 |
| 2026 | 5 | 3 | 3 | 52 | 52 |
| Total | 35 | 33 | 32 | 667 | 661 |

The known target question denominator is 689, including 19 for the missing 2026 National II mathematics edition. The missing 2026 Jiangsu biology edition has an unknown question count. The 667 indexed items include 20 from the supplied 2024 National A humanities copy, whose printed numbering and contents disagree with the catalog copy. They are searchable by the supplied numbers with `disputed` status and a handoff issue. The original reference pairings within that copy remain separate from the edition conflict. The denominator of 667 for answer pairing is the actual indexed set. Source crop availability is 667/667. Structured text still needs manual transcription for 663/667. No questions have a correctness verification result.

The local browser checks cover year/subject/edition/number lookup, a formula-heavy prompt, a cross-page physics diagram, a chemistry reaction diagram and separate answer sheet, and missing-source or uncertain-answer messages. The tool and synthetic tests are tracked. The source files, generated candidates and answers stay local.
