"""Event-day check: do the results survive without scheduled macro news days?

Budget day and RBI policy decisions can move the close for reasons that have
nothing to do with expiry settlement. This reruns all four permutation tests
with and without those days.

RBI decision days are the last day of each MPC meeting, from RBI's published
schedules for 2025-26 and 2026-27.
"""

import random
from datetime import date

from pipelines.db import connect
from research.late_move_test import permutation_test

EVENT_DAYS = {
    date(2025, 10, 1): "RBI policy",
    date(2025, 12, 5): "RBI policy",
    date(2026, 2, 1): "Union Budget (Sunday session)",
    date(2026, 2, 6): "RBI policy",
    date(2026, 4, 8): "RBI policy",
    date(2026, 6, 5): "RBI policy",
    date(2026, 8, 5): "RBI policy",
    date(2026, 10, 7): "RBI policy",
}


def main():
    with connect() as conn:
        rows = conn.execute(
            """select index_name, regime, day, is_expiry, abs(late_move_bps)::float
               from daily_late_move"""
        ).fetchall()

    expiry_events = sorted({day for _, _, day, is_exp, _ in rows if is_exp and day in EVENT_DAYS})
    print(f"event days that were also expiries: {[str(d) for d in expiry_events] or 'none'}\n")

    for index_name in ("NIFTY", "SENSEX"):
        for regime in ("VWAP_PRE", "CAS"):
            for drop_events in (False, True):
                subset = [
                    (is_exp, v)
                    for idx, reg, day, is_exp, v in rows
                    if idx == index_name
                    and reg == regime
                    and not (drop_events and day in EVENT_DAYS)
                ]
                labels = [is_exp for is_exp, _ in subset]
                values = [v for _, v in subset]

                gap, p = permutation_test(values, labels, random.Random(42))
                label = "without event days" if drop_events else "all days"
                print(
                    f"{index_name:6} {regime:9} {label:19} days: {len(labels):3}  "
                    f"expiries: {sum(labels):2}  median gap: {gap:5.1f} bps  p: {p:.4f}"
                )
            print()


if __name__ == "__main__":
    main()
