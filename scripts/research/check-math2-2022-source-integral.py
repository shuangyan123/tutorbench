#!/usr/bin/env python3
"""Research-only: re-evaluate a manually structured 2022 Math-II Q2 integral.

Source identity and textual anomaly verification are separate from authentic
exam-paper checking. No original exam text is bundled or granted gold status.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sympy as S


def git_blob_sha(text):
    raw=text.encode("utf-8")
    return hashlib.sha1(b"blob "+str(len(raw)).encode()+b"\0"+raw).hexdigest()


def verify(markdown, manifest):
    if manifest.get("id") != "kaoyan-math2-2022-q02-source-conflict-v0.1":
        raise ValueError("unexpected_manifest")
    source=manifest["source"]
    if git_blob_sha(markdown)!=source["gitBlobSha"]:
        raise ValueError("upstream_source_blob_drift")
    lines=markdown.splitlines()
    def at(name):
        n=source["lines"][name]
        if type(n) is not int or not 1<=n<=len(lines):
            raise ValueError("source_line_out_of_range")
        return lines[n-1]
    problem=at("problem")
    option_d=at("optionD")
    reported_key=at("reportedKey")
    derivation=at("workedDerivation")
    if not ("（2）" in problem and "\\int" in problem and "\\sqrt" in problem):
        raise ValueError("problem_math_anchor_drift")
    if not re.search(r"（D）\s*2\s*$",option_d):
        raise ValueError("option_D_anchor_drift")
    if "【答案】选（D）" not in reported_key:
        raise ValueError("key_anchor_drift")
    if not re.search(r"\\frac\s*\{\s*2\s*\}\s*\{\s*3\s*\}",derivation):
        raise ValueError("worked_value_anchor_drift")
    x,y=S.symbols("x y",nonnegative=True)
    # The original Markdown question is manually formalized here; this is NOT OCR.
    evaluated=S.integrate(
        S.integrate(y/S.sqrt(1+x**3),(y,0,x)),
        (x,0,2),
    )
    if S.simplify(evaluated-S.Rational(2,3))!=0:
        raise AssertionError("independent_integral_result_changed")
    if evaluated==S.Integer(2):
        raise AssertionError("converted_option_D_matches_integral_unexpectedly")
    return {
        "status":"converted_source_conflict_not_exam_gold",
        "scope":"An exact integral calculation and a pinned third-party Markdown inconsistency, NOT verified official examination choice letters",
        "sourceMatched":True,
        "independentIntegralResult":str(evaluated),
        "convertedMarkdownOptionD":"2",
        "convertedMarkdownClaimedKey":"D",
        "convertedMarkdownWorkedResult":"2/3",
        "originalExamPdfIndependentlyChecked":False,
    }


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--source",required=True)
    parser.add_argument("--manifest",default=str(
        Path(__file__).resolve().parents[2]/
        "fixtures/research/kaoyan-math2-2022-q02-source-conflict-v0.1.json"))
    args=parser.parse_args()
    manifest=json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    markdown=Path(args.source).read_text(encoding="utf-8")
    print(json.dumps(verify(markdown,manifest),ensure_ascii=False,indent=2))


if __name__=="__main__":
    main()
