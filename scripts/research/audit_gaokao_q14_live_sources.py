#!/usr/bin/env python3
"""Online source-content readback for one finite-probability Gaokao answer.

Source checks are about observable text and mathematical consistency, not
proof of official original-paper authenticity or independent editorial lineage.
Downloaded copyrighted material stays in ephemeral CI runner files, not repo.
"""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import unicodedata
from fractions import Fraction

EXPECTED_PAPER_ID = "gaokao-2025-national-1"
REQUIRED_Q = 14


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts=[]
        self.skipping=0

    def handle_starttag(self,tag,attrs):
        if tag in ("style","script","noscript","svg"):
            self.skipping+=1

    def handle_endtag(self,tag):
        if tag in ("style","script","noscript","svg") and self.skipping:
            self.skipping-=1

    def handle_data(self,data):
        if not self.skipping:
            self.parts.append(data)


def plain(html):
    parser=PlainText()
    parser.feed(html)
    return unicodedata.normalize("NFKC"," ".join(parser.parts))


def tight(text):
    return re.sub(r"\s+","",unicodedata.normalize("NFKC",text))


def contains_answer(text,numerator,denominator):
    body=tight(text)
    num,den=str(numerator),str(denominator)
    # Both ordinary fractions and LaTeX numerator/denominator syntax.
    return bool(re.search(r"(?<!\d)"+re.escape(num)+r"/"+re.escape(den)+r"(?!\d)",body) or
                re.search(r"(?:d?frac)\{"+re.escape(num)+r"\}\{"+re.escape(den)+r"\}",body))


def find_problem_window(text):
    body=tight(text)
    # Only report anchored text near the same problem, not a free-floating
    # 61/25 from a list of many answer keys.
    question_terms=[m for m in re.finditer(r"(?:一个箱子里有|有5个相同的球|有5个球|箱子里有5个)",body)]
    for m in question_terms:
        # Some references mention "5球" in earlier unrelated sections;
        # require all core semantic features within a bounded local window.
        window=body[m.start():m.start()+2200]
        if re.search(r"(?:不放回|无放回|不放回地)",window[:250]):
            continue
        if (bool(re.search(r"5.{0,15}球",window[:160])) and
            bool(re.search(r"(?:有放回|放回地)",window[:250])) and
            bool(re.search(r"(?:三次|3次)",window[:250])) and
            bool(re.search(r"(?:至少.{0,9}取出.{0,9}次|至少.{0,9}取.{0,9}次)",window[:350]))):
            return window
    return None


def verify_pdf_text(pdf_text):
    window=find_problem_window(pdf_text)
    if not window:
        raise ValueError("pdf_question_14_cannot_be_machine_read_back")
    if not re.search(r"(?:数学期望|E[(（]X[)）])",window[:400]):
        raise ValueError("pdf_target_quantity_missing")
    return {"statementMatched":True,"editionNotOfficiallyAuthenticated":True}


def verify_published_html(html,publisher,reference):
    if len(html)>5_000_000 or len(html)<100:
        raise ValueError("invalid_html_size_"+publisher)
    window=find_problem_window(plain(html))
    if not window:
        raise ValueError("source_question_semantics_differ_"+publisher)
    if not contains_answer(window,reference.numerator,reference.denominator):
        # A contradictory published answer is not overridden by a majority.
        # Only the answer segment is examined; formulae from other questions
        # or intermediate derivations do not count as final answer claims.
        marks=list(re.finditer(r"(?:参考答案|〖答案〗|答案[:：]?)",window))
        for mark in marks[:3]:
            segment=window[mark.end():mark.end()+180]
            if re.search(r"(?:d?frac)\\?\{\\?\d+\}\\?\{\\?\d+\}",segment) or re.search(r"(?<!\d)\d+/\d+(?!\d)",segment) or re.search(r"^[:：]?[0-9]+(?:\\.[0-9]+)?",segment):
                raise ValueError("source_claim_conflict_"+publisher)
        raise ValueError("source_answer_not_present_near_problem_"+publisher)
    return {"publisher":publisher,"questionAligned":True,"exactAnswerClaimObserved":str(reference),
            "independentEditorialLineageCertified":False}


def verify_pinned_pdf_blob(contents,source_record):
    expected=source_record.get("gitBlobSha")
    computed=hashlib.sha1(b"blob "+str(len(contents)).encode()+b"\0"+contents).hexdigest()
    if computed!=expected:
        raise ValueError("pinned_pdf_blob_sha_mismatch")
    if not contents.startswith(b"%PDF-"):
        raise ValueError("git_blob_is_not_valid_pdf_header")
    return computed


