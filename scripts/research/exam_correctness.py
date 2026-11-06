"""Private exam correctness pilot. A standalone blind worker receives typed problem JSON."""
import argparse
from hashlib import sha256
from importlib.metadata import version as distribution_version
import json
from pathlib import Path
import re
import subprocess
import sys

from check_contextual_expectation_baseline import compatible_rounding, source_bound_expression
from compare_math_verify_baseline import one_exact_rational, parse_without_gold
from exam_correctness_rules import (
    Unsupported, check_value, matches_derivation, occupancy_question, problem_model, require,
)
from local_exam_bank import find_items, handoff

VERSION = "private-exam-correctness/1.0.0"
SCRIPTS = Path(__file__).resolve().parent
PRIVATE = SCRIPTS.parents[1] / "data/private"
WORKER = SCRIPTS / "exam_correctness_rules.py"
DEPENDENCIES = (
    Path(__file__).name, WORKER.name, "local_exam_bank.py", "verify_dual_path_math_answers.py",
    "verify_finite_occupancy_family.py", "verify_quadratic_signsets.py",
    "check_contextual_expectation_baseline.py", "compare_math_verify_baseline.py", "mathverify_parse_worker.py",
)
PREMISES = {"constant", "target", "horizontal", "maxStaticEqualsKinetic",
            "uniformWithReplacement", "randomMating"}
SHA = re.compile(r"[0-9a-f]{64}")
PART = re.compile(r"part-[1-9][0-9]?(?:-blank-[1-9][0-9]?)?")
ID = re.compile(r"gaokao-[a-z0-9-]+/q[0-9]{2}")


def canonical(value):
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def digest(value):
    return sha256(canonical(value)).hexdigest()


def file_digest(path):
    return sha256(path.read_bytes()).hexdigest()


def read_json(path):
    def unique(pairs):
        obj = dict(pairs)
        require(len(obj) == len(pairs), "duplicate_json_key")
        return obj
    require(path.stat().st_size <= 10_000_000, "input_file_too_large")
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique)


def engine_digest():
    return digest({"files": {name: file_digest(SCRIPTS / name) for name in DEPENDENCIES},
                   "python": sys.version, "libraries": {name: distribution_version(name)
                       for name in ("sympy", "math-verify", "pdfplumber", "pypdfium2")}})


def question_input(item):
    return {key: value for key, value in item.items() if key != "answer"}


def checked_handoff(bank, ident):
    require(isinstance(ident, str) and ID.fullmatch(ident), "invalid_question_id")
    items = find_items(bank, question_id=ident)
    require(len(items) == 1, "question_not_uniquely_located")
    record = handoff(items[0])
    item = record["item"]
    require(record["schemaVersion"] == 1 and record["kind"] == "tutorbench-correctness-input-candidate"
            and record["verificationStatus"] == "pending" and record["formalScoringEligible"] is False
            and item["questionId"] == f"{item['paperId']}/q{item['number']:02}", "invalid_handoff")
    require(isinstance(item["answer"], dict) and isinstance(item["answer"].get("status"), str)
            and isinstance(item["source"], dict) and isinstance(item["displayRegions"], list),
            "invalid_handoff_evidence")
    require(item["questionStatus"] == "user_supplied_assumed_correct", "disputed_question")
    return record


def artifact(root, relative, expected, suffix):
    require(isinstance(relative, str) and isinstance(expected, str) and SHA.fullmatch(expected),
            "invalid_artifact_locator")
    path = (root / relative).resolve()
    require(path.is_relative_to(root) and path.suffix.lower() == suffix, "artifact_outside_bank_or_wrong_format")
    require(path.is_file() and path.stat().st_size <= 64_000_000, "artifact_missing_or_overbound")
    raw = path.read_bytes()
    require(sha256(raw).hexdigest() == expected, "artifact_hash_mismatch")
    require(raw.startswith(b"%PDF-") and raw.rstrip().endswith(b"%%EOF") if suffix == ".pdf"
            else raw.startswith(b"\x89PNG\r\n\x1a\n"), "artifact_signature_mismatch")


def crops(root, regions, pdf_sha, *, required_pages=()):
    require(isinstance(regions, list) and bool(regions), "missing_source_crops")
    for region in regions:
        require(region["sourceSha256"] == pdf_sha and type(region["page"]) is int and region["page"] >= 1,
                "crop_not_bound_to_pdf")
        artifact(root, region["path"], region["sha256"], ".png")
    require(set(required_pages) <= {r["page"] for r in regions}, "required_page_or_diagram_missing")


