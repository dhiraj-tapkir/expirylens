"""Signed test: were expiry-day late moves pushed in one direction?

ExpiryLab showed that when a push always goes the same way, a test on signed
late moves catches it far more often than the size test on absolute moves.
This runs that signed test on the real data, once looking for upward pushes
and once for downward ones, since a real manipulator could lean either way.

Two directions means twice the chances of a false alarm, so a result needs
p below 0.005 here to match the 0.01 bar used elsewhere.
"""

import random
import statistics

from pipelines.db import connect
from research.late_move_test import permutation_test

BAR = 0.005  # 0.01 split across the two directions


def main():
    with connect() as conn:
        rows = conn.execute(
            """select index_name, regime, is_expiry, late_move_bps::float
               from daily_late_move
               where regime in ('VWAP_PRE', 'CAS')"""
        ).fetchall()

    print(f"{'test':17}{'expiry':>8}{'normal':>8}{'p up':>9}{'p down':>9}")
    for index_name in ("NIFTY", "SENSEX"):
        for regime in ("VWAP_PRE", "CAS"):
            mine = [(e, v) for idx, reg, e, v in rows if (idx, reg) == (index_name, regime)]
            labels = [e for e, _ in mine]
            values = [v for _, v in mine]

            _, p_up = permutation_test(values, labels, random.Random(42))
            _, p_down = permutation_test([-v for v in values], labels, random.Random(42))
            med_exp = statistics.median(v for e, v in mine if e)
            med_norm = statistics.median(v for e, v in mine if not e)

            flag = "  <- below the bar" if min(p_up, p_down) < BAR else ""
            label = f"{index_name} {regime}"
            print(f"{label:17}{med_exp:>+8.1f}{med_norm:>+8.1f}{p_up:>9.4f}{p_down:>9.4f}{flag}")


if __name__ == "__main__":
    main()