def evaluate(pdf_text,html_sources,fixture,catalog,pinned_pdf=None):
    if fixture.get("exam")!={"paperId":EXPECTED_PAPER_ID,"question":REQUIRED_Q,
                              "year":2025,"answerKind":"numeric-expectation",
                              "questionForm":"count_distinct_labels"}:
        raise ValueError("wrong_paper_edition")
    source=next((p for p in catalog.get("papers",[]) if p["paperId"]==EXPECTED_PAPER_ID),None)
    if source is None:
        raise ValueError("missing_pinned_pdf_reference")
    if pinned_pdf is not None:
        blob_hash=verify_pinned_pdf_blob(pinned_pdf,source["source"])
    else:
        blob_hash=None
    pdf=verify_pdf_text(pdf_text)
    # Recompute, do not simply trust the key or the fixture answer string.
    n=fixture["model"]["numberOfEquiprobableLabels"]
    d=fixture["model"]["numberOfDraws"]
    if n!=5 or d!=3 or fixture["model"]["drawsWithReplacement"] is not True:
        raise ValueError("typed_model_not_same_question")
    reference=Fraction(n*(n**d-(n-1)**d),n**d)
    observations=[]
    seen_exact_content=set()
    for publisher,html in sorted(html_sources.items()):
        try:
            observation=verify_published_html(html,publisher,reference)
        except ValueError as exc:
            if str(exc).startswith("source_claim_conflict_"):
                raise ValueError("published_answer_conflict_requires_adjudication") from exc
            continue
        content_hash=hashlib.sha256(html.encode("utf-8")).hexdigest()
        if content_hash not in seen_exact_content:
            observation["retrievedHtmlSha256"]=content_hash
            observations.append(observation)
            seen_exact_content.add(content_hash)
    if len(observations)<2:
        raise ValueError("fewer_than_two_live_matched_source_pages")
    return {
        "status":"live_source_text_and_answer_corroborated_not_official_gold",
        "scope":"Read-backed problem facts and answer claims from current external pages, plus mathematical consistency; DOES NOT authenticate official examination or editorial independence",
        "originalPdfCopyQuestionTextMatched":pdf["statementMatched"],
        "extractedPdfPageTextSha256":hashlib.sha256(pdf_text.encode("utf-8")).hexdigest(),
        "pinnedGitPdfBlobShaMatched":blob_hash is not None,
        "pinnedGitPdfBlobSha":blob_hash,
        "mathematicallyDerivedAnswer":str(reference),
        "publishedSourcePagesVerified":observations,
        "publishedMatchingAnswerHosts":len(observations),
        "officialExamAuthenticityVerified":False,
        "editorialIndependenceVerified":False,
        "humanReviewRequired":False,
    }


def main():
    ap=argparse.ArgumentParser()
    root=Path(__file__).resolve().parents[2]
    ap.add_argument("--pdf-text",required=True)
    ap.add_argument("--html-source",action="append",default=[],
                    help="publisher-group=downloaded HTML path")
    ap.add_argument("--pinned-pdf")
    ap.add_argument("--fixture",default=str(root/"fixtures/research/gaokao-2025-q14-typed-contract-v0.1.json"))
    ap.add_argument("--catalog",default=str(root/"fixtures/research/exam-source-expansion-2022-2026-v0.1.json"))
    args=ap.parse_args()
    sources={}
    for item in args.html_source:
        publisher,sep,path=item.partition("=")
        if not sep or not publisher or publisher in sources:
            raise ValueError("invalid_or_duplicate_source_parameter")
        sources[publisher]=Path(path).read_text(encoding="utf-8")
    result=evaluate(Path(args.pdf_text).read_text(encoding="utf-8"),sources,
                    json.loads(Path(args.fixture).read_text(encoding="utf-8")),
                    json.loads(Path(args.catalog).read_text(encoding="utf-8")),
                    pinned_pdf=Path(args.pinned_pdf).read_bytes() if args.pinned_pdf else None)
    print(json.dumps(result,ensure_ascii=False,indent=2))


if __name__=="__main__":
    try:
        main()
    except (ValueError,LookupError) as exc:
        print(str(exc),file=sys.stderr)
        sys.exit(1)
