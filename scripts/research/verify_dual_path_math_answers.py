#!/usr/bin/env python3
"""Research-only dual path: published-reference audit and blind-answer adjudication.

The mathematics is derived exclusively from a bounded typed question. Published
answers and replayed model outputs are only compared AFTER the math certificate
has been calculated. No human reviewer, LLM API call or official-gold promotion.
"""
import argparse
from fractions import Fraction
import json
from pathlib import Path
import sys

import sympy as S

sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify_finite_occupancy_family as occupancy
import verify_quadratic_signsets as algebra
import verify_finite_arithmetic_geometric_sum as sequence_sum
import verify_circle_line_intersections as circle_line

ID="dual-path-math-answer-evidence-v0.1"
SOURCE_ID="exam-multi-source-evidence-v0.1"
MAX_ITEMS=64
PATHS={"existing_answer","no_answer"}
EXACT_MATH_STATUSES={"exactly_verified","exactly_refuted"}
GAOKAO_SOURCE_ID="gaokao-2025-national-1-q14"


class Abstain(Exception):
    pass


def question_math(question):
    """No access to published answer, candidate, model response, or source ledger."""
    if not isinstance(question,dict) or type(question.get("kind")) is not str:
        raise Abstain("invalid_typed_question")
    if question["kind"]=="finite_uniform_occupancy":
        if set(question)!={"kind","model","query"}:
            raise Abstain("unknown_occupancy_question_fields")
        try:
            n,d=occupancy.parse_model(question["model"])
            proof=occupancy.proof(n,d)
            expected=occupancy.exact_query_value(proof,question["query"])
        except occupancy.Unsupported as e:
            raise Abstain(str(e)) from e
        return {"kind":"finite_uniform_occupancy","exactAnswer":str(expected),
                "value":expected,"mathematicalMethods":proof["mathematicalMethods"],
                "proofType":"exact_finite_distribution_and_indicator_crosscheck",
                "mathValidated":True}
    if question["kind"]=="finite_arithmetic_geometric_sum":
        try:
            return sequence_sum.solve_question(question)
        except sequence_sum.Unsupported as e:
            raise Abstain("arithmetic_geometric_sum_"+str(e)) from e
    if question["kind"]=="circle_line_intersections":
        try:
            return circle_line.solve_question(question)
        except circle_line.Unsupported as e:
            raise Abstain("circle_line_"+str(e)) from e
    if question["kind"]=="quadratic_real_solution_set":
        if set(question)!={"kind","numerator","denominator","comparison","domain"}:
            raise Abstain("unknown_quadratic_question_fields")
        if question["comparison"] not in algebra.RELATIONS:
            raise Abstain("invalid_comparison")
        try:
            n=algebra.coeff_poly(question["numerator"])
            d=algebra.coeff_poly(question["denominator"])
            if d.is_zero:
                raise Abstain("identically_zero_denominator")
            domain=algebra.typed_set(question["domain"])
            if domain==S.EmptySet:
                raise Abstain("empty_requested_domain")
            direct=algebra.signchart_set(n,d,question["comparison"]).intersect(domain)
            other=algebra.oracle_set(n,d,question["comparison"]).intersect(domain)
            same,witness=algebra.compare_sets(direct,other)
        except (algebra.Abstain,ValueError,TypeError,NotImplementedError,ZeroDivisionError) as e:
            raise Abstain("quadratic_math_unsupported_"+str(e)) from e
        if not same:
            raise Abstain("independent_symbolic_solver_disagreement_at_"+str(witness))
        return {"kind":"quadratic_real_solution_set","exactAnswer":str(direct),
                "value":direct,"mathematicalMethods":[
                    "exact_numerator_denominator_sign_cell_partition",
                    "independent_sympy_original_inequality_solver"],
                "proofType":"exact_complete_real_solution_set",
                "mathValidated":True}
    raise Abstain("unsupported_question_kind")


