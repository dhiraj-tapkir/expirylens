"""Contract tests: the candle contract must accept good data and reject bad data."""
from datetime import datetime
from zoneinfo import ZoneInfo

import pandera.errors
import polars as pl
import pytest

from pipelines.contracts import CANDLES

IST = ZoneInfo("Asia/Kolkata")
T0, T1, T2 = (datetime(2026, 1, 5, 9, 15 + i, tzinfo=IST) for i in range(3))


def candles(**changes):
    # three valid 1-minute candles; pass a column to override it
    data = {
        "ts": [T0, T1, T2],
        "open": [100.0, 101.0, 102.0],
        "high": [101.0, 102.0, 103.0],
        "low": [99.0, 100.0, 101.0],
        "close": [100.5, 101.5, 102.5],
        "volume": [0, 0, 0],
        "oi": [0, 0, 0],
        "instrument_key": ["NSE_INDEX|Nifty 50"] * 3,
    }
    data.update(changes)
    return pl.DataFrame(data)


def rejects(df):
    with pytest.raises(pandera.errors.SchemaErrors):
        CANDLES.validate(df, lazy=True)
    return True


def test_good_candles_pass():
    CANDLES.validate(candles(), lazy=True)


def test_high_below_low_is_rejected():
    assert rejects(candles(high=[98.0, 102.0, 103.0]))


def test_close_outside_range_is_rejected():
    assert rejects(candles(close=[100.5, 105.0, 102.5]))


def test_negative_price_is_rejected():
    assert rejects(candles(open=[-1.0, 101.0, 102.0]))


def test_duplicate_minute_is_rejected():
    assert rejects(candles(ts=[T0, T0, T2]))


def test_missing_value_is_rejected():
    assert rejects(candles(close=[100.5, None, 102.5]))


def test_unexpected_column_is_rejected():
    assert rejects(candles().with_columns(pl.lit(1).alias("surprise")))