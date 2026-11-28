#!/usr/bin/env python3
"""Opt-in DeepSeek high/max Tutor contrast on exactly ten frozen learner-state packets.

plan/summarize: zero requests. run requires --execute-live and DEEPSEEK_API_KEY.
Reuses repository's existing bounded, no-redirect DeepSeek HTTP transport.
No retries, no model/learner grade, no reasoning text stored.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import time

import run_deepseek_flash_math_25 as foundation

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PACKET = ROOT / "artifacts/research/learner-state-contrasts-v0.1/tutor-visible.json"
MODEL = "deepseek-flash"
EFFORTS = ("high", "max")
MAX_TOKENS = 8192
PROMPT = (
    "你是注重学生理解的数学辅导老师。请根据学生实际给出的理由、"
    "已经展示的知识和明确提出的疑问来调整教学。"
    "不要仅凭答错一道题推断固定能力或编造错误原因。"
    "如果学生正确展示了当前步骤，可简短肯定并推进；"
    "如果概念或前置知识尚未理解，应解释必要的桥梁，但避免无关长篇重复。"
    "允许诊断提问、简短提示或适量解释，不要假装学生已经长期掌握。"
    "请用简体中文直接对学生回答，不要提及评测或虚构学生后续表现。"
)
STUDY_ID = "learner-state-deepseek-high-max-v0.1"
EXPECTED_IDS = {
    f"ls-v01-p{n:02d}-{arm}" for n in range(1, 6) for arm in ("a", "b")
}
STATUSES = {
    "ok", "empty_response", "output_truncated", "model_incomplete",
    "provider_failure", "provider_identity_mismatch",
}


class Invalid(ValueError):
    pass


def canonical(value):
    # JS JSON.stringify semantics for packet input SHA256 (preserves original key order).
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def sha_text(value):
    return hashlib.sha256(value.encode("utf8")).hexdigest()


def digest(value):
    return sha_text(canonical(value))


def load_packet(path):
    doc = json.loads(Path(path).read_text(encoding="utf8"))
    if (not isinstance(doc, dict) or
        doc.get("schemaVersion") != 1 or
        doc.get("id") != "learner-state-contrast-tutor-packets" or
        doc.get("version") != "0.1.0" or
        doc.get("blind") is not True or
        doc.get("tutorExecutionStatus") != "not_run" or
        doc.get("evidenceMode") != "author_written_counterfactual" or
        not isinstance(doc.get("sourceVisibleSha256"), str) or
        len(doc["sourceVisibleSha256"]) != 64 or
        not isinstance(doc.get("cases"), list) or len(doc["cases"]) != 10):
        raise Invalid("invalid_frozen_tutor_packet")
    ids = set()
    for case in doc["cases"]:
        if not isinstance(case, dict) or set(case) != {"caseId", "inputSha256", "input"}:
            raise Invalid("unexpected_case_keys")
        case_id = case["caseId"]
        payload = case["input"]
        if (case_id not in EXPECTED_IDS or case_id in ids or
            not isinstance(payload, dict) or
            payload.get("caseId") != case_id or
            payload.get("scenarioId") != case_id or
            not isinstance(payload.get("currentStudentMessage"), str) or
            not payload["currentStudentMessage"].strip() or
            not isinstance(payload.get("conversation"), list) or
            not isinstance(payload.get("studentState"), dict) or
            case["inputSha256"] != digest(payload)):
            raise Invalid("packet_case_integrity")
        if (payload["studentState"].get("misconceptions") != [] or
            payload["studentState"].get("knownConcepts") != []):
            raise Invalid("unblinded_author_labels")
        ids.add(case_id)
    if ids != EXPECTED_IDS:
        raise Invalid("missing_or_duplicate_arms")
    for n in range(1, 6):
        x = [c["input"] for c in doc["cases"] if c["caseId"] == f"ls-v01-p{n:02d}-a"]
        y = [c["input"] for c in doc["cases"] if c["caseId"] == f"ls-v01-p{n:02d}-b"]
        if len(x) != 1 or len(y) != 1:
            raise Invalid("invalid_pair")
        a, b = dict(x[0]), dict(y[0])
        for field in ("scenarioId", "caseId", "currentStudentMessage"):
            a.pop(field, None)
            b.pop(field, None)
        if a != b:
            raise Invalid("paired_fields_differ")
    return doc


def messages_for(item):
    inp = item["input"]
    state = inp["studentState"]
    public_context = {
        "learningObjective": inp.get("learningObjective") or "",
        "initialContext": inp.get("initialContext") or "",
        "studentLevel": state.get("level", ""),
        "studentGoal": state.get("goal", ""),
        "knownConcepts": state.get("knownConcepts", []),
    }
    messages = [
        {"role": "system", "content": PROMPT},
        {"role": "user", "content": "本题的公开教学上下文（非评审答案）：\n" + canonical(public_context)},
    ]
    for turn in inp["conversation"]:
        if (not isinstance(turn, dict) or turn.get("role") not in ("student", "tutor")
            or not isinstance(turn.get("text"), str)):
            raise Invalid("invalid_visible_conversation")
        messages.append({
            "role": "user" if turn["role"] == "student" else "assistant",
            "content": turn["text"],
        })
    messages.append({"role": "user", "content": inp["currentStudentMessage"]})
    return messages


def make_request(item, effort):
    if effort not in EFFORTS:
        raise Invalid("unsupported_effort")
    return {
        "model": MODEL,
        "messages": messages_for(item),
        "thinking": {"type": "enabled"},
        "reasoning_effort": effort,
        "max_tokens": MAX_TOKENS,
        "stream": False,
    }


def one_call(case, effort, key, timeout, transport=foundation.provider_call):
    request = make_request(case, effort)
    start = time.monotonic()
    result = {
        "recordType": "case_result", "caseId": case["caseId"], "effort": effort,
        "inputSha256": case["inputSha256"], "requestSha256": digest(request),
        "messagesSha256": digest(request["messages"]), "modelRequested": MODEL,
        "attemptedAtUtc": datetime.now(timezone.utc).isoformat(),
        "realHttpRequestAttempted": True,
        "providerIdentityCryptographicallyVerified": False,
    }
    try:
        response = transport(request, key, timeout)
        if response.get("model") != MODEL:
            result.update(status="provider_identity_mismatch", returnedModel=response.get("model"))
        else:
            choices = response.get("choices")
            choice = choices[0] if isinstance(choices, list) and len(choices) == 1 else None
            msg = choice.get("message") if isinstance(choice, dict) else None
            finish = choice.get("finish_reason") if isinstance(choice, dict) else None
            content = msg.get("content") if isinstance(msg, dict) else None
            result["finishReason"] = finish
            result["finalText"] = content if isinstance(content, str) else None
            result["finalTextSha256"] = sha_text(content) if isinstance(content, str) else None
            result["reasoningContentPresent"] = (
                isinstance(msg.get("reasoning_content"), str) and
                bool(msg["reasoning_content"])
            ) if isinstance(msg, dict) else False
            result["status"] = (
                "output_truncated" if finish == "length" else
                "model_incomplete" if finish != "stop" else
                "empty_response" if not isinstance(content, str) or not content.strip() else
                "ok"
            )
            usage = response.get("usage")
            if isinstance(usage, dict):
                result["tokenUsage"] = {
                    name: value for name, value in usage.items()
                    if name in ("prompt_tokens", "completion_tokens", "total_tokens")
                    and type(value) is int and value >= 0
                }
                details = usage.get("completion_tokens_details")
                if (isinstance(details, dict) and
                    type(details.get("reasoning_tokens")) is int):
                    result["reasoningTokensReported"] = details["reasoning_tokens"]
            result["providerResponseId"] = response.get("id") if isinstance(response.get("id"), str) else None
    except foundation.ProviderFailure as err:
        result.update(status="provider_failure", httpStatus=err.status, errorCategory=err.category)
    result["elapsedMs"] = round((time.monotonic() - start) * 1000)
    return result


def write_run(doc, chosen, effort, key, timeout, output, transport=foundation.provider_call):
    path = Path(output)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    results = []
    with os.fdopen(fd, "w", encoding="utf8") as file:
        meta = {
            "recordType": "run_metadata", "studyId": STUDY_ID,
            "sourceVisibleSha256": doc["sourceVisibleSha256"],
            "packetSha256": digest(doc),
            "promptSha256": sha_text(PROMPT),
            "effort": effort, "modelRequested": MODEL, "maxTokens": MAX_TOKENS,
            "caseIds": [c["caseId"] for c in chosen], "explicitLiveOptIn": True,
            "apiKeyStored": False,
            "responseContentOnly": True, "realStudentOutcomeMeasured": False,
        }
        file.write(canonical(meta) + "\n")
        file.flush()
        for case in chosen:
            row = one_call(case, effort, key, timeout, transport)
            file.write(canonical(row) + "\n")
            file.flush()
            results.append(row)
            print(case["caseId"] + " " + effort + ": " + row["status"],
                  "(" + str(row["elapsedMs"]) + " ms)", flush=True)
    return results


def read_runs(paths):
    rows = []
    keys = set()
    meta_reference = None
    for path in paths:
        data = Path(path).read_text(encoding="utf8").splitlines()
        if not data:
            raise Invalid("empty_run_file")
        meta = json.loads(data[0])
        if meta.get("recordType") != "run_metadata" or meta.get("studyId") != STUDY_ID:
            raise Invalid("wrong_run_identity")
        shared = (meta.get("sourceVisibleSha256"), meta.get("packetSha256"),
                  meta.get("promptSha256"), meta.get("maxTokens"), meta.get("modelRequested"))
        if meta_reference is None:
            meta_reference = shared
        elif shared != meta_reference:
            raise Invalid("different_study_configuration")
        for line in data[1:]:
            row = json.loads(line)
            key = (row.get("caseId"), row.get("effort"))
            if (row.get("recordType") != "case_result" or
                row.get("effort") != meta.get("effort") or
                key in keys or key[0] not in EXPECTED_IDS or
                row.get("status") not in STATUSES):
                raise Invalid("duplicate_or_invalid_case_result")
            keys.add(key)
            rows.append(row)
    return rows


def summarize(rows):
    output = {}
    for effort in EFFORTS:
        chosen = [r for r in rows if r["effort"] == effort]
        if not chosen:
            continue
        usage = {k: sum(r.get("tokenUsage", {}).get(k, 0) for r in chosen)
                 for k in ("prompt_tokens", "completion_tokens", "total_tokens")}
        output[effort] = {
            "attempted": len(chosen),
            "ok": sum(r["status"] == "ok" for r in chosen),
            "notCompleted": len(chosen) - sum(r["status"] == "ok" for r in chosen),
            "statuses": {s: sum(r["status"] == s for r in chosen) for s in sorted(STATUSES)
                         if any(r["status"] == s for r in chosen)},
            "tokenUsageReported": usage,
            "meanLatencyMs": round(sum(r["elapsedMs"] for r in chosen) / len(chosen)),
        }
    return {"studyId": STUDY_ID, "responses": output,
            "learningOutcome": "not_measured", "humanJudgment": "not_yet_collected",
            "automaticTeachingQualityScore": None}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("command", choices=("plan", "run", "summarize"))
    p.add_argument("--packet", default=str(DEFAULT_PACKET))
    p.add_argument("--effort", choices=EFFORTS, default="high")
    p.add_argument("--start-index", type=int, default=1)
    p.add_argument("--limit", type=int, default=1)
    p.add_argument("--timeout-sec", type=int, default=240)
    p.add_argument("--execute-live", action="store_true")
    p.add_argument("--output")
    p.add_argument("--input", action="append", default=[])
    args = p.parse_args(argv)
    if args.command == "summarize":
        if not args.input:
            p.error("summarize_requires_--input")
        print(json.dumps(summarize(read_runs(args.input)), ensure_ascii=False, indent=2))
        return 0
    doc = load_packet(args.packet)
    if not (1 <= args.start_index <= 10 and
            1 <= args.limit <= 11 - args.start_index):
        p.error("invalid_1_based_case_window")
    if not 15 <= args.timeout_sec <= 600:
        p.error("invalid_timeout")
    chosen = doc["cases"][args.start_index - 1:args.start_index - 1 + args.limit]
    if args.command == "plan":
        print(json.dumps({
            "studyId": STUDY_ID, "model": MODEL, "effort": args.effort,
            "maxTokensPerRequest": MAX_TOKENS,
            "maxSelectedCompletionTokens": MAX_TOKENS * len(chosen),
            "tokenCeilingIsNotCurrencyBudget": True,
            "apiCalls": 0, "cases": [
                {"caseId": c["caseId"], "inputSha256": c["inputSha256"],
                 "requestSha256": digest(make_request(c, args.effort)),
                 "messagesSha256": digest(messages_for(c))}
                for c in chosen],
            "researchLabelsInRequests": False,
        }, ensure_ascii=False, indent=2))
        return 0
    if not args.execute_live:
        p.error("run_requires_--execute-live")
    if not args.output:
        p.error("run_requires_--output")
    key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not key:
        p.error("DEEPSEEK_API_KEY_missing_in_this_shell")
    rows = write_run(doc, chosen, args.effort, key, args.timeout_sec, args.output)
    print(json.dumps(summarize(rows), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
