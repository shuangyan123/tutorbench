"""Review evidence and acceptance rules for the Phase 1 source inventory."""
from datetime import date
from html.parser import HTMLParser
import hashlib
import json
import re
from urllib.parse import urljoin, urlsplit

SHA256 = re.compile(r"[a-f0-9]{64}")
PAPER_ID = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
QUESTION_ID = re.compile(r"[A-Z]\.[1-9]\d?")
FIGURE_ID = re.compile(r"(?:figure|table|diagram)-\d+")
IDENTITY_FIELDS = ("year", "issuer", "courseCode", "courseName")
PERSON_ID = re.compile(r"[a-z0-9][a-z0-9-]{2,99}")
COMPARISON_FIELDS = {"stem", "conditions", "symbols", "formulas", "units", "options", "subparts", "visuals"}
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


def evidence_digest(document):
    payload = json.dumps(document, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf8")).hexdigest()


def scoped_review(record, scope, digest):
    if (not isinstance(record, dict) or set(record) != {
        "schemaVersion", "reviewerId", "date", "record", "scope", "evidenceSha256"
    } or type(record["schemaVersion"]) is not int or record["schemaVersion"] != 2
            or not isinstance(record["reviewerId"], str) or not PERSON_ID.fullmatch(record["reviewerId"])
            or not isinstance(digest, str) or not SHA256.fullmatch(digest)):
        return False
    return (record["scope"] == scope and record["evidenceSha256"] == digest
            and reviewed({"reviewer": record["reviewerId"], "date": record["date"], "record": record["record"]}))


class ListingLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []
        self.titles = []
        self.title_parts = None

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.hrefs.extend(value for key, value in attrs if key == "href" and value)
        if tag == "title":
            self.title_parts = []

    def handle_data(self, data):
        if self.title_parts is not None:
            self.title_parts.append(data)

    def handle_endtag(self, tag):
        if tag == "title" and self.title_parts is not None:
            self.titles.append(" ".join("".join(self.title_parts).split()))
            self.title_parts = None


def parse_listing(html):
    parser = ListingLinks()
    parser.feed(html.decode("utf-8-sig"))
    parser.close()
    return parser


def strict_json(raw):
    def unique(pairs):
        result = dict(pairs)
        require(len(result) == len(pairs), "duplicate JSON evidence fields")
        return result

    return json.loads(raw, object_pairs_hook=unique)


def exact_attachment(html, listing, artifact):
    """Resolve actual anchors against the requested listing, ignoring text and base tags."""
    return any(urljoin(listing, href) == artifact for href in parse_listing(html).hrefs)


def observed_cover(observation, identity):
    fields = set(IDENTITY_FIELDS)
    if identity["editionType"] == "national":
        fields.add("variant")
    return (isinstance(observation, dict) and set(observation) == fields
            and all(type(observation[key]) is type(identity[key]) and observation[key] == identity[key] for key in fields))


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


def component_findings(reference, candidate):
    require(set(reference) == set(candidate) == COMPARISON_FIELDS, "incomplete comparison components")
    for parts in (reference, candidate):
        require(isinstance(parts["stem"], str) and parts["stem"].strip(), "missing question stem")
        require(all(isinstance(parts[key], list) and all(isinstance(text, str) and text.strip() for text in parts[key])
                    for key in COMPARISON_FIELDS - {"stem", "visuals"}), "invalid comparison component content")
        require(isinstance(parts["visuals"], list) and all(
            set(asset) == {"id", "page", "sha256"} and FIGURE_ID.fullmatch(asset["id"])
            and type(asset["page"]) is int and SHA256.fullmatch(asset["sha256"]) for asset in parts["visuals"]
        ), "invalid comparison visual content")
    return {field: "matches" if reference[field] == candidate[field] else "differs"
            for field in sorted(COMPARISON_FIELDS)}


def comparison_result(comparisons, paper_id, expected, located, inventory, source_sha, read_local):
    if comparisons is None:
        return set(), set(), [], [], {}
    require(isinstance(comparisons, list), "invalid comparison records")
    compared, matched, conflicts, missing, findings = set(), set(), [], [], {}
    seen = set()
    items = {item["id"]: item for item in inventory}
    for entry in comparisons:
        require(set(entry) == {"id", "sourceSha256", "candidateSha256", "referenceSha256",
                              "decision", "differences", "review"}, "invalid question comparison evidence")
        qid = entry["id"]
        require(QUESTION_ID.fullmatch(qid) and qid not in seen, "duplicate or invalid question comparison")
        seen.add(qid)
        if qid not in located or entry["sourceSha256"] != source_sha:
            conflicts.append(qid)
            continue
        try:
            result = compare_question(entry, paper_id, expected[qid], items[qid], read_local)
        except (ValueError, TypeError, KeyError, AttributeError, OSError):
            conflicts.append(qid)
            continue
        if result is None:
            missing.append(qid)
            continue
        fields, decision = result
        findings[qid] = {"fields": fields, "decision": decision,
                          "reviewerId": entry["review"]["reviewerId"],
                         "candidateAuthorId": entry["review"]["scope"]["candidateAuthorId"]}
        if decision == "abstained":
            continue
        compared.add(qid)
        if decision == "match":
            matched.add(qid)
        else:
            conflicts.append(qid)
    return compared, matched, conflicts, missing, findings


def compare_question(entry, paper_id, locator, item, read_local):
    qid = entry["id"]
    base = f"comparisons/{paper_id}/{qid}"
    candidate_raw = read_local(f"{base}.json")
    reference_raw = read_local(f"{base}.source.json")
    if candidate_raw is None or reference_raw is None:
        return None
    digests = {key: hashlib.sha256(data).hexdigest() for key, data in (
        ("candidateSha256", candidate_raw), ("referenceSha256", reference_raw))}
    require(all(entry[key] == value for key, value in digests.items()), "comparison artifact drift")
    question = {"paperId": paper_id, "questionId": qid}
    anchor = {**question, "sourceSha256": entry["sourceSha256"], "stemPage": locator["stemPage"],
              "pages": sorted(locator["pages"])}
    ref, candidate = strict_json(reference_raw), strict_json(candidate_raw)
    review_scope = {**anchor, **digests, "purpose": "question_comparison",
                    "candidateAuthorId": candidate["authorId"], "independence": "independent_source_transcription"}
    require(scoped_review(entry["review"], review_scope, digests["referenceSha256"]),
            "unbound comparison review")
    require(set(ref) == {"schemaVersion", "anchor", "reviewerId", "components"}
            and type(ref["schemaVersion"]) is int and ref["schemaVersion"] == 1 and ref["anchor"] == anchor
            and type(ref["anchor"]["stemPage"]) is int and all(type(n) is int for n in ref["anchor"]["pages"])
            and ref["reviewerId"] == entry["review"]["reviewerId"], "invalid source-page reference")
    require(set(candidate) == {"schemaVersion", "paperId", "questionId", "authorId", "components"}
            and type(candidate["schemaVersion"]) is int and candidate["schemaVersion"] == 1
            and all(candidate[key] == value for key, value in question.items())
            and PERSON_ID.fullmatch(candidate["authorId"])
            and candidate["authorId"] != ref["reviewerId"], "comparison reviewer is not independent")
    fields = component_findings(ref["components"], candidate["components"])
    visuals = ref["components"]["visuals"]
    require({(v["id"], v["page"]) for v in visuals} == locator["figures"] and len(visuals) == len(locator["figures"])
            and len(ref["components"]["options"]) == item["options"]
            and len(ref["components"]["subparts"]) == item["numberedParts"]
            and (item["notation"] != "seen" or ref["components"]["symbols"] or ref["components"]["formulas"]),
            "reference omits source components")
    for side, values in (("source", visuals), ("candidate", candidate["components"]["visuals"])):
        for asset in values:
            raw = read_local(f"{base}.{side}.{asset['id']}.p{asset['page']}")
            if raw is None:
                return None
            require(hashlib.sha256(raw).hexdigest() == asset["sha256"], "unbound visual bytes")
    differences = {field for field, status in fields.items() if status == "differs"}
    require(isinstance(entry["differences"], dict) and set(entry["differences"]) == differences
            and all(isinstance(note, str) and note.strip() for note in entry["differences"].values()),
            "differences were not reviewed")
    decision = entry["decision"]
    require(decision == "abstained" or decision == ("mismatch" if differences else "match"),
            "review conclusion contradicts component findings")
    return fields, decision


def accepted_scope(target_ids, papers):
    """The versioned acceptance cohort is separate from discovery inventories."""
    required = set(target_ids)
    require(required and len(required) == len(target_ids), "empty or duplicate phase target roster")
    present = required & papers.keys()
    missing = sorted(required - present)
    blocked = sorted(i for i in present if any(papers[i][gate] != "passed" for gate in GATES))
    observed = sum(papers[i]["expectedQuestions"] or 0 for i in present)
    denominator = observed if not missing and all(papers[i]["expectedQuestions"] is not None for i in present) else None
    return {
        "complete": not missing and not blocked and bool(denominator),
        "targetPapers": len(required),
        "papersWithWitness": len(present),
        "papersPassingAllGates": len(present) - len(blocked),
        "missingPaperIds": missing,
        "outsideTargetIds": sorted(papers.keys() - required),
        "blockedPaperIds": blocked,
        "expectedQuestionsInReviewedWitnesses": observed,
        "phaseQuestionDenominator": denominator,
    }
