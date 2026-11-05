"""Build and query the private TutorBench exam bank without running a verifier."""
import argparse
from collections import defaultdict
import csv
from difflib import SequenceMatcher
from hashlib import sha256
import json
from pathlib import Path
import re
import shutil
import sys

from local_exam_bank_pdf import (
    ANALYSIS, ANSWER, KEY_HEADING, KEY_RANGE, KEY_ROW, NUMBERED_KEY, PROOF_START, SECTION, CropStore, extract_fields,
    load_pdf, paper_body, range_end, source_spans, start_number, starts_for, structured_parts,
)

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = ROOT / "data/private"
ASSUMED = "user_supplied_assumed_correct"
STATES = (ASSUMED, "verified", "disputed", "abstained")
YEARS = tuple(range(2022, 2027))
SUBJECTS = {"数学": "math", "物理": "physics", "化学": "chemistry", "生物": "biology"}
SCIENCE = {"physics": (15, 16, 15, 15, 16), "chemistry": (17, 17, 17, 17, 17),
           "biology": (24, 23, 24, 24, None)}
KNOWN_2026 = {
    "1781145049_2949.pdf": ("gaokao-2026-national-1", "combined", 4,
                         "fe7e5d0b4031d50c85a34d98a6ddecbc7bb4b955a0f3a6afc37e10e7576e6cbd"),
    "1786439828_2819.pdf": ("gaokao-2026-jiangsu-physics", "combined", 6,
                         "8a7f8ff542c0d26460ea173667c0afe531a78215afef84031a22dcb82e348726"),
    "1786440075_2071.pdf": ("gaokao-2026-jiangsu-chemistry", "question", None,
                         "cab64ff71efd5a7db03d1a41b1f0ed645036c5dd7abdf92632c259f272f5122d"),
    "1786440103_4125.pdf": ("gaokao-2026-jiangsu-chemistry", "answer", None,
                         "00b720cc08ec9da30fae44dea53b6b634f2181a8355e86f69f13fdd651473665"),
}
EXTENSIONS = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".tif", ".tiff"}
LAYOUTS = ROOT / "fixtures/research/local-exam-bank-layout-2022-2026.json"

def roster():
    catalog = read_json(ROOT / "fixtures/research/exam-source-expansion-2022-2026-v0.1.json")
    target = {}
    for paper in catalog["papers"]:
        pid, year = paper["paperId"], paper["year"]
        variant = pid.removeprefix(f"gaokao-{year}-")
        if paper["exam"] == "gaokao" and year in YEARS and variant.startswith(("national-", "new-gaokao-")):
            count = 23 if variant.endswith(("humanities", "science")) else 22 if year <= 2023 else 19
            target[pid] = paper_meta(pid, year, "math", variant, count)
    for subject, counts in SCIENCE.items():
        for year, count in zip(YEARS, counts):
            pid = f"gaokao-{year}-jiangsu-{subject}"
            target[pid] = paper_meta(pid, year, subject, "jiangsu-selection", count)
    return target

def paper_meta(pid, year, subject, edition, count):
    return {"paperId": pid, "exam": "gaokao", "session": "regular", "year": year,
            "subject": subject, "edition": edition, "expectedQuestions": count}

def classify(name):
    if name in KNOWN_2026:
        return KNOWN_2026[name][:3]
    match = re.match(r"^(202[2-6])年高考(数学|物理|化学|生物)试卷", name)
    if not match:
        return None
    year, subject = int(match[1]), SUBJECTS[match[2]]
    role = ("question" if "空白卷" in name else "annotated" if "解析卷" in name else
            "answer" if "答案" in name else None)
    if not role:
        return None
    if subject != "math":
        return (f"gaokao-{year}-jiangsu-{subject}", role, None) if "江苏" in name else None
    if "全国甲卷" in name or "全国乙卷" in name:
        track = "humanities" if "（文）" in name else "science" if "（理）" in name else None
        edition = "national" if year == 2024 else "national-a" if "甲卷" in name else "national-b"
        return (f"gaokao-{year}-{edition}-{track}", role, None) if track else None
    label = re.search(r"(?:新高考|新课标|全国)(Ⅰ|Ⅱ)卷", name)
    if label:
        family = "new-gaokao" if year <= 2024 else "national"
        return f"gaokao-{year}-{family}-{1 if label[1] == 'Ⅰ' else 2}", role, None
    return None

