"""Load a saved candle file into the candles_1m hypertable.

usage:
    uv run python -m pipelines.load_candles data/raw/candles/nse_index_nifty_50.parquet

Data quality rule: on a normal trading day, candles outside 09:15-15:29 are
stray prints and go to the quarantine table instead. Special short sessions
(like diwali muhurat trading) are left alone.
"""
import argparse
from datetime import time

import polars as pl
from psycopg.types.json import Jsonb

from pipelines.db import connect

COLS = ["instrument_key", "ts", "open", "high", "low", "close", "volume", "oi"]
SESSION_START = time(9, 15)
SESSION_END = time(15, 29)
FULL_DAY_MIN = 300  # a day with this many in-session candles is a normal day


def guess_instrument(key):
    # "NSE_INDEX|Nifty 50" -> segment NSE_INDEX, symbol Nifty 50
    segment, symbol = key.split("|", 1)
    kind = "INDEX" if segment.endswith("INDEX") else "EQ"
    return key, symbol, segment, kind


def split_stray(df):
    df = df.with_columns(
        pl.col("ts").dt.date().alias("_day"),
        pl.col("ts").dt.time().is_between(SESSION_START, SESSION_END).alias("_in"),
    )
    full_days = (
        df.filter(pl.col("_in"))
        .group_by("_day")
        .len()
        .filter(pl.col("len") >= FULL_DAY_MIN)["_day"]
    )
    is_stray = ~pl.col("_in") & pl.col("_day").is_in(full_days.implode())
    good = df.filter(~is_stray).select(COLS)
    stray = df.filter(is_stray).select(COLS)
    return good, stray


def load_file(path):
    """Load one parquet file. Returns (rows_read, inserted, quarantined)."""
    df = pl.read_parquet(path).select(COLS)
    good, stray = split_stray(df)
    keys = df["instrument_key"].unique().to_list()

    with connect() as conn, conn.cursor() as cur:
        for key in keys:
            cur.execute(
                """insert into instruments (instrument_key, symbol, segment, kind)
                   values (%s, %s, %s, %s)
                   on conflict (instrument_key) do nothing""",
                guess_instrument(key),
            )

        # clear this instrument's old quarantine rows first, so re-runs don't pile up
        cur.execute(
            """delete from quarantine
               where table_name = 'candles_1m'
                 and payload->>'instrument_key' = any(%s)""",
            (keys,),
        )
        for row in stray.iter_rows(named=True):
            row["ts"] = row["ts"].isoformat()
            cur.execute(
                "insert into quarantine (table_name, payload, reason) values (%s, %s, %s)",
                ("candles_1m", Jsonb(row), "outside 09:15-15:29 on a normal day"),
            )

        # copy into a temp table first, then move rows across while skipping
        # ones we already have. that makes re-running the load harmless.
        cur.execute("create temp table staging (like candles_1m) on commit drop")
        with cur.copy(f"copy staging ({', '.join(COLS)}) from stdin") as copy:
            for row in good.iter_rows():
                copy.write_row(row)

        cur.execute(
            f"""insert into candles_1m ({', '.join(COLS)})
                select {', '.join(COLS)} from staging
                on conflict (instrument_key, ts) do nothing"""
        )
        inserted = cur.rowcount

    return df.height, inserted, stray.height


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    args = parser.parse_args()

    rows, inserted, quarantined = load_file(args.path)
    print(f"read {rows:,} rows, inserted {inserted:,} new, quarantined {quarantined:,}")


if __name__ == "__main__":
    main()