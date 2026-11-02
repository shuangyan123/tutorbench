#!/usr/bin/env python3
"""Research-only multi-source mathematical evidence adjudication.

Never uses publisher counts as a mathematical proof or publishes exam gold.
Formalized subclaims are evaluated by separate symbolic derivations; correct
formalization and original paper authority still require independent review.
"""
import argparse
import json
from pathlib import Path
import sympy as S

EVIDENCE_ID = "exam-multi-source-evidence-v0.1"
CATALOG_ID = "exam-source-expansion-2022-2026-v0.1"
SUPPORTED = {
    "cone_outward_flux": ("divergence_theorem", "direct_outward_parameterization"),
    "covariance_max_eigenvalue": ("covariance_spectrum", "variance_bound"),
    "triangular_double_integral": ("direct_iterated_integral", "reversed_order_integral"),
}
EXPECTED = {"cone_outward_flux": "-2*sqrt(3)*pi/3",
            "covariance_max_eigenvalue": "C",
            "triangular_double_integral": "2/3"}


def math_witnesses(formalization):
    """Produce independently derived values, not a user-supplied 'verified' flag."""
    if formalization == "cone_outward_flux":
        h = 1/S.sqrt(3)
        r_sq = S.Rational(2, 3)
        cone_volume = S.pi*r_sq*h/3
        cap_flux = (S.Integer(4)/S.sqrt(3))*S.pi*r_sq
        first = S.simplify(3*cone_volume-cap_flux)
        t, theta = S.symbols("t theta", real=True)
        axis = S.Matrix([1,1,1])/S.sqrt(3)
        u = S.Matrix([1,-1,0])/S.sqrt(2)
        v = S.Matrix([1,1,-2])/S.sqrt(6)
        point = t*axis + S.sqrt(2)*t*(S.cos(theta)*u + S.sin(theta)*v)
        outward_area = point.diff(theta).cross(point.diff(t))
        field = S.Matrix([point[0], point[1]+1, point[2]+2])
        direct = S.simplify(S.integrate(field.dot(outward_area), (theta,0,2*S.pi), (t,0,h)))
        return {"divergence_theorem":first,"direct_outward_parameterization":direct}
    if formalization == "covariance_max_eigenvalue":
        rho = S.symbols("rho", real=True)
        spectrum = S.Matrix([[1,rho],[rho,1]]).eigenvals()
        assert set(spectrum) == {1-rho,1+rho}
        # Variance bound: Var(aX+bY)=1+2ab*rho <= 1+|rho|
        # since 2|ab| <= a²+b²=1, with equality for |a|=|b|=1/sqrt(2).
        a = S.sqrt(S.Rational(1,2))
        upper_positive = S.simplify(1+2*a*a*rho)
        upper_negative = S.simplify(1-2*a*a*rho)
        assert upper_positive == 1+rho and upper_negative == 1-rho
        return {"covariance_spectrum":1+S.Abs(rho),"variance_bound":S.Max(upper_positive,upper_negative)}
    if formalization == "triangular_double_integral":
        x = S.symbols("x", nonnegative=True)
        # Integrate y first over the equivalent triangle 0<=y<=x<=2.
        first = S.integrate(x*x/(2*S.sqrt(1+x**3)),(x,0,2))
        # A second derivative/endpoint certificate of the antiderivative.
        anti = S.sqrt(1+x**3)/3
        assert S.simplify(S.diff(anti,x)-x*x/(2*S.sqrt(1+x**3)))==0
        second = S.simplify(anti.subs(x,2)-anti.subs(x,0))
        return {"direct_iterated_integral":S.simplify(first),
                "reversed_order_integral":second}
    raise ValueError("unknown_formalization")


def canonical(result, formalization):
    if formalization == "covariance_max_eigenvalue":
        target = 1+S.Abs(S.Symbol("rho",real=True))
        if S.simplify(result-target)!=0:
            raise AssertionError("covariance_math_disagreement")
        return "C"
    return str(S.simplify(result))


