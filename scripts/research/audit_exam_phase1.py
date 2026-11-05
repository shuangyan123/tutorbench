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
from tempfile import TemporaryDirectory
from urllib.parse import unquote, urlsplit

from audit_pinned_exam_artifacts import MAX_BLOB_BYTES, git_blob_sha
from exam_phase1_evidence import (
    PAPER_ID, SHA256, accepted_scope, comparison_result, exact_attachment,
    inventory_result, observed_cover, page_index, require, reviewed, valid_https,
)

from replay_exam_phase1_sources import replay_sources, witness_transport

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures/research"
YEARS = range(2022, 2027)
SUBJECTS = {"数学", "物理", "化学", "生物"}
ISSUER_HOSTS = {"南京理工大学": "gs.njust.edu.cn"}
SOURCE_PIN = {
    "repository": "qingshuo/China-Gaokao-Papers-Collection",
    "revision": "b33ea3dd5427afa963a944808d3a6c0183fc454e",
    "path": "data/exams.csv",
    "gitBlobSha": "38d188f067065c597ad1e3903dd4130b10d653e2",
}


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


def audit_math_files(evidence, rows, crosswalk, catalog, pdf_dir=None, transport=None):
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
    files = {}
    transport = transport or {}
    for paper_id, expected in digests.items():
        require(re.fullmatch(r"gaokao-[a-z0-9-]+", paper_id), "unsafe math paper ID")
        if paper_id in matches:
            require(expected == rows[matches[paper_id]]["sha256"],
                    "recorded path-match SHA-256 differs from pinned CSV")
        catalog_file = f"{paper_id}.pdf"
        candidates = [(catalog_file, papers[paper_id]["source"]["gitBlobSha"])]
        if paper_id in mirrors:
            candidates.append((f"mirrors/{catalog_file}", None))
        for name, git_sha in candidates:
            state = "unavailable" if transport.get(name, {}).get("status") == "unavailable" else "metadata_only"
            if pdf_dir is not None and (path := pdf_dir / name).is_file():
                try:
                    raw = read_bounded(path)
                    require(raw.startswith(b"%PDF-") and hashlib.sha256(raw).hexdigest() == expected,
                            "PDF signature or SHA-256 mismatch")
                    if git_sha:
                        require(git_blob_sha(raw) == git_sha, "catalog PDF Git blob mismatch")
                    state = "verified"
                except (ValueError, OSError):
                    state = "conflict"
            files[name] = state
    rechecked_catalog = sum(files[f"{ident}.pdf"] == "verified" for ident in digests)
    rechecked_mirrors = sum(files[f"mirrors/{ident}.pdf"] == "verified" for ident in mirrors)
    by_digest = {sha: paper_id for paper_id, sha in digests.items()}
    digest_only = {r["upstreamRecordId"]: by_digest[rows[r["upstreamRecordId"]]["sha256"]]
                   for r in crosswalk["mathUnresolved"]
                   if rows[r["upstreamRecordId"]]["sha256"] in by_digest}
    return {"catalogPdfsWithObservedSha256": len(digests), "catalogPdfsRechecked": rechecked_catalog,
            "pathMatchesToCsvSha256": len(matches), "equalMirrorsRecorded": len(mirrors),
            "mirrorsRechecked": rechecked_mirrors, "digestOnlyCandidateMatches": digest_only, "files": files}


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


def local_digest(pdf_dir, relative):
    if pdf_dir is None or not (path := pdf_dir / relative).is_file():
        return None
    return hashlib.sha256(read_bounded(path)).hexdigest()


def reviewed_proof(pdf_dir, relative, expected):
    observed = local_digest(pdf_dir, relative)
    if observed is None:
        return "unavailable"
    return "confirmed" if observed == expected else "conflict"