def bind_question(root, record, plan):
    item = record["item"]
    projected = question_input(item)
    require(plan["questionSha256"] == digest(projected), "question_or_source_binding_changed")
    source = item["source"]
    artifact(root, source["localPath"], source["sha256"], ".pdf")
    require(isinstance(plan["sourceReview"], str) and bool(plan["sourceReview"].strip()),
            "source_transcription_review_missing")
    pages = plan["requiredPages"]
    require(isinstance(pages, list) and all(type(p) is int for p in pages), "invalid_required_pages")
    require(set(pages) == set(source["pages"]), "question_page_inventory_changed")
    crops(root, item["displayRegions"], source["sha256"], required_pages=pages)
    check = plan["check"]
    if check is None:
        return None
    require(isinstance(check, dict) and set(check) == {"scope", "problem"}, "invalid_scoped_check")
    scope = check["scope"]
    require(isinstance(scope, str) and (scope == "whole-answer" or PART.fullmatch(scope)), "invalid_check_scope")
    kind, _, options = problem_model(check["problem"])
    subject = ("physics" if kind in ("constant_acceleration", "static_friction_limit") else
               "chemistry" if kind in ("reaction_balance", "redox_feed_ratio") else
               "biology" if kind == "mendelian_random_mating" else "math")
    require(subject == item["subject"], "cross_subject_rule")
    require(scope != "whole-answer" or item["questionType"] in ("single_choice", "fill_in"),
            "whole_answer_requires_single_target")
    require(scope != "whole-answer" or bool(options) == (item["questionType"] == "single_choice"),
            "answer_target_does_not_match_question_type")
    if options:
        require({o["label"] for o in item["fields"]["options"]} == options.keys(),
                "transcribed_options_do_not_match_bank")
    return check


def blind_worker(problem):
    # 只向独立进程 stdin 写入限定的题目模型。没有 bank、参考答案、候选或文件路径。
    try:
        done = subprocess.run([sys.executable, "-B", str(WORKER)], input=canonical(problem),
                              capture_output=True, timeout=20, check=True)
        require(len(done.stdout) <= 128_000, "blind_worker_output_overbound")
        response = json.loads(done.stdout)
        require(isinstance(response, dict) and (
            response.get("status") == "derived" and set(response) == {"status", "derived", "choice"}
            or response.get("status") == "abstained" and set(response) == {"status", "reason"}),
            "invalid_blind_worker_response")
        return response
    except (subprocess.SubprocessError, OSError, ValueError):
        return {"status": "abstained", "reason": "blind_worker_failed"}


def plans(document):
    require(isinstance(document, dict) and set(document) == {"schemaVersion", "items"}
            and document["schemaVersion"] == 1 and isinstance(document["items"], list)
            and 0 < len(document["items"]) <= 32, "invalid_plan")
    ids = set()
    for plan in document["items"]:
        require(isinstance(plan, dict) and set(plan) == {"questionId", "questionSha256", "requiredPages",
                "sourceReview", "check", "limitations"} and isinstance(plan["questionId"], str)
                and ID.fullmatch(plan["questionId"]) and plan["questionId"] not in ids
                and isinstance(plan["limitations"], list) and all(isinstance(x, str) for x in plan["limitations"]),
                "invalid_plan_item")
        ids.add(plan["questionId"])
    return document["items"]


def derive_batch(bank, root, document):
    rows, records = [], {}
    for plan in plans(document):
        ident = plan["questionId"]
        try:
            record = checked_handoff(bank, ident)
            records[ident] = record
            check = bind_question(root, record, plan)
            if check is None:
                raise Unsupported("question_requires_unmodelled_reasoning")
            problem = check["problem"]
            row = {"problemSha256": digest(problem), **blind_worker(problem)}
        except (ValueError, TypeError, KeyError, OSError, ArithmeticError) as error:
            row = {"status": "abstained", "reason": str(error) if isinstance(error, Unsupported)
                   else "invalid_or_missing_question_input"}
        rows.append({"questionId": ident, **row})
    return {"verifierVersion": VERSION, "engineSha256": engine_digest(), "planSha256": digest(document),
            "results": rows}, records


def reference_value(root, item, entry, scope, kind):
    answer = item["answer"]
    require(answer.get("pairing") == "matched" and answer.get("status") == "user_supplied_assumed_correct",
            "reference_not_uniquely_paired")
    pdf_sha = answer["sourceSha256"]
    artifact(root, answer["localPath"], pdf_sha, ".pdf")
    crops(root, answer["displayRegions"], pdf_sha)
    if answer["solutionRegions"]:
        crops(root, answer["solutionRegions"], pdf_sha)
    text = answer.get("nativeText")
    if isinstance(text, str) and re.fullmatch("[A-D]", text.strip()) and scope == "whole-answer":
        require(entry is None, "unexpected_override_of_literal_option")
        return text.strip(), "literal_handoff_option"
    require(isinstance(entry, dict) and set(entry) == {"answerSha256", "scope", "value", "sourceReview"}
            and entry["answerSha256"] == digest(answer) and entry["scope"] == scope
            and isinstance(entry["sourceReview"], str) and entry["sourceReview"].strip(),
            "missing_or_stale_reference_transcription")
    require(kind != "redox_feed_ratio", "literal_redox_choice_required")
    return entry["value"], entry["sourceReview"]


