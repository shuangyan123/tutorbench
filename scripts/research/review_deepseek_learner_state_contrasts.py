#!/usr/bin/env python3
"""Offline provenance audit, individual blind review and post-freeze comparison.

No API calls. Uses the original DeepSeek runner and immutable 10-case Tutor
input export; never assigns automatic teaching-quality grades or Gold.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import sys

import run_deepseek_learner_state_contrasts as study

PROTOCOL = "learner-state-contrast-semantic-review-v0.1"
ALLOWED = {
    "evidenceFit": {"PASS", "PARTIAL", "FAIL", "ABSTAIN"},
    "instructionalSupport": {"PASS", "PARTIAL", "FAIL", "ABSTAIN"},
    "unsupportedDiagnosis": {"NONE", "POSSIBLE", "CLEAR", "ABSTAIN"},
    "factualIntegrity": {"PASS", "PARTIAL", "FAIL", "ABSTAIN"},
}
FIELDS = tuple(ALLOWED)


class AuditError(ValueError):
    pass


def sha_bytes(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf8"))


def sha(value):
    return study.digest(value)


def safe_status(row):
    if row.get("status") == "ok":
        if (row.get("finishReason") != "stop"
            or not isinstance(row.get("finalText"), str)
            or not row["finalText"].strip()
            or sha_bytes(row["finalText"].encode("utf8")) != row.get("finalTextSha256")):
            raise AuditError("invalid_ok_response_or_text_hash")
    elif row.get("finalText") is not None:
        text = row["finalText"]
        if not isinstance(text, str) or sha_bytes(text.encode("utf8")) != row.get("finalTextSha256"):
            raise AuditError("invalid_nonok_text_hash")


def verified_rows(packet_path, paths, require_full=False):
    packet = study.load_packet(packet_path)
    by_id = {v["caseId"]: v for v in packet["cases"]}
    if not paths:
        raise AuditError("requires_at_least_one_saved_run")
    seen = set()
    results = []
    for path in paths:
        lines = Path(path).read_text(encoding="utf8").splitlines()
        if not lines:
            raise AuditError("empty_run_file")
        meta = json.loads(lines[0])
        if (meta.get("recordType") != "run_metadata"
            or meta.get("studyId") != study.STUDY_ID
            or meta.get("sourceVisibleSha256") != packet["sourceVisibleSha256"]
            or meta.get("packetSha256") != sha(packet)
            or meta.get("promptSha256") != study.sha_text(study.PROMPT)
            or meta.get("modelRequested") != study.MODEL
            or meta.get("maxTokens") != study.MAX_TOKENS
            or meta.get("effort") not in study.EFFORTS
            or meta.get("explicitLiveOptIn") is not True
            or meta.get("apiKeyStored") is not False
            or meta.get("responseContentOnly") is not True
            or meta.get("realStudentOutcomeMeasured") is not False):
            raise AuditError("run_metadata_not_bound_to_frozen_study")
        expected_case_ids = meta.get("caseIds")
        if (not isinstance(expected_case_ids, list) or not expected_case_ids
            or len(expected_case_ids) != len(set(expected_case_ids))
            or any(case_id not in by_id for case_id in expected_case_ids)):
            raise AuditError("invalid_run_case_scope")
        body = [json.loads(line) for line in lines[1:]]
        if [v.get("caseId") for v in body] != expected_case_ids:
            raise AuditError("run_case_ids_do_not_match_metadata")
        for row in body:
            key = (row["caseId"], meta["effort"])
            if key in seen:
                raise AuditError("duplicate_case_effort")
            seen.add(key)
            original = by_id[row["caseId"]]
            request = study.make_request(original, meta["effort"])
            if (row.get("recordType") != "case_result"
                or row.get("effort") != meta["effort"]
                or row.get("modelRequested") != study.MODEL
                or row.get("inputSha256") != original["inputSha256"]
                or row.get("messagesSha256") != sha(request["messages"])
                or row.get("requestSha256") != sha(request)
                or row.get("realHttpRequestAttempted") is not True
                or row.get("status") not in study.STATUSES
                or not isinstance(row.get("elapsedMs"), int)
                or row["elapsedMs"] < 0):
                raise AuditError("response_request_or_identity_mismatch")
            safe_status(row)
            results.append(row)
    expected = {(case_id, effort) for case_id in by_id for effort in study.EFFORTS}
    if require_full and seen != expected:
        raise AuditError(f"incomplete_attempts_{len(seen)}_of_{len(expected)}")
    return packet, results


def status_summary(rows):
    coverage = {}
    for effort in study.EFFORTS:
        selected = [x for x in rows if x["effort"] == effort]
        coverage[effort] = {
            "attempts": len(selected),
            "ok": sum(x["status"] == "ok" for x in selected),
            "nonOk": {k: v for k, v in sorted(Counter(
                x["status"] for x in selected if x["status"] != "ok").items())},
            "missingAttempts": 10 - len(selected),
        }
    return {
        "studyId": study.STUDY_ID, "mode": "offline_integrity_only",
        "attemptCoverage": f"{len(rows)}/20",
        "efforts": coverage,
        "learningOutcome": "not_measured",
        "gold": False, "humanAgreement": "not_measured",
        "automaticTeachingScore": None,
    }


GUIDE = """# 独立单条语义评审 — Learner State Contrast v0.1

