#!/usr/bin/env python3
"""Measure whether a typed math verifier catches deliberately wrong model replies.

The cases are synthetic mutations of bounded math answers, NOT genuine LLM
mistakes or representative Gaokao coverage. Truth labels are checked against
a separate, source-free control oracle BEFORE invoking the verifier. The exact
answer and truth label are never passed to the tested adjudicator.
"""
import argparse
from fractions import Fraction
from itertools import product
import json
from pathlib import Path
import sys

import sympy as S

sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify_dual_path_math_answers as bridge

IDENTITY="math-wrong-answer-detection-v0.1"
VALID_LABELS={"correct","wrong","unsupported"}
FAMILIES={
    "finite_uniform_occupancy",
    "finite_arithmetic_geometric_sum",
    "circle_line_intersections",
    "quadratic_real_solution_set",
    "parametric_circle_line_intersection_count",
    "unimplemented_open_math",
}
RESULT_MAP={
    "replayed_candidate_mathematically_verified":"accepted_correct",
    "replayed_candidate_mathematically_refuted":"detected_wrong",
    "unverified":"abstained",
}


class InvalidControl(Exception):
    pass


def rat(value):
    return {"kind":"rational","num":value,"den":1}


def inf(side):
    return {"kind":"infinity","side":side}


def point(value):
    return {"kind":"point","value":value}


def interval(a,b,left=False,right=False):
    return {"kind":"interval","left":a,"right":b,
            "includeLeft":left,"includeRight":right}


def make_models():
    occupancy_base={"numberOfLabels":5,"numberOfDraws":3,
                    "uniform":True,"independent":True,"withReplacement":True,
                    "randomVariable":"number_of_distinct_labels_seen"}
    def occ(metric,k=None):
        return {"kind":"finite_uniform_occupancy","model":occupancy_base,
                "query":{"metric":metric} if k is None else {"metric":metric,"k":k}}
    def sequence(a,d,r,n):
        return {"kind":"finite_arithmetic_geometric_sum",
                "model":{"firstTerm":a,"commonDifference":d,
                         "commonRatio":r,"termCount":n},"query":{"metric":"sum"}}
    def circle(h,k,R,a,b,c):
        return {"kind":"circle_line_intersections",
                "circle":{"centerX":h,"centerY":k,"radiusSquared":R},
                "line":{"a":a,"b":b,"c":c}}
    def quadratic(coefs,denom,comparison):
        return {"kind":"quadratic_real_solution_set",
                "numerator":{"coefficients":[{"num":v,"den":1} for v in coefs]},
                "denominator":{"coefficients":[{"num":v,"den":1} for v in denom]},
                "comparison":comparison,"domain":{"kind":"all_real"}}
    def param(count,c1="1",c0="0"):
        return {"kind":"parametric_circle_line_intersection_count",
                "circle":{"centerX":"0","centerY":"0","radiusSquared":"1"},
                "line":{"a":"1","b":"0","baseC":c0,"parameterC":c1},
                "query":{"intersectionCount":count}}
    return {
        "occupancy-expectation":occ("expected_value"),
        "occupancy-single":occ("probability_exact",1),
        "occupancy-double":occ("probability_exact",2),
        "sequence-mixed":sequence("1","1","2",4),
        "sequence-zero":sequence("5","0","1",0),
        "sequence-arithmetic":sequence("2","3","1",8),
        "circle-irrational":circle("0","0","2","0","1","0"),
        "circle-tangent":circle("0","0","25","0","1","-5"),
        "circle-disjoint":circle("0","0","25","0","1","-6"),
        "quadratic-roots":quadratic([-2,0,1],[1],"eq"),
        "quadratic-domain-hole":quadratic([-1,1],[-1,1],"gt"),
        "quadratic-strict":quadratic([-1,0,1],[1],"gt"),
        "parameter-two":param(2),
        "parameter-one":param(1),
        "parameter-zero":param(0),
        "parameter-constant-one":param(1,"0","-1"),
        "unsupported-freeform":{"kind":"arbitrary_multivariable_integral",
                                "expression":"x^2+y^2","domain":"all_real"},
    }


