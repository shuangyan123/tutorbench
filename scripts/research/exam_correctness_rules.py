"""Bounded exact rules. The blind worker imports this module and receives only a problem."""
from collections import Counter
from fractions import Fraction
from functools import lru_cache
from itertools import product
import re

import sympy as S

from verify_dual_path_math_answers import question_math
from verify_quadratic_signsets import compare_sets


class Unsupported(ValueError):
    pass


MODELS = {
    "pair_sum_progression": {"rows"},
    "occupancy_expectation": {"labels", "draws", "uniformWithReplacement"},
    "piecewise_shift_interval": {"base", "slope", "intercept", "pivot"},
    "circle_parallel_offset_count": {"centerResidual", "normalSquared", "distance"},
    "constant_acceleration": {"initial", "final", "duration", "constant", "target"},
    "static_friction_limit": {"mu", "gravity", "horizontal", "maxStaticEqualsKinetic"},
    "reaction_balance": {"left", "right"},
    "redox_feed_ratio": {"left", "right", "oxidationHalf", "reductionHalf", "ironStates",
                         "ironProduct", "nitrogenStates"},
    "mendelian_random_mating": {"f1", "filter", "target", "randomMating"},
}
UNITS = {
    "m/s": ("speed", Fraction(1)), "km/h": ("speed", Fraction(5, 18)),
    "s": ("time", Fraction(1)), "ms": ("time", Fraction(1, 1000)),
    "m/s^2": ("acceleration", Fraction(1)), "cm/s^2": ("acceleration", Fraction(1, 100)),
    "m/s²": ("acceleration", Fraction(1)), "cm/s²": ("acceleration", Fraction(1, 100)),
}


def require(test, reason):
    if not test:
        raise Unsupported(reason)


def exact(value):
    require(isinstance(value, str) and bool(re.fullmatch(
        r"[+-]?\d{1,20}(?:/\d{1,20}|\.\d{1,20})?", value)), "requires_bounded_exact_number")
    try:
        return Fraction(value)
    except ZeroDivisionError as error:
        raise Unsupported("zero_denominator") from error


def quantity(value, dimension):
    require(isinstance(value, dict) and set(value) == {"value", "unit"}, "quantity_requires_unit")
    require(isinstance(value["unit"], str) and value["unit"] in UNITS, "unknown_unit")
    actual, factor = UNITS[value["unit"]]
    require(actual == dimension, "wrong_unit_dimension")
    return exact(value["value"]) * factor


def scalar(value):
    return S.Rational(value.numerator, value.denominator)


def interval(value):
    require(isinstance(value, dict) and set(value) == {"lo", "hi", "leftOpen", "rightOpen"}
            and type(value["leftOpen"]) is bool and type(value["rightOpen"]) is bool,
            "requires_bounded_interval")
    lo = scalar(exact(value["lo"]))
    hi = S.oo if value["hi"] == "inf" else scalar(exact(value["hi"]))
    require(lo < hi and (hi != S.oo or value["rightOpen"]), "invalid_interval_endpoints")
    return S.Interval(lo, hi, value["leftOpen"], value["rightOpen"])


def interval_json(value):
    require(isinstance(value, S.Interval) and value.start.is_Rational and value.end.is_Rational,
            "non_bounded_interval_result")
    return {"lo": str(value.start), "hi": str(value.end),
            "leftOpen": bool(value.left_open), "rightOpen": bool(value.right_open)}


def problem_model(problem):
    require(isinstance(problem, dict) and set(problem) == {"kind", "model", "options"},
            "blind_problem_has_unknown_fields")
    kind, model, options = (problem[k] for k in ("kind", "model", "options"))
    require(isinstance(kind, str) and kind in MODELS, "unsupported_problem_kind")
    require(isinstance(model, dict) and model.keys() == MODELS[kind], "missing_or_unknown_model_fields")
    require(isinstance(options, dict) and (not options or set(options) == set("ABCD")), "invalid_option_set")
    require(kind != "redox_feed_ratio" or bool(options), "redox_requires_option_claims")
    return kind, model, options