def audit_paper(paper, evidence, pdf_dir, access):
    paper_id = paper["paperId"]
    source, identity = paper["source"], paper["identity"]
    artifact_sha = source["sha256"]
    require(evidence is None or set(evidence) == {"artifactSha256", "issuerListing", "cover", "pages",
            "pageReview", "editionResolution", "officialOriginal", "researchRights", "comparisons", "difficultyReview"},
            "unexpected source evidence fields")
    evidence = evidence or {}
    issues = []
    bound = evidence.get("artifactSha256") == artifact_sha
    if evidence and not bound:
        issues.append("review_artifact_sha_conflict")

    g2 = "unavailable" if access.get("pdf") == "unavailable" else "unverified"
    path = None
    if pdf_dir is not None:
        path = pdf_dir / f"{paper_id}.pdf"
        if (separate := pdf_dir / "witnesses" / f"{paper_id}.pdf").is_file():
            path = separate
    if path is not None and path.is_file():
        try:
            check_pdf(path, source)
            g2 = "passed"
        except (ValueError, OSError, subprocess.SubprocessError):
            issues.append("pdf_integrity_conflict")
            g2 = "conflict"

    issuer = evidence.get("issuerListing")
    issuer_host = ISSUER_HOSTS.get(identity["issuer"])
    issuer_trusted = bool(source["kind"] == "issuer_past_paper_attachment" and issuer and
        set(issuer) == {"url", "sha256", "review"} and issuer["url"] == source["listing"] and
        issuer_host == urlsplit(source["listing"]).hostname == urlsplit(source["artifact"]).hostname
        and SHA256.fullmatch(issuer["sha256"]) and reviewed(issuer["review"]))
    attachment = "unavailable" if access.get("listing") == "unavailable" else "unverified"
    listing_sha = None
    if issuer_trusted and pdf_dir is not None and (listing := pdf_dir / f"{paper_id}.html").is_file():
        try:
            html = read_bounded(listing)
            listing_sha = hashlib.sha256(html).hexdigest()
            # 离线 HTML 必须对应已审阅的快照，联网回放按当次官方页面的实际链接判断。
            linked = (access.get("listing") == "reachable" or listing_sha == issuer["sha256"]) and exact_attachment(
                html, source["listing"], source["artifact"])
            attachment = "linked" if linked else "conflict"
        except (ValueError, OSError):
            attachment = "conflict"
        if attachment == "conflict":
            issues.append("listing_does_not_bind_exact_attachment")

    cover = evidence.get("cover")
    cover_status = "unverified"
    if cover is not None and bound and reviewed(evidence.get("pageReview")):
        if not observed_cover(cover, identity):
            issues.append("cover_identity_conflict")
            cover_status = "conflict"
        elif g2 == "passed":
            cover_status = "matches"
        else:
            cover_status = "recorded_match_not_replayed"

    resolution = evidence.get("editionResolution")
    resolved = bool(resolution and set(resolution) == {"decision", "review"}
                    and resolution["decision"] in {"unique", "alternate_versions_resolved"}
                    and reviewed(resolution["review"]))
    g0 = ("conflict" if issues else "passed" if resolved and issuer_trusted and attachment == "linked"
          and cover_status == "matches" else "unverified")
    original = evidence.get("officialOriginal")
    official = "unverified"
    if original is not None:
        require(set(original) == {"url", "sha256", "review"} and valid_https(original["url"])
                and urlsplit(original["url"]).hostname == issuer_host
                and original["url"] not in (source["artifact"], source["listing"])
                and SHA256.fullmatch(original["sha256"]) and reviewed(original["review"]),
                "invalid official-original evidence")
        if g0 == "passed":
            official = reviewed_proof(pdf_dir, f"proofs/{paper_id}.original", original["sha256"])
    rights = evidence.get("researchRights")
    research = "unverified"
    if rights is not None:
        require(set(rights) == {"decision", "basis", "sha256", "review"}
                and rights["decision"] == "allowed_for_internal_research" and valid_https(rights["basis"])
                and SHA256.fullmatch(rights["sha256"]) and reviewed(rights["review"]),
                "invalid research rights evidence")
        research = reviewed_proof(pdf_dir, f"proofs/{paper_id}.rights", rights["sha256"])
    g1 = ("conflict" if "conflict" in (official, research) else
          "passed" if official == research == "confirmed" else "unverified")

    expected = None
    if bound and evidence.get("pages") is not None and reviewed(evidence.get("pageReview")):
        expected = page_index(evidence["pages"], source["pages"])
    difficulty_review = evidence.get("difficultyReview")
    rated = identity["difficulty"] != "unrated"
    if rated:
        bands = {"foundational", "integrative", "extended"}
        require(identity["exam"] == "postgraduate_self_set" and identity["difficulty"] in bands
                and difficulty_review and set(difficulty_review) == {"protocol", "basis", "questionBands", "review"}
                and difficulty_review["protocol"] == "within-subject-demand-v1"
                and isinstance(difficulty_review["basis"], str) and difficulty_review["basis"].strip()
                and reviewed(difficulty_review["review"]), "difficulty classification lacks reviewed evidence")
        question_bands = difficulty_review["questionBands"]
        require(expected and set(question_bands) == set(expected) and set(question_bands.values()) <= bands
                and 2 * sum(x == identity["difficulty"] for x in question_bands.values()) > len(expected),
                "difficulty classification lacks a full reviewed majority")
    inventory, located, locator_conflicts, missing = inventory_result(paper["inventory"], expected, source["pages"])
    g4 = "unverified" if inventory == "passed" and g2 != "passed" else inventory
    compared, matched, comparison_conflicts, comparison_missing = comparison_result(
        evidence.get("comparisons") if g2 == "passed" else None, located, artifact_sha,
        lambda qid: local_digest(pdf_dir, f"comparisons/{paper_id}/{qid}.json"),
    )
    g3 = ("conflict" if comparison_conflicts else "passed" if expected is not None and g2 == "passed"
          and len(matched) == len(expected) else "unverified")
    qualified = len(matched) if g0 == g1 == g2 == "passed" and not comparison_conflicts and not locator_conflicts else 0

    return {
        "G0": g0, "G1": g1, "G2": g2, "G3": g3, "G4": g4,
        "listingUrlAccess": access.get("listing", "not_requested"),
        "pdfUrlAccess": access.get("pdf", "not_requested"),
        "issuerIdentity": "reviewed_publisher" if issuer_trusted else "unverified",
        "attachmentLink": attachment,
        "observedListingSha256": listing_sha,
        "coverIdentity": cover_status,
        "attachmentIdentity": "matches" if attachment == "linked" and cover_status == "matches" else "unverified",
        "editionResolution": "reviewed" if resolved else "unverified",
        "difficultyEvidence": "reviewed" if rated else "unrated",
        "officialOriginal": official,
        "internalResearchRights": research,
        "redistributionRights": source["rights"],
        "inventoryAgainstPageReview": inventory,
        "expectedQuestions": None if expected is None else len(expected),
        "recordedLocators": len(paper["inventory"]["questions"]),
        "locatedQuestions": len(located),
        "sourceComparedQuestions": len(compared),
        "sourceQualifiedQuestions": qualified,
        "missingQuestionIds": missing,
        "locatorConflicts": locator_conflicts,
        "comparisonConflicts": comparison_conflicts,
        "missingComparisonArtifacts": comparison_missing,
        "evidenceConflicts": issues,
    }


