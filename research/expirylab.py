"""ExpiryLab: a small simulator of the last 30 minutes of an expiry day.

Step two, part one: an honest market, with no manipulator yet.

Each simulated day runs one minute at a time from 15:00 to 15:30. The index
takes a random step each minute, sized from the real per-minute volatility
near the close (14:46 to 15:14 on normal days). Volume rises towards the close.

The same days are settled two ways:
- VWAP: the volume-weighted average price from 15:00 to 15:30
- auction: the price when a call auction ends at a random minute between
  15:28 and 15:30, plus an auction jump the continuous market does not explain

The auction jump is sized so simulated late moves match the real ones. The
VWAP rule gets no tuning at all, so how closely it matches is a real test.
"""

import numpy as np

from pipelines.db import connect

DAYS = 200_000
MINUTES = 30  # 15:00 to 15:30
MARK = 14  # the 15:14 candle the late move is measured from

# per-minute volatility in bps, 14:46 to 15:14 on normal days
MINUTE_VOL = {
    ("NIFTY", "VWAP_PRE"): 3.55,
    ("NIFTY", "CAS"): 2.38,
    ("SENSEX", "VWAP_PRE"): 3.61,
    ("SENSEX", "CAS"): 2.55,
}


def honest_paths(vol, rng, days=DAYS):
    """Index level in bps from 15:00, one row per day, columns 15:00 to 15:30."""
    steps = rng.normal(0, vol, (days, MINUTES))
    return np.hstack([np.zeros((days, 1)), steps.cumsum(axis=1)])


def volume_curve():
    """Relative volume per minute, rising towards the close."""
    minute = np.arange(1, MINUTES + 1)
    return 1 + 2 * (minute / MINUTES) ** 2


def vwap_settlement(paths):
    volume = volume_curve()
    return (paths[:, 1:] * volume).sum(axis=1) / volume.sum()


def auction_settlement(paths, jump, rng):
    end = rng.integers(28, 31, len(paths))  # auction ends at 15:28, 15:29 or 15:30
    return paths[np.arange(len(paths)), end] + rng.normal(0, jump, len(paths))


def auction_jump(real_median, vol):
    """Jump size that makes the simulated median late move match the real one."""
    target_sd = real_median / 0.6745  # the median of |normal| is 0.6745 sd
    walk_var = vol**2 * (29 - MARK)  # random walk from 15:14 to about 15:29
    return float(np.sqrt(max(target_sd**2 - walk_var, 0.0)))


def main():
    with connect() as conn:
        rows = conn.execute(
            """select index_name, regime,
                      percentile_cont(0.5) within group (order by abs(late_move_bps))
               from daily_late_move
               where not is_expiry and regime in ('VWAP_PRE', 'CAS')
               group by index_name, regime"""
        ).fetchall()
    real = {(idx, reg): float(median) for idx, reg, median in rows}

    rng = np.random.default_rng(42)
    print("median absolute late move on normal days, bps\n")
    print(f"{'test':17}{'real':>7}{'sim':>7}  how the sim was set")
    for (index_name, regime), vol in MINUTE_VOL.items():
        paths = honest_paths(vol, rng)
        if regime == "VWAP_PRE":
            settle = vwap_settlement(paths)
            how = "no tuning"
        else:
            jump = auction_jump(real[(index_name, regime)], vol)
            settle = auction_settlement(paths, jump, rng)
            how = f"auction jump {jump:.1f} bps"
        sim = np.median(np.abs(settle - paths[:, MARK]))
        label = f"{index_name} {regime}"
        print(f"{label:17}{real[(index_name, regime)]:>7.1f}{sim:>7.1f}  {how}")


if __name__ == "__main__":
    main()
