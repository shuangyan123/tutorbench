"""Review evidence and acceptance rules for the Phase 1 source inventory."""
from datetime import date
from html.parser import HTMLParser
import re
from urllib.parse import urljoin, urlsplit

SHA256 = re.compile(r"[a-f0-9]{64}")
PAPER_ID = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
QUESTION_ID = re.compile(r"[A-Z]\.[1-9]\d?")
FIGURE_ID = re.compile(r"(?:figure|table|diagram)-\d+")
IDENTITY_FIELDS = ("year", "issuer", "courseCode", "courseName")
COMPARISON_CHECKS = {"wording", "subparts", "options", "units", "formulas", "visuals"}
GATES = ("G0", "G1", "G2", "G3", "G4")


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def valid_https(url):
    if not isinstance(url, str):
        return False
    parsed = urlsplit(url)
    return parsed.scheme == "https" and bool(parsed.hostname) and parsed.netloc == parsed.hostname


def reviewed(record):
    if not isinstance(record, dict) or set(record) != {"reviewer", "date", "record"}:
        return False
    try:
        observed = date.fromisoformat(record["date"])
    except (ValueError, TypeError):
        return False
    return (
        isinstance(record["reviewer"], str) and bool(record["reviewer"].strip())
        and observed.isoformat() == record["date"]
        and (valid_https(record["record"]) or bool(re.fullmatch(
            r"docs/research/[a-z0-9.-]+\.md#[a-z0-9-]+", record["record"] or ""
        )))
    )


class ListingLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.hrefs.extend(value for key, value in attrs if key == "href" and value)


def exact_attachment(html, listing, artifact):
    """Resolve actual anchors against the requested listing, ignoring text and base tags."""
    parser = ListingLinks()
    parser.feed(html.decode("utf-8-sig"))
    parser.close()
    return any(urljoin(listing, href) == artifact for href in parser.hrefs)


def observed_cover(observation, identity):
    require(isinstance(observation, dict) and set(observation) == set(IDENTITY_FIELDS),
            "invalid cover observation")
    return all(observation[key] == identity[key] for key in IDENTITY_FIELDS)


def page_index(observations, count):
    """Build the independent denominator and page/asset locators from a second source read."""
    require(isinstance(observations, list) and len(observations) == count,
            "page review does not enumerate the full PDF")
    expected = {}
    for page, observation in enumerate(observations, 1):
        require({"starts", "continuations", "figures"} <= set(observation)
                <= {"starts", "continuations", "figures", "optionCounts"}, "invalid page observation")
        for section, bounds in observation["starts"].items():
            require(re.fullmatch(r"[A-Z]", section) and isinstance(bounds, list)
                    and len(bounds) == 2 and all(type(n) is int for n in bounds)
                    and 1 <= bounds[0] <= bounds[1] <= 99, "invalid source section bounds")
            for number in range(bounds[0], bounds[1] + 1):
                qid = f"{section}.{number}"
                require(qid not in expected, "duplicate source question start")
                expected[qid] = {"stemPage": page, "pages": {page}, "figures": set()}
    require(expected, "empty page-derived denominator")
    for page, observation in enumerate(observations, 1):
        continuations = observation["continuations"]
        require(isinstance(continuations, list) and len(set(continuations)) == len(continuations)
                and all(qid in expected and page != expected[qid]["stemPage"] for qid in continuations),
                "invalid source continuation")
        for qid in continuations:
            expected[qid]["pages"].add(page)
        for qid, figures in observation["figures"].items():
            require(qid in expected and isinstance(figures, list) and figures
                    and len(set(figures)) == len(figures) and all(FIGURE_ID.fullmatch(f) for f in figures),
                    "invalid source figure")
            expected[qid]["pages"].add(page)
            expected[qid]["figures"].update((label, page) for label in figures)
        for qid, count in observation.get("optionCounts", {}).items():
            require(qid in expected and page in expected[qid]["pages"] and type(count) is int
                    and 1 <= count <= 30 and "options" not in expected[qid], "invalid source option count")
            expected[qid]["options"] = count
    return expected