def normalize_answer(kind, model, value):
    if kind != "occupancy_expectation" or not isinstance(value, dict):
        return value
    require(set(value) == {"expectationLatex"} and isinstance(value["expectationLatex"], str)
            and len(value["expectationLatex"]) <= 256, "invalid_latex_candidate")
    bound = source_bound_expression(value["expectationLatex"], occupancy_question(model))
    require(bound["state"] == "source_bound", "latex_does_not_bind_expected_value")
    rhs = bound["exactRhsLatex"]
    require(re.fullmatch(r"[-+]?(?:\d{1,20}|\\(?:frac|tfrac)\{[-+]?\d{1,20}\}\{\d{1,20}\})", rhs),
            "latex_outside_exact_rational_subset")
    parsed = parse_without_gold(r"\boxed{" + rhs + "}")
    require(parsed["state"] == "parsed", "math_verify_extraction_failed")
    rational, _ = one_exact_rational(parsed)
    require(rational is not None and compatible_rounding(rational, bound["approximation"]),
            "latex_not_unique_exact_or_inconsistent_approximation")
    return rational


def compare_answer(problem, blind, supplied):
    kind, model, options = problem_model(problem)
    supplied = normalize_answer(kind, model, supplied)
    value = supplied
    if options and isinstance(supplied, str) and supplied in options:
        value = options[supplied]
    a, witness = check_value(kind, model, value)
    b = matches_derivation(kind, model, blind["derived"], value)
    if options and isinstance(supplied, str) and supplied in options:
        b = b and blind["choice"] == supplied
    status = "abstained" if a != b else "verified" if a else "refuted"
    reason = "paths_disagree" if a != b else "exact_paths_agree" if a else "both_paths_show_mismatch"
    return {"status": status, "reason": reason, "pathA": {"satisfied": a, "evidence": witness},
            "pathB": {"matches": b, "derived": blind["derived"], "choice": blind["choice"]}}


def safe_compare(problem, blind, supplied):
    try:
        return compare_answer(problem, blind, supplied)
    except (ValueError, TypeError, KeyError, OSError, ArithmeticError, NotImplementedError) as error:
        return {"status": "abstained", "reason": str(error) if isinstance(error, Unsupported)
                else "unsupported_answer_value"}


def reasoning_claims(problem, candidate):
    claims = candidate.get("reasoning") if isinstance(candidate, dict) else None
    model = problem["model"] if problem else {}
    checks = []
    if not isinstance(claims, list) or len(claims) > 8:
        claims = []
    for step in claims:
        if not isinstance(step, dict) or set(step) != {"field", "value"} or not isinstance(step["field"], str):
            checks.append({"status": "abstained", "reason": "unsupported_step_shape"})
            continue
        field, value = step["field"], step["value"]
        if field not in PREMISES or field not in model or type(value) is not type(model[field]):
            checks.append({"status": "abstained", "field": field, "reason": "unsupported_premise"})
            continue
        expected = model[field]
        checks.append({"status": "verified" if value == expected else "refuted", "field": field,
                       "expected": expected, "supplied": value})
    states = {x["status"] for x in checks}
    status = "refuted" if "refuted" in states else "verified" if states == {"verified"} else "abstained"
    return {"status": status, "scope": "listed_premises_only", "checks": checks, "completeProofVerified": False}


