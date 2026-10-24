"""Build specimens.js for the Spectrum prototype from the public case data.

Reads website/dist/public-data/cases.json (public case inputs only, no rubrics or scores)
and writes one entry per cross-locale situation, in English case order.
Run from the repo root:  python3 website/prototypes/spectrum/tools/build-specimens.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[4]
SRC = ROOT / "website/dist/public-data/cases.json"
OUT = ROOT / "website/prototypes/spectrum/specimens.js"

data = json.loads(SRC.read_text(encoding="utf-8"))
cases = data["cases"]
zh = {c["crossLocaleGroupId"]: c for c in cases if c["locale"] == "zh-CN"}
out = []
for c in cases:
    if c["locale"] != "en":
        continue
    m = c["metadata"]
    z = zh.get(c["crossLocaleGroupId"])
    entry = {
        "id": c["id"],
        "subject": m["subject"],
        "level": m["difficulty"]["learnerLevel"],
        "state": m["studentState"],
        "task": m["learningTask"],
        "diff": [m["difficulty"]["taskDifficulty"], m["difficulty"]["pedagogicalDifficulty"]],
        "caps": m["capabilityTags"],
        "en": {"topic": m["topic"], "msg": c["tutorInput"]["studentMessage"], "caseId": c["id"]},
    }
    if z:
        entry["zh"] = {"topic": z["metadata"]["topic"], "msg": z["tutorInput"]["studentMessage"], "caseId": z["id"]}
    out.append(entry)

head = (
    "/* global window */\n"
    "// Generated from website/dist/public-data/cases.json ("
    + data["datasetId"] + "@" + data["datasetVersion"]
    + "). Public case inputs only.\n"
    "// caps = the case's capability tags: what it is built to measure, not a score.\n"
)
OUT.write_text(head + "window.SPECIMENS = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
print(len(out), "situations ->", OUT.relative_to(ROOT))
