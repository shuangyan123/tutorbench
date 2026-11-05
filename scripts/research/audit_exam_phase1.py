#!/usr/bin/env python3
"""Audit phase-1 source evidence without releasing question text or answers."""
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit

from audit_pinned_exam_artifacts import MAX_BLOB_BYTES, git_blob_sha

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures/research"
YEARS = range(2022, 2027)
SUBJECTS = {"数学", "物理", "化学", "生物"}
ISSUER_HOSTS = {"南京理工大学": "gs.njust.edu.cn"}
SHA256 = re.compile(r"[a-f0-9]{64}")
SOURCE_PIN = {
    "repository": "qingshuo/China-Gaokao-Papers-Collection",
    "revision": "b33ea3dd5427afa963a944808d3a6c0183fc454e",
    "path": "data/exams.csv",
    "gitBlobSha": "38d188f067065c597ad1e3903dd4130b10d653e2",
}


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def load(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf8"))


def read_bounded(path):
    with path.open("rb") as handle:
        data = handle.read(MAX_BLOB_BYTES + 1)
    require(0 < len(data) <= MAX_BLOB_BYTES, "invalid artifact size")
    return data


def candidate_counts(rows):
    return {
        "candidates": len(rows),
        "withSha256": sum(bool(row["sha256"]) for row in rows),
        "upstreamDeclaredStatus": {key: sum(row["status"] == key for row in rows)
                                   for key in ("discovered", "indexed", "verified")},
        "upstreamLicenseStatus": {key: sum(row["license_status"] == key for row in rows)
                                  for key in ("unknown", "permitted", "restricted")},
    }


def source_rows(raw, pin):
    require(git_blob_sha(raw) == pin, "candidate CSV Git blob mismatch")
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig"), newline=""), strict=True)
    fields = {"record_id", "year", "region", "paper_type", "subject", "title", "source_url",
              "license_status", "status", "sha256", "material_type"}
    require(reader.fieldnames and fields <= set(reader.fieldnames)
            and len(set(reader.fieldnames)) == len(reader.fieldnames), "invalid CSV header")
    rows = []
    for row in reader:
        require(None not in row and None not in row.values(), "malformed CSV row")
        if (row["year"] not in map(str, YEARS) or row["subject"] not in SUBJECTS
                or row["material_type"] != "完整试卷"):
            continue
        require(row["record_id"] and row["title"] and row["source_url"], "missing candidate identity")
        require(not row["sha256"] or SHA256.fullmatch(row["sha256"]), "malformed candidate SHA-256")
        require(row["status"] in {"discovered", "indexed", "verified"} and
                row["license_status"] in {"unknown", "permitted", "restricted"},
                "unknown upstream status")
        rows.append(row)
    require(len({row["record_id"] for row in rows}) == len(rows), "duplicate candidate record")
    return rows


def exact_deekur_path(url):
    parsed = urlsplit(url)
    prefix = "/deekur/gaokaomath/main/"
    if (parsed.scheme == "https" and parsed.netloc == "raw.githubusercontent.com"
            and parsed.path.startswith(prefix) and not parsed.query and not parsed.fragment):
        return unquote(parsed.path[len(prefix):], errors="strict")
    return None


def reconcile(raw, snapshot, crosswalk, catalog):
    require({key: snapshot["source"][key] for key in SOURCE_PIN} == crosswalk["source"] == SOURCE_PIN,
            "source pin drift")
    rows = source_rows(raw, SOURCE_PIN["gitBlobSha"])
    require(candidate_counts(rows) == snapshot["upstreamStats"], "overall candidate counts differ")
    require(set(snapshot["subjects"]) == SUBJECTS, "subject denominator differs")
    for subject in SUBJECTS:
        selected = [row for row in rows if row["subject"] == subject]
        by_year = {str(year): candidate_counts([r for r in selected if r["year"] == str(year)])
                   for year in YEARS}
        require({**candidate_counts(selected), "byYear": by_year} == snapshot["subjects"][subject],
                "subject/year counts differ")

    gaokao = [p for p in catalog if p["exam"] == "gaokao"]
    by_path = {p["source"]["path"]: p for p in gaokao if p["source"]["repository"] == "deekur/gaokaomath"}
    require(len(by_path) == len(gaokao) == crosswalk["existingTutorBench"]["mathGaokaoEditions"],
            "missing or ambiguous catalog source paths")
    groups = defaultdict(set)
    matched, unresolved = {}, {}
    for row in rows:
        groups["|".join(row[key] for key in ("year", "subject", "paper_type", "region"))].add(row["record_id"])
        if row["subject"] == "数学":
            path = exact_deekur_path(row["source_url"])
            paper = by_path.get(path)
            if paper:
                require(row["year"] == str(paper["year"]), "path match disagrees with exam year")
                matched[row["record_id"]] = (paper["paperId"], path)
            else:
                unresolved[row["record_id"]] = (int(row["year"]), row["title"])
    frozen_matches = {r["upstreamRecordId"]: (r["tutorBenchPaperId"], r["upstreamSourcePath"])
                      for r in crosswalk["mathExactSourcePathMatches"]}
    frozen_unresolved = {r["upstreamRecordId"]: (r["year"], r["title"])
                         for r in crosswalk["mathUnresolved"]}
    frozen_groups = {r["coarseIdentity"]: set(r["recordIds"]) for r in crosswalk["coarseIdentityCollisions"]}
    collisions = {key: ids for key, ids in groups.items() if len(ids) > 1}
    require(matched == frozen_matches and len(matched) == len(crosswalk["mathExactSourcePathMatches"]),
            "exact path matches differ")
    require(unresolved == frozen_unresolved and len(unresolved) == len(crosswalk["mathUnresolved"]),
            "unmatched math records differ")
    require(collisions == frozen_groups and len(collisions) == len(crosswalk["coarseIdentityCollisions"]),
            "coarse collisions differ")
    hashes = Counter(row["sha256"] for row in rows if row["sha256"])
    summary = {
        "candidateRows": len(rows),
        "rowsWithSha256": sum(hashes.values()),
        "identicalSha256AcrossCandidateRecords": sum(n - 1 for n in hashes.values()),
        "coarseIdentityCollisionGroups": len(collisions),
        "mathCandidateRows": len(matched) + len(unresolved),
        "mathExactSourcePathMatches": len(matched),
        "mathUnresolvedRows": len(unresolved),
    }
    require(summary == crosswalk["sample"], "candidate summary differs")
    return summary, {row["record_id"]: row for row in rows}


def audit_math_files(evidence, rows, crosswalk, catalog, pdf_dir=None):
    """Recheck the collected catalog and mirror bytes without merging editions by name."""
    require(set(evidence) == {"catalogPdfSha256", "equalMirrorPaperIds"}, "invalid math file ledger")
    digests = evidence["catalogPdfSha256"]
    mirrors = evidence["equalMirrorPaperIds"]
    matches = {r["tutorBenchPaperId"]: r["upstreamRecordId"]
               for r in crosswalk["mathExactSourcePathMatches"]}
    papers = {p["paperId"]: p for p in catalog if p["exam"] == "gaokao"}
    require(set(digests) == set(papers) and all(SHA256.fullmatch(sha) for sha in digests.values()),
            "catalog PDF digest coverage differs")
    require(len(set(digests.values())) == len(papers), "one PDF digest assigned to multiple editions")
    require(len(matches) == len(crosswalk["mathExactSourcePathMatches"])
            and len(mirrors) == len(set(mirrors)) and set(mirrors) <= set(matches),
            "mirror evidence must refer to distinct exact path matches")
    rechecked_catalog = rechecked_mirrors = 0
    for paper_id, expected in digests.items():
        require(re.fullmatch(r"gaokao-[a-z0-9-]+", paper_id), "unsafe math paper ID")
        if paper_id in matches:
            require(expected == rows[matches[paper_id]]["sha256"],
                    "recorded path-match SHA-256 differs from pinned CSV")
        if pdf_dir is not None and (path := pdf_dir / f"{paper_id}.pdf").is_file():
            raw = read_bounded(path)
            require(raw.startswith(b"%PDF-") and git_blob_sha(raw) == papers[paper_id]["source"]["gitBlobSha"],
                    "catalog PDF signature or Git blob mismatch")
            require(hashlib.sha256(raw).hexdigest() == expected, "catalog PDF SHA-256 mismatch")
            rechecked_catalog += 1
        if pdf_dir is not None and (mirror := pdf_dir / "mirrors" / f"{paper_id}.pdf").is_file():
            require(paper_id in mirrors and hashlib.sha256(read_bounded(mirror)).hexdigest() == expected,
                    "pinned mirror SHA-256 mismatch")
            rechecked_mirrors += 1
    by_digest = {sha: paper_id for paper_id, sha in digests.items()}
    digest_only = {r["upstreamRecordId"]: by_digest[rows[r["upstreamRecordId"]]["sha256"]]
                   for r in crosswalk["mathUnresolved"]
                   if rows[r["upstreamRecordId"]]["sha256"] in by_digest}
    return {"catalogPdfsWithObservedSha256": len(digests), "catalogPdfsRechecked": rechecked_catalog,
            "pathMatchesToCsvSha256": len(matches), "equalMirrorsRecorded": len(mirrors),
            "mirrorsRechecked": rechecked_mirrors, "digestOnlyCandidateMatches": digest_only}


def valid_https(url):
    parsed = urlsplit(url or "")
    return parsed.scheme == "https" and bool(parsed.hostname) and parsed.netloc == parsed.hostname


def check_pdf(path, source):
    """Check the saved bytes and page structure with Poppler, not source semantics."""
    data = read_bounded(path)
    require(data.startswith(b"%PDF-") and data.rstrip().endswith(b"%%EOF"), "invalid PDF signature")
    require(hashlib.sha256(data).hexdigest() == source["sha256"], "PDF SHA-256 mismatch")
    if "gitBlobSha" in source:
        require(git_blob_sha(data) == source["gitBlobSha"], "PDF Git blob mismatch")
    result = subprocess.run(["pdfinfo", "-"], input=data, capture_output=True, timeout=20, check=True)
    require(not result.stderr, "PDF structure warning")
    match = re.search(rb"^Pages:\s+(\d+)\s*$", result.stdout, re.MULTILINE)
    require(match and int(match[1]) == source["pages"], "PDF page count mismatch")


def audit_witnesses(ledger, catalog, pdf_dir=None):
    require(set(ledger) == {"schemaVersion", "openScope", "mathFiles", "papers"} and ledger["schemaVersion"] == 1,
            "invalid phase-1 ledger")
    open_scope = ledger["openScope"]
    require(set(open_scope) == {"gaokaoScience", "postgraduateScience"} and
            all(isinstance(reason, str) and reason.strip() for reason in open_scope.values()),
            "unbounded science target scope must be explicit")
    catalog_by_id = {p["paperId"]: p for p in catalog}
    require(len(catalog_by_id) == len(catalog), "duplicate catalog edition")
    seen_ids, identities, hashes = set(), set(), set()
    results = {}
    for paper in ledger["papers"]:
        require(set(paper) == {"paperId", "identity", "source", "inventory"}, "unexpected paper fields")
        paper_id = paper["paperId"]
        identity = paper["identity"]
        source = paper["source"]
        require(re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", paper_id) and paper_id not in seen_ids,
                "invalid or duplicate witness paper ID")
        seen_ids.add(paper_id)
        require(set(identity) == {"exam", "year", "subject", "issuer", "courseCode", "courseName",
                                  "variant", "difficulty"} and type(identity["year"]) is int and
                identity["year"] in YEARS and identity["subject"] in SUBJECTS and
                all(isinstance(identity[key], str) and identity[key].strip() and
                    identity[key] == identity[key].strip()
                    for key in ("issuer", "variant", "courseName")), "invalid edition identity")
        require(identity["difficulty"] == "unrated", "difficulty requires a separate evidence protocol")
        course = identity["courseCode"]
        key = (identity["exam"], identity["year"], identity["subject"], identity["issuer"].casefold(),
               course, identity["variant"].casefold())
        require(key not in identities, "duplicate edition identity")
        identities.add(key)
        require(set(source) <= {"kind", "listing", "artifact", "rights", "sha256", "pages", "gitBlobSha"}
                and valid_https(source["listing"]) and valid_https(source["artifact"])
                and source["rights"] in {"unknown_metadata_only", "restricted_metadata_only"}
                and SHA256.fullmatch(source["sha256"]) and type(source["pages"]) is int
                and 1 <= source["pages"] <= 100, "invalid provenance, rights or PDF evidence")
        require(source["sha256"] not in hashes, "same whole-paper bytes assigned to distinct editions")
        hashes.add(source["sha256"])
        if identity["exam"] == "gaokao":
            known = catalog_by_id.get(paper_id)
            require(known and known["exam"] == "gaokao" and known["year"] == identity["year"] and
                    identity["subject"] == "数学" and course is None and
                    identity["variant"] == paper_id.removeprefix(f"gaokao-{identity['year']}-") and
                    source["kind"] == "pinned_third_party" and source["artifact"] == known["source"]["url"] and
                    source.get("gitBlobSha") == known["source"]["gitBlobSha"], "Gaokao catalog witness mismatch")
            edition_confirmed = False
        else:
            issuer_host = ISSUER_HOSTS.get(identity["issuer"])
            require(issuer_host and identity["exam"] == "postgraduate_self_set" and identity["subject"] != "数学" and
                    isinstance(course, str) and re.fullmatch(r"\d{3}", course) and
                    source["kind"] == "issuer_past_paper_attachment" and
                    "gitBlobSha" not in source and source["listing"] != source["artifact"] and
                    urlsplit(source["listing"]).hostname == urlsplit(source["artifact"]).hostname == issuer_host,
                    "self-set edition lacks an issuer past-paper listing or subject code")
            edition_confirmed = True

        inventory = paper["inventory"]
        require(set(inventory) == {"sections", "questions"}, "unexpected inventory fields")
        expected = set()
        for section, bounds in inventory["sections"].items():
            require(re.fullmatch(r"[A-Z]", section) and isinstance(bounds, list) and
                    len(bounds) == 2 and all(type(n) is int for n in bounds) and
                    1 <= bounds[0] <= bounds[1] <= 100, "invalid inventory section denominator")
            expected.update(f"{section}.{number}" for number in range(bounds[0], bounds[1] + 1))
        require(expected, "empty inventory denominator")
        located = set()
        for item in inventory["questions"]:
            require(set(item) == {"id", "pages", "stemPage", "figures", "notation", "numberedParts", "options"}, "unexpected question fields")
            ident = item["id"]
            pages = item["pages"]
            require(ident in expected and ident not in located, "duplicate or unexpected question ID")
            require(isinstance(pages, list) and pages and all(type(n) is int and 1 <= n <= source["pages"]
                    for n in pages) and pages == list(range(pages[0], pages[-1] + 1)) and
                    type(item["stemPage"]) is int and item["stemPage"] in pages,
                    "missing or invalid question page locator")
            require(isinstance(item["figures"], list) and
                    all(set(f) == {"id", "page"} and re.fullmatch(r"(?:figure|table|diagram)-\d+", f["id"])
                        and type(f["page"]) is int and f["page"] in pages for f in item["figures"]) and
                    len({(f["id"], f["page"]) for f in item["figures"]}) == len(item["figures"]) and
                    all(type(item[k]) is int and 0 <= item[k] <= 30 for k in ("numberedParts", "options")) and
                    item["notation"] in {"seen", "not_seen", "unreviewed"},
                    "invalid figure or formula observation")
            located.add(ident)
        missing = sorted(expected - located)
        verified_bytes = False
        if pdf_dir is not None and (path := pdf_dir / f"{paper_id}.pdf").is_file():
            check_pdf(path, source)
            verified_bytes = True
        results[paper_id] = {
            "G0": "issuer_listing_and_cover" if edition_confirmed else "third_party_identity_unverified",
            "G1": "rights_unverified_or_restricted",
            "G2": "bytes_and_pages_rechecked" if verified_bytes else "recorded_sha_not_rechecked",
            # Page and notation locators do not attest to a separate faithful transcription.
            "G3": "original_to_candidate_comparison_unverified",
            "G4": "incomplete_inventory" if missing else "witness_inventory_complete",
            "witnessQuestions": len(expected),
            "locatedQuestions": len(located),
            "missingQuestionIds": missing,
            "sourceQualifiedQuestions": 0,
            "fidelityUnverifiedQuestions": len(expected),
        }
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, required=True, help="local copy of the pinned source CSV")
    parser.add_argument("--pdf-dir", type=Path,
                        help="local catalog and witness PDFs by paper ID, with mirrors in mirrors/")
    parser.add_argument("--require-byte-recheck", action="store_true",
                        help="require all catalog PDFs, recorded mirrors and visual witnesses")
    parser.add_argument("--require-complete", action="store_true",
                        help="require the full Phase 1 acceptance gate; currently blocked")
    args = parser.parse_args()
    try:
        catalog = load("exam-source-expansion-2022-2026-v0.1.json")["papers"]
        snapshot = load("exam-science-upstream-intake-snapshot-2022-2026-v0.1.json")
        crosswalk = load("exam-science-source-reconciliation-2022-2026-v0.1.json")
        ledger = load("exam-phase1-witnesses-2022-2026-v0.1.json")
        counts, rows = reconcile(read_bounded(args.csv), snapshot, crosswalk, catalog)
        math_bytes = audit_math_files(ledger["mathFiles"], rows, crosswalk, catalog, args.pdf_dir)
        witnesses = audit_witnesses(ledger, catalog, args.pdf_dir)
        for paper in ledger["papers"]:
            if paper["identity"]["exam"] == "gaokao":
                require(paper["source"]["sha256"] == ledger["mathFiles"]["catalogPdfSha256"][paper["paperId"]],
                        "Gaokao witness SHA-256 differs from catalog observation")
        prior = load("kaoyan-math1-2025-all-questions-review-v0.1.json")
        reviewed = prior["paper"]["expectedQuestions"]
        require({x["question"] for x in prior["items"]} == set(range(1, reviewed + 1)) and
                len(prior["items"]) == reviewed and all(x["pdfPages"] and not x["verifiedAsOfficialKey"]
                for x in prior["items"]), "historical Math I inventory drift")
    except (ValueError, OSError, KeyError, TypeError, csv.Error, subprocess.SubprocessError) as error:
        print(f"phase-1 evidence rejected: {error}", file=sys.stderr)
        return 1
    print(json.dumps({
        "status": "phase_1_blocked",
        "candidateAudit": counts,
        "mathPathByteAudit": math_bytes,
        "mathCatalogEditions": len(catalog),
        "openScope": ledger["openScope"],
        "historicalMath1WitnessQuestions": reviewed,
        "witnesses": witnesses,
        "phaseQuestionDenominator": None,
        "sourceQualifiedQuestions": 0,
    }, indent=2))
    missing_bytes = (
        math_bytes["catalogPdfsRechecked"] != math_bytes["catalogPdfsWithObservedSha256"]
        or math_bytes["mirrorsRechecked"] != math_bytes["equalMirrorsRecorded"]
        or any(x["G2"] != "bytes_and_pages_rechecked" for x in witnesses.values())
    )
    return int(args.require_complete or (args.require_byte_recheck and missing_bytes))


if __name__ == "__main__":
    sys.exit(main())
