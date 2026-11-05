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
from exam_phase1_authority import AUTHORITY_SOURCE_KINDS, assess_proof, assess_publication
from exam_phase1_evidence import (
    PAPER_ID, SHA256, accepted_scope, comparison_result, evidence_digest, inventory_result, page_index,
    require, reviewed, scoped_review, valid_https,
)

from replay_exam_phase1_sources import replay_sources, witness_transport

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures/research"
YEARS = range(2022, 2027)
SUBJECTS = {"数学", "物理", "化学", "生物"}
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


def local_bytes(pdf_dir, relative):
    if pdf_dir is None or not (path := pdf_dir / relative).is_file():
        return None
    return read_bounded(path)


def audit_paper(paper, evidence, pdf_dir, access):
    paper_id = paper["paperId"]
    source, identity = paper["source"], paper["identity"]
    artifact_sha = source["sha256"]
    require(evidence is None or set(evidence) == {"artifactSha256", "issuerListing", "cover", "pages",
            "pageReview", "coverReview", "editionResolution", "officialOriginal", "researchRights",
            "publicRedistribution", "comparisons", "difficultyReview"},
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

    def read_local(relative):
        return local_bytes(pdf_dir, relative)

    publisher, publication, source_issues = assess_publication(
        paper, evidence, read_local, access, g2 == "passed", bound,
    )
    issues.extend(source_issues)
    g0 = "conflict" if issues else publisher["G0"]
    proofs = {}
    for kind in ("officialOriginal", "researchRights", "publicRedistribution"):
        try:
            proofs[kind] = (assess_proof(evidence.get(kind), kind, paper_id, publication, read_local)
                            if publisher["attachmentIdentity"] == "matches" else "unverified")
        except (ValueError, OSError, TypeError, KeyError, AttributeError):
            proofs[kind] = "conflict"
    official, research = proofs["officialOriginal"], proofs["researchRights"]
    g1 = ("conflict" if "conflict" in (official, research) else
          "passed" if g0 == "passed" and official == "confirmed" and research == "allowed" else "unverified")

    expected = None
    pages = evidence.get("pages")
    page_review = evidence.get("pageReview")
    page_review_conflict = False
    if bound and pages is not None and page_review is not None:
        scope = {"paperId": paper_id, "sourceSha256": artifact_sha, "pageCount": source["pages"],
                 "purpose": "page_inventory"}
        if scoped_review(page_review, scope, evidence_digest(pages)):
            expected = page_index(pages, source["pages"])
        else:
            page_review_conflict = True
            issues.append("page_inventory_review_binding_conflict")
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
    g4 = ("conflict" if page_review_conflict else
          "unverified" if inventory == "passed" and g2 != "passed" else inventory)
    compared, matched, comparison_conflicts, comparison_missing, comparison_findings = comparison_result(
        evidence.get("comparisons") if g2 == "passed" else None,
        paper_id, expected, located, paper["inventory"]["questions"], artifact_sha, read_local,
    )
    g3 = ("conflict" if comparison_conflicts else "passed" if expected is not None and g2 == "passed"
          and len(matched) == len(expected) else "abstained" if any(
              row["decision"] == "abstained" for row in comparison_findings.values()
          ) else "unverified")
    qualified = len(matched) if g0 == g1 == g2 == "passed" and not comparison_conflicts and not locator_conflicts else 0

    return {
        **publisher,
        "G0": g0, "G1": g1, "G2": g2, "G3": g3, "G4": g4,
        "listingUrlAccess": access.get("listing", "not_requested"),
        "pdfUrlAccess": access.get("pdf", "not_requested"),
        "difficultyEvidence": "reviewed" if rated else "unrated",
        "officialOriginal": official,
        "internalResearchRights": research,
        "publicRedistributionRights": proofs["publicRedistribution"],
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
        "comparisonFindings": comparison_findings,
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
        require(source["kind"] in AUTHORITY_SOURCE_KINDS | {"pinned_third_party"},
                "source is not an exam-paper witness")
        if exam == "gaokao":
            require(course is None and edition in {"national", "provincial", "joint_province"}
                    and (identity["subject"] != "理科综合" or edition == "national"),
                    "invalid Gaokao edition type or course code")
            require(paper_id == f"gaokao-{identity['year']}-{identity['variant']}", "Gaokao edition ID mismatch")
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


def acceptance_targets(manifest, catalog, identities):
    groups = {
        "gaokaoMath": ("gaokao", {"数学"}, "national"),
        "gaokaoScience": ("gaokao", {"理科综合"}, "national"),
        "postgraduateMath": ("postgraduate_math", {"数学"}, "national"),
        "postgraduateScience": ("postgraduate_self_set", SUBJECTS - {"数学"}, "institution"),
    }
    require(set(manifest) == {"schemaVersion", "id", "missingSourcePolicy", "exclusions", "groups"}
            and manifest["schemaVersion"] == 1 and manifest["id"] == "phase1-national-and-njust-v1"
            and bool(manifest["missingSourcePolicy"].strip()) and set(manifest["groups"]) == set(groups),
            "invalid acceptance scope version")
    require(manifest["exclusions"] and all(
        set(x) == {"id", "basis", "source"} and x["basis"].strip() and valid_https(x["source"])
        for x in manifest["exclusions"]), "scope exclusion lacks evidence")
    target_ids = []
    for name, (exam, subjects, edition) in groups.items():
        group = manifest["groups"][name]
        require(set(group) == {"basis", "sources", "deferred", "papers"} and group["basis"].strip()
                and group["deferred"].strip() and group["sources"] and all(map(valid_https, group["sources"]))
                and group["papers"], "scope group lacks evidence or targets")
        for target in group["papers"]:
            require(set(target) == {"paperId", "year", "exam", "subject", "variant", "courseCode", "issuer", "editionType"}
                    and PAPER_ID.fullmatch(target["paperId"]) and target["exam"] == exam and target["year"] in YEARS
                    and target["subject"] in subjects and target["editionType"] == edition, "invalid acceptance target")
            ident = target["paperId"]
            if ident in identities:
                require(all(identities[ident][key] == value for key, value in target.items() if key != "paperId"),
                        "witness conflicts with versioned target identity")
            target_ids.append(ident)
    national_math = {p["paperId"] for p in catalog if p["exam"] == "gaokao"
                     and p["paperId"].removeprefix(f"gaokao-{p['year']}-").startswith(("national-", "new-gaokao-"))}
    for key, expected in (("gaokaoMath", national_math),
                          ("postgraduateMath", {p["paperId"] for p in catalog if p["exam"] == "kaoyan"})):
        require({p["paperId"] for p in manifest["groups"][key]["papers"]} == expected,
                "acceptance scope drops a national mathematics target")
    return target_ids


def run_audit(raw_csv, pdf_dir=None, *, fetch=False):
    catalog = load("exam-source-expansion-2022-2026-v0.1.json")["papers"]
    snapshot = load("exam-science-upstream-intake-snapshot-2022-2026-v0.1.json")
    crosswalk = load("exam-science-source-reconciliation-2022-2026-v0.1.json")
    ledger = load("exam-phase1-witnesses-2022-2026-v0.1.json")
    reviews = load("exam-phase1-source-review-2022-2026-v0.1.json")
    require(set(reviews) == {"schemaVersion", "candidateDispositions", "papers"} and
            reviews["schemaVersion"] == 2, "invalid phase-1 review manifest")
    counts, rows = reconcile(raw_csv, snapshot, crosswalk, catalog)
    transport = replay_sources(pdf_dir, catalog, ledger, crosswalk, rows, reviews["papers"]) if fetch else {}
    math_bytes = audit_math_files(ledger["mathFiles"], rows, crosswalk, catalog, pdf_dir, transport)
    witnesses = audit_witnesses(ledger, catalog, pdf_dir, reviews=reviews["papers"],
                                access=witness_transport(ledger, transport))
    for paper in ledger["papers"]:
        if (paper["identity"]["exam"] == "gaokao" and paper["identity"]["subject"] == "数学"
                and paper["source"]["kind"] == "pinned_third_party"):
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
    target = load("exam-phase1-acceptance-scope-2022-2026-v1.json")
    target_ids = acceptance_targets(target, catalog, by_id)
    phase = accepted_scope(target_ids, witnesses)
    phase["scopeVersion"] = target["id"]
    phase["unresolvedDiscoveryCandidateIds"] = sorted(open_candidates - dispositions.keys())
    byte_replay = (
        math_bytes["catalogPdfsRechecked"] == math_bytes["catalogPdfsWithObservedSha256"]
        and math_bytes["mirrorsRechecked"] == math_bytes["equalMirrorsRecorded"]
        and bool(witnesses) and all(x["G2"] == "passed" for x in witnesses.values())
    )

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
        "sourceQualifiedQuestions": sum(witnesses[i]["sourceQualifiedQuestions"] for i in target_ids if i in witnesses),
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