def audit_witnesses(ledger, catalog, pdf_dir=None, *, reviews=None, access=None):
    require(set(ledger) == {"schemaVersion", "mathFiles", "papers"} and ledger["schemaVersion"] == 2,
            "invalid phase-1 ledger")
    catalog_by_id = {p["paperId"]: p for p in catalog}
    require(len(catalog_by_id) == len(catalog), "duplicate catalog edition")
    results, identities, hashes = {}, set(), set()
    for paper in ledger["papers"]:
        require(set(paper) == {"paperId", "identity", "source", "inventory"}, "unexpected paper fields")
        paper_id, identity, source = paper["paperId"], paper["identity"], paper["source"]
        require(PAPER_ID.fullmatch(paper_id) and paper_id not in results, "invalid or duplicate witness paper ID")
        require(set(identity) == {"exam", "year", "subject", "issuer", "courseCode", "courseName",
                                  "variant", "difficulty", "editionType"} and type(identity["year"]) is int
                and identity["year"] in YEARS and identity["subject"] in (SUBJECTS | {"理科综合"})
                and all(isinstance(identity[k], str) and identity[k].strip() == identity[k] and identity[k]
                        for k in ("issuer", "variant", "courseName")), "invalid edition identity")
        # 研究生科目代码标识该校该年初试卷，扫描版名称不能制造新卷别。
        edition_key = ((identity["subject"], identity["variant"].casefold())
                       if identity["courseCode"] is None else identity["courseCode"])
        key = (identity["exam"], identity["year"], identity["issuer"].casefold(), edition_key)
        require(key not in identities, "duplicate edition identity")
        identities.add(key)
        require(set(source) <= {"kind", "listing", "artifact", "rights", "sha256", "pages", "gitBlobSha"}
                and valid_https(source["listing"]) and valid_https(source["artifact"])
                and source["rights"] in {"unknown_metadata_only", "restricted_metadata_only"}
                and SHA256.fullmatch(source["sha256"]) and type(source["pages"]) is int
                and 1 <= source["pages"] <= 100, "invalid provenance, rights or PDF evidence")
        require(source["sha256"] not in hashes, "same whole-paper bytes assigned to distinct editions")
        hashes.add(source["sha256"])
        exam, course, edition = identity["exam"], identity["courseCode"], identity["editionType"]
        require(source["kind"] in {"issuer_past_paper_attachment", "pinned_third_party"},
                "source is not an exam-paper witness")
        if exam == "gaokao":
            require(course is None and edition in {"national", "provincial", "joint_province"}
                    and (identity["subject"] != "理科综合" or edition == "national"),
                    "invalid Gaokao edition type or course code")
            if identity["subject"] == "数学":
                known = catalog_by_id.get(paper_id)
                require(known and known["exam"] == "gaokao" and known["year"] == identity["year"]
                        and identity["variant"] == paper_id.removeprefix(f"gaokao-{identity['year']}-"),
                        "Gaokao catalog witness mismatch")
                family = "national" if identity["variant"].startswith(("national-", "new-gaokao-")) else "provincial"
                require(edition == family, "Gaokao math edition type conflicts with catalog")
                if source["kind"] == "pinned_third_party":
                    require(source["artifact"] == known["source"]["url"]
                            and source.get("gitBlobSha") == known["source"]["gitBlobSha"],
                            "Gaokao catalog artifact mismatch")
        elif exam == "postgraduate_self_set":
            require(edition == "institution" and identity["subject"] in SUBJECTS - {"数学"}
                    and isinstance(course, str) and re.fullmatch(r"\d{3}", course),
                    "self-set edition lacks institution type or subject code")
        else:
            require(exam == "postgraduate_math" and edition == "national" and identity["subject"] == "数学"
                    and course in {"301", "302", "303"} and paper_id in catalog_by_id
                    and catalog_by_id[paper_id]["exam"] == "kaoyan"
                    and paper_id == f"kaoyan-math-{course[-1]}-{identity['year']}"
                    and catalog_by_id[paper_id]["year"] == identity["year"], "invalid postgraduate math edition")
        results[paper_id] = audit_paper(paper, (reviews or {}).get(paper_id), pdf_dir, (access or {}).get(paper_id, {}))
    require(set(reviews or {}) <= results.keys(), "review evidence has no matching witness")
    return results


