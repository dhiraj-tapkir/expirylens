"""Export derived results as JSON for the static dashboard.

Only computed results go out (expiry calendar, daily late moves, summary).
Raw candle data never leaves the local database.

usage:
    uv run python -m pipelines.export_site_data
"""

import json
from decimal import Decimal
from pathlib import Path

from psycopg.rows import dict_row

from pipelines.db import connect

OUT_DIR = Path("web/public/data")

QUERIES = {
    "summary": """
        select index_name, regime, is_expiry, count(*) as days,
               round((percentile_cont(0.5) within group
                      (order by abs(late_move_bps)))::numeric, 1) as median_abs_bps
        from daily_late_move
        group by 1, 2, 3
        order by 1, 2 desc, 3""",
    "late_moves": """
        select index_name, day, late_move_bps, is_expiry, regime
        from daily_late_move
        order by index_name, day""",
    "expiries": """
        select index_name, expiry_date, settlement_rule
        from expiry_calendar
        order by index_name, expiry_date""",
}


def to_json_value(value):
    # numeric columns come back as Decimal and dates as date objects
    if isinstance(value, Decimal):
        return float(value)
    return str(value)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.row_factory = dict_row
        for name, sql in QUERIES.items():
            rows = conn.execute(sql).fetchall()
            out = OUT_DIR / f"{name}.json"
            out.write_text(json.dumps(rows, default=to_json_value, indent=1) + "\n")
            print(f"wrote {len(rows):,} rows to {out}")


if __name__ == "__main__":
    main()