def row_numbers(model):
    rows = model["rows"]
    require(isinstance(rows, list) and 4 <= len(rows) <= 12 and not len(rows) % 2
            and all(type(n) is int and 0 < n <= 100 for n in rows), "pairing_size_outside_bound")
    return tuple(sorted(rows))


def pair_progressions(rows):
    def pairings(rest):
        if not rest:
            yield ()
        for i in range(1, len(rest)):
            if i > 1 and rest[i] == rest[i - 1]:
                continue
            for tail in pairings(rest[1:i] + rest[i + 1:]):
                yield ((rest[0], rest[i]),) + tail

    witnesses = {}
    for pairs in pairings(rows):
        sums = sorted(a + b for a, b in pairs)
        steps = {b - a for a, b in zip(sums, sums[1:])}
        if len(steps) == 1 and (step := next(iter(steps))) > 0:
            witnesses.setdefault(step, pairs)
    return witnesses


def matching_witness(rows, proposed):
    n = len(rows) // 2
    first = Fraction(sum(rows), n) - Fraction(n - 1, 2) * proposed
    sums = tuple(first + i * proposed for i in range(n))
    if proposed <= 0 or any(x.denominator != 1 for x in sums):
        return None

    @lru_cache(None)
    def fill(remaining, required):
        if not remaining:
            return ()
        a = remaining[0]
        for target in required:
            b = target - a
            if b in remaining[1:]:
                i = remaining.index(b, 1)
                rest = tuple(x for x in required if x != target)
                tail = fill(remaining[1:i] + remaining[i + 1:], rest)
                if tail is not None:
                    return ((a, int(b)),) + tail
        return None

    return fill(rows, sums)


def occupancy_question(m):
    n, d = m["labels"], m["draws"]
    require(m["uniformWithReplacement"] is True and type(n) is int and type(d) is int
            and 2 <= n <= 12 and 1 <= d <= 8 and n ** d <= 50000, "occupancy_assumptions_or_bound")
    return {"kind": "finite_uniform_occupancy", "model": {"numberOfLabels": n, "numberOfDraws": d, "uniform": True,
                      "independent": True, "withReplacement": True,
                      "randomVariable": "number_of_distinct_labels_seen"},
            "query": {"metric": "expected_value"}}


def interval_problem(model):
    base, slope, intercept, pivot = (exact(model[k]) for k in ("base", "slope", "intercept", "pivot"))
    require(base > 1 and slope < 0 and pivot < 0 and pivot.denominator == 1 and abs(pivot) <= 12,
            "piecewise_monotone_branch_assumptions")
    return base, slope, intercept, pivot


def circle_offsets(model):
    residual, norm2, distance = (exact(model[k]) for k in ("centerResidual", "normalSquared", "distance"))
    require(norm2 > 0 and distance > 0, "invalid_parallel_line_distance")
    normal = S.sqrt(scalar(norm2))
    require(normal.is_Rational, "irrational_normal_outside_supported_subset")
    normal = Fraction(int(normal.p), int(normal.q))
    return residual, normal, distance


def physics_inputs(kind, model):
    if kind == "constant_acceleration":
        require(model["constant"] is True and model["target"] in ("magnitude", "signed"),
                "constant_acceleration_assumption_or_target")
        v0 = quantity(model["initial"], "speed")
        v1 = quantity(model["final"], "speed")
        dt = quantity(model["duration"], "time")
        require(dt > 0, "duration_must_be_positive")
        return v0, v1, dt
    require(model["horizontal"] is True and model["maxStaticEqualsKinetic"] is True,
            "friction_requires_horizontal_surface_and_static_limit")
    mu, g = exact(model["mu"]), quantity(model["gravity"], "acceleration")
    require(mu > 0 and g > 0, "nonpositive_friction_inputs")
    return mu, g


