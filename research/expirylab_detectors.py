"""ExpiryLab, step three: can a better detector close the blind spot?

The late-move test measures settlement against the 15:14 level. A push that
starts at 15:00 lifts the 15:14 level too, so the test sees almost nothing.

This compares three detectors, all signed (looking for upward pushes):
- late move: settlement minus the 15:14 level (the test used so far)
- window move: settlement minus the 15:00 level, before any push began
- combined: flags if either test passes at half the bar, so the overall false
  alarm rate stays at about 1%

Each is run on honest days (to check false alarms) and on the manipulation
strategies from research/expirylab_attack.py, at both real sample sizes.
"""

import numpy as np

from research.expirylab import (
    MARK,
    MINUTE_VOL,
    auction_settlement,
    honest_paths,
    vwap_settlement,
)
from research.expirylab_attack import AUCTION_JUMP, BUDGET, IMPACT, push
from research.power_test import P_BAR, permutation_p

TRIALS = 200
SAMPLES = ((178, 48), (54, 15))  # (normal days, expiries): VWAP era, auction era

STRATEGIES = {
    "no manipulation": ("vwap", None, None),
    "VWAP, buy 15:00-15:30": ("vwap", (1, 30), None),
    "VWAP, buy 15:15-15:30": ("vwap", (15, 30), None),
    "auction, 3x deeper": ("auction", None, 3),
}


def moves(rule, window, depth, days, rng, attacked):
    """Late moves (from 15:14) and window moves (from 15:00) for simulated days."""
    if rule == "vwap":
        paths = honest_paths(MINUTE_VOL[("NIFTY", "VWAP_PRE")], rng, days)
        if attacked and window:
            paths = paths + push(*window)
        settle = vwap_settlement(paths)
    else:
        paths = honest_paths(MINUTE_VOL[("NIFTY", "CAS")], rng, days)
        settle = auction_settlement(paths, AUCTION_JUMP, rng)
        if attacked:
            settle = settle + IMPACT * BUDGET / depth
    return settle - paths[:, MARK], settle - paths[:, 0]


def catch_rates(rule, window, depth, n_normal, n_expiry, rng):
    labels = np.r_[np.zeros(n_normal, bool), np.ones(n_expiry, bool)]
    late = window_hits = either = 0
    for _ in range(TRIALS):
        normal = moves(rule, window, depth, n_normal, rng, attacked=False)
        expiry = moves(rule, window, depth, n_expiry, rng, attacked=True)
        p_late = permutation_p(np.concatenate([normal[0], expiry[0]]), labels, rng)
        p_window = permutation_p(np.concatenate([normal[1], expiry[1]]), labels, rng)
        late += p_late < P_BAR
        window_hits += p_window < P_BAR
        either += min(p_late, p_window) < P_BAR / 2
    return late / TRIALS, window_hits / TRIALS, either / TRIALS


def main():
    rng = np.random.default_rng(42)
    print("share of simulated studies that flag manipulation (p below the bar)\n")
    for n_normal, n_expiry in SAMPLES:
        print(f"{n_expiry} expiries")
        print(f"  {'strategy':23}{'late':>8}{'window':>8}{'combined':>10}")
        for name, (rule, window, depth) in STRATEGIES.items():
            rates = catch_rates(rule, window, depth, n_normal, n_expiry, rng)
            late, window_rate, either = (f"{r:.0%}" for r in rates)
            print(f"  {name:23}{late:>8}{window_rate:>8}{either:>10}")
        print()


if __name__ == "__main__":
    main()
