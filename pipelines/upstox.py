"""Tiny wrapper around Upstox's historical candle API (v3).

Only does one thing: give it an instrument and a date range, get back a
Polars dataframe of 1-minute candles in IST.
"""
import os
from datetime import timedelta
from urllib.parse import quote

import httpx
import polars as pl
from dotenv import load_dotenv

load_dotenv()

BASE = "https://api.upstox.com/v3/historical-candle"

# upstox sends each candle as [ts, open, high, low, close, volume, oi]
SCHEMA = {
    "ts": pl.String,
    "open": pl.Float64,
    "high": pl.Float64,
    "low": pl.Float64,
    "close": pl.Float64,
    "volume": pl.Int64,
    "oi": pl.Int64,
}


def _client():
    token = os.environ.get("UPSTOX_ACCESS_TOKEN")
    if not token:
        raise SystemExit("UPSTOX_ACCESS_TOKEN is missing from .env")
    return httpx.Client(
        headers={"Accept": "application/json", "Authorization": f"Bearer {token}"},
        timeout=30,
    )


def month_chunks(start, end):
    # 1-minute data only comes about a month per request, so split the range
    cur = start
    while cur <= end:
        stop = min(cur + timedelta(days=29), end)
        yield cur, stop
        cur = stop + timedelta(days=1)


def fetch_minutes(instrument_key, start, end):
    frames = []
    with _client() as http:
        for a, b in month_chunks(start, end):
            # note the order: the API wants to_date first, then from_date
            url = f"{BASE}/{quote(instrument_key, safe='')}/minutes/1/{b}/{a}"
            resp = http.get(url)
            resp.raise_for_status()
            rows = resp.json()["data"]["candles"]
            if rows:
                frames.append(pl.DataFrame(rows, schema=SCHEMA, orient="row", strict=False))

    if not frames:
        return pl.DataFrame(schema=SCHEMA | {"instrument_key": pl.String})

    return (
        pl.concat(frames)
        .with_columns(
            pl.col("ts")
            .str.to_datetime("%Y-%m-%dT%H:%M:%S%z")
            .dt.convert_time_zone("Asia/Kolkata"),
            pl.lit(instrument_key).alias("instrument_key"),
        )
        .unique(subset=["ts"])
        .sort("ts")
    )