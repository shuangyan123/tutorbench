"""Fetch only known public phase-1 artifacts into caller-owned temporary storage."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, urlsplit
from urllib.request import build_opener, HTTPRedirectHandler, Request

from audit_pinned_exam_artifacts import MAX_BLOB_BYTES, SHA
from exam_phase1_authority import AUTHORITY_SOURCE_KINDS, NATIONAL_HOSTS, PROOF_KINDS, UNIVERSITY_HOSTS, publisher_route
from exam_phase1_evidence import PAPER_ID, require, valid_https


PUBLIC_REPOS = {"deekur/gaokaomath", "qingshuo/China-Gaokao-Papers-Collection"}
PUBLISHER_HOSTS = set(UNIVERSITY_HOSTS.values()).union(*NATIONAL_HOSTS.values())


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def raw_url(repo, revision, path):
    require(repo in PUBLIC_REPOS and SHA.fullmatch(revision) and isinstance(path, str)
            and not any(x in {"", ".", ".."} for x in path.split("/"))
            and "\\" not in path and not any(ord(x) < 32 for x in path),
            "unsafe or unpinned public repository path")
    return f"https://raw.githubusercontent.com/{repo}/{revision}/{quote(path)}"


def download_public(url):
    require(valid_https(url) and urlsplit(url).hostname in {"raw.githubusercontent.com", *PUBLISHER_HOSTS},
            "publisher is not allowlisted for automatic replay")
    request = Request(url, headers={"User-Agent": "TutorBench-ExamPhase1Replay/1"})
    with build_opener(NoRedirect()).open(request, timeout=20) as response:
        data = response.read(MAX_BLOB_BYTES + 1)
    require(0 < len(data) <= MAX_BLOB_BYTES, "public replay response exceeds byte limit")
    return data


def replay_sources(directory, catalog, ledger, crosswalk, rows, reviews):
    """Deduplicate fetches by URL and retain a transport outcome for each artifact."""
    pin = crosswalk["source"]
    requests = {}
    catalog_ids = set()
    for entry in catalog:
        if entry["exam"] == "gaokao":
            ident, src = entry["paperId"], entry["source"]
            require(PAPER_ID.fullmatch(ident), "unsafe paper ID")
            requests[f"{ident}.pdf"] = raw_url(src["repository"], src["revision"], src["path"])
            catalog_ids.add(ident)
    mirrors = set(ledger["mathFiles"]["equalMirrorPaperIds"])
    for entry in crosswalk["mathExactSourcePathMatches"]:
        ident = entry["tutorBenchPaperId"]
        if ident in mirrors:
            require(ident in catalog_ids, "unexpected mirror ID")
            path = rows[entry["upstreamRecordId"]]["local_path"]
            requests[f"mirrors/{ident}.pdf"] = raw_url(pin["repository"], pin["revision"], path)
    for paper in ledger["papers"]:
        ident, src = paper["paperId"], paper["source"]
        require(PAPER_ID.fullmatch(ident), "unsafe witness ID")
        if src["kind"] in AUTHORITY_SOURCE_KINDS:
            _, hosts, source_kind, _ = publisher_route(paper["identity"])
            require(src["kind"] == source_kind
                    and all(valid_https(src[key]) and urlsplit(src[key]).hostname in hosts
                        for key in ("artifact", "listing")), "unreviewed publisher replay URL")
            requests[f"{ident}.html"] = src["listing"]
            # 同一卷别可同时留有目录镜像与发行方附件，不得覆盖两种字节证据。
            target = f"witnesses/{ident}.pdf" if ident in catalog_ids else f"{ident}.pdf"
            requests[target] = src["artifact"]
            for kind, (suffix, _) in PROOF_KINDS.items():
                proof = reviews.get(ident, {}).get(kind)
                if proof and valid_https(proof.get("url")) and urlsplit(proof["url"]).hostname in hosts:
                    requests[f"proofs/{ident}.{suffix}"] = proof["url"]

    by_url = {}
    for name, url in requests.items():
        by_url.setdefault(url, []).append(name)

    def fetch(pair):
        url, names = pair
        try:
            data = download_public(url)
        except (OSError, ValueError) as error:
            reason = f"http_{error.code}" if isinstance(error, HTTPError) else type(error).__name__
            return [(name, {"status": "unavailable", "reason": reason}) for name in names]
        for name in names:
            target = directory / Path(name)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        return [(name, {"status": "reachable"}) for name in names]

    with ThreadPoolExecutor(max_workers=6) as pool:
        return dict(entry for batch in pool.map(fetch, by_url.items()) for entry in batch)


def witness_transport(ledger, transport):
    results = {}
    for paper in ledger["papers"]:
        ident = paper["paperId"]
        path = f"witnesses/{ident}.pdf"
        results[ident] = {
            "listing": transport.get(f"{ident}.html", {}).get("status", "not_requested"),
            "pdf": transport.get(path, transport.get(f"{ident}.pdf", {})).get("status", "not_requested"),
        }
    return results