def numeric_ground_truth(key):
    if key.startswith("occupancy-"):
        outcomes=[len(set(sample)) for sample in product(range(5),repeat=3)]
        if key=="occupancy-expectation":
            return Fraction(sum(outcomes),len(outcomes))
        target=1 if key=="occupancy-single" else 2
        return Fraction(sum(x==target for x in outcomes),len(outcomes))
    if key.startswith("sequence-"):
        params={
            "sequence-mixed":(Fraction(1),Fraction(1),Fraction(2),4),
            "sequence-zero":(Fraction(5),Fraction(0),Fraction(1),0),
            "sequence-arithmetic":(Fraction(2),Fraction(3),Fraction(1),8),
        }[key]
        a,d,r,n=params
        return sum(((a+k*d)*r**k for k in range(n)),Fraction(0))
    raise InvalidControl("numeric_ground_truth_not_implemented")


def expected_symbolic(key):
    root=S.sqrt(2)
    if key=="circle-irrational":
        return ((-root,S.Integer(0)),(root,S.Integer(0)))
    if key=="circle-tangent":
        return ((S.Integer(0),S.Integer(5)),)
    if key=="circle-disjoint":
        return ()
    if key=="quadratic-roots":
        return S.FiniteSet(-root,root)
    if key=="quadratic-domain-hole":
        return S.Union(S.Interval.open(-S.oo,1),S.Interval.open(1,S.oo))
    if key in ("quadratic-strict","parameter-zero"):
        return S.Union(S.Interval.open(-S.oo,-1),S.Interval.open(1,S.oo))
    if key=="parameter-two":
        return S.Interval.open(-1,1)
    if key=="parameter-one":
        return S.FiniteSet(-1,1)
    if key=="parameter-constant-one":
        return S.S.Reals
    raise InvalidControl("symbolic_ground_truth_not_implemented")


def exact_candidate_number(s):
    if not isinstance(s,str) or len(s)>128:
        raise InvalidControl("numeric_candidate_not_text")
    # This is ONLY a secondary oracle. The real verifier owns its more
    # restrictive answer-format contract.
    try:
        return Fraction(s)
    except (ValueError,ZeroDivisionError,TypeError) as error:
        raise InvalidControl("control_numeric_candidate_malformed") from error


def coordinate(node):
    if not isinstance(node,dict):
        raise InvalidControl("control_coordinate_not_object")
    if set(node)=={"kind","value"} and node.get("kind")=="rational":
        v=exact_candidate_number(node["value"])
        return S.Rational(v.numerator,v.denominator)
    if (set(node)=={"kind","offset","coefficient","radicand"}
            and node.get("kind")=="affine_sqrt"):
        a=exact_candidate_number(node["offset"])
        b=exact_candidate_number(node["coefficient"])
        c=exact_candidate_number(node["radicand"])
        if c<0:
            raise InvalidControl("negative_control_radicand")
        return S.Rational(a.numerator,a.denominator)+S.Rational(b.numerator,b.denominator)*S.sqrt(
            S.Rational(c.numerator,c.denominator))
    raise InvalidControl("unsupported_control_coordinate")


def candidate_points(doc):
    if not isinstance(doc,dict) or set(doc)!={"kind","points"} or doc.get("kind")!="point_set" or not isinstance(doc["points"],list):
        raise InvalidControl("control_point_set_schema_invalid")
    out=[]
    for p in doc["points"]:
        if not isinstance(p,dict) or set(p)!={"x","y"}:
            raise InvalidControl("control_point_invalid")
        out.append((S.simplify(coordinate(p["x"])),S.simplify(coordinate(p["y"]))))
    return out


def endpoint(node):
    if not isinstance(node,dict):
        raise InvalidControl("control_endpoint_invalid")
    if set(node)=={"kind","num","den"} and node["kind"]=="rational":
        if type(node["num"]) is not int or type(node["den"]) is not int or node["den"]==0:
            raise InvalidControl("control_rational_invalid")
        return S.Rational(node["num"],node["den"])
    if set(node)=={"kind","a","b","radicand","den"} and node["kind"]=="surd":
        if any(type(node[k]) is not int for k in ("a","b","radicand","den")) or node["radicand"]<0 or node["den"]<=0:
            raise InvalidControl("control_surd_invalid")
        return (S.Integer(node["a"])+node["b"]*S.sqrt(node["radicand"]))/node["den"]
    if set(node)=={"kind","side"} and node["kind"]=="infinity" and node["side"] in ("negative","positive"):
        return -S.oo if node["side"]=="negative" else S.oo
    raise InvalidControl("control_endpoint_unknown")


