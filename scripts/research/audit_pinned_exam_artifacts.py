#!/usr/bin/env python3
"""Immutable third-party exam artifact audit; NOT official paper authentication.

Verify exact upstream Git blob bytes from a pinned commit without redistributing
the third-party paper. A located OCR/Markdown section does not prove its text is
faithful to the original exam. Typed math may be checked conditionally only.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

SCHEMA="pinned-exam-artifact-identity-v0.1"
MAX_BLOB_BYTES=16*1024*1024
MAX_ITEMS=8
SHA=re.compile(r"[0-9a-f]{40}\Z")
REPO=re.compile(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\Z")
ALLOWED={"deekur/gaokaomath","TsekaLuk/Kaoyan-Math1-Papers"}


class Unsupported(Exception):
    pass


def git_blob_sha(data):
    return hashlib.sha1(b"blob "+str(len(data)).encode("ascii")+b"\0"+data).hexdigest()


def immutable_url(source):
    repo=source["repository"]
    revision=source["revision"]
    path=source["path"]
    if (not isinstance(repo,str) or repo not in ALLOWED or not REPO.fullmatch(repo) or
        not isinstance(revision,str) or not SHA.fullmatch(revision) or
        not isinstance(path,str) or not 1<=len(path)<=384 or
        path.startswith("/") or "\\" in path or
        any(v in ("",".","..") for v in path.split("/")) or
        any(ord(v)<32 for v in path)):
        raise Unsupported("unsafe_or_unpinned_repository_path")
    return ("https://raw.githubusercontent.com/"+repo+"/"+revision+"/"+
            "/".join(quote(v,safe="") for v in path.split("/")))


def validate_source(source):
    if (not isinstance(source,dict) or set(source)!={
        "repository","revision","path","gitBlobSha","format"}):
        raise Unsupported("invalid_source_identity_schema")
    url=immutable_url(source)
    if not isinstance(source["gitBlobSha"],str) or not SHA.fullmatch(source["gitBlobSha"]):
        raise Unsupported("invalid_expected_git_blob_sha")
    fmt=source["format"]
    if fmt not in ("pdf","markdown"):
        raise Unsupported("unsupported_source_media_type")
    if not source["path"].lower().endswith(".pdf" if fmt=="pdf" else ".md"):
        raise Unsupported("source_extension_mismatch")
    return url


def download(source):
    url=validate_source(source)
    request=Request(url,headers={"User-Agent":"TutorBench-PinnedExamSourceAudit/0.1"})
    with urlopen(request,timeout=25) as response:
        if urlparse(response.geturl()).hostname!="raw.githubusercontent.com":
            raise Unsupported("source_redirect_outside_allowed_host")
        declared=response.headers.get("Content-Length")
        if declared and int(declared)>MAX_BLOB_BYTES:
            raise Unsupported("source_declared_too_large")
        data=response.read(MAX_BLOB_BYTES+1)
    if len(data)>MAX_BLOB_BYTES:
        raise Unsupported("source_download_too_large")
    return data


def locate_markdown(locator,data):
    try:
        text=data.decode("utf8",errors="strict")
    except UnicodeError as error:
        raise Unsupported("source_markdown_not_utf8") from error
    if (not isinstance(locator,dict) or
        set(locator)!={"startMarker","endMarker","requiredAnchors"}):
        raise Unsupported("invalid_section_locator")
    first,last=locator["startMarker"],locator["endMarker"]
    anchors=locator["requiredAnchors"]
    if (not isinstance(first,str) or not isinstance(last,str) or
        not 3<=len(first)<=80 or not 3<=len(last)<=80 or first==last or
        not isinstance(anchors,list) or not 1<=len(anchors)<=8 or
        any(not isinstance(x,str) or not 3<=len(x)<=150 for x in anchors)):
        raise Unsupported("invalid_locator_anchors")
    if text.count(first)!=1 or text.count(last)!=1:
        raise Unsupported("section_boundary_missing_or_ambiguous")
    begin=text.index(first)
    finish=text.index(last)
    if finish<=begin or finish-begin>24000:
        raise Unsupported("section_range_invalid_or_too_large")
    section=text[begin:finish]
    if any(section.count(x)!=1 for x in anchors):
        raise Unsupported("section_anchor_missing_or_ambiguous")
    # Never copy third-party exam text into the report or repository.
    return {"locatedInPinnedConversion":True,
            "startByte":len(text[:begin].encode("utf8")),
            "lengthBytes":len(section.encode("utf8")),
            "sectionSha256":hashlib.sha256(section.encode("utf8")).hexdigest(),
            "faithfulToOriginalExamStatement":False}


def check_item(item,fetcher=None):
    ident=item.get("id") if isinstance(item,dict) else None
    base={"id":ident if isinstance(ident,str) and re.fullmatch(r"[a-z0-9-]{1,100}",ident) else None,
          "artifactStatus":"unverified","questionLocatorStatus":"unverified",
          "sourceOfficiallyAuthenticated":False,"questionFormalizationVerified":False,
          "officialExamGoldCertified":False,"liveModelRunPerformed":False}
    try:
        if base["id"] is None:
            raise Unsupported("invalid_artifact_case_id")
        if not isinstance(item,dict) or set(item)!={
            "id","paperId","questionNumber","source","locator","scope","hypothesis"}:
            raise Unsupported("unexpected_artifact_case_fields")
        if (not isinstance(item["paperId"],str) or
            not re.fullmatch(r"[a-z0-9-]{1,100}",item["paperId"]) or
            type(item["questionNumber"]) is not int or
            not 1<=item["questionNumber"]<=50):
            raise Unsupported("invalid_paper_or_question_identity")
        if item["scope"]!="upstream_public_copy_not_official_paper":
            raise Unsupported("untrusted_official_source_claim")
        hypothesis=item["hypothesis"]
        if (hypothesis is not None and
            (not isinstance(hypothesis,dict) or
             set(hypothesis)!={"origin","typedQuestion","referenceCandidate"} or
             hypothesis["origin"]!="unverified_external_transcription_hypothesis")):
            raise Unsupported("untrusted_hypothesis_claim")
        src=item["source"]
        url=validate_source(src)
        if src["format"]=="pdf":
            if item["locator"]!={"kind":"pdf_question_not_yet_located"}:
                raise Unsupported("unsupported_pdf_question_locator")
        else:
            loc=item["locator"]
            if (not isinstance(loc,dict) or
                set(loc)!={"kind","section"} or
                loc["kind"]!="converted_markdown_section"):
                raise Unsupported("invalid_markdown_question_locator")
        base.update({"paperId":item["paperId"],"questionNumber":item["questionNumber"],
                     "sourceRepository":src["repository"],"sourceRevision":src["revision"],
                     "expectedGitBlobSha":src["gitBlobSha"],"sourceUrl":url})
        if fetcher is None:
            base["artifactStatus"]="not_fetched"
            base["reason"]="upstream_bytes_not_checked_in_offline_mode"
            return base
        raw=fetcher(src)
        if not isinstance(raw,bytes) or not raw or len(raw)>MAX_BLOB_BYTES:
            raise Unsupported("invalid_or_oversized_artifact_bytes")
        actual=git_blob_sha(raw)
        base["observedGitBlobSha"]=actual
        base["artifactSha256"]=hashlib.sha256(raw).hexdigest()
        if actual!=src["gitBlobSha"]:
            raise Unsupported("pinned_source_blob_mismatch")
        if src["format"]=="pdf":
            if not raw.startswith(b"%PDF-"):
                raise Unsupported("source_pdf_magic_mismatch")
            base["questionLocatorStatus"]="pdf_binary_only_question_not_located"
        else:
            base["locatorEvidence"]=locate_markdown(item["locator"]["section"],raw)
            base["questionLocatorStatus"]="pinned_conversion_section_located_not_authenticated"
        base["artifactStatus"]="git_blob_bytes_verified"
        if hypothesis is not None:
            # Math is intentionally downstream and CONDITIONAL on a manually
            # supplied hypothesis. It never promotes PDF->question alignment.
            import verify_dual_path_math_answers as bridge
            try:
                derived=bridge.question_math(hypothesis["typedQuestion"])
                good,normalized,_=bridge.validate_candidate(
                    hypothesis["typedQuestion"],derived,hypothesis["referenceCandidate"])
            except (bridge.Abstain,ValueError,TypeError,KeyError):
                base["hypothesisMathStatus"]="unverified"
            else:
                base["hypothesisMathStatus"]=(
                    "typed_math_candidate_matches" if good else
                    "typed_math_candidate_refuted")
                base["hypothesisExactAnswer"]=derived["exactAnswer"]
                base["hypothesisCandidateNormalized"]=normalized
            base["hypothesisSourceTextAlignment"]="not_proven"
        base["reason"]="file_bytes_only_no_official_or_question_authenticity"
        return base
    except (Unsupported,TypeError,ValueError,KeyError,OSError,TimeoutError,UnicodeError) as error:
        base["reason"]=str(error) if isinstance(error,Unsupported) else "source_unavailable_or_malformed"
        return base


def run(doc,fetcher=None):
    if (not isinstance(doc,dict) or set(doc)!={"schemaVersion","id","cases"} or
        doc["schemaVersion"]!=1 or doc["id"]!=SCHEMA or
        not isinstance(doc["cases"],list) or
        not 1<=len(doc["cases"])<=MAX_ITEMS):
        raise ValueError("invalid_pinned_source_batch")
    identities=[x.get("id") if isinstance(x,dict) else None for x in doc["cases"]]
    if any(not isinstance(x,str) for x in identities) or len(identities)!=len(set(identities)):
        raise ValueError("duplicate_or_missing_source_case_identity")
    items=[check_item(x,fetcher) for x in doc["cases"]]
    return {"status":"verified_git_object_identity_only_not_official_paper_gold",
            "summary":{
                "total":len(items),
                "byteVerified":sum(x["artifactStatus"]=="git_blob_bytes_verified" for x in items),
                "convertedQuestionSectionLocated":sum(
                    x["questionLocatorStatus"]=="pinned_conversion_section_located_not_authenticated"
                    for x in items),
                "pdfQuestionsFaithfullyVerified":0,
                "sourcePaperOfficiallyAuthenticated":0,
                "typedModelsAlignedWithSourceText":0,
                "mathematicallyMatchedHypothesesOnly":sum(
                    x.get("hypothesisMathStatus")=="typed_math_candidate_matches" for x in items),
                "officialExamGoldReleased":0,
                "realModelRuns":0,
                "measuredLiveExamAccuracy":None},
            "items":items}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--manifest",required=True)
    parser.add_argument("--fetch-upstream",action="store_true")
    parser.add_argument("--require-byte-verification",action="store_true")
    args=parser.parse_args()
    doc=json.loads(Path(args.manifest).read_text(encoding="utf8"))
    out=run(doc,download if args.fetch_upstream else None)
    print(json.dumps(out,ensure_ascii=False,indent=2))
    return int(bool(args.require_byte_verification and
                    out["summary"]["byteVerified"]!=out["summary"]["total"]))


if __name__=="__main__":
    sys.exit(main())