def reaction_matrix(left, right):
    require(isinstance(left, list) and isinstance(right, list) and left and right
            and 2 <= len(left) + len(right) <= 12, "reaction_size_outside_bound")
    species = left + right
    elements = set()
    for row in species:
        require(isinstance(row, dict) and set(row) == {"atoms", "charge"} and type(row["charge"]) is int
                and abs(row["charge"]) <= 12 and isinstance(row["atoms"], dict)
                and (bool(row["atoms"]) or row["charge"] == -1)
                and all(re.fullmatch(r"[A-Z][a-z]?", atom) and type(n) is int and 1 <= n <= 32
                        for atom, n in row["atoms"].items()), "invalid_species")
        elements.update(row["atoms"])
    signs = [1] * len(left) + [-1] * len(right)
    keys = sorted(elements) + ["charge"]
    matrix = S.Matrix([[sign * (row["charge"] if k == "charge" else row["atoms"].get(k, 0))
                        for sign, row in zip(signs, species)] for k in keys])
    return keys, matrix


def balance(left, right):
    _, matrix = reaction_matrix(left, right)
    kernel = matrix.nullspace()
    require(len(kernel) == 1 and all(x != 0 for x in kernel[0]), "no_unique_positive_balance")
    v = kernel[0]
    scale = S.ilcm(*[x.q for x in v])
    result = [int(x * scale * S.sign(v[0])) for x in v]
    require(all(0 < n <= 10000 for n in result), "no_bounded_positive_balance")
    return result


def redox_ratio(model, *, blind):
    if not blind:
        direct = balance(model["left"], model["right"])
        return Fraction(direct[0], direct[1]), {"netCoefficients": direct}
    vectors = {}
    electron = {"atoms": {}, "charge": -1}
    for name, side in (("oxidationHalf", "right"), ("reductionHalf", "left")):
        half = model[name]
        require(isinstance(half, dict) and set(half) == {"left", "right"}
                and isinstance(half["left"], list) and isinstance(half["right"], list),
                "invalid_half_reaction")
        left, right = half["left"], half["right"]
        require((right if side == "right" else left)[-1:] == [electron], "half_reaction_missing_electron")
        require(left and left[0] == model["left"][1 if name == "oxidationHalf" else 0],
                "half_reaction_target_mismatch")
        vectors[name] = balance(left, right)
    oxidation, reduction = (vectors[k] for k in ("oxidationHalf", "reductionHalf"))
    ratio = Fraction(oxidation[-1], oxidation[0]) / Fraction(
        reduction[len(model["reductionHalf"]["left"]) - 1], reduction[0])
    return ratio, vectors


def redox_claim(model, claim, ratio):
    require(isinstance(claim, dict) and set(claim) == {"metric", "value"}, "invalid_chemical_claim")
    metric, value = claim["metric"], claim["value"]
    if metric == "feedRatio":
        return exact(value) == ratio
    if metric == "ironIncreasing":
        stages = model["ironStates"]
        require(isinstance(stages, list) and len(stages) >= 2 and all(type(n) is int for n in stages)
                and type(value) is bool, "missing_iron_states")
        return value == all(a < b for a, b in zip(stages, stages[1:]))
    if metric == "ironProduct":
        require(isinstance(value, str) and isinstance(model["ironProduct"], str), "missing_diagram_product")
        return value == model["ironProduct"]
    if metric == "nitrogenOxidized":
        states = model["nitrogenStates"]
        require(isinstance(states, list) and len(states) == 2 and all(type(n) is int for n in states)
                and type(value) is bool, "missing_nitrogen_states")
        return value == (states[1] > states[0])
    raise Unsupported("unmodelled_chemical_option")


