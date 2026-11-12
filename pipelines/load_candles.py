"""Load a saved candle file into the candles_1m hypertable.

usage:
    uv run python -m pipelines.load_candles data/raw/candles/nse_index_nifty_50.parquet
"""
import argparse

import polars as pl

from pipelines.db import connect

COLS = ["instrument_key", "ts", "open", "high", "low", "close", "volume", "oi"]


def guess_instrument(key):
    # "NSE_INDEX|Nifty 50" -> segment NSE_INDEX, symbol Nifty 50
    segment, symbol = key.split("|", 1)
    kind = "INDEX" if segment.endswith("INDEX") else "EQ"
    return key, symbol, segment, kind


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    args = parser.parse_args()

    df = pl.read_parquet(args.path).select(COLS)
    keys = df["instrument_key"].unique().to_list()

    with connect() as conn, conn.cursor() as cur:
        for key in keys:
            cur.execute(
                """insert into instruments (instrument_key, symbol, segment, kind)
                   values (%s, %s, %s, %s)
                   on conflict (instrument_key) do nothing""",
                guess_instrument(key),
            )

        # copy into a temp table first, then move rows across while skipping
        # ones we already have. that makes re-running the load harmless.
        cur.execute("create temp table staging (like candles_1m) on commit drop")
        with cur.copy(f"copy staging ({', '.join(COLS)}) from stdin") as copy:
            for row in df.iter_rows():
                copy.write_row(row)

        cur.execute(
            f"""insert into candles_1m ({', '.join(COLS)})
                select {', '.join(COLS)} from staging
                on conflict (instrument_key, ts) do nothing"""
        )
        inserted = cur.rowcount

    print(f"read {df.height:,} rows, inserted {inserted:,} new ones")


if __name__ == "__main__":
    main()