def validate_candidate(question,derived,candidate):
    if derived["kind"]=="finite_uniform_occupancy":
        try:
            num=occupancy.exact_number(candidate)
        except occupancy.Unsupported as e:
            raise Abstain("candidate_"+str(e)) from e
        return (num==derived["value"],str(num),None)
    if derived["kind"]=="circle_line_intersections":
        try:
            return circle_line.verify_candidate(derived,candidate)
        except circle_line.Unsupported as e:
            raise Abstain("circle_line_candidate_"+str(e)) from e
    if derived["kind"]=="finite_arithmetic_geometric_sum":
        try:
            number=sequence_sum.exact_number(candidate)
        except sequence_sum.Unsupported as e:
            raise Abstain("candidate_"+str(e)) from e
        return (number==derived["value"],str(number),None)
    if not isinstance(candidate,dict) or candidate.get("kind") not in ("union","all_real","empty"):
        raise Abstain("candidate_not_typed_real_set")
    try:
        proposed=algebra.typed_set(candidate)
        yes,witness=algebra.compare_sets(derived["value"],proposed)
    except (algebra.Abstain,ValueError,TypeError,NotImplementedError) as e:
        raise Abstain("candidate_set_unsupported_"+str(e)) from e
    return yes,str(proposed),None if witness is None else str(witness)


def source_ledger(ledger):
    if (not isinstance(ledger,dict) or ledger.get("id")!=SOURCE_ID or
        ledger.get("schemaVersion")!=1 or ledger.get("status")!="review_only_no_gold"):
        raise ValueError("source_evidence_contract_not_pinned")
    cases=ledger.get("cases")
    if not isinstance(cases,list) or len(cases)!=4:
        raise ValueError("source_evidence_cardinality_drift")
    names=[case.get("caseId") for case in cases if isinstance(case,dict)]
    if len(names)!=4 or len(set(names))!=4 or GAOKAO_SOURCE_ID not in names:
        raise ValueError("source_evidence_case_identity_drift")
    return {case["caseId"]:case for case in cases}


def source_binding(case,question):
    """Prevent relabelling a different typed question as the real exam."""
    if case["caseId"]!=GAOKAO_SOURCE_ID:
        raise Abstain("published_question_formalization_not_implemented")
    paper=case.get("paperWitness")
    if not isinstance(paper,dict) or paper.get("officialExamAuthenticated") is not False:
        raise Abstain("paper_authenticity_status_inconsistent")
    if paper.get("statementFingerprinted") is not False:
        raise Abstain("source_statement_snapshot_status_drift")
    if case.get("formalizedClaimId")!="distinct_drawing_expectation":
        raise Abstain("published_formalization_mismatch")
    expected_model={
        "numberOfLabels":5,"numberOfDraws":3,"uniform":True,
        "independent":True,"withReplacement":True,
        "randomVariable":"number_of_distinct_labels_seen"
    }
    if (question.get("kind")!="finite_uniform_occupancy" or
        question.get("model")!=expected_model or
        question.get("query")!={"metric":"expected_value"}):
        raise Abstain("real_exam_statement_vs_typed_model_mismatch")


def verify_published_sources(source,derived):
    records=source.get("sources")
    if not isinstance(records,list) or not 2<=len(records)<=30:
        raise Abstain("missing_source_evidence")
    ids=set()
    agreeing,disagreeing,unreadable=[],[],[]
    for entry in records:
        if not isinstance(entry,dict):
            raise Abstain("invalid_source_entry")
        sid=entry.get("id")
        if not isinstance(sid,str) or not sid or sid in ids:
            raise Abstain("duplicate_or_missing_source_id")
        ids.add(sid)
        if (not isinstance(entry.get("url"),str) or
            not entry["url"].startswith("https://") or
            not isinstance(entry.get("publicationGroup"),str) or
            not entry["publicationGroup"]):
            raise Abstain("invalid_publisher_provenance")
        if entry.get("lineageReview")!="unverified":
            raise Abstain("lineage_not_corroborated_by_immutable_evidence")
        if entry.get("problemAlignment")!="matching":
            unreadable.append(sid)
            continue
        if entry.get("role") not in ("worked_solution","converted_solution"):
            unreadable.append(sid)
            continue
        claim=entry.get("claim")
        try:
            match=occupancy.exact_number(claim)==derived["value"]
        except occupancy.Unsupported:
            unreadable.append(sid)
            continue
        (agreeing if match else disagreeing).append(sid)
    return {
        "matchingPublisherClaims":agreeing,
        "contradictoryPublisherClaims":disagreeing,
        "notUsableForAnswerAgreement":unreadable,
        # URLs / publisher group names do not prove independence.
        "independentlyVerifiedPublisherLineages":0,
        "paperOriginalAuthenticated":False,
        "sourceStatus":"math_matches_unverified_publications" if not disagreeing
                       else "published_answer_conflict",
    }


