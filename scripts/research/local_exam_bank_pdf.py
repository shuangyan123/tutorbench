"""Local PDF extraction and source-fidelity crops for the exam bank."""
from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO
from pathlib import Path
import re

import pdfplumber
import pypdfium2

START = re.compile(r"^\s*(\d{1,2})(?:\s*[.．、](?=\D|$|\d{4}\s*年)|\s*(?=[(（])|"
                   r"\s+(?=已知|设|若|如图|在|根据|向|某|当|函数|曲线|集合))")
SECTION = re.compile(r"^[一二三四五六]\s*[、.．]")
ANSWER = re.compile(r"【\s*(?:参考)?答案\s*】|^\s*(?:参考)?答案\s*[:：]")
ANALYSIS = re.compile(r"(?:【\s*(?:详解|解析|分析|点睛)\s*】|(?:详解|解析|分析)\s*[:：])")
NUMBERED_KEY = re.compile(r"【\s*(\d{1,2})\s*题答案\s*】")
CHOICE = re.compile(r"(?<![A-Za-z])([A-DＡ-Ｄ])\s*[.．、](?!\d)\s*")
SUBPART = re.compile(r"^\s*[(（]\s*(\d{1,2}|[ivx]+|[ⅰ-ⅹ]+)\s*[)）]")
KEY_ROW = re.compile(r"(?<![\w.])(\d{1,2})\s*[.．、]\s*([A-D]{1,4})(?![A-Za-z])")
KEY_RANGE = re.compile(r"(?<![\d-])(\d{1,2})\s*[-–—~～至]\s*(\d{1,2})\s+([A-D]+)(?![A-Za-z])")
PROOF_START = re.compile(r"^\s*(?:[（(][^)）]+[）)]\s*)?(?:由题意(?:及.{0,20})?证明如下|证明如下|证明[:：])")
KEY_HEADING = re.compile(r"^(?:参考答案|参考解答|答案与解析)(?:\s|$|[:：])|^.*考试.*[·•]\s*答案\s*$")
FOOTER = re.compile(r"学科网[（(]北京|第\s*\d+\s*页\s*(?:共|/)|公众号|关注.*获取|^第\s*\d+\s*页$")

@dataclass(frozen=True)
class Line:
    page: int
    x0: float
    top: float
    x1: float
    bottom: float
    text: str

@dataclass(frozen=True)
class PdfPage:
    width: float
    height: float
    lines: tuple
    images: tuple

@dataclass(frozen=True)
class Document:
    pages: tuple

    @property
    def lines(self):
        return [line for p in self.pages for line in p.lines]

def load_pdf(raw):
    if not raw.startswith(b"%PDF-") or not raw.rstrip().endswith(b"%%EOF"):
        raise ValueError("invalid PDF signature or EOF")
    with pdfplumber.open(BytesIO(raw)) as pdf:
        pages = []
        for i, page in enumerate(pdf.pages, 1):
            lines = tuple(
                Line(i, row["x0"], row["top"], row["x1"], row["bottom"], row["text"].strip())
                for row in page.extract_text_lines(layout=False, strip=True, return_chars=False)
                if row["text"].strip() and not FOOTER.search(row["text"].strip())
            )
            images = tuple((obj["x0"], obj["top"], obj["x1"], obj["bottom"]) for obj in page.images
                           if obj["width"] >= 12 and obj["height"] >= 10)
            pages.append(PdfPage(page.width, page.height, lines, images))
    if not pages:
        raise ValueError("no PDF pages")
    return Document(tuple(pages))

def start_number(line):
    match = START.match(line.text)
    return int(match[1]) if match else None

def paper_body(lines):
    heading = next((i for i, line in enumerate(lines) if SECTION.match(line.text)
                    and any(word in line.text for word in ("选择", "单选"))), None)
    first = next((i for i, line in enumerate(lines) if start_number(line) == 1
                  and len(line.text) >= 10), None)
    return heading + 1 if heading is not None and (first is None or heading <= first + 15) else 0