def run_audit(raw_csv, pdf_dir=None, *, fetch=False):
    catalog = load("exam-source-expansion-2022-2026-v0.1.json")["papers"]
    snapshot = load("exam-science-upstream-intake-snapshot-2022-2026-v0.1.json")
    crosswalk = load("exam-science-source-reconciliation-2022-2026-v0.1.json")
    ledger = load("exam-phase1-witnesses-2022-2026-v0.1.json")
    reviews = load("exam-phase1-source-review-2022-2026-v0.1.json")
    require(set(reviews) == {"schemaVersion", "rosters", "candidateDispositions", "papers"} and
            reviews["schemaVersion"] == 1 and set(reviews["rosters"]) == {"gaokaoScience", "postgraduateScience"},
            "invalid phase-1 review manifest")
    counts, rows = reconcile(raw_csv, snapshot, crosswalk, catalog)
    transport = replay_sources(pdf_dir, catalog, ledger, crosswalk, rows) if fetch else {}
    math_bytes = audit_math_files(ledger["mathFiles"], rows, crosswalk, catalog, pdf_dir, transport)
    witnesses = audit_witnesses(ledger, catalog, pdf_dir, reviews=reviews["papers"],
                                access=witness_transport(ledger, transport))
    for paper in ledger["papers"]:
        if paper["identity"]["exam"] == "gaokao" and paper["source"]["kind"] == "pinned_third_party":
            require(paper["source"]["sha256"] == ledger["mathFiles"]["catalogPdfSha256"][paper["paperId"]],
                    "Gaokao witness SHA-256 differs from catalog observation")

    open_candidates = {x["upstreamRecordId"] for x in crosswalk["mathUnresolved"]}
    open_candidates.update(row_id for row_id, row in rows.items() if row["subject"] != "数学")
    dispositions = reviews["candidateDispositions"]
    by_id = {paper["paperId"]: paper["identity"] for paper in ledger["papers"]}
    require(set(dispositions) <= open_candidates, "unexpected reviewed candidate disposition")
    for row_id, disposition in dispositions.items():
        require(set(disposition) == {"decision", "review", "paperId"} and reviewed(disposition["review"]),
                "invalid reviewed candidate disposition")
        ident, row = by_id.get(disposition["paperId"]), rows[row_id]
        if disposition["decision"] == "linked":
            require(ident and ident["exam"] == "gaokao" and str(ident["year"]) == row["year"]
                    and (ident["subject"] == row["subject"]
                         or (ident["subject"] == "理科综合" and row["subject"] != "数学")),
                    "candidate disposition conflicts with exam year or subject")
        else:
            require(disposition["decision"] == "out_of_scope" and disposition["paperId"] is None,
                    "invalid out-of-scope disposition")
    for name, roster in reviews["rosters"].items():
        if roster["status"] == "closed":
            expected_exam = "gaokao" if name == "gaokaoScience" else "postgraduate_self_set"
            ids = roster["paperIds"]
            # 每条理科路线必须覆盖明确要求的年份与学科，不能以一个样本关闭整个范围。
            science = SUBJECTS - {"数学"}
            observed = {(by_id[i]["year"], subject) for i in ids if i in by_id
                        for subject in (science if by_id[i]["subject"] == "理科综合" else [by_id[i]["subject"]])}
            require(all(i in by_id and by_id[i]["exam"] == expected_exam for i in ids)
                    and observed == {(year, subject) for year in YEARS for subject in SUBJECTS - {"数学"}},
                    "closed science roster does not cover the requested exam/year/subject lanes")
            if name == "postgraduateScience":
                require(all(witnesses[i]["difficultyEvidence"] == "reviewed" for i in ids),
                        "closed postgraduate science roster lacks reviewed difficulty strata")
    phase = accepted_scope([p["paperId"] for p in catalog], reviews["rosters"], witnesses)
    phase["unresolvedCandidateIds"] = sorted(open_candidates - dispositions.keys())
    byte_replay = (
        math_bytes["catalogPdfsRechecked"] == math_bytes["catalogPdfsWithObservedSha256"]
        and math_bytes["mirrorsRechecked"] == math_bytes["equalMirrorsRecorded"]
        and bool(witnesses) and all(x["G2"] == "passed" for x in witnesses.values())
    )
    phase["complete"] = phase["complete"] and not phase["unresolvedCandidateIds"] and byte_replay

    prior = load("kaoyan-math1-2025-all-questions-review-v0.1.json")
    reviewed_count = prior["paper"]["expectedQuestions"]
    require({x["question"] for x in prior["items"]} == set(range(1, reviewed_count + 1))
            and len(prior["items"]) == reviewed_count and all(x["pdfPages"] and not x["verifiedAsOfficialKey"]
            for x in prior["items"]), "historical Math I inventory drift")
    return {
        "status": "phase_1_complete" if phase["complete"] else "phase_1_blocked",
        "candidateAudit": counts,
        "mathPathByteAudit": math_bytes,
        "replay": {"mode": "public_fetch" if fetch else "local_files" if pdf_dir else "metadata_only",
                   "byteReplayComplete": byte_replay, "transport": transport},
        "mathCatalogEditions": len(catalog),
        "historicalMath1WitnessQuestions": reviewed_count,
        "witnesses": witnesses,
        "acceptance": phase,
        "phaseQuestionDenominator": phase["phaseQuestionDenominator"],
        "sourceQualifiedQuestions": sum(x["sourceQualifiedQuestions"] for x in witnesses.values()),
    }