def adjudicate(row,sources):
    identifier=row.get("id") if isinstance(row,dict) else None
    base={"id":identifier if isinstance(identifier,str) and 1<=len(identifier)<=128 else None,
          "officialExamGoldCertified":False,
          "liveAIModelCallPerformed":False}
    try:
        if base["id"] is None:
            raise Abstain("invalid_case_id")
        if set(row).difference({"id","path","question","sourceCaseId","referenceAnswer",
                                "modelAttempt","expectedStatus"}):
            raise Abstain("unexpected_case_fields")
        path=row.get("path")
        if path not in PATHS:raise Abstain("invalid_adjudication_path")
        question=row.get("question")
        if path=="no_answer" and (row.get("sourceCaseId") is not None or
                                  "referenceAnswer" in row):
            raise Abstain("blind_path_cannot_receive_reference_answer")
        if path=="existing_answer" and "modelAttempt" in row:
            raise Abstain("published_answer_path_cannot_receive_ai_attempt")
        # Crucially: derive first from only the question; no published answer
        # and no "model" text is visible to the mathematics engine.
        derived=question_math(question)
        audit={"exactAnswerUnderTypedModel":derived["exactAnswer"],
               "mathematicalMethods":derived["mathematicalMethods"],
               "proofType":derived["proofType"],
               "typedProblemMathValid":True}
        if path=="existing_answer":
            if "referenceAnswer" not in row:
                raise Abstain("missing_published_reference_candidate")
            correct,normalized,witness=validate_candidate(question,derived,row["referenceAnswer"])
            audit.update({"submittedReference":normalized,
                          "referenceMathematics":"exactly_verified" if correct else "exactly_refuted",
                          "counterexample":witness})
            linked=row.get("sourceCaseId")
            if linked is not None:
                if not isinstance(linked,str) or linked not in sources:
                    raise Abstain("unknown_publication_case_link")
                source=sources[linked]
                source_binding(source,question)
                audit["sourceEvidence"]=verify_published_sources(source,derived)
                audit["sourceCaseId"]=linked
                # A referenced answer can only assert values appearing at a
                # matching published source, and cannot silently invent a key.
                usable=[e for e in source["sources"] if e.get("problemAlignment")=="matching" and
                        e.get("role") in ("worked_solution","converted_solution")]
                if not any(e.get("claim")==row["referenceAnswer"] for e in usable):
                    raise Abstain("submitted_reference_not_found_in_linked_sources")
            else:
                audit["sourceEvidence"]={"sourceStatus":"unsourced_candidate",
                                         "independentlyVerifiedPublisherLineages":0,
                                         "paperOriginalAuthenticated":False}
            return {**base,"path":path,
                    "status":"reference_mathematically_verified" if correct
                              else "reference_mathematically_refuted",
                    **audit}
        if "modelAttempt" not in row:
            # A no-answer task is solvable without ANY answer field. This
            # produces a deterministic mathematics baseline, NOT an AI score.
            return {**base,"path":path,"status":"deterministic_no_answer_solution",
                    "candidateOrigin":"independent_exact_math_solver",
                    **audit}
        attempt=row["modelAttempt"]
        if not isinstance(attempt,dict) or set(attempt)!={"captureKind","modelId",
                                                          "rawText","answer"}:
            raise Abstain("invalid_model_attempt_record")
        if attempt["captureKind"]!="offline_replay" or not isinstance(attempt["modelId"],str) or not attempt["modelId"] or len(attempt["modelId"])>96:
            raise Abstain("model_attempt_not_attested_live_run")
        # The existing scalar/set paths retain their original exact-string
        # replay contract. Geometric point-set replies require the ENTIRE
        # visible raw answer to equal canonical JSON of the typed point set;
        # no extraction from prose, hidden key or altered structure.
        if derived["kind"]=="circle_line_intersections":
            raw=attempt["rawText"]
            candidate=attempt["answer"]
            if (not isinstance(raw,str) or len(raw)>4096 or
                not isinstance(candidate,dict) or
                raw.strip()!=json.dumps(candidate,ensure_ascii=False,sort_keys=True,
                                        separators=(",",":"))):
                raise Abstain("model_output_extraction_not_certified")
        elif (not isinstance(attempt["rawText"],str) or
              len(attempt["rawText"])>256 or
              not isinstance(attempt["answer"],str) or
              attempt["rawText"].strip()!=attempt["answer"].strip()):
            raise Abstain("model_output_extraction_not_certified")
        correct,normalized,witness=validate_candidate(question,derived,attempt["answer"])
        return {**base,"path":path,
                "status":"replayed_candidate_mathematically_verified" if correct
                          else "replayed_candidate_mathematically_refuted",
                "candidateOrigin":"offline_replay_not_live_model",
                "submittedModelAnswer":normalized,
                "counterexample":witness,**audit}
    except (Abstain,AssertionError,ValueError,TypeError,NotImplementedError,
            ZeroDivisionError,RecursionError) as e:
        return {**base,"status":"unverified",
                "reason":str(e) if isinstance(e,Abstain) else
                         "mathematical_derivation_outside_supported_scope"}