def starts_for(lines, count, *, body=0, overrides=None, allow_number_only=False):
    """Accept a single plausible start, then stop any ambiguous span from swallowing a neighbour."""
    overrides = overrides or {}
    result, duplicates = {}, {}
    for i in range(body, len(lines)):
        line = lines[i]
        n = start_number(line)
        if n is None or not 1 <= n <= count or (len(line.text) < 4 and not allow_number_only):
            continue
        if n in result:
            duplicates.setdefault(n, []).append(i)
        else:
            result[n] = i
    for number, location in overrides.items():
        number = int(number)
        candidates = [i for i, line in enumerate(lines) if line.page == location[0] and abs(line.top - location[1]) < 2]
        if len(candidates) != 1 or not 1 <= number <= count:
            raise ValueError(f"question override not unique for {number}")
        result[number] = candidates[0]
        duplicates.pop(number, None)
    # 排除误读的非递增编号。多个候选时优先采用相邻题号之间唯一的一个。
    for n in sorted(result):
        lower = result.get(n - 1, body - 1)
        upper = result.get(n + 1, len(lines))
        candidates = [i for i in [result[n], *duplicates.get(n, [])] if lower < i < upper]
        if len(candidates) == 1:
            result[n] = candidates[0]
    return result

def structured_parts(lines):
    positions = [(i, m) for i, line in enumerate(lines) if (m := SUBPART.match(line))]
    roots, parent = [], None
    for j, (i, m) in enumerate(positions):
        end = positions[j + 1][0] if j + 1 < len(positions) else len(lines)
        item = {"label": m[1], "text": "\n".join([lines[i][m.end():].lstrip(), *lines[i + 1:end]]).strip(),
                "subparts": []}
        if not m[1].isdigit() and parent is not None:
            parent["subparts"].append(item)
        else:
            roots.append(item)
            parent = item if m[1].isdigit() else None
    return roots

def extract_fields(lines):
    text = "\n".join(line.text for line in lines)
    stem = START.sub("", text, count=1).strip()
    choices = list(CHOICE.finditer(stem))
    options = [{"label": chr(ord(m[1]) - 0xFEE0) if m[1] in "ＡＢＣＤ" else m[1],
                "text": stem[m.end():choices[i + 1].start() if i + 1 < len(choices) else len(stem)].strip()}
               for i, m in enumerate(choices)]
    by_line = stem.splitlines()
    parts = structured_parts(by_line)
    first_part = next((i for i, line in enumerate(by_line) if SUBPART.match(line)), None)
    stop = choices[0].start() if choices else len(stem)
    if first_part is not None:
        stop = min(stop, len("\n".join(by_line[:first_part])))
    return {"stem": stem[:stop].strip(), "conditions": [], "symbols": [], "formulas": [],
            "units": [], "options": options, "subparts": parts, "nativeText": stem}

def source_spans(document, first, end, *, extra=()):
    lines = document.lines
    a, b = lines[first], lines[end] if end < len(lines) else None
    spans = []
    for number in range(a.page, (b.page if b else lines[-1].page) + 1):
        page = document.pages[number - 1]
        top = max(0, a.top - 7) if number == a.page else 0
        bottom = min(page.height, b.top - 2) if b and number == b.page else page.height
        content = [line for line in lines[first:end] if line.page == number]
        images = [box for box in page.images if box[1] >= top and box[3] <= bottom]
        if b and number == b.page and number != a.page and not content and not images:
            continue
        if bottom > top + 2:
            spans.append((number, (0, top, page.width, bottom)))
    return [*extra, *spans]

def range_end(lines, start, stop):
    for i in range(start + 1, stop):
        if SECTION.match(lines[i].text) or re.match(r"^\s*(?:参考答案|答案与解析|试题解析)\s*$", lines[i].text):
            return i
        if lines[i].text.startswith(("阅读下列材料", "阅读材料，完成")):
            return i
    return stop

class CropStore:
    def __init__(self, root):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.current = None
        self.pages = {}

    def close(self):
        for image in self.pages.values():
            image.close()
        self.pages = {}
        if self.current:
            self.current[1].close()
            self.current = None

    def crop(self, file_sha, raw, number, box):
        if self.current is None or self.current[0] != file_sha:
            self.close()
            self.current = file_sha, pypdfium2.PdfDocument(raw)
        if number not in self.pages:
            pdf_page = self.current[1][number - 1]
            bitmap = pdf_page.render(scale=2.5)
            self.pages[number] = bitmap.to_pil().copy()
            bitmap.close()
            pdf_page.close()
        image = self.pages[number]
        rounded = tuple(round(v, 2) for v in box)
        pixel = tuple(round(v * 2.5) for v in rounded)
        rendered = image.crop(pixel)
        asset_id = sha256(f"{file_sha}:{number}:{rounded}".encode()).hexdigest()
        path = self.root / f"{asset_id}.png"
        with BytesIO() as out:
            rendered.save(out, format="PNG")
            png = out.getvalue()
        rendered.close()
        path.write_bytes(png)
        return {"page": number, "bboxPt": list(rounded), "path": f"assets/{path.name}",
                "sha256": sha256(png).hexdigest(), "sourceSha256": file_sha}
