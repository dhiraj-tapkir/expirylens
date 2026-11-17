"""Window test: run the 15:00-reference detector on the real data.

ExpiryLab showed that a push starting at 15:00 is invisible to the late-move
test (which starts at 15:14) but partly visible to a window move: settlement
minus the 15:00 level. This runs that window test on real expiry days, in both
directions, with the same bar as the signed test (0.005 per direction).
"""

import random
import statistics

from pipelines.db import connect
from research.late_move_test import permutation_test

BAR = 0.005  # 0.01 split across the two directions


def main():
    with connect() as conn:
        rows = conn.execute(
            """select d.index_name, d.regime, d.is_expiry,
                      ((d.px_last - c.close) / c.close * 10000)::float as window_bps
               from daily_late_move d
               join candles_1m c
                 on c.instrument_key = case d.index_name
                                         when 'NIFTY' then 'NSE_INDEX|Nifty 50'
                                         else 'BSE_INDEX|SENSEX' end
                and c.ts = (d.day + time '15:00') at time zone 'Asia/Kolkata'
               where d.regime in ('VWAP_PRE', 'CAS')"""
        ).fetchall()

    print(f"{'test':17}{'days':>6}{'expiry':>8}{'normal':>8}{'p up':>9}{'p down':>9}")
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
            print(
                f"{label:17}{len(mine):>6}{med_exp:>+8.1f}{med_norm:>+8.1f}"
                f"{p_up:>9.4f}{p_down:>9.4f}{flag}"
            )


if __name__ == "__main__":
    main()
