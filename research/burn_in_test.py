"""Burn-in check: does the auction-era result survive without its first days?

The closing auction started on Mon 3 Aug 2026 and its first sessions were
unusually volatile (see docs/findings.md). If the auction-era results were
just a transition shock, they should weaken a lot once those days are dropped.

Each line reruns the permutation test from late_move_test.py on a different
slice of the auction era, each with its own fixed seed, so the lines can be
compared with each other.
"""

import random
from datetime import date

from pipelines.db import connect
from research.late_move_test import permutation_test

# label -> drop every auction day up to and including this date
WINDOWS = {
    "all auction days": None,
    "without 3 to 7 Aug": date(2026, 8, 7),
    "without 3 to 14 Aug": date(2026, 8, 14),
}


def main():
    with connect() as conn:
        rows = conn.execute(
            """select index_name, day, is_expiry, abs(late_move_bps)::float
               from daily_late_move
               where regime = 'CAS'"""
        ).fetchall()

    for index_name in ("NIFTY", "SENSEX"):
        print(index_name)
        for label, drop_until in WINDOWS.items():
            subset = [
                (is_exp, v)
                for idx, day, is_exp, v in rows
                if idx == index_name and (drop_until is None or day > drop_until)
            ]
            labels = [is_exp for is_exp, _ in subset]
            values = [v for _, v in subset]

            gap, p = permutation_test(values, labels, random.Random(42))
            print(
                f"  {label:20} days: {len(labels):3}  expiries: {sum(labels):2}  "
                f"median gap: {gap:5.1f} bps  p: {p:.4f}"
            )


if __name__ == "__main__":
    main()