def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))

def write_json(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def normalized(s):
    return re.sub(r"[^0-9A-Za-z\u3400-\u9fff]", "", s)

def similarity(a, b):
    a, b = normalized(a)[:56], normalized(b)[:56]
    if min(len(a), len(b)) < 8:
        return 0
    return SequenceMatcher(None, a, b, autojunk=False).ratio()

def identity_conflict(lines, paper):
    cover = "".join(line.text for line in lines[:6]).replace(" ", "")
    years = re.findall(r"20\d{2}(?=年|生物)", cover)
    if years and str(paper["year"]) not in years:
        return "cover_year_conflict"
    subject = next(key for key, value in SUBJECTS.items() if value == paper["subject"])
    if "江苏" in cover and paper["subject"] != "math" and subject not in cover:
        return "cover_subject_conflict"
    if paper["edition"].endswith("humanities") and "理科" in cover or (
            paper["edition"].endswith("science") and "文科" in cover):
        return "cover_track_conflict"
    return None

def scan(source, targets, out):
    records, groups = [], defaultdict(list)
    for path in sorted(source.rglob("*"), key=lambda p: p.relative_to(source).as_posix()):
        if not path.is_file() or path.suffix.lower() not in EXTENSIONS:
            continue
        relative = path.relative_to(source).as_posix()
        hinted = classify(path.name)
        year_hit = re.search(r"(?<!\d)(202[2-6])(?!\d)", path.name)
        if not hinted and not year_hit and path.parent != source:
            continue
        if hinted and hinted[0] not in targets or year_hit and int(year_hit[1]) not in {p["year"] for p in targets.values()}:
            continue
        raw = path.read_bytes()
        digest = sha256(raw).hexdigest()
        row = {"input": relative, "paperId": hinted[0] if hinted else None, "role": hinted[1] if hinted else None,
               "sha256": digest, "bytes": len(raw), "format": path.suffix.lower().lstrip(".")}
        records.append(row)
        if hinted is None or hinted[0] not in targets or path.suffix.lower() != ".pdf":
            row["status"] = "unsupported_format" if path.suffix.lower() != ".pdf" else "unidentified"
            continue
        pid, role, limit = hinted
        if path.name in KNOWN_2026 and digest != KNOWN_2026[path.name][3]:
            row["status"] = "pinned_2026_hash_changed"
            continue
        try:
            doc = load_pdf(raw)
        except Exception as error:  # 解析失败保留记录，不能计为已导入。
            row.update(status="unreadable", error=type(error).__name__)
            continue
        row.update(pages=len(doc.pages), textPages=sum(bool(page.lines) for page in doc.pages),
                   pdfType="mixed" if doc.lines and any(p.images for p in doc.pages) else
                   "text" if doc.lines else "scan_or_image_only")
        conflict = identity_conflict(doc.lines, targets[pid])
        if conflict or not doc.lines:
            row["status"] = conflict or "needs_manual_transcription"
            continue
        dst = out / "sources" / f"{digest}.pdf"
        if not dst.exists() or sha256(dst.read_bytes()).hexdigest() != digest:
            dst.write_bytes(raw)
        row.update(status="readable", localPath=f"sources/{digest}.pdf")
        groups[pid].append((row, raw, doc, limit))
    return records, groups

def as_questions(doc, limit=None):
    if limit:
        return type(doc)(doc.pages[:limit])
    lines = doc.lines
    stop = next((i for i, l in enumerate(lines)
                 if i > 15 and KEY_HEADING.match(l.text)), None)
    if stop is None:
        return doc
    # 同一物理页内出现答案标题时也裁断题面。
    cut = lines[stop]
    pages = list(doc.pages[:cut.page])
    page = pages[-1]
    pages[-1] = type(page)(page.width, page.height, tuple(l for l in page.lines if l.top < cut.top), page.images)
    return type(doc)(tuple(pages))

def starts(doc, count, overrides=None):
    lines = doc.lines
    return starts_for(lines, count, body=paper_body(lines), overrides=overrides)

def plausible_end(lines, locs, number):
    start = locs[number]
    following = [i for n, i in locs.items() if n > number and i > start]
    stop = min(following, default=len(lines))
    return range_end(lines, start, stop)

def shared_prompt(doc, number):
    lines = doc.lines
    for i, line in enumerate(lines):
        if not line.text.startswith(("阅读下列材料", "阅读材料")):
            continue
        match = re.search(r"(\d{1,2})\s*[-—–~～至]\s*(\d{1,2})\s*题", line.text)
        if not match or not int(match[1]) <= number <= int(match[2]):
            continue
        end = next((j for j in range(i + 1, len(lines)) if start_number(lines[j]) == int(match[1])), None)
        if end is not None:
            return source_spans(doc, i, end), "\n".join(l.text for l in lines[i:end])
    return [], None

def pilot_components(pilot, pid, n, digest):
    if not pilot or not (pilot / "inventory.json").is_file():
        return None
    for entry in read_json(pilot / "inventory.json")["items"]:
        anchor = entry["anchor"]
        if anchor["paperId"] == pid.replace("gaokao-2026-jiangsu-", "pilot-jiangsu-2026-") and (
                int(anchor["questionId"].split(".")[1]) == n and anchor["sourceSha256"] == digest):
            path = pilot / entry["candidate"]
            if sha256(path.read_bytes()).hexdigest() != entry["candidateSha256"]:
                raise ValueError("pilot candidate hash mismatch")
            return read_json(path)["components"]
    return None

def question_type(lines, position, fields):
    heading = next((i for i in range(position - 1, -1, -1)
                    if SECTION.match(lines[i].text)), None)
    if heading is not None:
        title = lines[heading].text
        text = "".join(l.text for l in lines[heading:min(position, heading + 2)])
        if "非选择" in title or "解答题" in title:
            return "constructed_response"
        if "填空" in title:
            return "fill_in"
        if "多项" in title or "多选" in title or "有多项" in text:
            return "multiple_choice"
        if "单项" in title or "单选" in title or any(word in text for word in ("只有一项", "只有一个")):
            return "single_choice"
    return "choice_unspecified" if fields["options"] else "unknown"

def image_locations(doc, assets):
    return [{"page": r["page"], "bboxPt": [round(value, 2) for value in box], "displayRegion": r["path"]}
            for r in assets for box in doc.pages[r["page"] - 1].images
            if box[1] >= r["bboxPt"][1] and box[3] <= r["bboxPt"][3]]

def question_records(paper, selection, crops, pilot, overrides):
    row, raw, doc, limit = selection
    doc = as_questions(doc, limit)
    lines = doc.lines
    count = paper["expectedQuestions"]
    layout = overrides.get(row["sha256"], {})
    locs = starts(doc, count, layout.get("questions"))
    questions = {}
    for n in sorted(locs):
        i = locs[n]
        if n > 1 and locs.get(n - 1, -1) >= i or n < count and locs.get(n + 1, len(lines)) <= i:
            continue
        end = plausible_end(lines, locs, n)
        if end <= i:
            continue
        issues = list(layout.get("issues", []))
        if n < count and n + 1 not in locs:
            issues.append("following_question_boundary_uncertain")
        if not lines[i].text or end <= i:
            continue
        assets, shared_text = shared_prompt(doc, n)
        spans = source_spans(doc, i, end)
        assets = [crops.crop(row["sha256"], raw, page, box) for page, box in [*assets, *spans]]
        if not assets:
            continue
        fields = extract_fields(lines[i:end])
        if shared_text:
            fields["sharedText"] = shared_text
        candidate = pilot_components(pilot, paper["paperId"], n, row["sha256"])
        if candidate:
            fields.update({k: v for k, v in candidate.items() if k not in {"visuals", "options", "subparts"}})
            fields["options"] = [{"label": entry[0], "text": entry[2:].strip()} for entry in candidate["options"]]
            fields["subparts"] = structured_parts("\n".join(candidate["subparts"]).splitlines())
        else:
            # 图像是保真的展示层。自动文字和公式的结构仍可能丢失。
            issues.append("native_text_formula_or_layout_not_reviewed")
        if "\ufffd" in fields["nativeText"] or re.search(r"[\ue000-\uf8ff]", fields["nativeText"]):
            if not candidate:
                issues.append("unmapped_pdf_glyphs")
        questions[n] = {
            **{k: paper[k] for k in ("paperId", "exam", "year", "subject", "edition", "session")},
            "questionId": f"{paper['paperId']}/q{n:02}", "number": n,
            "questionStatus": "disputed" if "edition_numbering_conflict" in issues else ASSUMED,
            "questionType": question_type(lines, i, fields),
            "source": {"sha256": row["sha256"], "localPath": row["localPath"], "stemPage": lines[i].page,
                       "pages": sorted({a["page"] for a in assets}), "numberAsPrinted": n},
            "transcriptionStatus": "pilot_visual_transcription" if candidate else "needs_manual_transcription",
            "issues": issues, "fields": fields, "displayRegions": assets, "imageLocations": image_locations(doc, assets),
        }
    return questions, doc, locs

def add_answers(questions, answer_sets, paper, crops, overrides):
    found = defaultdict(list)
    unresolved = set()
    for row, raw, doc, limit in answer_sets:
        if row["role"] == "question":
            continue
        for n, result in answer_records(row, raw, doc, limit, paper, questions, crops, overrides).items():
            if result:
                found[n].append(result)
            else:
                unresolved.add(n)
    for n, item in questions.items():
        candidates = list({(c["sourceSha256"], c["locator"]): c for c in found[n]}.values())
        if len(candidates) == 1:
            item["answer"] = {"pairing": "matched", "status": ASSUMED, **candidates[0]}
        elif candidates:
            item["answer"] = {"pairing": "multiple_candidates", "status": "disputed", "candidates": candidates}
        else:
            item["answer"] = {"pairing": "unreliable_number" if n in unresolved else "missing",
                              "status": "abstained"}

def key_entries(text):
    rows = list(KEY_ROW.finditer(text))
    if rows and not re.sub(r"[\s,，;；]+", "", KEY_ROW.sub("", text)):
        return [(int(m[1]), m[2]) for m in rows]
    ranges = list(KEY_RANGE.finditer(text))
    if ranges and not re.sub(r"[\s,，;；]+", "", KEY_RANGE.sub("", text)):
        return [(n, letter) for m in ranges if int(m[2]) - int(m[1]) + 1 == len(m[3])
                for n, letter in enumerate(m[3], start=int(m[1]))]
    return []

def same_prompt(question, lines):
    original = question["fields"]["nativeText"]
    repeated = extract_fields(lines)["nativeText"]
    if similarity((original.splitlines() or [""])[0], (repeated.splitlines() or [""])[0]) >= 0.60:
        return True
    # 分式题的第一行有时只有一个字。此时用整段题面与选项做第二次匹配。
    a = re.sub(r"\s+", "", original)[:160]
    b = re.sub(r"\s+", "", repeated)[:160]
    return min(len(a), len(b)) >= 18 and SequenceMatcher(None, a, b, autojunk=False).ratio() >= 0.84

def answer_records(row, raw, doc, limit, paper, questions, crops, overrides):
    lines = doc.lines
    count = paper["expectedQuestions"]
    anchor = {int(m[1]): i for i, line in enumerate(lines) if (m := NUMBERED_KEY.search(line.text))}
    numbered = bool(anchor)
    tail = next((i for i, line in enumerate(lines) if i > 15 and KEY_HEADING.match(line.text)), None)
    key_start = 0 if row["role"] == "answer" else tail
    table = {}
    if key_start is not None:
        for i in range(key_start, len(lines)):
            for n, choice in key_entries(lines[i].text):
                if 1 <= n <= count:
                    if n in table and table[n][1] != choice:
                        table[n] = (i, None)
                    elif n not in table:
                        table[n] = (i, choice)
        anchor = starts_for(lines, count, body=key_start,
                            overrides=overrides.get(row["sha256"], {}).get("answers"), allow_number_only=True)
    elif not numbered:
        anchor = starts(doc, count, overrides.get(row["sha256"], {}).get("answers"))
        candidates = defaultdict(list)
        for i in range(paper_body(lines), len(lines)):
            line = lines[i]
            n = start_number(line)
            if n in questions:
                text = questions[n]["fields"]["nativeText"].splitlines()[0]
                score = similarity(text, extract_fields([line])["nativeText"])
                if score >= 0.72:
                    candidates[n].append((score, i))
            match = ANSWER.search(line.text)
            if match and (entries := key_entries(line.text[match.end():])) and len(entries) > 1:
                for number, choice in entries:
                    if 1 <= number <= count:
                        table[number] = (i, choice) if number not in table else (i, None)
        for n, matches in candidates.items():
            if len(matches) == 1:
                anchor[n] = matches[0][1]
    result = {}
    for n, item in questions.items():
        if n in table:
            i, choice = table[n]
            if choice is None or item["questionType"] in {"constructed_response", "fill_in"} or (
                    item["questionType"] == "single_choice" and len(choice) != 1):
                result[n] = None
                continue
            end, begin = i + 1, i
            text, solution, method = choice, None, "explicit_numbered_key"
            solution_index, separation = None, "not_present"
        elif n in anchor:
            i = anchor[n]
            end = min((j for m, j in anchor.items() if m > n and j > i), default=len(lines))
            if numbered:
                begin, method = i, "explicit_numbered_answer"
            elif key_start is not None:
                begin, method = i, "answer_section_question_number"
                if not lines[i].text.startswith(f"{n}.") and start_number(lines[i]) != n:
                    result[n] = None
                    continue
            else:
                begin = next((j for j in range(i + 1, end) if ANSWER.search(lines[j].text)), None)
                if begin is None or not same_prompt(item, lines[i:begin]):
                    result[n] = None
                    continue
                method = "number_and_matching_prompt"
            body = "\n".join(l.text for l in lines[begin:end])
            split = ANALYSIS.search(body)
            text = body[:split.start()] if split else body
            text = NUMBERED_KEY.sub("", text)
            text = ANSWER.sub("", text.strip(), count=1).strip()
            solution_index = next((j for j in range(begin, end) if ANALYSIS.search(lines[j].text)), None)
            separation = "separated" if solution_index is not None else "not_present"
            if solution_index is None:
                solution_index = next((j for j in range(begin, end) if PROOF_START.match(lines[j].text)), None)
                if solution_index is not None:
                    separation = "interleaved"
            solution = ("\n".join(l.text for l in lines[solution_index:end])
                        if solution_index is not None else None)
            if not text and not solution:
                result[n] = None
                continue
        else:
            continue
        if (item["questionType"] == "single_choice" and re.fullmatch(r"[A-D]{2,4}", text)):
            result[n] = None
            continue
        regions = [crops.crop(row["sha256"], raw, page, box)
                   for page, box in source_spans(doc, begin, end)]
        if not regions:
            result[n] = None
            continue
        if solution_index is not None:
            solution_regions = [crops.crop(row["sha256"], raw, page, box)
                                for page, box in source_spans(doc, solution_index, end)]
        else:
            solution_regions = []
        result[n] = {"sourceSha256": row["sha256"], "localPath": row["localPath"], "locator": f"{lines[begin].page}:{lines[begin].top:.1f}",
                     "method": method, "nativeText": text, "solutionNativeText": solution,
                     "displayRegions": regions, "solutionRegions": solution_regions, "solutionSeparation": separation}
    return result


def content_fingerprint(entry, count):
    row, _, doc, limit = entry
    doc = as_questions(doc, limit)
    lines = doc.lines
    locs = starts(doc, count)
    if len(locs) < 5:
        return None
    # 保留选项和题目片段，去掉排版空白与文字层的字形私用码。
    return sha256("\n".join(
        re.sub(r"\s+", "", "".join(l.text for l in lines[i:plausible_end(lines, locs, n)]))
        for n, i in sorted(locs.items())
    ).encode()).hexdigest()

def choose_sources(entries, count):
    distinct, seen = [], {}
    for entry in entries:
        row = entry[0]
        key = (row["role"], row["sha256"])
        if key in seen:
            row.update(status="duplicate_bytes", duplicateOf=seen[key]["input"])
        else:
            seen[key] = row
            distinct.append(entry)
    roles = defaultdict(list)
    for entry in distinct:
        row = entry[0]
        role = row["role"]
        fingerprint = content_fingerprint(entry, count) if role in {"question", "annotated"} else None
        same = next((item[0] for item in roles[role] if fingerprint and item[0].get("contentFingerprint") == fingerprint), None)
        if same:
            row.update(status="duplicate_question_content", duplicateOf=same["input"], contentFingerprint=fingerprint)
        else:
            if fingerprint:
                row["contentFingerprint"] = fingerprint
            roles[role].append(entry)
    question = roles["question"] + roles["combined"]
    if not question:
        question = roles["annotated"]
    return question, roles["answer"] + roles["combined"] + roles["annotated"]

def bind_annotated_fallback(questions, source_doc, source_locs, answer_sets, paper, crops, pilot, overrides):
    if not questions:
        return
    count = paper["expectedQuestions"]
    missing = set(range(1, count + 1)) - questions.keys()
    source_lines = source_doc.lines
    for entry in answer_sets:
        row, raw, doc, _ = entry
        if row["role"] != "annotated" or not missing:
            continue
        lines = doc.lines
        locs = starts(doc, count, overrides.get(row["sha256"], {}).get("answers"))
        pairs = [(source_lines[source_locs[n]].text, lines[locs[n]].text)
                 for n in sorted(questions.keys() & locs.keys())]
        if sum(similarity(a, b) >= 0.65 for a, b in pairs) < 4:
            continue
        for n in sorted(missing & locs.keys()):
            i = locs[n]
            end = plausible_end(lines, locs, n)
            cut = next((j for j in range(i + 1, end) if ANSWER.search(lines[j].text)), None)
            if cut is None or (n < count and n + 1 not in locs):
                continue
            if n in source_locs:
                continue
            fields = extract_fields(lines[i:cut])
            assets = [crops.crop(row["sha256"], raw, page, box) for page, box in source_spans(doc, i, cut)]
            if not assets:
                continue
            questions[n] = {
                **{k: paper[k] for k in ("paperId", "exam", "year", "subject", "edition", "session")},
                "questionId": f"{paper['paperId']}/q{n:02}", "number": n, "questionStatus": ASSUMED,
                "questionType": question_type(lines, i, fields),
                "source": {"sha256": row["sha256"], "localPath": row["localPath"], "stemPage": lines[i].page,
                           "pages": sorted({a["page"] for a in assets}), "numberAsPrinted": start_number(lines[i])},
                "transcriptionStatus": "needs_manual_transcription",
                "issues": ["question_from_annotated_copy", "native_text_formula_or_layout_not_reviewed"],
                "fields": fields, "displayRegions": assets, "imageLocations": image_locations(doc, assets),
            }
            missing.remove(n)

def coverage_row(paper, entries, items):
    expected = paper["expectedQuestions"]
    present = {item["number"] for item in items}
    missing = sorted(set(range(1, expected + 1)) - present) if expected else []
    boundary = [item["number"] for item in items if "following_question_boundary_uncertain" in item["issues"]]
    count = len(items)
    conflict = any("edition_numbering_conflict" in x["issues"] for x in items)
    status = ("missing_material" if not entries else "unresolved" if not count else "edition_conflict" if conflict else
              "partial" if missing or boundary else "rendered")
    return {**paper, "status": status, "sourceFiles": len(entries), "indexedQuestions": count,
            "manualTranscriptionPending": sum(x["transcriptionStatus"] == "needs_manual_transcription" for x in items),
            "matchedAnswers": sum(x["answer"]["pairing"] == "matched" for x in items),
            "multipleAnswers": sum(x["answer"]["pairing"] == "multiple_candidates" for x in items),
            "unreliableAnswers": sum(x["answer"]["pairing"] == "unreliable_number" for x in items),
            "missingAnswers": sum(x["answer"]["pairing"] == "missing" for x in items),
            "questionsWithSourceRender": sum(bool(x["displayRegions"]) for x in items),
            "missingQuestionNumbers": ",".join(map(str, missing)),
            "uncertainBoundaries": ",".join(map(str, boundary))}

def build(args):
    out = args.out.resolve()
    if not out.is_relative_to(PRIVATE.resolve()) or out == PRIVATE.resolve():
        raise ValueError("build output must be below the ignored data/private directory")
    if out.exists():
        raise ValueError("use a new build directory so a failed import cannot overwrite an existing bank")
    source = args.source.resolve(strict=True)
    targets = {pid: row for pid, row in roster().items() if row["year"] in args.years}
    overrides = read_json(LAYOUTS)
    if args.overrides:
        overrides.update(read_json(args.overrides))
    (out / "sources").mkdir(parents=True)
    records, groups = scan(source, targets, out)
    questions, coverage = [], []
    crops = CropStore(out / "assets")
    try:
        for pid, paper in sorted(targets.items(), key=lambda pair: (-pair[1]["year"], pair[0])):
            entries = groups[pid]
            candidates, answers = choose_sources(entries, paper["expectedQuestions"])
            if candidates:
                selected = candidates[0]
                items, source_doc, source_locs = question_records(paper, selected, crops, args.pilot, overrides)
                selected[0]["status"] = "selected_question_source"
                for alternative in candidates[1:]:
                    alternative[0]["status"] = "alternative_question_version"
                bind_annotated_fallback(items, source_doc, source_locs, answers, paper, crops, args.pilot, overrides)
                add_answers(items, answers, paper, crops, overrides)
                ordered = [items[n] for n in sorted(items)]
                questions.extend(ordered)
            else:
                ordered = []
            row = coverage_row(paper, entries, ordered)
            coverage.append(row)
            print(pid, row["status"], row["indexedQuestions"], row["matchedAnswers"], flush=True)
    finally:
        crops.close()
    files_per_paper = defaultdict(int)
    for row in records:
        files_per_paper[row["paperId"]] += 1
    for row in coverage:
        row["sourceFiles"] = files_per_paper[row["paperId"]]
    bank = {"schemaVersion": 1, "kind": "tutorbench-private-exam-bank",
            "states": list(STATES), "papers": coverage, "questions": questions}
    write_json(out / "bank.json", bank)
    write_json(out / "file-inventory.json", records)
    write_json(out / "exceptions.json", [
        {"questionId": q["questionId"], "transcriptionStatus": q["transcriptionStatus"], "issues": q["issues"],
         "answerPairing": q["answer"]["pairing"]} for q in questions
        if q["issues"] or q["answer"]["pairing"] != "matched"
    ])
    with (out / "exam-coverage-2022-2026.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(coverage[0]))
        writer.writeheader()
        writer.writerows(coverage)
    with (out / "file-inventory.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=sorted({key for row in records for key in row}))
        writer.writeheader()
        writer.writerows(records)
    report = coverage_report(coverage, records)
    (out / "coverage-report.md").write_text(report, encoding="utf-8")
    viewer = ROOT / "scripts/research/local_exam_bank_viewer.html"
    shutil.copyfile(viewer, out / "index.html")
    # 单独 JS 数据文件使浏览器可直接打开 file://，没有本地服务器或远程资源。
    payload = json.dumps(bank, ensure_ascii=True, separators=(",", ":"))
    (out / "bank-data.js").write_text(f"globalThis.EXAM_BANK = {payload};\n", encoding="utf-8")

def coverage_report(rows, records):
    counts = {key: sum(row[key] for row in rows) for key in
              ("indexedQuestions", "manualTranscriptionPending", "matchedAnswers", "multipleAnswers",
               "unreliableAnswers", "missingAnswers", "questionsWithSourceRender")}
    known = sum(row["expectedQuestions"] or 0 for row in rows)
    unknown = sum(row["expectedQuestions"] is None for row in rows)
    complete = sum(row["status"] == "rendered" for row in rows)
    inventory = sum(row["sourceFiles"] > 0 for row in rows)
    return ("\n".join([
        "# 私有试题库覆盖报告", "",
        f"- 目标卷别 {len(rows)}，有材料 {inventory}，可定位渲染全部预期题号 {complete}。",
        f"- 文件记录 {len(records)}，已索引 {counts['indexedQuestions']} 道，原页裁切 {counts['questionsWithSourceRender']} 道。",
        f"- 预期题号分母中已知 {known} 道，另有 {unknown} 个缺卷或未知题数目标。",
        f"- 结构化草稿仍待人工转写 {counts['manualTranscriptionPending']} 道。",
        f"- 参考答案匹配 {counts['matchedAnswers']}/{counts['indexedQuestions']}。多个候选 {counts['multipleAnswers']}，"
        f"题号对应不可靠 {counts['unreliableAnswers']}，缺失 {counts['missingAnswers']}。",
        "- 参考答案状态仅为用户提供的工作假设。本阶段正式验证题目 0 道。", "",
        "| 年 | 卷别 | 学科 | 卷状态 | 题目数 | 参考答案匹配 | 缺题号 | 边界待核 |",
        "| --- | --- | --- | --- | ---: | ---: | --- | --- |",
        *[f"| {p['year']} | {p['edition']} | {p['subject']} | {p['status']} | {p['indexedQuestions']}/{p['expectedQuestions'] or '未知'} | "
          f"{p['matchedAnswers']} | {p['missingQuestionNumbers'] or '—'} | {p['uncertainBoundaries'] or '—'} |" for p in rows],
    ]) + "\n")

def find_items(bank, *, exam=None, year=None, subject=None, edition=None, number=None, question_id=None):
    filters = {"exam": exam, "year": year, "subject": subject, "edition": edition, "number": number, "questionId": question_id}
    return [q for q in bank["questions"] if all(value is None or q[key] == value for key, value in filters.items())]

def handoff(item):
    blocked = []
    if item["transcriptionStatus"] == "needs_manual_transcription":
        blocked.append("needs_manual_transcription")
    if item["answer"]["pairing"] != "matched":
        blocked.append(item["answer"]["pairing"])
    blocked.extend(issue for issue in item["issues"] if issue != "native_text_formula_or_layout_not_reviewed")
    return {"schemaVersion": 1, "kind": "tutorbench-correctness-input-candidate",
            "verificationStatus": "pending", "formalScoringEligible": False,
            "inputIssues": blocked, "item": item}

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    build_parser = commands.add_parser("build")
    build_parser.add_argument("--source", required=True, type=Path)
    build_parser.add_argument("--out", required=True, type=Path)
    build_parser.add_argument("--years", nargs="+", choices=YEARS, type=int, default=YEARS)
    build_parser.add_argument("--pilot", type=Path)
    build_parser.add_argument("--overrides", type=Path)
    for name in ("list", "get", "handoff"):
        query = commands.add_parser(name)
        query.add_argument("--bank", required=True, type=Path)
        query.add_argument("--exam", choices=("gaokao",))
        query.add_argument("--year", choices=YEARS, type=int)
        query.add_argument("--subject", choices=tuple(SUBJECTS.values()))
        query.add_argument("--edition")
        query.add_argument("--number", type=int)
        query.add_argument("--question-id")
    args = parser.parse_args(argv)
    try:
        if args.command == "build":
            build(args)
            return 0
        bank = read_json(args.bank)
        items = find_items(bank, exam=args.exam, year=args.year, subject=args.subject, edition=args.edition,
                           number=args.number, question_id=args.question_id)
        if args.command != "list" and len(items) != 1:
            raise ValueError(f"query must resolve exactly one question; found {len(items)}")
        result = ([{key: q[key] for key in ("questionId", "year", "subject", "edition", "number", "transcriptionStatus")}
                   for q in items] if args.command == "list" else
                  handoff(items[0]) if args.command == "handoff" else items[0])
        print(json.dumps(result, ensure_ascii=True, indent=2))
        return 0
    except (OSError, ValueError) as error:
        print(f"exam bank: {error}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