def candidate_set(doc):
    if doc=={"kind":"empty"}:
        return S.EmptySet
    if doc=={"kind":"all_real"}:
        return S.S.Reals
    if not isinstance(doc,dict) or set(doc)!={"kind","parts"} or doc.get("kind")!="union" or not isinstance(doc["parts"],list):
        raise InvalidControl("control_set_invalid")
    pieces=[]
    for p in doc["parts"]:
        if not isinstance(p,dict):
            raise InvalidControl("control_piece_invalid")
        if set(p)=={"kind","value"} and p.get("kind")=="point":
            pieces.append(S.FiniteSet(endpoint(p["value"])))
        elif (set(p)=={"kind","left","right","includeLeft","includeRight"}
              and p.get("kind")=="interval"):
            left,right=endpoint(p["left"]),endpoint(p["right"])
            if left>=right:
                raise InvalidControl("control_interval_reversed")
            pieces.append(S.Interval(left,right,left_open=not p["includeLeft"],
                                     right_open=not p["includeRight"]))
        else:
            raise InvalidControl("control_set_piece_unknown")
    return S.Union(*pieces)


def independently_check_label(row):
    """Manual control models and a separate oracle. No bridge math is used."""
    key=row["oracleKey"]
    models=make_models()
    if key not in models or row["question"]!=models[key]:
        raise InvalidControl("oracle_key_and_question_not_identical")
    label=row["truthLabel"]
    if label=="unsupported":
        return None
    answer=row["modelAttempt"]["answer"]
    if key.startswith(("occupancy-","sequence-")):
        oracle=numeric_ground_truth(key)
        value=exact_candidate_number(answer)
        equal=value==oracle
    elif key.startswith("circle-"):
        oracle=expected_symbolic(key)
        points=candidate_points(answer)
        equal=len(points)==len(oracle)
        unused=list(oracle)
        if equal:
            for p in points:
                i=next((i for i,q in enumerate(unused) if
                        S.simplify(p[0]-q[0])==0 and
                        S.simplify(p[1]-q[1])==0),None)
                if i is None:
                    equal=False
                    break
                unused.pop(i)
    else:
        oracle=expected_symbolic(key)
        proposed=candidate_set(answer)
        # The oracle is explicit in this module, not derived from the
        # production verifier; symmetric difference tests whole-set equality.
        difference=S.simplify(S.SymmetricDifference(oracle,proposed))
        if difference==S.EmptySet:
            equal=True
        elif difference.is_empty is False:
            equal=False
        else:
            raise InvalidControl("independent_set_comparison_undecidable")
    if equal!=(label=="correct"):
        raise InvalidControl("truth_label_disagrees_with_independent_control_oracle")
    return str(oracle)


def compare_one(row):
    if (not isinstance(row,dict) or set(row)!={
        "id","family","oracleKey","truthLabel","errorMode","question","modelAttempt"}):
        raise InvalidControl("invalid_mutant_case_schema")
    if (not isinstance(row["id"],str) or not 1<=len(row["id"])<=128 or
        row["truthLabel"] not in VALID_LABELS or row["family"] not in FAMILIES or
        row["question"].get("kind")!=row["family"] or
        not isinstance(row["errorMode"],str) or not 1<=len(row["errorMode"])<=100):
        raise InvalidControl("invalid_mutant_case_identity_or_label")
    attempt=row["modelAttempt"]
    if (not isinstance(attempt,dict) or set(attempt)!={"captureKind","modelId","rawText","answer"} or
        attempt["captureKind"]!="offline_replay" or
        attempt["modelId"]!="synthetic-mutant-not-live"):
        raise InvalidControl("cannot_use_live_or_untrusted_attempt_as_synthetic")
    independently_check_label(row)
    # Withhold truthLabel, oracleKey, and errorMode from the verdict engine.
    case={"id":row["id"],"path":"no_answer",
          "question":row["question"],"modelAttempt":row["modelAttempt"]}
    verdict=bridge.adjudicate(case,{})
    if verdict["status"] not in RESULT_MAP or verdict["officialExamGoldCertified"] or verdict["liveAIModelCallPerformed"]:
        raise InvalidControl("unexpected_verdict_or_false_claim_of_live_evidence")
    return {"id":row["id"],"family":row["family"],"errorMode":row["errorMode"],
            "truthLabel":row["truthLabel"],
            "verdict":RESULT_MAP[verdict["status"]],
            "abstentionReason":verdict.get("reason") if verdict["status"]=="unverified" else None,
            "syntheticOnly":True}


