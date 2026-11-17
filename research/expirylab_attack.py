"""ExpiryLab, step two, part two: plant a manipulator and see who catches it.

A manipulator with a fixed budget buys to push the settlement price up. Each
unit it buys lifts the index by IMPACT bps at once, and the lift fades as other
traders lean against it (exponential decay, time constant DECAY minutes).

Strategies, all with the same budget:
- VWAP rule, buying evenly from 15:00 to 15:30
- VWAP rule, buying evenly from 15:15 to 15:30
- auction rule, the whole budget as one order into the closing auction, for
  auctions as deep as, 3 times deeper than and 10 times deeper than the market

For each we report how far settlement moved, how much of that happened after
15:14 (all the late-move metric can see), and how often two tests catch it at
the real sample sizes: the absolute late-move test used on the real data, and a
signed version that only looks for upward pushes.

Uses the Nifty calibration from research/expirylab.py. The impact numbers are
illustrative: index candles carry no volume, so impact cannot be measured from
this data. The comparison between rules and detectors at one budget is the
point, not the exact bps.
"""

import numpy as np

from research.expirylab import (
    MARK,
    MINUTE_VOL,
    MINUTES,
    auction_settlement,
    honest_paths,
    volume_curve,
    vwap_settlement,
)
from research.power_test import P_BAR, permutation_p

BUDGET = 30  # units; bought all at once, this would lift the index 30 bps
IMPACT = 1.0  # bps per unit, at the moment it trades
DECAY = 5.0  # minutes for a push to fade to about a third
AUCTION_JUMP = 14.8  # Nifty auction-era jump, from research/expirylab.py
TRIALS = 200
SAMPLES = ((178, 48), (54, 15))  # (normal days, expiries): VWAP era, auction era

STRATEGIES = {
    "VWAP, buy 15:00-15:30": ("vwap", (1, 30), None),
    "VWAP, buy 15:15-15:30": ("vwap", (15, 30), None),
    "auction, as deep": ("auction", None, 1),
    "auction, 3x deeper": ("auction", None, 3),
    "auction, 10x deeper": ("auction", None, 10),
}


def push(start, end):
    """Extra index level per minute from buying the budget evenly from start to end."""
    minute = np.arange(MINUTES + 1)
    bought = np.zeros(MINUTES + 1)
    bought[start : end + 1] = BUDGET / (end - start + 1)
    lag = minute[:, None] - minute[None, :]
    fade = np.where(lag >= 0, np.exp(-np.clip(lag, 0, None) / DECAY), 0.0)
    return IMPACT * fade @ bought


def footprint(rule, window, depth):
    """How far settlement moves, and how much of that is after 15:14."""
    if rule == "vwap":
        extra = push(*window)
        volume = volume_curve()
        moved = (extra[1:] * volume).sum() / volume.sum()
        return moved, moved - extra[MARK]
    moved = IMPACT * BUDGET / depth
    return moved, moved


def late_moves(rule, window, depth, days, rng, attacked):
    """Signed late moves (settlement minus the 15:14 level) for simulated days."""
    if rule == "vwap":
        paths = honest_paths(MINUTE_VOL[("NIFTY", "VWAP_PRE")], rng, days)
        if attacked:
            paths = paths + push(*window)
        settle = vwap_settlement(paths)
    else:
        paths = honest_paths(MINUTE_VOL[("NIFTY", "CAS")], rng, days)
        settle = auction_settlement(paths, AUCTION_JUMP, rng)
        if attacked:
            settle = settle + IMPACT * BUDGET / depth
    return settle - paths[:, MARK]


def catch_rates(rule, window, depth, n_normal, n_expiry, rng):
    labels = np.r_[np.zeros(n_normal, bool), np.ones(n_expiry, bool)]
    by_size = by_sign = 0
    for _ in range(TRIALS):
        normal = late_moves(rule, window, depth, n_normal, rng, attacked=False)
        expiry = late_moves(rule, window, depth, n_expiry, rng, attacked=True)
        values = np.concatenate([normal, expiry])
        by_size += permutation_p(np.abs(values), labels, rng) < P_BAR
        by_sign += permutation_p(values, labels, rng) < P_BAR
    return by_size / TRIALS, by_sign / TRIALS


def main():
    rng = np.random.default_rng(42)
    print(f"budget {BUDGET} units, impact {IMPACT} bps per unit, fade {DECAY} min\n")
    print(
        f"{'strategy':23}{'moved':>7}{'after':>7}"
        f"{'size48':>8}{'sign48':>8}{'size15':>8}{'sign15':>8}"
    )
    for name, (rule, window, depth) in STRATEGIES.items():
        moved, after = footprint(rule, window, depth)
        rates = []
        for n_normal, n_expiry in SAMPLES:
            rates += catch_rates(rule, window, depth, n_normal, n_expiry, rng)
        cells = "".join(f"{r:>8.0%}" for r in rates)
        print(f"{name:23}{moved:>7.1f}{after:>7.1f}{cells}")


if __name__ == "__main__":
    main()
