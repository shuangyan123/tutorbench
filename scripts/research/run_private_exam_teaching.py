"""Replay six correctness records before executing the private vNext teaching pilot."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

from exam_correctness import (
    PRIVATE, SHA, canonical, derive_batch, file_digest, read_json, require, run_review,
)

QUESTION_IDS = {
    "gaokao-2026-national-1/q07", "gaokao-2026-jiangsu-chemistry/q10",
    "gaokao-2025-national-1/q07", "gaokao-2025-national-1/q14",
    "gaokao-2025-jiangsu-physics/q01", "gaokao-2022-jiangsu-physics/q01",
}
RUNNER = PRIVATE.parents[1] / "scripts/research/run-private-exam-teaching.mjs"


def by_question(rows):
    indexed = {row["questionId"]: row for row in rows}
    require(len(rows) == len(indexed), "duplicate_question_record")
    return indexed


def replay_admissions(bank, root, plan, references, candidates, previous, authored):
    selected = {"schemaVersion": plan["schemaVersion"],
                "items": [row for row in plan["items"] if row["questionId"] in QUESTION_IDS]}
    blind, records = derive_batch(bank, root, selected)
    fresh = run_review(bank, root, selected, blind, records,
                       {k: v for k, v in references.items() if k in QUESTION_IDS},
                       {k: v for k, v in candidates.items() if k in QUESTION_IDS}, {})
    current = by_question(fresh["results"])
    prior = by_question(previous["results"])
    reviewed = by_question(authored)
    require(reviewed.keys() == QUESTION_IDS, "pilot_requires_six_teaching_references")
    admissions = {}
    for question_id, reference in reviewed.items():
        actual = current.get(question_id)
        old = prior.get(question_id)
        expected = reference["correctnessInputSha256"]
        require(isinstance(expected, str) and SHA.fullmatch(expected), "invalid_authored_evidence_digest")
        admitted = False
        if not actual or not old:
            reason = "missing_correctness_record"
        elif actual["status"] != "verified" or not actual["verificationCoverage"]["wholeAnswerVerified"]:
            reason = actual["reason"] or "whole_answer_unverified"
        elif actual["inputSha256"] != expected or canonical(old) != canonical(actual):
            reason = "correctness_evidence_changed"
        elif actual["evidence"]["questionSha256"] != reference["questionVersion"]:
            reason = "question_version_changed"
        else:
            admitted, reason = True, "whole_answer_evidence_replayed"
        admissions[question_id] = {"admitted": admitted, "reason": reason,
                                   "actualInputSha256": actual["inputSha256"] if actual else None}
    return admissions


def private_file(path):
    resolved = path.resolve()
    require(resolved.is_relative_to(PRIVATE.resolve()), "pilot_requires_ignored_private_path")
    return resolved


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("bank", "phase2", "pilot", "out"):
        parser.add_argument(f"--{name}", required=True, type=Path)
    args = parser.parse_args()
    try:
        out = private_file(args.out)
        pilot_path = private_file(args.pilot)
        require(not out.exists(), "pilot_requires_new_output_path")
        bank = read_json(args.bank)
        pilot = read_json(pilot_path)
        require(pilot.get("schemaVersion") == 1, "unsupported_private_pilot_version")
        inputs = {name: args.phase2 / name for name in (
            "plan-final.json", "references.json", "candidates.json", "review.json")}
        admissions = replay_admissions(
            bank, args.bank.resolve().parent, *(read_json(path) for path in inputs.values()),
            pilot["teachingReferences"],
        )
        envelope = {"pilot": pilot, "admissions": admissions, "inputDigests": {
            "pilot": file_digest(pilot_path), "bank": file_digest(args.bank),
            **{name: file_digest(path) for name, path in inputs.items()},
        }}
        result = subprocess.run(["node", str(RUNNER)], input=canonical(envelope),
                                capture_output=True, timeout=90, check=False)
        if result.returncode:
            print(result.stderr.decode("utf-8", errors="replace").strip(), file=sys.stderr)
            return 1
        report = json.loads(result.stdout)
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("x", encoding="utf-8") as handle:
            json.dump(report, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write("\n")
        return 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        print("private teaching pilot: invalid, missing, or unreadable local input", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