def final_result(root, plan, record, blind, engine, reference, candidate, expected_hash=None):
    check = plan["check"] if isinstance(plan["check"], dict) else None
    item = record["item"] if record else None
    reference_check = None
    if blind["status"] == "derived":
        try:
            reference_check = reference_value(root, item, reference, check["scope"], check["problem"]["kind"])
            reference_binding = "reference_files_checked"
        except (ValueError, TypeError, KeyError, OSError) as error:
            reference_binding = str(error) if isinstance(error, Unsupported) else "invalid_or_missing_reference_evidence"
    else:
        reference_binding = "reference_not_read"
    fingerprint = digest({"engineSha256": engine, "version": VERSION, "handoff": record,
                          "plan": plan, "referenceTranscription": reference, "candidate": candidate,
                          "blind": blind, "referenceBinding": reference_binding})
    result = {"questionId": plan["questionId"], "verifierVersion": VERSION, "inputSha256": fingerprint,
              "referenceAnswerStatus": "abstained",
              "referenceSourceStatus": item["answer"]["status"] if item else None,
              "status": "abstained", "reason": blind.get("reason"),
              "method": check["problem"].get("kind") if check and isinstance(check.get("problem"), dict) else None,
              "evidence": {"blind": blind, "sourceReview": plan["sourceReview"],
                           "questionSha256": plan["questionSha256"], "source": item["source"] if item else None,
                           "questionCrops": item["displayRegions"] if item else [],
                           "answerSha256": digest(item["answer"]) if item else None},
              "unsupportedOrMissingInputs": list(plan["limitations"]),
              "verificationCoverage": {"scope": check.get("scope") if check else None, "referenceClaimsChecked": 0,
                                       "wholeAnswerVerified": False, "completeProofVerified": False},
              "candidateAnswer": {"status": "abstained", "reason": "no_candidate"},
              "referenceReasoning": {"status": "abstained", "reason": "full_solution_proof_not_checked"},
              "reasoning": reasoning_claims(None, None), "formalScoringEligible": False,
              "supportsCaseAuthoring": False}
    if expected_hash is not None and expected_hash != fingerprint:
        result["reason"] = "stale_input_digest"
    elif blind["status"] == "derived":
        problem, scope = check["problem"], check["scope"]
        if reference_check is None:
            verdict = {"status": "abstained", "reason": reference_binding}
        else:
            value, review = reference_check
            verdict = safe_compare(problem, blind, value)
            result["evidence"]["reference"] = {"review": review, "sourceSha256": item["answer"]["sourceSha256"],
                                               "crops": item["answer"]["displayRegions"], **verdict}
        state = verdict["status"]
        if state != "abstained":
            result["verificationCoverage"]["referenceClaimsChecked"] = 1
        whole = scope == "whole-answer" and state == "verified"
        result["verificationCoverage"]["wholeAnswerVerified"] = whole
        result["supportsCaseAuthoring"] = whole
        result["status"] = "verified" if whole else "refuted" if state == "refuted" else "abstained"
        result["referenceAnswerStatus"] = result["status"]
        result["reason"] = "partial_claim_only" if state == "verified" and not whole else verdict["reason"]
        if isinstance(candidate, dict) and set(candidate) == {"scope", "value", "reasoning"} and candidate["scope"] == scope:
            result["candidateAnswer"] = {"scope": scope, **safe_compare(problem, blind, candidate["value"])}
            result["reasoning"] = reasoning_claims(problem, candidate)
    if result["status"] == "abstained" and result["reason"] not in result["unsupportedOrMissingInputs"]:
        result["unsupportedOrMissingInputs"].append(result["reason"])
    return result


def run_review(bank, root, document, blind, records, references, candidates, expected_hashes):
    ids = {p["questionId"] for p in document["items"]}
    for mapping in (references, candidates, expected_hashes):
        require(isinstance(mapping, dict) and mapping.keys() <= ids, "unexpected_question_id_in_sidecar")
    results = [final_result(root, plan, records.get(ident), receipt, blind["engineSha256"],
                            references.get(ident), candidates.get(ident), expected_hashes.get(ident))
               for plan, receipt in zip(document["items"], blind["results"]) for ident in (plan["questionId"],)]
    return {"verifierVersion": VERSION, "engineSha256": blind["engineSha256"],
            "bankDenominator": len(bank["questions"]), "selectedDenominator": len(results),
            "blindDerived": sum(row["status"] == "derived" for row in blind["results"]),
            "distribution": {s: sum(row["status"] == s for row in results)
                             for s in ("verified", "refuted", "abstained")},
            "results": results}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("blind", "review"))
    parser.add_argument("--bank", type=Path, required=True)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--receipt", type=Path)
    parser.add_argument("--references", type=Path)
    parser.add_argument("--candidates", type=Path)
    parser.add_argument("--expect-input-hashes", type=Path)
    args = parser.parse_args(argv)
    try:
        out = args.out.resolve()
        require(out.is_relative_to(PRIVATE.resolve()) and not out.exists(), "output_requires_new_private_path")
        if args.command == "blind":
            require(not any((args.receipt, args.references, args.candidates, args.expect_input_hashes)),
                    "blind_mode_rejects_answer_and_review_arguments")
        else:
            require(args.receipt is not None, "blind_receipt_required_before_review")
        bank = read_json(args.bank)
        document = read_json(args.plan)
        root = args.bank.resolve().parent
        blind, records = derive_batch(bank, root, document)
        report = blind
        if args.command == "review":
            require(canonical(read_json(args.receipt)) == canonical(blind), "stale_or_altered_blind_receipt")
            report = run_review(bank, root, document, blind, records,
                                read_json(args.references) if args.references else {},
                                read_json(args.candidates) if args.candidates else {},
                                read_json(args.expect_input_hashes) if args.expect_input_hashes else {})
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("x", encoding="utf-8") as handle:
            json.dump(report, handle, ensure_ascii=True, indent=2, allow_nan=False)
            handle.write("\n")
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(f"correctness: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
