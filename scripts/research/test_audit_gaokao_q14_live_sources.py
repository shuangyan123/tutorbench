"""No human review: read-back negative controls for exact single-question sources."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
MODULE=ROOT/"scripts/research/audit_gaokao_q14_live_sources.py"
spec=importlib.util.spec_from_file_location("q14_source_check",MODULE)
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
FIXTURE=json.loads((ROOT/"fixtures/research/gaokao-2025-q14-typed-contract-v0.1.json").read_text(encoding="utf-8"))
CATALOG=json.loads((ROOT/"fixtures/research/exam-source-expansion-2022-2026-v0.1.json").read_text(encoding="utf-8"))


def make_html(result="61/25",replacement=True):
    term="有放回地随机取3次" if replacement else "不放回地随机取3次"
    text=f"第14题 一个箱子里有5个相同的球,分别标有1至5,从中{term},记至少取出1次的球的个数X,求数学期望E(X).参考答案 {result}"
    return "<!doctype html><html><head><title>Research test only</title></head><body><p>"+text+"</p></body></html>"


PDF_TEXT="14. 一个箱子里有 5 个相同的球,分别以1~5标号,从中有放回地取三次,记至少取出一次的球的个数 X, 则数学期望 E(X)=___."


class SourceReadback(unittest.TestCase):
    def test_positive_two_live_pages_and_pdf_text(self):
        pages={"site_a":make_html(),"site_b":make_html(result=r"\frac{61}{25}")}
        result=audit.evaluate(PDF_TEXT,pages,FIXTURE,CATALOG)
        self.assertEqual(result["status"],"live_source_text_and_answer_corroborated_not_official_gold")
        self.assertEqual(result["publishedMatchingAnswerHosts"],2)
        self.assertEqual(result["mathematicallyDerivedAnswer"],"61/25")
        self.assertFalse(result["officialExamAuthenticityVerified"])
        self.assertFalse(result["editorialIndependenceVerified"])
        self.assertFalse(result["humanReviewRequired"])

    def test_one_wrong_or_misaligned_source_fails_not_majority_voted(self):
        with self.assertRaisesRegex(ValueError,"published_answer_conflict_requires_adjudication"):
            audit.evaluate(PDF_TEXT,{"a":make_html(),"b":make_html("61/125")},FIXTURE,CATALOG)
        for other in (make_html(replacement=False),
                      "<html><body>14. no readable question</body></html>"):
            with self.assertRaisesRegex(ValueError,"fewer_than_two_live_matched_source_pages"):
                audit.evaluate(PDF_TEXT,{"a":make_html(),"b":other},FIXTURE,CATALOG)

    def test_correct_formula_in_explanation_does_not_override_wrong_final_key(self):
        deceptive=make_html(result="3").replace("</p>",
                     "解题过程：有的公式提到了61/25，但最终答案仍写成3。</p>")
        with self.assertRaisesRegex(ValueError,"source_claim_conflict_"):
            audit.verify_published_html(deceptive,"bad-key",__import__("fractions").Fraction(61,25))

    def test_no_explicit_final_answer_cannot_be_counted_as_publisher_confirmation(self):
        article=make_html().replace("参考答案", "讨论中出现")
        with self.assertRaisesRegex(ValueError,"source_final_answer_not_readable"):
            audit.verify_published_html(article,"not-an-answer",__import__("fractions").Fraction(61,25))

    def test_three_hosts_cannot_majority_vote_away_an_explicit_conflict(self):
        sources={"a":make_html(),"b":make_html(result=r"\frac{61}{25}"),
                 "c":make_html("61/125")}
        with self.assertRaisesRegex(ValueError,"published_answer_conflict_requires_adjudication"):
            audit.evaluate(PDF_TEXT,sources,FIXTURE,CATALOG)

    def test_exact_website_content_mirror_not_two_sources(self):
        with self.assertRaisesRegex(ValueError,"fewer_than_two_live_matched_source_pages"):
            audit.evaluate(PDF_TEXT,{"a":make_html(),"b":make_html()},FIXTURE,CATALOG)

    def test_modified_paper_assumptions_are_not_the_same_question(self):
        wrong=PDF_TEXT.replace("有放回地","不放回地")
        with self.assertRaisesRegex(ValueError,"pdf_question_14_cannot_be_machine_read_back"):
            audit.evaluate(wrong,{"a":make_html(),"b":make_html()},FIXTURE,CATALOG)

    def test_pdf_blob_exact_identity_not_website_popularity(self):
        pdf=b"%PDF-1.7\nfake fixture pdf header only\n"
        catalog=copy.deepcopy(CATALOG)
        source=next(p for p in catalog["papers"] if p["paperId"]=="gaokao-2025-national-1")
        source["source"]["gitBlobSha"]=hashlib.sha1(b"blob "+str(len(pdf)).encode()+b"\0"+pdf).hexdigest()
        self.assertEqual(audit.verify_pinned_pdf_blob(pdf,source["source"]),source["source"]["gitBlobSha"])
        with self.assertRaisesRegex(ValueError,"pinned_pdf_blob_sha_mismatch"):
            audit.verify_pinned_pdf_blob(pdf+b"modified",source["source"])

    def test_html_script_injection_cannot_act_as_an_answer_source(self):
        malicious="<html><head><script>var copied='第14题 一个箱子里有5个球,有放回取三次,记至少取出1次的球的个数X;E(X)=61/25'</script></head><body>No actual question here</body></html>"
        with self.assertRaisesRegex(ValueError,"source_question_semantics_differ"):
            audit.verify_published_html(malicious,"site",__import__("fractions").Fraction(61,25))

    def test_existing_source_evidence_does_not_change_original_authentication(self):
        fixture=copy.deepcopy(FIXTURE)
        fixture["model"]["numberOfDraws"]=4
        with self.assertRaisesRegex(ValueError,"typed_model_not_same_question"):
            audit.evaluate(PDF_TEXT,{"a":make_html(),"b":make_html()},fixture,CATALOG)


if __name__=="__main__":
    unittest.main()
