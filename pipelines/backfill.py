"""Download 1-minute candles for one instrument and save them as Parquet.

usage:
    uv run python -m pipelines.backfill "NSE_INDEX|Nifty 50" 2026-01-01 2026-11-11
"""
import argparse
import re
from datetime import date
from pathlib import Path

from pipelines.upstox import fetch_minutes

RAW_DIR = Path("data/raw/candles")


def slug(instrument_key):
    # "NSE_INDEX|Nifty 50" -> "nse_index_nifty_50", safe as a file name
    return re.sub(r"[^a-z0-9]+", "_", instrument_key.lower()).strip("_")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("instrument_key")
    parser.add_argument("start", type=date.fromisoformat)
    parser.add_argument("end", type=date.fromisoformat)
    args = parser.parse_args()

    df = fetch_minutes(args.instrument_key, args.start, args.end)
    if df.is_empty():
        print("no candles returned, nothing saved")
        return

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    out = RAW_DIR / f"{slug(args.instrument_key)}.parquet"
    df.write_parquet(out)

    days = df["ts"].dt.date().n_unique()
    print(f"saved {df.height:,} candles over {days} trading days to {out}")


if __name__ == "__main__":
    main()