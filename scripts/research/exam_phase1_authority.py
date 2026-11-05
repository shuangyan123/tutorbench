"""Issuer routes and scoped publication/permission evidence for the Phase 1 audit."""
import hashlib
import re
from urllib.parse import urlsplit

from exam_phase1_evidence import exact_attachment, observed_cover, parse_listing, scoped_review, strict_json, valid_https

NATIONAL_ISSUER = "教育部教育考试院"
NATIONAL_HOSTS = {
    "gaokao_national": {"gaokao.neea.edu.cn", "www.neea.edu.cn"},
    "postgraduate_national": {"yankao.neea.edu.cn", "www.neea.edu.cn"},
}
UNIVERSITY_HOSTS = {"南京理工大学": "gs.njust.edu.cn"}
AUTHORITY_SOURCE_KINDS = {"authority_original_publication", "issuer_past_paper_attachment"}
PROOF_KINDS = {
    "officialOriginal": ("original", {"confirmed", "denied"}),
    "researchRights": ("rights", {"allowed", "denied"}),
    "publicRedistribution": ("redistribution", {"allowed", "denied"}),
}


def publisher_route(identity):
    exam, edition, issuer = identity["exam"], identity["editionType"], identity["issuer"]
    if edition == "national" and issuer == NATIONAL_ISSUER:
        route = {"gaokao": "gaokao_national", "postgraduate_math": "postgraduate_national"}.get(exam)
        if route:
            return route, NATIONAL_HOSTS[route], "authority_original_publication", "original_paper_release"
    if exam == "postgraduate_self_set" and edition == "institution" and issuer in UNIVERSITY_HOSTS:
        return "university_self_set", {UNIVERSITY_HOSTS[issuer]}, "issuer_past_paper_attachment", "past_paper_release"
    return None, set(), None, None


def source_scope(paper, route):
    source, identity = paper["source"], paper["identity"]
    return {"paperId": paper["paperId"], "route": route, "issuer": identity["issuer"],
            "year": identity["year"], "subject": identity["subject"], "courseCode": identity["courseCode"],
            "courseName": identity["courseName"], "variant": identity["variant"],
            "artifactUrl": source["artifact"], "artifactSha256": source["sha256"], "listingUrl": source["listing"]}


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def assess_publication(paper, evidence, read_local, access, verified_pdf, bound):
    paper_id, source = paper["paperId"], paper["source"]
    route, hosts, source_kind, publication_kind = publisher_route(paper["identity"])
    scope = source_scope(paper, route)
    listing = evidence.get("issuerListing")
    registered = bool(route and all(urlsplit(source[k]).hostname in hosts for k in ("listing", "artifact")))
    trusted = registered and source["kind"] == source_kind
    snapshot = "unavailable" if access.get("listing") == "unavailable" else "unverified"
    attachment = snapshot
    observed_sha, live_anchor, approved_html = None, None, None
    issues = []
    if trusted and isinstance(listing, dict) and listing.get("url") == source["listing"]:
        if listing.get("kind") == publication_kind:
            expected_sha = listing.get("sha256")
            title = listing.get("title")
            review_scope = {**scope, "purpose": "publisher_snapshot", "publicationKind": publication_kind,
                            "publicationTitle": title}
            if scoped_review(listing.get("review"), review_scope, expected_sha):
                raw = None if snapshot == "unavailable" else read_local(f"{paper_id}.html")
                if raw is not None:
                    observed_sha = sha256(raw)
                    anchor = exact_attachment(raw, source["listing"], source["artifact"])
                    if access.get("listing") == "reachable":
                        live_anchor = anchor
                    if observed_sha != expected_sha:
                        # 发现实时锚点也不能沿用旧快照的审核。
                        snapshot = "snapshot_changed"
                    else:
                        snapshot = "reviewed_snapshot_replayed"
                        attachment = "linked" if anchor else "conflict"
                        # 真实标题必须与审核一致，排除评析、考试指南和样题等已知非原卷发布材料。
                        release_title = (isinstance(title, str) and parse_listing(raw).titles == [title]
                                         and re.search(r"原卷|原题|试卷|试题", title)
                                         and not re.search(r"评析|解析|样题|大纲|指南|回忆", title))
                        if anchor and release_title:
                            approved_html = raw
                        else:
                            attachment = "conflict"
                            issues.append("reviewed_snapshot_lacks_release_title_or_exact_attachment")
    cover = evidence.get("cover")
    cover_status = "unverified"
    if cover is not None and bound and trusted:
        cover_scope = {**scope, "purpose": "cover_observation", "page": 1, "observedCover": cover}
        if not observed_cover(cover, paper["identity"]):
            cover_status = "conflict"
            issues.append("cover_identity_conflict")
        elif scoped_review(evidence.get("coverReview"), cover_scope, source["sha256"]):
            cover_status = "matches" if verified_pdf else "recorded_match_not_replayed"

    resolution = evidence.get("editionResolution")
    resolved = False
    if resolution and resolution.get("decision") in {"unique", "alternate_versions_resolved"} and approved_html:
        resolved = scoped_review(
            resolution.get("review"), {**scope, "purpose": "edition_resolution", "decision": resolution["decision"]},
            observed_sha,
        )
    matched = attachment == "linked" and cover_status == "matches"
    g0 = "conflict" if issues else "passed" if matched and resolved else "unverified"
    return {
        "G0": g0, "publisherRoute": route, "issuerIdentity": "recognized_authority" if registered else "unverified",
        "publicationKind": listing.get("kind") if isinstance(listing, dict) else None,
        "publisherSnapshot": snapshot, "liveAnchorPresent": live_anchor,
        "attachmentLink": attachment, "observedListingSha256": observed_sha, "coverIdentity": cover_status,
        "attachmentIdentity": "matches" if matched else "unverified",
        "editionResolution": "reviewed" if resolved else "unverified",
    }, (scope, hosts, observed_sha, approved_html), issues


def assess_proof(proof, kind, paper_id, publication, read_local):
    if proof is None:
        return "unverified"
    scope, hosts, listing_sha, html = publication
    if not isinstance(proof, dict) or set(proof) != {"url", "sha256", "review"}:
        return "conflict"
    url, digest = proof["url"], proof["sha256"]
    if not valid_https(url) or urlsplit(url).hostname not in hosts or url in (scope["listingUrl"], scope["artifactUrl"]):
        return "conflict"
    if not html:
        return "unverified"
    # 只接受已审核发布页实际链接、声明适用卷别及版本的发行方机器可读凭证。
    proof_scope = {**scope, "publicationSha256": listing_sha, "purpose": kind, "url": url}
    if not scoped_review(proof["review"], proof_scope, digest) or not exact_attachment(html, scope["listingUrl"], url):
        return "conflict"
    suffix, decisions = PROOF_KINDS[kind]
    raw = read_local(f"proofs/{paper_id}.{suffix}")
    if raw is None:
        return "unavailable"
    try:
        document = strict_json(raw)
    except (ValueError, UnicodeError):
        return "conflict"
    if (sha256(raw) != digest or not isinstance(document, dict)
            or set(document) != {"schemaVersion", "scope", "decision"}
            or type(document["schemaVersion"]) is not int or document["schemaVersion"] != 1
            or document["scope"] != proof_scope or document["decision"] not in decisions):
        return "conflict"
    return document["decision"]