def exit_status(report, *, require_complete=False, require_bytes=False):
    return int((require_complete and not report["acceptance"]["complete"])
               or (require_bytes and not report["replay"]["byteReplayComplete"]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, required=True, help="local copy of the pinned source CSV")
    sources = parser.add_mutually_exclusive_group()
    sources.add_argument("--pdf-dir", type=Path, help="local source files organized by paper ID")
    sources.add_argument("--fetch", action="store_true", help="replay allowlisted public sources in temporary storage")
    parser.add_argument("--require-byte-recheck", action="store_true", help="require all listed binary replays")
    parser.add_argument("--require-complete", action="store_true", help="require reviewed G0–G4 acceptance")
    args = parser.parse_args()
    try:
        raw_csv = read_bounded(args.csv)
        if args.fetch:
            with TemporaryDirectory(prefix="tutorbench-phase1-") as directory:
                report = run_audit(raw_csv, Path(directory), fetch=True)
        else:
            report = run_audit(raw_csv, args.pdf_dir)
    except (ValueError, OSError, KeyError, TypeError, AttributeError, csv.Error, subprocess.SubprocessError) as error:
        print(f"phase-1 evidence rejected: {error}", file=sys.stderr)
        return 1
    print(json.dumps(report, indent=2))
    return exit_status(report, require_complete=args.require_complete, require_bytes=args.require_byte_recheck)


if __name__ == "__main__":
    sys.exit(main())