def inventory_result(inventory, expected, page_count):
    require(set(inventory) == {"sections", "questions"}, "unexpected inventory fields")
    declared = set()
    for section, bounds in inventory["sections"].items():
        require(re.fullmatch(r"[A-Z]", section) and isinstance(bounds, list)
                and len(bounds) == 2 and all(type(n) is int for n in bounds)
                and 1 <= bounds[0] <= bounds[1] <= 99, "invalid inventory section denominator")
        declared.update(f"{section}.{n}" for n in range(bounds[0], bounds[1] + 1))
    located = set()
    problems = {}
    seen = set()
    for item in inventory["questions"]:
        require(set(item) == {"id", "pages", "stemPage", "figures", "notation", "numberedParts", "options"},
                "unexpected question fields")
        qid, pages = item["id"], item["pages"]
        require(QUESTION_ID.fullmatch(qid) and qid not in seen, "duplicate or invalid top-level question ID")
        seen.add(qid)
        require(isinstance(pages, list) and pages and len(set(pages)) == len(pages)
                and all(type(n) is int and 1 <= n <= page_count for n in pages)
                and type(item["stemPage"]) is int and item["stemPage"] in pages, "invalid question page locator")
        require(isinstance(item["figures"], list)
                and all(set(f) == {"id", "page"} and FIGURE_ID.fullmatch(f["id"])
                        and type(f["page"]) is int and f["page"] in pages for f in item["figures"])
                and all(type(item[key]) is int and 0 <= item[key] <= 30 for key in ("numberedParts", "options"))
                and item["notation"] in {"seen", "not_seen", "unreviewed"}, "invalid figure or formula observation")
        figures = {(f["id"], f["page"]) for f in item["figures"]}
        require(len(figures) == len(item["figures"]), "duplicate figure locator")
        if expected is None:
            continue
        observed = {"stemPage": item["stemPage"], "pages": set(pages), "figures": figures}
        if qid not in expected:
            problems[qid] = "not_a_source_top_level_question"
        elif observed != {k: v for k, v in expected[qid].items() if k != "options"} or (
            "options" in expected[qid] and item["options"] != expected[qid]["options"]
        ):
            problems[qid] = "stem_continuation_or_visual_mismatch"
        else:
            located.add(qid)
    if expected is None:
        return "unverified", located, problems, None
    missing = sorted(expected.keys() - seen, key=lambda qid: (qid[0], int(qid[2:])))
    if declared != set(expected):
        problems["sections"] = "declared_sections_disagree_with_source_pages"
    status = "passed" if not problems and not missing else "conflict" if problems else "incomplete"
    return status, located, problems, missing


def comparison_result(comparisons, located, source_sha, candidate_digest):
    if comparisons is None:
        return set(), set(), [], []
    require(isinstance(comparisons, list), "invalid comparison records")
    compared, matched, conflicts, missing, seen = set(), set(), [], [], set()
    for entry in comparisons:
        require(set(entry) == {"id", "sourceSha256", "candidateSha256", "checks", "decision", "review"},
                "invalid question comparison evidence")
        qid = entry["id"]
        require(QUESTION_ID.fullmatch(qid) and qid not in seen, "duplicate or invalid question comparison")
        seen.add(qid)
        if (qid not in located or entry["sourceSha256"] != source_sha
                or not SHA256.fullmatch(entry["candidateSha256"]) or entry["candidateSha256"] == source_sha
                or set(entry["checks"]) != COMPARISON_CHECKS or not reviewed(entry["review"])
                or entry["decision"] not in {"match", "mismatch"}):
            conflicts.append(qid)
            continue
        actual = candidate_digest(qid)
        if actual is None:
            missing.append(qid)
            continue
        if actual != entry["candidateSha256"]:
            conflicts.append(qid)
            continue
        compared.add(qid)
        if entry["decision"] == "match":
            matched.add(qid)
        else:
            conflicts.append(qid)
    return compared, matched, conflicts, missing


def accepted_scope(known_ids, rosters, papers):
    """A closed roster must account for every target and each paper must pass all gates."""
    required = set(known_ids)
    require(required, "empty phase target roster")
    open_rosters = []
    for kind, roster in rosters.items():
        if roster["status"] == "open":
            require(set(roster) == {"status", "reason"} and roster["reason"].strip(),
                    "open roster lacks an explanation")
            open_rosters.append(kind)
            continue
        require(set(roster) == {"status", "paperIds", "review"} and roster["status"] == "closed"
                and reviewed(roster["review"]), "closed roster lacks reviewed evidence")
        ids = roster["paperIds"]
        require(isinstance(ids, list) and ids and all(PAPER_ID.fullmatch(i) for i in ids)
                and len(ids) == len(set(ids)) and not (required & set(ids)), "invalid closed roster IDs")
        required.update(ids)
    missing = sorted(required - papers.keys())
    extra = sorted(papers.keys() - required)
    blocked = sorted(i for i in required & papers.keys() if any(papers[i][gate] != "passed" for gate in GATES))
    denominator = None
    if not open_rosters and not missing and not extra and all(papers[i]["expectedQuestions"] is not None for i in required):
        denominator = sum(papers[i]["expectedQuestions"] for i in required)
    return {
        "complete": not open_rosters and not missing and not extra and not blocked and bool(denominator),
        "openRosters": open_rosters,
        "requiredKnownPapers": len(required),
        "missingPaperIds": missing,
        "outsideClosedRosterIds": [] if open_rosters else extra,
        "blockedPaperIds": blocked,
        "phaseQuestionDenominator": denominator,
    }
