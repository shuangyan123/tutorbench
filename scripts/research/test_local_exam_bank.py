"""Contract and layout controls for the local exam bank, using synthetic inputs."""
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from local_exam_bank import (  # noqa: E402
    ASSUMED, add_answers, answer_records, classify, find_items, handoff, key_entries,
    question_type, roster, same_prompt,
)
from local_exam_bank_pdf import (  # noqa: E402
    Document, Line, PdfPage, extract_fields, paper_body, source_spans, starts_for, structured_parts,
)

def lines(*rows):
    return [Line(page, 54, top, 360, top + 10, text) for page, top, text in rows]

def document(*items):
    return Document(tuple(PdfPage(600, 850, tuple(page), ()) for page in items))

class MockCrops:
    def crop(self, digest, raw, page, box):
        return {"page": page, "bboxPt": list(box), "sourceSha256": digest}

class ExamBankTest(unittest.TestCase):
    def test_target_roster_and_national_math_alias(self):
        targets = roster()
        self.assertEqual(len(targets), 35)
        self.assertEqual(sum(p["subject"] == "math" for p in targets.values()), 20)
        self.assertEqual(classify("2023年高考数学试卷（新课标Ⅰ卷）（空白卷）.pdf"),
                         ("gaokao-2023-new-gaokao-1", "question", None))
        self.assertIsNone(classify("2021年高考物理试卷（江苏）（空白卷）.pdf"))
        self.assertIsNone(classify("2026年高考数学试卷（江苏）（空白卷）.pdf"))

    def test_pdf_start_patterns_and_instruction_exclusion(self):
        src = lines((1, 10, "1. 请仔细阅读以下试卷注意事项"), (1, 40, "一、选择题"),
                    (1, 80, "1 已知函数的取值范围"), (1, 100, "2.2022 年相关记录"),
                    (1, 120, "2.45 是示例数值"), (1, 160, "3．下列选项中"))
        self.assertEqual(starts_for(src, 3, body=paper_body(src)), {1: 2, 2: 3, 3: 5})

    def test_cross_page_question_keeps_continuation_and_choice_order(self):
        a = lines((1, 620, "1. 题面保留图示条件"))
        b = lines((2, 120, "A. 甲 B. 乙"), (2, 180, "C. 丙 D. 丁"), (2, 250, "2. 下一题"))
        doc = document(a, b)
        spans = source_spans(doc, 0, 3)
        self.assertEqual([p for p, _ in spans], [1, 2])
        self.assertLess(spans[-1][1][-1], 250)
        fields = extract_fields(doc.lines[:3])
        self.assertEqual([o["label"] for o in fields["options"]], list("ABCD"))

    def test_reference_key_requires_explicit_number_or_valid_range(self):
        self.assertEqual(key_entries("1-3 BDC 4-5 AD"), [(1, "B"), (2, "D"), (3, "C"), (4, "A"), (5, "D")])
        self.assertEqual(key_entries("1. A 2. BD"), [(1, "A"), (2, "BD")])
        self.assertEqual(key_entries("1-3 BD"), [])
        self.assertEqual(key_entries("仅据 1. A 可知……"), [])

    def test_numbered_answer_fails_on_incompatible_type(self):
        doc = document(lines((1, 15, "参考答案"), (1, 45, "1. BC 2. AB")))
        row = {"role": "answer", "sha256": "b" * 64, "localPath": "sources/test.pdf"}
        items = {1: {"questionType": "single_choice"}, 2: {"questionType": "multiple_choice"}}
        found = answer_records(row, b"", doc, None, {"expectedQuestions": 2}, items, MockCrops(), {})
        self.assertIsNone(found[1])
        self.assertEqual(found[2]["nativeText"], "AB")

    def test_short_math_prompt_uses_full_text_and_options(self):
        question = {"fields": {"nativeText": "已知 x\nA. 甲乙丙丁戊己庚 B. 阳性 C. 阴性 D. 偶性"}}
        same = lines((1, 10, "1. 已知 x"), (1, 40, "A. 甲乙丙丁戊己庚 B. 阳性 C. 阴性 D. 偶性"))
        different = lines((1, 10, "1. 已知 x"), (1, 40, "A. 酸性溶液 B. 中性溶液 C. 碱性溶液 D. 混合溶液"))
        self.assertTrue(same_prompt(question, same))
        self.assertFalse(same_prompt(question, different))

    def test_nested_subparts_keep_their_parent(self):
        roots = structured_parts(["（1）先求一项。", "（2）给定两个条件。", "（i）第一问。", "（ii）第二问。"])
        self.assertEqual([p["label"] for p in roots], ["1", "2"])
        self.assertEqual([p["label"] for p in roots[1]["subparts"]], ["i", "ii"])
        self.assertEqual(roots[1]["text"], "给定两个条件。")

    def test_question_type_uses_section(self):
        src = lines((1, 10, "二、选择题：在每题的四个选项中，有多项符合题目要求"),
                    (1, 40, "9. 请选择"))
        self.assertEqual(question_type(src, 1, {"options": []}), "multiple_choice")

    def test_query_and_handoff_do_not_promote_states(self):
        q = {"questionId": "gaokao-2026-national-1/q01", "exam": "gaokao", "year": 2026,
             "edition": "national-1", "subject": "math", "number": 1, "questionStatus": ASSUMED,
             "transcriptionStatus": "needs_manual_transcription", "issues": ["edition_numbering_conflict"]}
        add_answers({1: q}, [], {"expectedQuestions": 1}, MockCrops(), {})
        self.assertEqual(q["answer"], {"pairing": "missing", "status": "abstained"})
        bank = {"questions": [q]}
        self.assertEqual(find_items(bank, year=2026, subject="math", edition="national-1", number=1), [q])
        self.assertEqual(find_items(bank, year=2025), [])
        candidate = handoff(q)
        self.assertEqual(candidate["verificationStatus"], "pending")
        self.assertFalse(candidate["formalScoringEligible"])
        self.assertIn("edition_numbering_conflict", candidate["inputIssues"])

if __name__ == "__main__":
    unittest.main()
