"""Data contracts: what a valid candle file must look like.

If a downloaded file breaks any of these rules, the pipeline flags it
before anything reaches the database.
"""
import pandera.polars as pa
import polars as pl


def _ohlc_consistent(data):
    # low <= high, and open and close both sit inside the low-high range
    c = pl.col
    return data.lazyframe.select(
        (c("low") <= c("high"))
        & c("open").is_between(c("low"), c("high"))
        & c("close").is_between(c("low"), c("high"))
    )


CANDLES = pa.DataFrameSchema(
    {
        "ts": pa.Column(pl.Datetime("us", "Asia/Kolkata"), unique=True),
        "open": pa.Column(pl.Float64, pa.Check.gt(0)),
        "high": pa.Column(pl.Float64, pa.Check.gt(0)),
        "low": pa.Column(pl.Float64, pa.Check.gt(0)),
        "close": pa.Column(pl.Float64, pa.Check.gt(0)),
        "volume": pa.Column(pl.Int64, pa.Check.ge(0)),
        "oi": pa.Column(pl.Int64, pa.Check.ge(0)),
        "instrument_key": pa.Column(pl.String),
    },
    checks=[pa.Check(_ohlc_consistent, name="ohlc_consistent")],
    strict=True,
)