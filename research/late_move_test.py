"""Permutation test: are expiry-day late moves bigger than normal days?

For each index and settlement regime, compare the median absolute late move
on expiry days vs normal days. Then shuffle the expiry labels many times to
see how often pure chance produces a gap at least that big.

Also runs a robustness check with the 13 Aug 2026 Sensex expiry (the day in
SEBI's Copthall interim order) left out, to see if one day drives the result.
"""
import random
import statistics
from datetime import date

from pipelines.db import connect

SHUFFLES = 10_000
COPTHALL_DAY = date(2026, 8, 13)


def median_gap(values, labels):
    expiry = [v for v, is_exp in zip(values, labels) if is_exp]
    normal = [v for v, is_exp in zip(values, labels) if not is_exp]
    return statistics.median(expiry) - statistics.median(normal)


def permutation_test(values, labels, rng):
    observed = median_gap(values, labels)
    shuffled = labels[:]
    as_big = 0
    for _ in range(SHUFFLES):
        rng.shuffle(shuffled)
        if median_gap(values, shuffled) >= observed:
            as_big += 1
    return observed, (as_big + 1) / (SHUFFLES + 1)


def main():
    with connect() as conn:
        rows = conn.execute(
            """select index_name, regime, day, is_expiry, abs(late_move_bps)::float
               from daily_late_move"""
        ).fetchall()

    rng = random.Random(42)  # fixed seed so results are reproducible

    checks = [
        ("NIFTY", "VWAP_PRE", None),
        ("NIFTY", "CAS", None),
        ("SENSEX", "VWAP_PRE", None),
        ("SENSEX", "CAS", None),
        ("SENSEX", "CAS", COPTHALL_DAY),  # same test, one day left out
    ]

    for index_name, regime, skip_day in checks:
        subset = [
            (is_exp, v)
            for idx, reg, day, is_exp, v in rows
            if idx == index_name and reg == regime and day != skip_day
        ]
        labels = [is_exp for is_exp, _ in subset]
        values = [v for _, v in subset]

        gap, p = permutation_test(values, labels, rng)
        note = f" (without {skip_day})" if skip_day else ""
        print(
            f"{index_name:6} {regime:9} expiries: {sum(labels):2}  "
            f"median gap: {gap:5.1f} bps  p: {p:.4f}{note}"
        )


if __name__ == "__main__":
    main()