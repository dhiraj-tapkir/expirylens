"""Power check: how big would an expiry effect have to be for our test to see it?

ExpiryLab, step one. Before asking "is there an expiry effect?", ask "could
the test even detect one?" A test that cannot see a 5 bps effect says little
when it finds nothing.

For each index and era: take that era's real normal-day late moves, draw fake
samples with the same number of normal and expiry days, add a known effect to
the expiry days, and run the same median-gap permutation test. The share of
runs that pass the 0.01 bar is the test's power for that effect size. With no
effect added, about 1% of runs should pass (the false positive rate).
"""

import numpy as np

from pipelines.db import connect

SHUFFLES = 999  # fewer than the main test, plenty for a pass/fail call at 0.01
TRIALS = 300
P_BAR = 0.01
EFFECTS = (0, 2, 4, 6, 8, 10, 15)  # bps added to every simulated expiry day


def permutation_p(values, is_expiry, rng):
    """The median-gap permutation test, vectorised: all shuffles at once."""
    observed = np.median(values[is_expiry]) - np.median(values[~is_expiry])
    shuffled = rng.permuted(np.tile(is_expiry, (SHUFFLES, 1)), axis=1)
    expiry = np.where(shuffled, values, np.nan)
    normal = np.where(~shuffled, values, np.nan)
    gaps = np.nanmedian(expiry, axis=1) - np.nanmedian(normal, axis=1)
    return (np.sum(gaps >= observed) + 1) / (SHUFFLES + 1)


def power(pool, n_normal, n_expiry, effect, rng):
    labels = np.r_[np.zeros(n_normal, bool), np.ones(n_expiry, bool)]
    passed = 0
    for _ in range(TRIALS):
        normal = rng.choice(pool, n_normal)
        expiry = rng.choice(pool, n_expiry) + effect
        passed += permutation_p(np.concatenate([normal, expiry]), labels, rng) < P_BAR
    return passed / TRIALS


def main():
    with connect() as conn:
        rows = conn.execute(
            """select index_name, regime, is_expiry, abs(late_move_bps)::float
               from daily_late_move
               where regime in ('VWAP_PRE', 'CAS')"""
        ).fetchall()

    rng = np.random.default_rng(42)
    effects = "".join(f"{'+' + str(e):>6}" for e in EFFECTS)
    print(f"share of {TRIALS} simulated runs passing p < {P_BAR}, by added effect in bps\n")
    print(f"{'test':17}{'normal':>7}{'expiry':>7}  {effects}")

    for index_name in ("NIFTY", "SENSEX"):
        for regime in ("VWAP_PRE", "CAS"):
            mine = [
                (is_exp, v) for idx, reg, is_exp, v in rows if (idx, reg) == (index_name, regime)
            ]
            pool = np.array([v for is_exp, v in mine if not is_exp])
            n_expiry = sum(is_exp for is_exp, _ in mine)

            powers = [power(pool, len(pool), n_expiry, e, rng) for e in EFFECTS]
            cells = "".join(f"{p:>6.0%}" for p in powers)
            print(f"{index_name + ' ' + regime:17}{len(pool):>7}{n_expiry:>7}  {cells}")


if __name__ == "__main__":
    main()