这份任务只允许看学生已提供的对话信息与当前 Tutor 回复。
请**先完成全部单条评审**，再打开 operator-mapping.json 或逐对比较。
不得使用模型 High/Max 身份、作者预设诊断或此前的评论来预判。

四项互相独立的观察：
- evidenceFit: Tutor 是否根据学生**可观察证据**调整教学，且没有把猜测当作既成事实？PASS / PARTIAL / FAIL / ABSTAIN。
- instructionalSupport: 对该学生明确提出的问题，步骤与概念桥梁是否足够且不过度重复？PASS / PARTIAL / FAIL / ABSTAIN。
- unsupportedDiagnosis: 是否明确断言了无根据的错误原因、知识缺陷或长期掌握？NONE / POSSIBLE / CLEAR / ABSTAIN。
- factualIntegrity: 分数概念和数学推导是否正确？PASS / PARTIAL / FAIL / ABSTAIN。

选择 ABSTAIN 表示材料不足，不等于 FAIL。仅凭没有追问不能自动判 FAIL：
指出错误并给出简短正确示范也可能是合理教学。
直接给出正确答案不能自动判 PASS：还需考虑解释起点是否适合学生。
局部正确复述、口头定义、独立应用和持久掌握不得混同。
对于 PARTIAL / FAIL / POSSIBLE / CLEAR / ABSTAIN，请写证据依据。
备注可为中文原话，导入时逐字保留，不做文案修订。