def rate(n,d):
    return {"numerator":n,"denominator":d,"value":n/d if d else None}


def metrics(items):
    wrong=[r for r in items if r["truthLabel"]=="wrong"]
    correct=[r for r in items if r["truthLabel"]=="correct"]
    supported=wrong+correct
    unsupported=[r for r in items if r["truthLabel"]=="unsupported"]
    w_refuted=sum(r["verdict"]=="detected_wrong" for r in wrong)
    w_accepted=sum(r["verdict"]=="accepted_correct" for r in wrong)
    w_abstained=sum(r["verdict"]=="abstained" for r in wrong)
    c_accepted=sum(r["verdict"]=="accepted_correct" for r in correct)
    c_refuted=sum(r["verdict"]=="detected_wrong" for r in correct)
    c_abstained=sum(r["verdict"]=="abstained" for r in correct)
    u_abstained=sum(r["verdict"]=="abstained" for r in unsupported)
    return {
        "total":len(items),"knownWrong":len(wrong),"knownCorrect":len(correct),
        "knownUnsupported":len(unsupported),
        "wrongDetected":w_refuted,"wrongFalselyAccepted":w_accepted,
        "wrongAbstained":w_abstained,
        "correctAccepted":c_accepted,"correctFalselyRefuted":c_refuted,
        "correctAbstained":c_abstained,
        "unsupportedAbstained":u_abstained,
        "unsupportedGivenVerdict":len(unsupported)-u_abstained,
        "falseAcceptanceRateOnKnownWrong":rate(w_accepted,len(wrong)),
        "wrongAnswerDetectionRecall":rate(w_refuted,len(wrong)),
        "wrongAnswerAbstentionRate":rate(w_abstained,len(wrong)),
        "falseRejectionRateOnKnownCorrect":rate(c_refuted,len(correct)),
        "supportedAnswerDecisionCoverage":rate(w_refuted+w_accepted+c_accepted+c_refuted,len(supported)),
        "unsupportedAbstentionRate":rate(u_abstained,len(unsupported)),
    }


def run(doc):
    if (not isinstance(doc,dict) or set(doc)!={"schemaVersion","id","status","cases"}
        or doc["schemaVersion"]!=1 or doc["id"]!=IDENTITY or
        doc["status"]!="synthetic_not_live_not_general_math_coverage"
        or not isinstance(doc["cases"],list) or not 1<=len(doc["cases"])<=128):
        raise ValueError("invalid_wrong_answer_detection_fixture_contract")
    ids=[r.get("id") if isinstance(r,dict) else None for r in doc["cases"]]
    if any(not isinstance(x,str) for x in ids) or len(set(ids))!=len(ids):
        raise ValueError("duplicate_or_invalid_mutant_id")
    results=[compare_one(r) for r in doc["cases"]]
    by_family={family:metrics([x for x in results if x["family"]==family])
               for family in sorted({x["family"] for x in results})}
    overall=metrics(results)
    is_safe=(overall["wrongFalselyAccepted"]==0 and
             overall["correctFalselyRefuted"]==0 and
             overall["unsupportedGivenVerdict"]==0)
    all_decided=(overall["wrongAbstained"]==0 and overall["correctAbstained"]==0)
    return {"status":"offline_synthetic_mutation_detection_not_real_model_accuracy",
            "summary":{**overall,"falseAcceptanceGatePassed":is_safe,
                       "fullSupportedDecisionCoverageGatePassed":all_decided,
                       "measuredLiveModelErrorDetectionRate":None,
                       "genuineModelRuns":0,
                       "officialExamGoldReleased":0},
            "byFamily":by_family,"items":results}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--fixture",required=True)
    parser.add_argument("--require-zero-false-decisions",action="store_true")
    parser.add_argument("--require-full-supported-coverage",action="store_true")
    args=parser.parse_args()
    doc=json.loads(Path(args.fixture).read_text(encoding="utf8"))
    report=run(doc)
    print(json.dumps(report,indent=2,ensure_ascii=False))
    if args.require_zero_false_decisions and not report["summary"]["falseAcceptanceGatePassed"]:
        return 1
    if args.require_full_supported_coverage and not report["summary"]["fullSupportedDecisionCoverageGatePassed"]:
        return 1
    return 0


if __name__=="__main__":
    sys.exit(main())
