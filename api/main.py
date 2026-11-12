"""Read-only API over the expirylens database.

run it with:
    uv run uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
interactive docs at /docs
"""
from typing import Literal

from fastapi import FastAPI
from psycopg.rows import dict_row

from pipelines.db import connect

app = FastAPI(
    title="ExpiryLens API",
    description="Read-only access to expiry calendars and late-move results.",
    version="0.1.0",
)

Index = Literal["NIFTY", "SENSEX"]


def query(sql, params=()):
    with connect() as conn:
        conn.row_factory = dict_row  # rows come back as {"column": value}
        return conn.execute(sql, params).fetchall()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/expiries")
def expiries(index: Index):
    """Every expiry for one index, with the settlement rule that applied."""
    return query(
        """select expiry_date, settlement_rule
           from expiry_calendar
           where index_name = %s
           order by expiry_date""",
        (index,),
    )


@app.get("/late-moves")
def late_moves(index: Index, expiry_only: bool = False):
    """Daily late move (15:14 candle to final close) in basis points."""
    return query(
        """select day, late_move_bps, is_expiry, regime
           from daily_late_move
           where index_name = %s and (not %s or is_expiry)
           order by day""",
        (index, expiry_only),
    )


@app.get("/summary")
def summary():
    """Median absolute late move by index, regime and expiry vs normal day."""
    return query(
        """select index_name, regime, is_expiry, count(*) as days,
                  round((percentile_cont(0.5) within group
                         (order by abs(late_move_bps)))::numeric, 1) as median_abs_bps
           from daily_late_move
           group by 1, 2, 3
           order by 1, 2 desc, 3"""
    )