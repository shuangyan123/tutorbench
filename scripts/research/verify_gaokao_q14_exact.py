#!/usr/bin/env python3
"""Exact complete answer checker for one concrete Gaokao expectation question.

It distinguishes: (a) truth under a strict typed mathematical model,
(b) published-source claim corroboration, (c) still-unproven official paper
authenticity and publisher independence. Human review is NOT a mandatory gate.
No arbitrary Python eval, SymPy string parsing, network calls or AI Judge.
"""
import argparse
from collections import Counter
from decimal import Decimal, InvalidOperation
from fractions import Fraction
from itertools import product
import json
from math import comb
from pathlib import Path
import re
import sys

CASE_ID = "gaokao-2025-national-1-q14-typed-contract-v0.1"
SOURCE_FIELDS = {"five_labeled_balls","three_draws","with_replacement","count_seen_labels"}
MAX_ENUMERATIONS = 200_000


class Unsupported(Exception):
    pass


def exact_numeric(value):
    if not isinstance(value,str) or len(value)>64:
        raise Unsupported("unsupported_numeric_format")
    s=value.strip()
    if re.fullmatch(r"[+-]?\d{1,16}/\d{1,16}",s):
        p,q=map(int,s.split("/"))
        if q == 0:
            raise Unsupported("zero_denominator")
        return Fraction(p,q)
    if re.fullmatch(r"[+-]?\d{1,16}(?:\.\d{1,16})?",s):
        try:
            return Fraction(Decimal(s))
        except (InvalidOperation,OverflowError) as e:
            raise Unsupported("unsupported_numeric_format") from e
    raise Unsupported("non_numeric_or_ambiguous_claim")


def validate_model(model):
    if not isinstance(model,dict) or set(model)!={
        "numberOfEquiprobableLabels","numberOfDraws",
        "drawsWithReplacement","independentDraws","samplingUniform","quantity"}:
        raise Unsupported("incomplete_typed_problem_model")
    n,d=model["numberOfEquiprobableLabels"],model["numberOfDraws"]
    if type(n) is not int or type(d) is not int or not 1<=n<=12 or not 0<=d<=7:
        raise Unsupported("unsupported_problem_bounds")
    if type(model["drawsWithReplacement"]) is not bool or model["drawsWithReplacement"] is not True:
        raise Unsupported("replacement_assumption_missing")
    if type(model["independentDraws"]) is not bool or model["independentDraws"] is not True:
        raise Unsupported("independence_assumption_missing")
    if type(model["samplingUniform"]) is not bool or model["samplingUniform"] is not True:
        raise Unsupported("uniformity_assumption_missing")
    if model["quantity"] != "number_of_distinct_labels_seen":
        raise Unsupported("unknown_random_variable")
    if n**d>MAX_ENUMERATIONS:
        raise Unsupported("exhaustive_verification_outside_budget")
    return n,d


def method_indicators(n,d):
    # Let Xi=1 if label i appeared at least once; E[sum Xi]=sum E[Xi].
    return Fraction(n*(n**d-(n-1)**d),n**d)


def method_stirling(n,d):
    # Number of onto maps from d numbered draws onto k used labels:
    # falling(n,k) * Stirling(d,k).
    stir=[0]*(d+1)
    stir[0]=1
    for draw in range(1,d+1):
        nxt=[0]*(d+1)
        for k in range(1,draw+1):
            nxt[k]=k*stir[k]+stir[k-1]
        stir=nxt
    counts={}
    for k in range(0,min(n,d)+1):
        falling=1
        for j in range(k):
            falling*=n-j
        counts[k]=falling*stir[k]
    total=n**d
    if sum(counts.values())!=total or any(v<0 for v in counts.values()):
        raise AssertionError("occupancy_probabilities_not_normalized")
    mean=Fraction(sum(k*number for k,number in counts.items()),total)
    return mean,counts


def method_exhaustive(n,d):
    counts=Counter(len(set(outcome)) for outcome in product(range(n),repeat=d))
    total=n**d
    if sum(counts.values())!=total:
        raise AssertionError("enumerated_sample_space_incomplete")
    return Fraction(sum(k*amount for k,amount in counts.items()),total),dict(sorted(counts.items()))


def derive(model):
    n,d=validate_model(model)
    indicators=method_indicators(n,d)
    occupancy,combinatorial_counts=method_stirling(n,d)
    exhaustive,explicit_counts=method_exhaustive(n,d)
    if not (indicators==occupancy==exhaustive):
        raise AssertionError("three_mathematical_algorithms_disagree")
    if combinatorial_counts!=explicit_counts:
        raise AssertionError("combinatorial_distribution_disagrees_with_all_outcomes")
    if not 0<=indicators<=min(n,d):
        raise AssertionError("expectation_outside_support")
    return {
        "reference":indicators,"totalEquallyLikelyOrderedOutcomes":n**d,
        "distributionCounts":combinatorial_counts,
        "methods":{"indicatorLinearity":indicators,
                   "stirlingOccupancyCounting":occupancy,
                   "independentOutcomeEnumeration":exhaustive},
    }