def genetics_probability(model, *, blind):
    require(model["randomMating"] is True and
            model == {"f1": "Bb", "filter": "B_present", "target": "bb", "randomMating": True},
            "unmodelled_genetic_assumptions")
    if not blind:
        # 条件化 F2 基因型后，bb 概率等于两亲本各自传 b 的概率之积。
        return Fraction(2, 3) * Fraction(1, 2) * Fraction(2, 3) * Fraction(1, 2)
    f2 = [a + b for a, b in product(model["f1"], repeat=2) if "B" in a + b]
    outcomes = [a + b for p, q in product(f2, repeat=2) for a, b in product(p, q)]
    return Fraction(Counter(outcomes)[model["target"]], len(outcomes))


def check_value(kind, m, value):
    """Path A tests a proposed value and returns an exact, replayable witness."""
    if kind == "pair_sum_progression":
        rows, d = row_numbers(m), exact(value)
        witness = matching_witness(rows, d)
        return witness is not None, {"pairs": witness, "targetDifference": str(d),
                                     "method": "fixed_target_matching"}
    if kind == "occupancy_expectation":
        occupancy_question(m)
        outcomes = list(product(range(m["labels"]), repeat=m["draws"]))
        total = sum(len(set(x)) for x in outcomes)
        return exact(value) * len(outcomes) == total, {"orderedOutcomes": len(outcomes), "distinctTotal": total}
    if kind == "piecewise_shift_interval":
        base, slope, intercept, pivot = interval_problem(m)
        candidate = interval(value)
        cut = (base ** pivot - intercept) / slope - pivot
        actual = S.Interval(0, scalar(max(cut, -pivot)), left_open=True, right_open=True)
        same, witness = compare_sets(actual, candidate)
        return same, {"branchJoin": str(-pivot), "strictUpperBoundary": str(cut),
                      "counterexample": None if same else str(witness)}
    if kind == "circle_parallel_offset_count":
        residual, normal, distance = circle_offsets(m)
        radius = S.Symbol("r", real=True, positive=True)
        left = scalar(normal * normal) * radius**2 - scalar(residual - normal * distance)**2
        right = scalar(normal * normal) * radius**2 - scalar(residual + normal * distance)**2
        solve = lambda relation: S.solve_univariate_inequality(relation, radius, relational=False)
        actual = solve(left > 0).intersect(solve(right < 0)).union(
            solve(left < 0).intersect(solve(right > 0))).intersect(S.Interval.open(0, S.oo))
        # 只有两线同时相切时，才可能还有一个孤立的半径解。
        require(abs(residual - normal * distance) != abs(residual + normal * distance),
                "simultaneous_tangency_outside_interval_subset")
        same, witness = compare_sets(actual, interval(value))
        return same, {"discriminantSigns": [str(left), str(right)],
                      "counterexample": None if same else str(witness)}
    if kind in ("constant_acceleration", "static_friction_limit"):
        inputs = physics_inputs(kind, m)
        try:
            candidate = quantity(value, "acceleration")
        except Unsupported as error:
            if str(error) == "wrong_unit_dimension":
                return False, {"expectedDimension": "acceleration", "providedUnit": value["unit"]}
            raise
        if kind == "constant_acceleration":
            v0, v1, dt = inputs
            delta = abs(v1 - v0) if m["target"] == "magnitude" else v1 - v0
            residual = candidate * dt - delta
        else:
            mu, g = inputs
            residual = candidate - mu * g
        return residual == 0, {"exactResidualSI": str(residual), "candidateSI": str(candidate)}
    if kind == "reaction_balance":
        keys, matrix = reaction_matrix(m["left"], m["right"])
        require(isinstance(value, list) and len(value) == matrix.cols and
                all(type(n) is int and 0 < n <= 10000 for n in value), "invalid_reaction_coefficients")
        require(matrix.cols - matrix.rank() == 1, "non_unique_reaction_balance")
        residual = [int(x) for x in matrix * S.Matrix(value)]
        return not any(residual), {"conservationResiduals": dict(zip(keys, residual))}
    if kind == "redox_feed_ratio":
        ratio, evidence = redox_ratio(m, blind=False)
        return redox_claim(m, value, ratio), {**evidence, "feedRatio": str(ratio), "claim": value}
    expected = genetics_probability(m, blind=False)
    return exact(value) == expected, {"recessiveGameteFrequency": "1/3", "expected": str(expected)}


