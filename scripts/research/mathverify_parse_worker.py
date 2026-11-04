#!/usr/bin/env python3
"""Isolated Math-Verify 0.9.0 parser worker. Reads one UTF-8 response from stdin.

Never use Math-Verify's 0.9.0 multiprocessing timeout on Windows: documented
upstream Issue #79 causes an empty parse and WinError 5/6. The invoking process
MUST enforce a wall-clock subprocess timeout instead.
"""
import json
import sys

MAX_INPUT_BYTES=100_000
MAX_RETURN_BYTES=20_000


def main():
    raw=sys.stdin.buffer.read(MAX_INPUT_BYTES+1)
    if not raw or len(raw)>MAX_INPUT_BYTES:
        raise ValueError("input_empty_or_overbound")
    pred=raw.decode("utf8")
    from math_verify import parse
    from math_verify.parser import LatexExtractionConfig, ExprExtractionConfig
    from sympy import Float, Rational

    parsed=parse(
        pred,
        extraction_config=(
            LatexExtractionConfig(boxed_match_priority=0),
            ExprExtractionConfig(),
        ),
        fallback_mode="no_fallback",
        extraction_mode="first_match",
        parsing_timeout=None,  # Parent subprocess.run(timeout=...) is mandatory.
        raise_on_error=True,    # No silent [] on internal parser exceptions.
    )
    records=[]
    for node in parsed[:8]:
        item={"type":type(node).__name__,"repr":str(node)[:300]}
        if isinstance(node,Float):
            item["numericKind"]="approximate_float"
        elif isinstance(node,Rational):
            item["numericKind"]="exact_rational"
            item["numerator"]=str(node.p)
            item["denominator"]=str(node.q)
        else:
            item["numericKind"]="not_scalar_numeric"
        records.append(item)
    payload={"state":"parsed","candidateCount":len(parsed),"candidates":records}
    rendered=json.dumps(payload,ensure_ascii=False,separators=(",",":"))
    if len(rendered.encode("utf8"))>MAX_RETURN_BYTES:
        raise ValueError("parse_result_overbound")
    sys.stdout.write(rendered+"\n")


if __name__=="__main__":
    try:
        main()
    except Exception as error:
        # Exception names alone are safe diagnostics. Never echo user/provider
        # content, library tracebacks, environment variables or API keys.
        sys.stdout.write(json.dumps({
            "state":"parser_exception","exceptionClass":type(error).__name__
        })+"\n")
        sys.exit(2)
