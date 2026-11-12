"""Permutation test: are expiry-day late moves bigger than normal days?

Within each settlement regime, compare the median absolute late move on
expiry days vs normal days. Then shuffle the expiry labels many times to see
how often pure chance produces a gap at least that big.
"""
import random
import statistics

from pipelines.db import connect

SHUFFLES = 10_000


def median_gap(values, labels):
    expiry = [v for v, is_exp in zip(values, labels) if is_exp]
    normal = [v for v, is_exp in zip(values, labels) if not is_exp]
    return statistics.median(expiry) - statistics.median(normal)


def main():
    with connect() as conn:
        rows = conn.execute(
            "select regime, is_expiry, abs(late_move_bps)::float from daily_late_move"
        ).fetchall()

    rng = random.Random(42)  # fixed seed so the result is reproducible

    for regime in ("VWAP_PRE", "CAS"):
        subset = [(is_exp, v) for r, is_exp, v in rows if r == regime]
        labels = [is_exp for is_exp, _ in subset]
        values = [v for _, v in subset]

        observed = median_gap(values, labels)

        as_big = 0
        shuffled = labels[:]
        for _ in range(SHUFFLES):
            rng.shuffle(shuffled)
            if median_gap(values, shuffled) >= observed:
                as_big += 1

        p_value = (as_big + 1) / (SHUFFLES + 1)
        print(
            f"{regime:9}  expiry days: {sum(labels):3}  "
            f"median gap: {observed:5.1f} bps  p-value: {p_value:.4f}"
        )


if __name__ == "__main__":
    main()