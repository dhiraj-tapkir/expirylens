"""Unit tests: small pieces of logic, checked with made-up data.

No database or network needed, so these can run anywhere (including CI).
"""
from datetime import date, datetime
from zoneinfo import ZoneInfo

import polars as pl

from pipelines.backfill import slug
from pipelines.load_candles import COLS, guess_instrument, split_stray
from pipelines.upstox import month_chunks

IST = ZoneInfo("Asia/Kolkata")


def fake_candles(start, end):
    # one flat candle per minute from start to end, inclusive
    ts = pl.datetime_range(start, end, "1m", eager=True)
    return (
        pl.DataFrame({"ts": ts})
        .with_columns(
            pl.lit("NSE_INDEX|Nifty 50").alias("instrument_key"),
            pl.lit(100.0).alias("open"),
            pl.lit(100.0).alias("high"),
            pl.lit(100.0).alias("low"),
            pl.lit(100.0).alias("close"),
            pl.lit(0, dtype=pl.Int64).alias("volume"),
            pl.lit(0, dtype=pl.Int64).alias("oi"),
        )
        .select(COLS)
    )


def test_month_chunks_cover_range_without_gaps_or_overlaps():
    chunks = list(month_chunks(date(2025, 9, 1), date(2026, 11, 11)))

    assert chunks[0][0] == date(2025, 9, 1)
    assert chunks[-1][1] == date(2026, 11, 11)
    for (_, end), (next_start, _) in zip(chunks, chunks[1:]):
        assert (next_start - end).days == 1
    assert all((end - start).days <= 29 for start, end in chunks)


def test_slug_makes_safe_file_names():
    assert slug("NSE_INDEX|Nifty 50") == "nse_index_nifty_50"
    assert slug("BSE_INDEX|SENSEX") == "bse_index_sensex"


def test_guess_instrument_splits_the_key():
    assert guess_instrument("BSE_INDEX|SENSEX") == (
        "BSE_INDEX|SENSEX", "SENSEX", "BSE_INDEX", "INDEX"
    )


def test_stray_print_on_a_normal_day_is_quarantined():
    # 09:15 to 15:30 is 376 candles: a full session plus one stray at 15:30
    df = fake_candles(
        datetime(2026, 1, 5, 9, 15, tzinfo=IST),
        datetime(2026, 1, 5, 15, 30, tzinfo=IST),
    )
    good, stray = split_stray(df)

    assert stray.height == 1
    assert stray["ts"][0].strftime("%H:%M") == "15:30"
    assert good.height + stray.height == df.height


def test_special_short_session_is_left_alone():
    # an evening muhurat-style session: outside normal hours but not stray
    df = fake_candles(
        datetime(2026, 1, 4, 18, 0, tzinfo=IST),
        datetime(2026, 1, 4, 18, 59, tzinfo=IST),
    )
    good, stray = split_stray(df)

    assert stray.is_empty()
    assert good.height == 60