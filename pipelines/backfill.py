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


def backfill(instrument_key, start, end):
    """Download and save. Returns (path, candles, trading_days), or None if empty."""
    df = fetch_minutes(instrument_key, start, end)
    if df.is_empty():
        return None

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    out = RAW_DIR / f"{slug(instrument_key)}.parquet"
    df.write_parquet(out)
    return out, df.height, df["ts"].dt.date().n_unique()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("instrument_key")
    parser.add_argument("start", type=date.fromisoformat)
    parser.add_argument("end", type=date.fromisoformat)
    args = parser.parse_args()

    result = backfill(args.instrument_key, args.start, args.end)
    if result is None:
        print("no candles returned, nothing saved")
        return

    out, candles, days = result
    print(f"saved {candles:,} candles over {days} trading days to {out}")


if __name__ == "__main__":
    main()