def derive(kind, m):
    """Path B constructs the result without consulting a proposed answer."""
    if kind == "pair_sum_progression":
        return {str(k): v for k, v in pair_progressions(row_numbers(m)).items()}
    if kind == "occupancy_expectation":
        derived = question_math(occupancy_question(m))
        return derived["exactAnswer"]
    if kind == "piecewise_shift_interval":
        base, slope, intercept, pivot = interval_problem(m)
        d = S.Symbol("d", real=True)
        threshold = scalar(base ** pivot)
        below = S.solve_univariate_inequality(scalar(base)**(scalar(pivot) + d) > threshold, d, relational=False)
        above = S.solve_univariate_inequality(scalar(slope)*(scalar(pivot) + d) + scalar(intercept) > threshold,
                                              d, relational=False)
        result = below.intersect(S.Interval.open(-S.oo, scalar(-pivot))).union(
            above.intersect(S.Interval(scalar(-pivot), S.oo)))
        return interval_json(result)
    if kind == "circle_parallel_offset_count":
        residual, normal, distance = circle_offsets(m)
        near, far = sorted((abs(residual / normal - distance), abs(residual / normal + distance)))
        require(near < far, "simultaneous_tangency_outside_interval_subset")
        return interval_json(S.Interval.open(scalar(near), scalar(far)))
    if kind in ("constant_acceleration", "static_friction_limit"):
        inputs = physics_inputs(kind, m)
        if kind == "constant_acceleration":
            v0, v1, dt = inputs
            result = (v1 - v0) / dt
            if m["target"] == "magnitude":
                result = abs(result)
        else:
            result = inputs[0] * inputs[1]
        return {"value": str(result), "unit": "m/s^2"}
    if kind == "reaction_balance":
        return balance(m["left"], m["right"])
    if kind == "redox_feed_ratio":
        ratio, evidence = redox_ratio(m, blind=True)
        return {"feedRatio": str(ratio), "halfCoefficients": evidence}
    return str(genetics_probability(m, blind=True))


def matches_derivation(kind, model, expected, value):
    if kind == "pair_sum_progression":
        return str(exact(value)) in expected
    if kind in ("piecewise_shift_interval", "circle_parallel_offset_count"):
        return interval(value) == interval(expected)
    if kind in ("constant_acceleration", "static_friction_limit"):
        try:
            return quantity(value, "acceleration") == quantity(expected, "acceleration")
        except Unsupported as error:
            if str(error) == "wrong_unit_dimension":
                return False
            raise
    if kind == "reaction_balance":
        require(isinstance(value, list) and len(value) == len(expected) and
                all(type(n) is int and n > 0 for n in value), "invalid_reaction_coefficients")
        return len({Fraction(a, b) for a, b in zip(value, expected)}) == 1
    if kind == "redox_feed_ratio":
        return redox_claim(model, value, exact(expected["feedRatio"]))
    return exact(value) == exact(expected)


def solve_blind(problem):
    kind, model, options = problem_model(problem)
    expected = derive(kind, model)
    choices = [label for label, value in options.items() if matches_derivation(kind, model, expected, value)]
    require(not options or len(choices) == 1, "blind_choice_not_unique")
    return {"derived": expected, "choice": choices[0] if choices else None}


if __name__ == "__main__":
    import json
    import sys

    raw = sys.stdin.buffer.read(65537)
    try:
        require(len(raw) <= 65536, "blind_input_too_large")
        print(json.dumps({"status": "derived", **solve_blind(json.loads(raw))}, allow_nan=False))
    except (ValueError, TypeError, KeyError, ArithmeticError, NotImplementedError) as error:
        print(json.dumps({"status": "abstained", "reason": str(error) if isinstance(error, Unsupported)
                          else "blind_solver_rejected_input"}))