def evidence_case(case, paper_ids):
    case_id=case.get("caseId")
    if not isinstance(case_id,str) or not case_id:
        raise ValueError("invalid_case_id")
    paper_id=case.get("paperId")
    if paper_id not in paper_ids:
        raise ValueError("case_references_unknown_paper_"+case_id)
    if not isinstance(case.get("question"),int) or case["question"]<1:
        raise ValueError("invalid_question")
    claim_id=case.get("formalizedClaimId")
    if claim_id not in SUPPORTED:
        raise ValueError("unrecognized_formalization")
    if case.get("provisionalComputedResult") != EXPECTED[claim_id]:
        raise ValueError("inconsistent_expected_reference")
    source=case.get("paperWitness")
    if not isinstance(source,dict) or not source.get("url"):
        raise ValueError("missing_paper_witness")
    if type(source.get("statementPageVisuallyCompared")) is not bool or \
        type(source.get("secondIndependentHumanReviewer")) is not bool or \
        type(source.get("officialExamAuthenticated")) is not bool:
        raise ValueError("unsupported_paper_review_state")
    if source.get("statementFingerprinted") not in (True,False):
        raise ValueError("missing_statement_fingerprint_flag")

    sources=case.get("sources")
    if not isinstance(sources,list) or not 2<=len(sources)<=30:
        raise ValueError("invalid_source_count")
    seen_ids=set()
    publisher_groups={}
    supporting=[]
    contradictions=[]
    unaligned=[]
    for item in sources:
        if not isinstance(item,dict) or not isinstance(item.get("id"),str) or \
            not item["id"] or item["id"] in seen_ids:
            raise ValueError("missing_or_duplicate_source_id")
        seen_ids.add(item["id"])
        if not isinstance(item.get("url"),str) or not item["url"].startswith("https://"):
            raise ValueError("untraceable_source")
        group=item.get("publicationGroup")
        if not isinstance(group,str) or not group:
            raise ValueError("missing_publication_group")
        if item.get("lineageReview") not in ("unverified","verified_independent","known_derived"):
            raise ValueError("unsupported_lineage_review")
        if item["lineageReview"]=="verified_independent" and not \
          (isinstance(item.get("lineageEvidence"),dict) and
           isinstance(item["lineageEvidence"].get("reviewerId"),str) and
           isinstance(item["lineageEvidence"].get("rationale"),str) and
           len(item["lineageEvidence"]["rationale"])>=30):
            raise ValueError("unsubstantiated_lineage_claim")
        if item.get("problemAlignment") not in ("matching","contradictory_problem_statement"):
            raise ValueError("unsupported_problem_alignment")
        if item.get("problemAlignment")!="matching":
            unaligned.append(item["id"])
            continue
        if item.get("role") not in ("worked_solution","converted_solution"):
            continue
        claim=item.get("claim")
        publisher_groups.setdefault(group,[]).append(item["id"])
        if claim==case["provisionalComputedResult"]:
            supporting.append(item)
        elif claim not in (None,"unreadable_blank_key"):
            contradictions.append(item)
    independent_confirmations = len({item["publicationGroup"] for item in supporting
      if item["lineageReview"]=="verified_independent"})
    # Unknown source lineage is NOT independent evidence even on another website.
    unknown_lineage_supporters = len({item["publicationGroup"] for item in supporting
      if item["lineageReview"]=="unverified"})
    proofs=math_witnesses(claim_id)
    required=set(SUPPORTED[claim_id])
    if set(proofs)!=required or set(case.get("requiredIndependentMathMethods",[]))!=required:
        raise ValueError("missing_independent_math_method")
    calculated={method:canonical(value,claim_id) for method,value in proofs.items()}
    if len(set(calculated.values()))!=1 or next(iter(calculated.values()))!=case["provisionalComputedResult"]:
        raise AssertionError("independent_computations_disagree")
    # Do not conflate websites, different mathematical methods, or original exam authority.
    has_publisher_disagreement=bool(contradictions)
    has_statement_conflict=bool(unaligned)
    if not source["statementPageVisuallyCompared"]:
        review="blocked_original_question_not_checked"
    elif has_publisher_disagreement or has_statement_conflict:
        review="contested_needs_adjudication"
    else:
        review="provisionally_corrob_source_lineage_unverified"
    # No gold release exists in v0.1 even with apparently positive flags.
    return {
        "caseId":case_id,"paperId":paper_id,"question":case["question"],
        "status":review,"mathematics":calculated,
        "sourceSupport":{
            "alignedSupportingPublisherGroups":len({x["publicationGroup"] for x in supporting}),
            "independentlyReviewedSupportingPublisherGroups":independent_confirmations,
            "unconfirmedLineageSupportingGroups":unknown_lineage_supporters,
            "contradictingSourceIds":[x["id"] for x in contradictions],
            "differentProblemStatementSourceIds":unaligned,
            "publisherGroupsRepresented":len(publisher_groups),
        },
        "sourceFlags":{
            "originalPaperAuthenticated":source["officialExamAuthenticated"],
            "secondHumanSourceReview":source["secondIndependentHumanReviewer"],
            "statementFingerprinted":source["statementFingerprinted"],
        },
        "answerGoldCertified":False,
        "reason":"Independent formal math checked, but authentic statement, author lineage and independent human adjudication remain separate acceptance gates."
    }


def evaluate(evidence,catalog):
    if evidence.get("schemaVersion")!=1 or evidence.get("id")!=EVIDENCE_ID:
        raise ValueError("invalid_evidence_schema")
    if catalog.get("id")!=CATALOG_ID or len(catalog.get("papers",[]))!=51:
        raise ValueError("unexpected_parent_source_catalog")
    paper_ids={x.get("paperId") for x in catalog["papers"]}
    cases=evidence.get("cases")
    if not isinstance(cases,list) or not 1<=len(cases)<=32:
        raise ValueError("invalid_case_count")
    if len({c.get("caseId") for c in cases})!=len(cases):
        raise ValueError("duplicate_evidence_case")
    results=[evidence_case(c,paper_ids) for c in cases]
    return {"status":"research_only_multi_source_no_gold",
        "scope":"Checked bounded formalized mathematics and source conflicts, never authentic original-paper answers or general tutoring quality",
        "sympyVersion":S.__version__,
        "summary":{"cases":len(results),"mathematicalMethodChecks":sum(len(x["mathematics"]) for x in results),
                   "contradictedCases":sum(bool(x["sourceSupport"]["contradictingSourceIds"]) for x in results),
                   "releasedGoldAnswers":0},
        "items":results}


def main():
    parser=argparse.ArgumentParser()
    root=Path(__file__).resolve().parents[2]
    parser.add_argument("--evidence",default=str(root/"fixtures/research/exam-multi-source-evidence-v0.1.json"))
    parser.add_argument("--catalog",default=str(root/"fixtures/research/exam-source-expansion-2022-2026-v0.1.json"))
    args=parser.parse_args()
    evidence=json.loads(Path(args.evidence).read_text(encoding="utf-8"))
    catalog=json.loads(Path(args.catalog).read_text(encoding="utf-8"))
    print(json.dumps(evaluate(evidence,catalog),ensure_ascii=False,indent=2))


if __name__=="__main__":
    main()