本批次至多一位实际评审者，不是人际一致性，也不产生 Gold。
即使所有 20 条回复通过语义评审，也不能推断真实学生发生了学习增益。
"""


def export_blind(packet, rows, outdir, reviewer_id):
    if not reviewer_id or not reviewer_id.replace("-", "").replace("_", "").isalnum():
        raise AuditError("invalid_opaque_reviewer_id")
    ok = [r for r in rows if r["status"] == "ok"]
    by_id = {c["caseId"]: c for c in packet["cases"]}
    secret = secrets.token_hex(16)
    tasks, mapping = [], []
    for row in ok:
        identity = f"{secret}:{row['caseId']}:{row['effort']}:{row['finalTextSha256']}"
        task_id = "lr_" + sha_bytes(identity.encode("utf8"))[:20]
        original = by_id[row["caseId"]]["input"]
        tasks.append({
            "taskId": task_id,
            "learner": {
                "learningObjective": original.get("learningObjective"),
                "initialContext": original.get("initialContext"),
                "conversation": original["conversation"],
                "currentStudentMessage": original["currentStudentMessage"],
            },
            "tutorResponse": row["finalText"],
        })
        mapping.append({
            "taskId": task_id,
            "caseId": row["caseId"],
            "effort": row["effort"],
            "inputSha256": row["inputSha256"],
            "finalTextSha256": row["finalTextSha256"],
        })
    # Sort without revealing case adjacency or effort labels.
    tasks.sort(key=lambda x: x["taskId"])
    mapping.sort(key=lambda x: x["taskId"])
    fingerprint = sha({"protocol": PROTOCOL, "tasks": tasks})
    reviewer_packet = {
        "protocol": PROTOCOL,
        "reviewerId": reviewer_id,
        "taskSetFingerprint": fingerprint,
        "blinded": True,
        "tasks": tasks,
    }
    template = {
        "protocol": PROTOCOL,
        "reviewerId": reviewer_id,
        "taskSetFingerprint": fingerprint,
        "items": [{
            "taskId": task["taskId"],
            **{field: "UNRATED" for field in FIELDS},
            "evidence": "",
        } for task in tasks],
    }
    operator = {
        "protocol": PROTOCOL,
        "taskSetFingerprint": fingerprint,
        "packetSha256": sha(packet),
        "blindedTaskCount": len(tasks),
        "attemptStatus": status_summary(rows),
        "mapping": mapping,
        "notGold": True,
        "notHumanHumanAgreement": True,
    }
    path = Path(outdir)
    path.mkdir(parents=True, exist_ok=False)
    try:
        for name, value in (
            ("reviewer-packet.json", reviewer_packet),
            ("submission-template.json", template),
            ("operator-mapping.json", operator),
        ):
            dest = path / name
            fd = os.open(dest, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(fd, "w", encoding="utf8") as f:
                json.dump(value, f, ensure_ascii=False, indent=2)
                f.write("\n")
        (path / "REVIEWER-GUIDE.md").write_text(GUIDE, encoding="utf8")
    except Exception:
        shutil.rmtree(path)
        raise
    return {"dir": str(path), "reviewable": len(tasks),
            "attempted": len(rows), "taskSetFingerprint": fingerprint}


def import_review(packet_dir, submission_path, output_dir):
    directory = Path(packet_dir)
    reviewer_packet = read_json(directory / "reviewer-packet.json")
    operator = read_json(directory / "operator-mapping.json")
    original_bytes = Path(submission_path).read_bytes()
    submission = json.loads(original_bytes.decode("utf8"))
    tasks = reviewer_packet.get("tasks")
    if (reviewer_packet.get("protocol") != PROTOCOL or
        operator.get("protocol") != PROTOCOL or
        not isinstance(tasks, list) or
        sha({"protocol": PROTOCOL, "tasks": tasks}) != reviewer_packet.get("taskSetFingerprint") or
        reviewer_packet.get("taskSetFingerprint") != operator.get("taskSetFingerprint") or
        operator.get("blindedTaskCount") != len(tasks)):
        raise AuditError("tampered_or_wrong_review_packet")
    task_ids = {t["taskId"] for t in tasks}
    mapping = operator.get("mapping")
    if (not isinstance(mapping, list) or len(mapping) != len(tasks) or
        {x.get("taskId") for x in mapping} != task_ids):
        raise AuditError("tampered_operator_mapping")
    if (submission.get("protocol") != PROTOCOL or
        submission.get("taskSetFingerprint") != reviewer_packet["taskSetFingerprint"] or
        submission.get("reviewerId") != reviewer_packet.get("reviewerId") or
        not isinstance(submission.get("items"), list) or
        len(submission["items"]) != len(tasks)):
        raise AuditError("submission_protocol_identity_or_coverage")
    ids, results = set(), {}
    for entry in submission["items"]:
        if not isinstance(entry, dict) or set(entry) != {"taskId", *FIELDS, "evidence"}:
            raise AuditError("invalid_review_entry")
        task_id = entry.get("taskId")
        if task_id not in task_ids or task_id in ids:
            raise AuditError("unknown_or_duplicate_review_task")
        ids.add(task_id)
        if any(entry[k] not in ALLOWED[k] for k in FIELDS):
            raise AuditError("unrated_or_invalid_semantic_label")
        if not isinstance(entry["evidence"], str):
            raise AuditError("invalid_verbatim_evidence")
        if (any(entry[k] in {"FAIL", "PARTIAL", "ABSTAIN", "POSSIBLE", "CLEAR"} for k in FIELDS)
            and not entry["evidence"].strip()):
            raise AuditError("nonpass_rating_needs_evidence")
        results[task_id] = entry
    if ids != task_ids:
        raise AuditError("missing_review_items")
    # Strictly preserve every evidence string; do not normalize whitespace or quotes.
    rejoined = []
    for ref in mapping:
        data = results[ref["taskId"]]
        rejoined.append({
            "caseId": ref["caseId"], "effort": ref["effort"],
            "taskId": ref["taskId"],
            "inputSha256": ref["inputSha256"],
            **{field: data[field] for field in FIELDS},
            "evidence": data["evidence"],
        })
    rejoined.sort(key=lambda row: (row["caseId"], row["effort"]))
    # Descriptive labels, never a single fabricated "winner".
    table = {}
    for effort in study.EFFORTS:
        subset = [x for x in rejoined if x["effort"] == effort]
        table[effort] = {field: dict(Counter(x[field] for x in subset))
                         for field in FIELDS}
    paired = []
    for n in range(1, 6):
        pair_id = f"ls-v01-p{n:02d}"
        paired.append({
            "pairId": pair_id,
            "responses": [x for x in rejoined if x["caseId"].startswith(pair_id)],
        })
    output = {
        "protocol": PROTOCOL,
        "taskSetFingerprint": reviewer_packet["taskSetFingerprint"],
        "reviewerId": submission["reviewerId"],
        "originalSubmissionSha256": sha_bytes(original_bytes),
        "outcome": "descriptive_only",
        "notGold": True,
        "notHumanHumanAgreement": True,
        "realLearnerOutcome": "not_measured",
        "reviewed": len(rejoined),
        "byEffort": table,
        "pairs": paired,
        "nonreviewableAttemptStatus": operator["attemptStatus"],
    }
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=False)
    try:
        fd = os.open(out / "original-submission.json", os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "wb") as f:
            f.write(original_bytes)
        fd = os.open(out / "descriptive-comparison.json", os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "w", encoding="utf8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
            f.write("\n")
    except Exception:
        shutil.rmtree(out)
        raise
    return {"outdir": str(out), "reviewed": len(rejoined),
            "originalSubmissionSha256": output["originalSubmissionSha256"]}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("audit", "prepare", "unseal"))
    parser.add_argument("--packet", default=str(study.DEFAULT_PACKET))
    parser.add_argument("--input", action="append", default=[])
    parser.add_argument("--out-dir")
    parser.add_argument("--packet-dir")
    parser.add_argument("--submission")
    parser.add_argument("--reviewer-id", default="reviewer-a")
    args = parser.parse_args(argv)
    try:
        if args.command in ("audit", "prepare"):
            packet, rows = verified_rows(args.packet, args.input,
                                         require_full=args.command == "prepare")
            if args.command == "audit":
                print(json.dumps(status_summary(rows), indent=2, ensure_ascii=False))
            else:
                if not args.out_dir:
                    parser.error("prepare_requires_--out-dir")
                print(json.dumps(export_blind(packet, rows, args.out_dir, args.reviewer_id),
                                 indent=2, ensure_ascii=False))
        else:
            if not args.packet_dir or not args.submission or not args.out_dir:
                parser.error("unseal_requires_--packet-dir_--submission_--out-dir")
            print(json.dumps(import_review(args.packet_dir, args.submission, args.out_dir),
                             indent=2, ensure_ascii=False))
        return 0
    except (AuditError, study.Invalid, ValueError, OSError) as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    sys.exit(main())
