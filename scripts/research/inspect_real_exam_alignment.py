"""Inspect frozen, author-proposed mappings; optionally replay the private source bindings."""
import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "fixtures/research/real-exam-alignment-v1.json"
EDITION = "scenarios/case-system-vnext/exam-specifications/requirements-1.1.0.json"
FROZEN = "aeb8f62cb9b2b1601e565eec79aad4631df28591a1ad87e35d9af50e90681939"


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def digest(obj):
    return sha256(json.dumps(obj, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def inventory():
    output = subprocess.check_output(["node", "dist/src/cli/exam-specifications.js", "--requirements", EDITION], cwd=ROOT)
    return json.loads(output)


def project_regions(regions):
    return [{key: r[key] for key in ("page", "bboxPt", "sha256", "path")} for r in regions]


def source_bindings(item, verifier):
    source, answer = item["source"], item["answer"]
    return (
        dict(questionSha256=verifier.digest(verifier.question_input(item)), pdfSha256=source["sha256"],
             pages=source["pages"], regions=project_regions(item["displayRegions"]), transcription=item["transcriptionStatus"]),
        dict(recordSha256=verifier.digest(answer), pdfSha256=answer["sourceSha256"], locator=answer["locator"],
             regions=project_regions(answer["displayRegions"]), pairing=answer["pairing"], status=answer["status"]),
    )


def verdict(result):
    coverage = result["verificationCoverage"]
    require(coverage["wholeAnswerVerified"] == (result["status"] == "verified"), "inconsistent whole-answer evidence")
    require(not result["formalScoringEligible"] and not coverage["completeProofVerified"], "unexpected promotion")
    return dict(method=result["method"], whole=result["status"], scope=coverage["scope"],
                claims=coverage["referenceClaimsChecked"], reason=result["reason"])


def check_links(links, registry):
    ids = [link["id"] for link in links]
    require(len(ids) == len(set(ids)) and set(ids) <= registry, "duplicate or unknown mapping")
    require(all(link["rationale"].strip() for link in links), "missing mapping rationale")


def inspect(doc, edition):
    rows = doc["items"]
    require(doc["inventoryVersion"] == edition["version"] == "1.1.0", "wrong inventory")
    require(doc["independentReviews"] == 0 and doc["learnerOutcomes"] is None and
            doc["status"] == "author-proposed", "unexpected review or outcome")
    require(digest(edition) == doc["inventorySha256"], "inventory contents changed")
    reqs = {r["requirement_id"] for r in edition["requirements"] if r["source_edition"] == "cn-moe-high-school-math@2020.1"}
    nodes = {n["id"] for n in edition["knowledgeGraph"]["nodes"]}
    require(len(rows) == len({r["questionId"] for r in rows}) == 9, "sample identity or denominator changed")
    for r in rows:
        check_links(r["requirements"], reqs)
        check_links(r["nodes"], nodes)
        require(all(link["role"] in ("primary", "supporting") for link in r["requirements"]), "unknown clause role")
        require(r["source"]["regions"] and r["answer"]["regions"] and r["answer"]["pairing"] == "matched"
                and r["answer"]["status"] == "user_supplied_assumed_correct", "missing source or answer evidence")
        v = r["verifier"]
        require(v["whole"] != "verified" or (v["method"] and v["scope"] == "whole-answer"
                and v["claims"] == 1 and v["reason"] == "exact_paths_agree"), "unsupported whole answer")
    require(digest(doc) == FROZEN, "frozen sample digest changed")
    def used(field):
        return sorted({link["id"] for r in rows for link in r[field]})

    primary = sum(any(l["role"] == "primary" for l in r["requirements"]) for r in rows)
    gaps = Counter(k for r in rows for k in {g["kind"] for g in r["gaps"]})
    return dict(selected=len(rows), familyCounts=Counter(r["family"] for r in rows),
                itemsWithConcepts=sum(bool(r["nodes"]) for r in rows), itemsWithPrimaryClause=primary,
                itemsWithAnyClause=sum(bool(r["requirements"]) for r in rows),
                clauses=used("requirements"), nodes=used("nodes"), itemsByGap=gaps,
                wholeAnswers=Counter(r["verifier"]["whole"] for r in rows),
                subclaimOnly=sum(r["verifier"]["reason"] == "partial_claim_only" for r in rows),
                privateEvidenceReplayed=False, independentReviews=0, learnerOutcomes=None)


def replay(doc, bank_path, private):
    # 仅在私有复核模式加载题库与原有校验器；公开复核不需要安装 PDF/符号计算依赖。
    import exam_correctness as verifier

    root = bank_path.resolve().parent
    bank = verifier.read_json(bank_path)
    plan = verifier.read_json(private / "plan.json")
    require(verifier.VERSION == doc["verifierVersion"] and digest(plan) == doc["planSha256"], "wrong verifier or plan")
    derivations = verifier.read_json(private / "derivations.json")
    for row in doc["items"]:
        ident = row["questionId"]
        item = verifier.checked_handoff(bank, ident)["item"]
        identity = {key: item[key] for key in ("exam", "session", "year", "subject", "edition", "paperId")}
        require(dict(identity, printedNumber=item["source"]["numberAsPrinted"]) == row["identity"], "paper identity drift")
        require(source_bindings(item, verifier) == (row["source"], row["answer"]), "source or answer binding drift")
        require(digest(derivations[ident]) == row["derivationSha256"], "derivation changed")
        # 同一 PDF 内的答案页也必须单独绑定。未支持题型也要核验 PDF 和截图字节。
        for data, regions in [(item["source"], item["displayRegions"]), (item["answer"], item["answer"]["displayRegions"])]:
            pdf_sha = data.get("sha256") or data["sourceSha256"]
            verifier.artifact(root, data["localPath"], pdf_sha, ".pdf")
            verifier.crops(root, regions, pdf_sha)
        if item["answer"]["solutionRegions"]:
            verifier.crops(root, item["answer"]["solutionRegions"], row["answer"]["pdfSha256"])
    blind, records = verifier.derive_batch(bank, root, plan)
    refs = verifier.read_json(private / "refs.json")
    require(digest(refs) == doc["referenceBindingsSha256"], "reference sidecar changed")
    fresh = verifier.run_review(bank, root, plan, blind, records, refs, {}, {})
    expected = {r["questionId"]: r["verifier"] for r in doc["items"]}
    require({r["questionId"]: verdict(r) for r in fresh["results"]} == expected, "verifier evidence drift")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bank", type=Path)
    parser.add_argument("--private", type=Path, help="private directory containing plan, references and derivations")
    args = parser.parse_args()
    if bool(args.bank) != bool(args.private):
        parser.error("--bank and --private must be supplied together")
    doc = json.loads(MANIFEST.read_text("utf8"))
    report = inspect(doc, inventory())
    if args.bank:
        replay(doc, args.bank, args.private)
        report["privateEvidenceReplayed"] = True
    print(json.dumps(report, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