def assess_published_sources(evidence,correct):
    if not isinstance(evidence,dict):
        raise Unsupported("missing_source_evidence")
    pdf=evidence.get("pdfWitness")
    if not isinstance(pdf,dict) or pdf.get("page")!=2 or \
        pdf.get("copyrightNotice")!="third_party_recollection":
        raise Unsupported("unverified_exam_page_identity")
    sources=evidence.get("sameQuestionIndependentPages")
    if not isinstance(sources,list) or len(sources)<2:
        raise Unsupported("insufficient_published_source_records")
    seen=set()
    supporting=set()
    conflicting=set()
    aligned=0
    for x in sources:
        if not isinstance(x,dict):
            raise Unsupported("invalid_source_record")
        url=x.get("url")
        group=x.get("publisherGroup")
        if not isinstance(url,str) or not url.startswith("https://") or \
           not isinstance(group,str) or not group or group in seen:
            raise Unsupported("untraceable_or_duplicate_source")
        seen.add(group)
        if set(x.get("statementFeatures",[]))!=SOURCE_FIELDS:
            continue
        aligned+=1
        val=x.get("claimedAnswer")
        if val is not None:
            try:
                claim=exact_numeric(val)
            except Unsupported:
                conflicting.add(group)
            else:
                (supporting if claim==correct else conflicting).add(group)
    # Source claim observations are compiled from visible pages, not a live
    # machine retrieval and are NOT reviewed lineages or official exam gold.
    return {
        "publishedAlignedHostsRecorded":aligned,
        "publishedMatchingAnswerHosts":len(supporting),
        "publishedConflictingAnswerHosts":len(conflicting),
        "publisherIndependenceAuthenticated":False,
        "officialOriginalAuthenticated":False,
        "sourceReadback":"reviewed_public_webpage_claim_records_not_cryptographic_live_snapshots",
        "conflictGroups":sorted(conflicting),
    }


def check_document(doc):
    if not isinstance(doc,dict) or doc.get("schemaVersion")!=1 or doc.get("id")!=CASE_ID:
        raise ValueError("unknown_source_problem_identity")
    exam=doc.get("exam")
    if exam!={"paperId":"gaokao-2025-national-1","question":14,
             "year":2025,"answerKind":"numeric-expectation","questionForm":"count_distinct_labels"}:
        raise ValueError("mismatched_problem_edition_or_question")
    # Unambiguously pin to the *specific* case, not a cousin distribution.
    model=doc.get("model")
    n,d=validate_model(model)
    if (n,d)!=(5,3):
        raise ValueError("different_problem_not_gaokao_2025_q14")
    work=derive(model)
    evidence=assess_published_sources(doc.get("sourceEvidence"),work["reference"])
    policy=doc.get("verificationPolicy")
    if policy is None or policy.get("doNotDependOnHumanReview") is not True or \
        policy.get("doNotInferOfficialExamAuthentication") is not True or \
        policy.get("requireThreeIndependentAlgorithms") is not True or \
        policy.get("requireExactFraction") is not True or \
        policy.get("studyOnly") is not True:
        raise ValueError("invalid_research_release_policy")
    if len(work["methods"])!=3:
        raise AssertionError("missing_derivation")
    min_source=policy.get("minimumDistinctPublishedHostsWithMatchingAnswer")
    if type(min_source) is not int or min_source<2:
        raise ValueError("source_threshold_too_weak")
    can_corroborate=(evidence["publishedMatchingAnswerHosts"]>=min_source and
                     evidence["publishedConflictingAnswerHosts"]==0)
    outputs=[]
    proposals=doc.get("candidateAnswers")
    if not isinstance(proposals,list) or not 1<=len(proposals)<=32:
        raise ValueError("invalid_candidate_set")
    seen=set()
    for row in proposals:
        if not isinstance(row,dict) or not isinstance(row.get("id"),str) or \
                not row["id"] or row["id"] in seen:
            raise ValueError("candidate_identity_missing_or_duplicate")
        seen.add(row["id"])
        try:
            parsed=exact_numeric(row.get("claim"))
            result="verified_correct_under_typed_model" if parsed==work["reference"] \
                else "verified_incorrect_under_typed_model"
            outputs.append({"id":row["id"],"status":result,
                            "normalizedClaim":str(parsed)})
        except Unsupported as e:
            outputs.append({"id":row["id"],"status":"unverified",
                            "reason":str(e)})
    return {
        "id":CASE_ID,
        "status":"mathematics_verified_published_sources_corroborated" if can_corroborate
                 else "mathematics_verified_source_consensus_unresolved",
        "sourceCertification":{
            **evidence,
            "publishedConsensusPresent":can_corroborate,
            "officialExamGoldCertified":False,
        },
        "mathematics":{
            "provenTypedClaim":"E[number_of_distinct_labels_seen] for n=5 independent uniform draws with replacement 3",
            "exactReference":str(work["reference"]),
            "orderedSampleSpaceSize":work["totalEquallyLikelyOrderedOutcomes"],
            "distributionCounts":{str(k):v for k,v in sorted(work["distributionCounts"].items())},
            "methodResults":{name:str(value) for name,value in work["methods"].items()},
        },
        "results":outputs,
        "limits":"Complete numeric answer to a fixed formalized finite-probability question, not authenticated original exam grading or step/proof assessment.",
    }


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--fixture",default=str(Path(__file__).resolve().parents[2]/
       "fixtures/research/gaokao-2025-q14-typed-contract-v0.1.json"))
    parser.add_argument("--require-source-consensus",action="store_true")
    args=parser.parse_args()
    document=json.loads(Path(args.fixture).read_text(encoding="utf-8"))
    result=check_document(document)
    print(json.dumps(result,indent=2,ensure_ascii=False))
    return int(args.require_source_consensus and not
               result["sourceCertification"]["publishedConsensusPresent"])


if __name__=="__main__":
    sys.exit(main())