def run(document,ledger):
    if (not isinstance(document,dict) or document.get("schemaVersion")!=1 or
        document.get("id")!=ID or document.get("status")!="research_no_official_gold"):
        raise ValueError("invalid_bridge_contract")
    rows=document.get("cases")
    if not isinstance(rows,list) or not 1<=len(rows)<=MAX_ITEMS:
        raise ValueError("invalid_case_cardinality")
    ids=[r.get("id") if isinstance(r,dict) else None for r in rows]
    if any(not isinstance(i,str) or not 1<=len(i)<=128 for i in ids) or len(set(ids))!=len(ids):
        raise ValueError("missing_or_duplicate_case_id")
    sources=source_ledger(ledger)
    results=[adjudicate(row,sources) for row in rows]
    statuses={s:sum(r["status"]==s for r in results) for s in (
        "reference_mathematically_verified","reference_mathematically_refuted",
        "deterministic_no_answer_solution",
        "replayed_candidate_mathematically_verified",
        "replayed_candidate_mathematically_refuted","unverified")}
    replay_correct=statuses["replayed_candidate_mathematically_verified"]
    replay_wrong=statuses["replayed_candidate_mathematically_refuted"]
    return {
        "status":"bounded_dual_path_math_verified_not_live_ai_accuracy_or_exam_gold",
        "summary":{"total":len(results),**statuses,
                   "offlineReplayDecidable":replay_correct+replay_wrong,
                   "offlineReplayCorrect":replay_correct,
                   "genuineAIModelRuns":0,
                   "measuredLiveAIAccuracy":None,
                   "officialExamGoldReleased":0,
                   "realExamCasesProvenAuthenticated":0},
        "items":results}


def main():
    parser=argparse.ArgumentParser()
    root=Path(__file__).resolve().parents[2]
    parser.add_argument("--fixture",default=str(root/"fixtures/research/dual-path-math-evidence-v0.1.json"))
    parser.add_argument("--sources",default=str(root/"fixtures/research/exam-multi-source-evidence-v0.1.json"))
    parser.add_argument("--require-decidable",action="store_true")
    args=parser.parse_args()
    with open(args.fixture,encoding="utf8") as f:document=json.load(f)
    with open(args.sources,encoding="utf8") as f:ledger=json.load(f)
    output=run(document,ledger)
    print(json.dumps(output,indent=2,ensure_ascii=False))
    return int(bool(args.require_decidable and output["summary"]["unverified"]))


if __name__=="__main__":sys.exit(main())
